'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Download,
  Edit3,
  ExternalLink,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Link2,
  Loader2,
  PlayCircle,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';

import {
  GUIDE_CATEGORY_OPTIONS,
  getGuideCategoryOption,
  type GuideDocumentCategory,
} from '@/lib/guide-categories';

type GuideSourceType = 'FILE' | 'LINK';

type GuideDocument = {
  id: string;
  category: GuideDocumentCategory;
  name: string;
  description: string | null;
  originalName: string;
  mimeType: string;
  fileExtension: string | null;
  fileSize: number;
  checksumSha256?: string | null;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: { name: string | null; username: string | null } | null;
};

type PermissionState = {
  role: string | null;
  canManage: boolean;
};

type FetchDocumentsResult = {
  documents: GuideDocument[];
  permissions: PermissionState;
};

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const LINK_MIME_TYPE = 'text/uri-list';

let initialPanduanRequest: Promise<FetchDocumentsResult> | null = null;

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  return `${(size / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function isLinkDocument(document: GuideDocument) {
  return document.mimeType === LINK_MIME_TYPE || document.fileExtension === 'url';
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function getYoutubeEmbedUrl(value: string) {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.replace(/^www\./, '');
    let videoId = '';

    if (hostname === 'youtu.be') {
      videoId = url.pathname.split('/').filter(Boolean)[0] || '';
    }

    if (hostname === 'youtube.com' || hostname === 'm.youtube.com' || hostname === 'youtube-nocookie.com') {
      if (url.pathname.startsWith('/watch')) videoId = url.searchParams.get('v') || '';
      if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')) {
        videoId = url.pathname.split('/').filter(Boolean)[1] || '';
      }
    }

    return videoId ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` : null;
  } catch {
    return null;
  }
}

function getFileIcon(mimeType: string) {
  if (mimeType === LINK_MIME_TYPE) return PlayCircle;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet;
  if (mimeType.includes('zip') || mimeType.includes('archive')) return FileArchive;
  return FileText;
}

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      message:
        text.startsWith('<!DOCTYPE') || text.startsWith('<html')
          ? 'Server mengembalikan halaman HTML, bukan JSON. Cek route API.'
          : 'Response API tidak valid / bukan JSON.',
      raw: text,
    };
  }
}

async function requestPanduanDocuments() {
  const response = await fetch('/api/panduan', { cache: 'no-store' });
  const payload = await parseJsonSafe(response);

  if (!response.ok) throw new Error(payload.message || 'Gagal memuat dokumen panduan.');

  return {
    documents: Array.isArray(payload.documents) ? payload.documents : [],
    permissions: {
      role: payload.permissions?.role || null,
      canManage: Boolean(payload.permissions?.canManage),
    },
  };
}

function SoftGlow() {
  return (
    <>
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-10 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
    </>
  );
}

