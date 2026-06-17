"use client";

import React, { useState, useRef, useEffect } from "react";
import { Info } from "lucide-react";

// ── Metric Knowledge Base ───────────────────────────────────────────────────────
export interface MetricDefinition {
  name: string;
  what: string;         // plain-English explanation
  good: string;         // what a good reading looks like
  concerning: string;   // what warrants attention
  tip: string;          // actionable tip
  goodColor: "emerald" | "sky" | "violet" | "indigo";
  badColor: "amber" | "red";
}

export const METRIC_INFO: Record<string, MetricDefinition> = {
  heart_rate: {
    name: "Heart Rate",
    what: "The number of times your heart beats per minute. Your heart rate reflects cardiac demand — it rises during exercise or stress and drops during rest and sleep.",
    good: "60–100 bpm at rest is normal. Athletes often see 40–60 bpm.",
    concerning: "Resting HR consistently above 100 bpm (tachycardia) or below 40 bpm (bradycardia) without athletic training.",
    tip: "Aerobic exercise, good sleep, and stress reduction all help lower resting heart rate over time.",
    goodColor: "emerald",
    badColor: "red",
  },
  hrv: {
    name: "Heart Rate Variability (HRV / RMSSD)",
    what: "HRV measures the millisecond variation between consecutive heartbeats. Paradoxically, more variation = better health. High HRV signals a well-recovered, parasympathetically dominant nervous system.",
    good: "50+ ms is considered good for most adults. Elite athletes often exceed 100 ms. Values are highly individual — trends matter more than absolute numbers.",
    concerning: "Sustained HRV below 20 ms, or a sudden multi-day drop of >15 ms from your personal baseline, can indicate overtraining, illness, or high stress.",
    tip: "HRV improves with consistent sleep, moderate aerobic training, meditation, and limiting alcohol.",
    goodColor: "violet",
    badColor: "amber",
  },
  spo2: {
    name: "Blood Oxygen Saturation (SpO₂)",
    what: "SpO₂ measures the percentage of haemoglobin in your blood that is carrying oxygen. It's measured optically through your skin by your wearable's green/red LEDs.",
    good: "95–100% is the normal healthy range. Most people sit between 96–99%.",
    concerning: "Below 95% warrants monitoring. Below 90% (hypoxemia) can impair organ function and requires medical attention. Sustained nocturnal dips below 90% may indicate sleep apnoea.",
    tip: "Altitude, sleep position, and device fit all affect SpO₂ accuracy. Ensure your band is snug but not tight.",
    goodColor: "sky",
    badColor: "red",
  },
  resting_hr: {
    name: "Resting Heart Rate",
    what: "Your resting heart rate (RHR) is the number of heartbeats per minute while completely at rest — typically measured just after waking. It's one of the most reliable long-term indicators of cardiovascular fitness.",
    good: "60–80 bpm is normal for adults. Highly fit individuals often achieve 40–60 bpm. Lower RHR generally = better cardiovascular efficiency.",
    concerning: "Above 100 bpm at rest is clinically defined as tachycardia. A sudden sustained rise of >10 bpm from your normal baseline can indicate illness, dehydration, or overtraining.",
    tip: "RHR decreases predictably with consistent aerobic training (e.g., running, cycling). Even 3–4 sessions/week show measurable improvement over months.",
    goodColor: "indigo",
    badColor: "amber",
  },
  skin_temp: {
    name: "Sleep Skin Temperature Deviation",
    what: "This metric shows how much your skin temperature deviated from your personal baseline during sleep. It's an early-warning signal — your body raises skin temperature to fight infection before other symptoms appear.",
    good: "Within ±0.5°C of your baseline is considered stable. Small positive deviations (+0.1 to +0.3°C) are normal for ovulation in women.",
    concerning: "A sustained elevation of +0.5°C or more for 2+ consecutive nights is associated with the onset of illness. Values > +1°C are a strong early illness signal.",
    tip: "Track trends, not single nights. A single elevated reading after alcohol or a hot shower is normal — a multi-day pattern is the signal to watch.",
    goodColor: "emerald",
    badColor: "amber",
  },
  steps: {
    name: "Steps Today",
    what: "Total step count accumulated today based on accelerometer data from your wearable. Steps are a proxy for overall physical activity level and non-exercise movement (NEAT).",
    good: "10,000 steps/day is the widely-used target. Research shows benefits plateau around 7,500–8,000 steps/day. Sedentary is generally considered < 5,000.",
    concerning: "Consistently below 5,000 steps/day is associated with increased cardiometabolic risk and poor health outcomes over time.",
    tip: "Aim for regular movement throughout the day — several short walks beat one long one for metabolic health (reduces sitting time).",
    goodColor: "emerald",
    badColor: "amber",
  },
  hrv_overview: {
    name: "Latest HRV (RMSSD)",
    what: "The most recent daily HRV measurement, computed as the root mean square of successive differences between heartbeats during sleep. This is your primary recovery readiness signal.",
    good: "50+ ms indicates good parasympathetic tone and recovery. Your personal baseline matters more than absolute numbers.",
    concerning: "A drop of 10–15 ms below your 7-day average suggests elevated physiological stress. Values below 20 ms are generally suppressed.",
    tip: "Check HRV every morning before activity. A 7-day rolling average gives a much cleaner signal than daily values.",
    goodColor: "violet",
    badColor: "amber",
  },
  vo2max: {
    name: "VO₂ Max (Cardiorespiratory Fitness)",
    what: "VO₂ Max is the maximum rate at which your body can consume oxygen during intense exercise. It is the gold standard metric for cardiorespiratory fitness and a strong predictor of longevity. Estimated from HR and activity data.",
    good: "Above 40 ml/kg/min is good for most adults. Elite endurance athletes reach 60–90 ml/kg/min. Higher is always better.",
    concerning: "Below 30 ml/kg/min for adults under 50 is considered low fitness. VO₂ Max naturally declines ~1% per year after age 25 without deliberate training.",
    tip: "High-intensity interval training (HIIT) is the most effective way to improve VO₂ Max. Even 2 sessions/week of vigorous exercise makes a measurable difference.",
    goodColor: "indigo",
    badColor: "red",
  },
  acute_stress: {
    name: "Detected Acute Stress Events",
    what: "Periods where your heart rate exceeded a personalized threshold (resting HR + ~50% of HR reserve), indicating sympathetic activation — fight-or-flight response. Detected from intraday HR data.",
    good: "0–6 acute stress events per 30 days is considered a balanced physiological load — exercise, exertion, and emotional reactions contribute.",
    concerning: "More than 6 events per month, especially without corresponding exercise, may indicate chronic psychological or physical stress overload.",
    tip: "Not all stress events are bad — exercise counts. The concern is frequent, unexplained spikes outside of workouts, which may indicate chronic stress.",
    goodColor: "emerald",
    badColor: "red",
  },
  lf_hf_ratio: {
    name: "Autonomic LF/HF Ratio",
    what: "The ratio of Low Frequency to High Frequency spectral power in heart rate variability. LF reflects mixed sympathetic/parasympathetic activity; HF reflects pure parasympathetic (vagal) tone. The ratio indicates sympatho-vagal balance.",
    good: "1.0–2.0 indicates balanced autonomic tone with healthy vagal dominance during rest and recovery.",
    concerning: "Above 2.0 suggests sympathetic dominance — the body is in a persistent stress or fight-or-flight state. Very low ratios (<0.5) can indicate extreme vagal dominance.",
    tip: "LF/HF normalizes with rest, quality sleep, and relaxation techniques such as slow breathing (4–7 breaths/min activates the vagus nerve).",
    goodColor: "indigo",
    badColor: "red",
  },
  sleep_temp_deviation: {
    name: "Sleep Skin Temperature Deviation",
    what: "Nightly deviation from your personal sleep temperature baseline. Google Fitbit devices measure wrist skin temperature during sleep and compare it to your individual baseline established over 28 days.",
    good: "±0.5°C from baseline is stable. Small positive shifts (+0.1 to +0.3°C) are normal day-to-day variation.",
    concerning: ">+0.5°C sustained across multiple nights is an early illness marker. >+1°C is a strong inflammatory signal. Women may see natural +0.2–0.3°C rises at ovulation.",
    tip: "Alcohol causes a false positive elevation on the night of consumption. Fever causes sustained multi-night elevation. Use the 3-day trend, not a single reading.",
    goodColor: "emerald",
    badColor: "amber",
  },
  sleep_duration: {
    name: "Average Sleep Duration",
    what: "The average total time spent asleep per night across all tracked nights. This includes all sleep stages (REM, light, deep) but excludes periods of wakefulness during the night.",
    good: "7–9 hours for adults. Most adults need 7.5–8.5 hours to function optimally. Teenagers need 8–10 hours.",
    concerning: "Consistently below 6 hours is strongly associated with metabolic dysfunction, immune suppression, and cognitive impairment. Above 10 hours may indicate illness or depression.",
    tip: "Sleep quality often matters more than duration — 7 hours with good deep/REM distribution can be better than 9 fragmented hours.",
    goodColor: "emerald",
    badColor: "red",
  },
  sleep_debt: {
    name: "Sleep Debt",
    what: "The cumulative deficit between your target sleep duration and actual sleep achieved. Sleep debt accumulates nightly and cannot be fully repaid with a single long sleep — it takes multiple recovery nights.",
    good: "Under 0.5 hours average debt. Ideally at or below your target (debt ≤ 0).",
    concerning: "Persistent debt above 1 hour/night is associated with impaired cognition, elevated cortisol, weight gain risk, and weakened immune function.",
    tip: "Prioritize consistent sleep timing over duration. Going to bed and waking at the same time (even weekends) dramatically improves sleep quality.",
    goodColor: "emerald",
    badColor: "red",
  },
  hypoxemia: {
    name: "Nocturnal Hypoxemia Events",
    what: "Nights where blood oxygen saturation dropped below 90% at any point during sleep. Transient SpO₂ dips during sleep can indicate breathing disturbances, sleep apnoea, or positional airway obstruction.",
    good: "Zero nights with SpO₂ dropping below 90%. All readings above 95% throughout sleep is ideal.",
    concerning: "Any sustained dip below 90% during sleep warrants attention. Frequent events (multiple nights per week) are a clinical concern for sleep apnoea.",
    tip: "Side sleeping reduces airway obstruction vs. back sleeping. If nocturnal dips persist, consult a sleep specialist — sleep apnoea is both underdiagnosed and highly treatable.",
    goodColor: "emerald",
    badColor: "red",
  },
  rem_sleep: {
    name: "REM Sleep",
    what: "Rapid Eye Movement (REM) sleep is the dreaming stage of sleep, crucial for emotional regulation, memory consolidation, and brain development.",
    good: "Typically 20% to 25% of total nightly sleep (around 1.5 to 2 hours for normal sleep).",
    concerning: "Consistently low REM sleep (< 10%) can impair cognitive function, focus, and mood stability.",
    tip: "Avoid alcohol, caffeine, and heavy meals near bedtime, as they severely suppress REM sleep.",
    goodColor: "violet",
    badColor: "red",
  },
  deep_sleep: {
    name: "Deep Sleep",
    what: "Deep sleep (slow-wave sleep) is the physically restorative stage where muscle growth, tissue repair, and immune system rejuvenation occur.",
    good: "Typically 15% to 20% of total nightly sleep (around 1 to 1.5 hours for most adults).",
    concerning: "Very low deep sleep (< 30 minutes) can leave you feeling chronically fatigued, physically sore, and reduce immune strength.",
    tip: "Maintain a cool bedroom (around 18°C / 65°F) and exercise regularly to naturally promote deeper sleep.",
    goodColor: "sky",
    badColor: "red",
  },
  awake_sleep: {
    name: "Sleep Wakefulness",
    what: "Periods of waking up briefly during the night. Some awake time (around 10-20 brief wake events) is completely normal and healthy.",
    good: "Less than 10% of time in bed spent awake (usually less than 30-45 minutes total).",
    concerning: "Frequent or prolonged awake periods (> 60 minutes) indicating sleep fragmentation or insomnia.",
    tip: "If you wake up and cannot fall back asleep for 20 minutes, get out of bed and do a quiet activity in dim light.",
    goodColor: "emerald",
    badColor: "amber",
  },
};

