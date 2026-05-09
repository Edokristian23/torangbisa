"use client";

import { useBpkpGlobalFilterStore } from "./useBpkpGlobalFilterStore";

type EnterpriseDashboardFilterState = {
  selectedBludId: string;
  setSelectedBludId: (bludId: string) => void;
  clearSelectedBludId: () => void;
};

export const useEnterpriseDashboardFilterStore = ((selector?: any) => {
  const mappedSelector =
    typeof selector === "function"
      ? (state: any): EnterpriseDashboardFilterState => ({
          selectedBludId: state.selectedBludId,
          setSelectedBludId: state.setSelectedBludId,
          clearSelectedBludId: state.clearSelectedBlud,
        })
      : undefined;

  return useBpkpGlobalFilterStore(mappedSelector as any);
}) as typeof useBpkpGlobalFilterStore & {
  <T>(selector: (state: EnterpriseDashboardFilterState) => T): T;
};
