import { describe, it, expect } from "vitest";
import {
  calculateRecoveryScore,
  buildSleepDebtSeries,
  mapAcuteStress,
  buildSpo2Nocturnal,
  SleepDataPoint,
  RawStressEvent,
  SpO2RawPoint,
} from "../transforms";

describe("Transforms Tests", () => {
  describe("calculateRecoveryScore", () => {
    it("returns around 75 when all inputs are at baseline", () => {
      const hrv = [{ value: 50 }, { value: 50 }]; // baseline avg is 50, latest is 50 (ratio = 1)
      const rhr = 58; // baseline RHR
      const sleepEfficiency = 85; // baseline efficiency
      const score = calculateRecoveryScore(hrv, rhr, sleepEfficiency);
      // ratio * 50 + 25 = 75, rhr diff = 0, eff diff = 0
      expect(score).toBe(75);
    });

    it("returns less than 50 when HRV is below threshold", () => {
      const hrv = [{ value: 50 }, { value: 20 }]; // latest is 20, avg is 35 (ratio = 20/35 = 0.57)
      // 0.57 * 50 + 25 = 53.5. Let's make average 50 and latest 15: ratio = 0.3.
      // 0.3 * 50 + 25 = 40.
      const hrvBelow = [{ value: 50 }, { value: 50 }, { value: 50 }, { value: 15 }];
      const rhr = 58;
      const sleepEfficiency = 85;
      const score = calculateRecoveryScore(hrvBelow, rhr, sleepEfficiency);
      expect(score).toBeLessThan(50);
    });

    it("falls back to RHR-only score if HRV is missing", () => {
      const hrv: { value: number }[] = [];
      const rhr = 68; // 10 bpm above baseline 58 -> fallbackScore = 75 - 10 * 1.5 = 60
      const sleepEfficiency = 85; // baseline
      const score = calculateRecoveryScore(hrv, rhr, sleepEfficiency);
      expect(score).toBe(60);
    });
  });

  describe("buildSleepDebtSeries", () => {
    it("returns empty array for empty input", () => {
      expect(buildSleepDebtSeries([])).toEqual([]);
    });

    it("returns 0 debt for all nights at target", () => {
      const sleepData: SleepDataPoint[] = [
        { timestamp: "2026-06-01T08:00:00Z", value: { total_sleep_minutes: 480 } },
        { timestamp: "2026-06-02T08:00:00Z", value: { total_sleep_minutes: 480 } },
      ];
      const series = buildSleepDebtSeries(sleepData, 8.0);
      expect(series).toHaveLength(2);
      expect(series[0].debt_hours).toBe(0);
      expect(series[1].debt_hours).toBe(0);
    });

    it("accumulates debt for short nights and reduces for long nights", () => {
      const sleepData: SleepDataPoint[] = [
        { timestamp: "2026-06-01T08:00:00Z", value: { total_sleep_minutes: 360 } }, // 6 hours (debt +2)
        { timestamp: "2026-06-02T08:00:00Z", value: { total_sleep_minutes: 540 } }, // 9 hours (debt -1, cumulative +1)
      ];
      const series = buildSleepDebtSeries(sleepData, 8.0);
      expect(series).toHaveLength(2);
      expect(series[0].debt_hours).toBe(2);
      expect(series[1].debt_hours).toBe(1);
    });
  });

  describe("mapAcuteStress", () => {
    it("returns empty object for empty input", () => {
      expect(mapAcuteStress([])).toEqual({});
    });

    it("buckets UTC midnight events to the correct local date using timezone offset", () => {
      // Event starting at UTC 2026-06-02T00:30:00Z
      const events: RawStressEvent[] = [
        {
          start: "2026-06-02T00:30:00Z",
          end: "2026-06-02T00:45:00Z",
          hr_peak: 95,
          severity: "medium",
        },
      ];
      // Timezone offset +120 minutes (e.g. UTC+2 is offset -120, offset +120 shifts start time backward into 2026-06-01)
      const mapped = mapAcuteStress(events, 120);
      expect(mapped["2026-06-01"]).toBeDefined();
      expect(mapped["2026-06-01"]).toHaveLength(1);
    });

    it("merges overlapping events so they are not double-counted", () => {
      const events: RawStressEvent[] = [
        {
          start: "2026-06-02T10:00:00Z",
          end: "2026-06-02T10:30:00Z",
          hr_peak: 90,
          severity: "medium",
        },
        {
          start: "2026-06-02T10:15:00Z",
          end: "2026-06-02T10:45:00Z",
          hr_peak: 110,
          severity: "high",
        },
      ];
      const mapped = mapAcuteStress(events, 0);
      const dayEvents = mapped["2026-06-02"];
      expect(dayEvents).toHaveLength(1); // Merged into 1 event
      expect(dayEvents[0].hr_peak).toBe(110);
      expect(dayEvents[0].severity).toBe("high");
      expect(dayEvents[0].start).toBe("2026-06-02T10:00:00Z");
      expect(dayEvents[0].end).toBe("2026-06-02T10:45:00Z");
    });
  });

  describe("buildSpo2Nocturnal", () => {
    it("returns empty object/fallback false when both lists are empty", () => {
      expect(buildSpo2Nocturnal([], [])).toEqual({
        spo2Grouped: {},
        isSpO2Fallback: false,
      });
    });

    it("uses intraday when non-empty", () => {
      const intraday: SpO2RawPoint[] = [
        { timestamp: "2026-06-02T02:00:00Z", value: 95.0 },
        { timestamp: "2026-06-02T03:00:00Z", value: "96.5" },
      ];
      const daily: SpO2RawPoint[] = [
        { timestamp: "2026-06-02T12:00:00Z", value: 97.0 },
      ];
      const result = buildSpo2Nocturnal(intraday, daily);
      expect(result.isSpO2Fallback).toBe(false);
      expect(result.spo2Grouped["2026-06-02"]).toHaveLength(2);
      expect(result.spo2Grouped["2026-06-02"][0].value).toBe(95.0);
      expect(result.spo2Grouped["2026-06-02"][1].value).toBe(96.5);
    });

    it("falls back to daily when intraday is empty", () => {
      const daily: SpO2RawPoint[] = [
        { timestamp: "2026-06-02T12:00:00Z", value: "97.2" },
      ];
      const result = buildSpo2Nocturnal([], daily);
      expect(result.isSpO2Fallback).toBe(true);
      expect(result.spo2Grouped["2026-06-02"]).toHaveLength(1);
      expect(result.spo2Grouped["2026-06-02"][0].time).toBe("Daily Avg");
      expect(result.spo2Grouped["2026-06-02"][0].value).toBe(97.2);
    });
  });
});
