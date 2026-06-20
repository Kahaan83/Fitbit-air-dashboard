"use client";

import { useEffect } from "react";

export function ThemeInitializer() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      const theme = saved === "whoop" ? "whoop" : "premium";
      document.documentElement.setAttribute("data-theme", theme);
    } catch (e) {
      console.error("Failed to initialize theme from localStorage:", e);
    }
  }, []);

  return null;
}

export default ThemeInitializer;
