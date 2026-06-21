"""
main.py — FastAPI server for the Google Health physiological dashboard.

Exposes three endpoints:
  GET  /api/status         — Token validity and scope info
  GET  /api/health-data    — Full raw + derived data payload (empty shell in Phase 1)
  POST /api/trigger-sync   — Force re-sync for a date range, cache results

CORS is configured to allow requests from http://localhost:3000 (Next.js dev server).
Run with: uvicorn main:app --reload --port 8000
"""

import json
import logging
import hashlib
import os
import sys
import time
from datetime import datetime, timezone, date, timedelta
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, field_validator, ValidationError
from models import HealthDataResponse

from auth import get_credentials, get_token_info
from derived_metrics import (
    calculate_ans_balance,
    calculate_sleep_debt_series,
    calculate_vo2_max_series,
    identify_acute_stress,
)
from client import HealthAPIClient
from extractor import fetch_all, downsample_to_minutes
import cache

def _unwrap(result, name: str) -> list:
    if isinstance(result, Exception):
        logger.error(f"{name} fetch failed: {result}")
        return []
    return result or []

def _hash_inputs(*data_lists) -> str:
    combined = json.dumps(data_lists, sort_keys=True, default=str)
    return hashlib.md5(combined.encode()).hexdigest()

def _date_range(start: str, end: str) -> list[str]:
    s = date.fromisoformat(start)
    e = date.fromisoformat(end)
    return [(s + timedelta(days=i)).isoformat() for i in range((e-s).days + 1)]

def slice_by_day(data_list: list[dict]) -> dict[str, list[dict]]:
    from collections import defaultdict
    by_day = defaultdict(list)
    for p in data_list:
        ts = p.get("timestamp") or p.get("date") or p.get("startTime", "")
        if ts:
            day_str = ts[:10]  # Extracts YYYY-MM-DD
            by_day[day_str].append(p)
    return by_day

def assemble_payload(day_dicts: list[dict]) -> dict[str, list]:
    payload = {
        "heart_rate": [],
        "hrv": [],
        "spo2": [],
        "daily_spo2": [],
        "daily_resting_hr": [],
        "sleep_temp": [],
        "sleep": [],
        "steps": [],
    }
    for day_data in day_dicts:
        payload["heart_rate"].extend(day_data.get("heart_rate", []))
        payload["hrv"].extend(day_data.get("daily_hrv", []))
        payload["spo2"].extend(day_data.get("spo2", []))
        payload["daily_spo2"].extend(day_data.get("daily_spo2", []))
        payload["daily_resting_hr"].extend(day_data.get("daily_resting_hr", []))
        payload["sleep_temp"].extend(day_data.get("sleep_temp", []))
        payload["sleep"].extend(day_data.get("sleep", []))
        payload["steps"].extend(day_data.get("steps", []))
    return payload


def _assemble_and_derive_payload(all_days: list[str]) -> dict:
    raw_payload = assemble_payload([
        _cache["days"][d] for d in all_days if d in _cache["days"]
    ])

    daily_hrv = raw_payload["hrv"]
    heart_rate = raw_payload["heart_rate"]
    sleep = raw_payload["sleep"]
    steps = raw_payload["steps"]
    daily_resting_hr = raw_payload["daily_resting_hr"]

    # Hash inputs to check if derived metrics need to be recomputed
    raw_hash = _hash_inputs(daily_hrv, heart_rate, sleep, steps, daily_resting_hr)

    if _cache.get("derived_hash") == raw_hash and "derived" in _cache:
        derived = _cache["derived"]
    else:
        ans_balance = []
        if not isinstance(daily_hrv, list):
            logger.error(f"daily_hrv returned unexpected type: {type(daily_hrv)} — skipping ANS calculation")
            hrv_list = []
        else:
            hrv_list = daily_hrv
        try:
            ans_balance = calculate_ans_balance(hrv_list)
        except Exception as e:
            logger.error(f"calculate_ans_balance failed: {e}")

        vo2_max = []
        try:
            vo2_max = calculate_vo2_max_series(daily_resting_hr, USER_MAX_HR)
        except Exception as e:
            logger.error(f"calculate_vo2_max_series failed: {e}")

        acute_stress = []
        try:
            acute_stress = identify_acute_stress(heart_rate, steps, USER_RESTING_HR)
        except Exception as e:
            logger.error(f"identify_acute_stress failed: {e}")

        sleep_debt = []
        try:
            sleep_debt = calculate_sleep_debt_series(sleep, USER_TARGET_SLEEP_HOURS)
        except Exception as e:
            logger.error(f"calculate_sleep_debt_series failed: {e}")

        derived = {
            "ans_balance": ans_balance,
            "vo2_max": vo2_max,
            "acute_stress": acute_stress,
            "sleep_debt": sleep_debt,
        }
        _cache["derived"] = derived
        _cache["derived_hash"] = raw_hash

    payload = {
        **raw_payload,
        "derived": derived,
    }
    return payload


