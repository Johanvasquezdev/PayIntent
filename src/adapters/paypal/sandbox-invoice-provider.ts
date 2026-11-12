import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { InvoiceDraftPayload } from "@/domain/payment-intent";
import type { ProviderOperation } from "@/adapters/audit/sqlite-audit-repository";
import type { InvoiceProvider } from "./mock-invoice-provider";

const tokenSchema = z.object({ access_token: z.string().min(1) });
const draftSchema = z.object({ id: z.string().min(1).optional(), href: z.string().url().optional(), links: z.array(z.object({ href: z.string().url() })).optional() });
const baseUrl = "https://api-m.sandbox.paypal.com";

export class SandboxInvoiceProvider implements InvoiceProvider {
  readonly mode = "SANDBOX" as const;

  constructor(private readonly clientId: string, private readonly clientSecret: string, private readonly invoicerEmail?: string) {}

  async createDraft(payload: InvoiceDraftPayload, idempotencyKey: string): Promise<ProviderOperation> {
    const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!authResponse.ok) throw new Error(`PayPal Sandbox authentication failed (${authResponse.status}).`);
    const { access_token: accessToken } = tokenSchema.parse(await authResponse.json());

    const draftResponse = await fetch(`${baseUrl}/v2/invoicing/invoices`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": idempotencyKey,
      },
      body: JSON.stringify({
        detail: { currency_code: payload.currency, note: "PayIntent Sandbox draft. Not sent to the recipient." },
        invoicer: {
          name: { given_name: "PayIntent", surname: "Sandbox" },
          ...(this.invoicerEmail ? { email_address: this.invoicerEmail } : {}),
        },
        primary_recipients: [{ billing_info: { email_address: payload.recipientEmail } }],
        items: [{ name: payload.itemName, quantity: "1", unit_amount: { currency_code: payload.currency, value: payload.amount } }],
      }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!draftResponse.ok) {
      if (draftResponse.status === 403) {
        throw new Error("PayPal Sandbox denied Invoicing API access (403). Request Invoicing API permission for this app and associate it with an eligible Sandbox Business account.");
      }
      throw new Error(`PayPal Sandbox invoice creation failed (${draftResponse.status}).`);
    }
    const draft = draftSchema.parse(await draftResponse.json());
    const href = draft.href ?? draft.links?.[0]?.href;
    const externalId = draft.id ?? href?.match(/\/invoices\/([^/?#]+)/)?.[1];
    if (!externalId) throw new Error("PayPal Sandbox did not return an invoice ID.");
    return { intentId: idempotencyKey, operationId: randomUUID(), externalId, status: "DRAFT", mode: "SANDBOX", createdAt: new Date().toISOString() };
  }
}
