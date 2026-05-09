import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { mapStatusLabel } from "@/lib/assessment";
import { isAdminRole } from "@/lib/authz";
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

type ReportResponse = {
  id: string;
  parameterId: number;
  parameterLabel: string;
  criteriaCode: string;
  criteriaLabel: string;
  criteriaScore: unknown;
  aoi: string | null;
  createdByRole: string | null;
};

type FollowUpRow = {
  id: string;
  assessmentResponseId: string;
  description: string;
  followUpStatus?: string | null;
  pendingReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ReportRow = {
  indicator: IndicatorDef;
  response?: ReportResponse;
};

type PdfColor = [number, number, number];

type ColumnKey =
  | "no"
  | "aspect"
  | "indicator"
  | "parameter"
  | "criteria"
  | "aoi"
  | "status"
  | "followUp";

type ColumnDef = {
  key: ColumnKey;
  title: string;
  w: number;
};

type PrintableRow = {
  source: ReportRow;
  index: number;
  values: Record<ColumnKey, string>;
  status: "SUDAH" | "BELUM";
  rowHeight: number;
  aspectKey: string;
  indicatorKey: string;
};

const BPKP_ROLES = ["BPKP", "BPKP_ADMIN", "BPKP_REVIEWER"];

function normalizeRole(role?: string | null) {
  return String(role || "").toUpperCase();
}

function isBpkpRole(role?: string | null) {
  return BPKP_ROLES.includes(normalizeRole(role));
}

function canSelectBlud(role?: string | null) {
  return isBpkpRole(role) || isAdminRole(role as any);
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

  return rank[normalizeRole(status)] || 0;
}

function getGlobalStatus(periods: Array<{ status: AssessmentStatus }>): AssessmentStatus {
  if (periods.length === 0) return "DRAFT";

  return periods.reduce((selected, current) =>
    statusRank(current.status) > statusRank(selected.status) ? current : selected,
  ).status as AssessmentStatus;
}

function formatDateTime(value?: Date | string | null) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function repairSpacedCharacters(value: string) {
  /**
   * Some criteria labels can arrive from rich-text/PDF extraction with characters
   * separated by spaces, for example:
   *   "L e v e l  1  -  S e b e s a r  ≤  6 0 %"
   * jsPDF will render that literally, so we normalize it before printing.
   */
  let text = value;

  for (let index = 0; index < 4; index += 1) {
    text = text.replace(/(?:\b[A-Za-z0-9]\s+){2,}[A-Za-z0-9]\b/g, (match) =>
      match.replace(/\s+/g, ""),
    );
  }

  return text
    .replace(/\b(Level)(\d+)\b/gi, "$1 $2")
    .replace(/\b(L)(\d+)\b/g, "$1 $2")
    .replace(/(\d+)\s*%/g, "$1%")
    .replace(/\s+([,.;:!?%])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\s+([)\]}])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanText(value?: string | null) {
  return repairSpacedCharacters(
    String(value || "")
      .normalize("NFKC")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00A0/g, " ")
      .replace(/[≤≦]/g, "<=")
      .replace(/[≥≧]/g, ">=")
      .replace(/[–—]/g, "-")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function normalizeAssessmentSource(value?: string | null, role?: string | null) {
  const source = normalizeRole(value);

  if (source === "BPKP_SELF_ASSESSMENT") return "BPKP_SELF_ASSESSMENT";
  if (source === "BLUD_OPERATOR_SELF_ASSESSMENT") return "BLUD_OPERATOR_SELF_ASSESSMENT";

  return isBpkpRole(role) ? "BPKP_SELF_ASSESSMENT" : "BLUD_OPERATOR_SELF_ASSESSMENT";
}

function getFollowUpStatus(rows: FollowUpRow[]) {
  if (rows.some((item) => normalizeRole(item.followUpStatus) === "DONE")) return "SUDAH";
  if (rows.some((item) => normalizeRole(item.followUpStatus) === "NOT_DONE")) return "BELUM";
  return "BELUM";
}

function getFollowUpDescription(rows: FollowUpRow[]) {
  const doneRows = rows.filter((item) => normalizeRole(item.followUpStatus) === "DONE");
  const notDoneRow = rows.find((item) => normalizeRole(item.followUpStatus) === "NOT_DONE");

  if (doneRows.length > 0) {
    return doneRows
      .map((item, index) => {
        const description = cleanText(item.description) || "-";
        const time = formatDateTime(item.updatedAt || item.createdAt);
        return `${index + 1}. ${description}\nSudah di tindak lanjut pada : ${time}`;
      })
      .join("\n\n");
  }

  if (notDoneRow) {
    const reason = cleanText(notDoneRow.pendingReason || notDoneRow.description) || "-";
    return `Alasan belum ditindaklanjuti:\n${reason}`;
  }

  return "Alasan belum ditindaklanjuti:\nBelum ada uraian alasan yang disimpan.";
}

function getAspectSummary(item: IndicatorDef) {
  return `${item.aspectNo}. ${item.aspectName}\nBobot aspek: ${item.aspectWeightLabel}`;
}

function getIndicatorSummary(item: IndicatorDef) {
  return `${item.indicatorNo}. ${item.indicatorName}\nBobot indikator: ${item.indicatorWeightLabel}`;
}

function getAspectKey(item: IndicatorDef) {
  return `${item.aspectNo}-${item.aspectName}`;
}

function getIndicatorKey(item: IndicatorDef) {
  return `${item.aspectNo}-${item.indicatorNo}-${item.indicatorName}`;
}

function toPdfFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "blud";
}

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year"));
    const role = normalizeRole(session.user.role);
    const assessmentSource = normalizeAssessmentSource(searchParams.get("assessmentSource"), role);
    const selectedBludIds = (searchParams.get("bludIds") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const selectedBludId = selectedBludIds[0] || "";
    const bludCode = String(searchParams.get("bludCode") || "").trim().toUpperCase();

    if (!year) {
      return NextResponse.json({ message: "Tahun wajib diisi." }, { status: 400 });
    }

    let bludId = session.user.bludId || null;

    if (canSelectBlud(role) && selectedBludId) {
      const selectedBlud = await prisma.blud.findUnique({
        where: { id: selectedBludId },
        select: { id: true },
      });
      bludId = selectedBlud?.id || null;
    } else if (canSelectBlud(role) && bludCode) {
      const selectedBlud = await prisma.blud.findUnique({
        where: { code: bludCode },
        select: { id: true },
      });
      bludId = selectedBlud?.id || null;
    }

    if (!bludId) {
      return NextResponse.json({ message: "BLUD tidak ditemukan." }, { status: 404 });
    }

    const blud = await prisma.blud.findUnique({ where: { id: bludId } });

    if (!blud) {
      return NextResponse.json({ message: "BLUD tidak ditemukan." }, { status: 404 });
    }

    const responseWhere =
      assessmentSource === "BPKP_SELF_ASSESSMENT"
        ? { createdByRole: { in: BPKP_ROLES } }
        : { OR: [{ createdByRole: null }, { createdByRole: { notIn: BPKP_ROLES } }] };

    const periods = await prisma.assessmentPeriod.findMany({
      where: { bludId, year },
      include: {
        responses: {
          where: responseWhere,
          orderBy: [{ sortOrder: "asc" }, { parameterId: "asc" }],
        },
      },
      orderBy: { moduleKey: "asc" },
    });

    const responseByParameterId = new Map<number, ReportResponse>();
    for (const period of periods) {
      for (const response of period.responses) {
        responseByParameterId.set(Number(response.parameterId), response as ReportResponse);
      }
    }

    const aoiResponses = Array.from(responseByParameterId.values()).filter(
      (item) => cleanText(item.aoi).length > 0,
    );
    const responseIds = aoiResponses.map((item) => item.id);

    const followUps =
      responseIds.length > 0
        ? await prisma.followUpEntry.findMany({
            where: { assessmentResponseId: { in: responseIds } },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          })
        : [];

    const followUpsByResponseId = new Map<string, FollowUpRow[]>();
    for (const item of followUps) {
      const list = followUpsByResponseId.get(item.assessmentResponseId) || [];
      list.push(item as FollowUpRow);
      followUpsByResponseId.set(item.assessmentResponseId, list);
    }

    const rows: ReportRow[] = INDICATORS.map((indicator) => {
      const response = responseByParameterId.get(indicator.parameterNo);
      return { indicator, response };
    }).filter((item) => cleanText(item.response?.aoi).length > 0);

    const totalDone = rows.filter(({ response }) =>
      response ? (followUpsByResponseId.get(response.id) || []).some((item) => normalizeRole(item.followUpStatus) === "DONE") : false,
    ).length;
    const totalPending = rows.length - totalDone;

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a3", orientation: "landscape", compress: true });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 24;
    const marginTop = 18;
    const marginBottom = 24;
    const contentBottom = pageHeight - marginBottom;
    const tableX = marginX;
    const tableWidth = pageWidth - marginX * 2;

    const navy: PdfColor = [15, 23, 42];
    const blue: PdfColor = [30, 64, 175];
    const sky: PdfColor = [219, 234, 254];
    const sky2: PdfColor = [239, 246, 255];
    const slate: PdfColor = [226, 232, 240];
    const slate2: PdfColor = [248, 250, 252];
    const white: PdfColor = [255, 255, 255];
    const emerald: PdfColor = [220, 252, 231];
    const amber: PdfColor = [254, 243, 199];
    const red: PdfColor = [254, 226, 226];
    const border: PdfColor = [51, 65, 85];
    const mutedText: PdfColor = [71, 85, 105];

    let y = marginTop;
    let pageNo = 1;

    const setFont = (bold = false, size = 7, color: PdfColor = [0, 0, 0]) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
    };

    const setFill = (color: PdfColor) => doc.setFillColor(color[0], color[1], color[2]);
    const setStroke = (color: PdfColor = border, width = 0.45) => {
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineWidth(width);
    };

    const splitText = (text: string, width: number, size = 7) => {
      setFont(false, size);
      return doc.splitTextToSize(String(text || "-"), Math.max(6, width - 10));
    };

    const drawRoundedRect = (x: number, cy: number, w: number, h: number, fillColor: PdfColor, strokeColor?: PdfColor) => {
      setFill(fillColor);
      if (strokeColor) {
        setStroke(strokeColor, 0.45);
        doc.roundedRect(x, cy, w, h, 8, 8, "FD");
      } else {
        doc.roundedRect(x, cy, w, h, 8, 8, "F");
      }
    };

    const drawMetaCard = (x: number, cy: number, w: number, label: string, value: string) => {
      drawRoundedRect(x, cy, w, 38, white, slate);
      setFont(true, 5.8, mutedText);
      doc.text(label.toUpperCase(), x + 10, cy + 13);
      setFont(true, 8, navy);
      const lines = doc.splitTextToSize(value || "-", w - 20).slice(0, 2);
      doc.text(lines, x + 10, cy + 27, { maxWidth: w - 20 });
    };

    const drawSummaryCard = (x: number, cy: number, w: number, label: string, value: string, fillColor: PdfColor) => {
      drawRoundedRect(x, cy, w, 50, fillColor, slate);
      setFont(true, 6.2, mutedText);
      doc.text(label.toUpperCase(), x + 12, cy + 16);
      setFont(true, 18, navy);
      doc.text(value, x + 12, cy + 39);
    };

    const drawReportHeader = () => {
      setFill(navy);
      doc.roundedRect(tableX, y, tableWidth, 54, 10, 10, "F");
      setFill(blue);
      doc.roundedRect(tableX + tableWidth - 220, y, 220, 54, 10, 10, "F");

      setFont(true, 13, white);
      doc.text("LAPORAN TINDAK LANJUT AOI", tableX + 16, y + 20);
      setFont(true, 9, [219, 234, 254]);
      doc.text("SELF ASSESSMENT MANAJEMEN RISIKO BLUD", tableX + 16, y + 36);

      setFont(true, 7, [219, 234, 254]);
      doc.text("TAHUN", tableX + tableWidth - 200, y + 20);
      setFont(true, 18, white);
      doc.text(String(year), tableX + tableWidth - 200, y + 41);

      y += 66;

      const metaGap = 10;
      const metaW = (tableWidth - metaGap * 3) / 4;
      drawMetaCard(tableX, y, metaW, "BLUD", `${blud.code || "-"} - ${blud.name || "-"}`);
      drawMetaCard(tableX + (metaW + metaGap), y, metaW, "Sumber Assessment", assessmentSource === "BPKP_SELF_ASSESSMENT" ? "Self Assessment Admin BPKP" : "Self Assessment Operator BLUD");
      drawMetaCard(tableX + (metaW + metaGap) * 2, y, metaW, "Status Assessment", mapStatusLabel(getGlobalStatus(periods)));
      drawMetaCard(tableX + (metaW + metaGap) * 3, y, metaW, "Tanggal Cetak", formatDateTime(new Date()));

      y += 50;

      const summaryGap = 10;
      const summaryW = (tableWidth - summaryGap * 2) / 3;
      drawSummaryCard(tableX, y, summaryW, "Total AOI", String(rows.length), sky);
      drawSummaryCard(tableX + summaryW + summaryGap, y, summaryW, "Sudah Ditindaklanjuti", String(totalDone), emerald);
      drawSummaryCard(tableX + (summaryW + summaryGap) * 2, y, summaryW, "Belum Ditindaklanjuti", String(totalPending), amber);

      y += 64;
    };

    const columns: ColumnDef[] = [
      { key: "no", title: "NO", w: 30 },
      { key: "aspect", title: "ASPEK", w: 108 },
      { key: "indicator", title: "INDIKATOR", w: 158 },
      { key: "parameter", title: "PARAMETER", w: 252 },
      { key: "criteria", title: "KRITERIA TERPILIH", w: 158 },
      { key: "aoi", title: "AOI", w: 188 },
      { key: "status", title: "STATUS TL", w: 72 },
      { key: "followUp", title: "TINDAK LANJUT / ALASAN", w: tableWidth - 966 },
    ];

    const xAt = (index: number) => tableX + columns.slice(0, index).reduce((sum, col) => sum + col.w, 0);
    const colByKey = (key: ColumnKey) => columns.find((col) => col.key === key)!;
    const xByKey = (key: ColumnKey) => xAt(columns.findIndex((col) => col.key === key));

    const drawTableHeader = () => {
      const headerH = 34;
      setFill(blue);
      setStroke(border, 0.45);
      doc.rect(tableX, y, tableWidth, headerH, "F");

      columns.forEach((col, index) => {
        const x = xAt(index);
        setStroke(border, 0.45);
        doc.rect(x, y, col.w, headerH);
        setFont(true, 6.8, white);
        const lines = doc.splitTextToSize(col.title, col.w - 8);
        const lineHeight = 8.3;
        doc.text(lines, x + col.w / 2, y + (headerH - lines.length * lineHeight) / 2 + 7, {
          align: "center",
          maxWidth: col.w - 8,
        });
      });

      y += headerH;
    };

    const drawFooter = () => {
      setStroke(slate, 0.35);
      doc.line(tableX, pageHeight - 17, tableX + tableWidth, pageHeight - 17);
      setFont(false, 6, mutedText);
      doc.text(`Dicetak: ${formatDateTime(new Date())}`, tableX, pageHeight - 8);
      doc.text(`Halaman ${pageNo}`, tableX + tableWidth - 46, pageHeight - 8);
    };

    const addPage = () => {
      drawFooter();
      doc.addPage("a3", "landscape");
      pageNo += 1;
      y = marginTop;
      drawReportHeader();
      drawTableHeader();
    };

    const drawCell = (
      x: number,
      cy: number,
      w: number,
      h: number,
      text: string,
      options: { fill?: PdfColor; size?: number; bold?: boolean; align?: "left" | "center"; valign?: "top" | "middle"; color?: PdfColor } = {},
    ) => {
      setFill(options.fill || white);
      doc.rect(x, cy, w, h, "F");
      setStroke(slate, 0.35);
      doc.rect(x, cy, w, h);

      const size = options.size ?? 6.6;
      const lineHeight = size + 1.8;
      setFont(Boolean(options.bold), size, options.color || [15, 23, 42]);
      const lines = doc.splitTextToSize(String(text || "-"), Math.max(6, w - 10));
      const textHeight = lines.length * lineHeight;
      const tx = options.align === "center" ? x + w / 2 : x + 5;
      const ty =
        options.valign === "middle"
          ? cy + Math.max(lineHeight, (h - textHeight) / 2 + lineHeight - 1)
          : cy + lineHeight + 4;

      doc.text(lines, tx, ty, {
        align: options.align || "left",
        maxWidth: w - 10,
      });
    };

    const buildPrintableRows = (): PrintableRow[] =>
      rows.map(({ indicator, response }, index) => {
        const followUpRows = response ? followUpsByResponseId.get(response.id) || [] : [];
        const status = getFollowUpStatus(followUpRows) as "SUDAH" | "BELUM";
        const values: Record<ColumnKey, string> = {
          no: String(index + 1),
          aspect: getAspectSummary(indicator),
          indicator: getIndicatorSummary(indicator),
          parameter: `${indicator.parameterNo}. ${indicator.parameterLabel}\nRef: ${indicator.ref}`,
          criteria: response ? `${cleanText(response.criteriaLabel) || "-"}\nSkor: ${Number(response.criteriaScore || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })}` : "-",
          aoi: cleanText(response?.aoi) || "-",
          status: status === "SUDAH" ? "Sudah di TL" : "Belum di TL",
          followUp: getFollowUpDescription(followUpRows),
        };

        const lineCounts = columns
          .filter((col) => !["aspect", "indicator"].includes(col.key))
          .map((col) => splitText(values[col.key], col.w, col.key === "aoi" || col.key === "followUp" ? 6.7 : 6.4).length);
        const rowHeight = Math.max(46, Math.min(132, Math.max(...lineCounts) * 8.4 + 14));

        return {
          source: { indicator, response },
          index,
          values,
          status,
          rowHeight,
          aspectKey: getAspectKey(indicator),
          indicatorKey: getIndicatorKey(indicator),
        };
      });

    const drawMergedCellsForPage = (pageRows: PrintableRow[], startY: number) => {
      const drawMergeGroup = (key: "aspectKey" | "indicatorKey", column: ColumnKey) => {
        let cursor = 0;
        while (cursor < pageRows.length) {
          const groupKey = pageRows[cursor][key];
          let end = cursor + 1;
          while (end < pageRows.length && pageRows[end][key] === groupKey) end += 1;

          const groupRows = pageRows.slice(cursor, end);
          const groupY = startY + pageRows.slice(0, cursor).reduce((sum, item) => sum + item.rowHeight, 0);
          const groupH = groupRows.reduce((sum, item) => sum + item.rowHeight, 0);
          const first = groupRows[0];
          const col = colByKey(column);
          const fillColor = first.index % 2 === 0 ? white : slate2;

          drawCell(xByKey(column), groupY, col.w, groupH, first.values[column], {
            fill: fillColor,
            size: 6.4,
            align: "left",
            valign: "middle",
          });

          cursor = end;
        }
      };

      drawMergeGroup("aspectKey", "aspect");
      drawMergeGroup("indicatorKey", "indicator");
    };

    const drawRowsOnPage = (pageRows: PrintableRow[]) => {
      const pageStartY = y;

      for (const printable of pageRows) {
        const zebra = printable.index % 2 === 0 ? white : slate2;
        const statusFill = printable.status === "SUDAH" ? emerald : red;

        columns.forEach((col) => {
          if (col.key === "aspect" || col.key === "indicator") return;

          drawCell(xByKey(col.key), y, col.w, printable.rowHeight, printable.values[col.key], {
            fill: col.key === "status" ? statusFill : zebra,
            size: col.key === "aoi" || col.key === "followUp" ? 6.7 : 6.4,
            bold: col.key === "status",
            align: ["no", "status"].includes(col.key) ? "center" : "left",
            valign: ["no", "status"].includes(col.key) ? "middle" : "top",
            color: col.key === "status" ? navy : [15, 23, 42],
          });
        });

        y += printable.rowHeight;
      }

      drawMergedCellsForPage(pageRows, pageStartY);
    };

    const printableRows = buildPrintableRows();

    drawReportHeader();
    drawTableHeader();

    if (printableRows.length === 0) {
      drawCell(tableX, y, tableWidth, 58, "Tidak ada AOI pada tahun dan sumber assessment yang dipilih.", { align: "center", valign: "middle", size: 9, fill: sky2, bold: true });
      y += 58;
    } else {
      let pageRows: PrintableRow[] = [];
      let pageRowsHeight = 0;

      for (const printable of printableRows) {
        if (pageRows.length > 0 && y + pageRowsHeight + printable.rowHeight > contentBottom) {
          drawRowsOnPage(pageRows);
          addPage();
          pageRows = [];
          pageRowsHeight = 0;
        }

        pageRows.push(printable);
        pageRowsHeight += printable.rowHeight;
      }

      if (pageRows.length > 0) {
        drawRowsOnPage(pageRows);
      }
    }

    y += 10;
    if (y + 42 > contentBottom) addPage();
    drawRoundedRect(tableX, y, tableWidth, 40, sky2, slate);
    setFont(true, 8, navy);
    doc.text("Ringkasan Laporan", tableX + 12, y + 16);
    setFont(false, 7.2, mutedText);
    doc.text(
      `Total AOI: ${rows.length}   |   Sudah ditindaklanjuti: ${totalDone}   |   Belum ditindaklanjuti: ${totalPending}`,
      tableX + 12,
      y + 30,
    );

    drawFooter();

    const pdf = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="laporan-tindak-lanjut-aoi-${toPdfFileName(blud.code || blud.name || "blud")}-${year}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Gagal membuat laporan tindak lanjut AOI." }, { status: 500 });
  }
}
