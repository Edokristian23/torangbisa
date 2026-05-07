import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/authz";
import {
  canMutateAssessment,
  canSubmitAssessment,
  mapStatusLabel,
} from "@/lib/assessment";
import { createAuditLog } from "@/lib/audit";
import type { AssessmentStatus, UserRole } from "@prisma/client";

function canUseBludFilter(role?: string | null) {
  const roleUpper = String(role || "").toUpperCase();

  return (
    roleUpper === "BPKP" ||
    roleUpper === "BPKP_ADMIN" ||
    roleUpper === "BPKP_REVIEWER" ||
    isAdminRole(roleUpper as UserRole)
  );
}

async function getBludOptions() {
  const bluds = await prisma.blud.findMany({
    orderBy: [{ name: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
    },
  });

  return bluds.map((blud) => ({
    id: blud.id,
    code: blud.code,
    name: blud.name,
  }));
}

async function resolveBludContext(session: any, request: Request) {
  const role = String(session?.user?.role || "").toUpperCase();

  if (canUseBludFilter(session?.user?.role)) {
    const { searchParams } = new URL(request.url);
    const bludCode = searchParams.get("bludCode") || searchParams.get("blud");

    if (bludCode) {
      const blud = await prisma.blud.findUnique({
        where: { code: bludCode.toUpperCase() },
      });

      if (blud) return blud;
    }
  }

  if (session?.user?.bludId) {
    return prisma.blud.findUnique({
      where: { id: session.user.bludId },
    });
  }

  if (canUseBludFilter(session?.user?.role)) {
    return prisma.blud.findFirst({
      orderBy: [{ name: "asc" }, { code: "asc" }],
    });
  }

  return null;
}

/**
 * Status display dibuat global per BLUD + tahun.
 *
 * Tujuan:
 * - Header "Status: ..." konsisten di semua aspek/module.
 * - Tidak mengubah logic existing seperti canEdit dan canSubmit,
 *   karena logic itu tetap memakai status module yang sedang dibuka.
 */
function resolveGlobalDisplayStatusFromPeriods(
  periods: Array<{ status: AssessmentStatus }>,
): AssessmentStatus {
  if (periods.length === 0) return "DRAFT";

  const statusPriority: Record<AssessmentStatus, number> = {
    DRAFT: 10,
    SUBMITTED: 20,
    IN_REVIEW: 30,
    APPROVED: 40,
    REVISION_REQUESTED: 50,
    REJECTED: 60,
  };

  return periods.reduce<AssessmentStatus>((selectedStatus, period) => {
    const currentStatus = period.status || "DRAFT";

    return statusPriority[currentStatus] > statusPriority[selectedStatus]
      ? currentStatus
      : selectedStatus;
  }, "DRAFT");
}

function serializeDocuments(
  links: Array<{
    document: {
      id: string;
      name: string;
      originalName: string;
      mimeType: string;
      sourceParameter: string | null;
      fileExtension: string | null;
    };
  }>,
  fallbackParameter: string,
) {
  return links.map((link) => ({
    id: link.document.id,
    name: link.document.name,
    originalName: link.document.originalName,
    url: `/api/documents/${link.document.id}`,
    type: link.document.mimeType,
    sourceParameter: link.document.sourceParameter || fallbackParameter,
    fileExtension: link.document.fileExtension,
    isPersisted: true,
  }));
}

function serializeAssessmentRows(rows: any[]) {
  return rows.map((row: any) => ({
    id: row.id,
    parameterId: row.parameterId,
    parameter: row.parameterLabel,
    criteriaCode: row.criteriaCode,
    criteriaLabel: row.criteriaLabel,
    criteriaScore: Number(row.criteriaScore),
    aoi: row.aoi,
    documents: serializeDocuments(row.documentLinks, row.parameterLabel),
    createdByRole: row.createdByRole || "BLUD_OPERATOR",
    createdByName: row.createdByName || null,
    reviewStatus: row.reviewStatus || "pending",
    reviewNotes: row.reviewNotes || null,
    reviewedAt: row.reviewedAt || null,
    isRevision: Boolean(row.isRevision ?? false),
    revisionNumber:
      typeof row.revisionNumber === "number" ? row.revisionNumber : null,
    lastRejectedAt: row.lastRejectedAt || null,
    lastRejectedByName: row.lastRejectedByName || null,
    previousCriteriaCode: row.previousCriteriaCode || null,
    previousCriteriaLabel: row.previousCriteriaLabel || null,
    previousCriteriaScore:
      row.previousCriteriaScore !== null &&
      row.previousCriteriaScore !== undefined
        ? Number(row.previousCriteriaScore)
        : null,
    previousAoi: row.previousAoi || null,
    previousDocuments: Array.isArray(row.previousDocuments)
      ? row.previousDocuments
      : [],
  }));
}

function isEvidenceRequired(criteriaScore: number) {
  return criteriaScore > 1;
}

const BPKP_ROLES = ["BPKP", "BPKP_ADMIN", "BPKP_REVIEWER"];

function isBpkpRole(role?: string | null) {
  return BPKP_ROLES.includes(String(role || "").toUpperCase());
}

function normalizeDaMode(value?: string | null) {
  const raw = String(value || "manual").toLowerCase();
  if (["tarik_data", "tarik-data", "tarikdata"].includes(raw)) {
    return "tarik_data";
  }
  return "manual";
}

function bludInputWhere() {
  return {
    OR: [
      { createdByRole: null },
      { createdByRole: "BLUD_OPERATOR" },
      { createdByRole: "BLUD_ADMIN" },
    ],
  };
}

function bpkpInputWhere() {
  return {
    createdByRole: { in: BPKP_ROLES },
  };
}

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year"));
    const moduleKey = String(searchParams.get("moduleKey") || "");
    const daMode = normalizeDaMode(
      searchParams.get("daMode") || searchParams.get("da"),
    );
    const role = session.user.role;
    const roleUpper = String(role || "").toUpperCase();
    const bludOptions = canUseBludFilter(role) ? await getBludOptions() : [];
    const blud = await resolveBludContext(session, request);

    if (!year || !moduleKey) {
      return NextResponse.json(
        { message: "Parameter year dan moduleKey wajib diisi." },
        { status: 400 },
      );
    }

    if (!blud?.id) {
      return NextResponse.json(
        { message: "Konteks BLUD tidak ditemukan." },
        { status: 400 },
      );
    }

    const [period, allPeriods] = await prisma.$transaction([
      prisma.assessmentPeriod.findUnique({
        where: {
          bludId_year_moduleKey: {
            bludId: blud.id,
            year,
            moduleKey,
          },
        },
        include: {
          responses: {
            orderBy: [{ sortOrder: "asc" }, { parameterId: "asc" }],
            include: {
              documentLinks: {
                orderBy: { createdAt: "asc" },
                include: {
                  document: true,
                },
              },
            },
          },
        },
      }),

      prisma.assessmentPeriod.findMany({
        where: {
          bludId: blud.id,
          year,
        },
        select: {
          status: true,
          submittedAt: true,
          reviewedAt: true,
        },
      }),
    ]);

    const globalDisplayStatus =
      resolveGlobalDisplayStatusFromPeriods(allPeriods);

    /**
     * Submit operator bersifat global per BLUD + tahun.
     * Jika salah satu aspek/module sudah dikirim ke Admin BLUD,
     * semua aspek pada tahun yang sama harus terkunci dan bisa direview Admin.
     */
    const globalSubmittedAt =
      allPeriods
        .map((item) => item.submittedAt)
        .filter(Boolean)
        .sort(
          (a, b) => Number(new Date(a as Date)) - Number(new Date(b as Date)),
        )[0] || null;

    const hasGlobalSubmitted =
      !!globalSubmittedAt ||
      allPeriods.some((item) =>
        ["SUBMITTED", "IN_REVIEW", "REVISION_REQUESTED"].includes(
          String(item.status || "").toUpperCase(),
        ),
      );

    const currentStatus = period?.status ?? "DRAFT";
    const statusUpper = String(currentStatus || "").toUpperCase();

    const canEdit = canMutateAssessment(role, currentStatus);

    const canReview =
      (roleUpper === "BLUD_ADMIN" ||
        roleUpper === "BPKP" ||
        roleUpper === "BPKP_ADMIN" ||
        roleUpper === "BPKP_REVIEWER") &&
      (["SUBMITTED", "IN_REVIEW", "REVISION_REQUESTED"].includes(statusUpper) ||
        (roleUpper === "BLUD_ADMIN" && hasGlobalSubmitted));

    const totalCompletedParametersAllModules =
      await prisma.assessmentResponse.count({
        where: {
          assessmentPeriod: {
            bludId: blud.id,
            year,
          },
          ...bludInputWhere(),
        },
      });

    const totalAcceptedParametersAllModules =
      await prisma.assessmentResponse.count({
        where: {
          assessmentPeriod: {
            bludId: blud.id,
            year,
          },
          reviewStatus: "accepted",
          ...bludInputWhere(),
        },
      });

    const rejectedParametersAllModules = await prisma.assessmentResponse.count({
      where: {
        assessmentPeriod: {
          bludId: blud.id,
          year,
        },
        reviewStatus: "rejected",
        ...bludInputWhere(),
      },
    });

    const hasRejectedParametersAllModules = rejectedParametersAllModules > 0;

    const canSubmitToAdminBludByCompletedCount =
      roleUpper === "BLUD_OPERATOR" &&
      totalCompletedParametersAllModules >= 28 &&
      !hasRejectedParametersAllModules &&
      ["DRAFT", "REVISION_REQUESTED"].includes(statusUpper);

    const canSubmitToBpkpByAcceptedCount =
      roleUpper === "BLUD_ADMIN" &&
      totalAcceptedParametersAllModules >= 28 &&
      ["SUBMITTED", "IN_REVIEW", "REVISION_REQUESTED"].includes(statusUpper);

    const canSubmit =
      canSubmitAssessment(role, currentStatus) ||
      canSubmitToAdminBludByCompletedCount ||
      canSubmitToBpkpByAcceptedCount;

    /**
     * Penanda khusus untuk frontend agar tombol "Kirim ke BPKP" hilang
     * setelah Admin BLUD mengirim assessment ke BPKP.
     *
     * Tidak menambah / mengubah enum status yang sudah berjalan.
     * Flow existing tetap memakai status SUBMITTED / IN_REVIEW / REVISION_REQUESTED.
     *
     * Fix global:
     * - Deteksi dikirim ke BPKP dibuat global per BLUD + tahun.
     * - Jadi setelah Admin BLUD klik Kirim ke BPKP di salah satu aspek,
     *   semua aspek pada tahun yang sama ikut mengirim submittedToBpkpAt.
     * - Jangan pakai period.reviewedAt sebagai syarat, karena workflow submit
     *   memang me-reset reviewedAt menjadi null.
     */
    const globalSubmittedToBpkpAt =
      (roleUpper === "BLUD_ADMIN" ||
        roleUpper === "BPKP" ||
        roleUpper === "BPKP_ADMIN" ||
        roleUpper === "BPKP_REVIEWER") &&
      totalAcceptedParametersAllModules >= 28
        ? allPeriods
            .filter(
              (item) =>
                String(item.status || "").toUpperCase() === "SUBMITTED" &&
                !!item.submittedAt,
            )
            .map((item) => item.submittedAt)
            .filter(Boolean)
            .sort(
              (a, b) =>
                Number(new Date(a as Date)) - Number(new Date(b as Date)),
            )[0] || null
        : null;

    const submittedToBpkpAt = globalSubmittedToBpkpAt;

    if (!period) {
      return NextResponse.json({
        blud: {
          id: blud.id,
          code: blud.code,
          name: blud.name,
        },
        bludOptions,
        periodId: null,

        status: "DRAFT",
        statusLabel: mapStatusLabel(globalDisplayStatus),
        moduleStatus: "DRAFT",
        moduleStatusLabel: mapStatusLabel("DRAFT"),

        reviewerNotes: "",
        submittedAt: null,
        globalSubmittedAt: globalSubmittedAt
          ? globalSubmittedAt.toISOString()
          : null,
        submittedToBpkpAt: null,
        reviewedAt: null,
        canEdit,
        canSubmit,
        canReview,
        userRole: role,
        hiddenByRevisionRequest: false,
        totalCompletedParametersAllModules,
        totalAcceptedParametersAllModules,
        daMode,
        sourceRows: [],
        rows: [],
      });
    }

    const bludRows = period.responses.filter((row: any) => {
      const createdByRole = String(
        row.createdByRole || "BLUD_OPERATOR",
      ).toUpperCase();
      return !BPKP_ROLES.includes(createdByRole);
    });

    const bpkpRows = period.responses.filter((row: any) =>
      BPKP_ROLES.includes(String(row.createdByRole || "").toUpperCase()),
    );

    const responseRows = isBpkpRole(role) ? bpkpRows : bludRows;
    const sourceRows =
      isBpkpRole(role) && daMode === "tarik_data"
        ? serializeAssessmentRows(bludRows)
        : [];

    return NextResponse.json({
      blud: {
        id: blud.id,
        code: blud.code,
        name: blud.name,
      },
      bludOptions,
      periodId: period.id,

      // status module tetap dikirim, tapi statusLabel header memakai globalDisplayStatus
      status: period.status,
      statusLabel: mapStatusLabel(globalDisplayStatus),
      moduleStatus: period.status,
      moduleStatusLabel: mapStatusLabel(period.status),

      reviewerNotes: period.reviewerNotes || "",
      submittedAt: period.submittedAt,
      globalSubmittedAt: globalSubmittedAt
        ? globalSubmittedAt.toISOString()
        : null,
      submittedToBpkpAt: submittedToBpkpAt
        ? submittedToBpkpAt.toISOString()
        : null,
      reviewedAt: period.reviewedAt,
      canEdit,
      canSubmit,
      canReview,
      userRole: role,
      hiddenByRevisionRequest: false,
      totalCompletedParametersAllModules,
      totalAcceptedParametersAllModules,
      daMode,
      sourceRows,
      rows: serializeAssessmentRows(responseRows),
    });
  } catch (error) {
    console.error("GET /api/assessments error:", error);

    return NextResponse.json(
      {
        message: "Gagal memuat data assessment.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const year = Number(body.year);
    const moduleKey = String(body.moduleKey || "");
    const row = body.row;
    const daMode = normalizeDaMode(body.daMode || body.da);
    const role = session.user.role;
    const roleUpper = String(role || "").toUpperCase();
    const isBpkpSelfInput = isBpkpRole(role);
    const targetBludCode = body.bludCode
      ? String(body.bludCode).toUpperCase()
      : null;

    let bludId = session.user.bludId;

    if (canUseBludFilter(role) && targetBludCode) {
      const blud = await prisma.blud.findUnique({
        where: { code: targetBludCode },
      });

      bludId = blud?.id ?? null;
    }

    if (
      !year ||
      !moduleKey ||
      !bludId ||
      !row?.parameterId ||
      !row?.parameter ||
      !row?.criteriaCode ||
      !row?.criteriaLabel ||
      typeof row?.criteriaScore === "undefined"
    ) {
      return NextResponse.json(
        { message: "Payload assessment tidak lengkap." },
        { status: 400 },
      );
    }

    const aoi = String(row.aoi || "");
    const criteriaScore = Number(row.criteriaScore);

    if (Number.isNaN(criteriaScore)) {
      return NextResponse.json(
        { message: "Nilai criteriaScore tidak valid." },
        { status: 400 },
      );
    }

    if (criteriaScore < 3 && !aoi.trim()) {
      return NextResponse.json(
        { message: "AOI wajib diisi untuk kriteria di bawah Level 3." },
        { status: 400 },
      );
    }

    const period = await prisma.assessmentPeriod.upsert({
      where: {
        bludId_year_moduleKey: {
          bludId,
          year,
          moduleKey,
        },
      },
      update: {},
      create: {
        bludId,
        year,
        moduleKey,
        status: "DRAFT",
      },
    });

    if (!isBpkpSelfInput && !canMutateAssessment(role, period.status)) {
      return NextResponse.json(
        {
          message: `Assessment dengan status ${mapStatusLabel(
            period.status,
          )} tidak bisa diubah.`,
        },
        { status: 409 },
      );
    }

    const existing = await prisma.assessmentResponse.findFirst({
      where: {
        assessmentPeriodId: period.id,
        parameterId: Number(row.parameterId),
        ...(isBpkpSelfInput ? bpkpInputWhere() : bludInputWhere()),
      },
    });

    if (existing) {
      return NextResponse.json(
        { message: "Parameter sudah pernah diinput pada tahun dan modul ini." },
        { status: 409 },
      );
    }

    const documentIds = Array.isArray(row.documentIds)
      ? row.documentIds.map(String)
      : [];

    if (isEvidenceRequired(criteriaScore) && documentIds.length === 0) {
      return NextResponse.json(
        {
          message: "Upload Evidence wajib apabila level parameter lebih dari 1.",
        },
        { status: 400 },
      );
    }

    let validDocuments: Array<{ id: string }> = [];

    if (documentIds.length > 0) {
      /**
       * Fix existing document global untuk Admin BPKP:
       *
       * Sebelumnya dokumen hanya dianggap valid bila assessmentPeriodId sama
       * dengan periode module yang sedang dibuka. Setelah cek existing dokumen
       * dibuat global per BLUD + tahun, dokumen existing dari module lain akan
       * memiliki assessmentPeriodId berbeda sehingga POST /api/assessments
       * mengembalikan 400 saat tombol Simpan diklik.
       *
       * Perubahan ini hanya berlaku untuk input self-assessment BPKP.
       * Operator BLUD dan Admin BLUD tetap memakai validasi lama berbasis
       * assessmentPeriodId current module agar workflow existing tidak berubah.
       */
      validDocuments = await prisma.assessmentDocument.findMany({
        where: {
          id: { in: documentIds },
          ...(isBpkpSelfInput
            ? {
                assessmentPeriod: {
                  bludId,
                  year,
                },
              }
            : {
                assessmentPeriodId: period.id,
              }),
        },
        select: { id: true },
      });

      if (validDocuments.length !== documentIds.length) {
        return NextResponse.json(
          {
            message:
              isBpkpSelfInput
                ? "Sebagian dokumen tidak valid untuk BLUD dan tahun yang dipilih."
                : "Sebagian dokumen tidak valid untuk periode assessment ini.",
          },
          { status: 400 },
        );
      }
    }

    const created = await prisma.assessmentResponse.create({
      data: {
        assessmentPeriodId: period.id,
        parameterId: Number(row.parameterId),
        parameterLabel: String(row.parameter),
        criteriaCode: String(row.criteriaCode),
        criteriaLabel: String(row.criteriaLabel),
        criteriaScore,
        aoi,
        sortOrder: Number(row.parameterId),
        reviewStatus: "pending",
        reviewNotes: null,
        reviewedAt: null,
        createdByRole: isBpkpSelfInput
          ? roleUpper
          : String(role || "BLUD_OPERATOR"),
        createdByName: String(session.user.name || "") || null,
        documentLinks: {
          create: documentIds.map((documentId: string) => ({
            document: {
              connect: { id: documentId },
            },
          })),
        },
      },
      include: {
        documentLinks: {
          include: {
            document: true,
          },
        },
      },
    });

    await createAuditLog({
      actorId: session.user.id,
      action: "CREATE_ASSESSMENT_RESPONSE",
      entityType: "AssessmentResponse",
      entityId: created.id,
      nextState: body,
      metadata: {
        year,
        moduleKey,
        bludId,
        documentIds,
        daMode,
        isBpkpSelfInput,
      },
    });

    return NextResponse.json(
      {
        row: {
          id: created.id,
          parameterId: created.parameterId,
          parameter: created.parameterLabel,
          criteriaCode: created.criteriaCode,
          criteriaLabel: created.criteriaLabel,
          criteriaScore: Number(created.criteriaScore),
          aoi: created.aoi,
          documents: serializeDocuments(
            created.documentLinks,
            created.parameterLabel,
          ),
          createdByRole: created.createdByRole || "BLUD_OPERATOR",
          createdByName: created.createdByName || null,
          reviewStatus: created.reviewStatus || "pending",
          reviewNotes: created.reviewNotes || null,
          reviewedAt: created.reviewedAt || null,
          isRevision: false,
          revisionNumber: null,
          lastRejectedAt: null,
          lastRejectedByName: null,
          previousCriteriaCode: null,
          previousCriteriaLabel: null,
          previousCriteriaScore: null,
          previousAoi: null,
          previousDocuments: [],
        },
        periodStatus: period.status,
        periodStatusLabel: mapStatusLabel(period.status),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/assessments error:", error);

    return NextResponse.json(
      {
        message: "Gagal menyimpan assessment.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
