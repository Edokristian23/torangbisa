import { AuditSeverity, Prisma } from '@prisma/client';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function createAuditLog(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  severity?: AuditSeverity;
  previousState?: Prisma.InputJsonValue | null;
  nextState?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
}) {
  const h = await headers();
  const forwardedFor = h.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  const userAgent = h.get('user-agent') || 'unknown';
  const requestId = h.get('x-request-id') || crypto.randomUUID();

  return prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      severity: input.severity ?? 'INFO',
      ipAddress: ip,
      userAgent,
      requestId,
      previousState: input.previousState ?? undefined,
      nextState: input.nextState ?? undefined,
      metadata: input.metadata ?? undefined,
    },
  });
}
