import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { mapStatusLabel } from "@/lib/assessment";
import type { AssessmentStatus } from "@prisma/client";

type IndicatorDef = {
  aspectNo: number;
  aspectName: "PERENCANAAN" | "KAPABILITAS" | "HASIL";
  aspectWeightLabel: string;
  aspectMaxScore: number;
  indicatorNo: number;
  indicatorName: string;
  indicatorWeightLabel: string;
  parameterNo: number;
  parameterLabel: string;
  ref: number;
  parameterWeightLabel: string;
  maxParameterScore: number;
};

const INDICATORS: IndicatorDef[] = [
  {
    aspectNo: 1,
    aspectName: "PERENCANAAN",
    aspectWeightLabel: "40%",
    aspectMaxScore: 2.0,
    indicatorNo: 1,
    indicatorName: "Kualitas Perencanaan",
    indicatorWeightLabel: "40%",
    parameterNo: 1,
    parameterLabel:
      "Adanya keterkaitan antara Sasaran BLU/BLUD dengan Sasaran Strategis K/L/Pemda",
    ref: 1,
    parameterWeightLabel: "30%",
    maxParameterScore: 0.6,
  },
  {
    aspectNo: 1,
    aspectName: "PERENCANAAN",
    aspectWeightLabel: "40%",
    aspectMaxScore: 2.0,
    indicatorNo: 1,
    indicatorName: "Kualitas Perencanaan",
    indicatorWeightLabel: "40%",
    parameterNo: 2,
    parameterLabel: "Penetapan Sasaran Strategis sudah tepat",
    ref: 2,
    parameterWeightLabel: "30%",
    maxParameterScore: 0.6,
  },
  {
    aspectNo: 1,
    aspectName: "PERENCANAAN",
    aspectWeightLabel: "40%",
    aspectMaxScore: 2.0,
    indicatorNo: 1,
    indicatorName: "Kualitas Perencanaan",
    indicatorWeightLabel: "40%",
    parameterNo: 3,
    parameterLabel: "Penetapan Indikator Kinerja sudah tepat dan baik",
    ref: 3,
    parameterWeightLabel: "20%",
    maxParameterScore: 0.4,
  },
  {
    aspectNo: 1,
    aspectName: "PERENCANAAN",
    aspectWeightLabel: "40%",
    aspectMaxScore: 2.0,
    indicatorNo: 1,
    indicatorName: "Kualitas Perencanaan",
    indicatorWeightLabel: "40%",
    parameterNo: 4,
    parameterLabel: "Penetapan Target Kinerja sudah baik",
    ref: 4,
    parameterWeightLabel: "20%",
    maxParameterScore: 0.4,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 1,
    indicatorName: "Kepemimpinan (Organisasi dan Tata Kelola Risiko; ref SK 8)",
    indicatorWeightLabel: "5%",
    parameterNo: 5,
    parameterLabel: "Efektivitas fungsi pengelola risiko (ref. SK 8)",
    ref: 5,
    parameterWeightLabel: "2.08%",
    maxParameterScore: 0.03125,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 1,
    indicatorName: "Kepemimpinan (Organisasi dan Tata Kelola Risiko; ref SK 8)",
    indicatorWeightLabel: "5%",
    parameterNo: 6,
    parameterLabel:
      "Keterlibatan aktif Dewan Pengawas dalam pengelolaan Risiko (ref SK 8)",
    ref: 6,
    parameterWeightLabel: "2.08%",
    maxParameterScore: 0.03125,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 1,
    indicatorName: "Kepemimpinan (Organisasi dan Tata Kelola Risiko; ref SK 8)",
    indicatorWeightLabel: "5%",
    parameterNo: 7,
    parameterLabel:
      "Eskalasi permasalahan kepada Dewan Pengawas telah dilaksanakan (ref SK 8)",
    ref: 7,
    parameterWeightLabel: "2.08%",
    maxParameterScore: 0.03125,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 1,
    indicatorName: "Kepemimpinan (Organisasi dan Tata Kelola Risiko; ref SK 8)",
    indicatorWeightLabel: "5%",
    parameterNo: 8,
    parameterLabel:
      "Tingkat pemahaman Risiko di jajaran Dewan Pengawas memadai, termasuk adanya komite khusus yang menangani MR BLU/BLUD (ref SK 8)",
    ref: 8,
    parameterWeightLabel: "2.08%",
    maxParameterScore: 0.03125,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 1,
    indicatorName: "Kepemimpinan (Organisasi dan Tata Kelola Risiko; ref SK 8)",
    indicatorWeightLabel: "5%",
    parameterNo: 9,
    parameterLabel:
      "Pimpinan BLU/BLUD mengalokasikan sumber daya untuk penerapan manajemen risiko.",
    ref: 9,
    parameterWeightLabel: "2.08%",
    maxParameterScore: 0.03125,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 1,
    indicatorName: "Kepemimpinan (Organisasi dan Tata Kelola Risiko; ref SK 8)",
    indicatorWeightLabel: "5%",
    parameterNo: 10,
    parameterLabel:
      "Pimpinan BLU/BLUD menggunakan informasi terkait risiko dalam pengambilan keputusan",
    ref: 10,
    parameterWeightLabel: "2.08%",
    maxParameterScore: 0.03125,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 1,
    indicatorName: "Kepemimpinan (Organisasi dan Tata Kelola Risiko; ref SK 8)",
    indicatorWeightLabel: "5%",
    parameterNo: 11,
    parameterLabel:
      "Pimpinan BLU/BLUD mendorong secara aktif (ref. SK 8) penerapan manajemen risiko",
    ref: 11,
    parameterWeightLabel: "2.08%",
    maxParameterScore: 0.03125,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 1,
    indicatorName: "Kepemimpinan (Organisasi dan Tata Kelola Risiko; ref SK 8)",
    indicatorWeightLabel: "5%",
    parameterNo: 12,
    parameterLabel: "Pimpinan BLU/BLUD membangun sistem pengaduan",
    ref: 12,
    parameterWeightLabel: "2.08%",
    maxParameterScore: 0.03125,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 2,
    indicatorName: "Kebijakan Manajemen Risiko",
    indicatorWeightLabel: "5%",
    parameterNo: 13,
    parameterLabel: "BLU/BLUD telah memiliki Kebijakan Manajemen Risiko.",
    ref: 13,
    parameterWeightLabel: "16.67%",
    maxParameterScore: 0.25,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 3,
    indicatorName: "Sumber Daya Manusia",
    indicatorWeightLabel: "5%",
    parameterNo: 14,
    parameterLabel:
      "Pegawai telah mendapatkan fasilitas untuk meningkatkan kompetensi dan keterampilan terkait manajemen risiko",
    ref: 14,
    parameterWeightLabel: "8.33%",
    maxParameterScore: 0.125,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 3,
    indicatorName: "Sumber Daya Manusia",
    indicatorWeightLabel: "5%",
    parameterNo: 15,
    parameterLabel:
      "Pegawai memiliki kesadaran terkait manajemen risiko/terdapat internalisasi budaya risiko (ref SK8)",
    ref: 15,
    parameterWeightLabel: "8.33%",
    maxParameterScore: 0.125,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 4,
    indicatorName: "Kemitraan",
    indicatorWeightLabel: "2.5%",
    parameterNo: 16,
    parameterLabel:
      "Dalam rangka menciptakan hubungan kerja yang baik, BLU/BLUD telah mengidentifikasi, menilai, dan mengelola risiko terkait kemitraan",
    ref: 16,
    parameterWeightLabel: "8.33%",
    maxParameterScore: 0.125,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 5,
    indicatorName: "Proses Manajemen Risiko",
    indicatorWeightLabel: "12.5%",
    parameterNo: 17,
    parameterLabel:
      "Risiko telah teridentifikasi dan dituangkan dalam register risiko",
    ref: 17,
    parameterWeightLabel: "4.17%",
    maxParameterScore: 0.0625,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 5,
    indicatorName: "Proses Manajemen Risiko",
    indicatorWeightLabel: "12.5%",
    parameterNo: 18,
    parameterLabel:
      "Proses manajemen risiko telah melekat pada proses bisnis BLU/BLUD",
    ref: 18,
    parameterWeightLabel: "4.17%",
    maxParameterScore: 0.0625,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 5,
    indicatorName: "Proses Manajemen Risiko",
    indicatorWeightLabel: "12.5%",
    parameterNo: 19,
    parameterLabel:
      "Seluruh risiko telah dianalisis dampak dan tingkat keterjadiannya",
    ref: 19,
    parameterWeightLabel: "4.17%",
    maxParameterScore: 0.0625,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 5,
    indicatorName: "Proses Manajemen Risiko",
    indicatorWeightLabel: "12.5%",
    parameterNo: 20,
    parameterLabel: "BLU/BLUD telah menentukan prioritas risiko",
    ref: 20,
    parameterWeightLabel: "4.17%",
    maxParameterScore: 0.0625,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 5,
    indicatorName: "Proses Manajemen Risiko",
    indicatorWeightLabel: "12.5%",
    parameterNo: 21,
    parameterLabel: "BLU/BLUD telah menentukan rencana tindak pengendalian",
    ref: 21,
    parameterWeightLabel: "4.17%",
    maxParameterScore: 0.0625,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 5,
    indicatorName: "Proses Manajemen Risiko",
    indicatorWeightLabel: "12.5%",
    parameterNo: 22,
    parameterLabel:
      "Strategi dan kebijakan manajemen risiko telah dikomunikasikan.",
    ref: 22,
    parameterWeightLabel: "4.17%",
    maxParameterScore: 0.0625,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 5,
    indicatorName: "Proses Manajemen Risiko",
    indicatorWeightLabel: "12.5%",
    parameterNo: 23,
    parameterLabel:
      "Register risiko dan rencana tindak pengendalian telah dikomunikasikan ke pihak terkait",
    ref: 23,
    parameterWeightLabel: "4.17%",
    maxParameterScore: 0.0625,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 5,
    indicatorName: "Proses Manajemen Risiko",
    indicatorWeightLabel: "12.5%",
    parameterNo: 24,
    parameterLabel: "Proses manajemen risiko telah direviu secara internal",
    ref: 24,
    parameterWeightLabel: "4.17%",
    maxParameterScore: 0.0625,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 5,
    indicatorName: "Proses Manajemen Risiko",
    indicatorWeightLabel: "12.5%",
    parameterNo: 25,
    parameterLabel: "Pemantauan/monitoring terhadap risiko telah dilakukan",
    ref: 25,
    parameterWeightLabel: "4.17%",
    maxParameterScore: 0.0625,
  },
  {
    aspectNo: 2,
    aspectName: "KAPABILITAS",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 5,
    indicatorName: "Proses Manajemen Risiko",
    indicatorWeightLabel: "12.5%",
    parameterNo: 26,
    parameterLabel:
      "Terdapat reviu independen terhadap proses manajemen risiko",
    ref: 26,
    parameterWeightLabel: "4.17%",
    maxParameterScore: 0.0625,
  },
  {
    aspectNo: 3,
    aspectName: "HASIL",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 1,
    indicatorName: "Aktivitas Penanganan Risiko",
    indicatorWeightLabel: "25%",
    parameterNo: 27,
    parameterLabel: "Adanya Implementasi Tindak Pengendalian",
    ref: 27,
    parameterWeightLabel: "83%",
    maxParameterScore: 1.25,
  },
  {
    aspectNo: 3,
    aspectName: "HASIL",
    aspectWeightLabel: "30%",
    aspectMaxScore: 1.5,
    indicatorNo: 2,
    indicatorName: "Outcomes",
    indicatorWeightLabel: "5%",
    parameterNo: 28,
    parameterLabel: "Adanya Efektifitas penurunan risiko",
    ref: 28,
    parameterWeightLabel: "17%",
    maxParameterScore: 0.25,
  },
];

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

