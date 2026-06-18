"use client";

import { useDashboardStore } from "@/lib/store";

export function useToast() {
  const addToast = useDashboardStore((state) => state.addToast);
  return { addToast };
}
