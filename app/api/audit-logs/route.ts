import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { canManageUsers, canReview } from '@/lib/authz';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || (!canManageUsers(session.user.role) && !canReview(session.user.role))) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') || 50), 200);

  const logs = await prisma.auditLog.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { actor: true },
  });

  return NextResponse.json({
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      severity: log.severity,
      actorName: log.actor?.name ?? null,
      actorUsername: log.actor?.username ?? null,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
      metadata: log.metadata,
    })),
  });
}
