import { describe, expect, it } from "vitest";
import { classificationSchema, userRequestSchema } from "./payment-intent";

describe("input contracts", () => {
  it("rejects empty or oversized user requests", () => {
    expect(userRequestSchema.safeParse("  ").success).toBe(false);
    expect(userRequestSchema.safeParse("x".repeat(2001)).success).toBe(false);
  });

  it("rejects classifier confidence outside 0..1", () => {
    expect(classificationSchema.safeParse({
      intent: "UNKNOWN",
      confidence: 1.2,
      rationale: "unsupported confidence",
      missingFields: [],
      requiresClarification: true,
      suggestedAction: "clarify",
    }).success).toBe(false);
  });

  it("rejects malformed money instead of coercing it into a float", () => {
    expect(classificationSchema.safeParse({
      intent: "BUSINESS_INVOICE",
      confidence: 0.95,
      rationale: "invoice",
      missingFields: [],
      requiresClarification: false,
      suggestedAction: "create_invoice_draft",
      amount: "1e3",
      currency: "USD",
      recipientEmail: "client@example.com",
      itemName: "Design",
    }).success).toBe(false);
  });
});
