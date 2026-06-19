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
import time
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator

from auth import get_credentials, get_token_info
from derived_metrics import (
    calculate_ans_balance,
    calculate_sleep_debt,
    calculate_vo2_max,
    identify_acute_stress,
)
from extractor import (
    fetch_daily_hrv,
    fetch_daily_resting_hr,
    fetch_daily_spo2,
    fetch_heart_rate,
    fetch_hrv,
    fetch_sleep,
    fetch_sleep_temp,
    fetch_spo2,
    fetch_steps,
)

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
        env_client_secret = os.getenv("FITBIT_CLIENT_SECRET") or os.getenv("GCP_CLIENT_SECRET")
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
        
        with open(".env", "w") as f:
            f.writelines(env_lines)
            
        # Update current runtime variables
        global USER_MAX_HR, USER_RESTING_HR, USER_TARGET_SLEEP_HOURS
        USER_MAX_HR = body.max_hr
        USER_RESTING_HR = body.resting_hr
        USER_TARGET_SLEEP_HOURS = body.target_sleep_hours
        
        logger.info("Updated .env and runtime user physiological baselines.")
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
    # Return cached payload if available and not older than 5 minutes
    if _cache["payload"] is not None and _cache["synced_at"] is not None:
        from datetime import timedelta
        synced_time = datetime.fromisoformat(_cache["synced_at"])
        if datetime.now(timezone.utc) - synced_time < timedelta(minutes=5):
            headers = {"Cache-Control": "max-age=300"}
            return JSONResponse(content=_cache["payload"], headers=headers)

    # Cache is empty: try to run automatic sync for the past 30 days
    from datetime import timedelta
    end_date_obj = datetime.now(timezone.utc).date()
    start_date_obj = end_date_obj - timedelta(days=30)
    
    start_date_str = start_date_obj.isoformat()
    end_date_str = end_date_obj.isoformat()

    logger.info(f"Auto-syncing past 30 days: {start_date_str} to {end_date_str}")
    
    try:
        credentials = get_credentials()
        date_range = {"start_date": start_date_str, "end_date": end_date_str}
        
        # Fetch all data streams
        heart_rate = fetch_heart_rate(credentials, date_range)
        hrv = fetch_hrv(credentials, date_range)
        spo2 = fetch_spo2(credentials, date_range)
        steps = fetch_steps(credentials, date_range)
        daily_hrv = fetch_daily_hrv(credentials, date_range)
        daily_spo2 = fetch_daily_spo2(credentials, date_range)
        daily_resting_hr = fetch_daily_resting_hr(credentials, date_range)
        sleep_temp = fetch_sleep_temp(credentials, date_range)
        sleep = fetch_sleep(credentials, date_range)

        # Run derived metrics calculations
        ans_balance = []
        try:
            ans_balance = calculate_ans_balance(hrv)
        except Exception as e:
            logger.error(f"Auto-sync calculate_ans_balance failed: {e}")

        vo2_max = []
        try:
            vo2_max = calculate_vo2_max(daily_resting_hr, USER_MAX_HR)
        except Exception as e:
            logger.error(f"Auto-sync calculate_vo2_max failed: {e}")

        acute_stress = []
        try:
            acute_stress = identify_acute_stress(heart_rate, steps, USER_RESTING_HR)
        except Exception as e:
            logger.error(f"Auto-sync identify_acute_stress failed: {e}")

        sleep_debt = []
        try:
            sleep_debt = calculate_sleep_debt(sleep, USER_TARGET_SLEEP_HOURS)
        except Exception as e:
            logger.error(f"Auto-sync calculate_sleep_debt failed: {e}")

        # Build compliance payload: 'hrv' contains daily_hrv for trends, 'raw_hrv' keeps intraday
        payload = {
            "heart_rate": heart_rate,
            "hrv": daily_hrv,
            "raw_hrv": hrv,
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
        _cache["synced_at"] = datetime.now(timezone.utc).isoformat()
        _cache["last_sync_at"] = time.time()
        
        headers = {"Cache-Control": "max-age=300"}
        return JSONResponse(content=payload, headers=headers)
        
    except Exception as e:
        logger.warning(
            f"Auto-sync on startup failed ({e}). Returning empty physiological shell."
        )
        # Graceful fallback to empty shell for Sample Mode
        payload = _empty_health_payload()
        headers = {"Cache-Control": "max-age=300"}
        return JSONResponse(content=payload, headers=headers)


@app.post("/api/trigger-sync", summary="Force re-sync for a date range")
async def trigger_sync(body: SyncRequest) -> JSONResponse:
    """
    Calls all extractor functions in sequence for the given date range.

    Runs derived metric calculations and caches results in memory.
    """
    last_sync = _cache.get("last_sync_at")
    if last_sync is not None:
        elapsed = time.time() - last_sync
        if elapsed < 60:
            retry_after = int(60 - elapsed)
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Sync cooldown active",
                    "retry_after": retry_after
                }
            )

    logger.info(
        f"trigger-sync: Fetching data from {body.start_date} to {body.end_date}"
    )

    # ── Authenticate ──────────────────────────────────────────────────────────
    try:
        credentials = get_credentials()
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

    heart_rate = fetch_heart_rate(credentials, date_range)
    hrv = fetch_hrv(credentials, date_range)
    spo2 = fetch_spo2(credentials, date_range)
    steps = fetch_steps(credentials, date_range)
    daily_hrv = fetch_daily_hrv(credentials, date_range)
    daily_spo2 = fetch_daily_spo2(credentials, date_range)
    daily_resting_hr = fetch_daily_resting_hr(credentials, date_range)
    sleep_temp = fetch_sleep_temp(credentials, date_range)
    sleep = fetch_sleep(credentials, date_range)

    # ── Run derived metrics ───────────────────────────────────────────────────
    ans_balance = []
    try:
        ans_balance = calculate_ans_balance(hrv)
    except Exception as e:
        logger.error(f"calculate_ans_balance failed: {e}")

    vo2_max = []
    try:
        vo2_max = calculate_vo2_max(daily_resting_hr, USER_MAX_HR)
    except Exception as e:
        logger.error(f"calculate_vo2_max failed: {e}")

    acute_stress = []
    try:
        acute_stress = identify_acute_stress(heart_rate, steps, USER_RESTING_HR)
    except Exception as e:
        logger.error(f"identify_acute_stress failed: {e}")

    sleep_debt = []
    try:
        sleep_debt = calculate_sleep_debt(sleep, USER_TARGET_SLEEP_HOURS)
    except Exception as e:
        logger.error(f"calculate_sleep_debt failed: {e}")

    # ── Build and cache compliance payload ────────────────────────────────────
    payload = {
        "heart_rate": heart_rate,
        "hrv": daily_hrv,  # Compliance: HRV maps to daily rollup trend in frontend
        "raw_hrv": hrv,
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
    _cache["synced_at"] = datetime.now(timezone.utc).isoformat()
    _cache["last_sync_at"] = time.time()

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
