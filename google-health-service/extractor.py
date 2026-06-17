"""
extractor.py — Google Health API v4 data extraction functions.

Two distinct API patterns:
  GET  /v4/users/me/...                  → list (intraday raw data)
  POST /v4/users/me/...:dailyRollUp      → daily aggregates

All functions return:
    list[dict] with schema:
    [{"timestamp": str (ISO 8601), "value": float | dict, "data_type": str}]

If a function returns an empty list, the caller should not treat this as an
error — the data may simply not be available for the requested date range.
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import requests
from dotenv import load_dotenv
from google.oauth2.credentials import Credentials

load_dotenv()

logger = logging.getLogger("extractor")

SKIN_TEMP_AVAILABLE: bool = os.getenv("SKIN_TEMP_AVAILABLE", "true").lower() == "true"

# ─── Base URLs ────────────────────────────────────────────────────────────────
BASE_URL = "https://health.googleapis.com/v4"
HEALTH_METRICS_LIST_URL = f"{BASE_URL}/users/me/healthMetricsAndMeasurements"
HEALTH_METRICS_ROLLUP_URL = f"{BASE_URL}/users/me/healthMetricsAndMeasurements:dailyRollUp"
ACTIVITY_LIST_URL = f"{BASE_URL}/users/me/activityAndFitness"
SLEEP_URL = f"{BASE_URL}/users/me/sleep:query"  # sleep-specific endpoint


# ─── Shared Helpers ───────────────────────────────────────────────────────────

def _get_auth_headers(credentials: Credentials) -> dict[str, str]:
    """Return Authorization header using the credentials Bearer token."""
    return {
        "Authorization": f"Bearer {credentials.token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _iso_to_epoch_millis(date_str: str) -> int:
    """Convert 'YYYY-MM-DD' to Unix epoch milliseconds (start of day UTC)."""
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)


def _epoch_millis_to_iso(epoch_ms: int | str) -> str:
    """Convert Unix epoch milliseconds to ISO 8601 string."""
    epoch_ms = int(epoch_ms)
    dt = datetime.fromtimestamp(epoch_ms / 1000, tz=timezone.utc)
    return dt.isoformat()


def _normalize_response(
    raw_points: list[dict[str, Any]],
    data_type: str,
    value_key: str = "value",
) -> list[dict[str, Any]]:
    """
    Normalize a list of raw API data points into the standard schema.

    Args:
        raw_points: List of raw point dicts from the API response.
        data_type:  The data type ID string (e.g., 'HEART_RATE').
        value_key:  The field name within each point containing the numeric value.

    Returns:
        list[dict]: Normalized records with keys: timestamp, value, data_type.
    """
    normalized = []
    for point in raw_points:
        # Timestamps may be in epoch_ms (int) or ISO string — handle both
        ts_raw = point.get("startTime") or point.get("timestamp") or point.get("date")
        if ts_raw is None:
            continue

        if isinstance(ts_raw, (int, float)):
            timestamp = _epoch_millis_to_iso(int(ts_raw))
        elif isinstance(ts_raw, str) and ts_raw.isdigit():
            timestamp = _epoch_millis_to_iso(int(ts_raw))
        else:
            # Already ISO or date string
            timestamp = ts_raw

        # Value may be nested — try to extract a float or keep as dict
        raw_val = point.get(value_key) or point.get("value") or point.get("values")
        if isinstance(raw_val, list) and len(raw_val) > 0:
            # Take the first numeric value if it's a list
            first = raw_val[0]
            value: float | dict = first.get("fpVal") or first.get("intVal") or first
        elif isinstance(raw_val, dict):
            value = raw_val.get("fpVal") or raw_val.get("intVal") or raw_val
        elif isinstance(raw_val, (int, float)):
            value = float(raw_val)
        else:
            value = raw_val  # type: ignore[assignment]

        normalized.append({
            "timestamp": timestamp,
            "value": value,
            "data_type": data_type,
        })
    return normalized


def _handle_response_errors(response: requests.Response, context: str) -> bool:
    """
    Log errors from an API response.

    Returns:
        True if the response is OK (2xx), False otherwise.
    """
    if response.ok:
        return True

    if response.status_code == 401:
        logger.error(
            f"[{context}] 401 Unauthorized — token may be expired or revoked. "
            "Run auth.py to re-authenticate."
        )
    elif response.status_code == 403:
        logger.error(
            f"[{context}] 403 Forbidden — the Google Health API scope may not be "
            "approved for this GCP project, or this account is not in the test users list."
        )
    elif response.status_code == 404:
        logger.warning(
            f"[{context}] 404 Not Found — this data type may not be available "
            "for this account or date range."
        )
    elif response.status_code == 429:
        logger.warning(f"[{context}] 429 Rate Limited — back off and retry.")
    else:
        logger.error(
            f"[{context}] HTTP {response.status_code}: {response.text[:300]}"
        )
    return False


# ─── GET-based list calls (intraday raw data) ─────────────────────────────────

def fetch_heart_rate(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """
    Fetch intraday heart rate data via GET /healthMetricsAndMeasurements.

    Args:
        credentials: Valid Google OAuth2 credentials.
        date_range:  {"start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD"}

    Returns:
        list[dict]: [{"timestamp": ISO8601, "value": float (bpm), "data_type": "HEART_RATE"}]
    """
    params = {
        "dataTypeId": "HEART_RATE",
        "startTime": _iso_to_epoch_millis(date_range["start_date"]),
        "endTime": _iso_to_epoch_millis(date_range["end_date"]),
    }
    response = requests.get(
        HEALTH_METRICS_LIST_URL,
        headers=_get_auth_headers(credentials),
        params=params,
        timeout=30,
    )
    if not _handle_response_errors(response, "fetch_heart_rate"):
        return []

    data = response.json()
    points = data.get("dataPoint", data.get("point", data.get("measurements", [])))
    logger.info(f"fetch_heart_rate: {len(points)} points returned.")
    return _normalize_response(points, "HEART_RATE")


def fetch_hrv(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """
    Fetch intraday heart rate variability (RMSSD) data via GET /healthMetricsAndMeasurements.

    Args:
        credentials: Valid Google OAuth2 credentials.
        date_range:  {"start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD"}

    Returns:
        list[dict]: [{"timestamp": ISO8601, "value": float (RMSSD ms), "data_type": "HEART_RATE_VARIABILITY"}]
    """
    params = {
        "dataTypeId": "HEART_RATE_VARIABILITY",
        "startTime": _iso_to_epoch_millis(date_range["start_date"]),
        "endTime": _iso_to_epoch_millis(date_range["end_date"]),
    }
    response = requests.get(
        HEALTH_METRICS_LIST_URL,
        headers=_get_auth_headers(credentials),
        params=params,
        timeout=30,
    )
    if not _handle_response_errors(response, "fetch_hrv"):
        return []

    data = response.json()
    points = data.get("dataPoint", data.get("point", data.get("measurements", [])))
    logger.info(f"fetch_hrv: {len(points)} points returned.")
    return _normalize_response(points, "HEART_RATE_VARIABILITY")


def fetch_spo2(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """
    Fetch intraday oxygen saturation (SpO2) data via GET /healthMetricsAndMeasurements.

    Args:
        credentials: Valid Google OAuth2 credentials.
        date_range:  {"start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD"}

    Returns:
        list[dict]: [{"timestamp": ISO8601, "value": float (%), "data_type": "OXYGEN_SATURATION"}]
    """
    params = {
        "dataTypeId": "OXYGEN_SATURATION",
        "startTime": _iso_to_epoch_millis(date_range["start_date"]),
        "endTime": _iso_to_epoch_millis(date_range["end_date"]),
    }
    response = requests.get(
        HEALTH_METRICS_LIST_URL,
        headers=_get_auth_headers(credentials),
        params=params,
        timeout=30,
    )
    if not _handle_response_errors(response, "fetch_spo2"):
        return []

    data = response.json()
    points = data.get("dataPoint", data.get("point", data.get("measurements", [])))
    logger.info(f"fetch_spo2: {len(points)} points returned.")
    return _normalize_response(points, "OXYGEN_SATURATION")


def fetch_steps(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """
    Fetch intraday step count data via GET /activityAndFitness.

    Steps are required for the acute stress detection algorithm, which
    cross-references HR spikes with zero-movement windows.

    Args:
        credentials: Valid Google OAuth2 credentials.
        date_range:  {"start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD"}

    Returns:
        list[dict]: [{"timestamp": ISO8601, "value": int (step count), "data_type": "STEPS"}]
    """
    params = {
        "dataTypeId": "STEPS",
        "startTime": _iso_to_epoch_millis(date_range["start_date"]),
        "endTime": _iso_to_epoch_millis(date_range["end_date"]),
    }
    response = requests.get(
        ACTIVITY_LIST_URL,
        headers=_get_auth_headers(credentials),
        params=params,
        timeout=30,
    )
    if not _handle_response_errors(response, "fetch_steps"):
        return []

    data = response.json()
    points = data.get("dataPoint", data.get("point", data.get("measurements", [])))
    logger.info(f"fetch_steps: {len(points)} points returned.")
    return _normalize_response(points, "STEPS")


# ─── POST-based dailyRollUp calls (daily aggregates) ─────────────────────────
#
# IMPORTANT: dailyRollUp is a POST endpoint, not GET. The date range is passed
# in the JSON body as civil time strings ("YYYY-MM-DD"), NOT epoch milliseconds.
# Never call this endpoint with a GET request — it will return 405 Method Not Allowed.

def _post_daily_rollup(
    credentials: Credentials,
    data_type_id: str,
    date_range: dict[str, str],
    context: str,
) -> list[dict[str, Any]]:
    """
    Shared POST call for all dailyRollUp endpoints.

    Args:
        credentials:   Valid Google OAuth2 credentials.
        data_type_id:  The Google Health API data type ID string.
        date_range:    {"start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD"}
        context:       Caller name for error logging.

    Returns:
        Raw list of point dicts from the API response.
    """
    body = {
        "dataTypeId": data_type_id,
        "startDate": date_range["start_date"],   # Civil time format: YYYY-MM-DD
        "endDate": date_range["end_date"],         # Civil time format: YYYY-MM-DD
    }
    response = requests.post(
        HEALTH_METRICS_ROLLUP_URL,
        headers=_get_auth_headers(credentials),
        json=body,
        timeout=30,
    )
    if not _handle_response_errors(response, context):
        return []

    data = response.json()
    return data.get("dataPoint", data.get("point", data.get("rollUp", [])))


def fetch_daily_hrv(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """
    Fetch daily HRV aggregate via POST /healthMetricsAndMeasurements:dailyRollUp.

    Args:
        credentials: Valid Google OAuth2 credentials.
        date_range:  {"start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD"}

    Returns:
        list[dict]: [{"timestamp": "YYYY-MM-DD", "value": float (RMSSD ms),
                      "data_type": "DAILY_HEART_RATE_VARIABILITY"}]
    """
    points = _post_daily_rollup(
        credentials, "DAILY_HEART_RATE_VARIABILITY", date_range, "fetch_daily_hrv"
    )
    logger.info(f"fetch_daily_hrv: {len(points)} records returned.")
    return _normalize_response(points, "DAILY_HEART_RATE_VARIABILITY")


def fetch_daily_spo2(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """
    Fetch daily SpO2 aggregate via POST /healthMetricsAndMeasurements:dailyRollUp.

    Args:
        credentials: Valid Google OAuth2 credentials.
        date_range:  {"start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD"}

    Returns:
        list[dict]: [{"timestamp": "YYYY-MM-DD", "value": float (%),
                      "data_type": "DAILY_OXYGEN_SATURATION"}]
    """
    points = _post_daily_rollup(
        credentials, "DAILY_OXYGEN_SATURATION", date_range, "fetch_daily_spo2"
    )
    logger.info(f"fetch_daily_spo2: {len(points)} records returned.")
    return _normalize_response(points, "DAILY_OXYGEN_SATURATION")


def fetch_daily_resting_hr(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """
    Fetch daily resting heart rate via POST /healthMetricsAndMeasurements:dailyRollUp.

    Args:
        credentials: Valid Google OAuth2 credentials.
        date_range:  {"start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD"}

    Returns:
        list[dict]: [{"timestamp": "YYYY-MM-DD", "value": float (bpm),
                      "data_type": "DAILY_RESTING_HEART_RATE"}]
    """
    points = _post_daily_rollup(
        credentials, "DAILY_RESTING_HEART_RATE", date_range, "fetch_daily_resting_hr"
    )
    logger.info(f"fetch_daily_resting_hr: {len(points)} records returned.")
    return _normalize_response(points, "DAILY_RESTING_HEART_RATE")


def fetch_sleep_temp(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """
    Fetch daily sleep temperature deviations via POST dailyRollUp.

    NOTE: DAILY_SLEEP_TEMPERATURE_DERIVATIONS is not confirmed as supported
    in the public v4 API documentation. If the endpoint returns 404 or an
    empty response, a WARNING is logged and an empty list is returned.
    The SKIN_TEMP_AVAILABLE flag in .env controls whether this is attempted.

    Args:
        credentials: Valid Google OAuth2 credentials.
        date_range:  {"start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD"}

    Returns:
        list[dict]: [{"timestamp": "YYYY-MM-DD", "value": float (°C deviation),
                      "data_type": "DAILY_SLEEP_TEMPERATURE_DERIVATIONS"}]
        Returns [] if the data type is unavailable or SKIN_TEMP_AVAILABLE=false.
    """
    if not SKIN_TEMP_AVAILABLE:
        logger.info("fetch_sleep_temp: SKIN_TEMP_AVAILABLE=false — skipping.")
        return []

    try:
        body = {
            "dataTypeId": "DAILY_SLEEP_TEMPERATURE_DERIVATIONS",
            "startDate": date_range["start_date"],
            "endDate": date_range["end_date"],
        }
        response = requests.post(
            HEALTH_METRICS_ROLLUP_URL,
            headers=_get_auth_headers(credentials),
            json=body,
            timeout=30,
        )

        if response.status_code == 404:
            logger.warning(
                "fetch_sleep_temp: 404 — DAILY_SLEEP_TEMPERATURE_DERIVATIONS is not "
                "available for this account. Returning empty list."
            )
            return []

        if not response.ok:
            logger.warning(
                f"fetch_sleep_temp: HTTP {response.status_code} — skin temperature "
                "data unavailable. Returning empty list."
            )
            return []

        data = response.json()
        points = data.get("dataPoint", data.get("point", data.get("rollUp", [])))

        if not points:
            logger.warning(
                "fetch_sleep_temp: API returned an empty response for "
                "DAILY_SLEEP_TEMPERATURE_DERIVATIONS. Skin temperature may not be "
                "tracked on this device."
            )
            return []

        logger.info(f"fetch_sleep_temp: {len(points)} records returned.")
        return _normalize_response(points, "DAILY_SLEEP_TEMPERATURE_DERIVATIONS")

    except Exception as e:
        logger.warning(
            f"fetch_sleep_temp: Unexpected error ({e}). Returning empty list."
        )
        return []


def fetch_sleep(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """
    Fetch sleep sessions and stages via POST /sleep:query.

    Uses the sleep-specific endpoint, separate from the healthMetricsAndMeasurements
    resource.

    Args:
        credentials: Valid Google OAuth2 credentials.
        date_range:  {"start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD"}

    Returns:
        list[dict]: [
            {
                "timestamp": "YYYY-MM-DD",        # date of the sleep session
                "value": {
                    "total_sleep_minutes": float,
                    "stages": {
                        "light": float,
                        "deep": float,
                        "rem": float,
                        "awake": float,
                    }
                },
                "data_type": "SLEEP"
            }
        ]
    """
    body = {
        "startDate": date_range["start_date"],
        "endDate": date_range["end_date"],
    }
    response = requests.post(
        SLEEP_URL,
        headers=_get_auth_headers(credentials),
        json=body,
        timeout=30,
    )
    if not _handle_response_errors(response, "fetch_sleep"):
        return []

    data = response.json()
    sessions = data.get("session", data.get("sessions", data.get("sleepSessions", [])))

    normalized = []
    for session in sessions:
        # Extract date from session start time
        start_raw = session.get("startTime") or session.get("startDate")
        if isinstance(start_raw, str) and "T" in start_raw:
            date_str = start_raw[:10]
        elif isinstance(start_raw, int):
            date_str = datetime.fromtimestamp(
                start_raw / 1000, tz=timezone.utc
            ).strftime("%Y-%m-%d")
        else:
            date_str = str(start_raw)[:10]

        # Extract total duration and stage breakdown
        total_minutes = session.get("totalSleepMinutes") or session.get("durationMinutes")
        stages_raw = session.get("stages", session.get("stageSummary", {}))

        if total_minutes is None:
            # Derive from start/end timestamps if not provided directly
            end_raw = session.get("endTime") or session.get("endDate")
            if start_raw and end_raw:
                try:
                    start_ms = int(start_raw) if isinstance(start_raw, int) else (
                        int(datetime.fromisoformat(str(start_raw)).timestamp() * 1000)
                    )
                    end_ms = int(end_raw) if isinstance(end_raw, int) else (
                        int(datetime.fromisoformat(str(end_raw)).timestamp() * 1000)
                    )
                    total_minutes = (end_ms - start_ms) / 60000
                except (ValueError, TypeError):
                    total_minutes = 0.0
            else:
                total_minutes = 0.0

        normalized.append({
            "timestamp": date_str,
            "value": {
                "total_sleep_minutes": float(total_minutes or 0),
                "stages": {
                    "light": float(stages_raw.get("light", stages_raw.get("LIGHT", 0))),
                    "deep": float(stages_raw.get("deep", stages_raw.get("DEEP", 0))),
                    "rem": float(stages_raw.get("rem", stages_raw.get("REM", 0))),
                    "awake": float(stages_raw.get("awake", stages_raw.get("AWAKE", 0))),
                },
            },
            "data_type": "SLEEP",
        })

    logger.info(f"fetch_sleep: {len(normalized)} sleep sessions returned.")
    return normalized
