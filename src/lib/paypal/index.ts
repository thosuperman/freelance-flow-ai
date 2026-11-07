import "server-only";
import { HttpPayPalGateway } from "./http-gateway";
import { MockPayPalGateway } from "./mock-gateway";
import type { PayPalGateway, PayPalMode } from "./types";

export type PayPalConfig = {
  mode: PayPalMode;
  configured: boolean;
  /** Public client id for the browser JS SDK (public by design). */
  clientId: string | null;
  webhookConfigured: boolean;
};

export function paypalConfig(): PayPalConfig {
  const raw = (process.env.PAYPAL_MODE ?? "sandbox").trim().toLowerCase();
  const mode: PayPalMode = raw === "live" ? "live" : raw === "mock" ? "mock" : "sandbox";
  if (mode === "mock" && process.env.VERCEL_ENV === "production") {
    throw new Error("PAYPAL_MODE=mock is not allowed in production deployments");
  }
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim() || null;
  const secret = process.env.PAYPAL_CLIENT_SECRET?.trim() || null;
  return {
    mode,
    configured: mode === "mock" || Boolean(clientId && secret),
    clientId: mode === "mock" ? null : (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim() || clientId),
    webhookConfigured: mode === "mock" || Boolean(process.env.PAYPAL_WEBHOOK_ID?.trim()),
  };
}

let gateway: PayPalGateway | null = null;

export function getPayPalGateway(): PayPalGateway {
  if (gateway) return gateway;
  const cfg = paypalConfig();
  if (cfg.mode === "mock") {
    gateway = new MockPayPalGateway();
  } else {
    const id = process.env.PAYPAL_CLIENT_ID?.trim();
    const secret = process.env.PAYPAL_CLIENT_SECRET?.trim();
    if (!id || !secret) throw new Error("PayPal is not configured (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)");
    gateway = new HttpPayPalGateway(cfg.mode, id, secret, process.env.PAYPAL_WEBHOOK_ID?.trim() || null);
  }
  return gateway;
}

export function setPayPalGatewayForTests(g: PayPalGateway | null) {
  gateway = g;
}

export * from "./types";
