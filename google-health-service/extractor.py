"""
extractor.py — Google Health API v4 data extraction functions.

Queries correct endpoints under https://health.googleapis.com/v4/users/me/dataTypes/{dataType}/dataPoints
Processes results to fit standard dashboard schema:
  [{"timestamp": str (ISO 8601), "value": float | dict, "data_type": str}]
"""

import logging
import asyncio
import os
import re
from typing import Any
from collections import defaultdict
from datetime import date

from google.oauth2.credentials import Credentials
from client import HealthAPIClient

logger = logging.getLogger("extractor")

SKIN_TEMP_AVAILABLE: bool = os.getenv("SKIN_TEMP_AVAILABLE", "true").lower() == "true"

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

def _validate_date(value: str, field: str) -> str:
    if not _DATE_RE.match(value):
        raise ValueError(f"Invalid {field}: {value!r} — expected YYYY-MM-DD")
    return value


async def fetch_intraday_hrv(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch intraday HRV data via HealthAPIClient."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    client = HealthAPIClient(credentials.token)
    return await client.get_intraday_hrv(date_range["start_date"], date_range["end_date"])

async def fetch_hrv(
    credentials: Credentials,
    date_range: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetch heart rate variability (RMSSD) data via HealthAPIClient."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    client = HealthAPIClient(credentials.token)
    return await client.get_hrv(date_range["start_date"], date_range["end_date"])


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



def downsample_to_minutes(points: list[dict], value_key: str = "value") -> list[dict]:
    """Average raw readings into 1-minute buckets."""
    buckets = defaultdict(list)
    for p in points:
        ts = p.get("timestamp") or p.get("startTime", "")
        # Truncate to minute: "2026-06-01T08:32:47Z" -> "2026-06-01T08:32"
        minute_key = ts[:16]
        val = p.get(value_key)
        if val is None:
            val = p.get("value")
        if val is None:
            val = p.get("bpm")
        buckets[minute_key].append(val if val is not None else 0)
    
    result = []
    for k, v in sorted(buckets.items()):
        if not v:
            continue
        avg_val = round(sum(v)/len(v), 1)
        item = {"timestamp": f"{k}:00Z", value_key: avg_val}
        if value_key == "bpm":
            item["value"] = avg_val
        elif value_key == "value":
            item["bpm"] = avg_val
        result.append(item)
    return result


async def fetch_all(
    client: HealthAPIClient,
    date_range: dict[str, str],
) -> tuple:
    """Fetch all physiological data streams in parallel using asyncio.gather."""
    _validate_date(date_range.get("start_date", ""), "start_date")
    _validate_date(date_range.get("end_date", ""), "end_date")
    
    start_date = date_range["start_date"]
    end_date = date_range["end_date"]
    
    # Calculate days for resolution cap
    days = (date.fromisoformat(end_date) - date.fromisoformat(start_date)).days

    # Handle heart rate date range limit
    try:
        from datetime import datetime, timedelta
        limit_days = int(os.getenv("HEART_RATE_DAYS_LIMIT", "7"))
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        if (end_dt - start_dt).days > limit_days:
            start_date_hr = (end_dt - timedelta(days=limit_days)).strftime("%Y-%m-%d")
            logger.info(f"Limiting heart rate range from {start_date} to {start_date_hr} (limit: {limit_days} days) to prevent timeouts.")
        else:
            start_date_hr = start_date
    except Exception as e:
        logger.warning(f"Failed to apply heart rate date range limit: {e}")
        start_date_hr = start_date

    # Handle SpO2 date range limit
    try:
        from datetime import datetime, timedelta
        limit_days = int(os.getenv("SPO2_DAYS_LIMIT", "7"))
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        if (end_dt - start_dt).days > limit_days:
            start_date_spo2 = (end_dt - timedelta(days=limit_days)).strftime("%Y-%m-%d")
            logger.info(f"Limiting SpO2 range from {start_date} to {start_date_spo2} (limit: {limit_days} days) to prevent timeouts.")
        else:
            start_date_spo2 = start_date
    except Exception as e:
        logger.warning(f"Failed to apply SpO2 date range limit: {e}")
        start_date_spo2 = start_date

    heart_rate_coro = client.get_heart_rate(start_date_hr, end_date)
    spo2_coro = client.get_spo2(start_date_spo2, end_date)


    results = await asyncio.gather(
        heart_rate_coro,
        spo2_coro,
        client.get_steps(start_date, end_date),
        client.get_daily_hrv(start_date, end_date),
        client.get_daily_spo2(start_date, end_date),
        client.get_daily_resting_hr(start_date, end_date),
        client.get_sleep_temp(start_date, end_date),
        client.get_sleep(start_date, end_date),
        return_exceptions=True
    )

    # Unwrap and downsample Part 1
    heart_rate = results[0] if not isinstance(results[0], Exception) else []
    spo2 = results[1] if not isinstance(results[1], Exception) else []
    
    if isinstance(heart_rate, list) and heart_rate:
        heart_rate = downsample_to_minutes(heart_rate, "bpm")
    if isinstance(spo2, list) and spo2:
        spo2 = downsample_to_minutes(spo2, "value")

    # Reconstruct the results tuple
    res_list = list(results)
    res_list[0] = heart_rate
    res_list[1] = spo2
    return tuple(res_list)
