"use client";
import { useFormStatus } from "react-dom";

export const LoginButton = () => {
    const {pending} = useFormStatus();
    return (<div className="relative">
        <button
          type="submit"
          disabled={pending}
          className="w-full py-2 px-4 bg-[#69b3ac] text-white rounded-3xl transition delay-150 duration-300 ease-in-out hover:-translate-y-1 hover:scale-105 hover:bg-[#f5b00d] hover:cursor-pointer mt-2"
        >
          {pending ? "Authenticating..." : "Login"}
        </button>
      </div>)
}

export const RegisterButton = () => {
    const {pending} = useFormStatus();
    return (<div className="relative">
        <button
          type="submit"
          disabled={pending}
          className="w-full py-2 px-4 bg-[#69b3ac] text-white rounded-3xl transition delay-150 duration-300 ease-in-out hover:-translate-y-1 hover:scale-105 hover:bg-[#f5b00d] hover:cursor-pointer mt-2"
        >
          {pending ? "Registering..." : "Register"}
        </button>
      </div>)
}