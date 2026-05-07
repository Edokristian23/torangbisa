"use client";

import {
  BookOpenCheck,
  ChevronDown,
  ClipboardCheck,
  LayoutDashboard,
  NotebookPen,
  ShieldPlus,
  Trophy,
  User2Icon,
  Zap,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

const baseMenuItems = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
  },
  {
    id: "perencanaan",
    icon: NotebookPen,
    label: "Perencanaan",
    subMenu: [
      {
        id: "sub-perencanaan",
        label: "Kualitas Perencanaan",
      },
    ],
  },
  {
    id: "kapabilitas",
    icon: ShieldPlus,
    label: "Kapabilitas",
    subMenu: [
      { id: "sub-kapabilitas-1", label: "Kepemimpinan" },
      { id: "sub-kapabilitas-2", label: "Kebijakan MR" },
      { id: "sub-kapabilitas-3", label: "Sumber Daya Manusia" },
      { id: "sub-kapabilitas-4", label: "Kemitraan" },
      { id: "sub-kapabilitas-5", label: "Proses MR" },
    ],
  },
  {
    id: "hasil",
    icon: Trophy,
    label: "Hasil",
    subMenu: [
      { id: "sub-hasil-1", label: "Aktivitas Penanganan MR" },
      { id: "sub-hasil-2", label: "Outcomes" },
    ],
  },
  {
    id: "tindak-lanjut",
    icon: ClipboardCheck,
    label: "Tindak Lanjut",
  },
  {
    id: "panduan",
    icon: BookOpenCheck,
    label: "Panduan",
  },
  {
    id: "user",
    icon: User2Icon,
    label: "User",
  },
];

type PropsSidebar = {
  session: any;
  collapsed: boolean;
  onToggle: any;
  currentPage: string;
  onPageChange: any;
};

const Sidebar = ({
  session,
  collapsed,
  onToggle,
  currentPage,
  onPageChange,
}: PropsSidebar) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [lastSubPage, setLastSubPage] = useState<Record<string, string>>({});

  const menuItems = useMemo(
    () =>
      baseMenuItems.filter(
        (item) =>
          item.id !== "user" ||
          session?.user?.role === "ADMIN" ||
          session?.user?.role === "SUPER_ADMIN" ||
          session?.user?.role === "BPKP_ADMIN",
      ),
    [session?.user?.role],
  );

  const isParentActive = (item: any) => {
    if (currentPage === item.id) return true;

    if (item.subMenu) {
      return item.subMenu.some((sub: any) => sub.id === currentPage);
    }

    return false;
  };

  const handleParentClick = (item: any) => {
    if (!item.subMenu) {
      onPageChange(item.id);
      return;
    }

    const isExpanded = expandedItems.has(item.id);

    if (isExpanded) {
      setExpandedItems((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });

      return;
    }

    setExpandedItems((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });

    const last = lastSubPage[item.id];
    onPageChange(last || item.subMenu[0].id);
  };

  useEffect(() => {
    const activeParent = menuItems.find((item) =>
      item.subMenu?.some((sub) => sub.id === currentPage),
    );

    if (!activeParent) return;

    setExpandedItems((prev) => {
      if (prev.has(activeParent.id)) return prev;

      const next = new Set(prev);
      next.add(activeParent.id);
      return next;
    });
  }, [currentPage, menuItems]);

  return (
    <aside
      className={`${
        collapsed ? "w-[72px]" : "w-60"
      } relative z-10 flex min-h-screen flex-col overflow-hidden border-r border-blue-100/70 bg-white/90 shadow-[12px_0_35px_rgba(37,99,235,0.06)] backdrop-blur-xl transition-all duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-black/20`}
    >
      <div className="pointer-events-none absolute -right-16 top-10 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 bottom-24 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />

      <div
        className={`relative border-b border-blue-100/70 dark:border-slate-800 ${
          collapsed ? "px-3 py-4" : "p-4"
        }`}
      >
        <div
          className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-500 text-white shadow-lg shadow-blue-500/25 ring-1 ring-white/40">
            <Zap className="h-5 w-5" />
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <h1 className="truncate text-base font-black tracking-tight text-slate-950 dark:text-white">
                TORANG BISA
              </h1>
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                PW33
              </div>
            </div>
          )}
        </div>
      </div>

      <nav className="[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden relative flex-1 space-y-1.5 overflow-y-auto p-3">
        {menuItems.map((item) => {
          const active = isParentActive(item);
          const expanded = expandedItems.has(item.id);

          return (
            <div key={item.id}>
              <button
                onClick={() => handleParentClick(item)}
                className={`group relative flex min-h-11 items-center justify-between overflow-hidden rounded-2xl px-3 py-2.5 text-sm transition-all duration-300 ease-out ${
                  collapsed ? "w-11 justify-center" : "w-full"
                } ${
                  active
                    ? "bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-600/25 ring-1 ring-blue-400/30"
                    : "text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm dark:text-slate-300 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
                }`}
                title={collapsed ? item.label : undefined}
              >
                {active && (
                  <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-white/80" />
                )}

                <div
                  className={`relative flex items-center ${collapsed ? "justify-center" : "gap-3"}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                      active
                        ? "bg-white/15 text-white"
                        : "bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-700 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-blue-950/60 dark:group-hover:text-blue-300"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                  </span>

                  {!collapsed && (
                    <span className="truncate font-bold">{item.label}</span>
                  )}
                </div>

                {!collapsed && item.subMenu && (
                  <ChevronDown
                    className={`relative h-4 w-4 transition-all duration-300 ${
                      expanded ? "rotate-180" : "rotate-0"
                    } ${active ? "text-white/90" : "text-slate-400"}`}
                  />
                )}
              </button>

              <div
                className={`ml-5 mt-1.5 overflow-hidden border-l border-blue-100 pl-4 transition-all duration-300 dark:border-slate-800
                ${
                  !collapsed && item.subMenu && expanded
                    ? "max-h-96 translate-y-0 opacity-100"
                    : "pointer-events-none max-h-0 -translate-y-2 opacity-0"
                }`}
              >
                <div className="space-y-1 py-1">
                  {item.subMenu?.map((subItem) => {
                    const subActive = currentPage === subItem.id;

                    return (
                      <button
                        key={subItem.id}
                        onClick={() => {
                          setLastSubPage((prev) => ({
                            ...prev,
                            [item.id]: subItem.id,
                          }));

                          onPageChange(subItem.id);
                        }}
                        className={`group/sub flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition-all duration-200 hover:translate-x-1
                        ${
                          subActive
                            ? "bg-blue-100 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900/60"
                            : "text-slate-500 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            subActive
                              ? "bg-blue-600 dark:bg-blue-300"
                              : "bg-slate-300 group-hover/sub:bg-blue-400 dark:bg-slate-600"
                          }`}
                        />
                        <span className="truncate">{subItem.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
