"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Global filter khusus role Admin BPKP/BPKP Reviewer/BPKP.
 *
 * Dipakai bersama oleh:
 * - Dashboard
 * - Assessment (Perencanaan, Kapabilitas, Hasil)
 * - Tindak Lanjut
 *
 * Tidak mengubah scope BLUD_OPERATOR dan BLUD_ADMIN karena komponen tetap
 * memakai filter ini hanya saat userRole termasuk BPKP.
 */
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

export const useBpkpGlobalFilterStore = create<BpkpGlobalFilterState>()(
  persist(
    (set) => ({
      selectedYear: "2026",
      selectedBludId: "",
      selectedBludCode: "",
      selectedBludName: "",

      setSelectedYear: (year) =>
        set({ selectedYear: String(year || new Date().getFullYear()) }),

      setSelectedBlud: (blud) =>
        set({
          selectedBludId: blud?.id ? String(blud.id) : "",
          selectedBludCode: blud?.code ? String(blud.code).toUpperCase() : "",
          selectedBludName: blud?.name ? String(blud.name) : "",
        }),

      setSelectedBludId: (id) =>
        set({
          selectedBludId: String(id || ""),
          ...(id ? {} : { selectedBludCode: "", selectedBludName: "" }),
        }),

      setSelectedBludCode: (code) =>
        set({
          selectedBludCode: String(code || "").toUpperCase(),
          ...(code ? {} : { selectedBludId: "", selectedBludName: "" }),
        }),

      clearSelectedBlud: () =>
        set({ selectedBludId: "", selectedBludCode: "", selectedBludName: "" }),
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
