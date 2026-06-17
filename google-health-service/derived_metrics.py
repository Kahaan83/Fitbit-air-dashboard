"""
derived_metrics.py — Computed physiological metric algorithms.

Implements ANS Autonomic Balance (LF/HF ratio), VO2 Max estimation,
Acute Stress detection, and Sleep Debt calculations.
"""

from datetime import datetime, timezone
import logging
from collections import defaultdict
import numpy as np
from scipy.interpolate import interp1d
from scipy.signal import periodogram

logger = logging.getLogger("derived_metrics")


def calculate_ans_balance(hrv_series: list[dict]) -> list[dict]:
    """
    Computes LF/HF autonomic nervous system balance via frequency-domain analysis.

    Args:
        hrv_series: List of dicts from fetch_hrv(), each with keys
                    'timestamp' (ISO8601 str) and 'value' (float, RMSSD in ms).

    Returns:
        List of dicts: [{"date": "YYYY-MM-DD", "lf_power": float,
                         "hf_power": float, "lf_hf_ratio": float}]
        LF band: 0.04–0.15 Hz. HF band: 0.15–0.4 Hz.
        Uses FFT on RR-interval series derived from RMSSD approximation.
    """
    if not hrv_series:
        logger.debug("calculate_ans_balance: Empty HRV series. Returning empty list.")
        return []

    # Group measurements by date
    grouped = defaultdict(list)
    for record in hrv_series:
        ts_str = record.get("timestamp", "")
        if not ts_str:
            continue
        date_str = ts_str.split("T")[0]
        val = record.get("value")
        if val is None:
            continue

        try:
            # Parse timestamp to epoch seconds for time-spacing
            # Handle formats like "2026-06-17T12:00:00Z" or similar
            ts_str = ts_str.replace("Z", "+00:00")
            dt = datetime.fromisoformat(ts_str)
            t_seconds = dt.timestamp()
            grouped[date_str].append((t_seconds, float(val)))
        except Exception as e:
            logger.warning(f"calculate_ans_balance: Error parsing record: {e}")
            continue

    ans_results = []

    for date_str, samples in grouped.items():
        # Sort samples by time
        samples.sort(key=lambda x: x[0])
        if len(samples) < 5:
            # Not enough samples for a reliable spectral analysis; skip or output default
            logger.debug(f"calculate_ans_balance: Skipping {date_str} due to low sample count ({len(samples)})")
            continue

        times = np.array([s[0] for s in samples])
        rmssd_vals = np.array([s[1] for s in samples])

        # Normalize times relative to the first sample of the day
        t_rel = times - times[0]
        
        # Check if the time range is non-zero
        if t_rel[-1] <= 10.0:
            continue

        # Convert RMSSD to approximate RR interval (ms)
        # Formula: RR_ms = 1000 / (60 / rmssd)
        # We clamp RMSSD to prevent division by zero or negative values
        clamped_rmssd = np.clip(rmssd_vals, 5.0, 200.0)
        rr_ms = 1000.0 / (60.0 / clamped_rmssd)

        try:
            # Resample onto a uniform 4 Hz grid (0.25 sec spacing)
            fs = 4.0
            t_uniform = np.arange(0.0, t_rel[-1], 0.25)
            
            if len(t_uniform) < 10:
                continue

            # Interpolate
            f_interp = interp1d(t_rel, rr_ms, kind="linear", fill_value="extrapolate")
            rr_uniform = f_interp(t_uniform)

            # Detrend the signal
            rr_detrended = rr_uniform - np.mean(rr_uniform)

            # Compute Periodogram (Power Spectral Density)
            freqs, psd = periodogram(rr_detrended, fs=fs)

            # Filter indices for LF (0.04 - 0.15 Hz) and HF (0.15 - 0.40 Hz) bands
            lf_mask = (freqs >= 0.04) & (freqs <= 0.15)
            hf_mask = (freqs >= 0.15) & (freqs <= 0.40)

            # Integrate PSD using Trapezoidal rule
            # If the frequency masks are empty, fallback to 0.0
            lf_power = float(np.trapz(psd[lf_mask], freqs[lf_mask])) if np.any(lf_mask) else 0.0
            hf_power = float(np.trapz(psd[hf_mask], freqs[hf_mask])) if np.any(hf_mask) else 0.0

            # Sympathovagal balance ratio (sympathetic / parasympathetic)
            lf_hf_ratio = lf_power / hf_power if hf_power > 0 else 1.0

            ans_results.append({
                "date": date_str,
                "lf_power": round(lf_power, 2),
                "hf_power": round(hf_power, 2),
                "lf_hf_ratio": round(lf_hf_ratio, 2),
            })
        except Exception as e:
            logger.warning(f"calculate_ans_balance: Math error for date {date_str}: {e}")
            continue

    # Sort results chronologically
    ans_results.sort(key=lambda x: x["date"])
    return ans_results


