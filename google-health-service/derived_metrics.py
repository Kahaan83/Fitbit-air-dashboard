"""
derived_metrics.py — Computed physiological metric algorithms.

Implements ANS Autonomic Balance (LF/HF ratio), VO2 Max estimation,
Acute Stress detection, and Sleep Debt calculations.
"""

from datetime import datetime, timezone
import logging
import sys
from collections import defaultdict
import numpy as np
from scipy.interpolate import interp1d
from scipy.signal import periodogram
from scipy.integrate import trapezoid as trapz

logger = logging.getLogger("derived_metrics")


def calculate_ans_balance(hrv_data: list[dict]) -> list[dict]:
    """
    Returns a simplified ANS proxy from daily RMSSD values.
    Higher RMSSD = more parasympathetic dominance (recovery-favored).
    Lower RMSSD = more sympathetic dominance (stress/load).
    Not true LF/HF spectral analysis — requires raw RR intervals for that.
    """
    if not hrv_data:
        return []
        
    results = []
    for entry in hrv_data:
        if not entry:
            continue
        rmssd = entry.get("rmssd") or entry.get("value")
        if rmssd is None:
            continue
            
        # Extract date from timestamp or date field
        date_val = entry.get("date") or entry.get("timestamp")
        if date_val:
            date_str = date_val.split("T")[0]
        else:
            continue

        try:
            rmssd_float = float(rmssd)
        except (ValueError, TypeError):
            continue

        # Parasympathetic proxy: normalized RMSSD (typical range 20-80ms)
        parasympathetic = min(100, max(0, (rmssd_float - 20) / 60 * 100))
        sympathetic = 100 - parasympathetic
        results.append({
            "date": date_str,
            "parasympathetic": round(parasympathetic, 1),
            "sympathetic": round(sympathetic, 1),
            "rmssd": round(rmssd_float, 1),
        })
    # Group by date and keep only the latest/average if multiple exist for a day (or just sort)
    results.sort(key=lambda x: x["date"])
    return results


def calculate_vo2_max(heart_rate_data: list[dict], hr_max: float = 185.0) -> float | None:
    """
    Estimates VO2 Max using the Uth-Sørensen formula: 15.3 × (HRmax / HRrest).
    Returns a single float or None.
    """
    if not heart_rate_data:
        logger.debug("calculate_vo2_max: Empty HR series. Returning None.")
        return None

    # Check if the series has zone info (for raw HR series passed to test/impl)
    has_zones = any("zone" in r for r in heart_rate_data)
    if has_zones:
        # Check for zone 4 or 5 entries
        zone_4_5 = [
            r for r in heart_rate_data
            if str(r.get("zone", "")).strip().lower() in ["zone 4", "zone 5", "cardio", "peak", "4", "5"]
        ]
        if not zone_4_5:
            return None

    # Extract heart rate/resting heart rate values
    hr_vals = []
    for r in heart_rate_data:
        val = r.get("value") or r.get("bpm")
        if val is not None:
            try:
                hr_vals.append(float(val))
            except (ValueError, TypeError):
                continue

    if not hr_vals:
        return None

    # Calculate single float VO2 Max using minimum (resting) heart rate in the dataset
    rhr = min(hr_vals)
    if rhr <= 0:
        return None
    vo2 = 15.3 * (hr_max / rhr)
    return max(20.0, min(80.0, vo2))


def calculate_vo2_max_series(heart_rate_data: list[dict], hr_max: float = 185.0) -> list[dict]:
    """
    Estimates VO2 Max series using the Uth-Sørensen formula for trend charting.
    Returns a list of dicts: [{"date": "YYYY-MM-DD", "vo2_max": float}]
    """
    if not heart_rate_data:
        logger.debug("calculate_vo2_max_series: Empty HR series. Returning empty list.")
        return []

    results = []
    for record in heart_rate_data:
        ts = record.get("timestamp") or record.get("date")
        if not ts:
            continue
        date_str = ts.split("T")[0]
        rhr = record.get("value")
        if rhr is None:
            continue

        try:
            rhr_val = float(rhr)
            if rhr_val <= 0:
                continue
            vo2 = 15.3 * (hr_max / rhr_val)
            results.append({
                "date": date_str,
                "vo2_max": round(vo2, 2)
            })
        except (ValueError, TypeError) as e:
            logger.warning(f"calculate_vo2_max_series: Invalid resting HR value {rhr}: {e}")
            continue

    results.sort(key=lambda x: x["date"])
    return results


