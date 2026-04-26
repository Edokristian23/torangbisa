"use client";

import { ShinyText } from "@/components/lightswind/shiny-text";
import TopBar from "@/components/topbar/top-bar";
import FormRegister from "@/components/auth/form-register";

export const LeftSide = () => {
  return (
    <div className="xl:max-w-96 lg:w-1/2 w-fit bg-white flex flex-col justify-center xl:px-10 lg:px-10 md:px-10 sm:px-10 px-8 xl:rounded xl:rounded-br-none lg:rounded-tr-none lg:rounded-br-none rounded-tr-[2.5rem] rounded-br-[2.5rem] rounded-tl-[2.5rem] rounded-bl-[2.5rem] pb-5">
      <div className="pt-10">
        {/* <TopBar /> */}
      </div>
      <div className="max-w-md text-center">
        {/* <h1 className='shine-text xl:text-5xl lg:text-3xl md:text-3xl sm:text-3xl text-2xl font-bold mb-4'>Torang Bisa!</h1> */}
        <ShinyText
          className="xl:text-5xl lg:text-5xl md:text-4xl sm:text-4xl text-3xl font-bold mb-1 py-2"
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

        <FormRegister />

        <p className="text-center text-[0.65rem] text-gray-500 py-4">
          © 2026 RISK MANAGEMENT BLUD - BPKP Hadir Bermanfaat
        </p>
      </div>
    </div>
  );
};

export default LeftSide;