export default function PanduanPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [documents, setDocuments] = useState<GuideDocument[]>([]);
  const [permissions, setPermissions] = useState<PermissionState>({ role: null, canManage: false });
  const [activeCategory, setActiveCategory] = useState<GuideDocumentCategory>('PETUNJUK_TOOLS');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [category, setCategory] = useState<GuideDocumentCategory>('PETUNJUK_TOOLS');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<GuideSourceType>('FILE');
  const [linkUrl, setLinkUrl] = useState('');
  const [editing, setEditing] = useState<GuideDocument | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GuideDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canManage = permissions.canManage;

  const fetchDocuments = useCallback(async (options?: { reuseInitialRequest?: boolean }) => {
    setLoading(true);
    setError(null);

    try {
      const result = options?.reuseInitialRequest
        ? (initialPanduanRequest ??= requestPanduanDocuments())
        : await requestPanduanDocuments();

      const payload = await result;

      setDocuments(payload.documents);
      setPermissions(payload.permissions);
    } catch (err) {
      if (options?.reuseInitialRequest) initialPanduanRequest = null;
      setError(err instanceof Error ? err.message : 'Gagal memuat dokumen panduan.');
      setPermissions({ role: null, canManage: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDocuments({ reuseInitialRequest: true });
  }, [fetchDocuments]);

  const categoryStats = useMemo(() => {
    return GUIDE_CATEGORY_OPTIONS.reduce<Record<GuideDocumentCategory, number>>((acc, item) => {
      acc[item.value] = documents.filter((document) => document.category === item.value).length;
      return acc;
    }, {} as Record<GuideDocumentCategory, number>);
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return documents
      .filter((item) => item.category === activeCategory)
      .filter((item) => {
        if (!keyword) return true;
        return [item.name, item.description || '', item.originalName, item.uploadedBy?.name || ''].some((value) =>
          value.toLowerCase().includes(keyword),
        );
      });
  }, [documents, activeCategory, search]);

  const activeCategoryMeta = getGuideCategoryOption(activeCategory);
  const ActiveIcon = activeCategoryMeta.icon;

  const resetForm = () => {
    setCategory(activeCategory);
    setName('');
    setDescription('');
    setFile(null);
    setSourceType('FILE');
    setLinkUrl('');
    setEditing(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const changeActiveCategory = (value: GuideDocumentCategory) => {
    setActiveCategory(value);
    if (!editing) setCategory(value);
  };

  const changeSourceType = (value: GuideSourceType) => {
    setSourceType(value);
    setError(null);
    if (value === 'FILE') setLinkUrl('');
    if (value === 'LINK') {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!canManage) {
      setError('Hanya Admin BPKP yang dapat mengelola dokumen panduan.');
      return;
    }

    if (!name.trim()) {
      setError('Nama dokumen wajib diisi sebelum upload.');
      return;
    }

    if (!editing && sourceType === 'FILE' && !file) {
      setError('File dokumen wajib diupload.');
      return;
    }

    if (!editing && sourceType === 'LINK' && !isValidUrl(linkUrl)) {
      setError('Link panduan wajib berupa URL http/https yang valid.');
      return;
    }

    if (file && file.size > MAX_FILE_SIZE) {
      setError('Ukuran file maksimal 15MB.');
      return;
    }

    setSubmitting(true);

    try {
      const response = editing
        ? await fetch(`/api/panduan/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, name, description }),
          })
        : await fetch('/api/panduan', {
            method: 'POST',
            body: (() => {
              const formData = new FormData();
              formData.append('category', category);
              formData.append('name', name);
              formData.append('description', description);
              formData.append('sourceType', sourceType);
              if (sourceType === 'FILE' && file) formData.append('file', file);
              if (sourceType === 'LINK') formData.append('linkUrl', linkUrl.trim());
              return formData;
            })(),
          });

      const payload = await parseJsonSafe(response);
      if (!response.ok) throw new Error(payload.message || 'Proses gagal.');

      initialPanduanRequest = null;
      setMessage(payload.message || 'Data berhasil disimpan.');
      setActiveCategory(category);
      resetForm();
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Proses gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (document: GuideDocument) => {
    if (!canManage) return;
    setEditing(document);
    setActiveCategory(document.category);
    setCategory(document.category);
    setName(document.name);
    setDescription(document.description || '');
    setFile(null);
    setSourceType(isLinkDocument(document) ? 'LINK' : 'FILE');
    setLinkUrl(isLinkDocument(document) ? document.originalName : '');
    setMessage(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const requestDelete = (document: GuideDocument) => {
    if (!canManage || deleting) return;
    setDeleteTarget(document);
    setMessage(null);
    setError(null);
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!canManage || !deleteTarget || deleting) return;

    setMessage(null);
    setError(null);
    setDeleting(true);

    try {
      const response = await fetch(`/api/panduan/${deleteTarget.id}`, { method: 'DELETE' });
      const payload = await parseJsonSafe(response);
      if (!response.ok) throw new Error(payload.message || 'Gagal menghapus dokumen.');

      initialPanduanRequest = null;
      setMessage(payload.message || 'Dokumen berhasil dihapus.');
      setDeleteTarget(null);
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus dokumen.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl shadow-slate-200/60 ring-1 ring-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30">
      <div className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <SoftGlow />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20 dark:shadow-blue-950/30">
              <BookOpen size={28} />
            </div>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Pusat Dokumen
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Panduan</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Kelola dan akses dokumen panduan resmi berdasarkan kategori agar Admin BLUD dan Operator BLUD lebih mudah menemukan dokumen yang dibutuhkan.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[560px]">
            {GUIDE_CATEGORY_OPTIONS.map((item) => {
              const Icon = item.icon;
              const active = activeCategory === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => changeActiveCategory(item.value)}
                  className={`rounded-3xl px-4 py-4 text-left transition ${
                    active
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/20 hover:-translate-y-0.5 hover:shadow-xl dark:from-slate-950 dark:to-blue-900 dark:text-white dark:shadow-blue-950/30'
                      : 'border border-slate-200 bg-white/80 text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:hover:border-blue-800 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="mb-3 h-5 w-5" />
                  <span className="block text-xs font-black leading-tight">{item.label}</span>
                  <span className={`mt-2 block text-[11px] font-black ${active ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'}`}>
                    {categoryStats[item.value] || 0} dokumen
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto bg-slate-50/80 p-5 dark:bg-slate-900/70">
        {(message || error) && (
          <div
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
              error
                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
            }`}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error || message}</span>
          </div>
        )}

        {canManage && (
          <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950 dark:text-white">{editing ? 'Ubah Metadata Panduan' : 'Tambah Dokumen Panduan'}</h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Pilih sumber panduan berupa dokumen atau link video. File tidak diubah saat edit untuk menjaga integritas dokumen.
                </p>
              </div>
              {editing && (
                <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                  <X className="h-4 w-4" /> Batal
                </button>
              )}
            </div>

            {!editing && (
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => changeSourceType('FILE')} className={`rounded-2xl border px-4 py-3 text-left transition ${sourceType === 'FILE' ? 'border-blue-500 bg-blue-50 text-blue-700 ring-4 ring-blue-500/10 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'}`}>
                  <span className="flex items-center gap-2 text-sm font-black"><UploadCloud className="h-4 w-4" /> Upload Dokumen</span>
                  <span className="mt-1 block text-xs font-semibold opacity-80">PDF, Word, Excel, PowerPoint, gambar, atau teks.</span>
                </button>
                <button type="button" onClick={() => changeSourceType('LINK')} className={`rounded-2xl border px-4 py-3 text-left transition ${sourceType === 'LINK' ? 'border-blue-500 bg-blue-50 text-blue-700 ring-4 ring-blue-500/10 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'}`}>
                  <span className="flex items-center gap-2 text-sm font-black"><Link2 className="h-4 w-4" /> Upload Link</span>
                  <span className="mt-1 block text-xs font-semibold opacity-80">Cocok untuk video YouTube atau materi eksternal.</span>
                </button>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">Submenu</span>
                <select value={category} onChange={(event) => setCategory(event.target.value as GuideDocumentCategory)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none ring-blue-500/20 transition focus:border-blue-500 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                  {GUIDE_CATEGORY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">Nama Dokumen</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Panduan Pengisian Self Assessment" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none ring-blue-500/20 transition focus:border-blue-500 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </label>

              {sourceType === 'FILE' ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">File Dokumen</span>
                  <div className="relative">
                    <input ref={fileInputRef} type="file" disabled={!!editing} onChange={(event) => setFile(event.target.files?.[0] || null)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-black file:text-blue-700 hover:file:bg-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:file:bg-blue-950 dark:file:text-blue-300" />
                    <UploadCloud className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  </div>
                </label>
              ) : (
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">Link Video / Materi</span>
                  <div className="relative">
                    <input value={linkUrl} disabled={!!editing} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-11 text-sm font-semibold text-slate-800 outline-none ring-blue-500/20 transition focus:border-blue-500 focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                    <Link2 className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  </div>
                </label>
              )}
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">Deskripsi</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Tambahkan catatan singkat tentang isi panduan." rows={3} className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none ring-blue-500/20 transition focus:border-blue-500 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            </label>

            <div className="mt-4 flex justify-end">
              <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 dark:from-slate-950 dark:to-blue-900 dark:shadow-blue-950/30">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editing ? 'Simpan Perubahan' : 'Tambah Panduan'}
              </button>
            </div>
          </form>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                <ActiveIcon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-950 dark:text-white">{activeCategoryMeta.label}</h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{activeCategoryMeta.description}</p>
              </div>
            </div>

            <div className="relative w-full lg:w-96">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari panduan..." className="h-14 w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold outline-none ring-blue-500/20 transition focus:border-blue-500 focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500" />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 py-14 text-sm font-bold text-slate-500 dark:border-slate-700">
              <Loader2 className="h-5 w-5 animate-spin" /> Memuat dokumen panduan...
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center dark:border-slate-700">
              <FileText className="mx-auto h-11 w-11 text-slate-300 dark:text-slate-600" />
              <p className="mt-3 text-sm font-black text-slate-600 dark:text-slate-300">Belum ada dokumen pada submenu ini.</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">Dokumen akan muncul setelah Admin BPKP melakukan upload.</p>
            </div>
          ) : (
            <div className="columns-1 gap-4 lg:columns-2 [column-fill:balance]">
              {filteredDocuments.map((document) => {
                const DocumentIcon = getFileIcon(document.mimeType);
                const linkDocument = isLinkDocument(document);
                const embedUrl = linkDocument ? getYoutubeEmbedUrl(document.originalName) : null;

                return (
                  <article key={document.id} className="group mb-4 inline-block w-full break-inside-avoid overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/40 p-5 align-top transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700 dark:from-slate-950 dark:to-slate-900">
                    {linkDocument && embedUrl && (
                      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-inner dark:border-slate-800">
                        <iframe
                          src={embedUrl}
                          title={document.name}
                          className="aspect-video w-full"
                          loading="lazy"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                    )}

                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                        <DocumentIcon className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-black text-slate-950 dark:text-white">{document.name}</h3>
                        <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-500 dark:text-slate-400">{document.description || 'Tidak ada deskripsi.'}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">{linkDocument ? 'VIDEO LINK' : document.fileExtension?.toUpperCase() || 'FILE'}</span>
                          {!linkDocument && <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">{formatFileSize(document.fileSize)}</span>}
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">{formatDate(document.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <p className="max-w-full truncate text-xs font-semibold text-slate-400">{linkDocument ? `Link: ${document.originalName}` : `File: ${document.originalName}`}</p>
                      <div className="flex items-center gap-2">
                        {linkDocument ? (
                          <a href={document.originalName} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60">
                            <ExternalLink className="h-4 w-4" /> Buka Link
                          </a>
                        ) : (
                          <a href={`/api/panduan/${document.id}/file`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60">
                            <Download className="h-4 w-4" /> Preview
                          </a>
                        )}

                        {canManage && (
                          <>
                            <button type="button" onClick={() => handleEdit(document)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                              <Edit3 className="h-4 w-4" /> Ubah
                            </button>
                            <button type="button" onClick={() => requestDelete(document)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                              <Trash2 className="h-4 w-4" /> Hapus
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-guide-title">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl shadow-slate-950/30 dark:border-slate-700 dark:bg-slate-900">
            <div className="relative overflow-hidden border-b border-slate-100 px-6 py-5 dark:border-slate-800">
              <SoftGlow />
              <div className="relative flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900/50">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-red-500 dark:text-red-300">Konfirmasi Hapus</p>
                  <h3 id="delete-guide-title" className="mt-1 text-xl font-black text-slate-950 dark:text-white">Hapus panduan?</h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                    Tindakan ini akan menghapus panduan dari daftar aktif dan tidak dapat dibatalkan melalui halaman ini.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/50">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Nama Panduan</p>
                <p className="mt-1 line-clamp-2 text-sm font-black text-slate-800 dark:text-slate-100">{deleteTarget.name}</p>
                <p className="mt-2 truncate text-xs font-semibold text-slate-400">
                  {isLinkDocument(deleteTarget) ? `Link: ${deleteTarget.originalName}` : `File: ${deleteTarget.originalName}`}
                </p>
              </div>

              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeDeleteDialog}
                  disabled={deleting}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDelete()}
                  disabled={deleting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-500/20 transition hover:-translate-y-0.5 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-700 dark:hover:bg-red-600"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Hapus Panduan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
