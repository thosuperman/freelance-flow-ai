"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/errors";
import { SUPPORTED_CURRENCIES } from "@/lib/money";
import { requireUserForAction } from "@/features/auth/session";

const ProfileSchema = z.object({
  businessName: z.string().trim().max(120).optional().default(""),
  defaultCurrency: z.enum(SUPPORTED_CURRENCIES),
  hourlyRate: z
    .string()
    .trim()
    .regex(/^(\d{1,9}(\.\d{1,2})?)?$/, "Enter a rate like 50 or 75.50")
    .optional()
    .default(""),
});

export async function updateProfileAction(input: unknown) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const p = ProfileSchema.parse(input);
    await db.freelancerProfile.update({
      where: { userId: user.id },
      data: {
        businessName: p.businessName || null,
        defaultCurrency: p.defaultCurrency,
        hourlyRate: p.hourlyRate ? new Prisma.Decimal(p.hourlyRate) : null,
        onboardedAt: new Date(),
      },
    });
    revalidatePath("/app", "layout");
  });
}