async def _background_sync_range(missing_days: list[str]):
    if not missing_days:
        return
    fetch_start = missing_days[0]
    fetch_end = missing_days[-1]
    
    logger.info(f"Syncing missing range: {fetch_start} to {fetch_end}")
    credentials = await get_credentials()

    # Fetch all data streams in parallel
    client = HealthAPIClient(credentials.token)
    try:
        results = await fetch_all(client, {"start_date": fetch_start, "end_date": fetch_end})
    finally:
        await client.close()

    heart_rate = _unwrap(results[0], "heart_rate")
    spo2 = _unwrap(results[1], "spo2")
    steps = _unwrap(results[2], "steps")
    daily_hrv = _unwrap(results[3], "daily_hrv")
    daily_spo2 = _unwrap(results[4], "daily_spo2")
    daily_resting_hr = _unwrap(results[5], "daily_resting_hr")
    sleep_temp = _unwrap(results[6], "sleep_temp")
    sleep = _unwrap(results[7], "sleep")

    hr_by_day = slice_by_day(heart_rate)
    spo2_by_day = slice_by_day(spo2)
    steps_by_day = slice_by_day(steps)
    hrv_by_day = slice_by_day(daily_hrv)
    daily_spo2_by_day = slice_by_day(daily_spo2)
    resting_hr_by_day = slice_by_day(daily_resting_hr)
    sleep_temp_by_day = slice_by_day(sleep_temp)
    sleep_by_day = slice_by_day(sleep)

    fetched_days = _date_range(fetch_start, fetch_end)
    for d in fetched_days:
        day_data = {
            "heart_rate": hr_by_day.get(d, []),
            "spo2": spo2_by_day.get(d, []),
            "steps": steps_by_day.get(d, []),
            "daily_hrv": hrv_by_day.get(d, []),
            "daily_spo2": daily_spo2_by_day.get(d, []),
            "daily_resting_hr": resting_hr_by_day.get(d, []),
            "sleep_temp": sleep_temp_by_day.get(d, []),
            "sleep": sleep_by_day.get(d, []),
        }
        cache.set_day(d, day_data)
        _cache["days"][d] = day_data
    _cache["synced_at"] = time.time()

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("main")

# ─── Environment ──────────────────────────────────────────────────────────────
load_dotenv()

if "GCP_PROJECT_ID" not in os.environ or not os.environ["GCP_PROJECT_ID"]:
    raise RuntimeError("GCP_PROJECT_ID environment variable is missing or empty in .env. Startup aborted.")

USER_MAX_HR = float(os.getenv("USER_MAX_HR", "185"))
USER_RESTING_HR = float(os.getenv("USER_RESTING_HR", "58"))
USER_TARGET_SLEEP_HOURS = float(os.getenv("USER_TARGET_SLEEP_HOURS", "8"))

# ─── In-memory cache ──────────────────────────────────────────────────────────
# Stores the most recently fetched payload. Cleared on trigger-sync.
# Phase 2 uses the empty shell; Phase 3 populates with real data.
_cache: dict[str, Any] = {
    "payload": None,        # The last full health-data response
    "synced_at": None,      # ISO 8601 timestamp of last successful sync
    "auto_synced_at": None, # timestamp of last automatic background sync
    "user_synced_at": None, # timestamp of last user-triggered manual sync
    "derived": None,
    "derived_hash": None,
    "days": {},             # key: "YYYY-MM-DD", value: { heart_rate: [...], hrv: [...], ... }
}

