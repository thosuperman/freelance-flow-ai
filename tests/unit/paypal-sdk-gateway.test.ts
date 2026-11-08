import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@paypal/paypal-server-sdk";
import { SdkPayPalGateway, toPayPalApiError, toPayPalOrder, type OrdersApi } from "@/lib/paypal/sdk-gateway";
import { PayPalApiError } from "@/lib/paypal/types";

// Minimal ApiResponse-shaped value; the gateway only reads `result`.
const ok = <T,>(result: T) => ({ result, statusCode: 200, headers: {}, body: "" }) as never;

const sdkOrder = {
  id: "ORDER-1",
  status: "COMPLETED",
  payer: { payerId: "PAYER-9" },
  purchaseUnits: [
    {
      referenceId: "pr_1",
      customId: "pr_1",
      amount: { currencyCode: "USD", value: "450.00" },
      payments: {
        captures: [
          {
            id: "CAP-1",
            status: "COMPLETED",
            amount: { currencyCode: "USD", value: "450.00" },
            customId: "pr_1",
            finalCapture: true,
            createTime: "2026-11-07T14:56:51Z",
          },
        ],
      },
    },
  ],
};

function fakeOrders(overrides: Partial<OrdersApi> = {}): OrdersApi {
  return {
    createOrder: vi.fn(async () => ok({ id: "ORDER-1", status: "CREATED", purchaseUnits: [] })),
    getOrder: vi.fn(async () => ok(sdkOrder)),
    captureOrder: vi.fn(async () => ok(sdkOrder)),
    ...overrides,
  } as OrdersApi;
}

const verifier = { verifyWebhookSignature: vi.fn(async () => true) };

describe("PayPal Server SDK gateway", () => {
  it("maps the SDK's camelCase order onto the wire shape the payment service verifies", () => {
    expect(toPayPalOrder(sdkOrder as never)).toEqual({
      id: "ORDER-1",
      status: "COMPLETED",
      payer: { payer_id: "PAYER-9" },
      purchase_units: [
        {
          reference_id: "pr_1",
          custom_id: "pr_1",
          amount: { currency_code: "USD", value: "450.00" },
          payments: {
            captures: [
              {
                id: "CAP-1",
                status: "COMPLETED",
                amount: { currency_code: "USD", value: "450.00" },
                custom_id: "pr_1",
                final_capture: true,
                create_time: "2026-11-07T14:56:51Z",
                status_details: undefined,
              },
            ],
          },
        },
      ],
    });
  });

  it("sends the server-side amount, reference and idempotency key when creating an order", async () => {
    const orders = fakeOrders();
    const gw = new SdkPayPalGateway("sandbox", orders, verifier);
    await gw.createOrder({
      requestId: "req-1",
      referenceId: "pr_1",
      description: "Upfront deposit",
      amount: { currency_code: "USD", value: "450.00" },
      brandName: "Rivera Studio",
    });
    expect(orders.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        paypalRequestId: "req-1",
        prefer: "return=representation",
        body: expect.objectContaining({
          intent: "CAPTURE",
          purchaseUnits: [expect.objectContaining({ customId: "pr_1", amount: { currencyCode: "USD", value: "450.00" } })],
        }),
      }),
    );
  });

  it("captures with the caller's idempotency key", async () => {
    const orders = fakeOrders();
    const gw = new SdkPayPalGateway("sandbox", orders, verifier);
    const order = await gw.captureOrder("ORDER-1", "cap-req-1");
    expect(orders.captureOrder).toHaveBeenCalledWith(expect.objectContaining({ id: "ORDER-1", paypalRequestId: "cap-req-1" }));
    expect(order.purchase_units?.[0]?.payments?.captures?.[0]?.id).toBe("CAP-1");
  });

  it("turns PayPal error responses into PayPalApiError with issue and debug id", async () => {
    const err = Object.assign(Object.create(ApiError.prototype), {
      statusCode: 422,
      result: { name: "UNPROCESSABLE_ENTITY", message: "Order already captured", debug_id: "dbg-7", details: [{ issue: "ORDER_ALREADY_CAPTURED" }] },
      body: "",
    });
    const gw = new SdkPayPalGateway("sandbox", fakeOrders({ captureOrder: vi.fn(async () => Promise.reject(err)) }), verifier);
    await expect(gw.captureOrder("ORDER-1", "r")).rejects.toMatchObject({
      name: "PayPalApiError",
      status: 422,
      issue: "ORDER_ALREADY_CAPTURED",
      debugId: "dbg-7",
    });
  });

  it("reads the error payload from the raw body when the SDK did not parse it", () => {
    const err = Object.assign(Object.create(ApiError.prototype), {
      statusCode: 404,
      result: undefined,
      body: JSON.stringify({ name: "RESOURCE_NOT_FOUND", message: "Not found", debug_id: "dbg-1" }),
    });
    const mapped = toPayPalApiError(err) as PayPalApiError;
    expect(mapped).toBeInstanceOf(PayPalApiError);
    expect(mapped.issue).toBe("RESOURCE_NOT_FOUND");
  });

  it("rejects responses without an order id or status instead of guessing", () => {
    expect(() => toPayPalOrder({ status: "COMPLETED" } as never)).toThrow(PayPalApiError);
  });

  it("delegates webhook verification to the REST verifier", async () => {
    const gw = new SdkPayPalGateway("sandbox", fakeOrders(), verifier);
    const headers = { authAlgo: "a", certUrl: "c", transmissionId: "t", transmissionSig: "s", transmissionTime: "x" };
    await expect(gw.verifyWebhookSignature(headers, "{}")).resolves.toBe(true);
    expect(verifier.verifyWebhookSignature).toHaveBeenCalledWith(headers, "{}");
  });
});
