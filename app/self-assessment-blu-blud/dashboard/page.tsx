"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBpkpGlobalFilterStore } from "../../../stores/useBpkpGlobalFilterStore";

import {
  Award,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Layers3,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  X,
  Building2,
  ChevronRight,
  Download,
} from "lucide-react";

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
} from "chart.js";
import { Line as LineChartJS, Pie } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(
  ArcElement,
  ChartTooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
);

type RejectedParameterRow = {
  id: string;
  parameterId: number;
  parameter: string;
  reviewNotes?: string | null;
  reviewedAt?: string | null;
  moduleKey?: string;
  year?: number;
};

type RejectSummaryPayload = {
  totalRejected: number;
  rows: RejectedParameterRow[];
};

type ParameterResult = {
  id: number;
  label: string;
  rawScore: number;
  weightedScore: number;
  maxScore: number;
  aspect: "Aspek 1" | "Aspek 2" | "Aspek 3";
  subAspect: string;
  responseCount: number;
};

type SubAspectResult = {
  aspect: string;
  subAspect: string;
  totalWeighted: number;
  totalMax: number;
  achievement: number;
  parameterCount: number;
};

type AspectResult = {
  aspect: string;
  totalWeighted: number;
  totalMax: number;
  achievement: number;
  parameterCount: number;
};

type BludScoreResult = {
  bludId?: string;
  bludCode?: string;
  bludName: string;
  totalScore: number;
  achievement?: number;
  aspectScores?: {
    aspect: "Aspek 1" | "Aspek 2" | "Aspek 3";
    totalScore: number;
    totalMax: number;
    achievement: number;
  }[];
};

type FollowUpInfographicRow = {
  bludId: string;
  bludCode: string;
  bludName: string;
  lowScoreParameterCount: number;
  aoiCount: number;
  followUpCount: number;
  followUpEntryCount?: number;
};

type DashboardBludFilter = {
  id: string;
  code: string;
  name: string;
};

type DashboardViewer = {
  role: string;
  isBludScoped: boolean;
  currentBludId: string | null;
  currentBludName: string | null;
  canReviewAoi: boolean;
  dataSource?: "BPKP_SELF_ASSESSMENT" | "BLUD_SELF_ASSESSMENT";
};

type DashboardPayload = {
  summary: {
    totalResponses: number;
    totalBluds: number;
    scoredParameters: number;
    totalWeightedScore: number;
    totalMaxScore: number;
    achievement: number;
    averageRawScore: number;
  };
  parameters: ParameterResult[];
  subAspects?: SubAspectResult[];
  aspects: AspectResult[];
  bludScores?: BludScoreResult[];
  infographics?: {
    summary: {
      totalLowScoreParameters: number;
      totalAoi: number;
      totalFollowUps: number;
      totalFollowUpEntries?: number;
    };
    rows: FollowUpInfographicRow[];
  };
  filters?: {
    bluds: DashboardBludFilter[];
    selectedBludIds: string[];
  };
  viewer?: DashboardViewer;
};

const COLORS = [
  "#1d4ed8",
  "#0f766e",
  "#7c3aed",
  "#ea580c",
  "#475569",
  "#16a34a",
];

const DASHBOARD_DATA_CHANGED_EVENT = "enterprise-dashboard-data-changed";
const DASHBOARD_DATA_VERSION_KEY = "enterprise-dashboard-data-version";

type DashboardCacheEntry = {
  payload: DashboardPayload;
  dataVersion: string;
  fetchedAt: number;
};

const dashboardCache = new Map<string, DashboardCacheEntry>();
let rejectedSummaryCache: RejectSummaryPayload | null = null;
let rejectedSummaryChecked = false;

function notifyEnterpriseDashboardDataChanged() {
  if (typeof window === "undefined") return;

  const version = String(Date.now());
  localStorage.setItem(DASHBOARD_DATA_VERSION_KEY, version);
  window.dispatchEvent(new CustomEvent(DASHBOARD_DATA_CHANGED_EVENT));
}

function getDashboardDataVersion() {
  if (typeof window === "undefined") return "initial";
  return localStorage.getItem(DASHBOARD_DATA_VERSION_KEY) || "initial";
}

