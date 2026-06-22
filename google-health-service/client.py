import logging
import asyncio
import requests
import httpx
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

def _parse_rollup_date(pt: dict[str, Any], metric_key: str) -> str:
    if "date" in pt:
        return pt["date"]
    metric_data = pt.get(metric_key, {})
    if "date" in metric_data:
        date_obj = metric_data["date"]
        if isinstance(date_obj, dict):
            return _parse_date(date_obj)
        elif isinstance(date_obj, str):
            return date_obj
    return "1970-01-01"

class HealthAPIClient:
    def __init__(self, access_token: str, base_url: str = "https://health.googleapis.com/v4"):
        self.access_token = access_token
        self.base_url = base_url
        self._http = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )

    async def close(self):
        await self._http.aclose()

    async def _get(self, endpoint: str, params: dict[str, Any] = None) -> httpx.Response | None:
        url = f"{self.base_url}/{endpoint}"
        try:
            response = await self._http.get(url, params=params)
            if response.status_code == 401:
                logger.info("Access token expired or unauthorized (401). Triggering token refresh flow...")
                from auth import get_credentials_sync
                creds = get_credentials_sync()
                self.access_token = creds.token
                self._http.headers.update({"Authorization": f"Bearer {self.access_token}"})
                response = await self._http.get(url, params=params)
            
            if response.status_code == 400:
                try:
                    err_json = response.json()
                    err_msg = err_json.get("error", {}).get("message", response.text)
                except Exception:
                    err_msg = response.text
                logger.error(f"Bad Request (400) for {endpoint}. Response body: {response.text}")
                raise ValueError(f"Google Health API Bad Request: {err_msg}")

            if response.status_code != 200:
                logger.error(f"HTTP error {response.status_code} for {endpoint}: {response.text[:300]}")
                return None
                
            return response
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Request to {endpoint} failed: {e}")
            return None

    def _get_sync(self, endpoint: str, params: dict[str, Any] = None) -> requests.Response | None:
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
                from auth import get_credentials_sync
                creds = get_credentials_sync()
                self.access_token = creds.token
                headers["Authorization"] = f"Bearer {self.access_token}"
                response = requests.get(url, headers=headers, params=params, timeout=30)
            
            if response.status_code == 400:
                try:
                    err_json = response.json()
                    err_msg = err_json.get("error", {}).get("message", response.text)
                except Exception:
                    err_msg = response.text
                logger.error(f"Bad Request (400) for {endpoint}. Response body: {response.text}")
                raise ValueError(f"Google Health API Bad Request: {err_msg}")

            if response.status_code != 200:
                logger.error(f"HTTP error {response.status_code} for {endpoint}: {response.text[:300]}")
                return None
                
            return response
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Request to {endpoint} failed: {e}")
            return None

    async def _post(self, endpoint: str, body: dict) -> dict | None:
        url = f"{self.base_url}/{endpoint}"
        try:
            response = await self._http.post(url, json=body)
            if response.status_code == 401:
                logger.info("Access token expired or unauthorized (401). Triggering token refresh flow...")
                from auth import get_credentials_sync
                creds = get_credentials_sync()
                self.access_token = creds.token
                self._http.headers.update({"Authorization": f"Bearer {self.access_token}"})
                response = await self._http.post(url, json=body)
            
            if response.status_code != 200:
                logger.error(f"HTTP error {response.status_code} for {endpoint}: {response.text[:300]}")
                return None
                
            return response.json()
        except Exception as e:
            logger.error(f"Request to {endpoint} failed: {e}")
            return None

    async def get_heart_rate(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self._get_heart_rate_sync, start_date, end_date)

    def _get_heart_rate_sync(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        start_time = f"{start_date}T00:00:00Z"
        end_date_dt = datetime.strptime(end_date, "%Y-%m-%d")
        next_day_dt = end_date_dt + timedelta(days=1)
        end_time = f"{next_day_dt.strftime('%Y-%m-%d')}T00:00:00Z"
        filter_expr = f"heart_rate.sample_time.physical_time >= \"{start_time}\" AND heart_rate.sample_time.physical_time < \"{end_time}\""
        
        all_points = []
        page_token = None
        while True:
            params = {"filter": filter_expr, "pageSize": 10000}
            if page_token:
                params["pageToken"] = page_token
            response = self._get_sync("users/me/dataTypes/heart-rate/dataPoints", params)
            if response is None:
                break
            data = response.json()
            all_points.extend(data.get("dataPoints", []))
            page_token = data.get("nextPageToken")
            if not page_token:
                break

        normalized = []
        for pt in all_points:
            hr_data = pt.get("heartRate", {})
            ts = hr_data.get("sampleTime", {}).get("physicalTime")
            val = hr_data.get("beatsPerMinute")
            if ts and val is not None:
                normalized.append({
                    "timestamp": ts,
                    "value": float(val),
                    "bpm": float(val),
                    "data_type": "HEART_RATE"
                })
        logger.info(f"get_heart_rate: {len(normalized)} points returned.")
        return normalized

    async def get_intraday_hrv(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        # Reserved for future per-night HRV detail view. Not called during sync.
        return await asyncio.to_thread(self._get_intraday_hrv_sync, start_date, end_date)

    def _get_intraday_hrv_sync(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        start_time = f"{start_date}T00:00:00Z"
        end_date_dt = datetime.strptime(end_date, "%Y-%m-%d")
        next_day_dt = end_date_dt + timedelta(days=1)
        end_time = f"{next_day_dt.strftime('%Y-%m-%d')}T00:00:00Z"
        filter_expr = f"heart_rate_variability.sample_time.physical_time >= \"{start_time}\" AND heart_rate_variability.sample_time.physical_time < \"{end_time}\""
        
        all_points = []
        page_token = None
        while True:
            params = {"filter": filter_expr, "pageSize": 10000}
            if page_token:
                params["pageToken"] = page_token
            response = self._get_sync("users/me/dataTypes/heart-rate-variability/dataPoints", params)
            if response is None:
                break
            data = response.json()
            all_points.extend(data.get("dataPoints", []))
            page_token = data.get("nextPageToken")
            if not page_token:
                break
 
        normalized = []
        for pt in all_points:
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
 
    async def get_hrv(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        return await self.get_daily_hrv(start_date, end_date)

    async def get_spo2(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self._get_spo2_sync, start_date, end_date)

    def _get_spo2_sync(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        start_time = f"{start_date}T00:00:00Z"
        end_date_dt = datetime.strptime(end_date, "%Y-%m-%d")
        next_day_dt = end_date_dt + timedelta(days=1)
        end_time = f"{next_day_dt.strftime('%Y-%m-%d')}T00:00:00Z"
        filter_expr = f"oxygen_saturation.sample_time.physical_time >= \"{start_time}\" AND oxygen_saturation.sample_time.physical_time < \"{end_time}\""
        
        all_points = []
        page_token = None
        while True:
            params = {"filter": filter_expr, "pageSize": 10000}
            if page_token:
                params["pageToken"] = page_token
            response = self._get_sync("users/me/dataTypes/oxygen-saturation/dataPoints", params)
            if response is None:
                break
            data = response.json()
            all_points.extend(data.get("dataPoints", []))
            page_token = data.get("nextPageToken")
            if not page_token:
                break

        normalized = []
        for pt in all_points:
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

    async def get_steps(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self._get_steps_sync, start_date, end_date)

    def _get_steps_sync(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        start_time = f"{start_date}T00:00:00Z"
        end_date_dt = datetime.strptime(end_date, "%Y-%m-%d")
        next_day_dt = end_date_dt + timedelta(days=1)
        end_time = f"{next_day_dt.strftime('%Y-%m-%d')}T00:00:00Z"
        filter_expr = f"steps.interval.start_time >= \"{start_time}\" AND steps.interval.start_time < \"{end_time}\""
        
        all_points = []
        page_token = None
        while True:
            params = {"filter": filter_expr, "pageSize": 10000}
            if page_token:
                params["pageToken"] = page_token
            response = self._get_sync("users/me/dataTypes/steps/dataPoints", params)
            if response is None:
                break
            data = response.json()
            all_points.extend(data.get("dataPoints", []))
            page_token = data.get("nextPageToken")
            if not page_token:
                break

        normalized = []
        for pt in all_points:
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

    def _build_daily_rollup_body(self, start_date: str, end_date: str) -> dict:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        return {
            "range": {
                "start": {
                    "date": {
                        "year": start_dt.year,
                        "month": start_dt.month,
                        "day": start_dt.day
                    },
                    "time": {
                        "hours": 0,
                        "minutes": 0,
                        "seconds": 0,
                        "nanos": 0
                    }
                },
                "end": {
                    "date": {
                        "year": end_dt.year,
                        "month": end_dt.month,
                        "day": end_dt.day
                    },
                    "time": {
                        "hours": 0,
                        "minutes": 0,
                        "seconds": 0,
                        "nanos": 0
                    }
                }
            }
        }

    async def get_daily_hrv(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        next_day_str = (end_dt + timedelta(days=1)).strftime("%Y-%m-%d")
        filter_expr = f"daily_heart_rate_variability.date >= \"{start_date}\" AND daily_heart_rate_variability.date < \"{next_day_str}\""
        params = {"filter": filter_expr}
        
        res = await self._get("users/me/dataTypes/daily-heart-rate-variability/dataPoints", params)
        if not res:
            return []
            
        try:
            res_json = res.json()
            points = res_json.get("dataPoints", [])
            normalized = []
            for pt in points:
                date_str = _parse_rollup_date(pt, "dailyHeartRateVariability")
                hrv_data = pt.get("dailyHeartRateVariability", {})
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
        except (KeyError, ValueError, TypeError) as e:
            logger.error(
                f"dailyRollUp parse error for DAILY_HEART_RATE_VARIABILITY: {e}. "
                f"Response keys: {list(res_json.keys()) if isinstance(res_json, dict) else type(res_json)}"
            )
            return []

    async def get_daily_spo2(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        next_day_str = (end_dt + timedelta(days=1)).strftime("%Y-%m-%d")
        filter_expr = f"daily_oxygen_saturation.date >= \"{start_date}\" AND daily_oxygen_saturation.date < \"{next_day_str}\""
        params = {"filter": filter_expr}
        
        res = await self._get("users/me/dataTypes/daily-oxygen-saturation/dataPoints", params)
        if not res:
            return []
            
        try:
            res_json = res.json()
            points = res_json.get("dataPoints", [])
            normalized = []
            for pt in points:
                date_str = _parse_rollup_date(pt, "dailyOxygenSaturation")
                spo2_data = pt.get("dailyOxygenSaturation", {})
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
        except (KeyError, ValueError, TypeError) as e:
            logger.error(
                f"dailyRollUp parse error for DAILY_OXYGEN_SATURATION: {e}. "
                f"Response keys: {list(res_json.keys()) if isinstance(res_json, dict) else type(res_json)}"
            )
            return []

    async def get_daily_resting_hr(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        next_day_str = (end_dt + timedelta(days=1)).strftime("%Y-%m-%d")
        filter_expr = f"daily_resting_heart_rate.date >= \"{start_date}\" AND daily_resting_heart_rate.date < \"{next_day_str}\""
        params = {"filter": filter_expr}
        
        res = await self._get("users/me/dataTypes/daily-resting-heart-rate/dataPoints", params)
        if not res:
            return []
            
        try:
            res_json = res.json()
            points = res_json.get("dataPoints", [])
            normalized = []
            for pt in points:
                date_str = _parse_rollup_date(pt, "dailyRestingHeartRate")
                rhr_data = pt.get("dailyRestingHeartRate", {})
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
        except (KeyError, ValueError, TypeError) as e:
            logger.error(
                f"dailyRollUp parse error for DAILY_RESTING_HEART_RATE: {e}. "
                f"Response keys: {list(res_json.keys()) if isinstance(res_json, dict) else type(res_json)}"
            )
            return []

    async def get_sleep_temp(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        next_day_str = (end_dt + timedelta(days=1)).strftime("%Y-%m-%d")
        filter_expr = f"daily_sleep_temperature_derivations.date >= \"{start_date}\" AND daily_sleep_temperature_derivations.date < \"{next_day_str}\""
        params = {"filter": filter_expr}
        
        res = await self._get("users/me/dataTypes/daily-sleep-temperature-derivations/dataPoints", params)
        if not res:
            return []
            
        try:
            res_json = res.json()
            points = res_json.get("dataPoints", [])
            normalized = []
            for pt in points:
                date_str = _parse_rollup_date(pt, "dailySleepTemperatureDerivations")
                temp_data = pt.get("dailySleepTemperatureDerivations", {})
                nightly = temp_data.get("nightlyTemperatureCelsius")
                baseline = temp_data.get("baselineTemperatureCelsius")
                if nightly is not None:
                    val = float(nightly) - (float(baseline) if baseline is not None else 34.80)
                    normalized.append({
                        "timestamp": date_str,
                        "value": round(val, 2),
                        "data_type": "DAILY_SLEEP_TEMPERATURE_DERIVATIONS"
                    })
            normalized.sort(key=lambda x: x["timestamp"])
            logger.info(f"get_sleep_temp: {len(normalized)} records returned.")
            return normalized
        except (KeyError, ValueError, TypeError) as e:
            logger.error(
                f"dailyRollUp parse error for DAILY_SLEEP_TEMPERATURE_DERIVATIONS: {e}. "
                f"Response keys: {list(res_json.keys()) if isinstance(res_json, dict) else type(res_json)}"
            )
            return []


    async def get_sleep(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self._get_sleep_sync, start_date, end_date)

    def _get_sleep_sync(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        response = self._get_sync("users/me/dataTypes/sleep/dataPoints", {"pageSize": 1000})
        if not response:
            return []
            
        data = response.json()
        points = data.get("dataPoints", [])
        
        by_day = {}
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
                        
                if date_str not in by_day:
                    by_day[date_str] = {
                        "total_sleep_minutes": minutes_asleep,
                        "stages": stage_durations
                    }
                else:
                    by_day[date_str]["total_sleep_minutes"] += minutes_asleep
                    for stage in stage_durations:
                        by_day[date_str]["stages"][stage] += stage_durations[stage]
                        
        normalized = []
        for date_str, val in by_day.items():
            normalized.append({
                "timestamp": date_str,
                "value": val,
                "data_type": "SLEEP"
            })
        normalized.sort(key=lambda x: x["timestamp"])
        logger.info(f"get_sleep: {len(normalized)} sleep sessions returned.")
        return normalized
