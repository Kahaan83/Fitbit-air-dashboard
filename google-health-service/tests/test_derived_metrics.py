import pytest
import numpy as np
from derived_metrics import (
    calculate_ans_balance,
    calculate_vo2_max,
    identify_acute_stress,
    calculate_sleep_debt,
)

# ─── Tests for calculate_ans_balance ─────────────────────────────────────────

def test_ans_balance_empty(empty_hrv):
    assert calculate_ans_balance(empty_hrv) == []
    assert calculate_ans_balance(None) == []

def test_ans_balance_single_day(single_day_hrv):
    assert calculate_ans_balance(single_day_hrv) == []

def test_ans_balance_valid(multiday_hrv):
    results = calculate_ans_balance(multiday_hrv)
    assert isinstance(results, list)
    assert len(results) > 0
    for record in results:
        assert "date" in record
        assert "lf" in record
        assert "hf" in record
        assert "ratio" in record
        assert "lf_power" in record
        assert "hf_power" in record
        assert "lf_hf_ratio" in record
        assert record["lf"] >= 0.0
        assert record["hf"] >= 0.0
        assert record["ratio"] >= 0.0

def test_ans_balance_with_nan(hrv_with_nan):
    # This shouldn't raise any exception, thanks to error handling in interpolator / periodogram
    results = calculate_ans_balance(hrv_with_nan)
    # It might return empty list or valid dates depending on NaN density, but should run cleanly
    assert isinstance(results, list)

# ─── Tests for calculate_vo2_max ─────────────────────────────────────────────

def test_vo2_max_no_data(empty_hr):
    assert calculate_vo2_max(empty_hr, 185) is None
    assert calculate_vo2_max(None, 185) is None

def test_vo2_max_no_zone_4_5(hr_no_zone_4_5):
    assert calculate_vo2_max(hr_no_zone_4_5, 185) is None

def test_vo2_max_valid(hr_with_zone_4_5):
    vo2 = calculate_vo2_max(hr_with_zone_4_5, 185)
    assert isinstance(vo2, float)
    assert 20.0 <= vo2 <= 80.0

# ─── Tests for identify_acute_stress ─────────────────────────────────────────

def test_acute_stress_empty(empty_hr, empty_steps):
    assert identify_acute_stress(empty_hr, empty_steps, 60.0) == []
    assert identify_acute_stress(None, None, 60.0) == []

def test_acute_stress_below_threshold(hr_no_zone_4_5, steps_active):
    # Heart rate values in hr_no_zone_4_5 are around 70 bpm, below resting_hr * 1.3 (60 * 1.3 = 78)
    # In addition, steps_active has movement, so no stress should be flagged
    assert identify_acute_stress(hr_no_zone_4_5, steps_active, 60.0) == []

def test_acute_stress_merge_consecutive():
    # Consecutive flagged stress windows (timestamp within 10 minutes of each other)
    hr_series = [
        {"timestamp": "2026-06-19T10:00:00Z", "value": 120.0},
        {"timestamp": "2026-06-19T10:05:00Z", "value": 130.0},
        # A gap of 20 minutes (not consecutive)
        {"timestamp": "2026-06-19T10:25:00Z", "value": 125.0},
    ]
    steps_series = [
        {"timestamp": "2026-06-19T10:00:00Z", "value": 0},
        {"timestamp": "2026-06-19T10:05:00Z", "value": 0},
        {"timestamp": "2026-06-19T10:25:00Z", "value": 0},
    ]
    
    events = identify_acute_stress(hr_series, steps_series, 60.0)
    
    # We expect 2 merged events:
    # Event 1: 10:00 to 10:05, peak HR of 130
    # Event 2: 10:25 to 10:25, peak HR of 125
    assert len(events) == 2
    
    # Event 1 check
    assert events[0]["start"] == "2026-06-19T10:00:00Z"
    assert events[0]["end"] == "2026-06-19T10:05:00Z"
    assert events[0]["hr_peak"] == 130.0
    
    # Event 2 check
    assert events[1]["start"] == "2026-06-19T10:25:00Z"
    assert events[1]["end"] == "2026-06-19T10:25:00Z"
    assert events[1]["hr_peak"] == 125.0

# ─── Tests for calculate_sleep_debt ──────────────────────────────────────────

def test_sleep_debt_empty(empty_sleep):
    assert calculate_sleep_debt(empty_sleep, 8.0) == 0

def test_sleep_debt_at_target(sleep_at_target):
    assert calculate_sleep_debt(sleep_at_target, 8.0) == 0

def test_sleep_debt_mixed(sleep_mixed):
    # Mix of short and long nights
    # target = 8h
    # night 1: 6h actual, debt = +2h
    # night 2: 9h actual, debt = -1h
    # night 3: 7h actual, debt = +1h
    # Cumulative deficit = +2h + (-1h) + (+1h) = +2h
    debt = calculate_sleep_debt(sleep_mixed, 8.0)
    assert debt == 2.0
