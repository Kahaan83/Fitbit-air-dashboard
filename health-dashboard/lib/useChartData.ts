import { useDashboardStore } from "./store";
import * as mock from "./mockData";
import { useMemo } from "react";

export function useChartData() {
  const { dataMode, liveData } = useDashboardStore();

  if (dataMode === "sample" || !liveData) {
    return {
      hrv: mock.mockHRV,
      ansBalance: mock.mockANSBalance,
      spo2Nocturnal: mock.mockSpO2Nocturnal,
      isSpO2Fallback: false,
      skinTemp: mock.mockSkinTemp,
      sleepDebt: mock.mockSleepDebt,
      vo2Max: mock.mockVO2Max,
      acuteStress: mock.mockAcuteStress,
      // Analytics
      hrvRolling7: mock.mockHRVRolling7,
      recoveryScore: mock.mockRecoveryScore,
      peakHRToday: mock.mockPeakHRToday,
      sleepEfficiency: mock.mockSleepEfficiency,
      remPct: mock.mockRemPct,
      stepGoalHitRate: mock.mockStepGoalHitRate,
      goodSleepStreak: mock.mockGoodSleepStreak,
      avgDeepSleep: mock.mockAvgDeepSleep,
    };
  }

  // --- Map Live Data from FastAPI Gateway ---
  // 1. HRV: Live data uses DAILY_HEART_RATE_VARIABILITY rollups or raw hrv
  // Fallback to daily_hrv or calculate from hrv series if present.
  const rawHrv = liveData.hrv || [];
  const hrvMapped = rawHrv.map((d: any) => ({
    date: d.timestamp.split("T")[0],
    value: typeof d.value === "number" ? d.value : parseFloat(d.value),
  })).sort((a: any, b: any) => a.date.localeCompare(b.date));

  // 2. ANS Balance: Already computed on backend (safely handling list or dict format)
  const ansRaw = liveData.derived?.ans_balance;
  const ansList = Array.isArray(ansRaw) ? ansRaw : (ansRaw?.data || []);
  const ansMapped = ansList.map((d: any) => ({
    date: d.date,
    lf_power: d.lf_power,
    hf_power: d.hf_power,
    lf_hf_ratio: d.lf_hf_ratio,
  })).sort((a: any, b: any) => a.date.localeCompare(b.date));

  // 3. Skin Temp (DAILY_SLEEP_TEMPERATURE_DERIVATIONS)
  const tempMapped = (liveData.sleep_temp || []).map((d: any) => ({
    date: d.timestamp.split("T")[0],
    value: typeof d.value === "number" ? d.value : parseFloat(d.value),
  })).sort((a: any, b: any) => a.date.localeCompare(b.date));

  // 4. Sleep Debt: Already computed on backend (safely handling list or single value)
  const sleepDebtRaw = liveData.derived?.sleep_debt;
  const sleepDebtList = Array.isArray(sleepDebtRaw) ? sleepDebtRaw : [];
  const sleepDebtMapped = sleepDebtList.map((d: any) => ({
    date: d.date,
    actual_hours: d.actual_hours,
    target_hours: d.target_hours,
    debt_hours: d.debt_hours,
  })).sort((a: any, b: any) => a.date.localeCompare(b.date));

  // 5. VO2 Max: Already computed on backend (safely handling list or single value)
  const vo2MaxRaw = liveData.derived?.vo2_max;
  const vo2MaxList = Array.isArray(vo2MaxRaw) ? vo2MaxRaw : [];
  const vo2MaxMapped = vo2MaxList.map((d: any) => ({
    date: d.date,
    vo2_max: d.vo2_max,
  })).sort((a: any, b: any) => a.date.localeCompare(b.date));

  // 6. Acute Stress Events: Already computed on backend (safely handling list fallback)
  const stressRaw = liveData.derived?.acute_stress;
  const stressList = Array.isArray(stressRaw) ? stressRaw : [];
  const stressMapped = stressList.map((d: any, idx: number) => ({
    id: `live-stress-${idx}`,
    start: d.start,
    end: d.end,
    hr_peak: d.hr_peak,
    severity: d.severity,
    date: new Date(d.start).toLocaleDateString("en-CA"),
  }));

  // 7. Nocturnal SpO2 (Group 5-minute resolution oxygen saturation values by date)
  // Live data returns raw OXYGEN_SATURATION measurements during sleep/nocturnal hours.
  const rawSpo2 = liveData.spo2 || [];
  const spo2Grouped: Record<string, mock.SpO2Reading[]> = {};
  let isSpO2Fallback = false;

  if (rawSpo2.length > 0) {
    rawSpo2.forEach((d: any) => {
      const dateStr = d.timestamp.split("T")[0];
      const timeStr = d.timestamp.substring(11, 16); // Extract HH:MM
      if (!spo2Grouped[dateStr]) {
        spo2Grouped[dateStr] = [];
      }
      spo2Grouped[dateStr].push({
        time: timeStr,
        value: typeof d.value === "number" ? d.value : parseFloat(d.value),
      });
    });
  } else {
    // Fall back to daily_spo2 if raw SpO2 is empty
    const dailySpo2 = liveData.daily_spo2 || [];
    if (dailySpo2.length > 0) {
      isSpO2Fallback = true;
      dailySpo2.forEach((d: any) => {
        const dateStr = d.timestamp.split("T")[0];
        spo2Grouped[dateStr] = [{
          time: "Daily Avg",
          value: typeof d.value === "number" ? d.value : parseFloat(d.value),
        }];
      });
    }
  }

  // Ensure each night's readings are chronologically sorted
  Object.keys(spo2Grouped).forEach((dateKey) => {
    spo2Grouped[dateKey].sort((a, b) => a.time.localeCompare(b.time));
  });

  // ── Derived analytics for live mode ─────────────────────────────────────────

  // Resolve final hrv array (live or mock fallback)
  const hrvFinal: mock.HRVData[] = hrvMapped;

  // 1. hrvRolling7: rolling 7-day average RMSSD
  const last7Hrv = hrvFinal.slice(-7);
  const hrvRolling7 = last7Hrv.length >= 7
    ? Math.round((last7Hrv.reduce((s, d) => s + d.value, 0) / 7) * 10) / 10
    : 0;

  // 2. recoveryScore: clamp((latestHRV / avg30HRV) * 50 + 25, 0, 100)
  const avg30HRV = hrvFinal.length > 0
    ? hrvFinal.reduce((s, d) => s + d.value, 0) / hrvFinal.length
    : 1;
  const latestHRV = hrvFinal[hrvFinal.length - 1]?.value ?? 0;
  const recoveryScore = Math.round(Math.max(0, Math.min(100, (latestHRV / avg30HRV) * 50 + 25)));

  // 3. peakHRToday: max heart rate from today's live readings
  const todayStr = new Date().toISOString().slice(0, 10);
  const rawHR = liveData.heart_rate || [];
  const todayHR = rawHR
    .filter((d: any) => (d.timestamp || "").startsWith(todayStr))
    .map((d: any) => typeof d.value === "number" ? d.value : parseFloat(d.value));
  const peakHRToday = todayHR.length > 0 ? Math.max(...todayHR) : 0;

  // 4. sleepEfficiency: most recent night's actual_hours / (actual_hours + 0.5) * 100
  const sleepDebtFinal = sleepDebtMapped;
  const lastSleepDebt = sleepDebtFinal[sleepDebtFinal.length - 1];
  const sleepEfficiency = lastSleepDebt
    ? Math.round((lastSleepDebt.actual_hours / (lastSleepDebt.actual_hours + 0.5)) * 100 * 10) / 10
    : 0;

  // 5. remPct: REM % from most recent live sleep session
  const liveSleep = liveData.sleep || [];
  let remPct = 0;
  if (liveSleep.length > 0) {
    const lastSession = liveSleep[liveSleep.length - 1];
    const stages = lastSession?.value?.stages ?? {};
    const total = lastSession?.value?.total_sleep_minutes ?? 0;
    if (total > 0 && stages.rem != null) {
      remPct = Math.round((stages.rem / total) * 100 * 10) / 10;
    }
  }

  // 6. stepGoalHitRate: % of days with >= 10000 steps
  const rawSteps = liveData.steps || [];
  let stepGoalHitRate = 0;
  if (rawSteps.length > 0) {
    const dailyStepMap: Record<string, number> = {};
    rawSteps.forEach((d: any) => {
      const day = (d.timestamp || "").slice(0, 10);
      if (day) dailyStepMap[day] = (dailyStepMap[day] ?? 0) + (d.value || 0);
    });
    const days = Object.values(dailyStepMap);
    if (days.length > 0) {
      stepGoalHitRate = Math.round((days.filter((v) => v >= 10000).length / days.length) * 100);
    }
  }

  // 7. goodSleepStreak: consecutive recent nights with actual_hours >= 7
  let goodSleepStreak = 0;
  for (let i = sleepDebtFinal.length - 1; i >= 0; i--) {
    if (sleepDebtFinal[i].actual_hours >= 7) {
      goodSleepStreak++;
    } else {
      break;
    }
  }

  // 8. avgDeepSleep: mean deep sleep minutes across all live sessions
  let avgDeepSleep = 0;
  if (liveSleep.length > 0) {
    const deepMins = liveSleep
      .map((s: any) => s?.value?.stages?.deep ?? null)
      .filter((v: number | null) => v != null) as number[];
    if (deepMins.length > 0) {
      avgDeepSleep = Math.round(deepMins.reduce((a, b) => a + b, 0) / deepMins.length);
    }
  }

  return {
    hrv: hrvMapped,
    ansBalance: ansMapped,
    spo2Nocturnal: spo2Grouped,
    isSpO2Fallback: isSpO2Fallback,
    skinTemp: tempMapped,
    sleepDebt: sleepDebtMapped,
    vo2Max: vo2MaxMapped,
    acuteStress: stressMapped,
    // Analytics
    hrvRolling7,
    recoveryScore,
    peakHRToday,
    sleepEfficiency,
    remPct,
    stepGoalHitRate,
    goodSleepStreak,
    avgDeepSleep,
  };
}
export type ChartData = ReturnType<typeof useChartData>;

