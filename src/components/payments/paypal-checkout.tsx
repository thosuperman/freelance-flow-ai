"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { toast } from "sonner";
import { FlaskConical, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  token: string;
  paymentRequestId: string;
  currency: string;
  mode: "sandbox" | "live" | "mock";
  clientId: string | null;
};

type CaptureResponse = { status: "PAID" | "ALREADY_PAID" | "PENDING" | "DECLINED"; error?: string };

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : "{}",
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Payment service error");
  return data;
}

export function PayPalCheckout({ token, paymentRequestId, currency, mode, clientId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const base = `/api/portal/${token}/payments/${paymentRequestId}`;
  const receipt = `/portal/${token}/receipt/${paymentRequestId}`;

  async function createOrder(): Promise<string> {
    const { orderId } = await post<{ orderId: string }>(`${base}/order`);
    return orderId;
  }

  async function capture(orderId: string): Promise<CaptureResponse["status"]> {
    const r = await post<CaptureResponse>(`${base}/capture`, { orderId });
    if (r.status === "PAID" || r.status === "ALREADY_PAID") {
      toast.success(mode === "mock" ? "Simulated payment confirmed" : "Payment confirmed by PayPal");
      router.push(receipt);
      router.refresh();
    } else if (r.status === "PENDING") {
      setMessage("PayPal accepted the payment but is still processing it. This page will update once PayPal confirms it — please don’t pay again.");
      router.refresh();
    }
    return r.status;
  }

  if (mode === "mock") {
    return (
      <div className="space-y-3 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-5" data-testid="mock-checkout">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <FlaskConical className="size-4" /> Simulated PayPal checkout
        </div>
        <p className="text-xs text-amber-900/80">
          This deployment runs with PAYPAL_MODE=mock for automated testing. No PayPal account is contacted and no money moves. Payments made here are
          labelled “Simulated” everywhere. Configure PayPal Sandbox credentials for a real checkout.
        </p>
        <Button
          className="h-11 w-full bg-[#ffc439] text-[#111] hover:bg-[#f2b91e]"
          disabled={busy}
          data-testid="mock-pay"
          onClick={async () => {
            setBusy(true);
            try {
              const orderId = await createOrder();
              const approve = await fetch("/api/dev/paypal-mock/approve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId }),
              });
              if (!approve.ok) throw new Error("Simulated approval failed");
              const status = await capture(orderId);
              if (status === "DECLINED") toast.error("The simulated payment was declined. Try again.");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Payment failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="animate-spin" /> : null} Approve simulated payment
        </Button>
        {message ? <p className="text-sm text-amber-900">{message}</p> : null}
      </div>
    );
  }

  if (!clientId) {
    return (
      <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
        PayPal is not configured on this deployment yet. Please contact the freelancer.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="paypal-checkout">
      <PayPalScriptProvider options={{ clientId, currency, intent: "capture", components: "buttons" }}>
        <PayPalButtons
          style={{ layout: "vertical", shape: "rect", label: "pay" }}
          disabled={busy}
          createOrder={async () => {
            try {
              return await createOrder();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not start checkout");
              throw e;
            }
          }}
          onApprove={async (data, actions) => {
            setBusy(true);
            try {
              const status = await capture(data.orderID);
              if (status === "DECLINED") {
                toast.error("Your payment method was declined. Please choose another one.");
                return actions.restart();
              }
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "We could not confirm the payment yet.");
              router.refresh();
            } finally {
              setBusy(false);
            }
          }}
          onCancel={async (data) => {
            if (data.orderID) await post(`${base}/cancel`, { orderId: data.orderID }).catch(() => {});
            toast.message("Checkout cancelled — you have not been charged.");
          }}
          onError={() => toast.error("PayPal could not complete the checkout. Please try again.")}
        />
      </PayPalScriptProvider>
      {busy ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Confirming your payment with PayPal…
        </p>
      ) : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" />
        {mode === "sandbox" ? "PayPal Sandbox — use a sandbox buyer account. No real money moves." : "Secured by PayPal. Your card details are never shared with the freelancer."}
      </p>
    </div>
  );
}
