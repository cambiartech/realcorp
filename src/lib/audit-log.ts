import prisma from "@/lib/db";
import type { Prisma } from "@/generated/prisma";

type AuditLogInput = {
  tenantId: string;
  actorUserId?: string | null;
  actorLabel?: string | null;
  module: string;
  entityType: string;
  entityId?: string | null;
  action: string;
  summary?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditLog(input: AuditLogInput) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId || null,
        actorLabel: input.actorLabel || null,
        module: input.module,
        entityType: input.entityType,
        entityId: input.entityId || null,
        action: input.action,
        summary: input.summary || null,
        ...(input.metadata ? { metadata: input.metadata } : {}),
      },
    });
  } catch {
    // Audit must not break user-facing operations.
  }
}
