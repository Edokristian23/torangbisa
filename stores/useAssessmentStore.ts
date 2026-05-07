import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BludOption = {
  id: string;
  code: string;
  name: string;
  region?: string | null;
};

export type AssessmentCacheEntry = {
  payload: any;
  rows: any[];
  reviewerNotes: string;
  cachedAt: number;
};

type CacheInput = {
  year: string;
  moduleKey: string;
  bludCode?: string;
};

type BludOptionsCacheEntry = {
  userRole: string;
  rows: BludOption[];
  cachedAt: number;
};

type AssessmentStore = {
  selectedYear: string;
  selectedBludCode: string;
  bludOptions: BludOption[];
  viewerRole: string;
  bludContextLoaded: boolean;
  assessmentCache: Record<string, AssessmentCacheEntry>;
  bludOptionsCache: Record<string, BludOptionsCacheEntry>;

  setSelectedYear: (year: string) => void;
  setSelectedBludCode: (code: string) => void;
  setBludOptions: (rows: BludOption[]) => void;
  setViewerRole: (role: string) => void;
  setBludContextLoaded: (loaded: boolean) => void;

  getAssessmentCache: (input: CacheInput) => AssessmentCacheEntry | null;
  setAssessmentCache: (
    input: CacheInput,
    entry: Omit<AssessmentCacheEntry, "cachedAt">,
  ) => void;
  clearAssessmentCache: (input?: CacheInput) => void;

  getBludOptionsCache: (year: string) => BludOptionsCacheEntry | null;
  setBludOptionsCache: (
    year: string,
    entry: Omit<BludOptionsCacheEntry, "cachedAt">,
  ) => void;
  clearBludOptionsCache: (year?: string) => void;

  resetAssessmentStore: () => void;
};

function makeAssessmentCacheKey({ year, moduleKey, bludCode }: CacheInput) {
  return `${year}::${moduleKey}::${bludCode || "SESSION_BLUD"}`;
}

export const useAssessmentStore = create<AssessmentStore>()(
  persist(
    (set, get) => ({
      selectedYear: "2026",
      selectedBludCode: "",
      bludOptions: [],
      viewerRole: "",
      bludContextLoaded: false,
      assessmentCache: {},
      bludOptionsCache: {},

      setSelectedYear: (year) => set({ selectedYear: String(year || "2026") }),

      setSelectedBludCode: (code) =>
        set({ selectedBludCode: String(code || "").toUpperCase() }),

      setBludOptions: (rows) =>
        set({ bludOptions: Array.isArray(rows) ? rows : [] }),

      setViewerRole: (role) =>
        set({ viewerRole: String(role || "").toUpperCase() }),

      setBludContextLoaded: (loaded) =>
        set({ bludContextLoaded: Boolean(loaded) }),

      getAssessmentCache: (input) =>
        get().assessmentCache[makeAssessmentCacheKey(input)] || null,

      setAssessmentCache: (input, entry) => {
        const key = makeAssessmentCacheKey(input);

        set((state) => ({
          assessmentCache: {
            ...state.assessmentCache,
            [key]: {
              ...entry,
              cachedAt: Date.now(),
            },
          },
        }));
      },

      clearAssessmentCache: (input) => {
        if (!input) {
          set({ assessmentCache: {} });
          return;
        }

        const key = makeAssessmentCacheKey(input);

        set((state) => {
          const nextCache = { ...state.assessmentCache };
          delete nextCache[key];

          return {
            assessmentCache: nextCache,
          };
        });
      },

      getBludOptionsCache: (year) =>
        get().bludOptionsCache[String(year || "2026")] || null,

      setBludOptionsCache: (year, entry) => {
        const key = String(year || "2026");

        set((state) => ({
          bludOptionsCache: {
            ...state.bludOptionsCache,
            [key]: {
              ...entry,
              cachedAt: Date.now(),
            },
          },
        }));
      },

      clearBludOptionsCache: (year) => {
        if (!year) {
          set({ bludOptionsCache: {} });
          return;
        }

        const key = String(year);

        set((state) => {
          const nextCache = { ...state.bludOptionsCache };
          delete nextCache[key];

          return {
            bludOptionsCache: nextCache,
          };
        });
      },

      resetAssessmentStore: () =>
        set({
          selectedYear: "2026",
          selectedBludCode: "",
          bludOptions: [],
          viewerRole: "",
          bludContextLoaded: false,
          assessmentCache: {},
          bludOptionsCache: {},
        }),
    }),
    {
      name: "assessment-hybrid-store:v1",
      partialize: (state) => ({
        selectedYear: state.selectedYear,
        selectedBludCode: state.selectedBludCode,
        assessmentCache: state.assessmentCache,
        bludOptionsCache: state.bludOptionsCache,
      }),
    },
  ),
);
