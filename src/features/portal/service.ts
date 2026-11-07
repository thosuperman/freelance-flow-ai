import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isDomainError } from "@/lib/errors";
import { resolvePortalToken } from "@/features/clients/portal-access";
import { financialsFor, projectDetailInclude } from "@/features/projects/service";

/** Resolves the token for a portal page; unknown/revoked/expired tokens render a 404. */
export const getPortalGrant = cache(async (token: string) => {
  try {
    return await resolvePortalToken(token);
  } catch (e) {
    if (isDomainError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
});

/**
 * Loads only the project the token grants access to. Draft (unsent) terms and internal AI analyses
 * are never exposed to the client.
 */
export async function loadPortalProject(token: string) {
  const grant = await getPortalGrant(token);
  const project = await db.project.findUniqueOrThrow({ where: { id: grant.projectId }, include: projectDetailInclude });
  return { grant, project, fin: financialsFor(project) };
}

export const getPortalProject = cache(loadPortalProject);
