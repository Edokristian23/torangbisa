"use client";

import TopBar from "@/components/topbar/top-bar";
import { ShinyText } from "@/components/lightswind/shiny-text";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
// import { signIn } from "@/auth";
import { signIn } from "next-auth/react";
import FormLogin from "./form-login";

export const LeftSide = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [selectedYear, setSelectedYear] = useState("Pilih Tahun Anggaran");

  const selectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedYear(value);
  };

  (useEffect(() => {
    // console.log(selectedYear);
  }),
    []);

  const toggleVisibility = () => setIsVisible((prevState) => !prevState);
  return (
    <div className="xl:max-w-96 lg:w-1/2 w-fit bg-white flex flex-col justify-center xl:px-10 lg:px-10 md:px-10 sm:px-10 px-8 xl:rounded-tr-none xl:rounded-br-none lg:rounded-tr-none lg:rounded-br-none rounded-tr-[2.5rem] rounded-br-[2.5rem] rounded-tl-[2.5rem] rounded-bl-[2.5rem] h-1/2">
      <div className="pt-10">
        <TopBar />
      </div>
      <div className="max-w-md text-center">
        {/* <h1 className='shine-text xl:text-5xl lg:text-3xl md:text-3xl sm:text-3xl text-2xl font-bold mb-4'>Torang Bisa!</h1> */}
        <ShinyText
          className="xl:text-5xl lg:text-5xl md:text-4xl sm:text-4xl text-3xl font-bold mb-1 mt-4 py-2"
          shineColor="#f5b00d"
          baseColor="#ff4a2d"
        >
          Torang Bisa!
        </ShinyText>

        <p className="text-[#69b3ac] mt-2 mb-4 font-medium xl:text-sm lg:text-sm md:text-xs sm text-xs">
          Welcome to
          <span className="text-[#f5b00d] font-medium xl:text-sm lg:text-sm md:text-xs sm text-xs">
            {" "}
            Risk Management BLUD.
          </span>
        </p>

        {/* Login Google */}
        {/* <button className="w-full text-sm text-slate-600 bg-white border border-slate-300 appearance-none rounded-lg ps-3.5 pe-10 py-2.5 outline-none focus:bg-white focus:border-[#69b3ac] focus:ring-2 focus:ring-[#c3e0dd] flex items-center justify-center space-x-3 transition delay-150 duration-300 ease-in-out hover:-translate-y-1 hover:scale-105 hover:cursor-pointer">
          <Image
            src="/google.png"
            className="h-5 w-5"
            width={100}
            height={100}
            alt="google icon"
          />
          <span className="text-sm">Login With Google</span>
        </button> */}
        {/* End Login Google */}

        {/* Divider */}
        {/* <div className="relative flex py-1 items-center pr-20 pl-20">
          <div className="grow border-t mt-1 border-gray-400"></div>
          <span className="shrink mx-4 text-gray-400">or</span>
          <div className="grow border-t mt-1 border-gray-400"></div>
        </div> */}
        {/* End Divider */}

        <FormLogin />
        <p className="text-center text-[0.65rem] text-gray-500 pb-10 mt-6">
          © 2026 RISK MANAGEMENT BLUD - BPKP Hadir Bermanfaat
        </p>
      </div>
    </div>
  );
};
