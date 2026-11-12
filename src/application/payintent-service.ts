import { createHash, randomUUID } from "node:crypto";
import type { SqliteAuditRepository, StoredIntent, ProviderOperation } from "@/adapters/audit/sqlite-audit-repository";
import type { PolicyDecisionType } from "@/domain/policy";
import type { InvoiceProvider } from "@/adapters/paypal/mock-invoice-provider";
import { classifyWithDemoInterpreter } from "@/adapters/intent-interpreter/mock";
import { createApprovalHash } from "@/domain/approval";
import { userRequestSchema } from "@/domain/payment-intent";
import { decidePolicy } from "@/domain/policy";

export type AnalysisMode = "MOCK" | "JEV" | "GEMINI" | "RULES_FALLBACK";

interface Dependencies {
  repository: SqliteAuditRepository;
  provider: InvoiceProvider;
  interpret?: (text: string) => Promise<import("@/domain/payment-intent").Classification>;
  fallbackInterpret?: (text: string) => Promise<import("@/domain/payment-intent").Classification>;
  analysisMode?: Exclude<AnalysisMode, "RULES_FALLBACK">;
  now?: () => Date;
}

export function createPayIntentService({ repository, provider, interpret = classifyWithDemoInterpreter, fallbackInterpret, analysisMode = "MOCK", now = () => new Date() }: Dependencies) {
  return {
    async analyze(input: string) {
      const text = userRequestSchema.parse(input);
      let classification: import("@/domain/payment-intent").Classification;
      let mode: AnalysisMode = analysisMode;
      try {
        classification = await interpret(text);
      } catch {
        if (!fallbackInterpret || analysisMode === "MOCK") throw new Error("Intent interpreter is unavailable.");
        classification = await fallbackInterpret(text);
        mode = "RULES_FALLBACK";
      }
      const policy = decidePolicy(text, classification);
      const approvalHash = policy.providerAction && policy.payload ? createApprovalHash(policy.payload) : null;
      const createdAt = now().toISOString();
      const statusByDecision: Record<PolicyDecisionType, StoredIntent["status"]> = {
        CLARIFY: "NEEDS_CLARIFICATION",
        GUIDE_ONLY: "GUIDE_ONLY",
        BLOCK: "BLOCKED",
        REVIEW_REQUIRED: "PENDING_REVIEW",
      };
      const status = statusByDecision[policy.decision];
      const intent: StoredIntent = {
        intentId: randomUUID(),
        inputHash: createHash("sha256").update(text).digest("hex"),
        classification,
        policy,
        approvalHash,
        status,
        createdAt,
      };
      repository.createIntent(intent);
      return {
        intentId: intent.intentId,
        classification,
        policy,
        approvalHash,
        mode,
        createdAt,
      };
    },

    async approve(intentId: string, expectedHash: string): Promise<ProviderOperation> {
      const intent = repository.getIntent(intentId);
      if (!intent) throw new Error("Intent not found.");
      if (intent.status === "COMPLETED") {
        const existing = repository.getOperation(intentId);
        if (existing) return existing;
      }
      if (intent.policy.decision !== "REVIEW_REQUIRED" || !intent.policy.payload) throw new Error("This intent does not allow provider approval.");
      if (!intent.approvalHash || intent.approvalHash !== expectedHash || createApprovalHash(intent.policy.payload) !== expectedHash) {
        throw new Error("Approval hash does not match the reviewed payload.");
      }
      if (intent.status === "FAILED") throw new Error("This mock operation failed and requires a new reviewed intent.");

      const existing = repository.getOperation(intentId);
      if (existing) return existing;
      repository.markApproved(intentId, expectedHash, now().toISOString());
      try {
        const operation = await provider.createDraft(intent.policy.payload, intentId);
        return repository.saveOperation(operation);
      } catch (error) {
        repository.recordFailure(intentId, now().toISOString(), provider.mode);
        throw error;
      }
    },
  };
}
