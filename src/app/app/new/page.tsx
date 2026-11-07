import type { Metadata } from "next";
import { requireUser } from "@/features/auth/session";
import { aiConfig } from "@/lib/ai/provider";
import { EXAMPLE_CONVERSATIONS } from "@/features/demo/examples";
import { ProjectCreator } from "@/components/ai/project-creator";

export const metadata: Metadata = { title: "Create project with AI" };

export default async function NewProjectPage({ searchParams }: PageProps<"/app/new">) {
  const user = await requireUser();
  const { example, tour } = await searchParams;
  const initial = EXAMPLE_CONVERSATIONS.find((e) => e.key === example)?.text ?? "";
  const ai = aiConfig();
  return (
    <ProjectCreator
      initialText={initial}
      tour={tour === "1"}
      defaultCurrency={user.profile.defaultCurrency}
      ai={{ simulated: ai.provider === "simulated", model: ai.model }}
      examples={EXAMPLE_CONVERSATIONS.map((e) => ({ key: e.key, label: e.label, text: e.text }))}
    />
  );
}
