import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { setAIProviderForTests, type AIProvider } from "@/lib/ai/provider";
import { DomainError } from "@/lib/errors";
import { HttpPayPalGateway } from "@/lib/paypal/http-gateway";
import { extractProjectFromText } from "@/features/ai/service";
import { createUser, resetDb } from "./helpers";

beforeEach(resetDb);
afterEach(() => setAIProviderForTests(null));

describe("AI service resilience", () => {
  it("stores successful analyses with provider and prompt version", async () => {
    const user = await createUser();
    const r = await extractProjectFromText(user, "I need a landing page for my business. Budget is $1,500. I'll pay 30% upfront.");
    expect(r.simulated).toBe(true);
    const row = await db.aIAnalysis.findUniqueOrThrow({ where: { id: r.analysisId } });
    expect(row).toMatchObject({ succeeded: true, provider: "simulated", kind: "PROJECT_EXTRACTION" });
    expect(row.promptVersion).toMatch(/^extract-project@/);
  });

  it("rejects malformed provider output and records the failure", async () => {
    const user = await createUser();
    const broken: AIProvider = {
      name: "broken",
      model: "test",
      simulated: false,
      async generate(task) {
        const parsed = task.schema.safeParse({ projectTitle: 42 });
        if (!parsed.success) throw new DomainError("AI_INVALID_OUTPUT", "The AI returned data in an unexpected format.");
        return { data: parsed.data, provider: "broken", model: "test", simulated: false };
      },
    };
    setAIProviderForTests(broken);
    await expect(extractProjectFromText(user, "I need a landing page, budget $1,500 thanks.")).rejects.toMatchObject({ code: "AI_INVALID_OUTPUT" });
    expect(await db.aIAnalysis.count({ where: { succeeded: false } })).toBe(1);
  });

  it("maps provider outages to a friendly AI_UNAVAILABLE error", async () => {
    const user = await createUser();
    setAIProviderForTests({
      name: "down",
      model: "x",
      simulated: false,
      generate: async () => {
        throw new Error("ECONNRESET");
      },
    });
    await expect(extractProjectFromText(user, "I need a landing page, budget $1,500 thanks.")).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
  });

  it("validates input length", async () => {
    const user = await createUser();
    await expect(extractProjectFromText(user, "hi")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("enforces the site-wide daily AI cap across users", async () => {
    process.env.AI_DAILY_LIMIT = "2";
    try {
      const text = "I need a landing page for my business. Budget is $1,500.";
      await extractProjectFromText(await createUser(), text);
      await extractProjectFromText(await createUser(), text);
      await expect(extractProjectFromText(await createUser(), text)).rejects.toMatchObject({
        code: "RATE_LIMITED",
        message: expect.stringMatching(/today's usage limit/),
      });
    } finally {
      delete process.env.AI_DAILY_LIMIT;
    }
  });
});

describe("PayPal HTTP gateway (Orders v2) with mocked transport", () => {
  type Call = { url: string; init: RequestInit };
  function fakeFetch(responses: ((c: Call) => { status: number; body: unknown })[]) {
    const calls: Call[] = [];
    const impl = (async (url: string, init: RequestInit) => {
      const c = { url, init };
      calls.push(c);
      const r = responses.shift()!(c);
      return new Response(JSON.stringify(r.body), { status: r.status });
    }) as unknown as typeof fetch;
    return { impl, calls };
  }

  it("authenticates, caches the token and sends idempotency keys", async () => {
    const { impl, calls } = fakeFetch([
      () => ({ status: 200, body: { access_token: "tok", expires_in: 3600 } }),
      () => ({ status: 201, body: { id: "ORDER1", status: "CREATED" } }),
      () => ({ status: 201, body: { id: "ORDER1", status: "COMPLETED" } }),
    ]);
    const gw = new HttpPayPalGateway("sandbox", "cid", "secret", "WH", impl);
    await gw.createOrder({ requestId: "req-1", referenceId: "pr_1", description: "Deposit", amount: { currency_code: "USD", value: "450.00" }, brandName: "Studio" });
    await gw.captureOrder("ORDER1", "cap-1");
    expect(calls[0]!.url).toBe("https://api-m.sandbox.paypal.com/v1/oauth2/token");
    expect(calls).toHaveLength(3); // token fetched once
    const createHeaders = new Headers(calls[1]!.init.headers);
    expect(createHeaders.get("PayPal-Request-Id")).toBe("req-1");
    expect(createHeaders.get("Authorization")).toBe("Bearer tok");
    const body = JSON.parse(String(calls[1]!.init.body));
    expect(body.intent).toBe("CAPTURE");
    expect(body.purchase_units[0]).toMatchObject({ custom_id: "pr_1", amount: { currency_code: "USD", value: "450.00" } });
    expect(new Headers(calls[2]!.init.headers).get("PayPal-Request-Id")).toBe("cap-1");
  });

  it("surfaces PayPal issue codes", async () => {
    const { impl } = fakeFetch([
      () => ({ status: 200, body: { access_token: "tok", expires_in: 3600 } }),
      () => ({ status: 422, body: { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_CAPTURED" }], debug_id: "dbg" } }),
    ]);
    const gw = new HttpPayPalGateway("sandbox", "cid", "secret", "WH", impl);
    await expect(gw.captureOrder("O", "r")).rejects.toMatchObject({ status: 422, issue: "ORDER_ALREADY_CAPTURED", debugId: "dbg" });
  });

  it("verifies webhooks by embedding the raw event body verbatim", async () => {
    const { impl, calls } = fakeFetch([
      () => ({ status: 200, body: { access_token: "tok", expires_in: 3600 } }),
      () => ({ status: 200, body: { verification_status: "SUCCESS" } }),
    ]);
    const gw = new HttpPayPalGateway("sandbox", "cid", "secret", "WH-123", impl);
    const raw = '{"id":"WH-1","event_type":"PAYMENT.CAPTURE.COMPLETED","resource":{"amount":{"value":"450.00"}}}';
    const ok = await gw.verifyWebhookSignature(
      { authAlgo: "SHA256withRSA", certUrl: "https://c", transmissionId: "t", transmissionSig: "s", transmissionTime: "now" },
      raw,
    );
    expect(ok).toBe(true);
    expect(calls[1]!.url).toBe("https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature");
    const sent = String(calls[1]!.init.body);
    expect(sent).toContain(`"webhook_event":${raw}`);
    expect(JSON.parse(sent).webhook_id).toBe("WH-123");
  });

  it("rejects webhooks when no webhook id is configured", async () => {
    const gw = new HttpPayPalGateway("sandbox", "cid", "secret", null, (async () => new Response("{}")) as unknown as typeof fetch);
    expect(await gw.verifyWebhookSignature({ authAlgo: "a", certUrl: "b", transmissionId: "c", transmissionSig: "d", transmissionTime: "e" }, "{}")).toBe(false);
  });
});
