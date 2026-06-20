import logging
import requests
from typing import Any
from datetime import datetime, timedelta

logger = logging.getLogger("client")

def _parse_date(date_obj: dict[str, Any]) -> str:
    """Format Google API date object {"year": YYYY, "month": MM, "day": DD} as YYYY-MM-DD."""
    try:
        year = date_obj.get("year", 0)
        month = date_obj.get("month", 0)
        day = date_obj.get("day", 0)
        return f"{year:04d}-{month:02d}-{day:02d}"
    except Exception:
        return "1970-01-01"

class HealthAPIClient:
    def __init__(self, access_token: str, base_url: str = "https://health.googleapis.com/v4"):
        self.access_token = access_token
        self.base_url = base_url

    def _get(self, endpoint: str, params: dict[str, Any] = None) -> requests.Response | None:
        url = f"{self.base_url}/{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        try:
            response = requests.get(url, headers=headers, params=params, timeout=30)
            if response.status_code == 401:
                logger.info("Access token expired or unauthorized (401). Triggering token refresh flow...")
                from auth import get_credentials
                creds = get_credentials()
                self.access_token = creds.token
                headers["Authorization"] = f"Bearer {self.access_token}"
                response = requests.get(url, headers=headers, params=params, timeout=30)
            
            if response.status_code != 200:
                logger.error(f"HTTP error {response.status_code} for {endpoint}: {response.text[:300]}")
                return None
                
            return response
        except Exception as e:
            logger.error(f"Request to {endpoint} failed: {e}")
            return None

    def get_heart_rate(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        start_time = f"{start_date}T00:00:00Z"
        end_date_dt = datetime.strptime(end_date, "%Y-%m-%d")
        next_day_dt = end_date_dt + timedelta(days=1)
        end_time = f"{next_day_dt.strftime('%Y-%m-%d')}T00:00:00Z"
        filter_expr = f"heart_rate.sample_time.physical_time >= \"{start_time}\" AND heart_rate.sample_time.physical_time < \"{end_time}\""
        
        response = self._get("users/me/dataTypes/heart-rate/dataPoints", {"filter": filter_expr, "pageSize": 10000})
        if not response:
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
        logger.info(f"get_heart_rate: {len(normalized)} points returned.")
        return normalized

    def get_intraday_hrv(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        start_time = f"{start_date}T00:00:00Z"
        end_date_dt = datetime.strptime(end_date, "%Y-%m-%d")
        next_day_dt = end_date_dt + timedelta(days=1)
        end_time = f"{next_day_dt.strftime('%Y-%m-%d')}T00:00:00Z"
        filter_expr = f"heart_rate_variability.sample_time.physical_time >= \"{start_time}\" AND heart_rate_variability.sample_time.physical_time < \"{end_time}\""
        
        response = self._get("users/me/dataTypes/heart-rate-variability/dataPoints", {"filter": filter_expr, "pageSize": 10000})
        if not response:
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
        logger.info(f"get_intraday_hrv: {len(normalized)} points returned.")
        return normalized

    def get_hrv(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        intraday = self.get_intraday_hrv(start_date, end_date)
        if intraday:
            return intraday
            
        logger.warning("Intraday HRV is unavailable. Falling back to daily aggregates.")
        return self.get_daily_hrv(start_date, end_date)

    def get_spo2(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        start_time = f"{start_date}T00:00:00Z"
        end_date_dt = datetime.strptime(end_date, "%Y-%m-%d")
        next_day_dt = end_date_dt + timedelta(days=1)
        end_time = f"{next_day_dt.strftime('%Y-%m-%d')}T00:00:00Z"
        filter_expr = f"oxygen_saturation.sample_time.sleep_time >= \"{start_time}\" AND oxygen_saturation.sample_time.sleep_time < \"{end_time}\""
        
        response = self._get("users/me/dataTypes/oxygen-saturation/dataPoints", {"filter": filter_expr, "pageSize": 10000})
        if not response:
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
            
        logger.info(f"get_spo2: {len(normalized)} points returned.")
        return normalized

    def get_stress(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        start_time = f"{start_date}T00:00:00Z"
        end_date_dt = datetime.strptime(end_date, "%Y-%m-%d")
        next_day_dt = end_date_dt + timedelta(days=1)
        end_time = f"{next_day_dt.strftime('%Y-%m-%d')}T00:00:00Z"
        filter_expr = f"steps.interval.start_time >= \"{start_time}\" AND steps.interval.start_time < \"{end_time}\""
        
        response = self._get("users/me/dataTypes/steps/dataPoints", {"filter": filter_expr, "pageSize": 10000})
        if not response:
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
        logger.info(f"get_stress: {len(normalized)} points returned.")
        return normalized

    def get_steps(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        start_time = f"{start_date}T00:00:00Z"
        end_date_dt = datetime.strptime(end_date, "%Y-%m-%d")
        next_day_dt = end_date_dt + timedelta(days=1)
        end_time = f"{next_day_dt.strftime('%Y-%m-%d')}T00:00:00Z"
        filter_expr = f"steps.interval.start_time >= \"{start_time}\" AND steps.interval.start_time < \"{end_time}\""
        
        response = self._get("users/me/dataTypes/steps/dataPoints", {"filter": filter_expr, "pageSize": 10000})
        if not response:
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
        logger.info(f"get_steps: {len(normalized)} points returned.")
        return normalized

    def get_daily_hrv(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        response = self._get("users/me/dataTypes/daily-heart-rate-variability/dataPoints", {"pageSize": 1000})
        if not response:
            return []
            
        data = response.json()
        points = data.get("dataPoints", [])
        
        normalized = []
        for pt in points:
            hrv_data = pt.get("dailyHeartRateVariability", {})
            date_str = _parse_date(hrv_data.get("date", {}))
            
            if start_date <= date_str <= end_date:
                val = hrv_data.get("averageHeartRateVariabilityMilliseconds")
                if val is not None:
                    normalized.append({
                        "timestamp": date_str,
                        "value": float(val),
                        "data_type": "DAILY_HEART_RATE_VARIABILITY"
                    })
        normalized.sort(key=lambda x: x["timestamp"])
        logger.info(f"get_daily_hrv: {len(normalized)} records returned.")
        return normalized

    def get_daily_spo2(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        response = self._get("users/me/dataTypes/daily-oxygen-saturation/dataPoints", {"pageSize": 1000})
        if not response:
            return []
            
        data = response.json()
        points = data.get("dataPoints", [])
        
        normalized = []
        for pt in points:
            spo2_data = pt.get("dailyOxygenSaturation", {})
            date_str = _parse_date(spo2_data.get("date", {}))
            
            if start_date <= date_str <= end_date:
                val = spo2_data.get("averagePercentage")
                if val is not None:
                    normalized.append({
                        "timestamp": date_str,
                        "value": float(val),
                        "data_type": "DAILY_OXYGEN_SATURATION"
                    })
        normalized.sort(key=lambda x: x["timestamp"])
        logger.info(f"get_daily_spo2: {len(normalized)} records returned.")
        return normalized

    def get_daily_resting_hr(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        response = self._get("users/me/dataTypes/daily-resting-heart-rate/dataPoints", {"pageSize": 1000})
        if not response:
            return []
            
        data = response.json()
        points = data.get("dataPoints", [])
        
        normalized = []
        for pt in points:
            rhr_data = pt.get("dailyRestingHeartRate", {})
            date_str = _parse_date(rhr_data.get("date", {}))
            
            if start_date <= date_str <= end_date:
                val = rhr_data.get("beatsPerMinute")
                if val is not None:
                    normalized.append({
                        "timestamp": date_str,
                        "value": float(val),
                        "data_type": "DAILY_RESTING_HEART_RATE"
                    })
        normalized.sort(key=lambda x: x["timestamp"])
        logger.info(f"get_daily_resting_hr: {len(normalized)} records returned.")
        return normalized

    def get_temperature(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        response = self._get("users/me/dataTypes/daily-sleep-temperature-derivations/dataPoints", {"pageSize": 1000})
        if not response:
            return []
            
        data = response.json()
        points = data.get("dataPoints", [])
        
        normalized = []
        for pt in points:
            temp_data = pt.get("dailySleepTemperatureDerivations", {})
            date_str = _parse_date(temp_data.get("date", {}))
            
            if start_date <= date_str <= end_date:
                val = temp_data.get("nightlyTemperatureCelsius")
                if val is not None:
                    normalized.append({
                        "timestamp": date_str,
                        "value": float(val),
                        "data_type": "DAILY_SLEEP_TEMPERATURE_DERIVATIONS"
                    })
        normalized.sort(key=lambda x: x["timestamp"])
        logger.info(f"get_temperature: {len(normalized)} records returned.")
        return normalized

    def get_sleep_temp(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        response = self._get("users/me/dataTypes/daily-sleep-temperature-derivations/dataPoints", {"pageSize": 1000})
        if not response:
            return []
            
        data = response.json()
        points = data.get("dataPoints", [])
        
        normalized = []
        for pt in points:
            temp_data = pt.get("dailySleepTemperatureDerivations", {})
            date_str = _parse_date(temp_data.get("date", {}))
            
            if start_date <= date_str <= end_date:
                val = temp_data.get("nightlyTemperatureCelsius")
                if val is not None:
                    normalized.append({
                        "timestamp": date_str,
                        "value": float(val),
                        "data_type": "DAILY_SLEEP_TEMPERATURE_DERIVATIONS"
                    })
        normalized.sort(key=lambda x: x["timestamp"])
        logger.info(f"get_sleep_temp: {len(normalized)} records returned.")
        return normalized

    def get_sleep(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        response = self._get("users/me/dataTypes/sleep/dataPoints", {"pageSize": 1000})
        if not response:
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
                
            date_str = start_time_str[:10]
            
            if start_date <= date_str <= end_date:
                summary = sleep_data.get("summary", {})
                minutes_asleep = float(summary.get("minutesAsleep") or 0)
                
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
        logger.info(f"get_sleep: {len(normalized)} sleep sessions returned.")
        return normalized