function getDashboardCacheKey(year: string, bludId?: string, bludCode?: string) {
  return `enterprise-dashboard:${year}:${bludId || bludCode || "global"}`;
}

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getAchievementLabel(percent: number) {
  if (percent >= 85) {
    return {
      label: "Sangat Baik",
      tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
  if (percent >= 70) {
    return {
      label: "Baik",
      tone: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }
  if (percent >= 55) {
    return {
      label: "Cukup",
      tone: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }
  return {
    label: "Perlu Perbaikan",
    tone: "bg-blue-50 text-blue-700 border-blue-200",
  };
}


type BludFilterOption = {
  id: string;
  code: string;
  name: string;
};

function BludPillDropdown({
  value,
  options,
  onChange,
  compact = false,
  hideAllOption = false,
}: {
  value: string;
  options: BludFilterOption[];
  onChange: (value: string) => void;
  compact?: boolean;
  hideAllOption?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((item) => item.id === value);
  const selectedLabel = selectedOption
    ? selectedOption.name || selectedOption.code || "BLUD"
    : hideAllOption
      ? options[0]?.name || "BLUD"
      : "Semua";

  const buttonWidth = 180;
  const menuWidth = 260;

  const updateMenuPosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const safeMargin = 12;
    const desiredLeft = rect.right - menuWidth;
    const left = Math.min(
      Math.max(safeMargin, desiredLeft),
      window.innerWidth - menuWidth - safeMargin,
    );

    setMenuStyle({
      top: rect.bottom + 8,
      left,
      width: menuWidth,
    });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;

      setOpen(false);
    };

    const handleReposition = () => updateMenuPosition();

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, compact]);

  const menu =
    open && mounted && menuStyle
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[99999] overflow-hidden rounded-[18px] border border-slate-200 bg-white py-1 text-slate-700 shadow-2xl ring-1 ring-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            style={{
              top: menuStyle.top,
              left: menuStyle.left,
              width: menuStyle.width,
            }}
          >
            {!hideAllOption ? (
              <div
                aria-disabled="true"
                title="Semua BLUD hanya sebagai tampilan global, tidak bisa dipilih dari dropdown ini."
                className={`flex w-full cursor-not-allowed select-none items-center justify-between gap-3 px-4 py-2.5 text-left text-[13px] font-black opacity-80 ${
                  value === ""
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "bg-slate-50 text-slate-500 dark:bg-slate-800/70 dark:text-slate-400"
                }`}
              >
                <span className="truncate">Semua BLUD</span>
                {value === "" ? (
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                ) : null}
              </div>
            ) : null}

            <div className="max-h-72 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {options.map((item) => {
                const active = item.id === value;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onChange(item.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[13px] font-semibold transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300 ${
                      active
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                        : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-black leading-5">
                        {item.name || "-"}
                      </span>
                      <span className="block truncate text-[12px] font-semibold leading-5 text-slate-500 dark:text-slate-400">
                        {item.code || "-"}
                      </span>
                    </span>
                    {active ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative inline-flex items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
          window.requestAnimationFrame(updateMenuPosition);
        }}
        className="inline-flex h-10 min-w-[180px] max-w-[180px] items-center justify-between gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 text-white shadow-sm ring-1 ring-white/10 backdrop-blur transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
        style={{ width: buttonWidth }}
        title="Filter BLUD mengikuti tahun dashboard yang dipilih"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-blue-100">
            BLUD
          </span>
          <span className="min-w-0 truncate text-sm font-semibold leading-none text-white">
            {selectedLabel}
          </span>
        </div>
        <svg
          className={`h-3 w-3 shrink-0 text-white transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {menu}
    </div>
  );
}

function Block({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}
    >
      {children}
    </div>
  );
}

function BludResponseModal({
  open,
  onClose,
  year,
  bludScores,
  totalBluds,
}: {
  open: boolean;
  onClose: () => void;
  year: string;
  bludScores: BludScoreResult[];
  totalBluds: number;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
          <div className="border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 dark:from-slate-900 dark:via-indigo-900 dark:to-slate-900 px-6 py-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                  <Building2 size={22} />
                </div>

                <div>
                  <h3 className="text-lg font-semibold">
                    Daftar BLUD Telah Mengisi Self Assessment
                  </h3>
                  <p className="mt-1 text-sm text-blue-50 dark:text-slate-200">
                    Menampilkan seluruh BLUD yang telah mengisi Self Assessment
                    pada tahun <span className="font-semibold">{year}</span>.
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="rounded-xl border border-white/15 bg-white/10 p-2 text-white transition hover:bg-white/15"
                aria-label="Tutup modal"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                {bludScores.length} dari {totalBluds} BLUD telah mengisi
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Diurutkan berdasarkan total skor tertinggi
              </div>
            </div>

            {bludScores.length === 0 ? (
              <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 px-6 text-center">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Belum ada BLUD yang mengisi Self Assessment
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Data akan muncul setelah BLUD melakukan pengisian dan
                    tersimpan di sistem.
                  </p>
                </div>
              </div>
            ) : (
              <div className="[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden max-h-[460px] space-y-3 overflow-y-auto pr-1">
                {bludScores.map((item, index) => (
                  <div
                    key={`${item.bludName}-${index}`}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4 transition hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200">
                          {index + 1}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {item.bludName}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Status: Self Assessment telah diisi
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            Total Skor
                          </p>
                          <p className="text-base font-bold text-slate-900 dark:text-white">
                            {formatNumber(item.totalScore, 2)}
                          </p>
                        </div>

                        <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-2 text-slate-500 dark:text-slate-400">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RejectedInfoDashboardModal({
  open,
  onClose,
  rows,
}: {
  open: boolean;
  onClose: () => void;
  rows: RejectedParameterRow[];
}) {
  if (!open || rows.length === 0) return null;

  return (
    <div className="[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden fixed inset-0 z-[110] overflow-y-auto bg-slate-950/50 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div className="flex max-h-[calc(100vh-32px)] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl sm:max-h-[calc(100vh-48px)]">
          <div className="shrink-0 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 dark:from-slate-900 dark:via-blue-900 dark:to-slate-900 px-6 py-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                  <ClipboardList size={22} />
                </div>

                <div>
                  <h3 className="text-lg font-semibold">
                    Terdapat {rows.length} parameter yang direject Admin BLUD
                  </h3>
                  <p className="mt-1 text-sm text-blue-50 dark:text-slate-200">
                    Silakan periksa parameter yang ditolak beserta pesan reject
                    dari Admin BLUD.
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="rounded-xl border border-white/15 bg-white/10 p-2 text-white transition hover:bg-white/15"
                aria-label="Tutup modal"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-sm font-semibold text-blue-800">
                Jumlah parameter direject: {rows.length}
              </p>
              <p className="mt-1 text-sm text-blue-700">
                Segera lakukan perbaikan sesuai dengan yang telah disarankan.
              </p>
            </div>

            <div className="space-y-3">
              {rows.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-sm font-bold text-blue-700">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {item.parameter}
                      </p>

                      <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                          Pesan Reject
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-blue-800">
                          {item.reviewNotes || "-"}
                        </p>
                      </div>

                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Tanggal review: {formatDate(item.reviewedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="shrink-0 flex justify-end border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EnterpriseAssessmentDashboard() {
  // Filter BLUD dan tahun dibuat global untuk role Admin BPKP/BPKP Reviewer/BPKP.
  // Store yang sama dipakai Dashboard, Assessment, dan Tindak Lanjut.
  const year = useBpkpGlobalFilterStore((state) => state.selectedYear);
  const setYear = useBpkpGlobalFilterStore((state) => state.setSelectedYear);
  const selectedBludId = useBpkpGlobalFilterStore(
    (state) => state.selectedBludId,
  );
  const setSelectedBlud = useBpkpGlobalFilterStore(
    (state) => state.setSelectedBlud,
  );
  const clearSelectedBlud = useBpkpGlobalFilterStore(
    (state) => state.clearSelectedBlud,
  );
  const selectedBludCode = useBpkpGlobalFilterStore(
    (state) => state.selectedBludCode,
  );
  const selectedBludName = useBpkpGlobalFilterStore(
    (state) => state.selectedBludName,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [showBludModal, setShowBludModal] = useState(false);

  const [rejectSummary, setRejectSummary] = useState<RejectSummaryPayload>({
    totalRejected: 0,
    rows: [],
  });
  const [showRejectedModal, setShowRejectedModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isFilterHydrated, setIsFilterHydrated] = useState(false);

  useEffect(() => {
    const updateTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const storeWithPersist = useBpkpGlobalFilterStore as typeof useBpkpGlobalFilterStore & {
      persist?: {
        hasHydrated: () => boolean;
        onFinishHydration: (callback: () => void) => () => void;
      };
    };

    const persistApi = storeWithPersist.persist;

    if (!persistApi) {
      setIsFilterHydrated(true);
      return;
    }

    setIsFilterHydrated(persistApi.hasHydrated());

    const unsubscribe = persistApi.onFinishHydration(() => {
      setIsFilterHydrated(true);
    });

    return () => unsubscribe();
  }, []);

  const chartTextColor = isDarkMode ? "#cbd5e1" : "#475569";
  const chartGridColor = isDarkMode ? "#334155" : "#e2e8f0";

  const isOperatorBludDashboard = (dashboardPayload?: DashboardPayload | null) =>
    String(dashboardPayload?.viewer?.role || "").toUpperCase() ===
    "BLUD_OPERATOR";

  const resetRejectedSummary = () => {
    rejectedSummaryCache = null;
    rejectedSummaryChecked = true;
    setRejectSummary({
      totalRejected: 0,
      rows: [],
    });
    setShowRejectedModal(false);
  };

  const fetchDashboard = async (options?: {
    force?: boolean;
    targetYear?: string;
  }) => {
    const selectedYear = options?.targetYear ?? year;
    const force = Boolean(options?.force);
    const cacheKey = getDashboardCacheKey(selectedYear, selectedBludId, selectedBludCode);
    const currentDataVersion = getDashboardDataVersion();
    const cached = dashboardCache.get(cacheKey);

    if (!force && cached && cached.dataVersion === currentDataVersion) {
      setPayload(cached.payload);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("year", selectedYear);
      if (selectedBludId) {
        params.set("bludIds", selectedBludId);
      } else if (selectedBludCode) {
        params.set("bludCode", selectedBludCode);
      }

      const res = await fetch(
        `/api/dashboard/enterprise?${params.toString()}`,
        {
          cache: "no-store",
        },
      );

      const contentType = res.headers.get("content-type") || "";
      const raw = await res.text();

      if (!contentType.includes("application/json")) {
        console.error("Non-JSON response:", raw);
        throw new Error("Endpoint API tidak mengembalikan JSON.");
      }

      const json = JSON.parse(raw) as DashboardPayload;

      if (!res.ok) {
        throw new Error(
          (json as { message?: string })?.message || "Gagal memuat dashboard.",
        );
      }

      dashboardCache.set(cacheKey, {
        payload: json,
        dataVersion: currentDataVersion,
        fetchedAt: Date.now(),
      });

      setPayload(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat dashboard.");

      if (cached) {
        setPayload(cached.payload);
      } else {
        setPayload(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchRejectedSummary = async (options?: { force?: boolean }) => {
    if (!options?.force && rejectedSummaryChecked && rejectedSummaryCache) {
      setRejectSummary(rejectedSummaryCache);

      if (rejectedSummaryCache.rows.length > 0) {
        setShowRejectedModal(true);
      }

      return;
    }

    try {
      const res = await fetch("/api/assessments/rejected-summary", {
        cache: "no-store",
      });

      const contentType = res.headers.get("content-type") || "";
      const raw = await res.text();

      if (!contentType.includes("application/json")) {
        throw new Error("Endpoint reject summary tidak mengembalikan JSON.");
      }

      const json = JSON.parse(raw);

      if (!res.ok) {
        throw new Error(
          json?.message || "Gagal memuat ringkasan reject operator.",
        );
      }

      const rows = Array.isArray(json?.rows) ? json.rows : [];
      const totalRejected =
        typeof json?.totalRejected === "number"
          ? json.totalRejected
          : rows.length;

      const nextRejectSummary = {
        totalRejected,
        rows,
      };

      rejectedSummaryCache = nextRejectSummary;
      rejectedSummaryChecked = true;

      setRejectSummary(nextRejectSummary);

      if (rows.length > 0) {
        setShowRejectedModal(true);
      }
    } catch (err) {
      console.error("Gagal memuat rejected summary:", err);
    }
  };

  useEffect(() => {
    if (!isFilterHydrated) return;

    void fetchDashboard({ targetYear: year });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFilterHydrated, year, selectedBludId, selectedBludCode, selectedBludName]);

  useEffect(() => {
    const handleDataChanged = () => {
      if (!isFilterHydrated) return;

      dashboardCache.delete(getDashboardCacheKey(year, selectedBludId, selectedBludCode));
      rejectedSummaryChecked = false;
      rejectedSummaryCache = null;

      void fetchDashboard({
        force: true,
        targetYear: year,
      });

      if (isOperatorBludDashboard(payload)) {
        void fetchRejectedSummary({ force: true });
      }
    };

    const handleStorageChanged = (event: StorageEvent) => {
      if (event.key === DASHBOARD_DATA_VERSION_KEY) {
        handleDataChanged();
      }
    };

    window.addEventListener(DASHBOARD_DATA_CHANGED_EVENT, handleDataChanged);
    window.addEventListener("storage", handleStorageChanged);

    return () => {
      window.removeEventListener(
        DASHBOARD_DATA_CHANGED_EVENT,
        handleDataChanged,
      );
      window.removeEventListener("storage", handleStorageChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFilterHydrated, payload, year, selectedBludId, selectedBludCode, selectedBludName]);

  useEffect(() => {
    if (!payload?.viewer) return;

    if (!isOperatorBludDashboard(payload)) {
      resetRejectedSummary();
      return;
    }

    void fetchRejectedSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload?.viewer?.role, payload?.viewer?.currentBludId, year]);

  const summary = payload?.summary ?? {
    totalResponses: 0,
    totalBluds: 0,
    scoredParameters: 0,
    totalWeightedScore: 0,
    totalMaxScore: 5.0,
    achievement: 0,
    averageRawScore: 0,
  };

  const parameterResults = payload?.parameters ?? [];
  const aspectResults = payload?.aspects ?? [];
  const bludScores = payload?.bludScores ?? [];
  const infographicRows = payload?.infographics?.rows ?? [];
  const bludFilters = payload?.filters?.bluds ?? [];
  const canSelectBlud = Boolean(payload?.viewer && !payload.viewer.isBludScoped);
  const viewerRole = String(payload?.viewer?.role || "").toUpperCase();
  const isAdminBpkpDashboard = ["BPKP", "BPKP_ADMIN", "BPKP_REVIEWER"].includes(viewerRole);
  const shouldShowParameterDetail = viewerRole !== "BPKP_ADMIN";

  useEffect(() => {
    if (!canSelectBlud || bludFilters.length === 0) return;

    /**
     * Dashboard harus mengikuti global filter yang sama dengan Assessment dan
     * Tindak Lanjut. Assessment/Tindak Lanjut dapat menyimpan BLUD melalui
     * code/name, sementara Dashboard select memakai id. Karena itu Dashboard
     * selalu menyelaraskan id, code, dan name setiap kali global filter berubah.
     */
    const normalizedGlobalCode = String(selectedBludCode || "")
      .trim()
      .toUpperCase();
    const normalizedGlobalName = String(selectedBludName || "")
      .trim()
      .toUpperCase();

    const matchedByCodeOrName = bludFilters.find((item) => {
      const codeMatches =
        normalizedGlobalCode &&
        String(item.code || "").toUpperCase() === normalizedGlobalCode;

      const nameMatches =
        normalizedGlobalName &&
        String(item.name || "").toUpperCase() === normalizedGlobalName;

      return codeMatches || nameMatches;
    });

    if (matchedByCodeOrName && matchedByCodeOrName.id !== selectedBludId) {
      setSelectedBlud(matchedByCodeOrName);
      return;
    }

    if (!selectedBludId) return;

    const selectedBlud = bludFilters.find((item) => item.id === selectedBludId);

    if (!selectedBlud) {
      clearSelectedBlud();
      return;
    }

    const shouldRepairGlobalBludMeta =
      String(selectedBlud.code || "").toUpperCase() !== normalizedGlobalCode ||
      String(selectedBlud.name || "").toUpperCase() !== normalizedGlobalName;

    if (shouldRepairGlobalBludMeta) {
      setSelectedBlud(selectedBlud);
    }
  }, [
    bludFilters,
    canSelectBlud,
    clearSelectedBlud,
    selectedBludCode,
    selectedBludId,
    selectedBludName,
    setSelectedBlud,
  ]);

  useEffect(() => {
    if (!isAdminBpkpDashboard || !canSelectBlud || bludFilters.length === 0) {
      return;
    }

    /**
     * Khusus Admin BPKP:
     * - opsi "Semua BLUD" tidak dipakai di dashboard
     * - jika belum ada filter global dari Assessment/Tindak Lanjut,
     *   default dashboard diarahkan ke RSCB.
     */
    if (selectedBludId || selectedBludCode || selectedBludName) return;

    const defaultBlud =
      bludFilters.find(
        (item) => String(item.code || "").toUpperCase() === "RSCB",
      ) || bludFilters[0];

    if (defaultBlud) {
      setSelectedBlud(defaultBlud);
    }
  }, [
    bludFilters,
    canSelectBlud,
    isAdminBpkpDashboard,
    selectedBludCode,
    selectedBludId,
    selectedBludName,
    setSelectedBlud,
  ]);

  const selectedBludScore = bludScores.find(
    (item) => item.bludId === selectedBludId,
  );

  const filteredInfographicRows =
    canSelectBlud && selectedBludId
      ? infographicRows.filter((item) => item.bludId === selectedBludId)
      : infographicRows;

  const filteredAspectResults =
    canSelectBlud && selectedBludId
      ? aspectResults.map((aspectItem) => {
          const selectedAspect = selectedBludScore?.aspectScores?.find(
            (score) => score.aspect === aspectItem.aspect,
          );

          return selectedAspect
            ? {
                ...aspectItem,
                totalWeighted: selectedAspect.totalScore,
                totalMax: selectedAspect.totalMax,
                achievement: selectedAspect.achievement,
              }
            : {
                ...aspectItem,
                totalWeighted: 0,
                achievement: 0,
              };
        })
      : aspectResults;

  const filteredTotalWeightedScore = filteredAspectResults.reduce(
    (sum, item) => sum + item.totalWeighted,
    0,
  );
  const filteredTotalMaxScore = filteredAspectResults.reduce(
    (sum, item) => sum + item.totalMax,
    0,
  );
  const filteredAchievement =
    filteredTotalMaxScore > 0
      ? (filteredTotalWeightedScore / filteredTotalMaxScore) * 100
      : 0;

  const badge = getAchievementLabel(summary.achievement);
  const filteredBadge = getAchievementLabel(filteredAchievement);

  const SectionBludFilter = ({ compact = false }: { compact?: boolean }) => {
    if (!canSelectBlud) return null;

    return (
      <BludPillDropdown
        value={selectedBludId}
        options={bludFilters}
        onChange={(nextBludId) => {
          const nextBlud = bludFilters.find((item) => item.id === nextBludId);

          if (nextBlud) {
            setSelectedBlud(nextBlud);
          } else if (!isAdminBpkpDashboard) {
            clearSelectedBlud();
          }
        }}
        compact={compact}
        hideAllOption={isAdminBpkpDashboard}
      />
    );
  };


  const badgeDotColorMap: Record<string, string> = {
    "Perlu Perbaikan": "bg-blue-500",
    Cukup: "bg-orange-400",
    Baik: "bg-yellow-400",
    "Sangat Baik": "bg-emerald-400",
  };

  const aspectLabelMap: Record<string, string> = {
    "Aspek 1": "Perencanaan",
    "Aspek 2": "Kapabilitas",
    "Aspek 3": "Hasil",
  };

  const aspectColorMap: Record<string, string> = {
    "Aspek 1": "#bbdefb",
    "Aspek 2": "#2196f3",
    "Aspek 3": "#1565c0",
  };

  const pieData = aspectResults.map((item) => ({
    name: aspectLabelMap[item.aspect] ?? item.aspect,
    value: Number(item.totalWeighted.toFixed(4)),
  }));

  const chartJsPieData = {
    labels: pieData.map((item) => item.name),
    datasets: [
      {
        label: "Nilai",
        data: pieData.map((item) => item.value),
        backgroundColor: aspectResults.map(
          (item) => aspectColorMap[item.aspect] ?? "#94a3b8",
        ),
        borderColor: "#ffffff",
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  const chartJsPieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          boxWidth: 12,
          padding: 16,
          color: chartTextColor,
        },
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const value = Number(context.raw || 0);
            return `Nilai: ${formatNumber(value, 2)}`;
          },
        },
      },
      datalabels: {
        color: "#ffffff",
        font: {
          weight: "bold" as const,
          size: 12,
        },
        formatter: function (value: number, context: any) {
          const values = context.chart.data.datasets[0].data as number[];
          const total = values.reduce((sum, item) => sum + Number(item), 0);
          const percentage = total > 0 ? (Number(value) / total) * 100 : 0;

          return `${formatNumber(percentage, 1)}%`;
        },
      },
    },
  };

  const lineData = bludScores.map((item) => ({
    name: item.bludName,
    value: Number(item.totalScore.toFixed(2)),
  }));

  const DEFAULT_BLUDS = [
    "RSCB",
    "RSUD Tobelo",
    "RSUD Labuha",
    "RSUD Jailolo",
    "RSUD Tidore",
    "Sultan Babullah",
    "Universitas Khairun"
  ];

  const normalizedBludScores = DEFAULT_BLUDS.map((name) => {
    const found = bludScores.find((b) => b.bludName === name);

    return (
      found ?? {
        bludName: name,
        totalScore: 0,
        achievement: 0,
        aspectScores: [
          { aspect: "Aspek 1", totalScore: 0, totalMax: 0, achievement: 0 },
          { aspect: "Aspek 2", totalScore: 0, totalMax: 0, achievement: 0 },
          { aspect: "Aspek 3", totalScore: 0, totalMax: 0, achievement: 0 },
        ],
      }
    );
  });

  const chartJsLineData = {
    labels: normalizedBludScores.map((item) => item.bludName),
    datasets: (["Aspek 1", "Aspek 2", "Aspek 3"] as const).map((aspect) => ({
      label: aspectLabelMap[aspect] ?? aspect,
      data: normalizedBludScores.map((blud) => {
        const found = blud.aspectScores?.find((item) => item.aspect === aspect);

        return found ? Number(found.totalScore.toFixed(2)) : 0;
      }),
      borderColor: aspectColorMap[aspect] ?? "#94a3b8",
      backgroundColor: aspectColorMap[aspect] ?? "#94a3b8",
      tension: 0.4,
      borderWidth: 3,
      hoverBorderWidth: 4,
      fill: false,
      pointRadius: 5,
      pointHoverRadius: 7,
      pointBorderWidth: 2,
      pointBackgroundColor: "#ffffff",
      pointHoverBorderWidth: 3,
    })),
  };

  const chartJsLineOptions = {
    responsive: true,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "bottom" as const,
        labels: {
          color: chartTextColor,
        },
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const value = Number(context.raw || 0);
            return `${context.dataset.label}: ${formatNumber(value, 2)}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 20,
          minRotation: 20,
          color: chartTextColor,
        },
        grid: {
          color: chartGridColor,
        },
      },
      y: {
        beginAtZero: true,
        min: 0,
        max: 2,
        ticks: {
          stepSize: 0.5,
          color: chartTextColor,
          callback: function (value: any) {
            return formatNumber(Number(value), 1);
          },
        },
        grid: {
          color: chartGridColor,
        },
      },
    },
  };

  const summaryCards = useMemo(
    () => [
      {
        key: "blud",
        label: "BLU/BLUD Telah Mengisi SA",
        value: summary.totalResponses,
        icon: ClipboardList,
        suffix: `${summary.totalResponses} dari ${summary.totalBluds} BLU/BLUD`,
        clickable: true,
        onClick: () => setShowBludModal(true),
        actionHint: "Klik ikon untuk melihat daftar BLUD",
      },
      {
        key: "parameter",
        label: "Parameter Terisi",
        value: summary.scoredParameters,
        icon: CheckCircle2,
        suffix: "dari 28 parameter",
        clickable: false,
      },
      {
        key: "nilai-total",
        label: "Nilai Total",
        value: formatNumber(summary.totalWeightedScore, 2),
        icon: Award,
        suffix: `dari ${formatNumber(summary.totalMaxScore, 2)}`,
        clickable: false,
      },
      {
        key: "nilai-capaian",
        label: "Nilai Capaian",
        value: `${formatNumber(summary.achievement, 2)}%`,
        icon: TrendingUp,
        suffix: `rata-rata skor ${formatNumber(summary.averageRawScore, 2)}`,
        clickable: false,
      },
    ],
    [summary],
  );

  const getExportAssessmentSource = () => {
    const role = String(payload?.viewer?.role || "").toUpperCase();

    // Aturan Export PDF Dashboard:
    // 1. Admin BPKP/BPKP/BPKP Reviewer mengambil hasil self assessment Admin BPKP.
    // 2. Admin BLUD mengambil hasil self assessment Operator BLUD.
    // 3. Operator BLUD mengambil hasil self assessment Operator BLUD.
    // Parameter ini hanya dikirim saat export PDF dan tidak mengubah fetch dashboard,
    // filter, grafik, cache, ataupun fungsi lain yang sudah berjalan.
    if (["BPKP_ADMIN", "BPKP", "BPKP_REVIEWER"].includes(role)) {
      return "BPKP_SELF_ASSESSMENT";
    }

    return "BLUD_OPERATOR_SELF_ASSESSMENT";
  };

  const exportAssessmentPdf = () => {
    const params = new URLSearchParams();
    params.set("year", year);
    params.set("assessmentSource", getExportAssessmentSource());

    if (selectedBludId) {
      params.set("bludIds", selectedBludId);
    } else if (selectedBludCode) {
      params.set("bludCode", selectedBludCode);
    }

    window.open(`/api/reports/assessment?${params.toString()}`, "_blank");
  };

  return (
    <div className="[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden h-screen overflow-y-auto bg-transparent text-slate-900 dark:text-slate-100">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-10 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20">
                <ShieldCheck size={26} />
              </div>

              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Dashboard Monitoring BLUD
                </div>

                <div>
                  <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    Dashboard Self Assessment
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Hasil self assessment BLU/BLUD berdasarkan tahun yang dipilih.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-700 dark:bg-slate-800/50">
              {canSelectBlud && (
                <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-sm dark:bg-slate-900">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    BLUD
                  </span>

                  <select
                    value={selectedBludId}
                    onChange={(e) => {
                      const nextBludId = e.target.value;
                      const nextBlud = bludFilters.find(
                        (item) => item.id === nextBludId,
                      );

                      if (nextBlud) {
                        setSelectedBlud(nextBlud);
                      } else if (!isAdminBpkpDashboard) {
                        clearSelectedBlud();
                      }
                    }}
                    className="max-w-[210px] bg-transparent text-sm font-bold text-slate-800 outline-none dark:text-white"
                  >
                    {!isAdminBpkpDashboard ? (
                      <option value="">Semua BLUD</option>
                    ) : null}
                    {bludFilters.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={exportAssessmentPdf}
                className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-md dark:border-blue-900/60 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
              >
                <Download size={16} />
                Export PDF
              </button>

              <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-sm dark:bg-slate-900">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Tahun
                </span>

                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-800 outline-none dark:text-white"
                >
                  {["2025", "2026", "2027", "2028"].map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() =>
                  void fetchDashboard({
                    force: true,
                    targetYear: year,
                  })
                }
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:shadow-xl dark:from-slate-900 dark:to-blue-800 dark:shadow-blue-900/20"
              >
                <RefreshCw size={16} />
                Refresh Data
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((item, index) => {
            const accentStyles = [
              {
                card: "from-blue-500/10 via-white to-white dark:from-blue-500/15 dark:via-slate-900 dark:to-slate-900",
                icon: "from-blue-600 to-indigo-600 shadow-blue-500/20",
                ring: "ring-blue-500/10",
                bar: "from-blue-500 to-indigo-500",
              },
              {
                card: "from-emerald-500/10 via-white to-white dark:from-emerald-500/15 dark:via-slate-900 dark:to-slate-900",
                icon: "from-emerald-600 to-teal-600 shadow-emerald-500/20",
                ring: "ring-emerald-500/10",
                bar: "from-emerald-500 to-teal-500",
              },
              {
                card: "from-violet-500/10 via-white to-white dark:from-violet-500/15 dark:via-slate-900 dark:to-slate-900",
                icon: "from-violet-600 to-fuchsia-600 shadow-violet-500/20",
                ring: "ring-violet-500/10",
                bar: "from-violet-500 to-fuchsia-500",
              },
              {
                card: "from-orange-500/10 via-white to-white dark:from-orange-500/15 dark:via-slate-900 dark:to-slate-900",
                icon: "from-orange-500 to-blue-600 shadow-orange-500/20",
                ring: "ring-orange-500/10",
                bar: "from-orange-500 to-blue-500",
              },
            ][index % 4];

            return (
              <div
                key={item.key}
                className={`group relative overflow-hidden rounded-[30px] border border-slate-200 bg-gradient-to-br ${accentStyles.card} p-5 shadow-sm ring-1 ${accentStyles.ring} transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl dark:border-slate-700 dark:hover:border-slate-600`}
              >
                <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/50 blur-2xl dark:bg-white/5" />
                <div
                  className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${accentStyles.bar}`}
                />

                <div className="relative mb-5 flex items-start justify-between gap-3">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${accentStyles.icon} text-white shadow-lg transition duration-300 group-hover:scale-105`}
                  >
                    <item.icon size={22} />
                  </div>

                  {item.clickable ? (
                    <button
                      type="button"
                      onClick={item.onClick}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-800"
                      title={item.actionHint}
                    >
                      <ClipboardList size={14} />
                      Detail
                    </button>
                  ) : (
                    <div className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-500">
                      Live
                    </div>
                  )}
                </div>

                <div className="relative">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {item.label}
                  </p>

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className="text-4xl font-black tracking-tight text-slate-950 dark:text-white">
                      {loading ? "..." : item.value}
                    </p>
                  </div>

                  <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    {item.suffix}
                  </p>
                </div>
              </div>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Block className="overflow-hidden">
            <div className="relative border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 dark:from-slate-900 dark:via-indigo-900 dark:to-slate-900 px-5 py-5 text-white">
              <div className="absolute right-4 top-3">
                <div className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-blue-100 ring-1 ring-white/15 backdrop-blur">
                  <span className="h-1 w-1 rounded-full bg-emerald-400" />
                  Analisis BLUD
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                  <BarChart3 size={20} />
                </div>

                <div>
                  <h3 className="text-base font-semibold leading-tight">
                    Perbandingan Skor Total Antar BLU/BLUD
                  </h3>
                  <p className="mt-1 text-sm text-blue-100 dark:text-slate-300">
                    Perbandingan total nilai self assessment seluruh BLU/BLUD.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="h-[340px]">
                <LineChartJS
                  data={chartJsLineData}
                  options={chartJsLineOptions}
                />
              </div>
            </div>
          </Block>

          <Block className="overflow-hidden">
            {/* HEADER MENEMPEL */}
            <div className="relative border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 dark:from-slate-900 dark:via-blue-900 dark:to-slate-900 px-5 py-5 text-white">
              {/* BADGE (pojok kanan atas) */}
              <div className="absolute right-4 top-3">
                <div className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-blue-100 ring-1 ring-white/15 backdrop-blur">
                  <span className="h-1 w-1 rounded-full bg-emerald-400" />
                  Analisis Aspek
                </div>
              </div>

              {/* CONTENT */}
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                  <Layers3 size={20} />
                </div>

                <div>
                  <h3 className="text-base font-semibold leading-tight">
                    Kontribusi Nilai per Aspek
                  </h3>
                  <p className="mt-1 text-sm text-blue-100 dark:text-slate-300">
                    Perencanaan, Kapabilitas, dan Hasil
                  </p>
                </div>
              </div>
            </div>

            {/* CONTENT */}
            <div className="p-5">
              <div className="h-[340px]">
                {pieData.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-500 dark:text-slate-400">
                    Data belum tersedia.
                  </div>
                ) : (
                  <Pie data={chartJsPieData} options={chartJsPieOptions} />
                )}
              </div>
            </div>
          </Block>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Block className="overflow-hidden">
            <div className="relative border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 dark:from-slate-900 dark:via-blue-900 dark:to-slate-900 px-5 py-5 text-white">
              <div className="absolute right-5 top-1/2 -translate-y-1/2">
                <SectionBludFilter />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                  <ClipboardList size={20} />
                </div>

                <div>
                  <h3 className="text-base font-semibold leading-tight">
                    Distribusi per BLU/BLUD
                  </h3>
                  {viewerRole !== "BPKP_ADMIN" ? (
                    <p className="mt-1 text-sm text-blue-100 dark:text-slate-300">
                      Skor di bawah 3, AOI, dan tindak lanjut tiap BLU/BLUD.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-blue-50/40 to-white p-5 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900">
                <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-20 left-8 h-44 w-44 rounded-full bg-indigo-500/10 blur-3xl" />

                <div className="relative mb-5 flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                      Monitoring
                    </div>
                    <p className="mt-3 text-base font-black text-slate-950 dark:text-white">
                      Distribusi per BLU/BLUD
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Progress dihitung langsung dari tindak lanjut yang
                      tersimpan di database.
                    </p>
                  </div>
                </div>

                {filteredInfographicRows.length === 0 ? (
                  <div className="relative rounded-3xl border border-dashed border-slate-300 bg-white/80 px-4 py-10 text-center text-sm text-slate-500 shadow-sm dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-400">
                    Data distribusi per BLUD belum tersedia untuk tahun yang
                    dipilih.
                  </div>
                ) : (
                  <div className="relative space-y-4">
                    {filteredInfographicRows.map((item, index) => {
                      const completionRate =
                        item.aoiCount > 0
                          ? Math.min(
                              (item.followUpCount / item.aoiCount) * 100,
                              100,
                            )
                          : 0;

                      const metricCards = [
                        {
                          label: "Skor < 3",
                          value: item.lowScoreParameterCount,
                          style:
                            "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-300",
                        },
                        {
                          label: "AOI",
                          value: item.aoiCount,
                          style:
                            "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/35 dark:text-indigo-300",
                        },
                        {
                          label: "Tindak Lanjut",
                          value: item.followUpCount,
                          style:
                            "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/35 dark:text-cyan-300",
                        },
                      ];

                      return (
                        <div
                          key={`${item.bludId}-${index}`}
                          className="group relative overflow-hidden rounded-[30px] border border-slate-200 bg-white/95 p-5 shadow-sm ring-1 ring-blue-500/5 transition duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl dark:border-slate-700 dark:bg-slate-900/95 dark:hover:border-blue-800"
                        >
                          <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-500/10 blur-2xl" />

                          <div className="relative flex flex-col gap-5">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                              <div className="flex min-w-0 items-center gap-4">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 text-base font-black text-white shadow-lg shadow-blue-500/20 transition duration-300 group-hover:scale-105 dark:from-slate-950 dark:to-blue-800 dark:shadow-blue-900/20">
                                  {index + 1}
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate text-base font-black text-slate-950 dark:text-white">
                                    {item.bludName}
                                  </p>
                                  <div className="mt-1 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                    {item.bludCode}
                                  </div>
                                </div>
                              </div>

                              <div className="grid flex-1 grid-cols-3 gap-3 xl:max-w-[360px]">
                                {metricCards.map((metric) => (
                                  <div
                                    key={metric.label}
                                    className={`rounded-2xl border px-3 py-3 text-center shadow-sm ${metric.style}`}
                                  >
                                    <p className="flex min-h-[30px] items-center justify-center text-[10px] font-black uppercase leading-tight tracking-[0.14em]">
                                      {metric.label}
                                    </p>
                                    <p className="mt-2 text-3xl font-black leading-none tabular-nums text-slate-950 dark:text-white">
                                      {formatNumber(metric.value, 0)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                              <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-semibold">
                                  Progress tindak lanjut terhadap AOI
                                </span>
                                <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-black text-blue-700 dark:border-blue-900/60 dark:bg-slate-900 dark:text-blue-300">
                                  {formatNumber(completionRate, 0)}%
                                </span>
                              </div>

                              <div className="h-3 overflow-hidden rounded-full bg-slate-200/70 shadow-inner dark:bg-slate-700">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 shadow-sm transition-all duration-700 dark:from-slate-950 dark:via-blue-700 dark:to-cyan-400"
                                  style={{ width: `${completionRate}%` }}
                                />
                              </div>

                              {!!item.followUpEntryCount &&
                              item.followUpEntryCount > 0 ? (
                                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                                  Total entri TL:{" "}
                                  <span className="font-black text-slate-700 dark:text-slate-200">
                                    {formatNumber(item.followUpEntryCount, 0)}
                                  </span>
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Block>

          <Block className="overflow-hidden">
            {/* HEADER */}
            <div className="relative border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 dark:from-slate-900 dark:via-blue-900 dark:to-slate-900 px-5 py-5 text-white">
              {/* FILTER POJOK KANAN */}
              <div className="absolute right-5 top-1/2 flex -translate-y-1/2 flex-col items-end gap-1">
                {viewerRole !== "BPKP_ADMIN" ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ring-1 backdrop-blur ${filteredBadge.tone}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        badgeDotColorMap[filteredBadge.label] ?? "bg-slate-400"
                      }`}
                    />
                    {filteredBadge.label}
                  </span>
                ) : null}
                <SectionBludFilter compact />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                  <TrendingUp size={20} />
                </div>

                <div>
                  <h3 className="text-base font-semibold leading-tight">
                    Ringkasan Status Capaian
                  </h3>
                  {viewerRole !== "BPKP_ADMIN" ? (
                    <p className="mt-1 text-sm text-blue-100 dark:text-slate-300">
                      Ringkasan performa capaian berdasarkan masing-masing aspek.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* CONTENT */}
            <div className="p-6">
              <div className="space-y-3">
                {filteredAspectResults.map((item, index) => {
                  const tone = getAchievementLabel(item.achievement);
                  const progressWidth = Math.min(item.achievement, 100);
                  const statusStyles =
                    item.achievement >= 85
                      ? {
                          card: "from-emerald-500/10 via-white to-white dark:from-emerald-500/15 dark:via-slate-900 dark:to-slate-900",
                          icon: "from-emerald-500 to-teal-600",
                          progress: "from-emerald-500 via-teal-500 to-cyan-500",
                          badge:
                            "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
                          dot: "bg-emerald-500",
                        }
                      : item.achievement >= 70
                        ? {
                            card: "from-blue-500/10 via-white to-white dark:from-blue-500/15 dark:via-slate-900 dark:to-slate-900",
                            icon: "from-blue-500 to-indigo-600",
                            progress:
                              "from-blue-500 via-indigo-500 to-violet-500",
                            badge:
                              "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
                            dot: "bg-blue-500",
                          }
                        : item.achievement >= 55
                          ? {
                              card: "from-blue-500/10 via-white to-white dark:from-blue-500/15 dark:via-slate-900 dark:to-slate-900",
                              icon: "from-blue-500 to-orange-600",
                              progress:
                                "from-blue-500 via-orange-500 to-blue-500",
                              badge:
                                "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
                              dot: "bg-blue-500",
                            }
                          : {
                              card: "from-blue-500/10 via-white to-white dark:from-blue-500/15 dark:via-slate-900 dark:to-slate-900",
                              icon: "from-blue-500 to-blue-600",
                              progress:
                                "from-blue-700 via-blue-600 to-cyan-500 dark:from-slate-950 dark:via-blue-800 dark:to-blue-500",
                              badge:
                                "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
                              dot: "bg-blue-500",
                            };

                  return (
                    <div
                      key={item.aspect}
                      className={`group relative overflow-hidden rounded-[26px] border border-slate-200 bg-gradient-to-br ${statusStyles.card} p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg dark:border-slate-700 dark:hover:border-slate-600`}
                    >
                      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/60 blur-2xl dark:bg-white/5" />

                      <div className="relative flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-3">
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${statusStyles.icon} text-sm font-black text-white shadow-lg transition duration-300 group-hover:scale-105`}
                          >
                            {index + 1}
                          </div>

                          <div className="min-w-0">
                            <p className="text-base font-black text-slate-950 dark:text-white">
                              {aspectLabelMap[item.aspect] ?? item.aspect}
                            </p>
                            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                              {item.parameterCount} parameter · nilai{" "}
                              <span className="font-bold text-slate-700 dark:text-slate-200">
                                {formatNumber(item.totalWeighted, 2)}
                              </span>{" "}
                              / {formatNumber(item.totalMax, 2)}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-1.5 text-xs font-black ${statusStyles.badge}`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${statusStyles.dot}`}
                          />
                          {formatNumber(item.achievement, 2)}%
                        </span>
                      </div>

                      <div className="relative mt-5">
                        <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          <span>Progress Capaian</span>
                          <span>{tone.label}</span>
                        </div>

                        <div className="h-3 overflow-hidden rounded-full bg-slate-100 shadow-inner dark:bg-slate-800">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${statusStyles.progress} shadow-sm transition-all duration-700`}
                            style={{
                              width: `${progressWidth}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Block>
        </section>

        {shouldShowParameterDetail ? (
          <section>
            <Block className="overflow-hidden">
              {/* HEADER */}
              <div className="relative border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 dark:from-slate-900 dark:via-blue-900 dark:to-slate-900 px-5 py-5 text-white">
                <div className="absolute right-4 top-3">
                  <div className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-blue-100 ring-1 ring-white/15 backdrop-blur">
                    <span className="h-1 w-1 rounded-full bg-emerald-400" />
                    {parameterResults.length} Parameter
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                    <ClipboardList size={20} />
                  </div>

                  <div>
                    <h3 className="text-base font-semibold leading-tight">
                      Rincian Skor Tiap Parameter
                    </h3>
                    <p className="mt-1 text-sm text-blue-100 dark:text-slate-300">
                      Distribusi skor dan nilai akhir setiap parameter self
                      assessment.
                    </p>
                  </div>
                </div>
              </div>

              {/* CONTENT */}
              <div className="p-6">
                <div className="[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden grid max-h-[520px] gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
                  {parameterResults.map((item, index) => (
                    <div
                      key={item.id}
                      className="group relative flex flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-gradient-to-br from-white via-blue-50/20 to-white p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700 dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900"
                    >
                      <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-blue-500/10 blur-2xl" />

                      <div className="relative flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-white">
                            {item.label}
                          </p>
                        </div>

                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-black text-white shadow-lg">
                          {index + 1}
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <div>
                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>Skor rata-rata</span>
                            <span className="font-bold text-slate-800 dark:text-white">
                              {formatNumber(item.rawScore, 2)} / 5
                            </span>
                          </div>

                          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 transition-all duration-700"
                              style={{
                                width: `${Math.min((item.rawScore / 5) * 100, 100)}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">
                            Nilai
                          </span>
                          <span className="text-sm font-black text-slate-900 dark:text-white">
                            {formatNumber(item.weightedScore, 5)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                          <span>{item.responseCount} response</span>
                          <span>Bobot {formatNumber(item.maxScore, 3)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Block>
          </section>
        ) : null}
      </div>

      <BludResponseModal
        open={showBludModal}
        onClose={() => setShowBludModal(false)}
        year={year}
        bludScores={bludScores}
        totalBluds={summary.totalBluds}
      />

      <RejectedInfoDashboardModal
        open={showRejectedModal}
        onClose={() => setShowRejectedModal(false)}
        rows={rejectSummary.rows}
      />
    </div>
  );
}
