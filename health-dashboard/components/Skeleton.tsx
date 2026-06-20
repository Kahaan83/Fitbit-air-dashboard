import React from "react";

/** Matches scorecard dimensions: rounded-xl border border-white/8 bg-slate-900/60 p-4 h-24 */
export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)]/60 p-4 h-24">
      <div className="h-full flex flex-col justify-between">
        {/* Label row placeholder */}
        <div className="shimmer h-3 w-24 rounded bg-white/8" />
        {/* Value placeholder */}
        <div className="shimmer h-7 w-16 rounded bg-white/8" />
        {/* Status text placeholder */}
        <div className="shimmer h-2.5 w-20 rounded bg-white/8" />
      </div>
    </div>
  );
}

/** Matches chart card dimensions: rounded-xl border border-white/8 bg-slate-900/60 p-5 h-72 */
export function SkeletonChart() {
  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)]/60 p-5 h-72">
      <div className="flex flex-col h-full gap-3">
        {/* Title line */}
        <div className="shimmer h-4 w-40 rounded bg-white/8" />
        {/* Subtitle line */}
        <div className="shimmer h-3 w-56 rounded bg-white/8" />
        {/* Chart body */}
        <div className="shimmer flex-1 rounded-lg bg-white/8 mt-1" />
      </div>
    </div>
  );
}