# ─── Empty response shell ─────────────────────────────────────────────────────
def _empty_health_payload() -> dict[str, Any]:
    """Returns the standard empty payload structure for Phase 1."""
    return {
        "heart_rate": [],
        "hrv": [],
        "spo2": [],
        "sleep_temp": [],
        "sleep": [],
        "steps": [],
        "derived": {
            "ans_balance": [],
            "vo2_max": [],
            "acute_stress": [],
            "sleep_debt": [],
        },
    }


# ─── FastAPI App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="Fitbit Air — Google Health API Gateway",
    description=(
        "Local FastAPI server that authenticates with Google OAuth 2.0, "
        "pulls physiological telemetry from the Google Health API v4, "
        "and exposes computed metrics for the Next.js dashboard."
    ),
    version="1.0.0",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
import os
ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN")
# Strict check for ALLOWED_ORIGIN is required for production to prevent cross-origin authorization token theft
if not ALLOWED_ORIGIN:
    raise RuntimeError("CORS ALLOWED_ORIGIN environment variable is missing or empty in .env. Wildcard fallbacks are not allowed.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)


# ─── Request / Response Models ────────────────────────────────────────────────
class SyncRequest(BaseModel):
    start_date: str
    end_date: str

    @field_validator("start_date", "end_date")
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError(f"Date must be in YYYY-MM-DD format, got: '{v}'")
        return v


class SettingsRequest(BaseModel):
    client_id: str
    client_secret: str | None = None
    age: int
    max_hr: float
    resting_hr: float
    target_sleep_hours: float


class BaselinesRequest(BaseModel):
    age: int
    max_hr: float
    resting_hr: float
    target_sleep_hours: float


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def warm_cache():
    from datetime import date, timedelta
    dates = [(date.today() - timedelta(days=i)).isoformat() for i in range(90)]
    _cache["days"] = cache.get_days(dates)
    logger.info(f"Cache warmed: {len(_cache['days'])} days loaded from disk")

@app.post("/api/settings", summary="Update GCP credentials and user baselines")
async def update_settings(body: SettingsRequest) -> JSONResponse:
    # 1. Update credentials.json
    try:
        from auth import CREDENTIALS_PATH, TOKEN_PATH
        existing_client_id = ""
        existing_client_secret = ""
        if os.path.exists(CREDENTIALS_PATH):
            try:
                with open(CREDENTIALS_PATH, "r") as f:
                    old_data = json.load(f)
                installed_data = old_data.get("installed", {})
                existing_client_id = installed_data.get("client_id", "")
                existing_client_secret = installed_data.get("client_secret", "")
            except Exception:
                pass

        final_client_id = body.client_id if body.client_id.strip() else existing_client_id
        
        # Load from request body, environment variable, or fallback to existing
        body_client_secret = body.client_secret if body.client_secret and body.client_secret.strip() else None
        env_client_secret = os.getenv("GCP_CLIENT_SECRET")
        final_client_secret = body_client_secret or env_client_secret or existing_client_secret

        creds_data = {
            "installed": {
                "client_id": final_client_id,
                "client_secret": final_client_secret,
                "project_id": os.getenv("GCP_PROJECT_ID", ""),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "redirect_uris": ["http://localhost"]
            }
        }
        with open(CREDENTIALS_PATH, "w") as f:
            json.dump(creds_data, f, indent=2)
        logger.info("Updated credentials.json (retained old values if new ones were blank).")
    except Exception as e:
        logger.error(f"Failed to update credentials.json: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update credentials.json: {str(e)}")

    # 2. Update .env file / environment variables
    try:
        env_lines = []
        if os.path.exists(".env"):
            with open(".env", "r") as f:
                env_lines = f.readlines()
        
        def update_env_var(lines, key, val):
            found = False
            for i, line in enumerate(lines):
                if line.strip().startswith(f"{key}="):
                    lines[i] = f"{key}={val}\n"
                    found = True
                    break
            if not found:
                lines.append(f"{key}={val}\n")
        
        update_env_var(env_lines, "USER_MAX_HR", body.max_hr)
        update_env_var(env_lines, "USER_RESTING_HR", body.resting_hr)
        update_env_var(env_lines, "USER_TARGET_SLEEP_HOURS", body.target_sleep_hours)
        if body.client_secret and body.client_secret.strip():
            update_env_var(env_lines, "GCP_CLIENT_SECRET", body.client_secret.strip())
            os.environ["GCP_CLIENT_SECRET"] = body.client_secret.strip()
        
        with open(".env", "w") as f:
            f.writelines(env_lines)
            
        # Update current runtime variables
        global USER_MAX_HR, USER_RESTING_HR, USER_TARGET_SLEEP_HOURS
        USER_MAX_HR = body.max_hr
        USER_RESTING_HR = body.resting_hr
        USER_TARGET_SLEEP_HOURS = body.target_sleep_hours
        
        logger.info("Updated .env and runtime user physiological baselines (including GCP secret if provided).")
    except Exception as e:
        logger.error(f"Failed to update .env: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update .env: {str(e)}")

    # 3. Clear/validate token if client_id changed
    try:
        from auth import TOKEN_PATH
        if os.path.exists(TOKEN_PATH):
            with open(TOKEN_PATH, "r") as f:
                token_data = json.load(f)
            if token_data.get("client_id") != body.client_id:
                os.remove(TOKEN_PATH)
                logger.info("Client ID changed. Deleted old token.json.")
    except Exception as e:
        logger.warning(f"Failed to inspect/delete old token.json: {e}")

    return JSONResponse(content={"status": "success", "message": "Settings updated successfully."})


@app.patch("/api/settings/baselines", summary="Update user physiological baselines")
async def update_baselines(body: BaselinesRequest) -> JSONResponse:
    # Update .env file / environment variables
    try:
        env_lines = []
        if os.path.exists(".env"):
            with open(".env", "r") as f:
                env_lines = f.readlines()
        
        def update_env_var(lines, key, val):
            found = False
            for i, line in enumerate(lines):
                if line.strip().startswith(f"{key}="):
                    lines[i] = f"{key}={val}\n"
                    found = True
                    break
            if not found:
                lines.append(f"{key}={val}\n")
        
        update_env_var(env_lines, "USER_MAX_HR", body.max_hr)
        update_env_var(env_lines, "USER_RESTING_HR", body.resting_hr)
        update_env_var(env_lines, "USER_TARGET_SLEEP_HOURS", body.target_sleep_hours)
        
        with open(".env", "w") as f:
            f.writelines(env_lines)
            
        # Update current runtime variables
        global USER_MAX_HR, USER_RESTING_HR, USER_TARGET_SLEEP_HOURS
        USER_MAX_HR = body.max_hr
        USER_RESTING_HR = body.resting_hr
        USER_TARGET_SLEEP_HOURS = body.target_sleep_hours
        
        logger.info("Updated .env and runtime user physiological baselines (baselines-only patch).")
    except Exception as e:
        logger.error(f"Failed to update baselines .env: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update baselines .env: {str(e)}")

    return JSONResponse(content={"status": "success", "message": "Baselines updated successfully."})


@app.get("/api/status", summary="OAuth token status and scope info")
async def get_status() -> JSONResponse:
    """
    Returns the current OAuth token status.

    Response schema:
        {
            "token_valid": bool,
            "scopes": list[str],
            "last_refreshed": str | null  (ISO 8601)
        }
    """
    info = get_token_info()
    return JSONResponse(content=info)


def _validate_and_respond(payload: dict[str, Any], headers: dict[str, str]) -> JSONResponse:
    # TODO: add response_model after models.py is aligned with payload shape.
    return JSONResponse(content=payload, headers=headers)


@app.get("/api/health-data", summary="Full raw and derived health data payload")
async def get_health_data(
    start_date: str | None = None,
    end_date: str | None = None,
    background_tasks: BackgroundTasks = None,
) -> JSONResponse:
    """
    Returns the cached health data payload.

    If the cache is empty, this dynamically triggers a sync for the past 30 days
    and caches the results. If the credentials or token are missing/invalid,
    it gracefully returns the empty shell payload so the frontend can display
    Sample Data Mode.

    The Cache-Control header (max-age=300) prevents excessive backend querying.
    """
    # Resolve date range
    if not start_date or not end_date:
        from datetime import timedelta
        end_date_obj = datetime.now(timezone.utc).date()
        start_date_obj = end_date_obj - timedelta(days=30)
        start_date_str = start_date_obj.isoformat()
        end_date_str = end_date_obj.isoformat()
    else:
        start_date_str = start_date
        end_date_str = end_date

    # Get list of requested days
    all_days = _date_range(start_date_str, end_date_str)

    # Ensure days cache contains elements
    if "days" not in _cache:
        _cache["days"] = {}

    # Try to warm in-memory cache from database
    missing_in_mem = [d for d in all_days if d not in _cache["days"]]
    if missing_in_mem:
        db_days = cache.get_days(missing_in_mem)
        _cache["days"].update(db_days)

    # Identify which days are still missing from both database and memory
    missing_days = [d for d in all_days if d not in _cache["days"]]
    cached_days = [d for d in all_days if d in _cache["days"]]

    # Check if the OAuth token is currently valid
    token_info = get_token_info()
    token_valid = token_info.get("token_valid", False)

    # Return cached data if any requested days are cached and we have a valid token
    if cached_days and token_valid:
        payload = _assemble_and_derive_payload(all_days)
        
        # Schedule background refresh for missing days if any
        if missing_days and background_tasks:
            background_tasks.add_task(
                _background_sync_range, missing_days
            )
            
        payload["stale"] = bool(missing_days)
        _cache["payload"] = payload
        
        headers = {"Cache-Control": "max-age=300"}
        return _validate_and_respond(payload, headers)
    else:
        # Truly cold cache — must wait for first sync of all days
        try:
            await _background_sync_range(all_days)
            payload = _assemble_and_derive_payload(all_days)
            payload["stale"] = False
            _cache["payload"] = payload
            _cache["synced_at"] = time.time()
            
            headers = {"Cache-Control": "max-age=300"}
            return _validate_and_respond(payload, headers)
        except Exception as e:
            logger.warning(
                f"Auto-sync on startup failed ({e}). Returning empty physiological shell."
            )
            payload = _empty_health_payload()
            headers = {"Cache-Control": "max-age=300"}
            return _validate_and_respond(payload, headers)


@app.post("/api/trigger-sync", summary="Force re-sync for a date range")
async def trigger_sync(body: SyncRequest) -> JSONResponse:
    """
    Calls all extractor functions in sequence for the given date range.

    Runs derived metric calculations and caches results in memory.
    """
    if body.end_date < body.start_date:
        return JSONResponse(
            status_code=400,
            content={"error": "end_date must be after start_date"}
        )
    last_user_sync = _cache.get("user_synced_at")
    if last_user_sync is not None:
        elapsed = time.time() - last_user_sync
        if elapsed < 10:
            retry_after = int(10 - elapsed)
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Sync cooldown active",
                    "retry_after": retry_after,
                    "last_user_sync": last_user_sync
                }
            )

    logger.info(
        f"trigger-sync: Fetching data from {body.start_date} to {body.end_date}"
    )

    all_days = _date_range(body.start_date, body.end_date)
    if "days" not in _cache:
        _cache["days"] = {}
    missing_in_mem = [d for d in all_days if d not in _cache["days"]]
    if missing_in_mem:
        db_days = cache.get_days(missing_in_mem)
        _cache["days"].update(db_days)
    missing_days = [d for d in all_days if d not in _cache["days"]]

    if missing_days:
        try:
            await _background_sync_range(missing_days)
        except FileNotFoundError as e:
            raise HTTPException(status_code=503, detail=str(e))
        except RuntimeError as e:
            raise HTTPException(status_code=403, detail=str(e))
        except Exception as e:
            logger.error(f"Authentication or sync failed: {e}")
            raise HTTPException(status_code=503, detail=f"Sync failed: {str(e)}")
        _cache["user_synced_at"] = time.time()

    payload = _assemble_and_derive_payload(all_days)
    _cache["payload"] = payload
    _cache["synced_at"] = time.time()
    _cache["user_synced_at"] = time.time()

    # Check size bound
    payload_size = sys.getsizeof(json.dumps(_cache["payload"]))
    if payload_size > 50 * 1024 * 1024:
        logger.warning("Cache payload exceeds 50MB — consider filtering the date range.")

    total_records = (
        len(payload["heart_rate"])
        + len(payload["hrv"])
        + len(payload["spo2"])
        + len(payload["sleep_temp"])
        + len(payload["sleep"])
        + len(payload["steps"])
    )

    logger.info(
        f"trigger-sync complete: {total_records} raw records cached at "
        f"{_cache['synced_at']}"
    )

    return JSONResponse(content={
        "status": "ok",
        "records_fetched": total_records,
        "synced_at": _cache["synced_at"],
    })


