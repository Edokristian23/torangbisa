// app/api/documents/rollback-temporary/route.ts

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const documentIds: string[] = Array.isArray(body.documentIds)
      ? Array.from(new Set(body.documentIds.map((id: unknown) => String(id))))
      : [];

    if (documentIds.length === 0) {
      return NextResponse.json({ deletedDocumentIds: [] });
    }

    const documents = await prisma.assessmentDocument.findMany({
      where: {
        id: { in: documentIds },
        uploadedById: session.user.id, // ✅ FIX
      },
      select: {
        id: true,
      },
    });

    const deletedDocumentIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const doc of documents) {
        const responseLinksCount = await tx.assessmentResponseDocument.count({
          where: { documentId: doc.id },
        });

        const followUpLinksCount = await tx.followUpEntryDocument.count({
          where: { documentId: doc.id },
        });

        if (responseLinksCount + followUpLinksCount > 0) continue;

        const deleted = await tx.assessmentDocument.deleteMany({
          where: {
            id: doc.id,
            uploadedById: session.user.id, // ✅ FIX
          },
        });

        if (deleted.count > 0) {
          deletedDocumentIds.push(doc.id);
        }
      }
    });

    return NextResponse.json({ deletedDocumentIds });
  } catch (error) {
    console.error("POST /api/documents/rollback-temporary error:", error);

    return NextResponse.json(
      { message: "Gagal rollback dokumen temporary." },
      { status: 500 },
    );
  }
}
