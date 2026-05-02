import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 },
      );
    }

    const role = String(session.user.role || "").toUpperCase();
    const bludId = session.user.bludId || null;

    if (role !== "BLUD_OPERATOR") {
      return NextResponse.json({
        totalRejected: 0,
        rows: [],
      });
    }

    if (!bludId) {
      return NextResponse.json({
        totalRejected: 0,
        rows: [],
      });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const year = yearParam ? Number(yearParam) : null;

    if (yearParam && (!year || Number.isNaN(year))) {
      return NextResponse.json(
        { message: "Parameter year tidak valid." },
        { status: 400 },
      );
    }

    const rejectedResponses = await prisma.assessmentResponse.findMany({
      where: {
        reviewStatus: "rejected",
        assessmentPeriod: {
          bludId,
          ...(year ? { year } : {}),
        },
      },
      select: {
        id: true,
        parameterId: true,
        parameterLabel: true,
        reviewNotes: true,
        reviewedAt: true,
        assessmentPeriod: {
          select: {
            year: true,
            moduleKey: true,
          },
        },
      },
      orderBy: [
        {
          assessmentPeriod: {
            year: "desc",
          },
        },
        {
          parameterId: "asc",
        },
      ],
    });

    const rows = rejectedResponses.map((item) => ({
      id: item.id,
      parameterId: item.parameterId,
      parameter: item.parameterLabel,
      reviewNotes: item.reviewNotes || null,
      reviewedAt: item.reviewedAt ? item.reviewedAt.toISOString() : null,
      moduleKey: item.assessmentPeriod.moduleKey,
      year: item.assessmentPeriod.year,
    }));

    return NextResponse.json({
      totalRejected: rows.length,
      rows,
    });
  } catch (error) {
    console.error("GET /api/assessments/rejected-summary error:", error);

    return NextResponse.json(
      {
        message: "Gagal memuat ringkasan reject.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}