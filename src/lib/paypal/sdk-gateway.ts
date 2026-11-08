import {
  ApiError,
  CheckoutPaymentIntent,
  Client,
  Environment,
  OrdersController,
  PaypalExperienceUserAction,
  PaypalWalletContextShippingPreference,
} from "@paypal/paypal-server-sdk";
import type { Order, OrdersCapture } from "@paypal/paypal-server-sdk";
import {
  PayPalApiError,
  type CreateOrderInput,
  type PayPalCapture,
  type PayPalGateway,
  type PayPalOrder,
  type WebhookHeaders,
} from "./types";

/**
 * Orders v2 through the APIMatic-generated PayPal Server SDK (`@paypal/paypal-server-sdk`).
 *
 * Built following the APIMatic Context Plugin for PayPal (TypeScript skills). Notes from those
 * skills that shaped this file, each confirmed against the SDK source in node_modules:
 * - DEFAULT_CONFIGURATION.timeout is 0 (wait forever), so a per-attempt timeout is set explicitly.
 * - DEFAULT_RETRY_CONFIG retries only GET/PUT with maximumRetryWaitTime 0 (no retries at all).
 *   Create and capture send a PayPal-Request-Id, which makes POST retries idempotent on PayPal's
 *   side, so POST is added to the retry list.
 *   The timeout is per attempt and does not cover the OAuth token exchange, so every call is also
 *   raced against an overall deadline.
 * - The typed CustomError is not exported from the package root, so errors are recognised as
 *   ApiError and read through `statusCode` and the snake_case `result` payload.
 *
 * The SDK has no Webhooks controller, so signature verification is delegated to the existing
 * REST implementation (see http-gateway.ts).
 */

export type OrdersApi = Pick<OrdersController, "createOrder" | "getOrder" | "captureOrder">;

type WebhookVerifier = Pick<PayPalGateway, "verifyWebhookSignature">;

const ATTEMPT_TIMEOUT_MS = 20_000;
const OVERALL_DEADLINE_MS = 45_000;

export function createOrdersApi(mode: "sandbox" | "live", clientId: string, clientSecret: string): OrdersApi {
  const client = new Client({
    environment: mode === "live" ? Environment.Production : Environment.Sandbox,
    clientCredentialsAuthCredentials: { oAuthClientId: clientId, oAuthClientSecret: clientSecret },
    timeout: ATTEMPT_TIMEOUT_MS,
    httpClientOptions: {
      timeout: ATTEMPT_TIMEOUT_MS,
      retryConfig: {
        maxNumberOfRetries: 2,
        retryOnTimeout: true,
        retryInterval: 1,
        backoffFactor: 2,
        maximumRetryWaitTime: 10,
        httpStatusCodesToRetry: [408, 429, 500, 502, 503, 504],
        httpMethodsToRetry: ["GET", "POST"],
      },
    },
  });
  return new OrdersController(client);
}

export class SdkPayPalGateway implements PayPalGateway {
  constructor(
    readonly mode: "sandbox" | "live",
    private readonly orders: OrdersApi,
    private readonly webhooks: WebhookVerifier,
  ) {}

  async createOrder(input: CreateOrderInput): Promise<PayPalOrder> {
    const res = await call(() =>
      this.orders.createOrder({
        paypalRequestId: input.requestId,
        prefer: "return=representation",
        body: {
          intent: CheckoutPaymentIntent.Capture,
          purchaseUnits: [
            {
              referenceId: input.referenceId,
              customId: input.referenceId,
              description: input.description.slice(0, 127),
              amount: { currencyCode: input.amount.currency_code, value: input.amount.value },
            },
          ],
          paymentSource: {
            paypal: {
              experienceContext: {
                brandName: input.brandName.slice(0, 127),
                shippingPreference: PaypalWalletContextShippingPreference.NoShipping,
                userAction: PaypalExperienceUserAction.PayNow,
              },
            },
          },
        },
      }),
    );
    return toPayPalOrder(res.result);
  }

  async getOrder(orderId: string): Promise<PayPalOrder> {
    const res = await call(() => this.orders.getOrder({ id: orderId }));
    return toPayPalOrder(res.result);
  }

  async captureOrder(orderId: string, requestId: string): Promise<PayPalOrder> {
    const res = await call(() =>
      this.orders.captureOrder({ id: orderId, paypalRequestId: requestId, prefer: "return=representation" }),
    );
    return toPayPalOrder(res.result);
  }

  verifyWebhookSignature(headers: WebhookHeaders, rawBody: string): Promise<boolean> {
    return this.webhooks.verifyWebhookSignature(headers, rawBody);
  }
}

/** Runs one SDK call under an overall deadline and maps SDK errors to PayPalApiError. */
async function call<T>(fn: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PayPalApiError(504, "TIMEOUT", "PayPal did not respond in time")), OVERALL_DEADLINE_MS);
  });
  try {
    return await Promise.race([fn(), deadline]);
  } catch (e) {
    throw toPayPalApiError(e);
  } finally {
    clearTimeout(timer);
  }
}

type ErrorPayload = { name?: string; message?: string; debug_id?: string; details?: { issue?: string }[] };

export function toPayPalApiError(e: unknown): unknown {
  if (e instanceof PayPalApiError) return e;
  if (e instanceof ApiError) {
    let payload = (e.result ?? null) as ErrorPayload | null;
    if (!payload && typeof e.body === "string") {
      try {
        payload = JSON.parse(e.body) as ErrorPayload;
      } catch {
        payload = null;
      }
    }
    const issue = payload?.details?.[0]?.issue ?? payload?.name ?? null;
    return new PayPalApiError(e.statusCode, issue, payload?.message ?? `PayPal request failed (${e.statusCode})`, payload?.debug_id ?? null);
  }
  return e;
}

/** Maps the SDK's camelCase Order model onto the wire-shaped type the payment service uses. */
export function toPayPalOrder(o: Order): PayPalOrder {
  if (!o.id || !o.status) throw new PayPalApiError(502, "INVALID_RESPONSE", "PayPal returned an order without id or status");
  return {
    id: o.id,
    status: o.status as PayPalOrder["status"],
    payer: o.payer?.payerId ? { payer_id: o.payer.payerId } : undefined,
    purchase_units: (o.purchaseUnits ?? []).map((pu) => ({
      reference_id: pu.referenceId,
      custom_id: pu.customId,
      amount: pu.amount ? { currency_code: pu.amount.currencyCode, value: pu.amount.value } : undefined,
      payments: pu.payments?.captures ? { captures: pu.payments.captures.map(toPayPalCapture) } : undefined,
    })),
  };
}

function toPayPalCapture(c: OrdersCapture): PayPalCapture {
  return {
    id: c.id ?? "",
    status: (c.status ?? "PENDING") as PayPalCapture["status"],
    amount: { currency_code: c.amount?.currencyCode ?? "", value: c.amount?.value ?? "" },
    custom_id: c.customId,
    final_capture: c.finalCapture,
    create_time: c.createTime,
    status_details: c.statusDetails?.reason ? { reason: c.statusDetails.reason } : undefined,
    // The SDK's OrdersCapture model has no supplementary_data. Nothing on this path needs it: the
    // order is already known here, and webhooks read the order id from the raw event JSON instead.
  };
}
