import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/authz";
import { MODULE_LABELS } from "@/lib/assessment";
import { createAuditLog } from "@/lib/audit";

type RawResponse = {
  id: string;
  parameterId: number;
  parameterLabel: string;
  criteriaCode: string;
  criteriaLabel: string;
  criteriaScore: number;
  aoi: string;
  moduleKey: string;
  bludCode: string;
  bludName: string;
};

type FollowUpStatus = "DONE" | "NOT_DONE";

type RawFollowUp = {
  id: string;
  assessmentResponseId: string;
  description: string;
  sortOrder: number;
  followUpStatus: FollowUpStatus | string | null;
  pendingReason: string | null;
};

type RawDocument = {
  followUpEntryId: string;
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  sourceParameter: string | null;
  fileExtension: string | null;
};

type NormalizedFollowUpEntry = {
  description: string;
  documentIds: string[];
  sortOrder: number;
};

function normalizeFollowUpStatus(value?: string | null): FollowUpStatus {
  return String(value || "DONE").toUpperCase() === "NOT_DONE"
    ? "NOT_DONE"
    : "DONE";
}

const BPKP_ROLES = ["BPKP", "BPKP_ADMIN", "BPKP_REVIEWER"];

function normalizeRole(role?: string | null) {
  return String(role || "").toUpperCase();
}

function isBpkpRole(role?: string | null) {
  return BPKP_ROLES.includes(normalizeRole(role));
}

function isBpkpOwnedResponse(createdByRole?: string | null) {
  return BPKP_ROLES.includes(normalizeRole(createdByRole));
}

function canUseExistingDocumentAcrossModules(role?: string | null) {
  const roleUpper = normalizeRole(role);

  return (
    roleUpper === "BLUD_OPERATOR" ||
    roleUpper === "BLUD_ADMIN" ||
    roleUpper === "BPKP" ||
    roleUpper === "BPKP_ADMIN" ||
    roleUpper === "BPKP_REVIEWER"
  );
}

function serializeDocument(link: RawDocument) {
  return {
    id: link.id,
    name: link.name,
    originalName: link.originalName,
    url: `/api/documents/${link.id}`,
    type: link.mimeType,
    sourceParameter: link.sourceParameter || undefined,
    fileExtension: link.fileExtension || undefined,
    isPersisted: true,
  };
}

function isBludAdminReviewOnly(role?: string | null) {
  return normalizeRole(role) === "BLUD_ADMIN";
}

function canManageFollowUps(role?: string | null) {
  // BLUD_ADMIN hanya review. Role lain mengikuti permission existing.
  return !isBludAdminReviewOnly(role);
}

function forbiddenReviewOnlyResponse() {
  return NextResponse.json(
    {
      message: "Role Admin BLUD hanya dapat melakukan review tindak lanjut AOI.",
    },
    { status: 403 },
  );
}

function sqlStringList(values: readonly string[]) {
  return values.map((id) => `'${id.replace(/'/g, "''")}'`).join(",");
}

function extractDocumentIds(entry: any): string[] {
  const ids = new Set<string>();

  if (Array.isArray(entry?.documentIds)) {
    for (const id of entry.documentIds) {
      const normalizedId = String(id || "").trim();
      if (normalizedId) ids.add(normalizedId);
    }
  }

  if (Array.isArray(entry?.documents)) {
    for (const document of entry.documents) {
      const normalizedId = String(document?.id || "").trim();
      if (normalizedId) ids.add(normalizedId);
    }
  }

  return Array.from(ids);
}

