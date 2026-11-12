import { describe, expect, it } from "vitest";
import { classifyWithDemoInterpreter } from "./mock";
import { decidePolicy } from "@/domain/policy";

describe("demo interpreter and invoice policy", () => {
  it("does not turn digits in an email into a billable amount", async () => {
    const text = "Crea una factura por diseño para cliente2026@example.com";
    const classification = await classifyWithDemoInterpreter(text);
    expect(classification.amount).toBeUndefined();
    expect(decidePolicy(text, classification).decision).toBe("CLARIFY");
  });

  it("rejects a zero amount before invoice review", async () => {
    const text = "Crea una factura de USD 0 por diseño para cliente@example.com";
    const classification = await classifyWithDemoInterpreter(text);
    expect(decidePolicy(text, classification).decision).toBe("CLARIFY");
  });

  it("recognizes an explicitly stated amount for a draft", async () => {
    const text = "Crea una factura de USD 250 por diseñar una web para cliente@example.com";
    const classification = await classifyWithDemoInterpreter(text);
    expect(classification.amount).toBe("250");
    expect(decidePolicy(text, classification).decision).toBe("REVIEW_REQUIRED");
  });

  it("asks for an applicable currency instead of sending unsupported DOP to PayPal", async () => {
    const text = "Crea una factura de DOP 250 por diseñar una web para cliente@example.com";
    const classification = await classifyWithDemoInterpreter(text);
    expect(decidePolicy(text, classification).decision).toBe("CLARIFY");
    expect(decidePolicy(text, classification).missingFields).toContain("currency");
  });
});
