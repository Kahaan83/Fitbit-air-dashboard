"""
extractor.py — Google Health API v4 data extraction functions.

Queries correct endpoints under https://health.googleapis.com/v4/users/me/dataTypes/{dataType}/dataPoints
Processes results to fit standard dashboard schema:
  [{"timestamp": str (ISO 8601), "value": float | dict, "data_type": str}]
"""

import logging
import os
import re
from typing import Any

from google.oauth2.credentials import Credentials
from client import HealthAPIClient

logger = logging.getLogger("extractor")

SKIN_TEMP_AVAILABLE: bool = os.getenv("SKIN_TEMP_AVAILABLE", "true").lower() == "true"

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

def _validate_date(value: str, field: str) -> str:
    if not _DATE_RE.match(value):
        raise ValueError(f"Invalid {field}: {value!r} — expected YYYY-MM-DD")
    return value

def fetch_heart_rate(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch intraday heart rate data via HealthAPIClient."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    
    start_date = date_range["start_date"]
    end_date = date_range["end_date"]
    
    try:
        from datetime import datetime, timedelta
        limit_days = int(os.getenv("HEART_RATE_DAYS_LIMIT", "7"))
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        if (end_dt - start_dt).days > limit_days:
            start_date = (end_dt - timedelta(days=limit_days)).strftime("%Y-%m-%d")
            logger.info(f"Limiting heart rate range from {date_range['start_date']} to {start_date} (limit: {limit_days} days) to prevent timeouts.")
    except Exception as e:
        logger.warning(f"Failed to apply heart rate date range limit: {e}")

    client = HealthAPIClient(credentials.token)
    return client.get_heart_rate(start_date, end_date)

def fetch_intraday_hrv(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch intraday HRV data via HealthAPIClient."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    client = HealthAPIClient(credentials.token)
    return client.get_intraday_hrv(date_range["start_date"], date_range["end_date"])

async def fetch_hrv(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch heart rate variability (RMSSD) data via HealthAPIClient."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    client = HealthAPIClient(credentials.token)
    return await client.get_hrv(date_range["start_date"], date_range["end_date"])

def fetch_spo2(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch oxygen saturation data via HealthAPIClient."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    client = HealthAPIClient(credentials.token)
    return client.get_spo2(date_range["start_date"], date_range["end_date"])

def fetch_steps(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch step count data via HealthAPIClient."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    client = HealthAPIClient(credentials.token)
    return client.get_steps(date_range["start_date"], date_range["end_date"])

async def fetch_daily_hrv(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch daily HRV aggregate via HealthAPIClient."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    client = HealthAPIClient(credentials.token)
    return await client.get_daily_hrv(date_range["start_date"], date_range["end_date"])

async def fetch_daily_spo2(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch daily SpO2 aggregate via HealthAPIClient."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    client = HealthAPIClient(credentials.token)
    return await client.get_daily_spo2(date_range["start_date"], date_range["end_date"])

async def fetch_daily_resting_hr(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch daily resting heart rate via HealthAPIClient."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    client = HealthAPIClient(credentials.token)
    return await client.get_daily_resting_hr(date_range["start_date"], date_range["end_date"])

async def fetch_sleep_temp(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch daily sleep temperature deviations via HealthAPIClient."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    if not SKIN_TEMP_AVAILABLE:
        logger.info("fetch_sleep_temp: SKIN_TEMP_AVAILABLE=false — skipping.")
        return []
    client = HealthAPIClient(credentials.token)
    return await client.get_sleep_temp(date_range["start_date"], date_range["end_date"])

def fetch_sleep(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch sleep sessions and stages via HealthAPIClient."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    client = HealthAPIClient(credentials.token)
    return client.get_sleep(date_range["start_date"], date_range["end_date"])
