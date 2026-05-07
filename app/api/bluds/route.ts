import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/authz";

function isBpkpRole(role?: string | null) {
  const roleUpper = String(role || "").toUpperCase();
  return (
    roleUpper === "BPKP" ||
    roleUpper === "BPKP_ADMIN" ||
    roleUpper === "BPKP_REVIEWER"
  );
}

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const role = String(session.user.role || "");
    const roleUpper = role.toUpperCase();
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const year = yearParam ? Number(yearParam) : null;

    if (yearParam && (!year || Number.isNaN(year))) {
      return NextResponse.json(
        { message: "Parameter year tidak valid." },
        { status: 400 },
      );
    }

    if (isBpkpRole(role) || isAdminRole(session.user.role)) {
      const rows = await prisma.blud.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          region: true,
        },
        orderBy: [{ code: "asc" }, { name: "asc" }],
      });

      return NextResponse.json({
        userRole: roleUpper,
        canSelectBlud: true,
        rows,
        bluds: rows,
      });
    }

    if (roleUpper === "BLUD_ADMIN" || roleUpper === "BLUD_OPERATOR") {
      if (!session.user.bludId) {
        return NextResponse.json({
          userRole: roleUpper,
          canSelectBlud: false,
          rows: [],
        });
      }

      const blud = await prisma.blud.findUnique({
        where: { id: session.user.bludId },
        select: {
          id: true,
          code: true,
          name: true,
          region: true,
        },
      });

      return NextResponse.json({
        userRole: roleUpper,
        canSelectBlud: false,
        rows: blud ? [blud] : [],
      });
    }

    return NextResponse.json({
      userRole: roleUpper,
      canSelectBlud: false,
      rows: [],
    });
  } catch (error) {
    console.error("GET /api/bluds error:", error);
    return NextResponse.json(
      {
        message: "Gagal memuat daftar BLUD.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
