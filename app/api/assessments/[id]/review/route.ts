import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

async function assertReviewAccess(responseId: string, session: any) {
  const response = await prisma.assessmentResponse.findUnique({
    where: { id: responseId },
    include: {
      assessmentPeriod: true,
    },
  });

  if (!response) {
    return {
      error: NextResponse.json(
        { message: "Data assessment tidak ditemukan." },
        { status: 404 },
      ),
    };
  }

  const role = String(session.user.role || "").toUpperCase();
  const periodStatus = String(
    response.assessmentPeriod.status || "",
  ).toUpperCase();

  if (role === "BLUD_ADMIN") {
    if (response.assessmentPeriod.bludId !== session.user.bludId) {
      return {
        error: NextResponse.json({ message: "Forbidden" }, { status: 403 }),
      };
    }

    if (
      !["SUBMITTED", "IN_REVIEW", "REVISION_REQUESTED"].includes(periodStatus)
    ) {
      return {
        error: NextResponse.json(
          { message: "Assessment belum berada pada tahap review Admin BLUD." },
          { status: 409 },
        ),
      };
    }

    return { response };
  }

  if (role === "BPKP" || role === "BPKP_ADMIN" || role === "BPKP_REVIEWER") {
    if (
      !["SUBMITTED", "IN_REVIEW", "REVISION_REQUESTED"].includes(periodStatus)
    ) {
      return {
        error: NextResponse.json(
          { message: "Assessment belum berada pada tahap review BPKP." },
          { status: 409 },
        ),
      };
    }

    return { response };
  }

  return {
    error: NextResponse.json(
      { message: "Role ini tidak memiliki akses review." },
      { status: 403 },
    ),
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const { response, error } = await assertReviewAccess(id, session);

    if (error) return error;
    if (!response) {
      return NextResponse.json(
        { message: "Data assessment tidak ditemukan." },
        { status: 404 },
      );
    }

    const body = await request.json();
    const action = String(body?.action || "")
      .trim()
      .toLowerCase();
    const reason = String(body?.reason || "").trim();

    if (!["accept", "reject"].includes(action)) {
      return NextResponse.json(
        { message: "Action review tidak valid." },
        { status: 400 },
      );
    }

    if (action === "reject" && !reason) {
      return NextResponse.json(
        { message: "Alasan reject wajib diisi." },
        { status: 400 },
      );
    }

    const role = String(session.user.role || "").toUpperCase();
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const updatedResponse = await tx.assessmentResponse.update({
        where: { id },
        data: {
          reviewStatus: action === "accept" ? "accepted" : "rejected",
          reviewNotes:
            action === "reject" ? reason : (response.reviewNotes ?? null),
          reviewedAt: now,
          reviewedBy: {
            connect: { id: session.user.id },
          },
        },
      });

      if (action === "reject") {
        await tx.assessmentPeriod.update({
          where: { id: response.assessmentPeriod.id },
          data: {
            status: "REVISION_REQUESTED",
            reviewerNotes: reason,
            reviewedAt: now,
            reviewedById: session.user.id,
          },
        });
      } else {
        await tx.assessmentPeriod.update({
          where: { id: response.assessmentPeriod.id },
          data: {
            status: "IN_REVIEW",
            reviewedAt: now,
            reviewedById: session.user.id,
          },
        });
      }

      return updatedResponse;
    });

    await createAuditLog({
      actorId: session.user.id,
      action:
        action === "accept"
          ? "ACCEPT_ASSESSMENT_RESPONSE"
          : "REJECT_ASSESSMENT_RESPONSE",
      entityType: "AssessmentResponse",
      entityId: id,
      previousState: {
        reviewStatus: response.reviewStatus || null,
        reviewNotes: response.reviewNotes || null,
        periodStatus: response.assessmentPeriod.status || null,
      },
      nextState: {
        reviewStatus: updated.reviewStatus,
        reviewNotes: updated.reviewNotes,
        reviewedAt: updated.reviewedAt,
        reviewedById: updated.reviewedById,
        periodStatus: action === "reject" ? "REVISION_REQUESTED" : "IN_REVIEW",
        reviewerRole: role,
      },
      severity: action === "reject" ? "WARNING" : "INFO",
    });

    return NextResponse.json({
      success: true,
      message:
        action === "accept"
          ? "Assessment berhasil di-accept."
          : "Assessment berhasil di-reject.",
      reviewStatus: updated.reviewStatus,
      reviewNotes: updated.reviewNotes,
      reviewedAt: updated.reviewedAt,
      periodStatus: action === "reject" ? "REVISION_REQUESTED" : "IN_REVIEW",
    });
  } catch (error) {
    console.error("POST /api/assessments/[id]/review error:", error);
    return NextResponse.json(
      { message: "Gagal memproses review assessment." },
      { status: 500 },
    );
  }
}
