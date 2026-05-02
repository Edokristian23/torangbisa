'use client';

import { useActionState, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { RegisterButton } from '@/components/button';
import { signUpCredentials } from '@/lib/actions';

const FormRegister = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [state, formAction] = useActionState<any, FormData>(signUpCredentials, null);

  return (
    <form className="space-y-4" action={formAction}>
      {state?.message ? (
        <div className="mb-2 rounded-lg bg-red-100 p-2 text-red-800" role="alert">
          <span className="text-md font-medium">{state.message}</span>
        </div>
      ) : null}

      <div className="relative">
        <input name="username" type="text" placeholder="Masukkan username BLUD" className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 ps-3.5 pe-10 text-sm text-slate-600 outline-none focus:border-[#69b3ac] focus:bg-white focus:ring-2 focus:ring-[#c3e0dd]" />
        <span className="text-xs text-red-500">{state?.error?.username?.[0]}</span>
      </div>

      <div className="relative">
        <input name="name" type="text" placeholder="Masukkan nama BLUD" className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 ps-3.5 pe-10 text-sm text-slate-600 outline-none focus:border-[#69b3ac] focus:bg-white focus:ring-2 focus:ring-[#c3e0dd]" />
        <span className="text-xs text-red-500">{state?.error?.name?.[0]}</span>
      </div>

      <div className="relative">
        <input id="register-password" name="password" type={isVisible ? 'text' : 'password'} placeholder="Masukkan password BLUD" className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 ps-3.5 pe-10 text-sm text-slate-600 outline-none focus:border-[#69b3ac] focus:bg-white focus:ring-2 focus:ring-[#c3e0dd]" />
        <button className="absolute inset-y-0 inset-e-0 z-20 flex h-10 cursor-pointer items-center rounded-e-md px-2.5 text-gray-400 transition-colors hover:text-[#69b3ac] focus:outline-none focus-visible:text-[#69b3ac]" type="button" onClick={() => setIsVisible((prevState) => !prevState)}>
          {isVisible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
        <span className="text-xs text-red-500">{state?.error?.password?.[0]}</span>
      </div>

      <div className="relative">
        <input name="confirmPassword" type={isVisible ? 'text' : 'password'} placeholder="Konfirmasi password BLUD" className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 ps-3.5 pe-10 text-sm text-slate-600 outline-none focus:border-[#69b3ac] focus:bg-white focus:ring-2 focus:ring-[#c3e0dd]" />
        <span className="text-xs text-red-500">{state?.error?.confirmPassword?.[0]}</span>
      </div>

      <RegisterButton />
    </form>
  );
};

export default FormRegister;
