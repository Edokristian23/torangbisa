import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { canManageUsers } from '@/lib/authz';
import { UserPatchSchema } from '@/lib/zod';
import { createAuditLog } from '@/lib/audit';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !canManageUsers(session.user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = UserPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: 'Payload user tidak valid.', errors: parsed.error.flatten() }, { status: 400 });
    }

    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ message: 'User tidak ditemukan.' }, { status: 404 });

    const data: any = {};
    if (typeof parsed.data.email !== 'undefined') data.email = parsed.data.email || null;
    if (typeof parsed.data.name !== 'undefined') data.name = parsed.data.name;
    if (typeof parsed.data.role !== 'undefined') data.role = parsed.data.role;
    if (typeof parsed.data.bludId !== 'undefined') data.bludId = parsed.data.bludId || null;
    if (typeof parsed.data.isActive !== 'undefined') data.isActive = parsed.data.isActive;
    if (typeof parsed.data.mustChangePassword !== 'undefined') data.mustChangePassword = parsed.data.mustChangePassword;
    if (typeof parsed.data.password === 'string' && parsed.data.password.trim()) {
      data.password = await bcrypt.hash(parsed.data.password.trim(), 12);
      data.passwordChangedAt = new Date();
      data.failedLoginCount = 0;
      data.lockedUntil = null;
    }

    const user = await prisma.user.update({ where: { id }, data, include: { blud: true } });

    await createAuditLog({
      actorId: session.user.id,
      action: 'UPDATE_USER',
      entityType: 'User',
      entityId: id,
      previousState: {
        email: before.email,
        name: before.name,
        role: before.role,
        isActive: before.isActive,
        bludId: before.bludId,
      },
      nextState: {
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        bludId: user.bludId,
      },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
        bludId: user.bludId,
        bludCode: user.blud?.code ?? null,
        bludName: user.blud?.name ?? null,
        failedLoginCount: user.failedLoginCount,
        lockedUntil: user.lockedUntil,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Gagal memperbarui user.' }, { status: 500 });
  }
}
