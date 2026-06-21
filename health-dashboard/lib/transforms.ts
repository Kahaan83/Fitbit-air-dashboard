export interface SleepDataPoint {
  timestamp: string;
  value: {
    total_sleep_minutes: number;
    stages?: {
      rem?: number;
      deep?: number;
      light?: number;
      awake?: number;
    };
  };
}

export interface SleepDebtPoint {
  date: string;
  actual_hours: number;
  target_hours: number;
  debt_hours: number;
}

export interface RawStressEvent {
  start: string;
  end: string;
  hr_peak: number;
  severity: "low" | "medium" | "high";
}

export interface MappedStressEvent {
  id: string;
  start: string;
  end: string;
  hr_peak: number;
  severity: "low" | "medium" | "high";
  date: string;
}

export interface SpO2RawPoint {
  timestamp: string;
  value: number | string;
}

export interface SpO2Reading {
  time: string;
  value: number;
}

/**
 * 1. recoveryScore: calculates score based on latest HRV vs avg HRV, RHR, and sleep efficiency.
 * If hrv data is missing, falls back to an RHR/Sleep Efficiency based score.
 */
export function calculateRecoveryScore(
  hrv: { value: number }[],
  rhr: number,
  sleepEfficiency: number
): number {
  const hrvVals = hrv.map(d => d.value).filter(v => typeof v === "number" && !isNaN(v));
  if (hrvVals.length > 0) {
    const avg30 = hrvVals.reduce((s, v) => s + v, 0) / hrvVals.length;
    const latest = hrvVals[hrvVals.length - 1] ?? 0;
    const ratio = avg30 > 0 ? latest / avg30 : 1;
    let score = ratio * 50 + 25;
    
    if (rhr > 0) {
      const rhrDiff = rhr - 58;
      score -= rhrDiff * 0.5;
    }
    if (sleepEfficiency > 0) {
      const effDiff = sleepEfficiency - 85;
      score += effDiff * 0.2;
    }

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  // Fallback to RHR/Sleep Efficiency based score
  let fallbackScore = 75;
  if (rhr > 0) {
    const rhrDiff = rhr - 58;
    fallbackScore -= rhrDiff * 1.5;
  }
  if (sleepEfficiency > 0) {
    const effDiff = sleepEfficiency - 85;
    fallbackScore += effDiff * 0.5;
  }
  return Math.round(Math.max(0, Math.min(100, fallbackScore)));
}

/**
 * 2. buildSleepDebtSeries: calculates cumulative sleep debt over time.
 */
export function buildSleepDebtSeries(
  sleepData: SleepDataPoint[],
  targetHours: number = 8.0
): SleepDebtPoint[] {
  if (!sleepData || sleepData.length === 0) return [];
  
  let cumulativeDebt = 0;
  const sorted = [...sleepData].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return sorted.map((d) => {
    const date = d.timestamp.split("T")[0];
    const actual = (d.value?.total_sleep_minutes ?? 0) / 60.0;
    const debt = targetHours - actual;
    cumulativeDebt += debt;

    return {
      date,
      actual_hours: Math.round(actual * 100) / 100,
      target_hours: targetHours,
      debt_hours: Math.round(cumulativeDebt * 100) / 100,
    };
  });
}

/**
 * 3. mapAcuteStress: groups and maps stress events to local date, merging overlaps.
 */
export function mapAcuteStress(
  stressEvents: RawStressEvent[],
  timezoneOffsetMinutes?: number
): Record<string, MappedStressEvent[]> {
  if (!stressEvents || stressEvents.length === 0) return {};

  const mapped: Record<string, MappedStressEvent[]> = {};

  stressEvents.forEach((event, idx) => {
    let dateStr = "";
    if (timezoneOffsetMinutes !== undefined) {
      const startMs = new Date(event.start).getTime();
      const localStart = new Date(startMs - timezoneOffsetMinutes * 60 * 1000);
      dateStr = localStart.toISOString().split("T")[0];
    } else {
      dateStr = new Date(event.start).toLocaleDateString("en-CA");
    }

    const mappedEvent: MappedStressEvent = {
      id: `live-stress-${idx}`,
      start: event.start,
      end: event.end,
      hr_peak: event.hr_peak,
      severity: event.severity,
      date: dateStr,
    };

    if (!mapped[dateStr]) {
      mapped[dateStr] = [];
    }
    mapped[dateStr].push(mappedEvent);
  });

  const result: Record<string, MappedStressEvent[]> = {};

  Object.keys(mapped).forEach(dateStr => {
    const list = mapped[dateStr].sort((a, b) => a.start.localeCompare(b.start));
    const merged: MappedStressEvent[] = [];
    
    list.forEach(event => {
      if (merged.length === 0) {
        merged.push(event);
      } else {
        const last = merged[merged.length - 1];
        const lastEndMs = new Date(last.end).getTime();
        const eventStartMs = new Date(event.start).getTime();
        
        if (eventStartMs <= lastEndMs) {
          const eventEndMs = new Date(event.end).getTime();
          if (eventEndMs > lastEndMs) {
            last.end = event.end;
          }
          last.hr_peak = Math.max(last.hr_peak, event.hr_peak);
          const severityOrder = { "low": 1, "medium": 2, "high": 3 };
          if (severityOrder[event.severity] > severityOrder[last.severity]) {
            last.severity = event.severity;
          }
        } else {
          merged.push(event);
        }
      }
    });

    result[dateStr] = merged;
  });

  return result;
}

/**
 * 4. buildSpo2Nocturnal: groups intraday SpO2 readings by date, or falls back to daily.
 */
export function buildSpo2Nocturnal(
  intraday: SpO2RawPoint[],
  daily: SpO2RawPoint[]
): {
  spo2Grouped: Record<string, SpO2Reading[]>;
  isSpO2Fallback: boolean;
} {
  const spo2Grouped: Record<string, SpO2Reading[]> = {};
  let isSpO2Fallback = false;

  if (intraday && intraday.length > 0) {
    intraday.forEach((d) => {
      const dateStr = d.timestamp.split("T")[0];
      const timeStr = d.timestamp.substring(11, 16);
      if (!spo2Grouped[dateStr]) {
        spo2Grouped[dateStr] = [];
      }
      spo2Grouped[dateStr].push({
        time: timeStr,
        value: typeof d.value === "number" ? d.value : parseFloat(d.value as string),
      });
    });
  } else if (daily && daily.length > 0) {
    isSpO2Fallback = true;
    daily.forEach((d) => {
      const dateStr = d.timestamp.split("T")[0];
      spo2Grouped[dateStr] = [{
        time: "Daily Avg",
        value: typeof d.value === "number" ? d.value : parseFloat(d.value as string),
      }];
    });
  } else {
    return { spo2Grouped: {}, isSpO2Fallback: false };
  }

  Object.keys(spo2Grouped).forEach((dateKey) => {
    spo2Grouped[dateKey].sort((a, b) => a.time.localeCompare(b.time));
  });

  return { spo2Grouped, isSpO2Fallback };
}

export function computeStrainFromZones(
  heartRateData: { timestamp: string; value: number | string }[],
  maxHR: number = 185
): number {
  if (!heartRateData || heartRateData.length === 0) return 0;
  
  const sorted = [...heartRateData].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  
  let zone4Minutes = 0;
  let zone5Minutes = 0;
  
  for (let i = 0; i < sorted.length; i++) {
    const d = sorted[i];
    const val = typeof d.value === "number" ? d.value : parseFloat(d.value as string);
    if (isNaN(val)) continue;
    
    const pct = (val / maxHR) * 100;
    
    let durationMins = 0.25;
    if (i < sorted.length - 1) {
      const currentMs = new Date(d.timestamp).getTime();
      const nextMs = new Date(sorted[i + 1].timestamp).getTime();
      const diffMs = nextMs - currentMs;
      if (diffMs > 0 && diffMs < 5 * 60 * 1000) {
        durationMins = diffMs / (1000 * 60);
      }
    }
    
    if (pct > 80 && pct <= 90) {
      zone4Minutes += durationMins;
    } else if (pct > 90) {
      zone5Minutes += durationMins;
    }
  }
  
  const score = zone4Minutes * 0.15 + zone5Minutes * 0.4;
  return Math.round(Math.min(21, score) * 10) / 10;
}

