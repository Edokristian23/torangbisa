'use client';

import { useActionState, useState } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';

import { LoginButton } from '@/components/button';
import { signInCredentials } from '@/lib/actions';

const FormLogin = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [state, formAction] = useActionState<any, FormData>(signInCredentials, null);

  return (
    <form className="space-y-4" action={formAction}>
      {state?.message ? (
        <div className="mb-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800" role="alert">
          <span className="text-sm font-medium">{state.message}</span>
        </div>
      ) : null}

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <div className="flex items-center gap-2 font-semibold"><ShieldCheck size={14} /> Secure Login</div>
        <p className="mt-1">Akun akan dikunci sementara setelah 5 percobaan login gagal.</p>
      </div>

      <div className="relative">
        <input
          name="username"
          type="text"
          autoComplete="username"
          placeholder="Masukkan username"
          className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 ps-3.5 pe-10 text-sm text-slate-600 outline-none focus:border-[#69b3ac] focus:bg-white focus:ring-2 focus:ring-[#c3e0dd]"
        />
        <div aria-live="polite" aria-atomic="true" className="flex items-center">
          <span className="mx-1 mt-0.5 text-xs text-red-500">{state?.error?.username?.[0]}</span>
        </div>
      </div>

      <div className="relative">
        <input
          id="password"
          name="password"
          type={isVisible ? 'text' : 'password'}
          autoComplete="current-password"
          className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 ps-3.5 pe-10 text-sm text-slate-600 outline-none focus:border-[#69b3ac] focus:bg-white focus:ring-2 focus:ring-[#c3e0dd]"
          placeholder="Masukkan password"
          aria-label="Password"
        />
        <button
          className="absolute inset-y-0 inset-e-0 z-20 flex h-10 cursor-pointer items-center rounded-e-md px-2.5 text-gray-400 transition-colors hover:text-[#69b3ac] focus:outline-none focus-visible:text-[#69b3ac]"
          type="button"
          onClick={() => setIsVisible((prevState) => !prevState)}
          aria-label={isVisible ? 'Hide password' : 'Show password'}
          aria-pressed={isVisible}
          aria-controls="password"
        >
          {isVisible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
        <div aria-live="polite" aria-atomic="true" className="flex items-center">
          <span className="mx-1 mt-0.5 text-xs text-red-500">{state?.error?.password?.[0]}</span>
        </div>
      </div>

      <LoginButton />
    </form>
  );
};

export default FormLogin;