def identify_acute_stress(
    hr_series: list[dict],
    steps_series: list[dict],
    resting_hr: float,
) -> list[dict]:
    """
    Detects acute stress events by cross-referencing HR spikes with zero-movement windows.

    Args:
        hr_series: List of dicts from fetch_heart_rate() at 5-minute resolution.
        steps_series: List of dicts from fetch_steps() at 5-minute resolution.
        resting_hr: User's baseline resting heart rate (float, bpm).

    Returns:
        List of dicts: [{"start": ISO8601, "end": ISO8601, "hr_peak": float,
                         "severity": "low"|"medium"|"high"}]
        A window is flagged as stress when HR > resting_hr × 1.3 AND
        concurrent step count == 0 for the same 5-minute interval.
    """
    if not hr_series:
        logger.debug("identify_acute_stress: Empty HR series. Returning empty list.")
        return []

    # Safe fallback for None inputs
    steps_series = steps_series or []

    # Map step counts into 5-minute binned intervals: key = (date, hour, minute_bin)
    steps_bin = {}
    for step_rec in steps_series:
        ts_str = step_rec.get("timestamp", "")
        if not ts_str:
            continue
        try:
            ts_str = ts_str.replace("Z", "+00:00")
            dt = datetime.fromisoformat(ts_str)
            minute_bin = dt.minute // 5
            bin_key = (dt.date(), dt.hour, minute_bin)
            val = int(step_rec.get("value") or 0)
            steps_bin[bin_key] = steps_bin.get(bin_key, 0) + val
        except Exception as e:
            logger.warning(f"identify_acute_stress: Error binning step: {e}")
            continue

    # Bin heart rate readings
    hr_bins = defaultdict(list)
    for hr_rec in hr_series:
        ts_str = hr_rec.get("timestamp", "")
        if not ts_str:
            continue
        try:
            ts_str = ts_str.replace("Z", "+00:00")
            dt = datetime.fromisoformat(ts_str)
            minute_bin = dt.minute // 5
            bin_key = (dt.date(), dt.hour, minute_bin)
            val = float(hr_rec.get("value") or 0)
            hr_bins[bin_key].append((dt, val))
        except Exception as e:
            logger.warning(f"identify_acute_stress: Error binning HR: {e}")
            continue

    # Flag stress windows
    flagged_intervals = []
    threshold_hr = resting_hr * 1.3

    for bin_key, readings in hr_bins.items():
        steps_val = steps_bin.get(bin_key, 0)
        avg_hr = sum(r[1] for r in readings) / len(readings)

        # Flag if HR > threshold and steps == 0
        if avg_hr > threshold_hr and steps_val == 0:
            peak_dt, peak_val = max(readings, key=lambda x: x[1])
            flagged_intervals.append((peak_dt, peak_val))

    if not flagged_intervals:
        return []

    # Sort flagged windows chronologically
    flagged_intervals.sort(key=lambda x: x[0])

    # Merge consecutive flagged windows into events (windows within 10 minutes)
    stress_events = []
    current_event = None

    for dt, hr_val in flagged_intervals:
        if current_event is None:
            current_event = {
                "start": dt,
                "end": dt,
                "hr_peak": hr_val,
                "times": [dt],
            }
        else:
            diff = (dt - current_event["end"]).total_seconds()
            if diff <= 600.0:  # 10 minutes
                current_event["end"] = dt
                current_event["hr_peak"] = max(current_event["hr_peak"], hr_val)
                current_event["times"].append(dt)
            else:
                stress_events.append(current_event)
                current_event = {
                    "start": dt,
                    "end": dt,
                    "hr_peak": hr_val,
                    "times": [dt],
                }
    
    if current_event:
        stress_events.append(current_event)

    # Format events and assign severity
    formatted_events = []
    for e in stress_events:
        peak = e["hr_peak"]
        if peak >= resting_hr * 1.7:
            severity = "high"
        elif peak >= resting_hr * 1.5:
            severity = "medium"
        else:
            severity = "low"

        formatted_events.append({
            "start": e["start"].isoformat().replace("+00:00", "Z"),
            "end": e["end"].isoformat().replace("+00:00", "Z"),
            "hr_peak": round(peak, 1),
            "severity": severity,
        })

    return formatted_events


def calculate_sleep_debt(sleep_data: list[dict], target_hours: float = 8.0) -> float:
    """
    Computes sleep debt against a user-defined target.
    Returns cumulative sleep debt as a float.
    """
    if not sleep_data:
        logger.debug("calculate_sleep_debt: Empty sleep series. Returning 0.")
        return 0.0

    cumulative_debt = 0.0
    for record in sleep_data:
        val = record.get("value")
        if not val or not isinstance(val, dict):
            continue

        total_min = val.get("total_sleep_minutes")
        if total_min is None:
            continue

        try:
            actual = float(total_min) / 60.0
            debt = target_hours - actual
            cumulative_debt += debt
        except (ValueError, TypeError) as e:
            logger.warning(f"calculate_sleep_debt: Invalid minutes value {total_min}: {e}")
            continue

    return round(cumulative_debt, 2) if cumulative_debt != 0 else 0.0


def calculate_sleep_debt_series(sleep_data: list[dict], target_hours: float = 8.0) -> list[dict]:
    """
    Computes sleep debt series against a user-defined target for trend charting.
    Returns a list of dicts: [{"date": "YYYY-MM-DD", "actual_hours": float,
                               "target_hours": float, "debt_hours": float}]
    """
    if not sleep_data:
        logger.debug("calculate_sleep_debt_series: Empty sleep series. Returning empty list.")
        return []

    results = []
    for record in sleep_data:
        ts = record.get("timestamp") or record.get("date")
        if not ts:
            continue
        date_str = ts.split("T")[0]
        
        val = record.get("value")
        if not val or not isinstance(val, dict):
            continue

        total_min = val.get("total_sleep_minutes")
        if total_min is None:
            continue

        try:
            actual = float(total_min) / 60.0
            debt = target_hours - actual
            results.append({
                "date": date_str,
                "actual_hours": round(actual, 2),
                "target_hours": round(target_hours, 2),
                "debt_hours": round(debt, 2),
            })
        except (ValueError, TypeError) as e:
            logger.warning(f"calculate_sleep_debt_series: Invalid minutes value {total_min}: {e}")
            continue

    results.sort(key=lambda x: x["date"])
    return results
