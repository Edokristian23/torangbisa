import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashBuffer } from "@/lib/storage";
import { createAuditLog } from "@/lib/audit";
import { isAdminRole } from "@/lib/authz";

const ALLOWED_EXTENSIONS = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "doc",
  "docx",
  "xls",
  "xlsx",
];
const MAX_FILE_SIZE = 1 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);
    const responseId = String(formData.get("responseId") || "");
    const customName = String(formData.get("customName") || "").trim();

    if (!responseId || !customName || files.length === 0) {
      return NextResponse.json(
        { message: "Data upload evidence tidak lengkap." },
        { status: 400 },
      );
    }

    const response = await prisma.assessmentResponse.findUnique({
      where: { id: responseId },
      include: { assessmentPeriod: { include: { blud: true } } },
    });

    if (!response) {
      return NextResponse.json(
        { message: "AOI tidak ditemukan." },
        { status: 404 },
      );
    }

    if (
      !isAdminRole(session.user.role) &&
      response.assessmentPeriod.bludId !== session.user.bludId
    ) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const uploadedDocs = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const extension = file.name.split(".").pop()?.toLowerCase() || "";

      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        return NextResponse.json(
          { message: `Format file ${file.name} tidak diizinkan.` },
          { status: 400 },
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
        return NextResponse.json(
          { message: `Ukuran file ${file.name} melebihi 1MB.` },
          { status: 400 },
        );
      }

      const buffer = Buffer.from(arrayBuffer);
      const checksumSha256 = hashBuffer(buffer);
      const displayName =
        files.length > 1 ? `${customName} ${index + 1}` : customName;

      /**
       * Aturan duplikat disamakan dengan upload dokumen assessment:
       * - nama dokumen input saat ini (customName) tidak boleh sama
       * - nama final yang akan disimpan (displayName) tidak boleh sama
       * - nama file asli juga tidak boleh sama
       */
      const existingDocument = await prisma.assessmentDocument.findFirst({
        where: {
          assessmentPeriodId: response.assessmentPeriodId,
          OR: [
            { name: customName },
            { name: displayName },
            { originalName: file.name },
          ],
        },
      });

      if (existingDocument) {
        return NextResponse.json(
          {
            conflict: true,
            message: "Dokumen dengan nama atau file yang sama sudah ada.",
            existingDocument: {
              id: existingDocument.id,
              name: existingDocument.name,
              originalName: existingDocument.originalName,
              url: `/api/documents/${existingDocument.id}`,
              type: existingDocument.mimeType,
              sourceParameter: existingDocument.sourceParameter,
              fileExtension: existingDocument.fileExtension,
              isPersisted: true,
            },
          },
          { status: 409 },
        );
      }

      const document = await prisma.assessmentDocument.create({
        data: {
          assessmentPeriodId: response.assessmentPeriodId,
          uploadedById: session.user.id,
          sourceParameter: `TL Evidence - ${response.parameterLabel}`,
          name: displayName,
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileExtension: extension,
          fileSize: arrayBuffer.byteLength,
          storageProvider: "DATABASE",
          checksumSha256,
          fileData: buffer,
        },
      });

      await createAuditLog({
        actorId: session.user.id,
        action: "UPLOAD_FOLLOW_UP_EVIDENCE",
        entityType: "AssessmentDocument",
        entityId: document.id,
        metadata: {
          assessmentResponseId: responseId,
          checksumSha256,
          fileSize: document.fileSize,
        },
      });

      uploadedDocs.push({
        id: document.id,
        name: document.name,
        originalName: document.originalName,
        url: `/api/documents/${document.id}`,
        type: document.mimeType,
        sourceParameter: document.sourceParameter || undefined,
        fileExtension: document.fileExtension || undefined,
        isPersisted: false,
        cleanupOnCancel: true,
      });
    }

    return NextResponse.json({ documents: uploadedDocs }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Gagal upload evidence.",
      },
      { status: 500 },
    );
  }
}
