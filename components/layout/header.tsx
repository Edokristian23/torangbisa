"use client";

import {
  Bell,
  ChevronDown,
  Filter,
  Menu,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";

type HeaderProps = {
  session: any;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  title: string;
  subTitle: string;
};

const Header = ({ session, onToggleSidebar, title, subTitle }: HeaderProps) => {
  const [search, setSearch] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

  const userName = session?.user?.name || "User";
  const userRole = session?.user?.role || "User";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    console.log("Searching:", search);
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
    document.documentElement.classList.toggle("dark");
  };

  const handleLogout = async () => {
    await signOut({
      callbackUrl: "/login",
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setShowProfile(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 lg:px-6">
      <div className="flex items-center justify-between gap-4">
        {/* Left */}
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden min-w-0 sm:block">
            <h1 className="truncate text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
              {title || "Dashboard"}
            </h1>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {subTitle || "Welcome back, Edo! Here’s what’s happening today."}
            </p>
          </div>
        </div>

        {/* Search */}
        <form
          onSubmit={handleSearch}
          className="hidden max-w-md flex-1 md:block"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search anything..."
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-20 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-blue-500 dark:focus:bg-slate-950"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-11 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowFilter(!showFilter)}
              className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <Filter className="h-4 w-4" />
            </button>

            {showFilter && (
              <div className="absolute right-0 top-13 z-50 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30">
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Filter
                </p>

                {["Users", "Reports", "Transactions"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Right */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleDarkMode}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {darkMode ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="hidden"
            aria-label="Toggle settings"
          />

          {/* Profile */}
          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold uppercase text-white shadow-sm">
                {userName?.charAt(0) || "U"}
              </div>

              <div className="hidden min-w-0 text-left md:block">
                <p className="max-w-32 truncate text-sm font-semibold uppercase text-slate-900 dark:text-white">
                  {userName}
                </p>
                <p className="truncate text-xs capitalize text-slate-500 dark:text-slate-400">
                  {userRole}
                </p>
              </div>

              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform ${
                  showProfile ? "rotate-180" : ""
                }`}
              />
            </button>

            {showProfile && (
              <div className="absolute right-0 top-14 z-50 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
                  <p className="truncate text-sm font-semibold uppercase text-slate-900 dark:text-white">
                    {userName}
                  </p>
                  <p className="truncate text-xs capitalize text-slate-500 dark:text-slate-400">
                    {userRole}
                  </p>
                </div>

                <div className="p-2">
                  <button
                    type="button"
                    className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    My Profile
                  </button>

                  <button
                    type="button"
                    className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    Account Settings
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 block w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Settings Panel
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Tambahkan konfigurasi aplikasi di sini.
          </p>
        </div>
      )}
    </header>
  );
};

export default Header;
