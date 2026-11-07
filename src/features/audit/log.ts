import type { ActorType, Prisma } from "@prisma/client";
import type { Tx } from "@/lib/db";

/** Append-only audit trail. Never stores card data or credentials. */
export async function audit(
  tx: Tx,
  e: { projectId?: string | null; actorType: ActorType; actorId?: string | null; action: string; data?: Prisma.InputJsonValue },
) {
  await tx.auditEvent.create({
    data: {
      projectId: e.projectId ?? null,
      actorType: e.actorType,
      actorId: e.actorId ?? null,
      action: e.action,
      data: e.data ?? undefined,
    },
  });
}
