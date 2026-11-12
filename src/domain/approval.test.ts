import { describe, expect, it } from "vitest";
import { createApprovalHash, verifyApproval } from "./approval";

const payload = {
  intent: "BUSINESS_INVOICE",
  recipientEmail: "client@example.com",
  amount: "250.00",
  currency: "USD",
  itemName: "Website design",
};

describe("payload-bound approval", () => {
  it("produces a stable hash independent of object key order", () => {
    expect(createApprovalHash(payload)).toBe(
      createApprovalHash({ itemName: "Website design", currency: "USD", amount: "250.00", recipientEmail: "client@example.com", intent: "BUSINESS_INVOICE" }),
    );
  });

  it("rejects an approval when any reviewed field changes", () => {
    const approvedHash = createApprovalHash(payload);

    expect(verifyApproval(approvedHash, { ...payload, amount: "350.00" })).toBe(false);
  });

  it("accepts the exact reviewed payload", () => {
    expect(verifyApproval(createApprovalHash(payload), payload)).toBe(true);
  });
});
