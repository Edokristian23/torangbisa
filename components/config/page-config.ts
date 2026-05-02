import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  Crown,
  Handshake,
  LayoutDashboard,
  ShieldCheck,
  UserCog,
  Users,
  Workflow,
} from "lucide-react";

type PageConfigItem = {
  title: string;
  subTitle: string;
  icon: LucideIcon;
};

export const PAGE_CONFIG: Record<string, PageConfigItem> = {
  dashboard: {
    title: "Dashboard",
    subTitle: "Overview",
    icon: LayoutDashboard,
  },

  "sub-perencanaan": {
    title: "Perencanaan",
    subTitle: "Kualitas Perencanaan",
    icon: ClipboardList,
  },

  "sub-kapabilitas-1": {
    title: "Kapabilitas",
    subTitle: "Kepemimpinan (Organisasi dan Tata Kelola)",
    icon: Crown,
  },

  "sub-kapabilitas-2": {
    title: "Kapabilitas",
    subTitle: "Kebijakan Manajemen Risiko",
    icon: ShieldCheck,
  },

  "sub-kapabilitas-3": {
    title: "Kapabilitas",
    subTitle: "Sumber Daya Manusia",
    icon: Users,
  },

  "sub-kapabilitas-4": {
    title: "Kapabilitas",
    subTitle: "Kemitraan",
    icon: Handshake,
  },

  "sub-kapabilitas-5": {
    title: "Kapabilitas",
    subTitle: "Proses Manajemen Risiko",
    icon: Workflow,
  },

  "sub-hasil-1": {
    title: "Hasil",
    subTitle: "Aktivitas Penanganan Risiko",
    icon: Activity,
  },

  "sub-hasil-2": {
    title: "Hasil",
    subTitle: "Outcomes",
    icon: BarChart3,
  },

  "sub-hasil-3": {
    title: "Hasil",
    subTitle: "Tindak Lanjut AOI",
    icon: ClipboardCheck,
  },

  user: {
    title: "User Management",
    subTitle: "Pengelolaan Pengguna",
    icon: UserCog,
  },
};
