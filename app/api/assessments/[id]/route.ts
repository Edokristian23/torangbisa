import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canMutateAssessment, mapStatusLabel } from "@/lib/assessment";

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

function toSafeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isEvidenceRequired(criteriaScore: number) {
  return criteriaScore > 1;
}

const BPKP_ROLES = ["BPKP", "BPKP_ADMIN", "BPKP_REVIEWER"];

function isBpkpRole(role?: string | null) {
  return BPKP_ROLES.includes(String(role || "").toUpperCase());
}

function isBpkpOwnedResponse(createdByRole?: string | null) {
  return BPKP_ROLES.includes(String(createdByRole || "").toUpperCase());
}

function canUseExistingDocumentAcrossModules(role?: string | null) {
  const roleUpper = String(role || "").toUpperCase();

  return (
    roleUpper === "BLUD_OPERATOR" ||
    roleUpper === "BLUD_ADMIN" ||
    roleUpper === "BPKP" ||
    roleUpper === "BPKP_ADMIN" ||
    roleUpper === "BPKP_REVIEWER"
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const existingResponse = await prisma.assessmentResponse.findUnique({
      where: { id },
      include: {
        assessmentPeriod: true,
        documentLinks: {
          include: {
            document: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!existingResponse) {
      return NextResponse.json(
        { message: "Data assessment tidak ditemukan." },
        { status: 404 },
      );
    }

    const role = String(session.user.role || "").toUpperCase();
    const rowStatus = String(existingResponse.reviewStatus || "").toLowerCase();

    if (
      (role === "BLUD_OPERATOR" || role === "BLUD_ADMIN") &&
      existingResponse.assessmentPeriod.bludId !== session.user.bludId
    ) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const canEditNormal =
      canMutateAssessment(
        session.user.role,
        existingResponse.assessmentPeriod.status,
      ) ||
      (isBpkpRole(role) && isBpkpOwnedResponse(existingResponse.createdByRole));

    const hasRejectTrace =
      rowStatus === "rejected" ||
      (existingResponse.reviewNotes ?? "").trim() !== "";

    const canEditRevision = role === "BLUD_OPERATOR" && hasRejectTrace;

    if (!canEditNormal && !canEditRevision) {
      return NextResponse.json(
        {
          message: `Assessment dengan status ${mapStatusLabel(
            existingResponse.assessmentPeriod.status,
          )} tidak bisa diubah.`,
        },
        { status: 409 },
      );
    }

    const criteriaCode = String(body.criteriaCode || "").trim();
    const criteriaLabel = String(body.criteriaLabel || "").trim();
    const criteriaScore = Number(body.criteriaScore);
    const aoi = String(body.aoi || "");

    const removedDocumentIdsRaw: string[] = Array.isArray(
      body.removedDocumentIds,
    )
      ? body.removedDocumentIds.map((id) => String(id))
      : [];

    const removedDocumentIds: string[] = Array.from(
      new Set(removedDocumentIdsRaw),
    );

    const documentIdsRaw: string[] = Array.isArray(body.documentIds)
      ? body.documentIds.map((docId) => String(docId))
      : [];

    const documentIds: string[] = Array.from(new Set<string>(documentIdsRaw));

    if (!criteriaCode || !criteriaLabel || Number.isNaN(criteriaScore)) {
      return NextResponse.json(
        { message: "Payload update tidak lengkap." },
        { status: 400 },
      );
    }

    if (criteriaScore < 3 && !aoi.trim()) {
      return NextResponse.json(
        { message: "AOI wajib diisi untuk kriteria di bawah Level 3." },
        { status: 400 },
      );
    }

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
       * Fix existing document lintas modul/aspek untuk edit row.
       *
       * Sebelumnya dokumen hanya dianggap valid bila assessmentPeriodId sama
       * dengan periode module yang sedang diedit. Akibatnya saat user memilih
       * "Gunakan Dokumen Existing" dari module/aspek lain, PATCH
       * /api/assessments/[id] mengembalikan 400 walaupun dokumen masih milik
       * BLUD dan tahun yang sama.
       *
       * Aturan:
       * - BLUD_OPERATOR dan BLUD_ADMIN boleh memakai existing document lintas
       *   module/aspek selama masih dalam BLUD yang sama dan tahun yang sama.
       * - BPKP / BPKP_ADMIN / BPKP_REVIEWER boleh memakai existing document
       *   lintas module/aspek selama masih dalam BLUD yang sama dan tahun yang
       *   sama.
       *
       * Role lain tetap memakai validasi lama berbasis assessmentPeriodId
       * current module agar fungsi lain yang sudah berjalan tidak terganggu.
       */
      const allowExistingDocumentAcrossModules =
        canUseExistingDocumentAcrossModules(role);

      validDocuments = await prisma.assessmentDocument.findMany({
        where: {
          id: { in: documentIds },
          ...(allowExistingDocumentAcrossModules
            ? {
                assessmentPeriod: {
                  bludId: existingResponse.assessmentPeriod.bludId,
                  year: existingResponse.assessmentPeriod.year,
                },
              }
            : {
                assessmentPeriodId: existingResponse.assessmentPeriodId,
              }),
        },
        select: { id: true },
      });

      if (validDocuments.length !== documentIds.length) {
        return NextResponse.json(
          {
            message: allowExistingDocumentAcrossModules
              ? "Sebagian dokumen tidak valid untuk BLUD dan tahun assessment ini."
              : "Sebagian dokumen tidak valid untuk periode assessment ini.",
          },
          { status: 400 },
        );
      }
    }

    const existingDocumentIds: string[] = existingResponse.documentLinks.map(
      (link) => String(link.document.id),
    );

    const previousDocuments = toSafeJson(
      serializeDocuments(
        existingResponse.documentLinks,
        existingResponse.parameterLabel,
      ),
    );

    const updated = await prisma.$transaction(async (tx) => {
      const toDelete: string[] = existingDocumentIds.filter(
        (existingId) =>
          !documentIds.includes(existingId) ||
          removedDocumentIds.includes(existingId),
      );

      const toAdd: string[] = documentIds.filter(
        (incomingId) => !existingDocumentIds.includes(incomingId),
      );

      if (toDelete.length > 0) {
        await tx.assessmentResponseDocument.deleteMany({
          where: {
            responseId: existingResponse.id,
            documentId: { in: toDelete },
          },
        });

        for (const docId of toDelete) {
          const responseLinksCount = await tx.assessmentResponseDocument.count({
            where: { documentId: docId },
          });

          const followUpLinksCount = await tx.followUpEntryDocument.count({
            where: { documentId: docId },
          });

          const totalRelations = responseLinksCount + followUpLinksCount;

          if (totalRelations === 0) {
            await tx.assessmentDocument.delete({
              where: { id: docId },
            });
          }
        }
      }

      if (toAdd.length > 0) {
        await tx.assessmentResponseDocument.createMany({
          data: toAdd.map((docId: string) => ({
            responseId: existingResponse.id,
            documentId: docId,
          })),
          skipDuplicates: true,
        });
      }

      const result = await tx.assessmentResponse.update({
        where: { id: existingResponse.id },
        data: {
          criteriaCode,
          criteriaLabel,
          criteriaScore,
          aoi,

          reviewStatus: canEditRevision
            ? "pending"
            : existingResponse.reviewStatus,
          reviewNotes: existingResponse.reviewNotes,
          reviewedAt: existingResponse.reviewedAt,

          isRevision: canEditRevision
            ? true
            : (existingResponse.isRevision ?? false),
          revisionNumber: canEditRevision
            ? (existingResponse.revisionNumber ?? 0) + 1
            : existingResponse.revisionNumber,
          previousCriteriaCode: canEditRevision
            ? existingResponse.criteriaCode
            : existingResponse.previousCriteriaCode,
          previousCriteriaLabel: canEditRevision
            ? existingResponse.criteriaLabel
            : existingResponse.previousCriteriaLabel,
          previousCriteriaScore: canEditRevision
            ? existingResponse.criteriaScore
            : existingResponse.previousCriteriaScore,
          previousAoi: canEditRevision
            ? existingResponse.aoi
            : existingResponse.previousAoi,
          previousDocuments: canEditRevision
            ? previousDocuments
            : existingResponse.previousDocuments,
        },
        include: {
          documentLinks: {
            include: {
              document: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      return result;
    });

    return NextResponse.json({
      row: {
        id: updated.id,
        parameterId: updated.parameterId,
        parameter: updated.parameterLabel,
        criteriaCode: updated.criteriaCode,
        criteriaLabel: updated.criteriaLabel,
        criteriaScore: Number(updated.criteriaScore),
        aoi: updated.aoi,
        documents: serializeDocuments(
          updated.documentLinks,
          updated.parameterLabel,
        ),
        createdByRole: updated.createdByRole || "BLUD_OPERATOR",
        createdByName: updated.createdByName || null,
        reviewStatus: updated.reviewStatus || "pending",
        reviewNotes: updated.reviewNotes || null,
        reviewedAt: updated.reviewedAt || null,
        isRevision: Boolean(updated.isRevision ?? false),
        revisionNumber: updated.revisionNumber ?? null,
        lastRejectedAt: null,
        lastRejectedByName: null,
        previousCriteriaCode: updated.previousCriteriaCode || null,
        previousCriteriaLabel: updated.previousCriteriaLabel || null,
        previousCriteriaScore:
          updated.previousCriteriaScore !== null &&
          updated.previousCriteriaScore !== undefined
            ? Number(updated.previousCriteriaScore)
            : null,
        previousAoi: updated.previousAoi || null,
        previousDocuments: Array.isArray(updated.previousDocuments)
          ? updated.previousDocuments
          : [],
      },
    });
  } catch (error) {
    console.error("PATCH /api/assessments/[id] error:", error);
    return NextResponse.json(
      {
        message: "Gagal memperbarui assessment.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const existingResponse = await prisma.assessmentResponse.findUnique({
      where: { id },
      include: {
        assessmentPeriod: true,
        documentLinks: {
          include: {
            document: true,
          },
        },
      },
    });

    if (!existingResponse) {
      return NextResponse.json(
        { message: "Data assessment tidak ditemukan." },
        { status: 404 },
      );
    }

    const role = String(session.user.role || "").toUpperCase();

    if (
      (role === "BLUD_OPERATOR" || role === "BLUD_ADMIN") &&
      existingResponse.assessmentPeriod.bludId !== session.user.bludId
    ) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const canEdit =
      canMutateAssessment(
        session.user.role,
        existingResponse.assessmentPeriod.status,
      ) ||
      (isBpkpRole(role) && isBpkpOwnedResponse(existingResponse.createdByRole));

    const rowStatus = String(existingResponse.reviewStatus || "").toLowerCase();
    const hasRejectTrace =
      rowStatus === "rejected" ||
      (existingResponse.reviewNotes ?? "").trim() !== "";
    const canDeleteRevision = role === "BLUD_OPERATOR" && hasRejectTrace;

    if (!canEdit && !canDeleteRevision) {
      return NextResponse.json(
        {
          message: `Assessment dengan status ${mapStatusLabel(
            existingResponse.assessmentPeriod.status,
          )} tidak bisa dihapus.`,
        },
        { status: 409 },
      );
    }

    const affectedDocuments = existingResponse.documentLinks.map((link) => ({
      id: link.document.id,
      name: link.document.name,
      isMaster: Boolean(link.document.isMaster),
    }));

    const result = await prisma.$transaction(async (tx) => {
      await tx.assessmentResponseDocument.deleteMany({
        where: { responseId: id },
      });

      await tx.assessmentResponse.delete({
        where: { id },
      });

      const deletedDocumentIds: string[] = [];
      const keptBecauseStillRelated: Array<{
        documentId: string;
        responseLinks: number;
        followUpLinks: number;
      }> = [];

      for (const doc of affectedDocuments) {
        const responseLinksCount = await tx.assessmentResponseDocument.count({
          where: { documentId: doc.id },
        });

        const followUpLinksCount = await tx.followUpEntryDocument.count({
          where: { documentId: doc.id },
        });

        const totalRelations = responseLinksCount + followUpLinksCount;

        if (totalRelations > 0) {
          keptBecauseStillRelated.push({
            documentId: doc.id,
            responseLinks: responseLinksCount,
            followUpLinks: followUpLinksCount,
          });
          continue;
        }

        // orphan => selalu hapus, meskipun isMaster = true
        await tx.assessmentDocument.delete({
          where: { id: doc.id },
        });

        deletedDocumentIds.push(doc.id);
      }

      return {
        deletedDocumentIds,
        keptBecauseStillRelated,
      };
    });

    return NextResponse.json({
      message: "Assessment berhasil dihapus.",
      documentsCleanup: {
        deletedDocumentIds: result.deletedDocumentIds,
        keptBecauseStillRelated: result.keptBecauseStillRelated,
      },
    });
  } catch (error) {
    console.error("DELETE /api/assessments/[id] error:", error);
    return NextResponse.json(
      {
        message: "Gagal menghapus assessment.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
