from pydantic import BaseModel
from typing import Any

class HeartRatePoint(BaseModel):
    datetime: str
    bpm: int
    zone: str

class HRVDataPoint(BaseModel):
    date: str
    rmssd: float

class SleepSession(BaseModel):
    date: str
    duration_minutes: int
    efficiency: float
    stages: dict

class SpO2Reading(BaseModel):
    datetime: str
    value: float

class StressEvent(BaseModel):
    start: str
    end: str
    score: int

class ANSBalance(BaseModel):
    date: str
    lf: float
    hf: float
    ratio: float

class HealthDataResponse(BaseModel):
    heart_rate: list[HeartRatePoint]
    hrv: list[HRVDataPoint]
    sleep: list[SleepSession]
    spo2: list[SpO2Reading]
    stress: list[StressEvent]
    ans_balance: list[ANSBalance]
    synced_at: str | None
    stale: bool = False
