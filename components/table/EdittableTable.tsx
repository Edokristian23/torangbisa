"use client";

import { PAGE_CONFIG } from "@/components/config/page-config";
import { PAGE_PARAMETER_OPTIONS } from "@/components/config/page-parameter-options";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  isBpkpGlobalFilterRole,
  useBpkpGlobalFilterStore,
} from "../../stores/useBpkpGlobalFilterStore";
import {
  CalendarDays,
  CheckCircle2,
  Eye,
  FileText,
  LayoutDashboard,
  Loader2,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  Upload,
  X,
  Pencil,
  MessageSquareText,
  ThumbsDown,
  BadgeAlert,
} from "lucide-react";

type DocumentItem = {
  id: string;
  name: string;
  originalName: string;
  url: string;
  type: string;
  sourceParameter?: string;
  fileExtension?: string;
  isPersisted?: boolean;
  cleanupOnCancel?: boolean;
};

type Row = {
  id: string;
  parameterId: number;
  parameter: string;
  criteriaCode: string;
  criteriaLabel: string;
  criteriaScore: number;
  aoi: string;
  documents: DocumentItem[];
  createdByRole?: string | null;
  createdByName?: string | null;
  reviewStatus?: "pending" | "accepted" | "rejected" | null;
  reviewNotes?: string | null;
  reviewedAt?: string | null;

  // tambahan histori revisi
  isRevision?: boolean;
  revisionNumber?: number | null;
  lastRejectedAt?: string | null;
  lastRejectedByName?: string | null;
  previousCriteriaCode?: string | null;
  previousCriteriaLabel?: string | null;
  previousCriteriaScore?: number | null;
  previousAoi?: string | null;
  previousDocuments?: DocumentItem[];
};

type FormRow = Row & { customFileName: string };

type BludOption = {
  id: string;
  code: string;
  name: string;
};

type AssessmentPayload = {
  periodId: string | null;
  status: string;
  statusLabel: string;
  reviewerNotes?: string;
  submittedAt?: string | null;
  globalSubmittedAt?: string | null;
  submittedToBpkpAt?: string | null;
  reviewedAt?: string | null;
  canEdit: boolean;
  canSubmit: boolean;
  canReview: boolean;
  userRole?: string;
  blud?: BludOption | null;
  bludOptions?: BludOption[];
  rows: Row[];
  daMode?: DaMode;
  sourceRows?: Row[];

  totalCompletedParametersAllModules?: number;
  totalAcceptedParametersAllModules?: number;
};

type ExistingDocumentState = {
  open: boolean;
  document: DocumentItem | null;
  isEdit: boolean;
  fileName: string;
  customName: string;
};

type FormErrors = {
  parameter?: string;
  criteria?: string;
  aoi?: string;
  documents?: string;
  customFileName?: string;
};

type LoadingAction =
  | "uploading_document"
  | "creating_assessment"
  | "updating_assessment"
  | "reviewing_assessment"
  | "submitting_workflow"
  | null;

type DaMode = "manual" | "tarik_data";

type ReviewState = {
  open: boolean;
  row: Row | null;
  actionLoading: boolean;
};

type RejectState = {
  open: boolean;
  row: Row | null;
  reason: string;
  actionLoading: boolean;
  error: string | null;
};

type RejectedInfoState = {
  open: boolean;
  rows: Row[];
};

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FILES_PER_PARAM = 5;
const REQUIRED_OPERATOR_PARAMS_FOR_SUBMIT = 28;
const ALLOWED_EXTENSIONS = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "doc",
  "docx",
  "xls",
  "xlsx",
];

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      message:
        text.startsWith("<!DOCTYPE") || text.startsWith("<html")
          ? "Server mengembalikan halaman HTML, bukan JSON. Cek route API / error server."
          : "Response API tidak valid / bukan JSON.",
      raw: text,
    };
  }
}

let sessionRoleRequestPromise: Promise<string> | null = null;

async function fetchSessionUserRoleOnce() {
  if (!sessionRoleRequestPromise) {
    sessionRoleRequestPromise = fetch("/api/auth/session", {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Gagal membaca session role.");
        }

        const payload = await parseJsonSafe(response);
        return String(payload?.user?.role || "").toUpperCase();
      })
      .catch((error) => {
        sessionRoleRequestPromise = null;
        throw error;
      });
  }

  return sessionRoleRequestPromise;
}

function getLoadingMeta(action: LoadingAction) {
  switch (action) {
    case "uploading_document":
      return {
        title: "Mengunggah dokumen",
        subtitle: "Dokumen sedang diunggah dan diverifikasi oleh sistem.",
        status: "Upload",
        process: "Validasi File",
        target: "Document Storage",
        progressLabel: "Sinkronisasi dokumen",
        info: "Mohon tunggu sebentar. Dokumen sedang diproses agar tersimpan dengan aman dan siap digunakan pada assessment ini.",
        buttonLabel: "Mengunggah...",
        inlineLabel: "Sedang mengunggah dokumen, mohon tunggu...",
      };
    case "creating_assessment":
      return {
        title: "Menyimpan assessment",
        subtitle: "Data assessment baru sedang disimpan ke sistem.",
        status: "Menyimpan",
        process: "Create Record",
        target: "Database",
        progressLabel: "Sinkronisasi assessment",
        info: "Mohon tunggu sebentar. Parameter, kriteria, AOI, dan dokumen sedang disimpan agar konsisten di sistem.",
        buttonLabel: "Menyimpan...",
        inlineLabel: "Sedang menyimpan assessment, mohon tunggu...",
      };
    case "updating_assessment":
      return {
        title: "Memperbarui assessment",
        subtitle: "Perubahan assessment sedang diperbarui ke sistem.",
        status: "Memperbarui",
        process: "Update Record",
        target: "Database",
        progressLabel: "Sinkronisasi perubahan",
        info: "Mohon tunggu sebentar. Perubahan assessment sedang diproses agar data tetap akurat dan konsisten.",
        buttonLabel: "Memperbarui...",
        inlineLabel: "Sedang memperbarui assessment, mohon tunggu...",
      };
    case "reviewing_assessment":
      return {
        title: "Memproses review assessment",
        subtitle: "Keputusan review sedang disimpan ke sistem.",
        status: "Review",
        process: "Workflow Review",
        target: "Database",
        progressLabel: "Sinkronisasi keputusan review",
        info: "Mohon tunggu sebentar. Status review dan catatan keputusan sedang diproses agar tercatat dengan akurat.",
        buttonLabel: "Memproses...",
        inlineLabel: "Sedang memproses review assessment, mohon tunggu...",
      };
    case "submitting_workflow":
      return {
        title: "Mengirim assessment",
        subtitle: "Assessment sedang dikirim ke tahap berikutnya.",
        status: "Submit",
        process: "Workflow Submission",
        target: "Reviewer",
        progressLabel: "Sinkronisasi pengiriman",
        info: "Mohon tunggu sebentar. Sistem sedang memvalidasi kelengkapan assessment dan meneruskan data ke tahap review berikutnya.",
        buttonLabel: "Mengirim...",
        inlineLabel: "Sedang mengirim assessment, mohon tunggu...",
      };
    default:
      return {
        title: "Sedang memproses",
        subtitle: "Sistem sedang menyimpan perubahan Anda.",
        status: "Memproses",
        process: "Validasi",
        target: "Database",
        progressLabel: "Sinkronisasi data",
        info: "Mohon tunggu sebentar. Data assessment dan dokumen sedang diproses agar tersimpan dengan aman dan konsisten di sistem.",
        buttonLabel: "Sedang diproses...",
        inlineLabel: "Sedang mengunggah / menyimpan data, mohon tunggu...",
      };
  }
}

function isAoiRequired(criteriaScore: number) {
  return criteriaScore < 3;
}

function isEvidenceRequired(criteriaScore: number) {
  return criteriaScore > 1;
}

function getEvidenceGuidance(criteriaScore: number) {
  if (criteriaScore > 1) {
    return {
      required: true,
      tone: "amber",
      title: "Upload Evidence wajib",
      description:
        "Karena skor parameter berada pada Level 2 atau lebih, evidence wajib diunggah sebelum assessment dapat disimpan.",
    };
  }

  return {
    required: false,
    tone: "emerald",
    title: "Upload Evidence opsional",
    description:
      "Karena skor parameter Level 1, evidence bersifat opsional. Anda tetap dapat mengunggah evidence bila diperlukan.",
  };
}

function getAoiGuidance(criteriaScore: number) {
  if (criteriaScore < 3) {
    return {
      required: true,
      tone: "amber",
      title: "AOI wajib diisi",
      description:
        "Karena kriteria yang dipilih berada di bawah Level 3, Area of Improvement wajib dilengkapi sebagai rencana tindak lanjut perbaikan.",
    };
  }

  return {
    required: false,
    tone: "emerald",
    title: "AOI bersifat opsional",
    description:
      "Karena kriteria yang dipilih berada pada Level 3 atau lebih, Area of Improvement bersifat opsional. Anda tetap dapat mengisi AOI bila diperlukan untuk penguatan atau continuous improvement.",
  };
}

function getReviewTone(status?: Row["reviewStatus"], isRevision?: boolean) {
  if (status === "accepted") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "rejected") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (isRevision) {
    return "border-indigo-200 bg-indigo-50 text-indigo-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function getReviewLabel(status?: Row["reviewStatus"], isRevision?: boolean) {
  if (status === "accepted") return "Accepted";
  if (status === "rejected") return "Rejected";
  if (isRevision) return "Pending Revision Review";
  return "Pending Review";
}

