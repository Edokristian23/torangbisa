"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Download,
  Edit3,
  FileText,
  Loader2,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

type GuideDocument = {
  id: string;
  name: string;
  description: string | null;
  originalName: string;
  mimeType: string;
  fileExtension: string | null;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: { name: string; username: string } | null;
};

type PanduanPageProps = {
  session?: any;
};

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "BPKP_ADMIN", "ADMIN"]);

function formatFileSize(size: number) {
  if (!size) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(size) / Math.log(1024));
  return `${(size / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function PanduanPage({ session }: PanduanPageProps) {
  const role = session?.user?.role;
  const canManage = ADMIN_ROLES.has(role);

  const [documents, setDocuments] = useState<GuideDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<GuideDocument | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/panduan", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok)
        throw new Error(payload.message || "Gagal memuat dokumen panduan.");

      setDocuments(payload.documents || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat dokumen panduan.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const filteredDocuments = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return documents;

    return documents.filter((item) => {
      return [item.name, item.description || "", item.originalName].some(
        (value) => value.toLowerCase().includes(keyword),
      );
    });
  }, [documents, search]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setFile(null);
    setEditing(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!name.trim()) {
      setError("Nama dokumen wajib diisi.");
      return;
    }

    if (!editing && !file) {
      setError("File dokumen wajib diupload.");
      return;
    }

    setSubmitting(true);

    try {
      const response = editing
        ? await fetch(`/api/panduan/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, description }),
          })
        : await fetch("/api/panduan", {
            method: "POST",
            body: (() => {
              const formData = new FormData();
              formData.append("name", name);
              formData.append("description", description);
              if (file) formData.append("file", file);
              return formData;
            })(),
          });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Proses gagal.");

      setMessage(payload.message || "Data berhasil disimpan.");
      resetForm();
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Proses gagal.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (document: GuideDocument) => {
    setEditing(document);
    setName(document.name);
    setDescription(document.description || "");
    setFile(null);
    setMessage(null);
    setError(null);
  };

  const handleDelete = async (document: GuideDocument) => {
    const confirmed = window.confirm(
      `Hapus dokumen panduan "${document.name}"?`,
    );
    if (!confirmed) return;

    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/panduan/${document.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.message || "Gagal menghapus dokumen.");

      setMessage(payload.message || "Dokumen berhasil dihapus.");
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus dokumen.");
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-blue-100/80 bg-white/80 shadow-[0_20px_55px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70">
      <div className="border-b border-blue-100/80 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 px-6 py-5 text-white dark:border-slate-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <BookOpen className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100">
                Pusat Dokumen
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight">
                Panduan
              </h1>
              <p className="mt-1 max-w-2xl text-sm font-medium text-blue-50">
                Kelola dan akses dokumen panduan resmi untuk mendukung proses
                self assessment BLUD.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
        {(message || error) && (
          <div
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
              error
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
            }`}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error || message}</span>
          </div>
        )}

        {canManage && (
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950 dark:text-white">
                  {editing ? "Ubah Metadata Panduan" : "Tambah Dokumen Panduan"}
                </h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Nama dokumen wajib diisi sebelum dokumen diupload.
                </p>
              </div>
              {editing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" /> Batal
                </button>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                  Nama Dokumen
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Contoh: Panduan Pengisian Self Assessment"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none ring-blue-500/20 transition focus:border-blue-500 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                  File Dokumen
                </span>
                <div className="relative">
                  <input
                    type="file"
                    disabled={!!editing}
                    onChange={(event) =>
                      setFile(event.target.files?.[0] || null)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-black file:text-blue-700 hover:file:bg-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:file:bg-blue-950 dark:file:text-blue-300"
                  />
                  <UploadCloud className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                </div>
                {editing && (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Perubahan file dibuat dengan hapus lalu upload dokumen baru.
                  </p>
                )}
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                Deskripsi
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Tambahkan catatan singkat tentang isi panduan."
                rows={3}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none ring-blue-500/20 transition focus:border-blue-500 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-700 to-cyan-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editing ? (
                  <Edit3 className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {editing ? "Simpan Perubahan" : "Tambah Panduan"}
              </button>
            </div>
          </form>
        )}

        <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950 dark:text-white">
                Daftar Dokumen Panduan
              </h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Kelola dan akses dokumen panduan resmi untuk mendukung proses
                self assessment BLUD.
              </p>
            </div>

            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari panduan..."
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-semibold outline-none ring-blue-500/20 transition focus:border-blue-500 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 py-12 text-sm font-bold text-slate-500 dark:border-slate-700">
              <Loader2 className="h-5 w-5 animate-spin" /> Memuat dokumen
              panduan...
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center dark:border-slate-700">
              <FileText className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-black text-slate-600 dark:text-slate-300">
                Belum ada dokumen panduan.
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                Dokumen akan muncul setelah Admin BPKP melakukan upload.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredDocuments.map((document) => (
                <article
                  key={document.id}
                  className="group rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/40 p-5 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:from-slate-950 dark:to-slate-900"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-black text-slate-950 dark:text-white">
                        {document.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                        {document.description || "Tidak ada deskripsi."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                          {document.fileExtension?.toUpperCase() || "FILE"}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                          {formatFileSize(document.fileSize)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                          {formatDate(document.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <p className="max-w-full truncate text-xs font-semibold text-slate-400">
                      File: {document.originalName}
                    </p>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/panduan/${document.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                      >
                        <Download className="h-4 w-4" /> Preview
                      </a>

                      {canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEdit(document)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <Edit3 className="h-4 w-4" /> Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(document)}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" /> Hapus
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