// ── Tooltip Component ───────────────────────────────────────────────────────────
interface MetricInfoProps {
  metricKey: string;
  size?: "sm" | "md";
}

export function MetricInfo({ metricKey, size = "sm" }: MetricInfoProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const def = METRIC_INFO[metricKey];

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Elevate parent stacking context when tooltip is open to prevent clipping by other cards
  useEffect(() => {
    if (!ref.current) return;
    
    let parent = ref.current.parentElement;
    while (parent) {
      // Find the closest card container: either a .glow-card or a card-like div
      if (
        parent.classList.contains("glow-card") ||
        parent.classList.contains("rounded-2xl") ||
        (parent.tagName === "DIV" && (parent.className.includes("border") || parent.className.includes("bg-slate")))
      ) {
        if (open) {
          parent.style.zIndex = "40";
          parent.style.position = "relative";
        } else {
          parent.style.zIndex = "";
          parent.style.position = "";
        }
        break;
      }
      parent = parent.parentElement;
    }
    
    return () => {
      if (parent) {
        parent.style.zIndex = "";
        parent.style.position = "";
      }
    };
  }, [open]);

  if (!def) return null;

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={`rounded-full p-0.5 text-slate-500 hover:text-slate-300 transition-colors hover:bg-white/10 focus:outline-none`}
        aria-label={`Info about ${def.name}`}
        title={`What is ${def.name}?`}
      >
        <Info className={iconSize} />
      </button>

      {open && (
        <div
          className="absolute z-50 right-0 top-6 mt-1 w-80 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-black/60 p-5 text-sm"
          style={{ minWidth: "300px" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="font-bold text-white text-sm leading-tight">{def.name}</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-500 hover:text-slate-300 transition-colors shrink-0 mt-0.5"
            >
              ✕
            </button>
          </div>

          {/* What it means */}
          <p className="text-slate-300 text-xs leading-relaxed mb-4">{def.what}</p>

          {/* Good range */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 mb-2">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Good Range</span>
            </div>
            <p className="text-xs text-emerald-200/80 leading-relaxed">{def.good}</p>
          </div>

          {/* Concerning range */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Watch Out For</span>
            </div>
            <p className="text-xs text-amber-200/80 leading-relaxed">{def.concerning}</p>
          </div>

          {/* Tip */}
          <div className="rounded-xl border border-sky-500/15 bg-sky-500/5 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400">💡 Tip</span>
            </div>
            <p className="text-xs text-sky-200/80 leading-relaxed">{def.tip}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default MetricInfo;