@app.get("/api/sync-stream", summary="Stream physiological sync progress via SSE")
async def sync_stream(start_date: str, end_date: str) -> StreamingResponse:
    """
    Kicks off all fetches in parallel for the date range, emitting progress events.
    """
    try:
        credentials = await get_credentials()
    except Exception as e:
        logger.error(f"Sync stream auth failed: {e}")
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

    all_days = _date_range(start_date, end_date)
    days_count = len(all_days)

    async def empty_list():
        return []

    async def event_generator():
        async def emit(event: str, data: dict):
            return f"event: {event}\ndata: {json.dumps(data)}\n\n"

        client = HealthAPIClient(credentials.token)
        try:
            # Handle heart rate date range limit
            start_date_hr = start_date
            try:
                from datetime import datetime, timedelta
                limit_days = int(os.getenv("HEART_RATE_DAYS_LIMIT", "7"))
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                if (end_dt - start_dt).days > limit_days:
                    start_date_hr = (end_dt - timedelta(days=limit_days)).strftime("%Y-%m-%d")
            except Exception as e:
                logger.warning(f"Failed to apply heart rate date range limit: {e}")

            # Enforce resolution caps based on date range
            if days_count > 7:
                logger.info(f"Sync range is {days_count} days (> 7 days). Skipping intraday Heart Rate and SpO2 fetches.")
                heart_rate_coro = empty_list()
                spo2_coro = empty_list()
            else:
                heart_rate_coro = client.get_heart_rate(start_date_hr, end_date)
                spo2_coro = client.get_spo2(start_date, end_date)

            tasks_dict = {
                "heart_rate": heart_rate_coro,
                "spo2": spo2_coro,
                "steps": client.get_steps(start_date, end_date),
                "hrv": client.get_daily_hrv(start_date, end_date),
                "daily_spo2": client.get_daily_spo2(start_date, end_date),
                "daily_resting_hr": client.get_daily_resting_hr(start_date, end_date),
                "sleep_temp": client.get_sleep_temp(start_date, end_date),
                "sleep": client.get_sleep(start_date, end_date),
            }

            futures = {name: asyncio.create_task(coro) for name, coro in tasks_dict.items()}
            total_tasks = len(futures)
            completed_count = 0
            results = {}

            pending = set(futures.values())
            while pending:
                done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    task_name = next(name for name, fut in futures.items() if fut == task)
                    try:
                        res = task.result()
                    except Exception as e:
                        logger.error(f"SSE task {task_name} failed: {e}")
                        res = []
                        yield await emit("error", {"step": task_name, "message": str(e)})
                    
                    results[task_name] = res
                    completed_count += 1
                    yield await emit("progress", {
                        "step": task_name,
                        "done": completed_count,
                        "total": total_tasks
                    })

            # Process / downsample / cache / slice results by day
            heart_rate_raw = results.get("heart_rate", [])
            spo2_raw = results.get("spo2", [])
            if isinstance(heart_rate_raw, list) and heart_rate_raw:
                heart_rate_raw = downsample_to_minutes(heart_rate_raw, "bpm")
            if isinstance(spo2_raw, list) and spo2_raw:
                spo2_raw = downsample_to_minutes(spo2_raw, "value")

            steps_raw = results.get("steps", [])
            hrv_raw = results.get("hrv", [])
            daily_spo2_raw = results.get("daily_spo2", [])
            resting_hr_raw = results.get("daily_resting_hr", [])
            sleep_temp_raw = results.get("sleep_temp", [])
            sleep_raw = results.get("sleep", [])

            # Slice by day
            hr_by_day = slice_by_day(heart_rate_raw)
            spo2_by_day = slice_by_day(spo2_raw)
            steps_by_day = slice_by_day(steps_raw)
            hrv_by_day = slice_by_day(hrv_raw)
            daily_spo2_by_day = slice_by_day(daily_spo2_raw)
            resting_hr_by_day = slice_by_day(resting_hr_raw)
            sleep_temp_by_day = slice_by_day(sleep_temp_raw)
            sleep_by_day = slice_by_day(sleep_raw)

            # Store in cache
            for d in all_days:
                day_data = {
                    "heart_rate": hr_by_day.get(d, []),
                    "spo2": spo2_by_day.get(d, []),
                    "steps": steps_by_day.get(d, []),
                    "daily_hrv": hrv_by_day.get(d, []),
                    "daily_spo2": daily_spo2_by_day.get(d, []),
                    "daily_resting_hr": resting_hr_by_day.get(d, []),
                    "sleep_temp": sleep_temp_by_day.get(d, []),
                    "sleep": sleep_by_day.get(d, []),
                }
                cache.set_day(d, day_data)
                _cache["days"][d] = day_data

            _cache["synced_at"] = time.time()
            _cache["user_synced_at"] = time.time()

            payload = _assemble_and_derive_payload(all_days)
            payload["stale"] = False
            _cache["payload"] = payload

            yield await emit("complete", payload)

        except Exception as e:
            logger.error(f"Error in sync stream: {e}")
            yield await emit("error", {"step": "general", "message": str(e)})
        finally:
            await client.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ─── Root health check ────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {
        "service": "Fitbit Air — Google Health API Gateway",
        "status": "running",
        "docs": "http://localhost:8000/docs",
    }


