"use client";

import { useEffect, useState } from "react";
import { KeyRound, Plus, RefreshCw, Shield, ToggleLeft, ToggleRight, UserCog } from "lucide-react";

const ROLE_OPTIONS = ["SUPER_ADMIN", "BPKP_ADMIN", "BPKP_REVIEWER", "BLUD_ADMIN", "BLUD_OPERATOR", "AUDITOR"];

type UserItem = {
  id: string;
  username: string;
  email?: string | null;
  name: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  bludId: string | null;
  bludCode: string | null;
  bludName: string | null;
  failedLoginCount: number;
  lockedUntil?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
};

type BludItem = {
  id: string;
  code: string;
  name: string;
};

export default function UserPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [bluds, setBluds] = useState<BludItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", name: "", password: "", role: "BLUD_OPERATOR", bludId: "", mustChangePassword: true });

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "Gagal memuat user.");
      setUsers(payload.users || []);
      setBluds(payload.bluds || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat user.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const createUser = async () => {
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Gagal membuat user.');
      setUsers((prev) => [payload.user, ...prev]);
      setMessage('User berhasil dibuat.');
      setShowCreate(false);
      setForm({ username: '', email: '', name: '', password: '', role: 'BLUD_OPERATOR', bludId: '', mustChangePassword: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat user.');
    }
  };

  const patchUser = async (id: string, payload: Record<string, unknown>, successMessage: string) => {
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Gagal memperbarui user.');
      setUsers((prev) => prev.map((user) => (user.id === id ? data.user : user)));
      setMessage(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui user.');
    }
  };

  const toggleActive = async (user: UserItem) => patchUser(user.id, { isActive: !user.isActive }, 'Status user berhasil diperbarui.');
  const resetPassword = async (user: UserItem) => {
    const password = window.prompt(`Masukkan password baru untuk ${user.username}`);
    if (!password) return;
    await patchUser(user.id, { password, mustChangePassword: true }, 'Password berhasil direset.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Enterprise User Management</h2>
          <p className="text-sm text-slate-500">Kelola multi-role, reset password, dan penguncian akun untuk BPKP dan BLUD.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => void loadUsers()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={() => setShowCreate((prev) => !prev)} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            <Plus size={16} /> Tambah User
          </button>
        </div>
      </div>

      {(message || error) && (
        <div className={`rounded-2xl px-4 py-3 text-sm ${error ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || message}
        </div>
      )}

      {showCreate && (
        <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2 xl:grid-cols-3">
          <input value={form.username} onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))} placeholder="Username" className="rounded-2xl border px-4 py-3 text-sm" />
          <input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email (opsional)" className="rounded-2xl border px-4 py-3 text-sm" />
          <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nama lengkap" className="rounded-2xl border px-4 py-3 text-sm" />
          <input value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} placeholder="Password kuat" type="password" className="rounded-2xl border px-4 py-3 text-sm" />
          <select value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value, bludId: ['BLUD_ADMIN', 'BLUD_OPERATOR'].includes(e.target.value) ? prev.bludId : '' }))} className="rounded-2xl border px-4 py-3 text-sm">
            {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <select value={form.bludId} onChange={(e) => setForm((prev) => ({ ...prev, bludId: e.target.value }))} disabled={!['BLUD_ADMIN', 'BLUD_OPERATOR'].includes(form.role)} className="rounded-2xl border px-4 py-3 text-sm disabled:bg-slate-100">
            <option value="">Pilih BLUD</option>
            {bluds.map((blud) => <option key={blud.id} value={blud.id}>{blud.code} - {blud.name}</option>)}
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.mustChangePassword} onChange={(e) => setForm((prev) => ({ ...prev, mustChangePassword: e.target.checked }))} />
            Wajib ganti password saat login pertama
          </label>
          <div className="md:col-span-2 xl:col-span-3">
            <button onClick={createUser} className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Simpan User</button>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Memuat data user...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">User</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">BLUD</th>
                  <th className="px-3 py-3">Keamanan</th>
                  <th className="px-3 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b align-top">
                    <td className="px-3 py-4">
                      <p className="font-semibold text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.username}</p>
                      <p className="text-xs text-slate-500">{user.email || '-'}</p>
                    </td>
                    <td className="px-3 py-4">
                      <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"><Shield size={13} /> {user.role}</div>
                    </td>
                    <td className="px-3 py-4 text-xs text-slate-600">{user.bludCode ? `${user.bludCode} - ${user.bludName}` : '-'}</td>
                    <td className="px-3 py-4 text-xs text-slate-600">
                      <p>Status: <span className={user.isActive ? 'text-emerald-700' : 'text-red-700'}>{user.isActive ? 'Aktif' : 'Nonaktif'}</span></p>
                      <p>Gagal login: {user.failedLoginCount}</p>
                      <p>Wajib ganti password: {user.mustChangePassword ? 'Ya' : 'Tidak'}</p>
                      <p>Locked until: {user.lockedUntil ? new Date(user.lockedUntil).toLocaleString('id-ID') : '-'}</p>
                      <p>Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('id-ID') : '-'}</p>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => void toggleActive(user)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50">
                          {user.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          {user.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button onClick={() => void resetPassword(user)} className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100">
                          <KeyRound size={14} /> Reset Password
                        </button>
                        <button onClick={() => void patchUser(user.id, { mustChangePassword: !user.mustChangePassword }, 'Flag ganti password diperbarui.')} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                          <UserCog size={14} /> Toggle Force Change
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
