"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const tabs = [
  { href: "/overview", icon: "ti-layout-dashboard", label: "Overview" },
  { href: "/recovery", icon: "ti-heart-rate-monitor", label: "Recovery" },
  { href: "/sleep", icon: "ti-moon", label: "Sleep" },
  { href: "/raw", icon: "ti-table", label: "Raw" },
];

export default function BottomNav() {
  const path = usePathname();

  return (
    <nav className="sticky bottom-0 left-0 right-0 z-40 bg-[#0A0A0A] border-t border-[rgba(255,255,255,0.08)] flex justify-around items-center h-[60px] pb-[env(safe-area-inset-bottom,16px)]">
      {tabs.map((tab) => {
        // Also highlight Overview if we are on the root path '/'
        const active =
          path === tab.href ||
          path.startsWith(tab.href + "/") ||
          (tab.href === "/overview" && path === "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center justify-center gap-[4px] text-[10px] tracking-[0.04em] ${
              active ? "text-[#00FF87]" : "text-[#444444]"
            }`}
          >
            <i className={`ti ${tab.icon} text-[20px]`}></i>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
