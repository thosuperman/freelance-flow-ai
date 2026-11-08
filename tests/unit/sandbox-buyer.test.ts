import { afterEach, describe, expect, it } from "vitest";
import { sandboxBuyer } from "@/features/demo/sandbox-buyer";

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
});

function set(mode: string, email?: string, password?: string) {
  process.env.PAYPAL_MODE = mode;
  if (email === undefined) delete process.env.DEMO_PAYPAL_BUYER_EMAIL;
  else process.env.DEMO_PAYPAL_BUYER_EMAIL = email;
  if (password === undefined) delete process.env.DEMO_PAYPAL_BUYER_PASSWORD;
  else process.env.DEMO_PAYPAL_BUYER_PASSWORD = password;
}

describe("public Sandbox buyer login", () => {
  it("is shown in Sandbox mode when configured", () => {
    set("sandbox", "sb-test@personal.example.com", "pw");
    expect(sandboxBuyer()).toEqual({ email: "sb-test@personal.example.com", password: "pw" });
  });
  it("is never shown in live mode", () => {
    set("live", "sb-test@personal.example.com", "pw");
    expect(sandboxBuyer()).toBeNull();
  });
  it("is not shown when unset", () => {
    set("sandbox");
    expect(sandboxBuyer()).toBeNull();
  });
  it("refuses anything that is not a PayPal Sandbox address", () => {
    set("sandbox", "someone@gmail.com", "pw");
    expect(sandboxBuyer()).toBeNull();
  });
});
