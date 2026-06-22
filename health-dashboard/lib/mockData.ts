// lib/mockData.ts
// Generates 30 days of realistic, clinically plausible physiological mock data.
// Based on a moderately active 28-year-old male, RHR 58, Max HR 185.
// Uses a deterministic pseudo-random generator to prevent Next.js hydration mismatches.

export interface HRVData {
  date: string;
  value: number; // RMSSD in ms
}

export interface ANSData {
  date: string;
  lf_power: number;
  hf_power: number;
  lf_hf_ratio: number;
  sympathetic: number;
  parasympathetic: number;
  rmssd: number;
}

export interface SpO2Reading {
  time: string; // HH:MM
  value: number; // SpO2%
}

export interface SkinTempData {
  date: string;
  value: number; // Deviation in °C
}

export interface SleepDebtData {
  date: string;
  actual_hours: number;
  target_hours: number;
  debt_hours: number;
}

export interface VO2MaxData {
  date: string;
  vo2_max: number;
}

export interface AcuteStressEvent {
  id: string;
  start: string; // ISO 8601
  end: string;   // ISO 8601
  hr_peak: number;
  severity: "low" | "medium" | "high";
  date: string; // YYYY-MM-DD for grouping
}

// Deterministic pseudo-random generator based on a seed number.
// Returns a value between 0 (inclusive) and 1 (exclusive).
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Generate the list of dates for the last 30 days (always relative to today)
export const getPastDates = (numDays = 30): string[] => {
  const dates: string[] = [];
  // Use a fixed offset from today so dates are always recent
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
};

// Anchor date for stress events (used for absolute timestamps)
const ANCHOR_DATE = new Date();
ANCHOR_DATE.setUTCHours(0, 0, 0, 0);

const dates = getPastDates(30);

// 1. HRV Trend Data (RMSSD 28 - 72 ms)
// Week 2 corresponds to dates index 7 to 13. Dips below 35 ms.
export const mockHRV: HRVData[] = dates.map((date, idx) => {
  const rand = seededRandom(idx + 1);
  let value = 50 + Math.sin(idx * 0.8) * 12 + (rand - 0.5) * 6;
  // Week 2 dip
  if (idx >= 7 && idx <= 13) {
    const randDip = seededRandom(idx + 50);
    value = 32 + (randDip - 0.5) * 4; // Dip below 35
  }
  return { date, value: Math.round(value * 10) / 10 };
});

// 2. ANS Balance (LF/HF ratio 0.8 - 2.4, inversely correlated with HRV)
export const mockANSBalance: ANSData[] = dates.map((date, idx) => {
  const hrvObj = mockHRV[idx];
  const rand = seededRandom(idx + 100);
  const randPower = seededRandom(idx + 150);
  
  // Inverse relationship: lower HRV (high stress) = higher LF/HF ratio
  let lf_hf_ratio = 1.4 - (hrvObj.value - 50) * 0.025 + (rand - 0.5) * 0.25;
  if (idx >= 7 && idx <= 13) {
    const randStress = seededRandom(idx + 200);
    lf_hf_ratio = 2.15 + (randStress - 0.5) * 0.2; // Dips in HRV lead to ratio > 2.0
  }
  // Clamp values
  lf_hf_ratio = Math.max(0.6, Math.min(2.8, lf_hf_ratio));
  const hf_power = 200 + (hrvObj.value * hrvObj.value) * 0.15 + (randPower - 0.5) * 50;
  const lf_power = hf_power * lf_hf_ratio;
  // Derive sympathetic/parasympathetic proxy from RMSSD (matching backend formula)
  const parasympathetic = Math.min(100, Math.max(0, (hrvObj.value - 20) / 60 * 100));
  const sympathetic = 100 - parasympathetic;

  return {
    date,
    lf_power: Math.round(lf_power),
    hf_power: Math.round(hf_power),
    lf_hf_ratio: Math.round(lf_hf_ratio * 100) / 100,
    sympathetic: Math.round(sympathetic * 10) / 10,
    parasympathetic: Math.round(parasympathetic * 10) / 10,
    rmssd: Math.round(hrvObj.value * 10) / 10,
  };
});

