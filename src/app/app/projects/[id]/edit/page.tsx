import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isDomainError } from "@/lib/errors";
import { requireUser } from "@/features/auth/session";
import { getProjectDetail, termsFromProject } from "@/features/projects/service";
import { TermsEditor } from "@/components/projects/terms-editor";

export const metadata: Metadata = { title: "Edit terms" };

export default async function EditTermsPage({ params }: PageProps<"/app/projects/[id]/edit">) {
  const user = await requireUser();
  const { id } = await params;
  let project;
  try {
    project = await getProjectDetail(user.id, id);
  } catch (e) {
    if (isDomainError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  if (project.status !== "DRAFT") redirect(`/app/projects/${id}`);
  const t = termsFromProject(project);
  return (
    <TermsEditor
      projectId={id}
      initial={{
        title: t.title,
        description: t.description,
        currency: t.currency,
        budget: t.budget,
        startDate: t.startDate ?? "",
        client: { name: project.client.name, email: project.client.email ?? "", company: project.client.company ?? "" },
        deliverables: t.deliverables.map((d) => ({ ...d, inferred: false })),
        exclusions: t.exclusions.map((value) => ({ value })),
        acceptanceCriteria: t.acceptanceCriteria.map((value) => ({ value })),
        milestones: t.milestones.map((m) => ({ ...m, dueDate: m.dueDate ?? "", inferred: false })),
      }}
    />
  );
}
