"use client";

import React, { useEffect, useState } from "react";

type WhoopRingProps = {
  value: number;       // 0-100 for %, 0-21 for strain
  max?: number;        // default 100
  label: string;       // "SLEEP" | "RECOVERY" | "STRAIN"
  unit?: string;       // "%" or ""
  color: string;       // CSS color value
  size?: number;       // diameter px, default 140
  onClick?: () => void;
};

export function WhoopRing({
  value,
  max = 100,
  label,
  unit = "",
  color,
  size = 140,
  onClick,
}: WhoopRingProps) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius; // ≈ 364.42
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    // Triggers transition fill animation on mount
    const timer = setTimeout(() => {
      const targetOffset = circumference * (1 - Math.min(value, max) / max);
      setOffset(targetOffset);
    }, 50);
    return () => clearTimeout(timer);
  }, [value, max, circumference]);

  return (
    <div
      onClick={onClick}
      data-testid={`whoop-ring-${label.toLowerCase()}`}
      className={`flex flex-col items-center select-none ${onClick ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
      style={{ width: size }}
      role="button"
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          viewBox="0 0 140 140"
          width="100%"
          height="100%"
          className="w-full h-full"
        >
          {/* Track (background ring) */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="var(--bg-card-hover)"
            strokeWidth="10"
          />
          {/* Active fill ring */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
            style={{
              transition: "stroke-dashoffset 800ms ease-out",
            }}
          />
          {/* Center text: Value & Unit */}
          <text
            x="70"
            y="80"
            textAnchor="middle"
            fill="var(--text-primary)"
            style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
              fontWeight: 700,
            }}
          >
            <tspan className="text-[36px]">{value}</tspan>
            {unit && (
              <tspan className="text-[20px]" dy="-12" fontWeight="400">
                {unit}
              </tspan>
            )}
          </text>
        </svg>
      </div>
      {/* Label under the ring */}
      <span className="mt-3 flex items-center justify-center gap-1 text-[11px] font-medium tracking-[0.1em] text-[var(--text-secondary)] uppercase">
        {label}
        {onClick && <span style={{ fontSize: 9, opacity: 0.6 }}>›</span>}
      </span>
    </div>
  );
}

export default WhoopRing;
