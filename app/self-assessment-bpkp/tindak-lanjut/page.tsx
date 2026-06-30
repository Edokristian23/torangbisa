"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  isBpkpGlobalFilterRole,
  useBpkpGlobalFilterStore,
} from "../../../stores/useBpkpGlobalFilterStore";
import {
  AlertCircle,
  ClipboardCheck,
  Eye,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Upload,
  X,
  Layers3,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  ChevronRight,
  Download,
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

type FollowUpStatus = "DONE" | "NOT_DONE";

type FollowUpEntry = {
  id?: string;
  description: string;
  sortOrder: number;
  documents: DocumentItem[];
  evidenceName: string;
};

type FollowUpCard = {
  id: string;
  parameterId: number;
  parameterLabel: string;
  criteriaCode: string;
  criteriaLabel: string;
  criteriaScore: number;
  aoi: string;
  moduleKey: string;
  moduleLabel: string;
  followUpStatus?: FollowUpStatus | null;
  pendingReason?: string;
  isCompleted: boolean;
  followUpCount: number;
  followUps: FollowUpEntry[];
};

type BludOption = {
  id: string;
  code: string;
  name: string;
};

type Payload = {
  blud?: BludOption | null;
  bludOptions?: BludOption[];
  source?: string;
  summary: {
    totalAoi: number;
    completedAoi: number;
    pendingAoi: number;
    totalFollowUps: number;
  };
  items: FollowUpCard[];
};

type ExistingDocumentState = {
  open: boolean;
  document: DocumentItem | null;
  entryIndex: number | null;
  fileName: string;
  customName: string;
};

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

function emptyEntry(order: number): FollowUpEntry {
  return {
    description: "",
    sortOrder: order,
    documents: [],
    evidenceName: "",
  };
}

function statusTone(completed: boolean) {
  return completed
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300";
}

const hiddenScrollbar =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

function SoftGlow() {
  return (
    <>
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-10 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
    </>
  );
}

function MetricCard({
  label,
  value,
  desc,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  desc: string;
  icon: import("react").ComponentType<{ size?: number; className?: string }>;
  accent: { card: string; icon: string; bar: string; ring: string };
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-[30px] border border-slate-200 bg-gradient-to-br ${accent.card} p-5 shadow-sm ring-1 ${accent.ring} transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl dark:border-slate-700 dark:hover:border-slate-600`}
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/50 blur-2xl dark:bg-white/5" />
      <div
        className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${accent.bar}`}
      />
      <div className="relative mb-5 flex items-start justify-between gap-3">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${accent.icon} text-white shadow-lg transition duration-300 group-hover:scale-105`}
        >
          <Icon size={22} />
        </div>
        <div className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-500">
          Live
        </div>
      </div>
      <div className="relative">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-white">
          {value}
        </p>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          {desc}
        </p>
      </div>
    </div>
  );
}

function Modal({
  card,
  open,
  onClose,
  onSaved,
  isReadOnly = false,
  selectedYear,
  selectedBludCode = "",
  fallbackBludCode = "",
}: {
  card: FollowUpCard | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  isReadOnly?: boolean;
  selectedYear: string;
  selectedBludCode?: string;
  fallbackBludCode?: string;
}) {
  const [entries, setEntries] = useState<FollowUpEntry[]>([]);
  const [followUpStatus, setFollowUpStatus] = useState<FollowUpStatus>("DONE");
  const [pendingReason, setPendingReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [existingDocumentState, setExistingDocumentState] =
    useState<ExistingDocumentState>({
      open: false,
      document: null,
      entryIndex: null,
      fileName: "",
      customName: "",
    });

  const temporaryDocumentsRef = useRef<DocumentItem[]>([]);
  const hasRolledBackRef = useRef(false);

  useEffect(() => {
    if (!card || !open) return;
    hasRolledBackRef.current = false;

    const normalizedStatus: FollowUpStatus =
      card.followUpStatus === "NOT_DONE" ? "NOT_DONE" : "DONE";

    setFollowUpStatus(normalizedStatus);
    setPendingReason(card.pendingReason || "");
    setEntries(
      normalizedStatus === "DONE" && card.followUps.length > 0
        ? card.followUps.map((item, index) => ({
            ...item,
            sortOrder: index + 1,
            evidenceName: "",
          }))
        : [emptyEntry(1)],
    );
    setError(null);
    setExistingDocumentState({
      open: false,
      document: null,
      entryIndex: null,
      fileName: "",
      customName: "",
    });
  }, [card, open]);

  useEffect(() => {
    temporaryDocumentsRef.current = entries
      .flatMap((entry) => entry.documents)
      .filter((doc) => doc.cleanupOnCancel);
  }, [entries]);

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

  if (!open || !card) return null;

  const updateFollowUpStatus = (nextStatus: FollowUpStatus) => {
    if (isReadOnly) return;

    setFollowUpStatus(nextStatus);
    setError(null);

    if (nextStatus === "NOT_DONE") {
      setEntries([emptyEntry(1)]);
    }
  };

  const updateEntry = (index: number, patch: Partial<FollowUpEntry>) => {
    if (isReadOnly || followUpStatus === "NOT_DONE") return;

    setEntries((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    );
  };

  const addEntry = () => {
    if (isReadOnly || followUpStatus === "NOT_DONE") return;

    setEntries((prev) => [...prev, emptyEntry(prev.length + 1)]);
  };

  const removeEntry = (index: number) => {
    if (isReadOnly || followUpStatus === "NOT_DONE") return;

    setEntries((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((item, idx) => ({ ...item, sortOrder: idx + 1 })),
    );
  };

  const getEntryValidation = (entry: FollowUpEntry) => {
    const hasDescription = entry.description.trim().length > 0;
    const hasDocuments = entry.documents.length > 0;
    const isFilled = hasDescription || hasDocuments;

    return {
      hasDescription,
      hasDocuments,
      isFilled,
      isValid: !isFilled || (hasDescription && hasDocuments),
    };
  };

  const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
  const MAX_FILES_PER_ENTRY = 5;

  const validateFiles = (filesToValidate: FileList) => {
    const errors: string[] = [];
    const validFiles: File[] = [];

    Array.from(filesToValidate).forEach((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase() || "";

      if (!ALLOWED_EXTENSIONS.includes(extension)) {
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

  const isFormValid = () => {
    if (followUpStatus === "NOT_DONE") {
      return pendingReason.trim().length > 0;
    }

    const filledEntries = entries.filter((entry) => {
      const v = getEntryValidation(entry);
      return v.isFilled;
    });

    if (filledEntries.length === 0) return false;

    return filledEntries.every((entry) => {
      const v = getEntryValidation(entry);
      return v.isValid;
    });
  };

  const normalizeUploadedDocument = (doc: any): DocumentItem => ({
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
  });

  const attachExistingDocument = (
    document: DocumentItem,
    entryIndex: number,
  ) => {
    if (isReadOnly || followUpStatus === "NOT_DONE") return;

    setEntries((prev) =>
      prev.map((item, idx) => {
        if (idx !== entryIndex) return item;

        const alreadyExists = item.documents.some(
          (doc) => doc.id === document.id,
        );
        if (alreadyExists) {
          return {
            ...item,
            evidenceName: "",
          };
        }

        return {
          ...item,
          documents: [...item.documents, { ...document, isPersisted: false }],
          evidenceName: "",
        };
      }),
    );

    setExistingDocumentState({
      open: false,
      document: null,
      entryIndex: null,
      fileName: "",
      customName: "",
    });

    setError(null);
  };

  const uploadEvidence = async (index: number, files: FileList | null) => {
    if (isReadOnly || followUpStatus === "NOT_DONE") return;
    if (!files || files.length === 0 || !card) return;

    const evidenceName = entries[index]?.evidenceName?.trim();

    if (!evidenceName) {
      setError(
        `Nama Evidence untuk Uraian Tindak Lanjut #${
          index + 1
        } wajib diisi sebelum upload dilakukan.`,
      );
      return;
    }

    if (entries[index].documents.length + files.length > MAX_FILES_PER_ENTRY) {
      setError(
        `Maksimal ${MAX_FILES_PER_ENTRY} evidence pendukung per uraian tindak lanjut.`,
      );
      return;
    }

    const { errors, validFiles } = validateFiles(files);
    if (errors.length > 0) {
      setError(errors.join(" "));
      return;
    }

    setUploadingIndex(index);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("responseId", card.id);
      formData.append("customName", evidenceName);
      const uploadBludCode = String(selectedBludCode || fallbackBludCode || "")
        .trim()
        .toUpperCase();

      formData.append("year", selectedYear);
      if (uploadBludCode) {
        formData.append("bludCode", uploadBludCode);
      }
      Array.from(validFiles).forEach((file) => formData.append("files", file));

      const res = await fetch("/api/follow-ups/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (res.status === 409 && json?.conflict && json?.existingDocument) {
        const firstFileName = validFiles[0]?.name || "";

        setExistingDocumentState({
          open: true,
          document: normalizeUploadedDocument(json.existingDocument),
          entryIndex: index,
          fileName: firstFileName,
          customName: evidenceName,
        });
        return;
      }

      if (!res.ok) {
        throw new Error(json?.message || "Gagal upload evidence.");
      }

      setEntries((prev) =>
        prev.map((item, idx) =>
          idx === index
            ? {
                ...item,
                documents: [
                  ...item.documents,
                  ...(json.documents || []).map((doc: any) => ({
                    ...normalizeUploadedDocument(doc),
                    isPersisted: false,
                    cleanupOnCancel: true,
                  })),
                ],
                evidenceName: "",
              }
            : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal upload evidence.");
    } finally {
      setUploadingIndex(null);
    }
  };

  const rollbackTemporaryDocuments = async (documents: DocumentItem[]) => {
    const temporaryDocuments = documents.filter((doc) => doc.cleanupOnCancel);

    if (temporaryDocuments.length === 0) return;

    await Promise.all(
      temporaryDocuments.map(async (doc) => {
        try {
          await fetch(`/api/documents/${doc.id}`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          });
        } catch (error) {
          console.error(
            "Rollback temporary follow-up evidence failed:",
            doc.id,
            error,
          );
        }
      }),
    );
  };

  const removeEvidenceDocument = async (
    entryIndex: number,
    docIndex: number,
    doc: DocumentItem,
  ) => {
    if (isReadOnly || followUpStatus === "NOT_DONE") return;

    setDeletingDocumentId(doc.id);
    setError(null);

    try {
      if (doc.cleanupOnCancel) {
        const res = await fetch(`/api/documents/${doc.id}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        if (!res.ok) {
          throw new Error("Gagal menghapus evidence dari database.");
        }
      }

      updateEntry(entryIndex, {
        documents: entries[entryIndex].documents.filter(
          (_, current) => current !== docIndex,
        ),
      });
    } catch (error) {
      console.error("Gagal menghapus evidence:", doc.id, error);
      setError(
        error instanceof Error
          ? error.message
          : "Gagal menghapus evidence dari database.",
      );
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const save = async () => {
    if (isReadOnly) return;

    if (followUpStatus === "NOT_DONE") {
      const reason = pendingReason.trim();

      if (!reason) {
        setError("Uraian alasan belum ditindaklanjuti wajib diisi.");
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const res = await fetch("/api/follow-ups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            responseId: card.id,
            followUpStatus: "NOT_DONE",
            pendingReason: reason,
            entries: [],
          }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.message || "Gagal menyimpan alasan belum TL.");
        }

        await rollbackTemporaryDocuments(
          entries.flatMap((entry) => entry.documents),
        );
        await onSaved();
        hasRolledBackRef.current = true;
        onClose();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Gagal menyimpan alasan belum TL.",
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    const filledEntries = entries.filter((entry) => {
      const validation = getEntryValidation(entry);
      return validation.isFilled;
    });

    if (filledEntries.length === 0) {
      setError(
        "Minimal 1 tindak lanjut harus diisi lengkap beserta evidence pendukung.",
      );
      return;
    }

    const invalidEntryIndex = entries.findIndex((entry) => {
      const validation = getEntryValidation(entry);
      return validation.isFilled && !validation.isValid;
    });

    if (invalidEntryIndex !== -1) {
      setError(
        `Uraian Tindak Lanjut #${
          invalidEntryIndex + 1
        } wajib dilengkapi dengan minimal 1 evidence pendukung.`,
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responseId: card.id,
          entries: filledEntries.map((entry, index) => ({
            description: entry.description.trim(),
            sortOrder: index + 1,
            documentIds: entry.documents.map((doc) => doc.id),
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message || "Gagal menyimpan tindak lanjut.");
      }

      await onSaved();
      hasRolledBackRef.current = true; // ⬅️ tambahkan di sini
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan tindak lanjut.",
      );
    } finally {
      setSaving(false);
    }
  };

  const closeWithRollback = async () => {
    setClosing(true);

    try {
      await rollbackTemporaryDocuments(
        entries.flatMap((entry) => entry.documents),
      );

      hasRolledBackRef.current = true;
      onClose();
    } finally {
      setClosing(false);
    }
  };

  return (
    <div
      className={`${hiddenScrollbar} fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-6 backdrop-blur-sm`}
    >
      <div className="mx-auto flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div
          className="
  border-b border-slate-100 px-6 py-5 text-white

  bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500

  dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950
"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
                Tindak Lanjut AOI
              </p>
              <h3 className="mt-2 text-xl font-semibold">
                Parameter : {card.parameterLabel}
              </h3>
            </div>

            <button
              onClick={() => void closeWithRollback()}
              disabled={closing || saving}
              className={`rounded-2xl border border-white/15 bg-white/10 p-2 transition hover:bg-white/20 ${
                closing || saving
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer"
              }`}
            >
              {closing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <X size={18} />
              )}
            </button>
          </div>
        </div>

        <div
          className={`${hiddenScrollbar} flex-1 overflow-y-auto bg-slate-50/70 px-6 py-6 dark:bg-slate-950`}
        >
          {isReadOnly ? (
            <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300">
              Mode review Admin BLUD aktif. Data tindak lanjut dan evidence
              hanya dapat dilihat, tidak dapat diubah.
            </div>
          ) : null}

          {!isReadOnly ? (
            <div className="mb-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <label className="block text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Status Tindak Lanjut
              </label>
              <select
                value={followUpStatus}
                onChange={(e) =>
                  updateFollowUpStatus(e.target.value as FollowUpStatus)
                }
                className="mt-3 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="DONE">Sudah di TL</option>
                <option value="NOT_DONE">Belum di TL</option>
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Pilih “Sudah di TL” untuk mengisi uraian tindak lanjut dan
                evidence. Pilih “Belum di TL” untuk mencatat alasan belum
                ditindaklanjuti.
              </p>
            </div>
          ) : card.followUpStatus === "NOT_DONE" ? (
            <div className="mb-5 rounded-[28px] border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                Status Tindak Lanjut
              </p>
              <p className="mt-2 text-sm font-bold text-amber-800 dark:text-amber-200">
                Belum di TL
              </p>
            </div>
          ) : null}

          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <div className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-blue-50/40 to-white p-5 shadow-sm ring-1 ring-blue-500/5 transition duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg dark:border-slate-700 dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900 dark:hover:border-blue-800">
              <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />
              <div className="relative flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                  <Layers3 size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    Modul
                  </p>
                  <p className="mt-2 text-sm font-black leading-6 text-slate-950 dark:text-white">
                    {card.moduleLabel}
                  </p>
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            </div>

            <div className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-violet-50/40 to-white p-5 shadow-sm ring-1 ring-violet-500/5 transition duration-300 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg dark:border-slate-700 dark:from-slate-900 dark:via-violet-950/20 dark:to-slate-900 dark:hover:border-violet-800">
              <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-violet-500/10 blur-2xl" />
              <div className="relative flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20">
                  <FileText size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    Kriteria
                  </p>
                  <p className="mt-2 text-justify line-clamp-3 text-sm font-black leading-6 text-slate-950 dark:text-white">
                    {card.criteriaLabel}
                  </p>
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
            </div>

            <div className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-emerald-50/40 to-white p-5 shadow-sm ring-1 ring-emerald-500/5 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg dark:border-slate-700 dark:from-slate-900 dark:via-emerald-950/20 dark:to-slate-900 dark:hover:border-emerald-800">
              <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
              <div className="relative flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    Skor
                  </p>
                  <p className="mt-2 text-2xl font-black leading-none text-slate-950 dark:text-white">
                    {card.criteriaScore.toFixed(2)}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Nilai kriteria tindak lanjut
                  </p>
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            </div>
          </div>

          {followUpStatus === "NOT_DONE" ? (
            <div className="rounded-[32px] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white p-6 shadow-sm ring-1 ring-amber-500/10 dark:border-amber-900/60 dark:from-amber-950/25 dark:via-slate-900 dark:to-slate-900">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                Alasan Belum di TL
              </div>
              <textarea
                value={pendingReason}
                disabled={isReadOnly}
                onChange={(e) => setPendingReason(e.target.value)}
                rows={5}
                className={`min-h-[180px] w-full resize-none rounded-[26px] border border-amber-300 bg-white px-5 py-4 text-sm leading-6 text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 ${isReadOnly ? "cursor-not-allowed bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" : ""}`}
                placeholder="Jelaskan alasan AOI belum dapat ditindaklanjuti secara jelas, terukur, dan profesional."
              />
              <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Pada status Belum di TL, field evidence dan tombol Tambah Uraian
                TL disembunyikan sesuai aturan proses.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry, index) => {
                const validation = getEntryValidation(entry);
                const showEvidenceWarning =
                  validation.hasDescription && !validation.hasDocuments;
                const showEvidenceNameWarning =
                  entry.documents.length === 0 &&
                  entry.description.trim().length > 0 &&
                  entry.evidenceName.trim().length === 0;

                return (
                  <div
                    key={`${entry.id || "new"}-${index}`}
                    className={`relative overflow-hidden rounded-[32px] border p-6 shadow-sm ring-1 transition duration-300 dark:bg-slate-900 ${
                      showEvidenceWarning
                        ? "border-amber-300 bg-gradient-to-br from-amber-50 via-white to-white ring-amber-500/10 dark:border-amber-900/60 dark:from-amber-950/25 dark:via-slate-900 dark:to-slate-900"
                        : "border-slate-200 bg-gradient-to-br from-white via-blue-50/20 to-white ring-blue-500/5 dark:border-slate-700 dark:from-slate-900 dark:via-blue-950/10 dark:to-slate-900"
                    }`}
                  >
                    <div className="relative mb-5 flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-black text-white shadow-lg shadow-blue-500/20">
                          {index + 1}
                        </div>

                        <div className="min-w-0">
                          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                            Uraian Tindak Lanjut
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            Tambahkan uraian dan evidence pendukung sesuai
                            progres perbaikan.
                          </p>
                        </div>
                      </div>

                      {entries.length > 1 ? (
                        <button
                          onClick={() => removeEntry(index)}
                          disabled={isReadOnly}
                          className={`shrink-0 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 shadow-sm transition hover:bg-red-100 hover:shadow-md dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 ${isReadOnly ? "cursor-not-allowed opacity-60" : ""}`}
                        >
                          Hapus
                        </button>
                      ) : null}
                    </div>

                    <textarea
                      value={entry.description}
                      disabled={isReadOnly}
                      onChange={(e) =>
                        updateEntry(index, { description: e.target.value })
                      }
                      rows={4}
                      className={`min-h-[150px] w-full resize-none rounded-[26px] border px-5 py-4 text-sm leading-6 text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-4 dark:text-white dark:placeholder:text-slate-500 ${
                        showEvidenceWarning
                          ? "border-amber-300 bg-white focus:border-amber-400 focus:ring-amber-500/10 dark:bg-slate-950"
                          : "border-slate-200 bg-white focus:border-blue-400 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950"
                      } ${isReadOnly ? "cursor-not-allowed bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" : ""}`}
                      placeholder="Jelaskan tindak lanjut yang sudah dilakukan secara profesional dan terukur."
                    />

                    {showEvidenceWarning ? (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                          Uraian tindak lanjut sudah diisi, namun evidence
                          pendukung masih belum ditambahkan. Minimal 1 evidence
                          wajib diunggah untuk melengkapi entri ini.
                        </p>
                      </div>
                    ) : null}

                    {showEvidenceNameWarning ? (
                      <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                          Silakan isi Nama Evidence terlebih dahulu agar upload
                          dokumen pendukung dapat dilakukan.
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-5 overflow-hidden rounded-[30px] border border-slate-200 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-950/70">
                      <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-blue-50/50 to-slate-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900">
                        <div className="flex items-center gap-3">
                          <div
                            className="
  flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg

  bg-gradient-to-br from-blue-600 to-cyan-500
  shadow-cyan-500/20

  dark:from-slate-950 dark:to-blue-900
  dark:shadow-blue-950/30
"
                          >
                            <Upload size={18} />
                          </div>
                          <div>
                            <h4 className="font-black text-slate-950 dark:text-white">
                              Evidence Pendukung
                            </h4>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              Lengkapi dokumen pendukung untuk validasi tindak
                              lanjut.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            Maks {MAX_FILE_SIZE_MB}MB
                          </span>

                          <div className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-black text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            {entry.documents.length}/{MAX_FILES_PER_ENTRY}
                          </div>

                          <span className="rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-black text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            Wajib
                          </span>
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30">
                          <p className="text-xs font-black text-amber-800 dark:text-amber-300">
                            Upload Evidence wajib
                          </p>
                          <p className="mt-1 text-xs leading-5 text-amber-700 dark:text-amber-300">
                            Setiap uraian tindak lanjut yang diisi wajib
                            memiliki minimal 1 evidence pendukung.
                          </p>
                        </div>

                        <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
                          <div className="space-y-1">
                            <label className="block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Nama Evidence
                            </label>

                            <input
                              value={entry.evidenceName}
                              disabled={
                                isReadOnly ||
                                entry.documents.length >= MAX_FILES_PER_ENTRY
                              }
                              onChange={(e) =>
                                updateEntry(index, {
                                  evidenceName: e.target.value,
                                })
                              }
                              placeholder={
                                entry.documents.length >= MAX_FILES_PER_ENTRY
                                  ? "Maksimal 5 evidence tercapai"
                                  : "Masukkan nama evidence"
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-800"
                            />
                          </div>

                          <div className="flex flex-col pt-[22px]">
                            <label
                              title={
                                entry.documents.length >= MAX_FILES_PER_ENTRY
                                  ? "Maksimal 5 evidence sudah tercapai"
                                  : !entry.evidenceName.trim()
                                    ? "Isi nama evidence terlebih dahulu"
                                    : ""
                              }
                              className={`inline-flex items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm font-semibold transition ${
                                isReadOnly ||
                                saving ||
                                uploadingIndex === index ||
                                !entry.evidenceName.trim() ||
                                entry.documents.length >= MAX_FILES_PER_ENTRY
                                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                                  : "cursor-pointer border-blue-300 bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100 hover:shadow-md dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60"
                              }`}
                            >
                              {uploadingIndex === index ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Upload size={16} />
                              )}
                              Upload
                              <input
                                type="file"
                                multiple
                                className="hidden"
                                disabled={
                                  isReadOnly ||
                                  saving || // ⬅️ tambahkan ini
                                  uploadingIndex === index ||
                                  !entry.evidenceName.trim() ||
                                  entry.documents.length >= MAX_FILES_PER_ENTRY
                                }
                                onChange={(e) =>
                                  void uploadEvidence(index, e.target.files)
                                }
                              />
                            </label>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          {entry.documents.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
                              Belum ada evidence yang terhubung ke uraian tindak
                              lanjut ini.
                            </div>
                          ) : (
                            entry.documents.map((doc, docIndex) => (
                              <div
                                key={`${doc.id}-${docIndex}`}
                                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition hover:border-blue-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-800"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-white">
                                    <FileText
                                      size={15}
                                      className="text-indigo-500"
                                    />
                                    <span className="truncate">{doc.name}</span>
                                  </div>
                                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                    {doc.originalName}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      window.open(
                                        doc.url,
                                        "_blank",
                                        "noopener,noreferrer",
                                      )
                                    }
                                    className="cursor-pointer rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                  >
                                    <Eye size={14} />
                                  </button>

                                  <button
                                    type="button"
                                    disabled={
                                      isReadOnly ||
                                      deletingDocumentId === doc.id ||
                                      saving
                                    }
                                    onClick={() =>
                                      void removeEvidenceDocument(
                                        index,
                                        docIndex,
                                        doc,
                                      )
                                    }
                                    className={`rounded-xl border border-red-200 p-2 text-red-600 transition ${
                                      isReadOnly ||
                                      deletingDocumentId === doc.id ||
                                      saving
                                        ? "cursor-not-allowed bg-red-50/60 opacity-60"
                                        : "bg-red-50 hover:bg-red-100"
                                    }`}
                                    title="Hapus evidence"
                                  >
                                    {deletingDocumentId === doc.id ? (
                                      <Loader2
                                        size={14}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <X size={14} />
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-6 py-5 shadow-[0_-12px_35px_rgba(15,23,42,0.06)] backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-950/95">
          {followUpStatus === "DONE" ? (
            <button
              onClick={addEntry}
              disabled={isReadOnly}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${
                isReadOnly ? "cursor-not-allowed opacity-60" : "cursor-pointer"
              }`}
            >
              <Plus size={16} />{" "}
              {isReadOnly ? "Mode Review" : "Tambah Uraian TL"}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-bold text-slate-400 opacity-70 shadow-sm transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
              title="Tambah Uraian TL dinonaktifkan karena status Belum di TL"
            >
              <Plus size={16} /> Tambah Uraian TL
            </button>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => void closeWithRollback()}
              disabled={closing || saving}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${
                closing || saving
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer"
              }`}
            >
              {closing ? <Loader2 size={16} className="animate-spin" /> : null}
              {closing ? "Menutup..." : "Tutup"}
            </button>

            <button
              onClick={() => void save()}
              disabled={isReadOnly || saving || !isFormValid()}
              className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white transition ${
                isReadOnly || saving || !isFormValid()
                  ? "cursor-not-allowed bg-slate-300 text-slate-500 dark:bg-slate-800 dark:text-slate-500"
                  : `
      cursor-pointer
      bg-gradient-to-r from-blue-600 to-cyan-500
      shadow-lg shadow-cyan-500/20
      hover:-translate-y-0.5 hover:shadow-xl

      dark:from-slate-950 dark:to-blue-900
      dark:shadow-blue-950/30
    `
              }`}
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ClipboardCheck size={16} />
              )}
              {isReadOnly ? "Review Saja" : "Simpan Tindak Lanjut"}
            </button>
          </div>
        </div>
      </div>

      {existingDocumentState.open &&
        existingDocumentState.document &&
        existingDocumentState.entryIndex !== null && (
          <div
            className={`${hiddenScrollbar} fixed inset-0 z-[60] overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm`}
          >
            <div className="flex min-h-full items-start justify-center py-6">
              <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      Dokumen Existing Ditemukan
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Nama dokumen atau nama file sudah pernah digunakan.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setExistingDocumentState({
                        open: false,
                        document: null,
                        entryIndex: null,
                        fileName: "",
                        customName: "",
                      })
                    }
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-4 px-5 py-5 text-sm">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                    Dokumen dengan nama atau file yang sama sudah ada. Gunakan
                    dokumen yang sudah ada?
                  </div>

                  <div className="rounded-2xl border border-slate-200 px-4 py-4 dark:border-slate-700">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {existingDocumentState.document.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      File existing:{" "}
                      {existingDocumentState.document.originalName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      File yang sedang dipilih: {existingDocumentState.fileName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Nama dokumen input: {existingDocumentState.customName}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
                  <button
                    onClick={() =>
                      setExistingDocumentState({
                        open: false,
                        document: null,
                        entryIndex: null,
                        fileName: "",
                        customName: "",
                      })
                    }
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Batal
                  </button>
                  <button
                    disabled={isReadOnly}
                    onClick={() =>
                      attachExistingDocument(
                        existingDocumentState.document!,
                        existingDocumentState.entryIndex!,
                      )
                    }
                    className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${isReadOnly ? "cursor-not-allowed bg-slate-300" : "bg-indigo-600"}`}
                  >
                    Gunakan Dokumen Existing
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default function TindakLanjutPage({ session }: { session?: any }) {
  const [isClientReady, setIsClientReady] = useState(false);

  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedBludCode, setSelectedBludCode] = useState("");
  const [selectedModuleKey, setSelectedModuleKey] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<FollowUpCard | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const inFlightFetchKeyRef = useRef<string | null>(null);
  const lastLoadedFetchKeyRef = useRef<string | null>(null);
  const skipNextFetchRef = useRef(false);

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  const userRole = isClientReady
    ? String((session?.user as { role?: string } | undefined)?.role || "")
    : "";
  const roleUpper = userRole.toUpperCase();
  const isBpkp =
    roleUpper === "BPKP" ||
    roleUpper === "BPKP_ADMIN" ||
    roleUpper === "BPKP_REVIEWER";
  const usesBpkpGlobalFilter = isBpkpGlobalFilterRole(userRole);
  const {
    selectedYear: globalSelectedYear,
    selectedBludCode: globalSelectedBludCode,
    setSelectedYear: setGlobalSelectedYear,
    setSelectedBludCode: setGlobalSelectedBludCode,
  } = useBpkpGlobalFilterStore();
  const isAdminBludReviewOnly = isClientReady && roleUpper === "BLUD_ADMIN";
  const bludOptions = Array.isArray(payload?.bludOptions)
    ? payload.bludOptions
    : [];
  const showBludFilter =
    isBpkp ||
    String(payload?.source || "").toUpperCase() === "BPKP_SELF_ASSESSMENT" ||
    bludOptions.length > 0;

  const effectiveSelectedYear = usesBpkpGlobalFilter
    ? globalSelectedYear
    : selectedYear;
  const effectiveSelectedBludCode = usesBpkpGlobalFilter
    ? globalSelectedBludCode
    : selectedBludCode;

  const fetchData = async (options?: { force?: boolean }) => {
    if (!isClientReady) return;

    const normalizedBludCode = String(effectiveSelectedBludCode || "")
      .trim()
      .toUpperCase();

    /**
     * Untuk role BPKP/Admin BPKP, request Tindak Lanjut harus langsung memakai
     * BLUD dari global filter. Ini mencegah request awal tanpa bludCode seperti:
     * /api/follow-ups?year=2026
     * lalu disusul request kedua dengan bludCode yang tujuannya sama.
     *
     * Operator BLUD dan Admin BLUD tidak terpengaruh karena mereka tetap memakai
     * konteks BLUD dari session/API seperti alur existing.
     */
    if (usesBpkpGlobalFilter && !normalizedBludCode) {
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();
    params.set("year", effectiveSelectedYear);
    if (normalizedBludCode) {
      params.set("bludCode", normalizedBludCode);
    }
    if (selectedModuleKey.trim()) {
      params.set("moduleKey", selectedModuleKey.trim());
    }

    const requestKey = params.toString();

    if (
      !options?.force &&
      (inFlightFetchKeyRef.current === requestKey ||
        lastLoadedFetchKeyRef.current === requestKey)
    ) {
      return;
    }

    inFlightFetchKeyRef.current = requestKey;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/follow-ups?${requestKey}`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message || "Gagal memuat tindak lanjut.");
      }

      setPayload(json);

      const payloadBludCode = json?.blud?.code
        ? String(json.blud.code).toUpperCase()
        : "";

      if (!normalizedBludCode && payloadBludCode && !usesBpkpGlobalFilter) {
        skipNextFetchRef.current = true;
        setSelectedBludCode(payloadBludCode);
      }

      lastLoadedFetchKeyRef.current = requestKey;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat tindak lanjut.",
      );
      setPayload(null);
    } finally {
      if (inFlightFetchKeyRef.current === requestKey) {
        inFlightFetchKeyRef.current = null;
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isClientReady,
    effectiveSelectedYear,
    effectiveSelectedBludCode,
    selectedModuleKey,
  ]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return (payload?.items || []).filter((item) => {
      const byStatus =
        statusFilter === "all" ||
        (statusFilter === "done" ? item.isCompleted : !item.isCompleted);

      const haystack = [
        item.parameterLabel,
        item.criteriaCode,
        item.criteriaLabel,
        item.aoi,
        item.pendingReason || "",
        item.moduleLabel,
      ]
        .join(" ")
        .toLowerCase();

      const bySearch = !keyword || haystack.includes(keyword);

      return byStatus && bySearch;
    });
  }, [payload, search, statusFilter]);

  const openModal = (card: FollowUpCard) => {
    setSelectedCard(card);
    setModalOpen(true);
  };

  const summary = payload?.summary || {
    totalAoi: 0,
    completedAoi: 0,
    pendingAoi: 0,
    totalFollowUps: 0,
  };

  const getFollowUpAssessmentSource = () => {
    return isBpkp ? "BPKP_SELF_ASSESSMENT" : "BLUD_OPERATOR_SELF_ASSESSMENT";
  };

  const exportFollowUpPdf = () => {
    const params = new URLSearchParams();
    params.set("year", effectiveSelectedYear);
    params.set("assessmentSource", getFollowUpAssessmentSource());

    const normalizedBludCode = String(effectiveSelectedBludCode || "")
      .trim()
      .toUpperCase();

    if (normalizedBludCode) {
      params.set("bludCode", normalizedBludCode);
    }

    window.open(`/api/reports/follow-ups?${params.toString()}`, "_blank");
  };

  if (!isClientReady) {
    return null;
  }

  return (
    <div
      className={`${hiddenScrollbar} h-screen overflow-y-auto text-slate-900 dark:text-slate-100`}
    >
      <div className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <SoftGlow />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20">
              <ShieldCheck size={26} />
            </div>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Monitoring Tindak Lanjut AOI
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  Tindak Lanjut AOI
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Kelola seluruh AOI yang telah diinput, pantau status tindak
                  lanjut, dan dokumentasikan evidence perbaikan secara
                  terstruktur.
                </p>
              </div>
            </div>
          </div>

          <div className="inline-flex w-fit shrink-0 flex-nowrap items-center gap-2 rounded-[26px] border border-slate-200 bg-slate-50/80 p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
            {isBpkp ? (
              <button
                type="button"
                onClick={exportFollowUpPdf}
                disabled={usesBpkpGlobalFilter && !effectiveSelectedBludCode}
                className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-2xl border border-blue-200 bg-white px-4 text-sm font-bold text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-900/60 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
                title={
                  usesBpkpGlobalFilter && !effectiveSelectedBludCode
                    ? "Pilih BLUD terlebih dahulu untuk export PDF"
                    : "Export PDF laporan tindak lanjut AOI"
                }
              >
                <Download size={16} /> Export PDF
              </button>
            ) : null}

            {showBludFilter ? (
              <label className="inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl bg-white px-3 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-700">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  BLUD
                </span>

                <select
                  value={effectiveSelectedBludCode}
                  onChange={(e) => {
                    if (usesBpkpGlobalFilter) {
                      setGlobalSelectedBludCode(e.target.value);
                    } else {
                      setSelectedBludCode(e.target.value);
                    }
                  }}
                  className="max-w-[220px] cursor-pointer appearance-auto bg-transparent text-sm font-bold text-slate-800 outline-none dark:text-white"
                >
                  {bludOptions.length === 0 ? (
                    <option value="">Pilih BLUD</option>
                  ) : null}
                  {bludOptions.map((blud) => (
                    <option key={blud.id} value={blud.code}>
                      {blud.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {!isBpkp ? (
              <button
                type="button"
                onClick={exportFollowUpPdf}
                disabled={usesBpkpGlobalFilter && !effectiveSelectedBludCode}
                className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-2xl border border-blue-200 bg-white px-4 text-sm font-bold text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-900/60 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
                title={
                  usesBpkpGlobalFilter && !effectiveSelectedBludCode
                    ? "Pilih BLUD terlebih dahulu untuk export PDF"
                    : "Export PDF laporan tindak lanjut AOI"
                }
              >
                <Download size={16} /> Export PDF
              </button>
            ) : null}

            <label className="inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl bg-white px-3 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-700">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Tahun
              </span>

              <select
                value={effectiveSelectedYear}
                onChange={(e) => {
                  if (usesBpkpGlobalFilter) {
                    setGlobalSelectedYear(e.target.value);
                  } else {
                    setSelectedYear(e.target.value);
                  }
                }}
                className="w-[70px] cursor-pointer appearance-auto bg-transparent text-sm font-bold text-slate-800 outline-none dark:text-white"
              >
                {["2025", "2026", "2027", "2028"].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={() => void fetchData({ force: true })}
              className="
    inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap
    rounded-2xl px-4 text-sm font-bold text-white transition
    shadow-lg hover:-translate-y-0.5 hover:shadow-xl

    bg-gradient-to-r from-blue-600 to-cyan-500
    shadow-cyan-500/20

    dark:from-slate-950 dark:to-blue-900
    dark:shadow-blue-950/30
  "
            >
              <RefreshCw size={16} /> Refresh Data
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6 pb-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Total AOI",
              value: summary.totalAoi,
              desc: "Seluruh AOI yang telah terinput",
              icon: Layers3,
              accent: {
                card: "from-blue-500/10 via-white to-white dark:from-blue-500/15 dark:via-slate-900 dark:to-slate-900",
                icon: "from-blue-600 to-indigo-600 shadow-blue-500/20",
                ring: "ring-blue-500/10",
                bar: "from-blue-500 to-indigo-500",
              },
            },
            {
              label: "AOI Sudah TL",
              value: summary.completedAoi,
              desc: "AOI yang telah memiliki tindak lanjut",
              icon: CheckCircle2,
              accent: {
                card: "from-emerald-500/10 via-white to-white dark:from-emerald-500/15 dark:via-slate-900 dark:to-slate-900",
                icon: "from-emerald-600 to-teal-600 shadow-emerald-500/20",
                ring: "ring-emerald-500/10",
                bar: "from-emerald-500 to-teal-500",
              },
            },
            {
              label: "AOI Belum TL",
              value: summary.pendingAoi,
              desc: "AOI yang masih menunggu tindak lanjut",
              icon: Clock3,
              accent: {
                card: "from-orange-500/10 via-white to-white dark:from-orange-500/15 dark:via-slate-900 dark:to-slate-900",
                icon: "from-orange-500 to-blue-600 shadow-orange-500/20",
                ring: "ring-orange-500/10",
                bar: "from-orange-500 to-blue-500",
              },
            },
            {
              label: "Total Entri TL",
              value: summary.totalFollowUps,
              desc: "Total uraian tindak lanjut yang tercatat",
              icon: ClipboardCheck,
              accent: {
                card: "from-violet-500/10 via-white to-white dark:from-violet-500/15 dark:via-slate-900 dark:to-slate-900",
                icon: "from-violet-600 to-fuchsia-600 shadow-violet-500/20",
                ring: "ring-violet-500/10",
                bar: "from-violet-500 to-fuchsia-500",
              },
            },
          ].map((item) => (
            <MetricCard key={item.label} {...item} />
          ))}
        </section>

        <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative lg:w-[360px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={15}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari parameter, kriteria, modul, atau AOI..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none shadow-sm transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none shadow-sm transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="all">Tampilkan semua AOI</option>
              <option value="done">AOI sudah di TL</option>
              <option value="pending">AOI belum di TL</option>
            </select>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="h-5 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              </div>
            ))
          ) : filteredItems.length === 0 ? (
            <div className="col-span-full rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900/70">
              <AlertCircle
                className="mx-auto text-slate-400 dark:text-slate-500"
                size={28}
              />
              <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-100">
                Tidak ada AOI yang sesuai dengan filter.
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Sesuaikan pencarian atau filter status untuk melihat data
                lainnya.
              </p>
            </div>
          ) : (
            filteredItems.map((card) => (
              <button
                key={card.id}
                onClick={() => openModal(card)}
                className="group relative flex min-h-[360px] cursor-pointer flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-gradient-to-br from-white via-blue-50/20 to-white p-5 text-left shadow-sm ring-1 ring-blue-500/5 transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl dark:border-slate-700 dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900 dark:hover:border-blue-800"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-500/10 blur-2xl" />

                <div className="relative pr-16">
                  <div className="absolute right-0 top-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 transition duration-300 group-hover:scale-105">
                    <ClipboardCheck size={20} />
                  </div>

                  <div className="flex min-h-[34px] flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {card.moduleLabel}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusTone(card.isCompleted)}`}
                    >
                      {card.isCompleted ? "Sudah di TL" : "Belum di TL"}
                    </span>
                  </div>

                  <h3 className="mt-4 min-h-[56px] text-base font-black leading-7 text-slate-950 line-clamp-2 dark:text-white">
                    {card.parameterLabel}
                  </h3>

                  <p className="mt-1 min-h-[40px] text-xs leading-5 text-slate-500 line-clamp-2 dark:text-slate-400">
                    {card.criteriaLabel} · Skor {card.criteriaScore.toFixed(2)}
                  </p>
                </div>

                <div className="relative mt-4 min-h-[122px] rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Area of Improvement
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
                    {card.aoi}
                  </p>
                </div>

                <div className="relative mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <ClipboardCheck size={13} /> {card.followUpCount} entri TL
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <FileText size={13} />{" "}
                      {card.followUps.reduce(
                        (sum, item) => sum + item.documents.length,
                        0,
                      )}{" "}
                      evidence
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-black text-blue-700 dark:text-blue-300">
                    {isAdminBludReviewOnly
                      ? "Lihat tindak lanjut"
                      : "Kelola tindak lanjut"}{" "}
                    <ChevronRight size={15} />
                  </span>
                </div>
              </button>
            ))
          )}
        </section>
      </div>

      <Modal
        card={selectedCard}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          await fetchData({ force: true });
        }}
        isReadOnly={isAdminBludReviewOnly}
        selectedYear={effectiveSelectedYear}
        selectedBludCode={effectiveSelectedBludCode}
        fallbackBludCode={payload?.blud?.code || ""}
      />
    </div>
  );
}
