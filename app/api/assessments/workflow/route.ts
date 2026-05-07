import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AssessmentWorkflowSchema } from "@/lib/zod";
import { allowedNextStatuses, mapStatusLabel } from "@/lib/assessment";
import { canReview } from "@/lib/authz";
import { createAuditLog } from "@/lib/audit";

const BPKP_ROLES = ["BPKP", "BPKP_ADMIN", "BPKP_REVIEWER"];

function bludInputWhere() {
  return {
    OR: [
      { createdByRole: null },
      { createdByRole: "BLUD_OPERATOR" },
      { createdByRole: "BLUD_ADMIN" },
    ],
  };
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = AssessmentWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Payload workflow tidak valid.",
          errors: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { assessmentPeriodId, action, reviewerNotes, targetStatus } =
      parsed.data;

    /**
     * Scope sengaja dibaca dari raw body, bukan parsed.data.
     * Tujuannya agar tidak wajib mengubah AssessmentWorkflowSchema yang sudah berjalan.
     */
    const scope = String((body as any)?.scope || "MODULE").toUpperCase();

    const period = await prisma.assessmentPeriod.findUnique({
      where: { id: assessmentPeriodId },
      include: {
        responses: true,
      },
    });

    if (!period) {
      return NextResponse.json(
        { message: "Periode assessment tidak ditemukan." },
        { status: 404 },
      );
    }

    const role = String(session.user.role || "").toUpperCase();

    if (
      (role === "BLUD_OPERATOR" || role === "BLUD_ADMIN") &&
      period.bludId !== session.user.bludId
    ) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const nextAllowed = allowedNextStatuses(session.user.role, period.status);

    let nextStatus = targetStatus;

    if (!nextStatus) {
      if (action === "submit") nextStatus = "SUBMITTED";
      if (action === "start_review") nextStatus = "IN_REVIEW";
      if (action === "request_revision") nextStatus = "REVISION_REQUESTED";
      if (action === "approve") nextStatus = "APPROVED";
      if (action === "reject") nextStatus = "REJECTED";
    }

    const isBludAdminSubmitToBpkp =
      role === "BLUD_ADMIN" &&
      action === "submit" &&
      nextStatus === "SUBMITTED";

    const isBludAdminSubmitStatusAllowed =
      isBludAdminSubmitToBpkp &&
      ["SUBMITTED", "IN_REVIEW", "REVISION_REQUESTED"].includes(
        String(period.status || "").toUpperCase(),
      );

    const isBludOperatorSubmitToAdminBlud =
      role === "BLUD_OPERATOR" &&
      action === "submit" &&
      nextStatus === "SUBMITTED";

    const isBludOperatorSubmitStatusAllowed =
      isBludOperatorSubmitToAdminBlud &&
      ["DRAFT", "REVISION_REQUESTED"].includes(
        String(period.status || "").toUpperCase(),
      );

    if (
      !nextStatus ||
      (!nextAllowed.includes(nextStatus) &&
        !isBludAdminSubmitStatusAllowed &&
        !isBludOperatorSubmitStatusAllowed)
    ) {
      return NextResponse.json(
        {
          message: `Transisi status dari ${mapStatusLabel(period.status)} tidak diizinkan.`,
        },
        { status: 409 },
      );
    }

    if (
      (nextStatus === "REVISION_REQUESTED" || nextStatus === "REJECTED") &&
      !reviewerNotes?.trim()
    ) {
      return NextResponse.json(
        {
          message: "Catatan reviewer wajib diisi untuk revisi atau penolakan.",
        },
        { status: 400 },
      );
    }

    // Validasi bisnis tambahan sesuai flow
    if (action === "submit") {
      if (role === "BLUD_OPERATOR") {
        const MIN_REQUIRED_COMPLETED = 28;

        const completedCountAllModules = await prisma.assessmentResponse.count({
          where: {
            assessmentPeriod: {
              bludId: period.bludId,
              year: period.year,
            },
            ...bludInputWhere(),
          },
        });

        if (completedCountAllModules < MIN_REQUIRED_COMPLETED) {
          return NextResponse.json(
            {
              message: `Operator BLUD hanya dapat mengirim ke Admin BLUD setelah minimal ${MIN_REQUIRED_COMPLETED} parameter terisi. Saat ini baru ${completedCountAllModules} parameter terisi.`,
            },
            { status: 400 },
          );
        }

        const rejectedCountAllModules = await prisma.assessmentResponse.count({
          where: {
            assessmentPeriod: {
              bludId: period.bludId,
              year: period.year,
            },
            reviewStatus: "rejected",
            ...bludInputWhere(),
          },
        });

        if (rejectedCountAllModules > 0) {
          return NextResponse.json(
            {
              message:
                "Masih terdapat parameter yang direject dan harus diperbaiki terlebih dahulu.",
            },
            { status: 400 },
          );
        }
      }

      if (role === "BLUD_ADMIN") {
        const MIN_REQUIRED_ACCEPTED = 28;

        const acceptedCountAllModules = await prisma.assessmentResponse.count({
          where: {
            assessmentPeriod: {
              bludId: period.bludId,
              year: period.year,
            },
            reviewStatus: "accepted",
            ...bludInputWhere(),
          },
        });

        if (acceptedCountAllModules < MIN_REQUIRED_ACCEPTED) {
          return NextResponse.json(
            {
              message: `Admin BLUD hanya dapat mengirim ke BPKP setelah minimal ${MIN_REQUIRED_ACCEPTED} parameter di-accept. Saat ini baru ${acceptedCountAllModules} parameter accepted.`,
            },
            { status: 400 },
          );
        }
      }
    }

    if (action === "approve") {
      if (period.responses.length > 0) {
        const bludResponses = period.responses.filter((row) => {
          const createdByRole = String(
            row.createdByRole || "BLUD_OPERATOR",
          ).toUpperCase();
          return !BPKP_ROLES.includes(createdByRole);
        });

        const allAccepted = bludResponses.every(
          (row) => row.reviewStatus === "accepted",
        );

        if (!allAccepted) {
          return NextResponse.json(
            {
              message:
                "Assessment hanya dapat di-approve jika semua parameter sudah accepted.",
            },
            { status: 400 },
          );
        }
      }
    }

    const data: any = {
      status: nextStatus,
    };

    if (nextStatus === "SUBMITTED") {
      data.submittedAt = new Date();
      data.submittedById = session.user.id;
      data.reviewedAt = null;
      data.reviewedById = null;

      if (role === "BLUD_OPERATOR") {
        data.reviewerNotes = null;
      }
    }

    /**
     * Submit Operator BLUD dibuat global per BLUD + tahun.
     * Perubahan ini tidak mengubah flow role lain.
     */
    if (role === "BLUD_OPERATOR" && action === "submit" && scope === "GLOBAL") {
      const submittedAt = new Date();

      await prisma.assessmentPeriod.updateMany({
        where: {
          bludId: period.bludId,
          year: period.year,
        },
        data: {
          status: nextStatus,
          submittedAt,
          submittedById: session.user.id,
          reviewedAt: null,
          reviewedById: null,
          reviewerNotes: null,
        },
      });

      await prisma.assessmentResponse.updateMany({
        where: {
          assessmentPeriod: {
            bludId: period.bludId,
            year: period.year,
          },
          reviewStatus: {
            not: "accepted",
          },
          ...bludInputWhere(),
        },
        data: {
          reviewStatus: "pending",
        },
      });

      await createAuditLog({
        actorId: session.user.id,
        action: `ASSESSMENT_${nextStatus}_GLOBAL`,
        entityType: "AssessmentPeriod",
        entityId: assessmentPeriodId,
        previousState: {
          status: period.status,
          reviewerNotes: period.reviewerNotes,
        },
        nextState: {
          status: nextStatus,
          reviewerNotes: null,
          scope: "GLOBAL",
          year: period.year,
          bludId: period.bludId,
        },
        severity: "INFO",
      });

      return NextResponse.json({
        period: {
          id: period.id,
          status: nextStatus,
          statusLabel: mapStatusLabel(nextStatus),
          reviewerNotes: null,
          submittedAt,
          submittedToBpkpAt: null,
          reviewedAt: null,
        },
      });
    }

    /**
     * Submit Admin BLUD ke BPKP dibuat global per BLUD + tahun.
     *
     * Tujuan:
     * - Setelah Admin BLUD klik "Kirim ke BPKP" di salah satu aspek,
     *   semua assessmentPeriod pada BLUD + tahun yang sama ikut terkirim.
     * - Tombol "Kirim ke BPKP" hilang di semua aspek.
     * - Tombol Review ikut disabled karena frontend membaca submittedToBpkpAt global.
     *
     * Tidak mengubah flow lama:
     * - Berlaku hanya jika role BLUD_ADMIN, action submit, dan scope GLOBAL.
     * - Flow MODULE, approve, reject, request_revision, dan start_review tetap masuk logic lama di bawah.
     */
    if (role === "BLUD_ADMIN" && action === "submit" && scope === "GLOBAL") {
      const submittedAt = new Date();

      await prisma.assessmentPeriod.updateMany({
        where: {
          bludId: period.bludId,
          year: period.year,
        },
        data: {
          status: nextStatus,
          submittedAt,
          submittedById: session.user.id,
          reviewedAt: null,
          reviewedById: null,
        },
      });

      await createAuditLog({
        actorId: session.user.id,
        action: `ASSESSMENT_${nextStatus}_TO_BPKP_GLOBAL`,
        entityType: "AssessmentPeriod",
        entityId: assessmentPeriodId,
        previousState: {
          status: period.status,
          reviewerNotes: period.reviewerNotes,
        },
        nextState: {
          status: nextStatus,
          scope: "GLOBAL",
          year: period.year,
          bludId: period.bludId,
          submittedToBpkpAt: submittedAt,
        },
        severity: "INFO",
      });

      return NextResponse.json({
        period: {
          id: period.id,
          status: nextStatus,
          statusLabel: mapStatusLabel(nextStatus),
          reviewerNotes: period.reviewerNotes,
          submittedAt,
          submittedToBpkpAt: submittedAt,
          reviewedAt: null,
        },
      });
    }

    if (canReview(session.user.role)) {
      data.reviewedAt = new Date();
      data.reviewedById = session.user.id;
      if (reviewerNotes) data.reviewerNotes = reviewerNotes;
    }

    if (nextStatus === "APPROVED") {
      data.approvedAt = new Date();
    }

    if (nextStatus === "REJECTED") {
      data.rejectedAt = new Date();
    }

    if (nextStatus === "REVISION_REQUESTED") {
      data.reviewerNotes = reviewerNotes || period.reviewerNotes;
    }

    const updated = await prisma.assessmentPeriod.update({
      where: { id: assessmentPeriodId },
      data,
    });

    await createAuditLog({
      actorId: session.user.id,
      action: `ASSESSMENT_${nextStatus}`,
      entityType: "AssessmentPeriod",
      entityId: assessmentPeriodId,
      previousState: {
        status: period.status,
        reviewerNotes: period.reviewerNotes,
      },
      nextState: {
        status: updated.status,
        reviewerNotes: updated.reviewerNotes,
      },
      severity: nextStatus === "REJECTED" ? "WARNING" : "INFO",
    });

    return NextResponse.json({
      period: {
        id: updated.id,
        status: updated.status,
        statusLabel: mapStatusLabel(updated.status),
        reviewerNotes: updated.reviewerNotes,
        submittedAt: updated.submittedAt,
        submittedToBpkpAt:
          role === "BLUD_ADMIN" && action === "submit"
            ? updated.submittedAt
            : null,
        reviewedAt: updated.reviewedAt,
      },
    });
  } catch (error) {
    console.error("POST /api/assessments/workflow error:", error);
    return NextResponse.json(
      { message: "Gagal memproses workflow assessment." },
      { status: 500 },
    );
  }
}
