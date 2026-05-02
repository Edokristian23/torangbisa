"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const lang = [
  {
    id: 1,
    country: "USA",
    code: "EN",
  },
  {
    id: 2,
    country: "French",
    code: "FR",
  },
  {
    id: 3,
    country: "China",
    code: "CN",
  },
  {
    id: 4,
    country: "Mexico",
    code: "MX",
  },
];

const TopBar = () => {
  const [active, setActive] = useState(false);
  return (
    <header className="flex justify-between items-center ">
      <h1 className="text-xl font-bold text-black"> PW33.</h1>
      <div className="flex items-center space-x-2">
        <div className="relative flex flex-col">
          <button
            // onClick={() => setActive(!active)}
            type="button"
            className="px-2 py-1 ps-1 pe-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-full border border-slate-300 bg-transparent text-gray-800 hover:bg-gray-50 focus:outline-none disabled:opacity-50 disabled:pointer-events-none"
          >
            <Image
              src="https://flagsapi.com/ID/shiny/64.png"
              width={200}
              height={200}
              alt="flag image"
              className="w-6 h-auto mr-2 rounded-full"
            />
            <span className="text-gray-600 font-medium truncate max-w-30">
              ID
            </span>
            <svg
              className="hs-dropdown-open:rotate-180 size-4"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          <div className={`${active ? "block" : "hidden"} absolute top-5 right-1 transition-[opacity,margin] duration px-0.5 w-fit bg-white shadow-md rounded-lg mt-2`}>
            <div className="space-x-0.5">
              {lang.map((item) => (
                <Link href="#" key={item.id} className="flex items-center py-1 px-3 gap-x-3.5 rounded-lg text-sm text-gray-800 hover:bg-gray-100 focus:outline-none focus:bg-gray-100">
                  {item.country}
                </Link>
              ))

              }
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