@app.get("/health", include_in_schema=False)
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/alerts", summary="Get physiological alert triggers")
async def get_alerts() -> JSONResponse:
    """
    Evaluates cached physiological telemetry against safety thresholds.
    Thresholds:
      - SpO2 < 90% (Hypoxemia)
      - High severity acute stress events
      - Sleep debt > 3 hours (Significant sleep deprivation)
    """
    alerts = []
    payload = _cache.get("payload")
    if not payload:
        return JSONResponse(content=[])

    # Check SpO2
    spo2_readings = payload.get("spo2", [])
    for reading in spo2_readings:
        val = reading.get("value")
        if val is not None and val < 90.0:
            alerts.append({
                "type": "spo2_drop",
                "message": f"Oxygen saturation dropped below threshold: {val}%",
                "severity": "high",
                "timestamp": reading.get("timestamp")
            })

    # Check High Stress
    stress_events = payload.get("derived", {}).get("acute_stress", [])
    for event in stress_events:
        if event.get("severity") == "high":
            alerts.append({
                "type": "high_stress",
                "message": f"High severity acute stress event detected (Peak HR: {event.get('hr_peak')} bpm)",
                "severity": "medium",
                "timestamp": event.get("start")
            })

    # Check Sleep Debt
    sleep_debt_series = payload.get("derived", {}).get("sleep_debt", [])
    if sleep_debt_series:
        latest = sleep_debt_series[-1]
        debt = latest.get("debt_hours", 0.0)
        if debt > 3.0:
            alerts.append({
                "type": "sleep_deprivation",
                "message": f"Significant sleep debt accumulated: {debt} hours",
                "severity": "low",
                "date": latest.get("date")
            })

    return JSONResponse(content=alerts)

