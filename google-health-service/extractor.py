"""
extractor.py — Google Health API v4 data extraction functions.

Queries correct endpoints under https://health.googleapis.com/v4/users/me/dataTypes/{dataType}/dataPoints
Processes results to fit standard dashboard schema:
  [{"timestamp": str (ISO 8601), "value": float | dict, "data_type": str}]
"""

import logging
import os
import re
from datetime import datetime, timezone, timedelta
from typing import Any

import requests
from dotenv import load_dotenv
from google.oauth2.credentials import Credentials

load_dotenv()

logger = logging.getLogger("extractor")

SKIN_TEMP_AVAILABLE: bool = os.getenv("SKIN_TEMP_AVAILABLE", "true").lower() == "true"

BASE_URL = "https://health.googleapis.com/v4"

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

def _validate_date(value: str, field: str) -> str:
    if not _DATE_RE.match(value):
        raise ValueError(f"Invalid {field}: {value!r} — expected YYYY-MM-DD")
    return value

def _get_auth_headers(credentials: Credentials) -> dict[str, str]:
    """Return Authorization header using the credentials Bearer token."""
    return {
        "Authorization": f"Bearer {credentials.token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

def _parse_date(date_obj: dict[str, Any]) -> str:
    """Format Google API date object {"year": YYYY, "month": MM, "day": DD} as YYYY-MM-DD."""
    try:
        year = date_obj.get("year", 0)
        month = date_obj.get("month", 0)
        day = date_obj.get("day", 0)
        return f"{year:04d}-{month:02d}-{day:02d}"
    except Exception:
        return "1970-01-01"

def _handle_response_errors(response: requests.Response, context: str) -> bool:
    """Log errors from an API response."""
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

# ─── Data Extraction Functions ──────────────────────────────────────────

def fetch_heart_rate(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch intraday heart rate data via GET users/me/dataTypes/heart-rate/dataPoints."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    start_time = f"{date_range['start_date']}T00:00:00Z"
    end_date_dt = datetime.strptime(date_range['end_date'], "%Y-%m-%d")
    next_day_dt = end_date_dt + timedelta(days=1)
    end_time = f"{next_day_dt.strftime('%Y-%m-%d')}T00:00:00Z"
    filter_expr = f"heart_rate.sample_time.physical_time >= \"{start_time}\" AND heart_rate.sample_time.physical_time < \"{end_time}\""
    
    url = f"{BASE_URL}/users/me/dataTypes/heart-rate/dataPoints"
    response = requests.get(
        url,
        headers=_get_auth_headers(credentials),
        params={"filter": filter_expr, "pageSize": 10000},
        timeout=30,
    )
    if not _handle_response_errors(response, "fetch_heart_rate"):
        return []

    data = response.json()
    points = data.get("dataPoints", [])
    
    normalized = []
    for pt in points:
        hr_data = pt.get("heartRate", {})
        ts = hr_data.get("sampleTime", {}).get("physicalTime")
        val = hr_data.get("beatsPerMinute")
        if ts and val is not None:
            normalized.append({
                "timestamp": ts,
                "value": float(val),
                "data_type": "HEART_RATE"
            })
            
    logger.info(f"fetch_heart_rate: {len(normalized)} points returned.")
    return normalized

def fetch_intraday_hrv(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch intraday HRV data via GET users/me/dataTypes/heart-rate-variability/dataPoints."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    start_time = f"{date_range['start_date']}T00:00:00Z"
    end_date_dt = datetime.strptime(date_range['end_date'], "%Y-%m-%d")
    next_day_dt = end_date_dt + timedelta(days=1)
    end_time = f"{next_day_dt.strftime('%Y-%m-%d')}T00:00:00Z"
    filter_expr = f"heart_rate_variability.sample_time.physical_time >= \"{start_time}\" AND heart_rate_variability.sample_time.physical_time < \"{end_time}\""
    
    url = f"{BASE_URL}/users/me/dataTypes/heart-rate-variability/dataPoints"
    response = requests.get(
        url,
        headers=_get_auth_headers(credentials),
        params={"filter": filter_expr, "pageSize": 10000},
        timeout=30,
    )
    if not _handle_response_errors(response, "fetch_intraday_hrv"):
        return []

    data = response.json()
    points = data.get("dataPoints", [])
    
    normalized = []
    for pt in points:
        hrv_data = pt.get("heartRateVariability", {})
        ts = hrv_data.get("sampleTime", {}).get("physicalTime")
        val = hrv_data.get("rootMeanSquareOfSuccessiveDifferencesMilliseconds")
        if ts and val is not None:
            normalized.append({
                "timestamp": ts,
                "value": float(val),
                "data_type": "HEART_RATE_VARIABILITY"
            })
            
    logger.info(f"fetch_intraday_hrv: {len(normalized)} points returned.")
    return normalized

def fetch_hrv(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """
    Fetch heart rate variability (RMSSD) data.
    Attempts to fetch intraday HRV data, falling back to daily aggregates if unavailable.
    """
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    intraday = fetch_intraday_hrv(credentials, date_range)
    if intraday:
        return intraday
        
    logger.warning("Intraday HRV is unavailable. Falling back to daily aggregates.")
    return fetch_daily_hrv(credentials, date_range)

def fetch_spo2(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch oxygen saturation data via GET users/me/dataTypes/oxygen-saturation/dataPoints."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    start_time = f"{date_range['start_date']}T00:00:00Z"
    end_date_dt = datetime.strptime(date_range['end_date'], "%Y-%m-%d")
    next_day_dt = end_date_dt + timedelta(days=1)
    end_time = f"{next_day_dt.strftime('%Y-%m-%d')}T00:00:00Z"
    filter_expr = f"oxygen_saturation.sample_time.sleep_time >= \"{start_time}\" AND oxygen_saturation.sample_time.sleep_time < \"{end_time}\""
    
    url = f"{BASE_URL}/users/me/dataTypes/oxygen-saturation/dataPoints"
    response = requests.get(
        url,
        headers=_get_auth_headers(credentials),
        params={"filter": filter_expr, "pageSize": 10000},
        timeout=30,
    )
    if not _handle_response_errors(response, "fetch_spo2"):
        return []

    data = response.json()
    points = data.get("dataPoints", [])
    
    normalized = []
    for pt in points:
        spo2_data = pt.get("oxygenSaturation", {})
        sample_time = spo2_data.get("sampleTime", {})
        ts = sample_time.get("sleepTime") or sample_time.get("physicalTime")
        val = spo2_data.get("percentage")
        if ts and val is not None:
            normalized.append({
                "timestamp": ts,
                "value": float(val),
                "data_type": "OXYGEN_SATURATION"
            })
            
    if not normalized:
        logger.warning("Intraday SpO2 endpoint returned no data (possibly unsupported by device tier).")
        return []

    logger.info(f"fetch_spo2: {len(normalized)} points returned.")
    return normalized

def fetch_steps(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch step count data via GET users/me/dataTypes/steps/dataPoints."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    start_time = f"{date_range['start_date']}T00:00:00Z"
    end_date_dt = datetime.strptime(date_range['end_date'], "%Y-%m-%d")
    next_day_dt = end_date_dt + timedelta(days=1)
    end_time = f"{next_day_dt.strftime('%Y-%m-%d')}T00:00:00Z"
    filter_expr = f"steps.interval.start_time >= \"{start_time}\" AND steps.interval.start_time < \"{end_time}\""
    
    url = f"{BASE_URL}/users/me/dataTypes/steps/dataPoints"
    response = requests.get(
        url,
        headers=_get_auth_headers(credentials),
        params={"filter": filter_expr, "pageSize": 10000},
        timeout=30,
    )
    if not _handle_response_errors(response, "fetch_steps"):
        return []

    data = response.json()
    points = data.get("dataPoints", [])
    
    normalized = []
    for pt in points:
        steps_data = pt.get("steps", {})
        ts = steps_data.get("interval", {}).get("startTime")
        val = steps_data.get("count")
        if ts and val is not None:
            normalized.append({
                "timestamp": ts,
                "value": float(val),
                "data_type": "STEPS"
            })
            
    logger.info(f"fetch_steps: {len(normalized)} points returned.")
    return normalized

def fetch_daily_hrv(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch daily HRV aggregate via GET users/me/dataTypes/daily-heart-rate-variability/dataPoints."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    url = f"{BASE_URL}/users/me/dataTypes/daily-heart-rate-variability/dataPoints"
    response = requests.get(
        url,
        headers=_get_auth_headers(credentials),
        params={"pageSize": 100},
        timeout=30,
    )
    if not _handle_response_errors(response, "fetch_daily_hrv"):
        return []

    data = response.json()
    points = data.get("dataPoints", [])
    
    normalized = []
    for pt in points:
        hrv_data = pt.get("dailyHeartRateVariability", {})
        date_str = _parse_date(hrv_data.get("date", {}))
        
        # Client-side date range filter
        if date_range["start_date"] <= date_str <= date_range["end_date"]:
            val = hrv_data.get("averageHeartRateVariabilityMilliseconds")
            if val is not None:
                normalized.append({
                    "timestamp": date_str,
                    "value": float(val),
                    "data_type": "DAILY_HEART_RATE_VARIABILITY"
                })
                
    normalized.sort(key=lambda x: x["timestamp"])
    logger.info(f"fetch_daily_hrv: {len(normalized)} records returned.")
    return normalized

def fetch_daily_spo2(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch daily SpO2 aggregate via GET users/me/dataTypes/daily-oxygen-saturation/dataPoints."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    url = f"{BASE_URL}/users/me/dataTypes/daily-oxygen-saturation/dataPoints"
    response = requests.get(
        url,
        headers=_get_auth_headers(credentials),
        params={"pageSize": 100},
        timeout=30,
    )
    if not _handle_response_errors(response, "fetch_daily_spo2"):
        return []

    data = response.json()
    points = data.get("dataPoints", [])
    
    normalized = []
    for pt in points:
        spo2_data = pt.get("dailyOxygenSaturation", {})
        date_str = _parse_date(spo2_data.get("date", {}))
        
        if date_range["start_date"] <= date_str <= date_range["end_date"]:
            val = spo2_data.get("averagePercentage")
            if val is not None:
                normalized.append({
                    "timestamp": date_str,
                    "value": float(val),
                    "data_type": "DAILY_OXYGEN_SATURATION"
                })
                
    normalized.sort(key=lambda x: x["timestamp"])
    logger.info(f"fetch_daily_spo2: {len(normalized)} records returned.")
    return normalized

def fetch_daily_resting_hr(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch daily resting heart rate via GET users/me/dataTypes/daily-resting-heart-rate/dataPoints."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    url = f"{BASE_URL}/users/me/dataTypes/daily-resting-heart-rate/dataPoints"
    response = requests.get(
        url,
        headers=_get_auth_headers(credentials),
        params={"pageSize": 100},
        timeout=30,
    )
    if not _handle_response_errors(response, "fetch_daily_resting_hr"):
        return []

    data = response.json()
    points = data.get("dataPoints", [])
    
    normalized = []
    for pt in points:
        rhr_data = pt.get("dailyRestingHeartRate", {})
        date_str = _parse_date(rhr_data.get("date", {}))
        
        if date_range["start_date"] <= date_str <= date_range["end_date"]:
            val = rhr_data.get("beatsPerMinute")
            if val is not None:
                normalized.append({
                    "timestamp": date_str,
                    "value": float(val),
                    "data_type": "DAILY_RESTING_HEART_RATE"
                })
                
    normalized.sort(key=lambda x: x["timestamp"])
    logger.info(f"fetch_daily_resting_hr: {len(normalized)} records returned.")
    return normalized

def fetch_sleep_temp(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch daily sleep temperature deviations via GET users/me/dataTypes/daily-sleep-temperature-derivations/dataPoints."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    if not SKIN_TEMP_AVAILABLE:
        logger.info("fetch_sleep_temp: SKIN_TEMP_AVAILABLE=false — skipping.")
        return []

    url = f"{BASE_URL}/users/me/dataTypes/daily-sleep-temperature-derivations/dataPoints"
    response = requests.get(
        url,
        headers=_get_auth_headers(credentials),
        params={"pageSize": 100},
        timeout=30,
    )
    if response.status_code == 404:
        logger.warning("fetch_sleep_temp: 404 — daily-sleep-temperature-derivations not available.")
        return []
        
    if not _handle_response_errors(response, "fetch_sleep_temp"):
        return []

    data = response.json()
    points = data.get("dataPoints", [])
    
    normalized = []
    for pt in points:
        temp_data = pt.get("dailySleepTemperatureDerivations", {})
        date_str = _parse_date(temp_data.get("date", {}))
        
        if date_range["start_date"] <= date_str <= date_range["end_date"]:
            # Default to nightlyTemperatureCelsius deviation or raw
            val = temp_data.get("nightlyTemperatureCelsius")
            if val is not None:
                # Calculate deviation relative to a baseline if raw is returned, or use directly
                # If baseline is NaN, we return the value directly
                normalized.append({
                    "timestamp": date_str,
                    "value": float(val),
                    "data_type": "DAILY_SLEEP_TEMPERATURE_DERIVATIONS"
                })
                
    normalized.sort(key=lambda x: x["timestamp"])
    logger.info(f"fetch_sleep_temp: {len(normalized)} records returned.")
    return normalized

def fetch_sleep(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch sleep sessions and stages via GET users/me/dataTypes/sleep/dataPoints."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    url = f"{BASE_URL}/users/me/dataTypes/sleep/dataPoints"
    response = requests.get(
        url,
        headers=_get_auth_headers(credentials),
        params={"pageSize": 50},
        timeout=30,
    )
    if not _handle_response_errors(response, "fetch_sleep"):
        return []

    data = response.json()
    points = data.get("dataPoints", [])

    normalized = []
    for pt in points:
        sleep_data = pt.get("sleep", {})
        interval = sleep_data.get("interval", {})
        start_time_str = interval.get("startTime", "")
        
        if not start_time_str:
            continue
            
        date_str = start_time_str[:10]  # Get YYYY-MM-DD
        
        if date_range["start_date"] <= date_str <= date_range["end_date"]:
            summary = sleep_data.get("summary", {})
            minutes_asleep = float(summary.get("minutesAsleep") or 0)
            
            # Map stages list to stages dict
            stages_list = sleep_data.get("stages", [])
            stages_summary = summary.get("stagesSummary", [])
            
            stage_durations = {
                "light": 0.0,
                "deep": 0.0,
                "rem": 0.0,
                "awake": 0.0
            }
            
            for stage_item in stages_summary:
                stype = stage_item.get("type", "").lower()
                mval = float(stage_item.get("minutes") or 0)
                if stype in stage_durations:
                    stage_durations[stype] = mval
            
            normalized.append({
                "timestamp": date_str,
                "value": {
                    "total_sleep_minutes": minutes_asleep,
                    "stages": stage_durations,
                },
                "data_type": "SLEEP"
            })

    normalized.sort(key=lambda x: x["timestamp"])
    logger.info(f"fetch_sleep: {len(normalized)} sleep sessions returned.")
    return normalized
