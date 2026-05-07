import { create } from "zustand";
import { persist } from "zustand/middleware";

type EnterpriseDashboardFilterState = {
  selectedBludId: string;
  setSelectedBludId: (bludId: string) => void;
  clearSelectedBludId: () => void;
};

export const useEnterpriseDashboardFilterStore = create<EnterpriseDashboardFilterState>()(
  persist(
    (set) => ({
      selectedBludId: "",
      setSelectedBludId: (bludId) => set({ selectedBludId: bludId }),
      clearSelectedBludId: () => set({ selectedBludId: "" }),
    }),
    {
      name: "enterprise-dashboard-filter-store",
      partialize: (state) => ({ selectedBludId: state.selectedBludId }),
    },
  ),
);
