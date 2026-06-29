import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  FileText,
  NotebookPen,
  ListCheck,
  LogOut,
  BookOpen,
  ListChecks,
} from "lucide-react";

type HomePageProps = {
  session: any;
};

export default function HomePage({ session }: HomePageProps) {
  const userName = session?.user?.name || "User";
  const role = session?.user?.role;

const menus = [
  {
    title: "Self Assessment",
    description: "Penilaian mandiri BLU/D dan BUMD",
    icon: NotebookPen,
    href:
      role === "BLUD_ADMIN" || role === "BLUD_OPERATOR"
        ? "/self-assessment-blu-blud"
        : "/self-assessment-admin",
  },
  {
    title: "Risk Register",
    description: "Pemetaan risiko yang dimiliki BLU/D dan BUMD",
    icon: ListChecks,
    href:
      role === "BLUD_ADMIN" || role === "BLUD_OPERATOR"
        ? "/risk-register"
        : "/risk-register-admin",
  },
];

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Top Wave */}
      <div className="relative h-24 overflow-hidden bg-gradient-to-r from-blue-700 to-sky-500">
        <div className="absolute bottom-0 left-0 h-10 w-full rounded-t-[100%] bg-slate-50"></div>
      </div>

      <div className="container mx-auto px-6 pt-2 pb-6">
        {/* Welcome Section */}
        <div className="mb-4 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-4xl font-bold text-slate-800">
              Selamat Datang <span className="text-blue-600">{userName} 👋</span>
            </h2>

            <p className="mt-2 text-lg text-slate-600">
              Silahkan memilih aplikasi yang ingin Anda akses.
            </p>
          </div>

          <div className="flex gap-3">
            <button className="rounded-lg bg-cyan-500 px-6 py-3 text-white shadow hover:bg-cyan-600">
              <BookOpen className="mr-2 inline h-4 w-4" />
              User Manual & FAQ
            </button>

            <button className="rounded-lg bg-blue-600 px-6 py-3 text-white shadow hover:bg-blue-700">
              <LogOut className="mr-2 inline h-4 w-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Menu Cards */}
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {menus.map((menu, index) => {
            const Icon = menu.icon;

            return (
              <div
                key={index}
                className="group rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
              >
                <div className="mb-8 flex justify-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-blue-100">
                    <Icon className="h-12 w-12 text-blue-600" />
                  </div>
                </div>

                <h3 className="mb-4 text-center text-3xl font-bold text-slate-800">
                  {menu.title}
                </h3>

                <p className="mb-8 text-center text-slate-600">
                  {menu.description}
                </p>

                <Link href={menu.href} className="w-full rounded-xl border border-slate-200 px-3 py-3 font-medium transition-all hover:bg-blue-600 hover:text-white">
                  Masuk ke Aplikasi →
                </Link>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-16 border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
          © 2026 Torang Bisa. All Rights Reserved.
        </div>
      </div>
    </main>
  );
}
