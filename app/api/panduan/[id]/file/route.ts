import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const VIEWER_ROLES = new Set<UserRole>([
  'SUPER_ADMIN',
  'BPKP_ADMIN',
  'BPKP_REVIEWER',
  'BLUD_ADMIN',
  'BLUD_OPERATOR',
  'AUDITOR',
]);

function isInlinePreviewable(mimeType: string) {
  return ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain'].includes(mimeType);
}

function safeAsciiFileName(value: string) {
  return value.replace(/[\r\n"]/g, '_');
}

function buildHeaders(params: { mimeType: string; originalName: string; fileSize: number }) {
  const disposition = isInlinePreviewable(params.mimeType) ? 'inline' : 'attachment';
  const safeName = safeAsciiFileName(params.originalName);

  return {
    'Content-Type': params.mimeType || 'application/octet-stream',
    'Content-Disposition': `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(params.originalName)}`,
    'Content-Length': String(params.fileSize),
    'Cache-Control': 'private, max-age=60',
    'X-Content-Type-Options': 'nosniff',
  };
}

async function getCurrentUser() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();

    if (!user?.isActive || !VIEWER_ROLES.has(user.role)) {
      return NextResponse.json({ message: 'Tidak memiliki akses.' }, { status: 403 });
    }

    const { id } = await params;

    const document = await prisma.guideDocument.findFirst({
      where: { id, isActive: true },
      select: {
        originalName: true,
        mimeType: true,
        fileSize: true,
        fileData: true,
      },
    });

    if (!document) {
      return NextResponse.json({ message: 'Dokumen panduan tidak ditemukan.' }, { status: 404 });
    }

    return new NextResponse(document.fileData, {
      status: 200,
      headers: buildHeaders({
        mimeType: document.mimeType,
        originalName: document.originalName,
        fileSize: document.fileSize,
      }),
    });
  } catch (error) {
    console.error('[GET_PANDUAN_FILE]', error);
    return NextResponse.json({ message: 'Gagal membuka dokumen panduan.' }, { status: 500 });
  }
}
