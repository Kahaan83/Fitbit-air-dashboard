import os
os.environ["GCP_PROJECT_ID"] = "mock-project"
os.environ["ALLOWED_ORIGIN"] = "http://localhost:3000"

import pytest
from unittest.mock import AsyncMock, patch
import numpy as np

# ─── HRV Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def empty_hrv():
    return []

@pytest.fixture
def single_day_hrv():
    # Returns 10 points but all on the same day
    return [
        {"timestamp": f"2026-06-19T0{i}:00:00Z", "value": 50.0 + i}
        for i in range(10)
    ]

@pytest.fixture
def multiday_hrv():
    # Returns 5+ days with 5+ samples each (necessary for calculate_ans_balance)
    hrv_series = []
    for day in range(1, 7):
        for hour in range(10, 16):
            hrv_series.append({
                "timestamp": f"2026-06-{10+day:02d}T{hour:02d}:00:00Z",
                "value": 55.0 + (day * hour) % 10
            })
    return hrv_series

@pytest.fixture
def hrv_with_nan(multiday_hrv):
    # Inserts NaNs inside the series to check mathematical error resilience
    for idx in range(0, len(multiday_hrv), 4):
        multiday_hrv[idx]["value"] = float("nan")
    return multiday_hrv

# ─── Heart Rate and Zones Fixtures ──────────────────────────────────────────

@pytest.fixture
def empty_hr():
    return []

@pytest.fixture
def hr_no_zone_4_5():
    # HR values with zone 1-3 only
    return [
        {"timestamp": f"2026-06-19T10:{i:02d}:00Z", "bpm": 70 + i % 5, "zone": "Zone 1"}
        for i in range(12)
    ]

@pytest.fixture
def hr_with_zone_4_5():
    # HR values containing Zone 4/5 entries
    return [
        {"timestamp": "2026-06-19T10:00:00Z", "bpm": 60, "zone": "Zone 1"},
        {"timestamp": "2026-06-19T10:05:00Z", "bpm": 120, "zone": "Zone 4"},
        {"timestamp": "2026-06-19T10:10:00Z", "bpm": 150, "zone": "Zone 5"},
        {"timestamp": "2026-06-19T10:15:00Z", "bpm": 65, "zone": "Zone 1"},
    ]

@pytest.fixture
def daily_resting_hr():
    return [
        {"timestamp": "2026-06-19T00:00:00Z", "value": 60.0},
        {"timestamp": "2026-06-20T00:00:00Z", "value": 58.0},
    ]

# ─── Steps Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def empty_steps():
    return []

@pytest.fixture
def steps_zero_movement():
    return [
        {"timestamp": f"2026-06-19T10:{i:02d}:00Z", "value": 0}
        for i in range(0, 60, 5)
    ]

@pytest.fixture
def steps_active():
    return [
        {"timestamp": f"2026-06-19T10:{i:02d}:00Z", "value": 150}
        for i in range(0, 60, 5)
    ]

# ─── Sleep Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def empty_sleep():
    return []

@pytest.fixture
def sleep_at_target():
    # All nights are exactly at 8 hours (480 minutes)
    return [
        {"timestamp": f"2026-06-{10+i:02d}T00:00:00Z", "value": {"total_sleep_minutes": 480}}
        for i in range(5)
    ]

@pytest.fixture
def sleep_mixed():
    # Mix of short and long nights
    return [
        {"timestamp": "2026-06-19T00:00:00Z", "value": {"total_sleep_minutes": 360}},  # 6h (debt +2h)
        {"timestamp": "2026-06-20T00:00:00Z", "value": {"total_sleep_minutes": 540}},  # 9h (debt -1h)
        {"timestamp": "2026-06-21T00:00:00Z", "value": {"total_sleep_minutes": 420}},  # 7h (debt +1h)
    ]


@pytest.fixture
def mock_client():
    from unittest.mock import MagicMock
    with patch("main.HealthAPIClient") as MockClient:
        instance = MockClient.return_value
        instance.get_heart_rate = AsyncMock(return_value=[{"timestamp": "2026-01-15T08:00:00Z", "value": 72}])
        instance.get_intraday_hrv = AsyncMock(return_value=[{"timestamp": "2026-01-15T02:00:00Z", "value": 45.2}])
        instance.get_hrv = AsyncMock(return_value=[{"timestamp": "2026-01-15T02:00:00Z", "value": 45.2}])
        instance.get_spo2 = AsyncMock(return_value=[])
        instance.get_sleep = AsyncMock(return_value=[])
        instance.get_steps = AsyncMock(return_value=[])
        instance.get_daily_hrv = AsyncMock(return_value=[])
        instance.get_daily_spo2 = AsyncMock(return_value=[])
        instance.get_daily_resting_hr = AsyncMock(return_value=[])
        instance.get_sleep_temp = AsyncMock(return_value=[])
        instance.close = AsyncMock(return_value=None)
        yield instance


@pytest.fixture
def test_client():
    from fastapi.testclient import TestClient
    from main import app
    return TestClient(app)

