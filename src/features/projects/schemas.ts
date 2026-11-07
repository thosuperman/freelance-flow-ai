import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "@/lib/money";

const amount = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter an amount like 1500 or 1500.00");

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

export const ScopeLineSchema = z.object({
  title: z.string().trim().min(1, "Required").max(200),
  description: z.string().trim().max(2000).default(""),
});

export const MilestoneInputSchema = z.object({
  title: z.string().trim().min(1, "Required").max(200),
  description: z.string().trim().max(2000).default(""),
  kind: z.enum(["DEPOSIT", "DELIVERY"]),
  amount,
  dueDate: optionalDate,
});

export const ProjectTermsSchema = z.object({
  title: z.string().trim().min(2, "Give the project a title").max(200),
  description: z.string().trim().min(1, "Add a short description").max(4000),
  currency: z.enum(SUPPORTED_CURRENCIES),
  budget: amount,
  startDate: optionalDate,
  deliverables: z.array(ScopeLineSchema).min(1, "Add at least one deliverable").max(50),
  exclusions: z.array(z.string().trim().min(1).max(300)).max(50),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(500)).max(30),
  milestones: z.array(MilestoneInputSchema).min(1, "Add at least one milestone").max(20),
});
export type ProjectTermsInput = z.infer<typeof ProjectTermsSchema>;

export const ClientInputSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(200),
  email: z.string().trim().email("Enter a valid email").max(320).nullable().optional().or(z.literal("").transform(() => null)),
  company: z.string().trim().max(200).nullable().optional(),
});

export const CreateProjectSchema = ProjectTermsSchema.extend({
  client: ClientInputSchema,
  analysisId: z.string().cuid().nullable().optional(),
  aiReview: z
    .object({
      acceptedAssumptions: z.array(z.string().max(500)).max(50),
      rejectedAssumptions: z.array(z.string().max(500)).max(50),
      provider: z.string().max(50),
    })
    .nullable()
    .optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
