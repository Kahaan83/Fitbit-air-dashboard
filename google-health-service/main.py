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
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator, ValidationError
from models import HealthDataResponse

from auth import get_credentials, get_token_info
from derived_metrics import (
    calculate_ans_balance,
    calculate_sleep_debt_series,
    calculate_vo2_max_series,
    identify_acute_stress,
)
from extractor import fetch_all

def _unwrap(result, name: str) -> list:
    if isinstance(result, Exception):
        logger.error(f"{name} fetch failed: {result}")
        return []
    return result or []

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
async def get_health_data() -> JSONResponse:
    """
    Returns the cached health data payload.

    If the cache is empty, this dynamically triggers a sync for the past 30 days
    and caches the results. If the credentials or token are missing/invalid,
    it gracefully returns the empty shell payload so the frontend can display
    Sample Data Mode.

    The Cache-Control header (max-age=300) prevents excessive backend querying.
    """
    # Return cached payload if available
    if _cache["payload"] is not None and _cache["synced_at"] is not None:
        synced_at = _cache["synced_at"]
        if time.time() - synced_at > 14400:
            stale_payload = {**_cache["payload"], "stale": True}
            headers = {"Cache-Control": "max-age=300"}
            return _validate_and_respond(stale_payload, headers)
        else:
            headers = {"Cache-Control": "max-age=300"}
            return _validate_and_respond(_cache["payload"], headers)

    # Cache is empty: try to run automatic sync for the past 30 days
    from datetime import timedelta
    end_date_obj = datetime.now(timezone.utc).date()
    start_date_obj = end_date_obj - timedelta(days=30)
    
    start_date_str = start_date_obj.isoformat()
    end_date_str = end_date_obj.isoformat()

    logger.info(f"Auto-syncing past 30 days: {start_date_str} to {end_date_str}")
    
    try:
        credentials = await get_credentials()
        date_range = {"start_date": start_date_str, "end_date": end_date_str}
        
        # Fetch all data streams in parallel
        results = await fetch_all(credentials, date_range)
        heart_rate = _unwrap(results[0], "heart_rate")
        spo2 = _unwrap(results[1], "spo2")
        steps = _unwrap(results[2], "steps")
        daily_hrv = _unwrap(results[3], "daily_hrv")
        daily_spo2 = _unwrap(results[4], "daily_spo2")
        daily_resting_hr = _unwrap(results[5], "daily_resting_hr")
        sleep_temp = _unwrap(results[6], "sleep_temp")
        sleep = _unwrap(results[7], "sleep")

        hrv = daily_hrv

        # Run derived metrics calculations
        ans_balance = []
        if not isinstance(hrv, list):
            logger.error(f"daily_hrv returned unexpected type: {type(hrv)} — skipping ANS calculation")
            hrv = []
        try:
            ans_balance = calculate_ans_balance(hrv)
        except Exception as e:
            logger.error(f"Auto-sync calculate_ans_balance failed: {e}")

        vo2_max = []
        try:
            vo2_max = calculate_vo2_max_series(daily_resting_hr, USER_MAX_HR)
        except Exception as e:
            logger.error(f"Auto-sync calculate_vo2_max_series failed: {e}")

        acute_stress = []
        try:
            acute_stress = identify_acute_stress(heart_rate, steps, USER_RESTING_HR)
        except Exception as e:
            logger.error(f"Auto-sync identify_acute_stress failed: {e}")

        sleep_debt = []
        try:
            sleep_debt = calculate_sleep_debt_series(sleep, USER_TARGET_SLEEP_HOURS)
        except Exception as e:
            logger.error(f"Auto-sync calculate_sleep_debt_series failed: {e}")

        # Build compliance payload: 'hrv' contains daily_hrv for trends
        payload = {
            "heart_rate": heart_rate,
            "hrv": daily_hrv,
            "spo2": spo2,
            "daily_spo2": daily_spo2,
            "daily_resting_hr": daily_resting_hr,
            "sleep_temp": sleep_temp,
            "sleep": sleep,
            "steps": steps,
            "derived": {
                "ans_balance": ans_balance,
                "vo2_max": vo2_max,
                "acute_stress": acute_stress,
                "sleep_debt": sleep_debt,
            },
        }
        
        _cache["payload"] = payload
        _cache["synced_at"] = time.time()
        _cache["auto_synced_at"] = time.time()
        
        # Check size bound
        payload_size = sys.getsizeof(json.dumps(_cache["payload"]))
        if payload_size > 50 * 1024 * 1024:
            logger.warning("Cache payload exceeds 50MB — consider filtering the date range.")
        
        headers = {"Cache-Control": "max-age=300"}
        return _validate_and_respond(payload, headers)
        
    except Exception as e:
        logger.warning(
            f"Auto-sync on startup failed ({e}). Returning empty physiological shell."
        )
        # Graceful fallback to empty shell for Sample Mode
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
        if elapsed < 60:
            retry_after = int(60 - elapsed)
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

    # ── Authenticate ──────────────────────────────────────────────────────────
    try:
        credentials = await get_credentials()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Authentication failed: {e}")
        raise HTTPException(status_code=503, detail=f"Authentication failed: {str(e)}")

    date_range = {"start_date": body.start_date, "end_date": body.end_date}

    # ── Fetch all raw data ────────────────────────────────────────────────────
    logger.info("Fetching raw data from Google Health API v4...")

    # Fetch all data streams in parallel
    results = await fetch_all(credentials, date_range)
    heart_rate = _unwrap(results[0], "heart_rate")
    spo2 = _unwrap(results[1], "spo2")
    steps = _unwrap(results[2], "steps")
    daily_hrv = _unwrap(results[3], "daily_hrv")
    daily_spo2 = _unwrap(results[4], "daily_spo2")
    daily_resting_hr = _unwrap(results[5], "daily_resting_hr")
    sleep_temp = _unwrap(results[6], "sleep_temp")
    sleep = _unwrap(results[7], "sleep")

    hrv = daily_hrv

    # ── Run derived metrics ───────────────────────────────────────────────────
    ans_balance = []
    if not isinstance(hrv, list):
        logger.error(f"daily_hrv returned unexpected type: {type(hrv)} — skipping ANS calculation")
        hrv = []
    try:
        ans_balance = calculate_ans_balance(hrv)
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

    # ── Build and cache compliance payload ────────────────────────────────────
    payload = {
        "heart_rate": heart_rate,
        "hrv": daily_hrv,  # Compliance: HRV maps to daily rollup trend in frontend
        "spo2": spo2,
        "daily_spo2": daily_spo2,
        "daily_resting_hr": daily_resting_hr,
        "sleep_temp": sleep_temp,
        "sleep": sleep,
        "steps": steps,
        "derived": {
            "ans_balance": ans_balance,
            "vo2_max": vo2_max,
            "acute_stress": acute_stress,
            "sleep_debt": sleep_debt,
        },
    }

    _cache["payload"] = payload
    _cache["synced_at"] = time.time()
    _cache["user_synced_at"] = time.time()

    # Check size bound
    payload_size = sys.getsizeof(json.dumps(_cache["payload"]))
    if payload_size > 50 * 1024 * 1024:
        logger.warning("Cache payload exceeds 50MB — consider filtering the date range.")

    total_records = (
        len(heart_rate)
        + len(hrv)
        + len(spo2)
        + len(sleep_temp)
        + len(sleep)
        + len(steps)
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

