import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPayIntentService } from "./payintent-service";
import { SqliteAuditRepository } from "@/adapters/audit/sqlite-audit-repository";
import { MockInvoiceProvider } from "@/adapters/paypal/mock-invoice-provider";

const folders: string[] = [];
const repositories: SqliteAuditRepository[] = [];

function createHarness() {
  const folder = mkdtempSync(join(tmpdir(), "payintent-test-"));
  folders.push(folder);
  const repository = new SqliteAuditRepository(join(folder, "audit.db"));
  repositories.push(repository);
  const provider = new MockInvoiceProvider();
  const service = createPayIntentService({ repository, provider });
  return { repository, provider, service };
}

afterEach(() => {
  for (const repository of repositories.splice(0)) repository.close();
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

describe("PayIntent mock vertical slice", () => {
  it("analyzes an ambiguous request and records the decision without provider activity", async () => {
    const { repository, provider, service } = createHarness();
    const result = await service.analyze("Págale $50 a Carlos");

    expect(result.policy.decision).toBe("CLARIFY");
    expect(provider.calls).toBe(0);
    expect(repository.listEvents(result.intentId).map((event) => event.type)).toEqual(["INTENT_ANALYZED"]);
  });

  it("keeps personal payments informational and never calls a provider", async () => {
    const { repository, provider, service } = createHarness();
    const result = await service.analyze("Le debo $35 a Ana por mi parte de la cena");

    expect(result.policy.decision).toBe("GUIDE_ONLY");
    expect(provider.calls).toBe(0);
    expect(repository.listEvents(result.intentId)).toHaveLength(1);
  });

  it("falls back to deterministic rules when an AI interpreter is temporarily unavailable", async () => {
    const folder = mkdtempSync(join(tmpdir(), "payintent-test-"));
    folders.push(folder);
    const repository = new SqliteAuditRepository(join(folder, "audit.db"));
    repositories.push(repository);
    const service = createPayIntentService({
      repository,
      provider: new MockInvoiceProvider(),
      interpret: async () => { throw new Error("503"); },
      analysisMode: "GEMINI",
      fallbackInterpret: async () => ({
        intent: "PERSONAL_REIMBURSEMENT",
        confidence: 0.88,
        rationale: "The request describes a personal reimbursement.",
        missingFields: [],
        requiresClarification: false,
        suggestedAction: "explain",
      }),
    });

    const result = await service.analyze("I owe Ana $35 for dinner");
    expect(result.mode).toBe("RULES_FALLBACK");
    expect(result.policy.decision).toBe("GUIDE_ONLY");
  });

  it("requires exact approval and creates one clearly mock invoice draft", async () => {
    const { repository, provider, service } = createHarness();
    const analysis = await service.analyze("Crea una factura de USD 250 por diseñar una web para cliente@example.com");
    expect(analysis.policy.decision).toBe("REVIEW_REQUIRED");

    const result = await service.approve(analysis.intentId, analysis.approvalHash!);
    const replay = await service.approve(analysis.intentId, analysis.approvalHash!);

    expect(result.mode).toBe("MOCK");
    expect(result.status).toBe("DRAFT");
    expect(replay.operationId).toBe(result.operationId);
    expect(provider.calls).toBe(1);
    expect(repository.listEvents(analysis.intentId).map((event) => event.type)).toEqual([
      "INTENT_ANALYZED",
      "HUMAN_APPROVED",
      "MOCK_INVOICE_DRAFT_CREATED",
    ]);
  });

  it("rejects changed approval hashes without creating an operation", async () => {
    const { repository, provider, service } = createHarness();
    const analysis = await service.analyze("Crea una factura de USD 250 por diseñar una web para cliente@example.com");

    await expect(service.approve(analysis.intentId, "0".repeat(64))).rejects.toThrow(/approval/i);
    expect(provider.calls).toBe(0);
    expect(repository.getOperation(analysis.intentId)).toBeNull();
  });

  it("persists history across database connections", async () => {
    const { repository, service } = createHarness();
    const result = await service.analyze("Págale $50 a Carlos");
    const reopened = new SqliteAuditRepository(repository.path);

    expect(reopened.listEvents(result.intentId)).toHaveLength(1);
    reopened.close();
  });
});