// 3. Nocturnal SpO2 readings (5-min intervals for 8 hours of sleep: 22:00 to 06:00 = 96 readings)
export const generateNocturnalSpO2 = (date: string, idx: number): SpO2Reading[] => {
  const readings: SpO2Reading[] = [];
  const startHour = 22;
  const totalMinutes = 8 * 60; // 8 hours
  const isDipNight = idx % 3 === 0; // approx 2-3 nights per week (e.g. index 0, 3, 6, 9, 12, ...)
  
  for (let m = 0; m <= totalMinutes; m += 5) {
    const curMin = (startHour * 60 + m) % (24 * 60);
    const h = Math.floor(curMin / 60);
    const mins = curMin % 60;
    const timeStr = `${h.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;

    // Base SpO2 level between 95% and 99%
    const rand = seededRandom(idx * 200 + m);
    let val = 97 + Math.sin(m * 0.015) * 1.5 + (rand - 0.5) * 1;
    
    // Introduce 1 or 2 quick hypoxemic dips if it's a dip night
    if (isDipNight) {
      if ((m >= 170 && m <= 190) || (m >= 310 && m <= 330)) {
        const center = m >= 170 && m <= 190 ? 180 : 320;
        const dist = Math.abs(m - center); // 0 at peak of dip
        const dipAmount = 7 - (dist * 0.35); // Max dip of 7%
        val -= Math.max(0, dipAmount);
      }
    }
    
    val = Math.max(85, Math.min(100, val));
    readings.push({
      time: timeStr,
      value: Math.round(val * 10) / 10,
    });
  }
  return readings;
};

export const mockSpO2Nocturnal: Record<string, SpO2Reading[]> = dates.reduce(
  (acc, date, idx) => {
    acc[date] = generateNocturnalSpO2(date, idx);
    return acc;
  },
  {} as Record<string, SpO2Reading[]>
);

// 4. Daily sleep temperature deviation (-0.6°C to +0.8°C), spike +1.1°C in week 2
export const mockSkinTemp: SkinTempData[] = dates.map((date, idx) => {
  const rand = seededRandom(idx + 300);
  let value = 0.1 * Math.sin(idx * 0.5) + (rand - 0.5) * 0.3;
  if (idx >= 9 && idx <= 11) {
    const randSpike = seededRandom(idx + 350);
    value = 1.05 + (randSpike - 0.5) * 0.15; // Spike in week 2
  }
  return { date, value: Math.round(value * 100) / 100 };
});

// 5. Sleep debt: nightly actual vs 8-hour target
export const mockSleepDebt: SleepDebtData[] = dates.map((date, idx) => {
  const target_hours = 8.0;
  const rand = seededRandom(idx + 400);
  // Sleep dips during stress week
  let actual_hours = 7.5 + Math.sin(idx * 0.6) * 0.8 + (rand - 0.5) * 0.5;
  if (idx >= 7 && idx <= 13) {
    const randDebt = seededRandom(idx + 450);
    actual_hours = 6.0 + (randDebt - 0.5) * 0.6; // High deficit during stress week
  }
  actual_hours = Math.max(4.0, Math.min(10.0, Math.round(actual_hours * 10) / 10));
  const debt_hours = Math.round((target_hours - actual_hours) * 10) / 10;
  return {
    date,
    actual_hours,
    target_hours,
    debt_hours,
  };
});

// 6. VO2 Max trend (46 - 52, slowly trending upward)
export const mockVO2Max: VO2MaxData[] = dates.map((date, idx) => {
  const baseVal = 47.2;
  const progression = idx * 0.14; // Gradual improvement
  const rand = seededRandom(idx + 500);
  const dailyVariance = (rand - 0.5) * 0.15;
  return {
    date,
    vo2_max: Math.round((baseVal + progression + dailyVariance) * 100) / 100,
  };
});

// 7. Acute Stress Events (Zero steps + HR spikes, clustered in week 2)
const generateStressEvents = (): AcuteStressEvent[] => {
  const events: AcuteStressEvent[] = [];
  const baseDate = new Date(ANCHOR_DATE);
  
  // Define days to seed events (index out of 30)
  const stressDays = [
    { idx: 2, hr: 82, sev: "low" as const, startH: 14, lenMin: 15 },
    { idx: 5, hr: 88, sev: "medium" as const, startH: 10, lenMin: 20 },
    // Week 2 cluster (severe)
    { idx: 8, hr: 101, sev: "high" as const, startH: 9, lenMin: 30 },
    { idx: 9, hr: 94, sev: "medium" as const, startH: 11, lenMin: 25 },
    { idx: 9, hr: 105, sev: "high" as const, startH: 15, lenMin: 40 },
    { idx: 10, hr: 89, sev: "medium" as const, startH: 16, lenMin: 15 },
    { idx: 12, hr: 99, sev: "high" as const, startH: 14, lenMin: 35 },
    { idx: 13, hr: 84, sev: "low" as const, startH: 10, lenMin: 20 },
    // Rest of month
    { idx: 18, hr: 83, sev: "low" as const, startH: 11, lenMin: 15 },
    { idx: 22, hr: 91, sev: "medium" as const, startH: 13, lenMin: 20 },
    { idx: 27, hr: 85, sev: "low" as const, startH: 15, lenMin: 15 },
  ];

  stressDays.forEach(({ idx, hr, sev, startH, lenMin }, count) => {
    const eventDate = dates[idx];
    const sDate = new Date(baseDate);
    sDate.setUTCDate(baseDate.getUTCDate() - (29 - idx));
    sDate.setUTCHours(startH, 0, 0, 0);
    
    const eDate = new Date(sDate);
    eDate.setUTCMinutes(eDate.getUTCMinutes() + lenMin);
    
    events.push({
      id: `stress-${count}`,
      start: sDate.toISOString(),
      end: eDate.toISOString(),
      hr_peak: hr,
      severity: sev,
      date: eventDate,
    });
  });

  return events;
};

export const mockAcuteStress = generateStressEvents();

// ── Sample-mode analytics constants ───────────────────────────────────────────
// These are realistic pre-computed values shown in sample mode.

// Rolling 7-day average HRV (RMSSD) from the most recent 7 days of mock data
export const mockHRVRolling7: number = (() => {
  const last7 = mockHRV.slice(-7);
  if (last7.length < 7) return 0;
  return Math.round((last7.reduce((s, d) => s + d.value, 0) / 7) * 10) / 10;
})();

// Recovery score: clamp((latestHRV / avg30HRV) * 50 + 25, 0, 100)
export const mockRecoveryScore: number = (() => {
  const avg30 = mockHRV.reduce((s, d) => s + d.value, 0) / mockHRV.length;
  const latest = mockHRV[mockHRV.length - 1]?.value ?? 0;
  return Math.round(Math.max(0, Math.min(100, (latest / avg30) * 50 + 25)));
})();

// Peak heart rate today — sample mode uses a plausible intraday peak
export const mockPeakHRToday: number = 118;

// Sleep efficiency for the most recent night
// actual_hours / (actual_hours + 0.5) * 100
export const mockSleepEfficiency: number = (() => {
  const last = mockSleepDebt[mockSleepDebt.length - 1];
  if (!last) return 0;
  return Math.round((last.actual_hours / (last.actual_hours + 0.5)) * 100 * 10) / 10;
})();

// REM percentage in sample mode (typical healthy adult ~20-25%)
export const mockRemPct: number = 24.3;

// Step goal hit rate: % of days in mock set with >= 10000 steps (sample mode)
export const mockStepGoalHitRate: number = 63;

// Consecutive good-sleep streak: nights with actual_hours >= 7, going back from most recent
export const mockGoodSleepStreak: number = (() => {
  let streak = 0;
  for (let i = mockSleepDebt.length - 1; i >= 0; i--) {
    if (mockSleepDebt[i].actual_hours >= 7) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
})();

// Average deep sleep across sessions (sample fallback)
export const mockAvgDeepSleep: number = 72;

// 8. Raw Steps Data
export interface StepsDataPoint {
  timestamp: string;
  value: number;
  data_type: "steps";
}

export const mockStepsData: StepsDataPoint[] = dates.map((date, idx) => {
  const rand = seededRandom(idx + 600);
  const steps = Math.round(6000 + rand * 6000);
  return {
    timestamp: `${date}T18:00:00Z`,
    value: steps,
    data_type: "steps",
  };
});

// 9. Sleep Sessions Data
export interface SleepSessionDataPoint {
  timestamp: string;
  value: {
    total_sleep_minutes: number;
    stages: {
      rem: number;
      deep: number;
      light: number;
      awake: number;
    };
  };
  data_type: "sleep";
}

export const mockSleepData: SleepSessionDataPoint[] = dates.map((date, idx) => {
  const sleepDebtObj = mockSleepDebt[idx];
  const total_sleep_minutes = sleepDebtObj.actual_hours * 60;
  
  const rand = seededRandom(idx + 700);
  const remPct = 0.20 + rand * 0.05;
  const deepPct = 0.15 + (1 - rand) * 0.06;
  const awakePct = 0.08 + rand * 0.04;
  const lightPct = 1 - remPct - deepPct - awakePct;

  const rem = Math.round(total_sleep_minutes * remPct);
  const deep = Math.round(total_sleep_minutes * deepPct);
  const awake = Math.round(total_sleep_minutes * awakePct);
  const light = Math.round(total_sleep_minutes * lightPct);

  return {
    timestamp: `${date}T08:00:00Z`,
    value: {
      total_sleep_minutes: Math.round(total_sleep_minutes),
      stages: {
        rem,
        deep,
        light,
        awake,
      },
    },
    data_type: "sleep",
  };
});

// 10. Heart Rate Zones & Readings Data
export interface HeartRateReading {
  timestamp: string;
  value: number;
  data_type: "heart_rate";
  zone?: string;
}

export const mockHeartRateZones: HeartRateReading[] = [];
(() => {
  const anchorDateStr = dates[dates.length - 1]; // today
  for (let idx = 0; idx < 96; idx++) {
    const totalMins = idx * 15;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    const timestamp = `${anchorDateStr}T${timeStr}:00Z`;

    const rand = seededRandom(idx + 800);
    let bpm = Math.round(55 + rand * 8);
    let zone = "Zone 1";

    if (idx >= 68 && idx <= 72) {
      const exerciseRand = seededRandom(idx + 850);
      bpm = Math.round(110 + exerciseRand * 50);
      const pct = (bpm / 185) * 100;
      if (pct > 85) zone = "Zone 5";
      else if (pct > 70) zone = "Zone 4";
      else if (pct > 60) zone = "Zone 3";
      else if (pct > 50) zone = "Zone 2";
    }

    mockHeartRateZones.push({
      timestamp,
      value: bpm,
      data_type: "heart_rate",
      zone,
    });
  }
})();

// 11. Stress Events
export const mockStressEvents = mockAcuteStress;

