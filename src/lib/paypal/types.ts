/** Minimal typed subset of PayPal Orders v2 / Webhooks payloads used by FreelanceFlow. */

export type PayPalMode = "sandbox" | "live" | "mock";

export type Money = { currency_code: string; value: string };

export type PayPalCapture = {
  id: string;
  status: "COMPLETED" | "PENDING" | "DECLINED" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  amount: Money;
  custom_id?: string;
  final_capture?: boolean;
  create_time?: string;
  status_details?: { reason?: string };
  supplementary_data?: { related_ids?: { order_id?: string } };
};

export type PayPalOrder = {
  id: string;
  status: "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | "PAYER_ACTION_REQUIRED";
  purchase_units?: {
    reference_id?: string;
    custom_id?: string;
    amount?: Money;
    payments?: { captures?: PayPalCapture[] };
  }[];
  payer?: { payer_id?: string };
};

export type CreateOrderInput = {
  requestId: string;
  referenceId: string;
  description: string;
  amount: Money;
  brandName: string;
};

export type WebhookHeaders = {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
};

export type PayPalWebhookEvent = {
  id: string;
  event_type: string;
  resource_type?: string;
  resource: Record<string, unknown>;
  create_time?: string;
};

export interface PayPalGateway {
  readonly mode: PayPalMode;
  createOrder(input: CreateOrderInput): Promise<PayPalOrder>;
  getOrder(orderId: string): Promise<PayPalOrder>;
  captureOrder(orderId: string, requestId: string): Promise<PayPalOrder>;
  verifyWebhookSignature(headers: WebhookHeaders, rawBody: string): Promise<boolean>;
}

export class PayPalApiError extends Error {
  readonly status: number;
  readonly issue: string | null;
  readonly debugId: string | null;
  constructor(status: number, issue: string | null, message: string, debugId: string | null = null) {
    super(message);
    this.name = "PayPalApiError";
    this.status = status;
    this.issue = issue;
    this.debugId = debugId;
  }
}
