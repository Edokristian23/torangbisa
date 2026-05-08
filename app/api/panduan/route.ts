import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { UserRole } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { isGuideDocumentCategory } from "@/lib/guide-categories";

const ADMIN_ROLES = new Set<UserRole>(["SUPER_ADMIN", "BPKP_ADMIN"]);
const VIEWER_ROLES = new Set<UserRole>([
  "SUPER_ADMIN",
  "BPKP_ADMIN",
  "BPKP_REVIEWER",
  "BLUD_ADMIN",
  "BLUD_OPERATOR",
  "AUDITOR",
]);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "text/plain",
  "application/octet-stream",
]);

const MAX_FILE_SIZE = 15 * 1024 * 1024;

function getFileExtension(fileName: string) {
  const parts = fileName.split(".");
  if (parts.length <= 1) return null;
  return parts.pop()?.toLowerCase() || null;
}

async function getCurrentUser() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true, isActive: true },
  });
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user?.isActive || !VIEWER_ROLES.has(user.role)) {
      return NextResponse.json(
        { message: "Tidak memiliki akses." },
        { status: 403 },
      );
    }

    const documents = await prisma.guideDocument.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        category: true,
        name: true,
        description: true,
        originalName: true,
        mimeType: true,
        fileExtension: true,
        fileSize: true,
        checksumSha256: true,
        createdAt: true,
        updatedAt: true,
        uploadedBy: { select: { name: true, username: true } },
      },
    });

    return NextResponse.json({
      documents,
      permissions: {
        role: user.role,
        canManage: ADMIN_ROLES.has(user.role),
      },
    });
  } catch (error) {
    console.error("[GET_PANDUAN]", error);
    return NextResponse.json(
      { message: "Gagal memuat dokumen panduan." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user?.isActive || !ADMIN_ROLES.has(user.role)) {
      return NextResponse.json(
        { message: "Hanya Admin BPKP yang dapat menambahkan panduan." },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const rawCategory = String(
      formData.get("category") || "PETUNJUK_TOOLS",
    ).trim();
    const category = isGuideDocumentCategory(rawCategory)
      ? rawCategory
      : "PETUNJUK_TOOLS";
    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const file = formData.get("file");

    if (!name) {
      return NextResponse.json(
        { message: "Nama dokumen wajib diisi sebelum upload." },
        { status: 400 },
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "File dokumen wajib diupload." },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { message: "File tidak valid atau kosong." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: "Ukuran file maksimal 15MB." },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { message: "Format file tidak didukung." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const checksumSha256 = crypto
      .createHash("sha256")
      .update(buffer)
      .digest("hex");

    const created = await prisma.guideDocument.create({
      data: {
        category,
        name,
        description: description || null,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileExtension: getFileExtension(file.name),
        fileSize: file.size,
        checksumSha256,
        fileData: buffer,
        uploadedById: user.id,
      },
      select: { id: true, name: true, category: true },
    });

    await createAuditLog({
      actorId: user.id,
      action: "CREATE_GUIDE_DOCUMENT",
      entityType: "GuideDocument",
      entityId: created.id,
      metadata: {
        category,
        name,
        originalName: file.name,
        fileSize: file.size,
      },
    });

    return NextResponse.json(
      { message: "Dokumen panduan berhasil ditambahkan.", document: created },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST_PANDUAN]", error);
    return NextResponse.json(
      { message: "Gagal menambahkan dokumen panduan." },
      { status: 500 },
    );
  }
}
