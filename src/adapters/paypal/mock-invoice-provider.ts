import { createHash, randomUUID } from "node:crypto";
import type { InvoiceDraftPayload } from "@/domain/payment-intent";
import type { ProviderOperation } from "@/adapters/audit/sqlite-audit-repository";

export interface InvoiceProvider {
  readonly mode: "MOCK" | "SANDBOX";
  createDraft(payload: InvoiceDraftPayload, idempotencyKey: string): Promise<ProviderOperation>;
}

export class MockInvoiceProvider implements InvoiceProvider {
  readonly mode = "MOCK" as const;
  calls = 0;

  async createDraft(_payload: InvoiceDraftPayload, idempotencyKey: string): Promise<ProviderOperation> {
    this.calls += 1;
    const externalId = `MOCK-INV-${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 12).toUpperCase()}`;
    return {
      intentId: idempotencyKey,
      operationId: randomUUID(),
      externalId,
      status: "DRAFT",
      mode: "MOCK",
      createdAt: new Date().toISOString(),
    };
  }
}
