import { afterEach, describe, expect, it, vi } from "vitest";
import { SandboxInvoiceProvider } from "./sandbox-invoice-provider";

afterEach(() => vi.unstubAllGlobals());

describe("PayPal Sandbox draft adapter", () => {
  it("authenticates server-side and creates one unsent invoice with a stable request ID", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Response.json(calls.length === 1 ? { access_token: "sandbox-token" } : { href: "https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-DEMO-123" }, { status: calls.length === 1 ? 200 : 201 });
    }));
    const provider = new SandboxInvoiceProvider("client-id", "client-secret", "merchant@example.com");
    const result = await provider.createDraft({ recipientEmail: "buyer@example.com", amount: "25.00", currency: "USD", itemName: "Website design" }, "stable-id");

    expect(result).toMatchObject({ externalId: "INV2-DEMO-123", status: "DRAFT", mode: "SANDBOX" });
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe("https://api-m.sandbox.paypal.com/v1/oauth2/token");
    expect(calls[1].url).toBe("https://api-m.sandbox.paypal.com/v2/invoicing/invoices");
    expect(new Headers(calls[1].init.headers).get("PayPal-Request-Id")).toBe("stable-id");
    expect(JSON.parse(String(calls[1].init.body)).items[0].unit_amount.value).toBe("25.00");
    expect(JSON.parse(String(calls[1].init.body)).invoicer.email_address).toBe("merchant@example.com");
  });

  it("refuses a failed PayPal draft response", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls += 1;
      return calls === 1 ? Response.json({ access_token: "sandbox-token" }) : Response.json({ name: "PERMISSION_DENIED" }, { status: 403 });
    }));
    const provider = new SandboxInvoiceProvider("client-id", "client-secret");
    await expect(provider.createDraft({ recipientEmail: "buyer@example.com", amount: "25.00", currency: "USD", itemName: "Website design" }, "stable-id"))
      .rejects.toThrow("PayPal Sandbox denied Invoicing API access (403).");
  });
});