function ModalShell({
  title,
  children,
  onClose,
  onSave,
  saveLabel = "Simpan",
  saveDisabled = false,
  saving = false,
  loadingAction = null,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  saving?: boolean;
  loadingAction?: LoadingAction;
}) {
  const loadingMeta = getLoadingMeta(loadingAction);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/60 px-4 py-6 backdrop-blur-md">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[34px] border border-white/20 bg-white shadow-2xl ring-1 ring-slate-900/5 dark:border-slate-700 dark:bg-slate-950">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {saving && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/20 backdrop-blur-[3px]">
              <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="relative overflow-hidden border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 dark:from-slate-900 dark:via-indigo-900 dark:to-slate-900 px-5 py-4 text-white">
                  <div className="relative flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                      <Loader2 size={20} className="animate-spin" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold tracking-wide">
                        {loadingMeta.title}
                      </p>
                      <p className="text-xs text-blue-50 dark:text-slate-200">
                        {loadingMeta.subtitle}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 px-5 py-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-blue-100 dark:text-slate-300">
                        {loadingMeta.progressLabel}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500">
                        Mohon tunggu
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-400 dark:from-indigo-500 dark:via-sky-500 dark:to-emerald-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-3">
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">
                        Status
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-blue-50 dark:text-slate-200">
                        {loadingMeta.status}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-3">
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">
                        Proses
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-blue-50 dark:text-slate-200">
                        {loadingMeta.process}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-3">
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">
                        Tujuan
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-blue-50 dark:text-slate-200">
                        {loadingMeta.target}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                    <p className="text-xs leading-5 text-indigo-900">
                      {loadingMeta.info}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="relative z-10 shrink-0 overflow-hidden border-b border-white/10 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 px-6 py-4 text-white">
            <div className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="pointer-events-none absolute left-1/3 -bottom-16 h-36 w-36 rounded-full bg-violet-500/15 blur-3xl" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 shadow-sm ring-1 ring-white/20 backdrop-blur">
                  <Plus size={18} />
                </div>
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-blue-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Assessment Form
                  </div>
                  <h3 className="mt-1.5 text-lg font-black leading-tight tracking-tight">
                    {title}
                  </h3>
                  <p className="mt-0.5 text-xs leading-5 text-blue-50 dark:text-slate-200">
                    Lengkapi parameter, kriteria, AOI, dan dokumen pendukung.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={saving}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white shadow-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Tutup modal"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-6 py-6 dark:bg-slate-950">
            {children}
          </div>

          <div className="shrink-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-5 py-3 shadow-[0_-8px_20px_rgba(15,23,42,0.05)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              disabled={saving || saveDisabled}
              onClick={onSave}
              title={saveDisabled ? "Lengkapi semua field terlebih dahulu" : ""}
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-black transition enabled:bg-gradient-to-r enabled:from-blue-700 enabled:via-blue-600 enabled:to-cyan-500 enabled:text-white enabled:shadow-lg enabled:shadow-blue-500/20 dark:enabled:shadow-blue-900/20 enabled:hover:-translate-y-0.5 enabled:hover:shadow-xl disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:enabled:from-blue-600 dark:enabled:to-violet-600 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? loadingMeta.buttonLabel : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewModal({
  row,
  open,
  onClose,
  onReject,
  onAccept,
  loading,
}: {
  row: Row | null;
  open: boolean;
  onClose: () => void;
  onReject: () => void;
  onAccept: () => void;
  loading: boolean;
}) {
  if (!open || !row) return null;

  return (
    <div className="[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden fixed inset-0 z-[90] overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center">
        <div className="flex h-[calc(100vh-80px)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 dark:from-slate-900 dark:via-indigo-900 dark:to-slate-900 px-6 py-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100 dark:text-slate-300">
                  Review Assessment
                </p>
                <h3 className="mt-2 text-lg font-semibold">{row.parameter}</h3>
                <p className="mt-1 text-sm text-blue-50 dark:text-slate-200">
                  Review inputan assessment yang dibuat oleh blud.operator
                </p>
              </div>

              <button
                onClick={onClose}
                disabled={loading}
                className="rounded-xl border border-white/15 bg-white/10 p-2 text-white transition hover:bg-white/15 disabled:opacity-40"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden max-h-[calc(100vh-220px)] overflow-y-auto px-6 py-6">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  Parameter
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {row.parameter}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  Status Review
                </p>
                <div className="mt-2">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getReviewTone(row.reviewStatus, row.isRevision)}`}
                  >
                    {getReviewLabel(row.reviewStatus, row.isRevision)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                Kriteria
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-800 dark:text-blue-50 dark:text-slate-200">
                {row.criteriaLabel}
              </p>
              <p className="mt-2 text-sm font-semibold text-indigo-700">
                Skor: {row.criteriaScore}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                Area of Improvement
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800 dark:text-blue-50 dark:text-slate-200">
                {row.aoi || "-"}
              </p>
            </div>

            {row.reviewNotes ? (
              <div className="mt-4 mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Log Reject Sebelumnya
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-800">
                  {row.reviewNotes}
                </p>

                {row.lastRejectedAt ? (
                  <p className="mt-2 text-xs text-amber-700">
                    Tanggal reject terakhir: {row.lastRejectedAt}
                  </p>
                ) : null}
              </div>
            ) : null}

            {row.isRevision ? (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-indigo-700">
                  Sudah direvisi operator
                </p>
                <p className="mt-1 text-xs leading-5 text-indigo-800">
                  Baris ini adalah hasil perbaikan dari reject sebelumnya.
                </p>

                <div className="mt-2 space-y-1 text-[11px] text-indigo-900">
                  {row.previousCriteriaLabel &&
                  row.previousCriteriaLabel !== row.criteriaLabel ? (
                    <p>
                      <span className="font-semibold">Kriteria:</span>{" "}
                      {row.previousCriteriaLabel} → {row.criteriaLabel}
                    </p>
                  ) : null}

                  {(row.previousAoi || "") !== (row.aoi || "") ? (
                    <p>
                      <span className="font-semibold">AOI:</span> telah
                      diperbarui
                    </p>
                  ) : null}

                  {Array.isArray(row.previousDocuments) &&
                  row.previousDocuments.length !== row.documents.length ? (
                    <p>
                      <span className="font-semibold">Dokumen:</span> jumlah
                      dokumen berubah
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {row.isRevision && row.previousCriteriaLabel !== undefined ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 dark:text-slate-500">
                  Perbandingan Sebelum dan Sesudah Revisi
                </p>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      Sebelum Revisi
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {row.previousCriteriaLabel || "-"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-500">
                      Skor: {row.previousCriteriaScore ?? "-"}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800 dark:text-blue-50 dark:text-slate-200">
                      {row.previousAoi || "-"}
                    </p>

                    <div className="mt-3 space-y-2">
                      {(row.previousDocuments || []).length > 0 ? (
                        (row.previousDocuments || []).map((doc) => (
                          <div
                            key={doc.id}
                            className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs text-slate-700"
                          >
                            {doc.name}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                          Tidak ada dokumen snapshot.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      Setelah Revisi
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {row.criteriaLabel}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-500">
                      Skor: {row.criteriaScore}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800 dark:text-blue-50 dark:text-slate-200">
                      {row.aoi || "-"}
                    </p>

                    <div className="mt-3 space-y-2">
                      {row.documents.length > 0 ? (
                        row.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs text-slate-700"
                          >
                            {doc.name}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                          Tidak ada dokumen.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                Dokumen Pendukung
              </p>

              {row.documents.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  Belum ada dokumen pendukung.
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {row.documents.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-4 py-3 text-sm hover:bg-slate-100 dark:bg-slate-800"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                          {doc.name}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                          {doc.originalName}
                        </p>
                      </div>
                      <Eye size={14} className="shrink-0 text-slate-500" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {row.reviewNotes ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                  Alasan Reject Sebelumnya
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-red-800">
                  {row.reviewNotes}
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:border-slate-800 dark:bg-slate-800 px-6 py-4">
            <button
              onClick={onReject}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-40"
            >
              <ThumbsDown size={16} />
              Reject
            </button>

            <button
              onClick={onAccept}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RejectReasonModal({
  open,
  row,
  reason,
  error,
  loading,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  row: Row | null;
  reason: string;
  error: string | null;
  loading: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!open || !row) return null;

  return (
    <div className="[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden fixed inset-0 z-[95] overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center">
        <div className="flex max-h-[calc(100vh-80px)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 dark:from-slate-900 dark:via-red-900 dark:to-slate-900 px-6 py-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100 dark:text-slate-300">
                  Reject Review
                </p>
                <h3 className="mt-2 text-lg font-semibold">
                  Alasan Reject Assessment
                </h3>
                <p className="mt-1 text-sm text-blue-50 dark:text-slate-200">
                  Berikan alasan yang jelas, profesional, dan dapat
                  ditindaklanjuti oleh blud.operator.
                </p>
              </div>

              <button
                onClick={onClose}
                disabled={loading}
                className="rounded-xl border border-white/15 bg-white/10 p-2 text-white transition hover:bg-white/15 disabled:opacity-40"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden max-h-[calc(100vh-220px)] overflow-y-auto px-6 py-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                Parameter yang direview
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {row.parameter}
              </p>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-blue-50 dark:text-slate-200">
                Alasan Reject <span className="text-red-500">*</span>
              </label>

              <textarea
                value={reason}
                onChange={(e) => onChange(e.target.value)}
                rows={6}
                placeholder="Tuliskan alasan reject secara spesifik, profesional, dan mudah dipahami. Contoh: Dokumen pendukung belum sesuai dengan kriteria yang dipilih dan AOI masih terlalu umum sehingga perlu diperjelas."
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${
                  error
                    ? "border-red-400 bg-red-50 focus:border-red-500"
                    : "border-slate-200 focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                }`}
              />

              {error ? (
                <p className="mt-2 text-xs font-medium text-red-600">{error}</p>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:border-slate-800 dark:bg-slate-800 px-6 py-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:bg-slate-800 disabled:opacity-40"
            >
              Batal
            </button>

            <button
              onClick={onSubmit}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-40"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ThumbsDown size={16} />
              )}
              Simpan Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RejectedInfoModal({
  open,
  rows,
  onClose,
  onOpenEdit,
}: {
  open: boolean;
  rows: Row[];
  onClose: () => void;
  onOpenEdit: (row: Row) => void;
}) {
  if (!open || rows.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 dark:from-slate-950 dark:via-amber-900 dark:to-slate-950 px-6 py-5 text-white">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <BadgeAlert size={22} />
            </div>

            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100 dark:text-slate-300">
                Informasi Review
              </p>
              <h3 className="mt-2 text-lg font-semibold">
                Terdapat {rows.length} parameter yang direject oleh Admin BLUD
              </h3>
              <p className="mt-1 text-sm text-blue-50 dark:text-slate-200">
                Klik salah satu parameter di bawah untuk melakukan perbaikan.
              </p>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl border border-white/15 bg-white/10 p-2 text-white transition hover:bg-white/15"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden max-h-[calc(100vh-220px)] overflow-y-auto px-6 py-6">
          <div className="space-y-3">
            {rows.map((row, index) => (
              <button
                key={row.id}
                type="button"
                onClick={() => onOpenEdit(row)}
                className="w-full rounded-xl border border-red-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                        {index + 1}
                      </span>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {row.parameter}
                      </p>
                    </div>

                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">
                        Catatan Reject
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-red-800">
                        {row.reviewNotes || "-"}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <div className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">
                      <Pencil size={14} />
                      Perbaiki
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:border-slate-800 dark:bg-slate-800 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

function FormBody({
  data,
  isEdit = false,
  availableParameters,
  criteriaByParameterId,
  updateFormParameter,
  updateFormCriteria,
  setEditingRow,
  setFormRow,
  uploadDocuments,
  removeDocument,
  isEditable,
  formErrors,
  clearFormError,
  formSuccessMessage,
  setFormSuccessMessage,
  saving = false,
  loadingAction = null,
}: {
  data: FormRow;
  isEdit?: boolean;
  availableParameters: any[];
  criteriaByParameterId: Record<number, any[]>;
  updateFormParameter: (parameterId: number) => void;
  updateFormCriteria: (value: string, isEdit?: boolean) => void;
  setEditingRow: React.Dispatch<React.SetStateAction<FormRow | null>>;
  setFormRow: React.Dispatch<React.SetStateAction<FormRow | null>>;
  uploadDocuments: (files: FileList, isEdit?: boolean) => Promise<void>;
  removeDocument: (docId: string, isEdit?: boolean) => void;
  isEditable: boolean;
  formErrors: FormErrors;
  clearFormError: (
    field: "parameter" | "criteria" | "aoi" | "documents" | "customFileName",
  ) => void;
  formSuccessMessage?: string | null;
  setFormSuccessMessage?: React.Dispatch<React.SetStateAction<string | null>>;
  saving?: boolean;
  loadingAction?: LoadingAction;
}) {
  const currentCriteria = criteriaByParameterId[data.parameterId] || [];
  const loadingMeta = getLoadingMeta(loadingAction);
  const criteriaScore = Number(data.criteriaScore);

  const aoiRule = getAoiGuidance(criteriaScore);
  const evidenceRule = getEvidenceGuidance(criteriaScore);

  const isLastEvidenceLocked =
    isEvidenceRequired(criteriaScore) && data.documents.length <= 1;
  const isMaxDocumentsReached = data.documents.length >= MAX_FILES_PER_PARAM;

  const isDisabledUpload = !data.customFileName.trim() || isMaxDocumentsReached;

  return (
    <div className="space-y-5">
      {!isEdit && (
        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Parameter
          </label>
          <select
            value={data.parameterId}
            onChange={(e) => {
              clearFormError("parameter");
              updateFormParameter(Number(e.target.value));
            }}
            className={`h-14 w-full rounded-xl border bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:bg-slate-900 dark:text-white ${
              formErrors.parameter
                ? "border-red-400 bg-red-50 dark:bg-red-950/20"
                : "border-slate-200 dark:border-slate-700"
            }`}
          >
            {availableParameters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          {formErrors.parameter && (
            <p className="mt-2 text-xs font-medium text-red-600">
              {formErrors.parameter}
            </p>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label className="block text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Kriteria
          </label>
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
            Skor: {data.criteriaScore || "-"}
          </div>
        </div>

        {formErrors.criteria && (
          <p className="-mt-1 text-xs font-medium text-red-600">
            {formErrors.criteria}
          </p>
        )}

        <div className="space-y-2">
          {currentCriteria.map((item: any) => {
            const active = item.code === data.criteriaCode;

            return (
              <button
                type="button"
                key={item.code}
                onClick={() => {
                  clearFormError("criteria");
                  updateFormCriteria(item.code, isEdit);
                }}
                className={`group relative w-full overflow-hidden rounded-[28px] border p-5 text-left shadow-sm transition duration-300 ${
                  active
                    ? "border-blue-500 bg-gradient-to-br from-blue-50 via-indigo-50 to-white ring-2 ring-blue-500/20 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-slate-900"
                    : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-black text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                      <span
                        className={`h-2 w-2 rounded-full ${active ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"}`}
                      />
                      Level {item.score}
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-blue-100 dark:text-slate-300">
                      {item.label}
                    </p>
                  </div>

                  {active && (
                    <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1.5 text-[11px] font-black text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                      Dipilih
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="block text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Area of Improvement (AOI)
          </label>
          <span
            className={`rounded-full px-3 py-1.5 text-[11px] font-black ${
              aoiRule.required
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {aoiRule.required ? "Wajib" : "Opsional"}
          </span>
        </div>

        <div
          className={`mb-3 rounded-xl border px-4 py-3 shadow-sm ${
            aoiRule.required
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <p
            className={`text-xs font-semibold ${
              aoiRule.required ? "text-amber-800" : "text-emerald-800"
            }`}
          >
            {aoiRule.title}
          </p>
          <p
            className={`mt-1 text-xs leading-5 ${
              aoiRule.required ? "text-amber-700" : "text-emerald-700"
            }`}
          >
            {aoiRule.description}
          </p>
        </div>

        <textarea
          value={data.aoi}
          onChange={(e) => {
            clearFormError("aoi");
            isEdit
              ? setEditingRow((prev) =>
                  prev ? { ...prev, aoi: e.target.value } : prev,
                )
              : setFormRow((prev) =>
                  prev ? { ...prev, aoi: e.target.value } : prev,
                );
          }}
          rows={3}
          className={`min-h-[110px] w-full resize-none rounded-xl border bg-white px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 ${
            formErrors.aoi
              ? "border-red-400 bg-red-50 dark:bg-red-950/20"
              : "border-slate-200 dark:border-slate-700"
          }`}
          placeholder={
            aoiRule.required
              ? "Wajib diisi untuk kriteria di bawah Level 3"
              : "Opsional, isi bila diperlukan"
          }
        />

        {formErrors.aoi && (
          <p className="mt-2 text-xs font-medium text-red-600">
            {formErrors.aoi}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-blue-50/50 to-slate-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900">
          {/* LEFT */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/20 dark:from-slate-900 dark:to-blue-800 dark:shadow-blue-900/20">
              <Upload size={18} />
            </div>
            <div>
              <h4 className="font-black text-slate-950 dark:text-white">
                Dokumen Pendukung
              </h4>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Upload dokumen validasi sesuai ketentuan assessment.
              </p>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:text-blue-100 dark:text-slate-300">
              Maks {MAX_FILE_SIZE_MB}MB
            </span>

            <div className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-black text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {data.documents.length}/{MAX_FILES_PER_PARAM}
            </div>

            <span
              className={`rounded-full px-3 py-1.5 text-[11px] font-black ${
                evidenceRule.required
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {evidenceRule.required ? "Wajib" : "Opsional"}
            </span>
          </div>
        </div>

        <div className="p-5">
          <div
            className={`mb-4 rounded-xl border px-4 py-3 shadow-sm ${
              evidenceRule.required
                ? "border-amber-200 bg-amber-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <p
              className={`text-xs font-semibold ${
                evidenceRule.required ? "text-amber-800" : "text-emerald-800"
              }`}
            >
              {evidenceRule.title}
            </p>
            <p
              className={`mt-1 text-xs leading-5 ${
                evidenceRule.required ? "text-amber-700" : "text-emerald-700"
              }`}
            >
              {evidenceRule.description}
            </p>
          </div>

          {saving ? (
            <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-indigo-600" />
                <p className="text-xs font-medium text-indigo-700">
                  {loadingMeta.inlineLabel}
                </p>
              </div>
            </div>
          ) : formSuccessMessage ? (
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-xs font-medium text-emerald-700">
                {formSuccessMessage}
              </p>
            </div>
          ) : null}

          <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
            <div className="space-y-1">
              <label className="block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Nama Dokumen
              </label>

              <input
                type="text"
                disabled={isMaxDocumentsReached}
                value={data.customFileName}
                onChange={(e) => {
                  clearFormError("customFileName");
                  clearFormError("documents");
                  setFormSuccessMessage?.(null);
                  isEdit
                    ? setEditingRow((prev) =>
                        prev
                          ? { ...prev, customFileName: e.target.value }
                          : prev,
                      )
                    : setFormRow((prev) =>
                        prev
                          ? { ...prev, customFileName: e.target.value }
                          : prev,
                      );
                }}
                className={`w-full rounded-xl border px-4 py-3 text-sm shadow-sm outline-none transition focus:ring-4 focus:ring-blue-500/10
    ${
      isMaxDocumentsReached
        ? "cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
        : formErrors.customFileName || formErrors.documents
          ? "border-red-400 bg-red-50 focus:border-red-500"
          : "border-slate-200 focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    }
  `}
                placeholder={
                  isMaxDocumentsReached
                    ? "Maksimal 5 dokumen tercapai"
                    : "Masukkan nama dokumen"
                }
              />

              {(formErrors.customFileName || formErrors.documents) && (
                <p className="-mt-0.5 pl-1 text-[11px] leading-4 font-medium text-red-600">
                  {formErrors.customFileName || formErrors.documents}
                </p>
              )}
            </div>

            <div className="flex flex-col pt-[22px]">
              <label
                title={
                  isMaxDocumentsReached
                    ? "Maksimal 5 dokumen sudah tercapai"
                    : !data.customFileName.trim()
                      ? "Isi nama dokumen terlebih dahulu"
                      : ""
                }
                className={`inline-flex items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm font-semibold transition
    ${
      isDisabledUpload
        ? "cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
        : "cursor-pointer border-blue-300 bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100 hover:shadow-md dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60"
    }
  `}
              >
                <Upload size={16} /> Upload
                <input
                  type="file"
                  multiple
                  disabled={isDisabledUpload}
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      void uploadDocuments(files, isEdit);
                    }
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          {saving && data.documents.length === 0 ? (
            <div className="space-y-2">
              <div className="h-14 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:bg-slate-800" />
              <div className="h-14 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:bg-slate-800" />
            </div>
          ) : data.documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
              Belum ada dokumen yang terhubung ke parameter ini.
            </div>
          ) : (
            <div className="space-y-2">
              {data.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition hover:border-blue-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-800"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-blue-50 dark:text-slate-200">
                      <FileText size={15} className="text-indigo-500" />
                      <span className="truncate">{doc.name}</span>
                    </div>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      {doc.originalName}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        window.open(doc.url, "_blank", "noopener,noreferrer")
                      }
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={!isEditable || isLastEvidenceLocked}
                      onClick={() => removeDocument(doc.id, isEdit)}
                      title={
                        isLastEvidenceLocked
                          ? "Minimal 1 evidence wajib ada karena level parameter lebih dari 1."
                          : undefined
                      }
                      className="rounded-xl border border-red-200 bg-white p-2.5 text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function normalizeUploadedDocument(doc: any): DocumentItem {
  return {
    id: String(doc.id),
    name: String(doc.name || ""),
    originalName: String(doc.originalName || ""),
    url: String(doc.url || ""),
    type: String(doc.type || "application/octet-stream"),
    sourceParameter: doc.sourceParameter
      ? String(doc.sourceParameter)
      : undefined,
    fileExtension: doc.fileExtension ? String(doc.fileExtension) : undefined,
    isPersisted: Boolean(doc.isPersisted),
    cleanupOnCancel: Boolean(doc.cleanupOnCancel),
  };
}

export default function EdittableTable({
  currentPage,
}: {
  currentPage: string;
}) {
  const globalYear = useBpkpGlobalFilterStore((state) => state.selectedYear);
  const setGlobalYear = useBpkpGlobalFilterStore(
    (state) => state.setSelectedYear,
  );
  const globalBludCode = useBpkpGlobalFilterStore(
    (state) => state.selectedBludCode,
  );
  const setGlobalBlud = useBpkpGlobalFilterStore(
    (state) => state.setSelectedBlud,
  );

  const [localSelectedYear, setLocalSelectedYear] = useState("2026");
  const [selectedDaMode, setSelectedDaMode] = useState<DaMode>("manual");
  const [localSelectedBludCode, setLocalSelectedBludCode] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [periodInfo, setPeriodInfo] = useState<AssessmentPayload | null>(null);
  const showExportPdf = false;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [formRow, setFormRow] = useState<FormRow | null>(null);
  const [editingRow, setEditingRow] = useState<FormRow | null>(null);
  const [removedEditDocumentIds, setRemovedEditDocumentIds] = useState<
    string[]
  >([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [existingDocumentState, setExistingDocumentState] =
    useState<ExistingDocumentState>({
      open: false,
      document: null,
      isEdit: false,
      fileName: "",
      customName: "",
    });
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(
    null,
  );
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [sessionUserRole, setSessionUserRole] = useState("");
  const [isSessionRoleReady, setIsSessionRoleReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const resolveSessionRole = async () => {
      try {
        const nextRole = await fetchSessionUserRoleOnce();

        if (isMounted) {
          setSessionUserRole(nextRole);
        }
      } catch {
        if (isMounted) {
          setSessionUserRole("");
        }
      } finally {
        if (isMounted) {
          setIsSessionRoleReady(true);
        }
      }
    };

    void resolveSessionRole();

    return () => {
      isMounted = false;
    };
  }, []);

  const resolvedUserRole = String(
    periodInfo?.userRole || sessionUserRole || "",
  ).toUpperCase();

  /**
   * BPKP/Admin BPKP memakai global filter BLUD.
   *
   * Penting:
   * - Role diambil dari session lebih dulu, sebelum GET /api/assessments.
   * - BLUD_OPERATOR / BLUD_ADMIN tidak pernah memakai `globalBludCode` untuk
   *   query assessment, sehingga tidak ada request awal dengan `bludCode` sisa
   *   dari global filter BPKP.
   * - BPKP / BPKP_ADMIN / BPKP_REVIEWER tetap memakai global filter BLUD, jadi
   *   request assessment langsung membawa `bludCode` saat filter sudah terpilih.
   */
  const usesBpkpGlobalFilter = isBpkpGlobalFilterRole(resolvedUserRole);

  const selectedYear = usesBpkpGlobalFilter ? globalYear : localSelectedYear;
  const setSelectedYear = usesBpkpGlobalFilter
    ? setGlobalYear
    : setLocalSelectedYear;
  const selectedBludCode = usesBpkpGlobalFilter
    ? String(globalBludCode || "").toUpperCase()
    : localSelectedBludCode;

  const effectiveFetchBludCode = usesBpkpGlobalFilter ? selectedBludCode : "";

  const setSelectedBludCode = (code: string) => {
    const normalizedCode = String(code || "").toUpperCase();

    if (usesBpkpGlobalFilter) {
      const nextBlud = periodInfo?.bludOptions?.find(
        (item) => String(item.code).toUpperCase() === normalizedCode,
      );
      setGlobalBlud(nextBlud || { code: normalizedCode });
      return;
    }

    setLocalSelectedBludCode(normalizedCode);
  };
  const [rejectedInfoState, setRejectedInfoState] = useState<RejectedInfoState>(
    {
      open: false,
      rows: [],
    },
  );

  const [deleteState, setDeleteState] = useState<{
    open: boolean;
    rowId: string | null;
    parameterName: string;
  }>({
    open: false,
    rowId: null,
    parameterName: "",
  });

  const [reviewState, setReviewState] = useState<ReviewState>({
    open: false,
    row: null,
    actionLoading: false,
  });

  const [rejectState, setRejectState] = useState<RejectState>({
    open: false,
    row: null,
    reason: "",
    actionLoading: false,
    error: null,
  });

  const pageMeta = PAGE_CONFIG[currentPage] || {
    title: "Dashboard",
    subTitle: "Overview",
    icon: LayoutDashboard,
  };
  const parameterOptions = PAGE_PARAMETER_OPTIONS[currentPage] || [];
  const criteriaByParameterId = Object.fromEntries(
    parameterOptions.map((item) => [item.id, item.criteria]),
  );
  const parameterById = Object.fromEntries(
    parameterOptions.map((item) => [item.id, item]),
  );

  const currentUserRole = resolvedUserRole;
  const isOperatorBlud = currentUserRole === "BLUD_OPERATOR";
  const isAdminBlud = currentUserRole === "BLUD_ADMIN";
  const isBpkp =
    currentUserRole === "BPKP" ||
    currentUserRole === "BPKP_ADMIN" ||
    currentUserRole === "BPKP_REVIEWER";

  useEffect(() => {
    currentUserRoleRef.current = currentUserRole;
  }, [currentUserRole]);

  const isBpkpSelfAssessmentMode = isBpkp;

  const bludOptions = Array.isArray(periodInfo?.bludOptions)
    ? periodInfo.bludOptions
    : [];
  const showBludFilter = isBpkp && bludOptions.length > 0;

  const existingParameterIds = new Set(rows.map((row) => row.parameterId));
  const availableParameters = parameterOptions.filter(
    (item) => !existingParameterIds.has(item.id),
  );

  const sourceRowsByParameterId = useMemo(() => {
    const sourceRows = Array.isArray(periodInfo?.sourceRows)
      ? periodInfo.sourceRows
      : [];

    return Object.fromEntries(sourceRows.map((row) => [row.parameterId, row]));
  }, [periodInfo?.sourceRows]);

  const progress =
    parameterOptions.length > 0
      ? Math.round((rows.length / parameterOptions.length) * 100)
      : 0;

  const isAllParametersCompleted =
    parameterOptions.length > 0 && rows.length === parameterOptions.length;

  const isExactly28ParametersCompleted =
    rows.length === REQUIRED_OPERATOR_PARAMS_FOR_SUBMIT;

  const totalCompletedParametersAllModules = Number(
    periodInfo?.totalCompletedParametersAllModules || 0,
  );

  const totalAcceptedParametersAllModules = Number(
    periodInfo?.totalAcceptedParametersAllModules || 0,
  );

  const isExactly28ParametersCompletedAllModules =
    totalCompletedParametersAllModules >= REQUIRED_OPERATOR_PARAMS_FOR_SUBMIT;

  const isEditable = isBpkpSelfAssessmentMode ? true : !!periodInfo?.canEdit;
  const showReviewAction = isBpkp ? false : !!periodInfo?.canReview;

  const hasGlobalSubmittedToAdminBlud =
    isOperatorBlud && !!periodInfo?.globalSubmittedAt;

  const hasSubmittedToAdminBlud =
    isOperatorBlud &&
    !!(periodInfo?.globalSubmittedAt || periodInfo?.submittedAt);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) =>
      [
        row.parameter,
        row.criteriaCode,
        row.criteriaLabel,
        row.aoi,
        row.reviewNotes || "",
        ...row.documents.map((doc) => doc.name),
        ...row.documents.map((doc) => doc.originalName),
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => a.parameterId - b.parameterId);
  }, [rows]);

  const lastCompletedRowId = useMemo(() => {
    if (!isExactly28ParametersCompletedAllModules || sortedRows.length === 0)
      return null;

    return sortedRows[sortedRows.length - 1]?.id ?? null;
  }, [sortedRows, isExactly28ParametersCompletedAllModules]);

  const rejectedRows = useMemo(() => {
    return rows.filter((row) => row.reviewStatus === "rejected");
  }, [rows]);

  const pendingRowsWithRejectNotes = useMemo(() => {
    return rows.filter(
      (row) =>
        row.reviewStatus === "pending" &&
        !!row.reviewNotes &&
        row.reviewNotes.trim() !== "",
    );
  }, [rows]);

  const lastRevisedRowId = useMemo(() => {
    if (pendingRowsWithRejectNotes.length === 0) return null;
    const sortedPendingRevisions = [...pendingRowsWithRejectNotes].sort(
      (a, b) => a.parameterId - b.parameterId,
    );
    return (
      sortedPendingRevisions[sortedPendingRevisions.length - 1]?.id ?? null
    );
  }, [pendingRowsWithRejectNotes]);

  const acceptedRows = useMemo(() => {
    return rows.filter((row) => row.reviewStatus === "accepted");
  }, [rows]);

  const allReviewedAccepted =
    rows.length > 0 &&
    rows.length === parameterOptions.length &&
    rows.every((row) => row.reviewStatus === "accepted");

  const hasAcceptedRequiredOperatorParams =
    totalAcceptedParametersAllModules >= REQUIRED_OPERATOR_PARAMS_FOR_SUBMIT;

  const lastAcceptedRowId = useMemo(() => {
    if (acceptedRows.length === 0) return null;

    const sortedAccepted = [...acceptedRows].sort(
      (a, b) => a.parameterId - b.parameterId,
    );

    return sortedAccepted[sortedAccepted.length - 1]?.id ?? null;
  }, [acceptedRows]);

  const hasRejectedRows = rejectedRows.length > 0;

  // Row pending + masih punya reviewNotes = kandidat draft revisi.
  // Tapi hanya dianggap BELUM resubmit kalau period masih canSubmit.
  // Setelah operator klik "Kirim ke Admin BLUD", backend umumnya akan
  // mengubah canSubmit menjadi false. Saat itu row pending ber-reviewNotes
  // tidak lagi diperlakukan sebagai draft revisi yang editable.
  const hasRevisionPendingResubmit =
    pendingRowsWithRejectNotes.length > 0 && !!periodInfo?.canSubmit;

  // Operator masih bebas edit sebelum submit ke admin.
  const hasSubmittedByOperator = hasSubmittedToAdminBlud;

  // Fase revisi:
  // 1. masih ada row rejected
  // 2. atau row reject sudah diperbaiki tetapi belum dikirim ulang
  const isOperatorInRejectedRevisionPhase =
    isOperatorBlud &&
    hasSubmittedByOperator &&
    (hasRejectedRows || hasRevisionPendingResubmit);

  // Waiting review hanya berlaku kalau:
  // - sudah pernah submit
  // - tidak ada reject aktif
  // - tidak ada draft revisi yang belum dikirim ulang
  const isOperatorWaitingAdminReview =
    isOperatorBlud &&
    hasSubmittedByOperator &&
    !hasRejectedRows &&
    !hasRevisionPendingResubmit;

  const isFormInvalid = () => {
    if (!formRow) return true;

    const aoiRequired = isAoiRequired(formRow.criteriaScore);
    const evidenceRequired = isEvidenceRequired(formRow.criteriaScore);

    return (
      !formRow.parameterId ||
      !formRow.criteriaCode ||
      (aoiRequired && !formRow.aoi.trim()) ||
      (evidenceRequired && formRow.documents.length === 0)
    );
  };

  const isEditFormInvalid = () => {
    if (!editingRow) return true;

    const aoiRequired = isAoiRequired(editingRow.criteriaScore);
    const evidenceRequired = isEvidenceRequired(editingRow.criteriaScore);

    return (
      !editingRow.criteriaCode ||
      (aoiRequired && !editingRow.aoi.trim()) ||
      (evidenceRequired && editingRow.documents.length === 0)
    );
  };

  const resetMessages = () => {
    setMessage(null);
    setError(null);
    setFormSuccessMessage?.(null);
    setLoadingAction(null);
  };

  const clearFormError = (
    field: "parameter" | "criteria" | "aoi" | "documents" | "customFileName",
  ) => {
    setFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const clearAllFormErrors = () => {
    setFormErrors({});
  };

  const syncRejectedInfoModal = (nextRows: Row[], userRole?: string | null) => {
    const nextUserRole = String(userRole || "").toUpperCase();
    const nextIsOperatorBlud = nextUserRole === "BLUD_OPERATOR";

    if (!nextIsOperatorBlud) {
      setRejectedInfoState({ open: false, rows: [] });
      return;
    }

    const nextRejectedRows = [...nextRows]
      .filter((row) => row.reviewStatus === "rejected")
      .sort((a, b) => a.parameterId - b.parameterId);

    if (nextRejectedRows.length === 0) {
      setRejectedInfoState({ open: false, rows: [] });
      return;
    }

    setRejectedInfoState({
      open: true,
      rows: nextRejectedRows,
    });
  };

  const fetchRows = async () => {
    setLoading(true);
    resetMessages();
    try {
      const params = new URLSearchParams({
        year: selectedYear,
        moduleKey: currentPage,
      });

      const requestUserRole = String(
        resolvedUserRole || currentUserRoleRef.current || "",
      ).toUpperCase();
      const shouldSendBludCodeForFetch =
        isBpkpGlobalFilterRole(requestUserRole);

      if (effectiveFetchBludCode && shouldSendBludCodeForFetch) {
        params.set("bludCode", effectiveFetchBludCode);
      }

      if (selectedDaMode) {
        params.set("daMode", selectedDaMode);
      }

      const response = await fetch(`/api/assessments?${params.toString()}`, {
        cache: "no-store",
      });

      const payload = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(
          payload?.message ||
            `Gagal memuat assessment. HTTP ${response.status}`,
        );
      }

      const nextRows = Array.isArray(payload.rows) ? payload.rows : [];

      setRows(nextRows);
      setPeriodInfo(payload as AssessmentPayload);
      setReviewerNotes(payload?.reviewerNotes || "");

      const payloadBludCode = payload?.blud?.code
        ? String(payload.blud.code).toUpperCase()
        : "";

      /**
       * Prevent duplicate GET after payload role is resolved.
       * BLUD_OPERATOR / BLUD_ADMIN selalu dinormalisasi ke key AUTO agar render
       * berikutnya tidak memicu GET ulang hanya karena role/payload sudah masuk.
       * BPKP tetap memakai key BLUD agar perubahan pilihan BLUD tetap refetch.
       */
      const payloadUserRole = String(payload?.userRole || "").toUpperCase();

      if (payloadBludCode) {
        activeFetchKeyRef.current = isBpkpGlobalFilterRole(payloadUserRole)
          ? `${selectedYear}-${currentPage}-${selectedDaMode}-${
              effectiveFetchBludCode || payloadBludCode
            }`
          : `${selectedYear}-${currentPage}-${selectedDaMode}-AUTO`;
      }

      // Untuk BLUD_OPERATOR dan BLUD_ADMIN, jangan set localSelectedBludCode
      // dari payload karena itu memicu fetch kedua dengan data yang sama.

      syncRejectedInfoModal(nextRows, payload?.userRole);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat assessment.");
    } finally {
      setLoading(false);
    }
  };

  const refreshRows = async () => {
    activeFetchKeyRef.current = "";
    await fetchRows();
  };

  useEffect(() => {
    if (!isSessionRoleReady) {
      return;
    }

    const roleForFetchKey = String(
      resolvedUserRole || currentUserRoleRef.current || "",
    ).toUpperCase();
    const shouldUseBludCodeInFetchKey = isBpkpGlobalFilterRole(roleForFetchKey);

    // Admin/BPKP wajib menunggu BLUD dari global filter siap dulu.
    // Ini mencegah request pertama tanpa bludCode, lalu request kedua dengan bludCode.
    if (shouldUseBludCodeInFetchKey && !effectiveFetchBludCode) {
      return;
    }

    const fetchKey = `${selectedYear}-${currentPage}-${selectedDaMode}-${
      shouldUseBludCodeInFetchKey ? effectiveFetchBludCode : "AUTO"
    }`;

    if (activeFetchKeyRef.current === fetchKey) {
      return;
    }

    activeFetchKeyRef.current = fetchKey;

    void fetchRows();
  }, [
    selectedYear,
    currentPage,
    effectiveFetchBludCode,
    selectedDaMode,
    isSessionRoleReady,
    resolvedUserRole,
  ]);

  const defaultFormRow = (parameterId?: number): FormRow | null => {
    const fallback = parameterId
      ? parameterById[parameterId]
      : availableParameters[0];
    if (!fallback) return null;
    const pulledSourceRow =
      isBpkp && selectedDaMode === "tarik_data"
        ? sourceRowsByParameterId[fallback.id]
        : null;
    const defaultCriteria = fallback.criteria[0];
    return {
      id: "",
      parameterId: fallback.id,
      parameter: fallback.label,
      criteriaCode:
        pulledSourceRow?.criteriaCode || defaultCriteria?.code || "",
      criteriaLabel:
        pulledSourceRow?.criteriaLabel || defaultCriteria?.label || "",
      criteriaScore:
        pulledSourceRow?.criteriaScore || defaultCriteria?.score || 0,
      aoi: pulledSourceRow?.aoi || "",
      documents: (pulledSourceRow?.documents || []).map((doc) => ({
        ...doc,
        isPersisted: false,
        cleanupOnCancel: false,
      })),
      customFileName: "",
      createdByRole: null,
      createdByName: null,
      reviewStatus: "pending",
      reviewNotes: null,
      reviewedAt: null,
    };
  };

  const openAddModal = () => {
    if (isBpkp) {
      if (!selectedBludCode && !periodInfo?.blud?.code) {
        setError("Pilih filter BLUD terlebih dahulu.");
        return;
      }
    }

    if (isOperatorWaitingAdminReview) {
      setError(
        "Assessment sudah dikirim ke Admin BLUD dan sedang menunggu review. Parameter baru tidak dapat ditambahkan saat status masih Pending Review.",
      );
      return;
    }

    if (isOperatorInRejectedRevisionPhase) {
      setError(
        "Terdapat parameter yang direject. Anda hanya dapat merevisi parameter yang direject dan tidak dapat menambah parameter baru.",
      );
      return;
    }

    const next = defaultFormRow();
    if (!next) {
      setError("Semua parameter pada modul ini sudah terisi.");
      return;
    }
    clearAllFormErrors();
    setFormSuccessMessage?.(null);
    setFormRow(next);
    setShowAddModal(true);
  };

  const updateFormParameter = (parameterId: number) => {
    const parameter = parameterById[parameterId];
    if (!parameter) return;
    const defaultCriteria = parameter.criteria[0];

    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.parameter;
      delete next.criteria;
      return next;
    });

    setFormRow({
      id: "",
      parameterId: parameter.id,
      parameter: parameter.label,
      criteriaCode: defaultCriteria?.code || "",
      criteriaLabel: defaultCriteria?.label || "",
      criteriaScore: defaultCriteria?.score || 0,
      aoi: "",
      documents: [],
      customFileName: "",
      createdByRole: null,
      createdByName: null,
      reviewStatus: "pending",
      reviewNotes: null,
      reviewedAt: null,
    });
  };

  const updateFormCriteria = (value: string, isEdit = false) => {
    const updateRow = (prev: FormRow | null) => {
      if (!prev) return prev;

      const criteriaList = criteriaByParameterId[prev.parameterId] || [];
      const selected = criteriaList.find((item: any) => item.code === value);
      if (!selected) return prev;

      return {
        ...prev,
        criteriaCode: selected.code,
        criteriaLabel: selected.label,
        criteriaScore: Number(selected.score),
      };
    };

    clearFormError("criteria");

    if (isEdit) {
      setEditingRow(updateRow);
    } else {
      setFormRow(updateRow);
    }
  };

  const validateFiles = (files: FileList) => {
    const errors: string[] = [];
    const validFiles: File[] = [];
    Array.from(files).forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        errors.push(`Format file ${file.name} tidak diizinkan.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`Ukuran file ${file.name} melebihi ${MAX_FILE_SIZE_MB}MB.`);
        return;
      }
      validFiles.push(file);
    });
    return { errors, validFiles };
  };

  const attachExistingDocument = (document: DocumentItem, isEdit: boolean) => {
    clearFormError("documents");
    clearFormError("customFileName");
    setFormSuccessMessage?.(null);

    const nextDocument: DocumentItem = {
      ...document,
      isPersisted: false,
      cleanupOnCancel: false,
    };

    if (isEdit) {
      setEditingRow((prev) => {
        if (!prev) return prev;
        const alreadyExists = prev.documents.some(
          (doc) => doc.id === nextDocument.id,
        );
        if (alreadyExists) return prev;
        return {
          ...prev,
          documents: [...prev.documents, nextDocument],
          customFileName: "",
        };
      });
    } else {
      setFormRow((prev) => {
        if (!prev) return prev;
        const alreadyExists = prev.documents.some(
          (doc) => doc.id === nextDocument.id,
        );
        if (alreadyExists) return prev;
        return {
          ...prev,
          documents: [...prev.documents, nextDocument],
          customFileName: "",
        };
      });
    }

    setExistingDocumentState({
      open: false,
      document: null,
      isEdit: false,
      fileName: "",
      customName: "",
    });
    setFormSuccessMessage("Dokumen existing berhasil digunakan.");
  };

  const uploadDocuments = async (files: FileList, isEdit = false) => {
    const target = isEdit ? editingRow : formRow;
    if (!target) return;

    resetMessages();
    clearFormError("customFileName");
    clearFormError("documents");

    if (!target.customFileName?.trim()) {
      setFormErrors((prev) => ({
        ...prev,
        customFileName: "Nama dokumen wajib diisi sebelum upload.",
      }));
      return;
    }

    if (target.documents.length + files.length > MAX_FILES_PER_PARAM) {
      setFormErrors((prev) => ({
        ...prev,
        documents: `Maksimal ${MAX_FILES_PER_PARAM} dokumen per parameter.`,
      }));
      return;
    }

    const { errors, validFiles } = validateFiles(files);
    if (errors.length) {
      setFormErrors((prev) => ({
        ...prev,
        documents: errors.join(" "),
      }));
      return;
    }

    setLoadingAction("uploading_document");
    setSaving(true);

    try {
      const uploadedDocuments: DocumentItem[] = [];

      for (const file of validFiles) {
        const formData = new FormData();
        formData.append("year", selectedYear);
        formData.append("moduleKey", currentPage);
        formData.append("sourceParameter", target.parameter);
        formData.append("customName", target.customFileName.trim());
        formData.append("daMode", selectedDaMode);
        if (selectedBludCode || periodInfo?.blud?.code) {
          formData.append(
            "bludCode",
            selectedBludCode || periodInfo?.blud?.code || "",
          );
        }
        formData.append("files", file);

        const response = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        const payload = await parseJsonSafe(response);

        if (
          response.status === 409 &&
          payload?.conflict &&
          payload?.existingDocument
        ) {
          setExistingDocumentState({
            open: true,
            document: normalizeUploadedDocument(payload.existingDocument),
            isEdit,
            fileName: file.name,
            customName: target.customFileName.trim(),
          });
          return;
        }

        if (!response.ok) {
          throw new Error(payload?.message || "Gagal upload dokumen.");
        }

        const docs = Array.isArray(payload?.documents)
          ? payload.documents.map((doc: any) => ({
              ...normalizeUploadedDocument(doc),
              isPersisted: false,
              cleanupOnCancel: true,
            }))
          : [];

        uploadedDocuments.push(...docs);
      }

      if (uploadedDocuments.length > 0) {
        if (isEdit) {
          setEditingRow((prev) => {
            if (!prev) return prev;
            const existingIds = new Set(prev.documents.map((doc) => doc.id));
            const merged = [...prev.documents];

            for (const doc of uploadedDocuments) {
              if (!existingIds.has(doc.id)) {
                merged.push(doc);
              }
            }

            return {
              ...prev,
              documents: merged,
              customFileName: "",
            };
          });
        } else {
          setFormRow((prev) => {
            if (!prev) return prev;
            const existingIds = new Set(prev.documents.map((doc) => doc.id));
            const merged = [...prev.documents];

            for (const doc of uploadedDocuments) {
              if (!existingIds.has(doc.id)) {
                merged.push(doc);
              }
            }

            return {
              ...prev,
              documents: merged,
              customFileName: "",
            };
          });
        }

        clearFormError("documents");
        clearFormError("customFileName");
        setFormSuccessMessage("Dokumen berhasil diupload.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal upload dokumen.");
    } finally {
      setSaving(false);
    }
  };

  const removeDocument = async (docId: string, isEdit = false) => {
    const target = isEdit ? editingRow : formRow;
    if (!target) return;

    if (isEdit) {
      let canEditCurrentRow = false;

      if (isOperatorBlud) {
        if (!hasSubmittedByOperator) {
          canEditCurrentRow = isEditable;
        } else if (isOperatorWaitingAdminReview) {
          canEditCurrentRow = false;
        } else if (isOperatorInRejectedRevisionPhase) {
          canEditCurrentRow =
            target.reviewStatus === "rejected" ||
            (target.reviewStatus === "pending" &&
              !!target.reviewNotes &&
              target.reviewNotes.trim() !== "");
        }
      } else {
        canEditCurrentRow = isEditable;
      }

      if (!canEditCurrentRow) return;
    } else {
      if (!isEditable) return;
    }

    const nextDocuments = target.documents.filter((doc) => doc.id !== docId);
    const nextDocumentsCount = nextDocuments.length;

    const isLastRequiredEvidence =
      isEvidenceRequired(target.criteriaScore) && nextDocumentsCount < 1;

    if (isLastRequiredEvidence) {
      setError(
        "Minimal 1 evidence wajib ada karena level parameter lebih dari 1.",
      );
      return;
    }

    resetMessages();

    if (isEdit) {
      const targetDoc = target.documents.find((doc) => doc.id === docId);

      if (targetDoc?.cleanupOnCancel) {
        try {
          setSaving(true);
          setLoadingAction("updating_assessment");

          const response = await fetch(`/api/documents/${docId}`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          });

          const payload = await parseJsonSafe(response);

          if (!response.ok) {
            throw new Error(payload?.message || "Gagal menghapus dokumen.");
          }
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Gagal menghapus dokumen.",
          );
          return;
        } finally {
          setSaving(false);
          setLoadingAction(null);
        }
      }

      if (!targetDoc?.cleanupOnCancel) {
        setRemovedEditDocumentIds((prev) =>
          prev.includes(docId) ? prev : [...prev, docId],
        );
      }

      setEditingRow((prev) =>
        prev
          ? {
              ...prev,
              documents: prev.documents.filter((doc) => doc.id !== docId),
            }
          : prev,
      );

      setFormSuccessMessage(
        targetDoc?.cleanupOnCancel
          ? "Dokumen temporary berhasil dihapus."
          : "Dokumen berhasil dilepas dari draft perubahan. Klik Update Assessment untuk menyimpan perubahan.",
      );

      clearFormError("documents");
      clearFormError("customFileName");
      return;
    }

    if (!isEdit) {
      const targetDoc = target.documents.find((doc) => doc.id === docId);

      if (targetDoc?.cleanupOnCancel) {
        try {
          setSaving(true);
          setLoadingAction("updating_assessment");

          const response = await fetch(`/api/documents/${docId}`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          });

          const payload = await parseJsonSafe(response);

          if (!response.ok) {
            throw new Error(payload?.message || "Gagal menghapus dokumen.");
          }
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Gagal menghapus dokumen.",
          );
          return;
        } finally {
          setSaving(false);
          setLoadingAction(null);
        }
      }

      setFormRow((prev) =>
        prev
          ? {
              ...prev,
              documents: prev.documents.filter((doc) => doc.id !== docId),
            }
          : prev,
      );

      setFormSuccessMessage("Dokumen berhasil dilepas dari draft parameter.");
      clearFormError("documents");
      clearFormError("customFileName");
      return;
    }
  };

  const rollbackTemporaryDocuments = async (documents: DocumentItem[]) => {
    const temporaryDocuments = documents.filter((doc) => doc.cleanupOnCancel);

    if (temporaryDocuments.length === 0) return;

    try {
      setSaving(true);
      setLoadingAction("updating_assessment");

      await Promise.all(
        temporaryDocuments.map(async (doc) => {
          try {
            const response = await fetch(`/api/documents/${doc.id}`, {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({}),
            });

            if (!response.ok) {
              const payload = await parseJsonSafe(response);
              throw new Error(
                payload?.message || `Gagal rollback dokumen ${doc.name}.`,
              );
            }
          } catch (error) {
            console.error("Rollback temporary document failed:", doc.id, error);
          }
        }),
      );
    } finally {
      setSaving(false);
      setLoadingAction(null);
    }
  };

  const temporaryDocumentsRef = useRef<DocumentItem[]>([]);
  const hasRolledBackRef = useRef(false);
  const activeFetchKeyRef = useRef<string>("");
  const currentUserRoleRef = useRef<string>("");

  useEffect(() => {
    temporaryDocumentsRef.current = [
      ...(formRow?.documents || []),
      ...(editingRow?.documents || []),
    ].filter((doc) => doc.cleanupOnCancel);
  }, [formRow?.documents, editingRow?.documents]);

  useEffect(() => {
    const rollbackOnUnload = () => {
      if (hasRolledBackRef.current) return;
      hasRolledBackRef.current = true;

      const temporaryDocs = temporaryDocumentsRef.current;

      if (temporaryDocs.length === 0) return;

      const payload = JSON.stringify({
        documentIds: temporaryDocs.map((doc) => doc.id),
      });

      const blob = new Blob([payload], { type: "application/json" });

      const sent = navigator.sendBeacon(
        "/api/documents/rollback-temporary",
        blob,
      );

      if (!sent) {
        void fetch("/api/documents/rollback-temporary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: payload,
          keepalive: true,
        });
      }
    };

    window.addEventListener("pagehide", rollbackOnUnload);
    window.addEventListener("beforeunload", rollbackOnUnload);

    return () => {
      window.removeEventListener("pagehide", rollbackOnUnload);
      window.removeEventListener("beforeunload", rollbackOnUnload);
    };
  }, []);

  const handleCloseAddModal = async () => {
    if (saving) return;

    const docsToRollback = formRow?.documents || [];
    await rollbackTemporaryDocuments(docsToRollback);

    setShowAddModal(false);
    setFormRow(null);
    clearAllFormErrors();
    setFormSuccessMessage?.(null);
    setLoadingAction(null);
  };

  const handleCloseEditModal = async () => {
    if (saving) return;

    const docsToRollback = editingRow?.documents || [];
    await rollbackTemporaryDocuments(docsToRollback);

    setEditingRow(null);
    setRemovedEditDocumentIds([]);
    clearAllFormErrors();
    setFormSuccessMessage?.(null);
    setLoadingAction(null);
  };

  const submitNewRow = async () => {
    if (!formRow) return;
    resetMessages();
    clearAllFormErrors();

    const nextErrors: FormErrors = {};
    const evidenceRequired = isEvidenceRequired(formRow.criteriaScore);

    if (!formRow.parameterId || !formRow.parameter) {
      nextErrors.parameter = "Parameter wajib dipilih.";
    }
    if (!formRow.criteriaCode) {
      nextErrors.criteria = "Kriteria wajib dipilih.";
    }
    if (isAoiRequired(formRow.criteriaScore) && !formRow.aoi.trim()) {
      nextErrors.aoi = "AOI wajib diisi untuk kriteria di bawah Level 3.";
    }
    if (evidenceRequired && formRow.documents.length === 0) {
      nextErrors.documents =
        "Upload Evidence wajib apabila level parameter lebih dari 1.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    try {
      setLoadingAction("creating_assessment");
      setSaving(true);

      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: Number(selectedYear),
          moduleKey: currentPage,
          bludCode: selectedBludCode || periodInfo?.blud?.code || undefined,
          daMode: selectedDaMode,
          row: {
            parameterId: formRow.parameterId,
            parameter: formRow.parameter,
            criteriaCode: formRow.criteriaCode,
            criteriaLabel: formRow.criteriaLabel,
            criteriaScore: formRow.criteriaScore,
            aoi: formRow.aoi,
            documentIds: formRow.documents.map((doc) => doc.id),
          },
        }),
      });

      const payload = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(payload?.message || "Gagal menyimpan assessment.");
      }

      setRows((prev) => [...prev, payload.row]);
      setMessage("Assessment berhasil disimpan.");
      setShowAddModal(false);
      setFormRow(null);
      clearAllFormErrors();
      await refreshRows();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan assessment.",
      );
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async () => {
    if (!editingRow) return;

    resetMessages();
    clearAllFormErrors();

    const nextErrors: FormErrors = {};
    const aoiRequired = isAoiRequired(editingRow.criteriaScore);
    const evidenceRequired = isEvidenceRequired(editingRow.criteriaScore);

    if (!editingRow.criteriaCode) {
      nextErrors.criteria = "Kriteria wajib dipilih.";
    }

    if (aoiRequired && !editingRow.aoi.trim()) {
      nextErrors.aoi = "AOI wajib diisi untuk kriteria di bawah Level 3.";
    }

    if (evidenceRequired && editingRow.documents.length === 0) {
      nextErrors.documents =
        "Upload Evidence wajib apabila level parameter lebih dari 1.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    try {
      setLoadingAction("updating_assessment");
      setSaving(true);

      const response = await fetch(`/api/assessments/${editingRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daMode: selectedDaMode,
          criteriaCode: editingRow.criteriaCode,
          criteriaLabel: editingRow.criteriaLabel,
          criteriaScore: editingRow.criteriaScore,
          aoi: editingRow.aoi,
          documentIds: editingRow.documents.map((doc) => doc.id),
          removedDocumentIds: removedEditDocumentIds,
        }),
      });

      const payload = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(payload?.message || "Gagal memperbarui assessment.");
      }

      const normalizedUpdatedRow = {
        ...payload.row,
        documents: Array.isArray(payload.row?.documents)
          ? payload.row.documents.map((doc: DocumentItem) => ({
              ...doc,
              isPersisted: true,
              cleanupOnCancel: false,
            }))
          : [],
      };

      setRows((prev) =>
        prev.map((row) =>
          row.id === editingRow.id ? normalizedUpdatedRow : row,
        ),
      );

      setEditingRow(null);
      setRemovedEditDocumentIds([]);
      setMessage("Assessment berhasil diperbarui.");
      clearAllFormErrors();
      await refreshRows();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memperbarui assessment.",
      );
    } finally {
      setSaving(false);
      setLoadingAction(null);
    }
  };

  const openDeleteModal = (row: Row) => {
    if (!canEditOrDeleteRow(row)) return;

    setDeleteState({
      open: true,
      rowId: row.id,
      parameterName: row.parameter,
    });
  };

  const closeDeleteModal = () => {
    if (saving) return;

    setDeleteState({
      open: false,
      rowId: null,
      parameterName: "",
    });
  };

  const confirmDeleteRow = async () => {
    if (!deleteState.rowId) return;

    const targetRow = rows.find((row) => row.id === deleteState.rowId);
    if (!targetRow || !canEditOrDeleteRow(targetRow)) return;

    resetMessages();

    try {
      setSaving(true);

      const response = await fetch(`/api/assessments/${deleteState.rowId}`, {
        method: "DELETE",
      });

      const payload = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(payload?.message || "Gagal menghapus assessment.");
      }

      setRows((prev) => prev.filter((row) => row.id !== deleteState.rowId));
      setMessage("Assessment berhasil dihapus.");
      closeDeleteModal();
      await refreshRows();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menghapus assessment.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateWorkflow = async (action: string) => {
    if (!periodInfo?.periodId) {
      setError("Belum ada periode assessment untuk diproses.");
      return;
    }

    resetMessages();

    try {
      setLoadingAction("submitting_workflow");
      setSaving(true);

      const response = await fetch("/api/assessments/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentPeriodId: periodInfo.periodId,
          action,
          reviewerNotes,
          scope: isOperatorBlud || isAdminBlud ? "GLOBAL" : "MODULE",
        }),
      });

      const payload = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(
          payload?.message || "Gagal memproses workflow assessment.",
        );
      }

      setMessage(
        `Workflow berhasil diproses: ${payload.period?.statusLabel || "Berhasil"}`,
      );
      await refreshRows();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memproses workflow assessment.",
      );
    } finally {
      setSaving(false);
      setLoadingAction(null);
    }
  };

  const handleAcceptReview = async () => {
    if (!reviewState.row) return;

    resetMessages();
    setReviewState((prev) => ({ ...prev, actionLoading: true }));
    setLoadingAction("reviewing_assessment");

    try {
      const response = await fetch(
        `/api/assessments/${reviewState.row.id}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "accept",
          }),
        },
      );

      const payload = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(payload?.message || "Gagal menerima assessment.");
      }

      setMessage("Assessment berhasil di-accept.");
      setReviewState({
        open: false,
        row: null,
        actionLoading: false,
      });
      await refreshRows();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menerima assessment.",
      );
      setReviewState((prev) => ({ ...prev, actionLoading: false }));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRejectReview = async () => {
    if (!rejectState.row) return;

    if (!rejectState.reason.trim()) {
      setRejectState((prev) => ({
        ...prev,
        error: "Alasan reject wajib diisi.",
      }));
      return;
    }

    resetMessages();
    setRejectState((prev) => ({ ...prev, actionLoading: true, error: null }));
    setLoadingAction("reviewing_assessment");

    try {
      const response = await fetch(
        `/api/assessments/${rejectState.row.id}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reject",
            reason: rejectState.reason.trim(),
          }),
        },
      );

      const payload = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(payload?.message || "Gagal me-reject assessment.");
      }

      setMessage("Assessment berhasil di-reject.");
      setRejectState({
        open: false,
        row: null,
        reason: "",
        actionLoading: false,
        error: null,
      });
      setReviewState({
        open: false,
        row: null,
        actionLoading: false,
      });
      await refreshRows();
    } catch (err) {
      setRejectState((prev) => ({
        ...prev,
        actionLoading: false,
        error:
          err instanceof Error ? err.message : "Gagal me-reject assessment.",
      }));
    } finally {
      setLoadingAction(null);
    }
  };

  const canShowSubmitOnRow = (row: Row) => {
    if (isOperatorBlud) {
      if (!periodInfo?.canSubmit) return false;
      if (!isExactly28ParametersCompletedAllModules) return false;
      if (hasRejectedRows) return false;

      // Submit operator bersifat global.
      // Setelah pernah klik Kirim ke Admin BLUD, semua tombol submit di aspek lain
      // harus hilang selama menunggu review. Tombol hanya boleh muncul lagi
      // saat ada draft revisi yang memang belum dikirim ulang.
      if (hasSubmittedToAdminBlud && !hasRevisionPendingResubmit) {
        return false;
      }

      if (hasRevisionPendingResubmit && lastRevisedRowId) {
        return row.id === lastRevisedRowId;
      }

      return row.id === lastCompletedRowId;
    }

    if (isAdminBlud) {
      if (!hasAcceptedRequiredOperatorParams) return false;
      return row.id === lastAcceptedRowId;
    }

    if (isBpkp) {
      if (!periodInfo?.canSubmit) return false;
      if (!hasAcceptedRequiredOperatorParams) return false;
      return row.id === lastAcceptedRowId;
    }

    return false;
  };

  const canEditOrDeleteRow = (row: Row) => {
    if (showReviewAction) return false;

    if (isOperatorBlud) {
      // Sebelum submit ke admin: operator masih boleh edit/hapus normal
      if (!hasSubmittedByOperator) {
        return isEditable;
      }

      // Setelah submit dan sedang menunggu review admin:
      // semua parameter terkunci
      if (isOperatorWaitingAdminReview) {
        return false;
      }

      // Setelah ada reject dari admin / sedang revisi sebelum resubmit:
      // parameter rejected tetap bisa diedit,
      // dan parameter yang sudah direvisi tapi masih pending + masih punya reviewNotes
      // juga tetap bisa diedit sampai operator klik Kirim ke Admin BLUD
      if (isOperatorInRejectedRevisionPhase) {
        return (
          row.reviewStatus === "rejected" ||
          (row.reviewStatus === "pending" &&
            !!row.reviewNotes &&
            row.reviewNotes.trim() !== "")
        );
      }

      return false;
    }

    return isEditable;
  };

  const getSubmitButtonLabel = () => {
    if (isOperatorBlud) return "Kirim ke Admin BLUD";
    if (isAdminBlud) return "Kirim ke BPKP";
    if (isBpkp) return "Kirim";
    return "Kirim";
  };

  const openDocumentPreview = (doc: DocumentItem) => {
    window.open(doc.url, "_blank", "noopener,noreferrer");
  };

  const isSubmittedToBpkp =
    isAdminBlud &&
    (!!periodInfo?.submittedToBpkpAt ||
      String(periodInfo?.status || "").toUpperCase() === "SUBMITTED_TO_BPKP");

  // GANTI function canAdminReviewRow di EdittableTable dengan versi ini.
  // Perubahan ini hanya mengatur tombol Review per-row agar:
  // - parameter revisi yang belum disubmit ulang tetap disabled seperti gambar 1
  // - parameter lain yang memang sudah boleh direview tetap enabled seperti flow sebelumnya

  const canAdminReviewRow = (row: Row) => {
    if (isSubmittedToBpkp) return false;
    if (!showReviewAction) return false;

    const hasRejectNotes = !!row.reviewNotes && row.reviewNotes.trim() !== "";

    const isPendingRevisionRow =
      row.reviewStatus === "pending" && (row.isRevision || hasRejectNotes);

    if (isPendingRevisionRow && row.lastRejectedAt) {
      const lastRejectedTime = new Date(row.lastRejectedAt).getTime();
      const lastSubmittedTime = new Date(
        periodInfo?.globalSubmittedAt || periodInfo?.submittedAt || "",
      ).getTime();

      const hasBeenResubmittedAfterReject =
        Number.isFinite(lastSubmittedTime) &&
        lastSubmittedTime > lastRejectedTime;

      if (!hasBeenResubmittedAfterReject) {
        return false;
      }
    }

    if (isPendingRevisionRow && hasRejectNotes && !!periodInfo?.canSubmit) {
      return false;
    }

    return true;
  };

  const PageIcon = pageMeta.icon;

  const showHeaderSubmitToAdminBlud =
    isOperatorBlud &&
    !!periodInfo?.canSubmit &&
    isExactly28ParametersCompletedAllModules &&
    !hasRejectedRows &&
    (!hasSubmittedToAdminBlud || hasRevisionPendingResubmit);

  const showHeaderSubmitToBpkp =
    isAdminBlud &&
    hasAcceptedRequiredOperatorParams &&
    !!periodInfo?.periodId &&
    !isSubmittedToBpkp;

  // console.log({
  // currentUserRole,
  // isOperatorBlud,
  // canSubmit: periodInfo?.canSubmit,
  // rowsLength: rows.length,
  // parameterOptionsLength: parameterOptions.length,
  // totalCompletedParametersAllModules,
  // isExactly28ParametersCompletedAllModules,
  // hasRejectedRows,
  // showHeaderSubmitToAdminBlud,
  // });

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl shadow-slate-200/60 ring-1 ring-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30">
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-800 via-blue-600 to-cyan-500 px-6 py-4 text-white shadow-[0_18px_45px_rgba(37,99,235,0.18)] dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 dark:shadow-black/20">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/25 blur-3xl dark:bg-blue-400/20" />
        <div className="pointer-events-none absolute left-1/3 -bottom-28 h-64 w-64 rounded-full bg-blue-300/25 blur-3xl dark:bg-indigo-400/20" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_36%)]" />

        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[24px] bg-white/15 text-white shadow-xl shadow-blue-950/10 ring-1 ring-white/25 backdrop-blur">
              <PageIcon size={26} />
            </div>

            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-50 shadow-sm backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.18)]" />
                Self Assessment BLUD
              </div>

              <h2 className="truncate text-xl font-black leading-tight tracking-tight">
                {pageMeta.title}
              </h2>
              <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-blue-50/90 dark:text-slate-300">
                {pageMeta.subTitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isBpkp && (
              <div className="relative min-w-[180px]">
                <select
                  value={selectedDaMode}
                  onChange={(e) => {
                    setSelectedDaMode(e.target.value as DaMode);
                    setRows([]);
                    setPeriodInfo((prev) =>
                      prev
                        ? {
                            ...prev,
                            rows: [],
                            periodId: null,
                            statusLabel: "Draft",
                          }
                        : prev,
                    );
                  }}
                  className="h-11 w-full appearance-none rounded-2xl border border-white/20 bg-white/15 px-4 pr-9 text-xs font-black text-white shadow-sm outline-none backdrop-blur transition hover:bg-white/22 focus:border-white/40 focus:ring-4 focus:ring-white/10 [&>option]:bg-white [&>option]:text-slate-800"
                  title="Filter DA"
                >
                  <option value="manual">DA Manual</option>
                  <option value="tarik_data">DA Tarik Data</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/80">
                  ▾
                </span>
              </div>
            )}

            {showBludFilter && (
              <div className="relative min-w-[220px]">
                <select
                  value={selectedBludCode || periodInfo?.blud?.code || ""}
                  onChange={(e) => {
                    setSelectedBludCode(e.target.value);
                    setRows([]);
                    setPeriodInfo((prev) =>
                      prev
                        ? {
                            ...prev,
                            rows: [],
                            periodId: null,
                            statusLabel: "Draft",
                          }
                        : prev,
                    );
                  }}
                  className="h-11 w-full appearance-none rounded-2xl border border-white/20 bg-white/15 px-4 pr-9 text-xs font-black text-white shadow-sm outline-none backdrop-blur transition hover:bg-white/22 focus:border-white/40 focus:ring-4 focus:ring-white/10 [&>option]:bg-white [&>option]:text-slate-800"
                  title="Filter BLUD"
                >
                  {bludOptions.map((blud) => (
                    <option key={blud.id} value={blud.code}>
                      {blud.name}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/80">
                  ▾
                </span>
              </div>
            )}

            {!isBpkp && (
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/12 px-4 py-2 text-xs font-black text-white shadow-sm backdrop-blur transition hover:bg-white/16">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Status: {periodInfo?.statusLabel || "Draft"}
              </div>
            )}

            {showHeaderSubmitToAdminBlud && (
              <button
                onClick={() => void updateWorkflow("submit")}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/15 px-4 py-2 text-sm font-bold text-white shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/22 hover:shadow-lg"
              >
                <Send size={16} />
                Kirim ke Admin BLUD
              </button>
            )}

            {showHeaderSubmitToBpkp && (
              <button
                onClick={() => void updateWorkflow("submit")}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/15 px-4 py-2 text-sm font-bold text-white shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/22 hover:shadow-lg"
              >
                <Send size={16} />
                Kirim ke BPKP
              </button>
            )}

            {((isBpkpSelfAssessmentMode && !showReviewAction) ||
              (!showReviewAction &&
                isEditable &&
                !isOperatorWaitingAdminReview &&
                !isOperatorInRejectedRevisionPhase)) && (
              <button
                onClick={openAddModal}
                disabled={
                  !isEditable ||
                  availableParameters.length === 0 ||
                  (isBpkp && !(selectedBludCode || periodInfo?.blud?.code))
                }
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/15 px-4 py-2 text-sm font-bold text-white shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/22 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
              >
                <Plus size={16} /> Tambah Parameter
              </button>
            )}

            {showExportPdf && periodInfo?.periodId && (
              <button
                onClick={() =>
                  window.open(
                    `/api/reports/assessment?year=${selectedYear}`,
                    "_blank",
                  )
                }
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/15 px-4 py-2 text-sm font-bold text-white shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/22 hover:shadow-lg"
              >
                <Save size={16} /> Export PDF
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-800/60">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-[260px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm ring-1 ring-slate-900/5 dark:border-slate-700 dark:bg-slate-900">
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 dark:text-slate-500">
              Progress
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200 shadow-inner dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 shadow-sm"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-blue-100 dark:text-slate-300">
              {rows.length}/{parameterOptions.length}
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:justify-end">
            <div className="relative lg:w-[280px]">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-blue-950/50"
                placeholder="Cari parameter atau dokumen..."
              />
            </div>

            <div className="relative lg:w-[140px]">
              <CalendarDays
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-blue-950/50"
              >
                {["2025", "2026", "2027", "2028"].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {(message || error) && (
          <div
            className={`mt-3 rounded-xl px-4 py-3 text-sm ${
              error
                ? "border border-red-200 bg-red-50 text-red-700"
                : "border border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error || message}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden h-full overflow-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
              Memuat data assessment...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
              <CheckCircle2 className="text-blue-100 dark:text-slate-300" />
              <div>
                <p className="font-semibold text-slate-700 dark:text-blue-100 dark:text-slate-300">
                  Belum ada data assessment untuk tahun {selectedYear}
                </p>
                <p>
                  Tambahkan parameter pertama untuk mulai mengisi modul ini.
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full table-fixed">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 text-xs uppercase tracking-[0.12em] text-slate-600 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95 dark:text-blue-100 dark:text-slate-300">
                <tr>
                  <th className="w-[22%] px-4 py-4 text-left">Parameter</th>
                  <th className="w-[24%] px-4 py-4 text-left">Kriteria</th>
                  <th className="w-[22%] px-4 py-4 text-left">AOI</th>
                  <th className="w-[18%] px-4 py-4 text-left">Dokumen</th>
                  <th className="w-[14%] px-4 py-4 text-left">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const isOperatorRow =
                    String(row.createdByRole || "").toUpperCase() ===
                      "BLUD_OPERATOR" || !row.createdByRole;

                  const canEditRow = canEditOrDeleteRow(row);
                  const canReviewRow = canAdminReviewRow(row);

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-slate-200 align-top text-sm text-justify transition hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-slate-800/45"
                    >
                      <td className="px-4 py-5 font-medium text-slate-800 dark:text-slate-200 dark:text-slate-100">
                        <p>{row.parameter}</p>
                        {row.createdByName ? (
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                            Input oleh: {row.createdByName}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-4 py-5">
                        <p className="text-sm leading-6 text-slate-700 dark:text-blue-100 dark:text-slate-300">
                          {row.criteriaLabel}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-indigo-700">
                          Skor: {row.criteriaScore}
                        </p>
                      </td>

                      <td className="px-4 py-5 text-slate-700 dark:text-blue-100 dark:text-slate-300">
                        {row.aoi}
                      </td>

                      <td className="px-4 py-5">
                        <div className="space-y-2">
                          {row.documents.map((doc) => (
                            <button
                              key={doc.id}
                              onClick={() => openDocumentPreview(doc)}
                              className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-slate-700"
                            >
                              <FileText size={13} className="text-indigo-500" />
                              <span className="truncate">{doc.name}</span>
                            </button>
                          ))}
                        </div>
                      </td>

                      <td className="px-4 py-5">
                        {showReviewAction ? (
                          <div className="space-y-2">
                            <button
                              disabled={!canReviewRow}
                              onClick={() => {
                                if (!canReviewRow) return;

                                if (!isOperatorRow) {
                                  setError(
                                    "Review hanya dapat dilakukan untuk inputan blud.operator.",
                                  );
                                  return;
                                }

                                setReviewState({
                                  open: true,
                                  row,
                                  actionLoading: false,
                                });
                              }}
                              title={
                                !canReviewRow
                                  ? "Menunggu operator klik Kirim ke Admin BLUD setelah revisi."
                                  : undefined
                              }
                              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                                canReviewRow
                                  ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                  : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-60"
                              }`}
                            >
                              <MessageSquareText size={14} />
                              Review
                            </button>

                            <span
                              className={`inline-flex w-full justify-center rounded-full border px-3 py-1 text-[11px] font-semibold ${getReviewTone(row.reviewStatus, row.isRevision)}`}
                            >
                              {getReviewLabel(row.reviewStatus, row.isRevision)}
                            </span>

                            {canShowSubmitOnRow(row) &&
                              !showHeaderSubmitToBpkp &&
                              !isAdminBlud && (
                                <button
                                  onClick={() => void updateWorkflow("submit")}
                                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white"
                                >
                                  <Send size={14} />
                                  {getSubmitButtonLabel()}
                                </button>
                              )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <button
                                disabled={!canEditRow}
                                onClick={() => {
                                  if (!canEditRow) return;

                                  setRemovedEditDocumentIds([]);
                                  setEditingRow({ ...row, customFileName: "" });
                                }}
                                className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                disabled={!canEditRow}
                                onClick={() =>
                                  canEditRow && openDeleteModal(row)
                                }
                                className="rounded-xl border border-red-200 bg-white p-2.5 text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/30"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>

                            {hasSubmittedToAdminBlud && (
                              <span
                                className={`inline-flex w-full justify-center rounded-full border px-3 py-1 text-[11px] font-semibold 
    ${isSubmittedToBpkp ? "opacity-50 pointer-events-none" : ""}
    ${getReviewTone(row.reviewStatus, row.isRevision)}`}
                              >
                                {getReviewLabel(
                                  row.reviewStatus,
                                  row.isRevision,
                                )}
                              </span>
                            )}

                            {row.reviewNotes ? (
                              <div
                                className={`rounded-xl border px-3 py-2 ${
                                  row.reviewStatus === "rejected"
                                    ? "border-red-200 bg-red-50"
                                    : "border-amber-200 bg-amber-50"
                                }`}
                              >
                                <p
                                  className={`text-[11px] font-semibold ${
                                    row.reviewStatus === "rejected"
                                      ? "text-red-700"
                                      : "text-amber-700"
                                  }`}
                                >
                                  Log reject :
                                </p>
                                <p
                                  className={`mt-1 line-clamp-4 text-xs leading-5 ${
                                    row.reviewStatus === "rejected"
                                      ? "text-red-800"
                                      : "text-amber-800"
                                  }`}
                                >
                                  {row.reviewNotes}
                                </p>
                              </div>
                            ) : null}

                            {canShowSubmitOnRow(row) &&
                              !showHeaderSubmitToAdminBlud && (
                                <button
                                  onClick={() => void updateWorkflow("submit")}
                                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white"
                                >
                                  <Send size={14} />
                                  {getSubmitButtonLabel()}
                                </button>
                              )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {showAddModal && formRow && (
          <ModalShell
            title={
              isBpkpSelfAssessmentMode
                ? `Tambah Parameter Assessment - DA ${selectedDaMode === "manual" ? "Manual" : "Tarik Data"}`
                : "Tambah Parameter Assessment"
            }
            onClose={() => void handleCloseAddModal()}
            onSave={() => void submitNewRow()}
            saveLabel="Simpan Assessment"
            saving={saving}
            saveDisabled={isFormInvalid()}
            loadingAction={loadingAction}
          >
            <FormBody
              data={formRow}
              availableParameters={availableParameters}
              criteriaByParameterId={criteriaByParameterId}
              updateFormParameter={updateFormParameter}
              updateFormCriteria={updateFormCriteria}
              setEditingRow={setEditingRow}
              setFormRow={setFormRow}
              uploadDocuments={uploadDocuments}
              removeDocument={removeDocument}
              isEditable={isEditable}
              formErrors={formErrors}
              clearFormError={clearFormError}
              formSuccessMessage={formSuccessMessage}
              setFormSuccessMessage={setFormSuccessMessage}
              saving={saving}
              loadingAction={loadingAction}
            />
          </ModalShell>
        )}

        {editingRow && !showReviewAction && (
          <ModalShell
            title="Edit Parameter Assessment"
            onClose={() => void handleCloseEditModal()}
            onSave={() => void submitEdit()}
            saveLabel="Update Assessment"
            saving={saving}
            saveDisabled={isEditFormInvalid()}
            loadingAction={loadingAction}
          >
            <FormBody
              data={editingRow}
              isEdit
              availableParameters={availableParameters}
              criteriaByParameterId={criteriaByParameterId}
              updateFormParameter={updateFormParameter}
              updateFormCriteria={updateFormCriteria}
              setEditingRow={setEditingRow}
              setFormRow={setFormRow}
              uploadDocuments={uploadDocuments}
              removeDocument={removeDocument}
              isEditable={canEditOrDeleteRow(editingRow)}
              formErrors={formErrors}
              clearFormError={clearFormError}
              formSuccessMessage={formSuccessMessage}
              setFormSuccessMessage={setFormSuccessMessage}
              saving={saving}
              loadingAction={loadingAction}
            />
          </ModalShell>
        )}

        <ReviewModal
          open={reviewState.open}
          row={reviewState.row}
          loading={reviewState.actionLoading}
          onClose={() =>
            setReviewState({
              open: false,
              row: null,
              actionLoading: false,
            })
          }
          onAccept={() => void handleAcceptReview()}
          onReject={() =>
            setRejectState({
              open: true,
              row: reviewState.row,
              reason: "",
              actionLoading: false,
              error: null,
            })
          }
        />

        <RejectReasonModal
          open={rejectState.open}
          row={rejectState.row}
          reason={rejectState.reason}
          error={rejectState.error}
          loading={rejectState.actionLoading}
          onChange={(value) =>
            setRejectState((prev) => ({
              ...prev,
              reason: value,
              error: null,
            }))
          }
          onClose={() =>
            setRejectState({
              open: false,
              row: null,
              reason: "",
              actionLoading: false,
              error: null,
            })
          }
          onSubmit={() => void handleRejectReview()}
        />

        <RejectedInfoModal
          open={rejectedInfoState.open}
          rows={rejectedInfoState.rows}
          onClose={() => setRejectedInfoState({ open: false, rows: [] })}
          onOpenEdit={(selectedRow) => {
            setRejectedInfoState({ open: false, rows: [] });
            setRemovedEditDocumentIds([]);

            setEditingRow({
              ...selectedRow,
              customFileName: "",
            });
          }}
        />

        {existingDocumentState.open && existingDocumentState.document && (
          <div className="[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden fixed inset-0 z-[96] overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="flex min-h-full items-start justify-center py-6">
              <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Dokumen Existing Ditemukan
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      Nama dokumen atau nama file sudah pernah digunakan.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setExistingDocumentState({
                        open: false,
                        document: null,
                        isEdit: false,
                        fileName: "",
                        customName: "",
                      })
                    }
                    className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-4 px-5 py-5 text-sm">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                    Dokumen dengan nama atau file yang sama sudah ada. Gunakan
                    dokumen yang sudah ada?
                  </div>

                  <div className="rounded-xl border border-slate-200 px-4 dark:border-slate-700 py-4">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {existingDocumentState.document.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      File existing:{" "}
                      {existingDocumentState.document.originalName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      File yang sedang dipilih: {existingDocumentState.fileName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      Nama dokumen input: {existingDocumentState.customName}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t px-5 py-4">
                  <button
                    onClick={() =>
                      setExistingDocumentState({
                        open: false,
                        document: null,
                        isEdit: false,
                        fileName: "",
                        customName: "",
                      })
                    }
                    className="rounded-xl border border-slate-200 px-4 dark:border-slate-700 py-2 text-sm"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() =>
                      attachExistingDocument(
                        existingDocumentState.document!,
                        existingDocumentState.isEdit,
                      )
                    }
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Gunakan Dokumen Existing
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {deleteState.open && !showReviewAction && (
          <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
              <div className="border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 dark:from-slate-900 dark:via-red-900 dark:to-slate-900 px-6 py-5 text-white">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                    <Trash2 size={20} />
                  </div>

                  <div className="flex-1">
                    <h3 className="text-base font-semibold">
                      Konfirmasi Hapus Assessment
                    </h3>
                    <p className="mt-1 text-xs text-blue-50 dark:text-slate-200">
                      Tindakan ini akan menghapus data assessment dari parameter
                      yang dipilih.
                    </p>
                  </div>

                  <button
                    onClick={closeDeleteModal}
                    disabled={saving}
                    className="rounded-xl border border-white/15 bg-white/10 p-2 text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-4 px-6 py-5">
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                  <p className="text-sm font-semibold text-red-800">
                    Data yang akan dihapus
                  </p>
                  <p className="mt-1 text-sm text-red-700">
                    <span className="font-medium">Parameter:</span>{" "}
                    {deleteState.parameterName}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-4 py-3">
                  <p className="text-sm text-slate-700 dark:text-blue-100 dark:text-slate-300">
                    Setelah dihapus, data assessment ini tidak akan tampil lagi
                    di daftar. Pastikan tindakan ini memang sudah final.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:border-slate-800 dark:bg-slate-900 px-6 py-4">
                <button
                  onClick={closeDeleteModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 dark:border-slate-700 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Batal
                </button>

                <button
                  onClick={() => void confirmDeleteRow()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {saving ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
