import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";

/**
 * Project-level authorization. A freelancer can only ever load projects they own.
 * Not-owned and non-existent look identical (NOT_FOUND) so ids cannot be probed.
 */
export async function assertProjectOwner(userId: string, projectId: string) {
  const project = await db.project.findFirst({ where: { id: projectId, ownerId: userId } });
  if (!project) throw new DomainError("NOT_FOUND", "Project not found.");
  return project;
}
