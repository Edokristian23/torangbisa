"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type BpkpGlobalFilterState = {
  selectedYear: string;
  selectedBludId: string;
  selectedBludCode: string;
  selectedBludName: string;
  setSelectedYear: (year: string) => void;
  setSelectedBlud: (blud: {
    id?: string | null;
    code?: string | null;
    name?: string | null;
  } | null) => void;
  setSelectedBludId: (id: string) => void;
  setSelectedBludCode: (code: string) => void;
  clearSelectedBlud: () => void;
};

export const BPKP_GLOBAL_FILTER_ROLES = new Set([
  "BPKP",
  "BPKP_ADMIN",
  "BPKP_REVIEWER",
]);

export function isBpkpGlobalFilterRole(role?: string | null) {
  return BPKP_GLOBAL_FILTER_ROLES.has(String(role || "").toUpperCase());
}

function normalizeYear(year?: string | number | null) {
  const value = String(year || "").trim();
  return value || String(new Date().getFullYear());
}

function normalizeCode(code?: string | null) {
  return String(code || "").trim().toUpperCase();
}

export const useBpkpGlobalFilterStore = create<BpkpGlobalFilterState>()(
  persist(
    (set) => ({
      selectedYear: "2026",
      selectedBludId: "",
      selectedBludCode: "",
      selectedBludName: "",

      setSelectedYear: (year) =>
        set({
          selectedYear: normalizeYear(year),
        }),

      setSelectedBlud: (blud) =>
        set({
          selectedBludId: blud?.id ? String(blud.id) : "",
          selectedBludCode: blud?.code ? normalizeCode(blud.code) : "",
          selectedBludName: blud?.name ? String(blud.name) : "",
        }),

      setSelectedBludId: (id) =>
        set((state) => {
          const nextId = String(id || "").trim();

          return {
            selectedBludId: nextId,
            selectedBludCode: nextId ? state.selectedBludCode : "",
            selectedBludName: nextId ? state.selectedBludName : "",
          };
        }),

      setSelectedBludCode: (code) =>
        set({
          selectedBludId: "",
          selectedBludCode: normalizeCode(code),
          selectedBludName: "",
        }),

      clearSelectedBlud: () =>
        set({
          selectedBludId: "",
          selectedBludCode: "",
          selectedBludName: "",
        }),
    }),
    {
      name: "bpkp-global-assessment-filter",
      partialize: (state) => ({
        selectedYear: state.selectedYear,
        selectedBludId: state.selectedBludId,
        selectedBludCode: state.selectedBludCode,
        selectedBludName: state.selectedBludName,
      }),
    },
  ),
);
