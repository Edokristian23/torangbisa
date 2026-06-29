import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashBuffer } from "@/lib/storage";
import { createAuditLog } from "@/lib/audit";

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
const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024; 

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
    const year = Number(formData.get("year"));
    const moduleKey = String(formData.get("moduleKey") || "");
    const sourceParameter = String(formData.get("sourceParameter") || "");
    const customName = String(formData.get("customName") || "").trim();

    if (
      !year ||
      !moduleKey ||
      !sourceParameter ||
      !customName ||
      files.length === 0
    ) {
      return NextResponse.json(
        { message: "Data upload tidak lengkap." },
        { status: 400 },
      );
    }

    let bludId = session.user.bludId;
    if (!bludId && ["SUPER_ADMIN", "BPKP_ADMIN"].includes(session.user.role)) {
      const targetBludCode = String(formData.get("bludCode") || "")
        .trim()
        .toUpperCase();
      if (targetBludCode) {
        const blud = await prisma.blud.findUnique({
          where: { code: targetBludCode },
        });
        bludId = blud?.id ?? null;
      }
    }

    if (!bludId) {
      return NextResponse.json(
        { message: "BLUD user belum terhubung." },
        { status: 400 },
      );
    }

    const blud = await prisma.blud.findUnique({ where: { id: bludId } });
    if (!blud) {
      return NextResponse.json(
        { message: "BLUD tidak ditemukan." },
        { status: 404 },
      );
    }

    const assessmentPeriod = await prisma.assessmentPeriod.upsert({
      where: { bludId_year_moduleKey: { bludId, year, moduleKey } },
      update: {},
      create: { bludId, year, moduleKey },
    });

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
          {
            message: `Ukuran file ${file.name} melebihi ${MAX_FILE_SIZE_MB}MB.`,
          },
          { status: 400 },
        );
      }

      const buffer = Buffer.from(arrayBuffer);
      const checksumSha256 = hashBuffer(buffer);

      // Nama final tetap sama seperti flow existing agar fungsi lama tidak berubah.
      const displayName =
        files.length > 1 ? `${customName} ${index + 1}` : customName;

      /**
       * FIX GLOBAL EXISTING DOCUMENT:
       * Sebelumnya existing document dicek berdasarkan assessmentPeriodId.
       * Karena assessmentPeriodId unik per BLUD + tahun + moduleKey, dokumen
       * yang sudah ada di modul lain tidak terbaca sebagai existing.
       *
       * Sekarang cek existing dibuat global per BLUD + tahun melalui relasi
       * assessmentPeriod.bludId dan assessmentPeriod.year, tanpa membatasi moduleKey.
       *
       * Dampak:
       * - Upload modul berbeda pada BLUD dan tahun yang sama tetap mendeteksi
       *   nama dokumen / nama file yang sudah pernah ada.
       * - Operator BLUD, Admin BLUD, dan Admin BPKP tetap memakai isolasi BLUD + tahun.
       * - Proses penyimpanan dokumen tetap memakai assessmentPeriod modul aktif,
       *   jadi relasi dokumen ke modul yang sedang dibuka tidak berubah.
       */
      const existingDocument = await prisma.assessmentDocument.findFirst({
        where: {
          assessmentPeriod: {
            bludId,
            year,
          },
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
          assessmentPeriodId: assessmentPeriod.id,
          uploadedById: session.user.id,
          sourceParameter,
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
        action: "UPLOAD_DOCUMENT",
        entityType: "AssessmentDocument",
        entityId: document.id,
        metadata: {
          storageProvider: "DATABASE",
          checksumSha256,
          fileSize: document.fileSize,
          year,
          moduleKey,
          bludCode: blud.code,
        },
      });

      uploadedDocs.push({
        id: document.id,
        name: document.name,
        originalName: document.originalName,
        url: `/api/documents/${document.id}`,
        type: document.mimeType,
        sourceParameter: document.sourceParameter,
        fileExtension: document.fileExtension,
        isPersisted: true,
      });
    }

    return NextResponse.json({ documents: uploadedDocs }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Gagal upload dokumen.",
      },
      { status: 500 },
    );
  }
}