async function getBludOptions() {
  const bluds = await prisma.blud.findMany({
    orderBy: [{ code: "asc" }, { name: "asc" }],
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

function canUseBludFilter(role?: string | null) {
  return isBpkpRole(role) || isAdminRole(role as any);
}

async function resolveBludContext(session: any, request: Request) {
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
    return prisma.blud.findUnique({ where: { id: session.user.bludId } });
  }

  if (canUseBludFilter(session?.user?.role)) {
    return prisma.blud.findFirst({
      orderBy: [{ name: "asc" }, { code: "asc" }],
    });
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year"));
    const moduleKey = String(searchParams.get("moduleKey") || "").trim();
    const role = normalizeRole(session.user.role);
    const bludOptions = canUseBludFilter(role) ? await getBludOptions() : [];
    const blud = await resolveBludContext(session, request);

    if (!year || !blud?.id) {
      return NextResponse.json(
        { message: "Parameter tidak lengkap." },
        { status: 400 },
      );
    }

    const responseSourceSql = isBpkpRole(role)
      ? prisma.$queryRaw<RawResponse[]>`
          SELECT
            ar."id",
            ar."parameterId",
            ar."parameterLabel",
            ar."criteriaCode",
            ar."criteriaLabel",
            CAST(ar."criteriaScore" AS DOUBLE PRECISION) AS "criteriaScore",
            ar."aoi",
            ap."moduleKey",
            b."code" AS "bludCode",
            b."name" AS "bludName"
          FROM "AssessmentResponse" ar
          INNER JOIN "AssessmentPeriod" ap ON ap."id" = ar."assessmentPeriodId"
          INNER JOIN "Blud" b ON b."id" = ap."bludId"
          WHERE ap."year" = ${year}
            AND ap."bludId" = ${blud.id}
            AND (${moduleKey} = '' OR ap."moduleKey" = ${moduleKey})
            AND ar."createdByRole" IN ('BPKP', 'BPKP_ADMIN', 'BPKP_REVIEWER')
            AND NULLIF(TRIM(ar."aoi"), '') IS NOT NULL
          ORDER BY ap."moduleKey" ASC, ar."sortOrder" ASC, ar."parameterId" ASC
        `
      : prisma.$queryRaw<RawResponse[]>`
          SELECT
            ar."id",
            ar."parameterId",
            ar."parameterLabel",
            ar."criteriaCode",
            ar."criteriaLabel",
            CAST(ar."criteriaScore" AS DOUBLE PRECISION) AS "criteriaScore",
            ar."aoi",
            ap."moduleKey",
            b."code" AS "bludCode",
            b."name" AS "bludName"
          FROM "AssessmentResponse" ar
          INNER JOIN "AssessmentPeriod" ap ON ap."id" = ar."assessmentPeriodId"
          INNER JOIN "Blud" b ON b."id" = ap."bludId"
          WHERE ap."year" = ${year}
            AND ap."bludId" = ${blud.id}
            AND (${moduleKey} = '' OR ap."moduleKey" = ${moduleKey})
            AND (ar."createdByRole" IS NULL OR ar."createdByRole" NOT IN ('BPKP', 'BPKP_ADMIN', 'BPKP_REVIEWER'))
            AND NULLIF(TRIM(ar."aoi"), '') IS NOT NULL
          ORDER BY ap."moduleKey" ASC, ar."sortOrder" ASC, ar."parameterId" ASC
        `;

    const responses = await responseSourceSql;
    const responseIds = responses.map((item) => item.id);

    const followUps =
      responseIds.length > 0
        ? await prisma.$queryRawUnsafe<RawFollowUp[]>(
            `SELECT
               fu."id",
               fu."assessmentResponseId",
               fu."description",
               fu."sortOrder",
               COALESCE(fu."followUpStatus", 'DONE') AS "followUpStatus",
               fu."pendingReason"
             FROM "FollowUpEntry" fu
             WHERE fu."assessmentResponseId" IN (${responseIds
               .map((id) => `'${id.replace(/'/g, "''")}'`)
               .join(",")})
             ORDER BY fu."sortOrder" ASC, fu."createdAt" ASC`,
          )
        : [];

    const followUpIds = followUps.map((item) => item.id);
    const documentsByFollowUpId = new Map<
      string,
      ReturnType<typeof serializeDocument>[]
    >();

    if (followUpIds.length > 0) {
      const docs = await prisma.$queryRawUnsafe<RawDocument[]>(
        `SELECT fud."followUpEntryId", d."id", d."name", d."originalName", d."mimeType", d."sourceParameter", d."fileExtension"
         FROM "FollowUpEntryDocument" fud
         INNER JOIN "AssessmentDocument" d ON d."id" = fud."documentId"
         WHERE fud."followUpEntryId" IN (${followUpIds
           .map((id) => `'${id.replace(/'/g, "''")}'`)
           .join(",")})`,
      );

      for (const doc of docs) {
        const list = documentsByFollowUpId.get(doc.followUpEntryId) || [];
        list.push(serializeDocument(doc));
        documentsByFollowUpId.set(doc.followUpEntryId, list);
      }
    }

    const followUpsByResponseId = new Map<
      string,
      Array<{
        id: string;
        description: string;
        sortOrder: number;
        followUpStatus: FollowUpStatus;
        pendingReason: string | null;
        documents: ReturnType<typeof serializeDocument>[];
      }>
    >();

    for (const entry of followUps) {
      const list = followUpsByResponseId.get(entry.assessmentResponseId) || [];
      list.push({
        id: entry.id,
        description: entry.description,
        sortOrder: entry.sortOrder,
        followUpStatus: normalizeFollowUpStatus(entry.followUpStatus),
        pendingReason: entry.pendingReason,
        documents: documentsByFollowUpId.get(entry.id) || [],
      });
      followUpsByResponseId.set(entry.assessmentResponseId, list);
    }

    const items = responses.map((row) => {
      const rowFollowUps = followUpsByResponseId.get(row.id) || [];
      const doneFollowUps = rowFollowUps.filter(
        (entry) => entry.followUpStatus === "DONE",
      );
      const notDoneEntry = rowFollowUps.find(
        (entry) => entry.followUpStatus === "NOT_DONE",
      );

      return {
        id: row.id,
        parameterId: row.parameterId,
        parameterLabel: row.parameterLabel,
        criteriaCode: row.criteriaCode,
        criteriaLabel: row.criteriaLabel,
        criteriaScore: Number(row.criteriaScore),
        aoi: row.aoi,
        moduleKey: row.moduleKey,
        moduleLabel: MODULE_LABELS[row.moduleKey] || row.moduleKey,
        blud: {
          code: row.bludCode,
          name: row.bludName,
        },
        followUpStatus: doneFollowUps.length > 0 ? "DONE" : notDoneEntry ? "NOT_DONE" : null,
        pendingReason: notDoneEntry?.pendingReason || notDoneEntry?.description || "",
        isCompleted: doneFollowUps.length > 0,
        followUpCount: doneFollowUps.length,
        followUps: doneFollowUps,
      };
    });

    return NextResponse.json({
      blud: { id: blud.id, code: blud.code, name: blud.name },
      bludOptions,
      source: isBpkpRole(role) ? "BPKP_SELF_ASSESSMENT" : "BLUD_SELF_ASSESSMENT",
      summary: {
        totalAoi: items.length,
        completedAoi: items.filter((item) => item.isCompleted).length,
        pendingAoi: items.filter((item) => !item.isCompleted).length,
        totalFollowUps: items.reduce((sum, item) => sum + item.followUpCount, 0),
      },
      items,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Gagal memuat tindak lanjut." },
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
    const responseId = String(body.responseId || "");
    const entries = Array.isArray(body.entries) ? body.entries : [];
    const followUpStatus = normalizeFollowUpStatus(body.followUpStatus);
    const pendingReason = String(body.pendingReason || "").trim();

    if (!responseId || (followUpStatus === "DONE" && entries.length === 0)) {
      return NextResponse.json(
        { message: "Data tindak lanjut tidak lengkap." },
        { status: 400 },
      );
    }

    const response = await prisma.assessmentResponse.findUnique({
      where: { id: responseId },
      include: { assessmentPeriod: true },
    });

    if (!response) {
      return NextResponse.json(
        { message: "AOI tidak ditemukan." },
        { status: 404 },
      );
    }

    if (!canManageFollowUps(session.user.role)) {
      return forbiddenReviewOnlyResponse();
    }

    const role = normalizeRole(session.user.role);
    const responseOwnedByBpkp = isBpkpOwnedResponse(response.createdByRole);

    if (isBpkpRole(role)) {
      if (!responseOwnedByBpkp) {
        return NextResponse.json(
          {
            message:
              "Admin BPKP hanya dapat menyimpan tindak lanjut pada self assessment Admin BPKP.",
          },
          { status: 403 },
        );
      }
    } else {
      if (responseOwnedByBpkp) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }

      if (
        !isAdminRole(session.user.role) &&
        response.assessmentPeriod.bludId !== session.user.bludId
      ) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
    }

    const normalizedEntries: NormalizedFollowUpEntry[] =
      followUpStatus === "DONE"
        ? entries
            .map((entry: any, index: number): NormalizedFollowUpEntry => ({
              description: String(entry.description || "").trim(),
              documentIds: extractDocumentIds(entry),
              sortOrder: index + 1,
            }))
            .filter((entry) => entry.description.length > 0)
        : [];

    if (followUpStatus === "DONE" && normalizedEntries.length === 0) {
      return NextResponse.json(
        { message: "Minimal satu uraian tindak lanjut wajib diisi." },
        { status: 400 },
      );
    }

    if (followUpStatus === "NOT_DONE" && pendingReason.length === 0) {
      return NextResponse.json(
        { message: "Uraian alasan belum ditindaklanjuti wajib diisi." },
        { status: 400 },
      );
    }

    const documentIds: string[] = Array.from(
      new Set<string>(
        normalizedEntries.flatMap((entry) => entry.documentIds),
      ),
    );

    if (documentIds.length > 0) {
      /**
       * Fix existing evidence lintas modul/aspek untuk menu Tindak Lanjut.
       *
       * Sebelumnya role BLUD hanya valid jika dokumen berasal dari
       * assessmentPeriodId yang sama. Akibatnya, saat operator/admin BLUD
       * memilih "Gunakan Dokumen Existing" dari modul/aspek lain, simpan
       * tindak lanjut bisa gagal 400 walaupun dokumen masih dalam BLUD dan
       * tahun assessment yang sama.
       *
       * Aturan baru:
       * - BLUD_OPERATOR dan BLUD_ADMIN boleh memakai existing evidence lintas
       *   modul/aspek selama masih dalam BLUD yang sama dan tahun yang sama.
       * - BPKP / BPKP_ADMIN / BPKP_REVIEWER tetap memakai aturan lintas modul
       *   yang sudah berjalan.
       * - Role lain tetap memakai validasi lama berbasis assessmentPeriodId.
       */
      const allowExistingDocumentAcrossModules =
        canUseExistingDocumentAcrossModules(role);

      const validDocuments = allowExistingDocumentAcrossModules
        ? await prisma.assessmentDocument.findMany({
            where: {
              id: { in: documentIds },
              assessmentPeriod: {
                bludId: response.assessmentPeriod.bludId,
                year: response.assessmentPeriod.year,
              },
            },
            select: { id: true },
          })
        : await prisma.assessmentDocument.findMany({
            where: {
              id: { in: documentIds },
              assessmentPeriodId: response.assessmentPeriodId,
            },
            select: { id: true },
          });

      if (validDocuments.length !== documentIds.length) {
        return NextResponse.json(
          {
            message: allowExistingDocumentAcrossModules
              ? "Sebagian evidence tidak valid untuk BLUD dan tahun assessment ini."
              : "Sebagian evidence tidak valid untuk periode assessment ini.",
          },
          { status: 400 },
        );
      }
    }

    const previousFollowUpCount = await prisma.$queryRaw<
      Array<{ count: bigint }>
    >`
      SELECT COUNT(*)::bigint AS count
      FROM "FollowUpEntry"
      WHERE "assessmentResponseId" = ${responseId}
    `;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM "FollowUpEntryDocument"
        WHERE "followUpEntryId" IN (
          SELECT "id" FROM "FollowUpEntry" WHERE "assessmentResponseId" = ${responseId}
        )
      `;
      await tx.$executeRaw`
        DELETE FROM "FollowUpEntry"
        WHERE "assessmentResponseId" = ${responseId}
      `;

      if (followUpStatus === "NOT_DONE") {
        const followUpEntryId = randomUUID();
        await tx.$executeRaw`
          INSERT INTO "FollowUpEntry" ("id", "assessmentResponseId", "description", "sortOrder", "createdById", "followUpStatus", "pendingReason", "createdAt", "updatedAt")
          VALUES (${followUpEntryId}, ${responseId}, ${pendingReason}, 1, ${session.user.id}, 'NOT_DONE', ${pendingReason}, NOW(), NOW())
        `;
      } else {
        for (const entry of normalizedEntries) {
          const followUpEntryId = randomUUID();
          await tx.$executeRaw`
            INSERT INTO "FollowUpEntry" ("id", "assessmentResponseId", "description", "sortOrder", "createdById", "followUpStatus", "pendingReason", "createdAt", "updatedAt")
            VALUES (${followUpEntryId}, ${responseId}, ${entry.description}, ${entry.sortOrder}, ${session.user.id}, 'DONE', NULL, NOW(), NOW())
          `;

          for (const documentId of entry.documentIds) {
            await tx.$executeRaw`
              INSERT INTO "FollowUpEntryDocument" ("followUpEntryId", "documentId", "createdAt")
              VALUES (${followUpEntryId}, ${documentId}, NOW())
            `;
          }
        }
      }
    });

    await createAuditLog({
      actorId: session.user.id,
      action: isBpkpRole(role)
        ? "UPSERT_BPKP_FOLLOW_UP_ENTRY"
        : "UPSERT_FOLLOW_UP_ENTRY",
      entityType: "AssessmentResponse",
      entityId: responseId,
      previousState: {
        followUpCount: Number(previousFollowUpCount[0]?.count || 0),
      },
      nextState: body,
      metadata: {
        assessmentPeriodId: response.assessmentPeriodId,
        entryCount: followUpStatus === "DONE" ? normalizedEntries.length : 0,
        followUpStatus,
        responseOwner: responseOwnedByBpkp ? "BPKP" : "BLUD",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Gagal menyimpan tindak lanjut." },
      { status: 500 },
    );
  }
}
