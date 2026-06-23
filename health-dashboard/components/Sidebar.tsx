"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboardStore } from "@/lib/store";

const nav = [
  { href: "/",              icon: "ti-layout-dashboard",   label: "Overview"  },
  { href: "/recovery",     icon: "ti-heart-rate-monitor",  label: "Recovery"  },
  { href: "/sleep",        icon: "ti-moon",                label: "Sleep"     },
  { href: "/stress",       icon: "ti-bolt",                label: "Stress"    },
  { href: "/health-monitor", icon: "ti-activity",          label: "Monitor"   },
  { href: "/raw",          icon: "ti-table",               label: "Raw Data"  },
];

export default function Sidebar() {
  const path = usePathname();
  const { setIsSettingsOpen } = useDashboardStore();

  return (
    <aside style={{
      width: 220,
      minHeight: "100vh",
      background: "var(--bg-surface)",
      borderRight: "0.5px solid var(--border-subtle)",
      display: "flex",
      flexDirection: "column",
      padding: "24px 0",
      position: "sticky",
      top: 0,
      flexShrink: 0,
    }}>

      {/* App name */}
      <h2 style={{ padding: "0 24px 32px", letterSpacing: "0.15em",
        fontSize: 13, color: "var(--text-secondary)", fontWeight: 500, margin: 0 }}>
        FITBIT AIR
      </h2>

      {/* Nav links */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {nav.map(item => {
          const active =
            path === item.href ||
            (item.href === "/" && path === "/overview") ||
            path.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 24px", textDecoration: "none",
              color: active ? "var(--accent-primary)" : "var(--text-secondary)",
              background: active ? "var(--border-subtle)" : "transparent",
              borderRight: active ? "2px solid var(--accent-primary)" : "2px solid transparent",
              fontSize: 14, fontWeight: active ? 500 : 400,
              transition: "all 0.15s",
            }}>
              <i className={`ti ${item.icon}`} style={{ fontSize: 18 }} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: settings */}
      <div style={{ marginTop: "auto", padding: "0 24px" }}>
        <button
          onClick={() => setIsSettingsOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "var(--text-secondary)",
            textDecoration: "none",
            fontSize: 14,
            padding: "10px 0",
            background: "none",
            border: "none",
            cursor: "pointer",
            width: "100%",
            textAlign: "left",
            outline: "none",
          }}
        >
          <i className="ti ti-settings" style={{ fontSize: 18 }} aria-hidden="true" />
          Settings
        </button>
      </div>
    </aside>
  );
}
