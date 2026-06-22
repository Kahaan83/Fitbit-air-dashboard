import { useDashboardStore } from "./store";
import * as mock from "./mockData";
import { useMemo } from "react";
import {
  calculateRecoveryScore,
  buildSleepDebtSeries,
  mapAcuteStress,
  buildSpo2Nocturnal
} from "./transforms";

export function useChartData() {
  const { dataMode, liveData, previousLiveData, isLoadingLiveData, settings } = useDashboardStore();

  const displayLiveData = (dataMode === "live" && isLoadingLiveData)
    ? (previousLiveData ?? liveData)
    : liveData;

  if (dataMode === "sample" || !displayLiveData) {
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
  const rawHrv = displayLiveData.hrv || [];
  const hrvMapped = rawHrv.map((d: any) => ({
    date: d.timestamp.split("T")[0],
    value: typeof d.value === "number" ? d.value : parseFloat(d.value),
  })).sort((a: any, b: any) => a.date.localeCompare(b.date));

  // 2. ANS Balance: backend returns sympathetic/parasympathetic/rmssd (not lf/hf)
  const ansRaw = displayLiveData.derived?.ans_balance;
  const ansList = Array.isArray(ansRaw) ? ansRaw : (ansRaw?.data || []);
  const ansMapped = ansList.map((d: any) => ({
    date: d.date,
    sympathetic: d.sympathetic,
    parasympathetic: d.parasympathetic,
    rmssd: d.rmssd,
    // Compute lf_hf_ratio proxy from sympathetic/parasympathetic for RecoveryPage
    lf_hf_ratio: d.parasympathetic > 0 ? Math.round((d.sympathetic / d.parasympathetic) * 100) / 100 : 0,
  })).sort((a: any, b: any) => a.date.localeCompare(b.date));

  // 3. Skin Temp (DAILY_SLEEP_TEMPERATURE_DERIVATIONS)
  const tempMapped = (displayLiveData.sleep_temp || []).map((d: any) => ({
    date: d.timestamp.split("T")[0],
    value: typeof d.value === "number" ? d.value : parseFloat(d.value),
  })).sort((a: any, b: any) => a.date.localeCompare(b.date));

  // 4. Sleep Debt: dynamically build sleep debt series client-side using transforms
  const sleepDebtMapped = buildSleepDebtSeries(displayLiveData.sleep || [], settings.targetSleepHours);

  // 5. VO2 Max: Already computed on backend (safely handling list or single value)
  const vo2MaxRaw = displayLiveData.derived?.vo2_max;
  const vo2MaxList = Array.isArray(vo2MaxRaw) ? vo2MaxRaw : [];
  const vo2MaxMapped = vo2MaxList.map((d: any) => ({
    date: d.date,
    vo2_max: d.vo2_max,
  })).sort((a: any, b: any) => a.date.localeCompare(b.date));

  // 6. Acute Stress Events: map using mapAcuteStress and flatten
  const stressRaw = displayLiveData.derived?.acute_stress;
  const stressList = Array.isArray(stressRaw) ? stressRaw : [];
  const stressMapped = Object.values(mapAcuteStress(stressList)).flat();

  // 7. Nocturnal SpO2
  const { spo2Grouped, isSpO2Fallback } = buildSpo2Nocturnal(displayLiveData.spo2 || [], displayLiveData.daily_spo2 || []);

  // ── Derived analytics for live mode ─────────────────────────────────────────

  // Resolve final hrv array (live or mock fallback)
  const hrvFinal: mock.HRVData[] = hrvMapped;

  // 1. hrvRolling7: rolling 7-day average RMSSD
  const last7Hrv = hrvFinal.slice(-7);
  const hrvRolling7 = last7Hrv.length >= 7
    ? Math.round((last7Hrv.reduce((s, d) => s + d.value, 0) / 7) * 10) / 10
    : 0;

  // 3. peakHRToday: max heart rate from today's live readings
  const todayStr = new Date().toISOString().slice(0, 10);
  const rawHR = displayLiveData.heart_rate || [];
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

  // 2. recoveryScore: calculate score incorporating HRV, RHR and sleep efficiency
  const recoveryScore = calculateRecoveryScore(hrvMapped, settings.restingHR, sleepEfficiency);

  // 5. remPct: REM % from most recent live sleep session
  const liveSleep = displayLiveData.sleep || [];
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
  const rawSteps = displayLiveData.steps || [];
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