function maturityLevel(totalScore: number) {
  if (totalScore >= 4.2) return "Optimum";
  if (totalScore >= 3.4) return "Terintegrasi";
  if (totalScore >= 2.6) return "Terdefinisi";
  if (totalScore >= 1.8) return "Berkembang";
  return "Fase Awal";
}

function statusRank(status: string) {
  const rank: Record<string, number> = {
    DRAFT: 1,
    SUBMITTED: 2,
    IN_REVIEW: 3,
    APPROVED: 4,
    REVISION_REQUESTED: 5,
    REJECTED: 6,
  };
  return rank[String(status || "").toUpperCase()] || 0;
}

function getGlobalStatus(
  periods: Array<{ status: AssessmentStatus }>,
): AssessmentStatus {
  if (periods.length === 0) return "DRAFT";

  return periods.reduce((selected, current) =>
    statusRank(current.status) > statusRank(selected.status)
      ? current
      : selected,
  ).status as AssessmentStatus;
}

function getIndicatorKey(item: IndicatorDef) {
  return `${item.aspectNo}-${item.indicatorNo}-${item.indicatorName}`;
}

function getGroupCounts(items: IndicatorDef[]) {
  const aspect = new Map<string, number>();
  const indicator = new Map<string, number>();

  for (const item of items) {
    aspect.set(item.aspectName, (aspect.get(item.aspectName) || 0) + 1);
    const indicatorKey = getIndicatorKey(item);
    indicator.set(indicatorKey, (indicator.get(indicatorKey) || 0) + 1);
  }

  return { aspect, indicator };
}

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year"));

    // Support parameter dari dashboard terbaru:
    // /api/reports/assessment?year=2026&bludIds=<bludId>
    // Tetap backward compatible dengan parameter lama:
    // /api/reports/assessment?year=2026&bludCode=<kodeBlud>
    const selectedBludIds = (searchParams.get("bludIds") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const selectedBludId = selectedBludIds[0] || "";
    const bludCode = String(searchParams.get("bludCode") || "").toUpperCase();
    const requestedAssessmentSource = String(
      searchParams.get("assessmentSource") || "",
    ).toUpperCase();

    if (!year) {
      return NextResponse.json(
        { message: "Tahun wajib diisi." },
        { status: 400 },
      );
    }

    const role = String(session.user.role || "").toUpperCase();
    const canSelectBlud = [
      "SUPER_ADMIN",
      "BPKP_ADMIN",
      "BPKP_REVIEWER",
      "REVIEWER",
      "AUDITOR",
    ].includes(role);

    const useBpkpSelfAssessmentRows =
      requestedAssessmentSource === "BPKP_SELF_ASSESSMENT" ||
      (!requestedAssessmentSource &&
        ["BPKP", "BPKP_ADMIN", "BPKP_REVIEWER"].includes(role));

    const responseSourceWhere = useBpkpSelfAssessmentRows
      ? {
          createdByRole: {
            in: ["BPKP", "BPKP_ADMIN", "BPKP_REVIEWER"],
          },
        }
      : {
          createdByRole: "BLUD_OPERATOR",
        };

    const assessmentFilledByLabel = useBpkpSelfAssessmentRows
      ? "Admin BPKP"
      : "Operator BLUD";
    const assessmentReportSourceLabel = useBpkpSelfAssessmentRows
      ? "Self Assessment Admin BPKP"
      : "Self Assessment Operator BLUD";

    let bludId = session.user.bludId;

    if (canSelectBlud && selectedBludId) {
      const selectedBlud = await prisma.blud.findUnique({
        where: { id: selectedBludId },
        select: { id: true },
      });

      bludId = selectedBlud?.id ?? null;
    } else if (canSelectBlud && bludCode) {
      const selectedBlud = await prisma.blud.findUnique({
        where: { code: bludCode },
        select: { id: true },
      });

      bludId = selectedBlud?.id ?? null;
    }

    if (!bludId) {
      return NextResponse.json(
        { message: "BLUD tidak ditemukan." },
        { status: 404 },
      );
    }

    const blud = await prisma.blud.findUnique({
      where: { id: bludId },
    });

    if (!blud) {
      return NextResponse.json(
        { message: "BLUD tidak ditemukan." },
        { status: 404 },
      );
    }

    const periods = await prisma.assessmentPeriod.findMany({
      where: { bludId, year },
      include: {
        responses: {
          where: responseSourceWhere,
          orderBy: [{ parameterId: "asc" }],
        },
      },
      orderBy: { moduleKey: "asc" },
    });

    const responseByParameterId = new Map<number, any>();

    for (const period of periods) {
      for (const response of period.responses) {
        responseByParameterId.set(Number(response.parameterId), response);
      }
    }

    const { jsPDF } = await import("jspdf");

    /**
     * Production layout note:
     * - A3 landscape is used intentionally because this matrix has many columns.
     * - The table is continuous: no forced page break per aspect.
     * - Header is repeated on every page.
     * - Group labels are rendered per page segment, so no merged cell is split awkwardly.
     */
    const doc = new jsPDF({
      unit: "pt",
      format: "a3",
      orientation: "landscape",
      compress: true,
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const marginX = 10;
    const marginTop = 16;
    const marginBottom = 22;
    const contentBottom = pageHeight - marginBottom;

    const gray: [number, number, number] = [191, 191, 191];
    const blue: [number, number, number] = [191, 207, 231];
    const darkGray: [number, number, number] = [128, 128, 128];
    const white: [number, number, number] = [255, 255, 255];
    const lightBlue: [number, number, number] = [222, 235, 247];

    /**
     * Width total must be smaller than A3 landscape page width.
     * A3 landscape width is about 1190 pt, so this table is kept at 1148 pt.
     * This prevents the right-most CAPAIAN column from being clipped.
     */
    const columns = [
      { key: "indicatorNo", w: 22 },
      { key: "indicatorName", w: 108 },
      { key: "indicatorWeight", w: 50 },
      { key: "parameterNo", w: 24 },
      { key: "parameter", w: 188 },
      { key: "ref", w: 30 },
      { key: "gradeOptions", w: 58 },
      { key: "parameterWeight", w: 58 },
      { key: "aspectMax", w: 66 },
      { key: "parameterMax", w: 86 },
      { key: "gradeValue", w: 82 },
      { key: "parameterScore", w: 90 },
      { key: "indicatorScore", w: 90 },
      { key: "aspectScore", w: 88 },
      { key: "achievement", w: 68 },
    ];

    const tableWidth = columns.reduce((sum, col) => sum + col.w, 0);
    const tableX = Math.max(6, (pageWidth - tableWidth) / 2);

    const xAt = (index: number) =>
      tableX + columns.slice(0, index).reduce((sum, col) => sum + col.w, 0);

    let y = marginTop;
    let currentPage = 1;

    const setFont = (bold = false, size = 7) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(0, 0, 0);
    };

    const fill = (color: [number, number, number]) => {
      doc.setFillColor(color[0], color[1], color[2]);
    };

    const cell = (
      x: number,
      cy: number,
      w: number,
      h: number,
      text = "",
      opts: {
        fill?: [number, number, number];
        bold?: boolean;
        size?: number;
        align?: "left" | "center" | "right";
        valign?: "top" | "middle";
        border?: boolean;
      } = {},
    ) => {
      fill(opts.fill || white);
      doc.rect(x, cy, w, h, "F");

      if (opts.border !== false) {
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.35);
        doc.rect(x, cy, w, h);
      }

      if (!text) return;

      setFont(Boolean(opts.bold), opts.size ?? 7);
      const lines = doc.splitTextToSize(String(text), Math.max(4, w - 6));
      const lineHeight = (opts.size ?? 7) + 1.35;
      const textHeight = lines.length * lineHeight;

      const tx =
        opts.align === "center"
          ? x + w / 2
          : opts.align === "right"
            ? x + w - 3
            : x + 3;

      const ty =
        opts.valign === "middle"
          ? cy + Math.max(lineHeight, (h - textHeight) / 2 + lineHeight - 0.8)
          : cy + lineHeight + 1.8;

      doc.text(lines, tx, ty, {
        align: opts.align || "left",
        maxWidth: w - 6,
      });
    };

    const drawTitle = () => {
      setFont(true, 9);
      doc.text("LAPORAN SELF ASSESSMENT MANAJEMEN RISIKO BLUD", tableX, y + 7);
      setFont(false, 6.8);
      doc.text(
        `BLUD: ${blud.code || "-"} - ${blud.name || "-"} | Tahun: ${year} | Status: ${mapStatusLabel(getGlobalStatus(periods))} | Diisi oleh: ${assessmentFilledByLabel}`,
        tableX,
        y + 18,
      );
      doc.text(
        `Sumber Report: ${assessmentReportSourceLabel}`,
        tableX,
        y + 28,
      );
      y += 34;
    };

    const drawTableHeader = () => {
      const groupH = 24;
      const headerH = 42;
      const numberH = 18;

      cell(
        xAt(0),
        y,
        columns[0].w + columns[1].w + columns[2].w,
        groupH,
        "ASPEK / INDIKATOR",
        {
          fill: gray,
          bold: true,
          align: "center",
          valign: "middle",
          size: 8,
        },
      );

      cell(xAt(3), y, columns[3].w, groupH + headerH, "NO", {
        fill: gray,
        bold: true,
        align: "center",
        valign: "middle",
        size: 7.2,
      });

      cell(
        xAt(4),
        y,
        columns[4].w +
          columns[5].w +
          columns[6].w +
          columns[7].w +
          columns[8].w +
          columns[9].w,
        groupH,
        "PARAMETER",
        {
          fill: gray,
          bold: true,
          align: "center",
          valign: "middle",
          size: 8,
        },
      );

      cell(xAt(10), y, columns[10].w, groupH + headerH, "GRADE\nPARAMETER", {
        fill: gray,
        bold: true,
        align: "center",
        valign: "middle",
        size: 7,
      });
      cell(xAt(11), y, columns[11].w, groupH + headerH, "NILAI\nPARAMETER", {
        fill: gray,
        bold: true,
        align: "center",
        valign: "middle",
        size: 7,
      });
      cell(xAt(12), y, columns[12].w, groupH + headerH, "NILAI\nINDIKATOR", {
        fill: gray,
        bold: true,
        align: "center",
        valign: "middle",
        size: 7,
      });
      cell(xAt(13), y, columns[13].w, groupH + headerH, "NILAI ASPEK", {
        fill: gray,
        bold: true,
        align: "center",
        valign: "middle",
        size: 7,
      });
      cell(xAt(14), y, columns[14].w, groupH + headerH, "CAPAIAN", {
        fill: gray,
        bold: true,
        align: "center",
        valign: "middle",
        size: 7,
      });

      y += groupH;

      cell(xAt(0), y, columns[0].w + columns[1].w, headerH, "URAIAN", {
        fill: gray,
        bold: true,
        align: "center",
        valign: "middle",
        size: 7.2,
      });
      cell(xAt(2), y, columns[2].w, headerH, "BOBOT", {
        fill: gray,
        bold: true,
        align: "center",
        valign: "middle",
        size: 7.2,
      });
      cell(xAt(4), y, columns[4].w, headerH, "PARAMETER", {
        fill: gray,
        bold: true,
        align: "center",
        valign: "middle",
        size: 7.2,
      });
      cell(xAt(5), y, columns[5].w, headerH, "Ref", {
        fill: gray,
        bold: true,
        align: "center",
        valign: "middle",
        size: 7,
      });
      cell(xAt(6), y, columns[6].w, headerH, "Grade", {
        fill: gray,
        bold: true,
        align: "center",
        valign: "middle",
        size: 7,
      });
      cell(xAt(7), y, columns[7].w, headerH, "BOBOT\nTHD\nASPEK", {
        fill: gray,
        bold: true,
        align: "center",
        valign: "middle",
        size: 6.5,
      });
      cell(xAt(8), y, columns[8].w, headerH, "SKOR\nMAKSIMAL\nASPEK", {
        fill: gray,
        bold: true,
        align: "center",
        valign: "middle",
        size: 6.5,
      });
      cell(xAt(9), y, columns[9].w, headerH, "SKOR\nMAKSIMAL\nPARAMETER", {
        fill: gray,
        bold: true,
        align: "center",
        valign: "middle",
        size: 6.5,
      });

      y += headerH;

      const numbers = [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "9",
        "10",
        "11=9X10",
        "13",
        "14=13/5*12",
        "15=total 14",
        "16=total 15",
        "17=16/10",
      ];

      for (let i = 0; i < columns.length; i += 1) {
        cell(xAt(i), y, columns[i].w, numberH, numbers[i], {
          fill: blue,
          bold: true,
          align: "center",
          valign: "middle",
          size: 6.4,
        });
      }

      y += numberH;
    };

    const drawFooter = () => {
      setFont(false, 6.6);
      doc.setTextColor(80, 80, 80);
      doc.text(
        `Dicetak dari sistem Self Assessment BLUD`,
        tableX,
        pageHeight - 10,
      );
      doc.setTextColor(0, 0, 0);
    };

    const newPage = () => {
      drawFooter();
      doc.addPage();
      currentPage += 1;
      y = marginTop;
      drawTitle();
      drawTableHeader();
    };

    const ensureSpace = (height: number) => {
      if (y + height > contentBottom) {
        newPage();
        return true;
      }

      return false;
    };

    drawTitle();
    drawTableHeader();

    const { aspect, indicator } = getGroupCounts(INDICATORS);

    const indicatorTotals = new Map<string, number>();
    const aspectTotals = new Map<string, number>();

    for (const item of INDICATORS) {
      const response = responseByParameterId.get(item.parameterNo);
      const grade = response ? Number(response.criteriaScore || 0) : 0;
      const value = (grade / 5) * item.maxParameterScore;
      const indicatorKey = getIndicatorKey(item);

      indicatorTotals.set(
        indicatorKey,
        (indicatorTotals.get(indicatorKey) || 0) + value,
      );
      aspectTotals.set(
        item.aspectName,
        (aspectTotals.get(item.aspectName) || 0) + value,
      );
    }

    const getRowHeight = (item: IndicatorDef) => {
      const parameterTextLines = doc.splitTextToSize(
        item.parameterLabel,
        columns[4].w - 6,
      );
      const parameterTextHeight = parameterTextLines.length * 7.2 + 8;

      return Math.max(30, Math.min(60, parameterTextHeight));
    };

    const rowHeights = INDICATORS.map(getRowHeight);

    const getIndicatorSpanHeight = (startIndex: number, startY: number) => {
      const key = getIndicatorKey(INDICATORS[startIndex]);
      let height = 0;

      for (let i = startIndex; i < INDICATORS.length; i += 1) {
        if (getIndicatorKey(INDICATORS[i]) !== key) break;
        if (startY + height + rowHeights[i] > contentBottom) break;
        height += rowHeights[i];
      }

      return Math.max(rowHeights[startIndex], height);
    };

    const getAspectSpanHeight = (startIndex: number, startY: number) => {
      const aspectName = INDICATORS[startIndex].aspectName;
      let height = 0;

      for (let i = startIndex; i < INDICATORS.length; i += 1) {
        if (INDICATORS[i].aspectName !== aspectName) break;
        if (startY + height + rowHeights[i] > contentBottom) break;
        height += rowHeights[i];
      }

      return Math.max(rowHeights[startIndex], height);
    };

    let lastAspect = "";
    let lastIndicatorKey = "";

    for (let index = 0; index < INDICATORS.length; index += 1) {
      const item = INDICATORS[index];
      const response = responseByParameterId.get(item.parameterNo);
      const gradeValue = response ? Number(response.criteriaScore || 0) : 0;
      const nilaiParameter = (gradeValue / 5) * item.maxParameterScore;
      const indicatorKey = getIndicatorKey(item);
      const isNewAspect = lastAspect !== item.aspectName;
      const rowHeight = rowHeights[index];

      const aspectTotal = aspectTotals.get(item.aspectName) || 0;
      const indicatorTotal = indicatorTotals.get(indicatorKey) || 0;
      const capaian =
        item.aspectMaxScore > 0 ? (aspectTotal / item.aspectMaxScore) * 100 : 0;

      const aspectTitleHeight = isNewAspect ? 22 : 0;
      const pageBroke = ensureSpace(aspectTitleHeight + rowHeight);

      const isFirstIndicatorSegment =
        pageBroke ||
        index === 0 ||
        getIndicatorKey(INDICATORS[index - 1]) !== indicatorKey;

      const isFirstAspectOverall =
        index === 0 || INDICATORS[index - 1].aspectName !== item.aspectName;

      const isFirstAspectSegment = pageBroke || isFirstAspectOverall;

      if (isNewAspect || (pageBroke && lastAspect === item.aspectName)) {
        cell(xAt(0), y, columns[0].w, 22, String(item.aspectNo), {
          fill: blue,
          bold: true,
          align: "center",
          valign: "middle",
          size: 7.4,
        });
        cell(xAt(1), y, columns[1].w, 22, item.aspectName, {
          fill: blue,
          bold: true,
          align: "left",
          valign: "middle",
          size: 7.8,
        });
        cell(xAt(2), y, columns[2].w, 22, item.aspectWeightLabel, {
          fill: blue,
          bold: true,
          align: "center",
          valign: "middle",
          size: 7.4,
        });
        for (let i = 3; i < columns.length; i += 1) {
          cell(xAt(i), y, columns[i].w, 22, "", { fill: blue });
        }
        y += 22;
      }

      const indicatorSpanHeight = isFirstIndicatorSegment
        ? getIndicatorSpanHeight(index, y)
        : rowHeight;

      const aspectSpanHeight = isFirstAspectSegment
        ? getAspectSpanHeight(index, y)
        : rowHeight;

      // MERGED: indikator no, uraian, bobot, dan nilai indikator.
      if (isFirstIndicatorSegment) {
        cell(
          xAt(0),
          y,
          columns[0].w,
          indicatorSpanHeight,
          String(item.indicatorNo),
          {
            fill: white,
            align: "center",
            valign: "middle",
            size: 6.5,
          },
        );
        cell(
          xAt(1),
          y,
          columns[1].w,
          indicatorSpanHeight,
          item.indicatorName,
          {
            fill: white,
            align: "center",
            valign: "middle",
            size: 5.2,
          },
        );
        cell(
          xAt(2),
          y,
          columns[2].w,
          indicatorSpanHeight,
          item.indicatorWeightLabel,
          {
            fill: white,
            align: "center",
            valign: "middle",
            size: 6.5,
          },
        );
        cell(
          xAt(12),
          y,
          columns[12].w,
          indicatorSpanHeight,
          formatNumber(indicatorTotal, 2),
          {
            fill: white,
            align: "center",
            valign: "middle",
            size: 6.8,
          },
        );
      }

      // MERGED: skor maksimal aspek, nilai aspek, dan capaian.
      // Nilai aspek/capaian hanya ditulis sekali pada awal aspek.
      // Jika aspek berlanjut ke halaman berikutnya, cell tetap dibuat kosong
      // agar garis tabel rapi tetapi nilai tidak terulang.
      if (isFirstAspectSegment) {
        cell(
          xAt(8),
          y,
          columns[8].w,
          aspectSpanHeight,
          isFirstAspectOverall ? formatNumber(item.aspectMaxScore, 2) : "",
          {
            fill: darkGray,
            align: "center",
            valign: "middle",
            size: 6.6,
          },
        );
        cell(
          xAt(13),
          y,
          columns[13].w,
          aspectSpanHeight,
          isFirstAspectOverall ? formatNumber(aspectTotal, 2) : "",
          {
            fill: white,
            align: "center",
            valign: "middle",
            size: 6.8,
          },
        );
        cell(
          xAt(14),
          y,
          columns[14].w,
          aspectSpanHeight,
          isFirstAspectOverall ? `${formatNumber(capaian, 2)}%` : "",
          {
            fill: white,
            align: "center",
            valign: "middle",
            size: 6.8,
          },
        );
      }

      // Non-merged row cells.
      cell(xAt(3), y, columns[3].w, rowHeight, String(item.parameterNo), {
        fill: white,
        align: "center",
        valign: "middle",
        size: 6.8,
      });
      cell(xAt(4), y, columns[4].w, rowHeight, item.parameterLabel, {
        fill: white,
        align: "left",
        valign: "middle",
        size: 5.4,
      });
      cell(xAt(5), y, columns[5].w, rowHeight, String(item.ref), {
        fill: white,
        align: "center",
        valign: "middle",
        size: 6.8,
      });

      cell(xAt(6), y, columns[6].w, rowHeight, "", { fill: darkGray });
      for (let grade = 1; grade <= 5; grade += 1) {
        const gradeY = y + ((grade - 1) * rowHeight) / 5;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.25);
        doc.rect(xAt(6), gradeY, columns[6].w, rowHeight / 5);
        setFont(false, 5.8);
        doc.text(
          String(grade),
          xAt(6) + columns[6].w / 2,
          gradeY + rowHeight / 10 + 2,
          {
            align: "center",
          },
        );
      }

      cell(xAt(7), y, columns[7].w, rowHeight, item.parameterWeightLabel, {
        fill: darkGray,
        align: "center",
        valign: "middle",
        size: 6.4,
      });

      cell(
        xAt(9),
        y,
        columns[9].w,
        rowHeight,
        formatNumber(item.maxParameterScore, 2),
        {
          fill: darkGray,
          align: "center",
          valign: "middle",
          size: 6.6,
        },
      );

      cell(
        xAt(10),
        y,
        columns[10].w,
        rowHeight,
        gradeValue ? formatNumber(gradeValue, 2) : "-",
        {
          fill: white,
          align: "center",
          valign: "middle",
          size: 6.8,
        },
      );

      cell(
        xAt(11),
        y,
        columns[11].w,
        rowHeight,
        response ? formatNumber(nilaiParameter, 2) : "-",
        {
          fill: white,
          align: "center",
          valign: "middle",
          size: 6.8,
        },
      );

      y += rowHeight;
      lastAspect = item.aspectName;
      lastIndicatorKey = indicatorKey;
    }

    const totalScore = Array.from(aspectTotals.values()).reduce(
      (sum, value) => sum + value,
      0,
    );

    ensureSpace(62);
    y += 8;

    cell(
      tableX,
      y,
      tableWidth - 220,
      42,
      "LEVEL MATURITAS PENERAPAN MR BLU/BLUD",
      {
        fill: white,
        bold: true,
        align: "right",
        valign: "middle",
        size: 8,
      },
    );
    cell(tableX + tableWidth - 220, y, 120, 42, maturityLevel(totalScore), {
      fill: white,
      bold: true,
      align: "center",
      valign: "middle",
      size: 8,
    });
    cell(tableX + tableWidth - 100, y, 100, 42, formatNumber(totalScore, 2), {
      fill: lightBlue,
      bold: true,
      align: "center",
      valign: "middle",
      size: 8,
    });

    drawFooter();

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      setFont(false, 6.6);
      doc.text(
        `Halaman ${page} dari ${pageCount}`,
        pageWidth - 92,
        pageHeight - 10,
      );
    }

    const buffer = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="laporan-assessment-${blud.code || "blud"}-${year}.pdf"`,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/assessment error:", error);

    return NextResponse.json(
      { message: "Gagal membuat PDF laporan." },
      { status: 500 },
    );
  }
}
