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

type RawFollowUp = {
  id: string;
  assessmentResponseId: string;
  description: string;
  sortOrder: number;
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
  return role === "BLUD_ADMIN";
}

function canManageFollowUps(role?: string | null) {
  // BLUD_ADMIN hanya review. Role lain mengikuti permission existing.
  return !isBludAdminReviewOnly(role);
}

function forbiddenReviewOnlyResponse() {
  return NextResponse.json(
    {
      message:
        "Role Admin BLUD hanya dapat melakukan review tindak lanjut AOI.",
    },
    { status: 403 },
  );
}

async function resolveBludContext(session: any, request: Request) {
  if (isAdminRole(session?.user?.role)) {
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
    const blud = await resolveBludContext(session, request);

    if (!year || !blud?.id) {
      return NextResponse.json(
        { message: "Parameter tidak lengkap." },
        { status: 400 },
      );
    }

    const responses = await prisma.$queryRaw<RawResponse[]>`
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
        AND NULLIF(TRIM(ar."aoi"), '') IS NOT NULL
      ORDER BY ap."moduleKey" ASC, ar."sortOrder" ASC, ar."parameterId" ASC
    `;

    const followUps = await prisma.$queryRaw<RawFollowUp[]>`
      SELECT
        fu."id",
        fu."assessmentResponseId",
        fu."description",
        fu."sortOrder"
      FROM "FollowUpEntry" fu
      INNER JOIN "AssessmentResponse" ar ON ar."id" = fu."assessmentResponseId"
      INNER JOIN "AssessmentPeriod" ap ON ap."id" = ar."assessmentPeriodId"
      WHERE ap."year" = ${year}
        AND ap."bludId" = ${blud.id}
      ORDER BY fu."sortOrder" ASC, fu."createdAt" ASC
    `;

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
         WHERE fud."followUpEntryId" IN (${followUpIds.map((id) => `'${id}'`).join(",")})`,
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
        documents: ReturnType<typeof serializeDocument>[];
      }>
    >();
    for (const entry of followUps) {
      const list = followUpsByResponseId.get(entry.assessmentResponseId) || [];
      list.push({
        id: entry.id,
        description: entry.description,
        sortOrder: entry.sortOrder,
        documents: documentsByFollowUpId.get(entry.id) || [],
      });
      followUpsByResponseId.set(entry.assessmentResponseId, list);
    }

    const items = responses.map((row) => {
      const rowFollowUps = followUpsByResponseId.get(row.id) || [];
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
        isCompleted: rowFollowUps.length > 0,
        followUpCount: rowFollowUps.length,
        followUps: rowFollowUps,
      };
    });

    return NextResponse.json({
      blud: { id: blud.id, code: blud.code, name: blud.name },
      summary: {
        totalAoi: items.length,
        completedAoi: items.filter((item) => item.isCompleted).length,
        pendingAoi: items.filter((item) => !item.isCompleted).length,
        totalFollowUps: items.reduce(
          (sum, item) => sum + item.followUpCount,
          0,
        ),
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

    if (!responseId || entries.length === 0) {
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

    if (
      !isAdminRole(session.user.role) &&
      response.assessmentPeriod.bludId !== session.user.bludId
    ) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const normalizedEntries = entries
      .map((entry: any, index: number) => ({
        description: String(entry.description || "").trim(),
        documentIds: Array.isArray(entry.documentIds)
          ? entry.documentIds.map(String)
          : [],
        sortOrder: index + 1,
      }))
      .filter((entry: any) => entry.description);

    if (normalizedEntries.length === 0) {
      return NextResponse.json(
        { message: "Minimal satu uraian tindak lanjut wajib diisi." },
        { status: 400 },
      );
    }

    const documentIds = normalizedEntries.flatMap(
      (entry: any) => entry.documentIds,
    );
    if (documentIds.length > 0) {
      const validDocuments = await prisma.assessmentDocument.findMany({
        where: {
          id: { in: documentIds },
          assessmentPeriodId: response.assessmentPeriodId,
        },
        select: { id: true },
      });

      if (validDocuments.length !== documentIds.length) {
        return NextResponse.json(
          {
            message:
              "Sebagian evidence tidak valid untuk periode assessment ini.",
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

      for (const entry of normalizedEntries) {
        const followUpEntryId = randomUUID();
        await tx.$executeRaw`
          INSERT INTO "FollowUpEntry" ("id", "assessmentResponseId", "description", "sortOrder", "createdById", "createdAt", "updatedAt")
          VALUES (${followUpEntryId}, ${responseId}, ${entry.description}, ${entry.sortOrder}, ${session.user.id}, NOW(), NOW())
        `;

        for (const documentId of entry.documentIds) {
          await tx.$executeRaw`
            INSERT INTO "FollowUpEntryDocument" ("followUpEntryId", "documentId", "createdAt")
            VALUES (${followUpEntryId}, ${documentId}, NOW())
          `;
        }
      }
    });

    await createAuditLog({
      actorId: session.user.id,
      action: "UPSERT_FOLLOW_UP_ENTRY",
      entityType: "AssessmentResponse",
      entityId: responseId,
      previousState: {
        followUpCount: Number(previousFollowUpCount[0]?.count || 0),
      },
      nextState: body,
      metadata: {
        assessmentPeriodId: response.assessmentPeriodId,
        entryCount: normalizedEntries.length,
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