def calculate_vo2_max(daily_resting_hr_series: list[dict], hr_max: float) -> list[dict]:
    """
    Estimates VO2 Max using the Uth-Sørensen formula: 15.3 × (HRmax / HRrest).

    Args:
        daily_resting_hr_series: List of dicts from fetch_daily_resting_hr(),
                                  each with keys 'timestamp' and 'value' (bpm).
        hr_max: User's tested maximum heart rate (float, bpm), loaded from .env
                or user Settings.

    Returns:
        List of dicts: [{"date": "YYYY-MM-DD", "vo2_max": float}]
        vo2_max in ml/kg/min.
    """
    if not daily_resting_hr_series:
        logger.debug("calculate_vo2_max: Empty resting HR series. Returning empty list.")
        return []

    results = []
    for record in daily_resting_hr_series:
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
            logger.warning(f"calculate_vo2_max: Invalid resting HR value {rhr}: {e}")
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
        Severity: low = 1.3–1.5×, medium = 1.5–1.7×, high = >1.7×.
    """
    if not hr_series:
        logger.debug("identify_acute_stress: Empty HR series. Returning empty list.")
        return []

    # Map step counts into 5-minute binned intervals: key = (date, hour, minute_bin)
    # where minute_bin is m // 5
    steps_bin = {}
    for step_rec in steps_series:
        ts_str = step_rec.get("timestamp", "")
        if not ts_str:
            continue
        try:
            ts_str = ts_str.replace("Z", "+00:00")
            dt = datetime.fromisoformat(ts_str)
            # Bin into 5-minute blocks
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

    # Flag stress windows: 5-minute intervals
    flagged_intervals = []
    threshold_hr = resting_hr * 1.3

    for bin_key, readings in hr_bins.items():
        # Get concurrent step count
        steps_val = steps_bin.get(bin_key, 0)
        
        # Calculate average HR for this 5-minute window
        avg_hr = sum(r[1] for r in readings) / len(readings)

        # Flag if HR > threshold and steps == 0
        if avg_hr > threshold_hr and steps_val == 0:
            # Find the peak timestamp/value in this window
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
            # Check if this window is within 10 minutes of the end of current event
            diff = (dt - current_event["end"]).total_seconds()
            if diff <= 600.0:  # 10 minutes
                current_event["end"] = dt
                current_event["hr_peak"] = max(current_event["hr_peak"], hr_val)
                current_event["times"].append(dt)
            else:
                # Close current event and start a new one
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
        
        # Calculate severity based on peak HR compared to resting HR
        # Severity: low = 1.3–1.5× resting, medium = 1.5–1.7× resting, high = >1.7× resting
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


def calculate_sleep_debt(sleep_series: list[dict], target_hours: float) -> list[dict]:
    """
    Computes nightly sleep debt against a user-defined target.

    Args:
        sleep_series: List of dicts from fetch_sleep() with 'date' and
                      'total_sleep_minutes' keys.
        target_hours: User's target sleep duration in hours (from .env or Settings).

    Returns:
        List of dicts: [{"date": "YYYY-MM-DD", "actual_hours": float,
                         "target_hours": float, "debt_hours": float}]
        debt_hours is positive when actual < target, negative when ahead.
    """
    if not sleep_series:
        logger.debug("calculate_sleep_debt: Empty sleep series. Returning empty list.")
        return []

    results = []
    for record in sleep_series:
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
            logger.warning(f"calculate_sleep_debt: Invalid minutes value {total_min}: {e}")
            continue

    results.sort(key=lambda x: x["date"])
    return results
