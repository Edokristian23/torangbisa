import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';

const ADMIN_ROLES = new Set<UserRole>(['SUPER_ADMIN', 'BPKP_ADMIN']);

async function getCurrentUser() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();

    if (!user?.isActive || !ADMIN_ROLES.has(user.role)) {
      return NextResponse.json({ message: 'Hanya Admin BPKP yang dapat mengubah panduan.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();

    if (!name) {
      return NextResponse.json({ message: 'Nama dokumen wajib diisi.' }, { status: 400 });
    }

    const previous = await prisma.guideDocument.findUnique({
      where: { id },
      select: { id: true, name: true, description: true, isActive: true },
    });

    if (!previous || !previous.isActive) {
      return NextResponse.json({ message: 'Dokumen panduan tidak ditemukan.' }, { status: 404 });
    }

    const updated = await prisma.guideDocument.update({
      where: { id },
      data: { name, description: description || null },
      select: { id: true, name: true, description: true, updatedAt: true },
    });

    await createAuditLog({
      actorId: user.id,
      action: 'UPDATE_GUIDE_DOCUMENT',
      entityType: 'GuideDocument',
      entityId: id,
      previousState: previous,
      nextState: updated,
    });

    return NextResponse.json({ message: 'Dokumen panduan berhasil diperbarui.', document: updated });
  } catch (error) {
    console.error('[PATCH_PANDUAN]', error);
    return NextResponse.json({ message: 'Gagal mengubah dokumen panduan.' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();

    if (!user?.isActive || !ADMIN_ROLES.has(user.role)) {
      return NextResponse.json({ message: 'Hanya Admin BPKP yang dapat menghapus panduan.' }, { status: 403 });
    }

    const { id } = await params;

    const previous = await prisma.guideDocument.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    });

    if (!previous || !previous.isActive) {
      return NextResponse.json({ message: 'Dokumen panduan tidak ditemukan.' }, { status: 404 });
    }

    await prisma.guideDocument.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      actorId: user.id,
      action: 'DELETE_GUIDE_DOCUMENT',
      entityType: 'GuideDocument',
      entityId: id,
      previousState: previous,
      nextState: { ...previous, isActive: false },
    });

    return NextResponse.json({ message: 'Dokumen panduan berhasil dihapus.' });
  } catch (error) {
    console.error('[DELETE_PANDUAN]', error);
    return NextResponse.json({ message: 'Gagal menghapus dokumen panduan.' }, { status: 500 });
  }
}
