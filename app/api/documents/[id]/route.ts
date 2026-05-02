import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  buildDocumentDownloadHeaders,
  isInlinePreviewable,
} from "@/lib/storage";
import { createAuditLog } from "@/lib/audit";
import { canMutateAssessment, mapStatusLabel } from "@/lib/assessment";

const ADMIN_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.BPKP_ADMIN,
  UserRole.BPKP_REVIEWER,
  UserRole.AUDITOR,
];

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;

  const document = await prisma.assessmentDocument.findUnique({
    where: { id },
    include: { assessmentPeriod: true },
  });

  if (!document) {
    return new NextResponse("Document not found", { status: 404 });
  }

  const role = session.user.role as UserRole;
  const isAdmin = ADMIN_ROLES.includes(role);

  if (!isAdmin && document.assessmentPeriod.bludId !== session.user.bludId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  await createAuditLog({
    actorId: session.user.id,
    action: "READ_DOCUMENT",
    entityType: "AssessmentDocument",
    entityId: document.id,
    metadata: {
      source: "DATABASE",
      inlinePreviewable: isInlinePreviewable(document.mimeType),
      method: request.method,
    },
  });

  return new NextResponse(document.fileData, {
    status: 200,
    headers: buildDocumentDownloadHeaders({
      mimeType: document.mimeType,
      originalName: document.originalName,
      fileSize: document.fileSize,
    }),
  });
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
    const body = await request.json().catch(() => ({}));

    const responseId =
      typeof body?.responseId === "string" && body.responseId.trim()
        ? body.responseId.trim()
        : null;

    const followUpEntryId =
      typeof body?.followUpEntryId === "string" && body.followUpEntryId.trim()
        ? body.followUpEntryId.trim()
        : null;

    const document = await prisma.assessmentDocument.findUnique({
      where: { id },
      include: {
        assessmentPeriod: true,
        responseLinks: true,
        followUpLinks: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { message: "Dokumen tidak ditemukan." },
        { status: 404 },
      );
    }

    const role = session.user.role as UserRole;
    const isAdmin = ADMIN_ROLES.includes(role);

    if (!isAdmin && document.assessmentPeriod.bludId !== session.user.bludId) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const canEdit = canMutateAssessment(role, document.assessmentPeriod.status);
    if (!canEdit) {
      return NextResponse.json(
        {
          message: `Dokumen tidak dapat dihapus karena assessment sedang berstatus ${mapStatusLabel(
            document.assessmentPeriod.status,
          )}.`,
        },
        { status: 409 },
      );
    }

    /**
     * VALIDASI KHUSUS: jika delete dari response tertentu,
     * pastikan dokumen ini memang terhubung ke response tersebut,
     * lalu cek apakah setelah dihapus evidence masih tersisa.
     */
    if (responseId) {
      const response = await prisma.assessmentResponse.findUnique({
        where: { id: responseId },
        include: {
          documentLinks: true,
        },
      });

      console.log("DELETE validation", {
        documentId: id,
        responseId,
        criteriaScore: response?.criteriaScore,
        documentLinksCount: response?.documentLinks?.length,
        documentLinks: response?.documentLinks?.map((link) => ({
          documentId: link.documentId,
          responseId: link.responseId,
        })),
      });

      if (!response) {
        return NextResponse.json(
          { message: "Response assessment tidak ditemukan." },
          { status: 404 },
        );
      }

      const isLinkedToResponse = response.documentLinks.some(
        (link) => link.documentId === id,
      );

      if (!isLinkedToResponse) {
        return NextResponse.json(
          {
            message:
              "Dokumen ini tidak terhubung ke parameter assessment yang sedang diedit. Silakan refresh data lalu coba lagi.",
          },
          { status: 409 },
        );
      }

      const remainingLinksAfterDelete = response.documentLinks.filter(
        (link) => link.documentId !== id,
      ).length;

      const isLastRequiredEvidence =
        Number(response.criteriaScore) > 2 && remainingLinksAfterDelete < 1;

      if (isLastRequiredEvidence) {
        return NextResponse.json(
          {
            message:
              "Minimal 1 evidence wajib ada karena skor parameter lebih dari 2.",
          },
          { status: 409 },
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let removedResponseLinks = 0;
      let removedFollowUpLinks = 0;

      const isRelationDeleteMode = Boolean(responseId || followUpEntryId);

      if (isRelationDeleteMode) {
        if (responseId) {
          const deleted = await tx.assessmentResponseDocument.deleteMany({
            where: {
              documentId: document.id,
              responseId,
            },
          });

          removedResponseLinks = deleted.count;
        }

        if (followUpEntryId) {
          const deleted = await tx.followUpEntryDocument.deleteMany({
            where: {
              documentId: document.id,
              followUpEntryId,
            },
          });

          removedFollowUpLinks = deleted.count;
        }
      } else {
        const deletedResponse = await tx.assessmentResponseDocument.deleteMany({
          where: {
            documentId: document.id,
          },
        });

        const deletedFollowUp = await tx.followUpEntryDocument.deleteMany({
          where: {
            documentId: document.id,
          },
        });

        removedResponseLinks = deletedResponse.count;
        removedFollowUpLinks = deletedFollowUp.count;
      }

      const remainingResponseLinks = await tx.assessmentResponseDocument.count({
        where: { documentId: document.id },
      });

      const remainingFollowUpLinks = await tx.followUpEntryDocument.count({
        where: { documentId: document.id },
      });

      const remainingResponseLinkDetails =
        await tx.assessmentResponseDocument.findMany({
          where: { documentId: document.id },
          select: {
            responseId: true,
            documentId: true,
            createdAt: true,
          },
        });

      const remainingFollowUpLinkDetails =
        await tx.followUpEntryDocument.findMany({
          where: { documentId: document.id },
          select: {
            followUpEntryId: true,
            documentId: true,
            createdAt: true,
          },
        });

      const stillUsed =
        remainingResponseLinks > 0 || remainingFollowUpLinks > 0;

      const shouldDeleteMaster = !stillUsed;

      if (shouldDeleteMaster) {
        await tx.assessmentDocument.delete({
          where: { id: document.id },
        });
      }

      return {
        removedResponseLinks,
        removedFollowUpLinks,
        remainingResponseLinks,
        remainingFollowUpLinks,
        remainingResponseLinkDetails,
        remainingFollowUpLinkDetails,
        deletedMasterDocument: shouldDeleteMaster,
        wasRelationDeleteMode: isRelationDeleteMode,
      };
    });

    try {
      await createAuditLog({
        actorId: session.user.id,
        action: result.deletedMasterDocument
          ? "DELETE_DOCUMENT"
          : "UNLINK_DOCUMENT",
        entityType: "AssessmentDocument",
        entityId: document.id,
        previousState: {
          id: document.id,
          assessmentPeriodId: document.assessmentPeriodId,
          uploadedById: document.uploadedById,
          sourceParameter: document.sourceParameter,
          name: document.name,
          originalName: document.originalName,
          mimeType: document.mimeType,
          fileExtension: document.fileExtension,
          fileSize: document.fileSize,
          storageProvider: document.storageProvider,
          checksumSha256: document.checksumSha256,
        },
        metadata: {
          source: "DATABASE",
          method: request.method,
          responseId,
          followUpEntryId,
          removedResponseLinks: result.removedResponseLinks,
          removedFollowUpLinks: result.removedFollowUpLinks,
          remainingResponseLinks: result.remainingResponseLinks,
          remainingFollowUpLinks: result.remainingFollowUpLinks,
          remainingResponseLinkDetails: result.remainingResponseLinkDetails,
          remainingFollowUpLinkDetails: result.remainingFollowUpLinkDetails,
          deletedMasterDocument: result.deletedMasterDocument,
          wasRelationDeleteMode: result.wasRelationDeleteMode,
        },
      });
    } catch (auditError) {
      console.error("DELETE document audit log failed:", auditError);
    }

    return NextResponse.json({
      success: true,
      message: result.deletedMasterDocument
        ? "Dokumen berhasil dihapus dari database karena tidak memiliki relasi."
        : "Dokumen berhasil dilepas dari relasi, tetapi tetap tersimpan karena masih dipakai di tempat lain.",
      deletedMasterDocument: result.deletedMasterDocument,
      removedResponseLinks: result.removedResponseLinks,
      removedFollowUpLinks: result.removedFollowUpLinks,
      remainingResponseLinks: result.remainingResponseLinks,
      remainingFollowUpLinks: result.remainingFollowUpLinks,
      remainingResponseLinkDetails: result.remainingResponseLinkDetails,
      remainingFollowUpLinkDetails: result.remainingFollowUpLinkDetails,
    });
  } catch (error) {
    console.error("DELETE /api/documents/[id] error:", error);

    return NextResponse.json(
      {
        message: "Gagal menghapus dokumen.",
        error: error instanceof Error ? error.message : "Unknown error",
        stack:
          process.env.NODE_ENV !== "production" && error instanceof Error
            ? error.stack
            : undefined,
      },
      { status: 500 },
    );
  }
}