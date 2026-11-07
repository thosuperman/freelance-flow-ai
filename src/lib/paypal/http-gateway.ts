import {
  PayPalApiError,
  type CreateOrderInput,
  type PayPalGateway,
  type PayPalOrder,
  type WebhookHeaders,
} from "./types";

/**
 * PayPal REST client (Orders v2 + Webhooks) used for Sandbox and Live.
 *
 * - OAuth2 client-credentials token, cached until shortly before expiry.
 * - Every mutating call sends a PayPal-Request-Id so retries are idempotent on PayPal's side.
 * - Credentials never leave the server.
 */
export class HttpPayPalGateway implements PayPalGateway {
  readonly mode: "sandbox" | "live";
  private readonly baseUrl: string;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    mode: "sandbox" | "live",
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly webhookId: string | null,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 20_000,
  ) {
    this.mode = mode;
    this.baseUrl = mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  }

  private async request<T>(path: string, init: RequestInit & { auth?: "basic" | "bearer" } = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.auth === "basic") {
      headers.set("Authorization", `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`);
    } else {
      headers.set("Authorization", `Bearer ${await this.accessToken()}`);
    }
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(this.timeoutMs),
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!res.ok) {
      const b = (body ?? {}) as { name?: string; message?: string; debug_id?: string; details?: { issue?: string }[] };
      const issue = b.details?.[0]?.issue ?? b.name ?? null;
      if (res.status === 401 && init.auth !== "basic") this.token = null;
      throw new PayPalApiError(res.status, issue, b.message ?? `PayPal request failed (${res.status})`, b.debug_id ?? null);
    }
    return body as T;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const data = await this.request<{ access_token: string; expires_in: number }>("/v1/oauth2/token", {
      method: "POST",
      auth: "basic",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    this.token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }

  createOrder(input: CreateOrderInput): Promise<PayPalOrder> {
    return this.request<PayPalOrder>("/v2/checkout/orders", {
      method: "POST",
      headers: { "PayPal-Request-Id": input.requestId, Prefer: "return=representation" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: input.referenceId,
            custom_id: input.referenceId,
            description: input.description.slice(0, 127),
            amount: input.amount,
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: input.brandName.slice(0, 127),
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
            },
          },
        },
      }),
    });
  }

  getOrder(orderId: string): Promise<PayPalOrder> {
    return this.request<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
  }

  captureOrder(orderId: string, requestId: string): Promise<PayPalOrder> {
    return this.request<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      headers: { "PayPal-Request-Id": requestId, Prefer: "return=representation" },
      body: "{}",
    });
  }

  async verifyWebhookSignature(h: WebhookHeaders, rawBody: string): Promise<boolean> {
    if (!this.webhookId) {
      console.error("[paypal] PAYPAL_WEBHOOK_ID is not configured; rejecting webhook");
      return false;
    }
    // The raw event body is embedded verbatim: re-serialising it can change bytes and break verification.
    const body = `{"auth_algo":${JSON.stringify(h.authAlgo)},"cert_url":${JSON.stringify(h.certUrl)},"transmission_id":${JSON.stringify(
      h.transmissionId,
    )},"transmission_sig":${JSON.stringify(h.transmissionSig)},"transmission_time":${JSON.stringify(
      h.transmissionTime,
    )},"webhook_id":${JSON.stringify(this.webhookId)},"webhook_event":${rawBody}}`;
    const res = await this.request<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      body,
    });
    return res.verification_status === "SUCCESS";
  }
}
