import "server-only";
import { paypalConfig } from "@/lib/paypal";

/**
 * Optional shared PayPal **Sandbox** buyer login shown to reviewers (DEMO_PAYPAL_BUYER_EMAIL /
 * DEMO_PAYPAL_BUYER_PASSWORD). Read from the server environment only, never committed, and returned
 * only while PAYPAL_MODE=sandbox, so a live deployment can never display it.
 */
export function sandboxBuyer(): { email: string; password: string } | null {
  if (paypalConfig().mode !== "sandbox") return null;
  const email = process.env.DEMO_PAYPAL_BUYER_EMAIL?.trim();
  const password = process.env.DEMO_PAYPAL_BUYER_PASSWORD;
  if (!email || !password || !email.endsWith(".example.com")) return null;
  return { email, password };
}
