import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashBuffer } from "@/lib/storage";
import { createAuditLog } from "@/lib/audit";
import { isAdminRole } from "@/lib/authz";

const BPKP_ROLES = ["BPKP", "BPKP_ADMIN", "BPKP_REVIEWER"];

function normalizeRole(role?: string | null) {
  return String(role || "").toUpperCase();
}

function isBpkpRole(role?: string | null) {
  return BPKP_ROLES.includes(normalizeRole(role));
}

function isBpkpOwnedResponse(createdByRole?: string | null) {
  return BPKP_ROLES.includes(normalizeRole(createdByRole));
}

function canUseExistingDocumentAcrossModules(role?: string | null) {
  const roleUpper = normalizeRole(role);

  return (
    roleUpper === "BLUD_OPERATOR" ||
    roleUpper === "BLUD_ADMIN" ||
    roleUpper === "BPKP" ||
    roleUpper === "BPKP_ADMIN" ||
    roleUpper === "BPKP_REVIEWER"
  );
}

function canUseBludFilter(role?: string | null) {
  return isBpkpRole(role) || isAdminRole(role as any);
}

function isBludAdminReviewOnly(role?: string | null) {
  return normalizeRole(role) === "BLUD_ADMIN";
}

async function resolveTargetBludId(
  session: any,
  role: string,
  requestedBludCode?: string | null,
) {
  const normalizedBludCode = String(requestedBludCode || "")
    .trim()
    .toUpperCase();

  if (canUseBludFilter(role) && normalizedBludCode) {
    const blud = await prisma.blud.findUnique({
      where: { code: normalizedBludCode },
      select: { id: true },
    });

    return blud?.id || null;
  }

  return session?.user?.bludId || null;
}

type ExistingDocumentResult = {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  sourceParameter: string | null;
  fileExtension: string | null;
};

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
    const responseId = String(formData.get("responseId") || "");
    const customName = String(formData.get("customName") || "").trim();
    const requestedYear = Number(formData.get("year") || 0);
    const requestedBludCode = String(formData.get("bludCode") || "")
      .trim()
      .toUpperCase();

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

    const role = normalizeRole(session.user.role);
    const allowExistingDocumentAcrossModules =
      canUseExistingDocumentAcrossModules(role);

    if (isBludAdminReviewOnly(role)) {
      return NextResponse.json(
        {
          message:
            "Role Admin BLUD hanya dapat melakukan review tindak lanjut AOI.",
        },
        { status: 403 },
      );
    }

    const responseOwnedByBpkp = isBpkpOwnedResponse(response.createdByRole);

    if (isBpkpRole(role)) {
      const targetBludId = await resolveTargetBludId(
        session,
        role,
        requestedBludCode,
      );

      if (requestedYear && requestedYear !== response.assessmentPeriod.year) {
        return NextResponse.json(
          { message: "Tahun filter tidak sesuai dengan AOI yang dipilih." },
          { status: 400 },
        );
      }

      if (targetBludId && targetBludId !== response.assessmentPeriod.bludId) {
        return NextResponse.json(
          { message: "BLUD filter tidak sesuai dengan AOI yang dipilih." },
          { status: 400 },
        );
      }

      if (!responseOwnedByBpkp) {
        return NextResponse.json(
          {
            message:
              "Admin BPKP hanya dapat upload evidence tindak lanjut pada self assessment Admin BPKP.",
          },
          { status: 403 },
        );
      }
    } else {
      if (responseOwnedByBpkp) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }

      if (
        !isAdminRole(session.user.role) &&
        response.assessmentPeriod.bludId !== session.user.bludId
      ) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
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
          {
            message: `Ukuran file ${file.name} melebihi ${MAX_FILE_SIZE_MB}MB.`,
          },
          { status: 400 },
        );
      }

      const buffer = Buffer.from(arrayBuffer);
      const checksumSha256 = hashBuffer(buffer);
      const displayName =
        files.length > 1 ? `${customName} ${index + 1}` : customName;

      /**
       * Aturan duplikat existing evidence untuk menu Tindak Lanjut.
       *
       * Sebelumnya role BLUD hanya cek dokumen pada assessmentPeriodId yang
       * sama. Akibatnya existing evidence dari modul/aspek lain tidak muncul
       * sebagai dokumen existing, walaupun masih dalam BLUD dan tahun yang sama.
       *
       * Aturan baru:
       * - BLUD_OPERATOR dan BLUD_ADMIN mengecek existing evidence lintas
       *   modul/aspek selama masih dalam BLUD yang sama dan tahun yang sama.
       * - BPKP / BPKP_ADMIN / BPKP_REVIEWER tetap memakai aturan lintas modul
       *   yang sudah berjalan.
       * - Role lain tetap memakai scope period existing.
       */
      const existingDocument = allowExistingDocumentAcrossModules
        ? await prisma.assessmentDocument.findFirst({
            where: {
              assessmentPeriod: {
                bludId: response.assessmentPeriod.bludId,
                year: response.assessmentPeriod.year,
              },
              OR: [
                { name: customName },
                { name: displayName },
                { originalName: file.name },
              ],
            },
          })
        : await prisma.assessmentDocument.findFirst({
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
          sourceParameter: `${responseOwnedByBpkp ? "BPKP TL Evidence" : "TL Evidence"} - ${response.parameterLabel}`,
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
          responseOwner: responseOwnedByBpkp ? "BPKP" : "BLUD",
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
