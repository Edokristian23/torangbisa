import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { canManageUsers } from '@/lib/authz';
import { UserUpsertSchema } from '@/lib/zod';
import { createAuditLog } from '@/lib/audit';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !canManageUsers(session.user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    include: { blud: true },
    orderBy: [{ role: 'asc' }, { username: 'asc' }],
  });
  const bluds = await prisma.blud.findMany({ orderBy: { code: 'asc' } });

  return NextResponse.json({
    users: users.map((user) => ({
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
    })),
    bluds,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !canManageUsers(session.user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = UserUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: 'Payload user tidak valid.', errors: parsed.error.flatten() }, { status: 400 });
    }

    const { username, email, name, password, role, bludId, mustChangePassword } = parsed.data;
    const normalizedUsername = username.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { username: normalizedUsername } });
    if (exists) return NextResponse.json({ message: 'Username sudah digunakan.' }, { status: 400 });

    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        email: email || null,
        name,
        password: await bcrypt.hash(password, 12),
        role,
        bludId: ['BLUD_ADMIN', 'BLUD_OPERATOR'].includes(role) ? bludId || null : null,
        mustChangePassword: mustChangePassword ?? true,
      },
      include: { blud: true },
    });

    await createAuditLog({
      actorId: session.user.id,
      action: 'CREATE_USER',
      entityType: 'User',
      entityId: user.id,
      nextState: { username: normalizedUsername, role, bludId },
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
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Gagal membuat user.' }, { status: 500 });
  }
}
