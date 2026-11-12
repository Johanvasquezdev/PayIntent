import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyWithJev } from "./jev";

afterEach(() => vi.unstubAllGlobals());

describe("Jev interpreter", () => {
  it("maps a confident typed decision without giving the model payment authority", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ answers: { paymentPurpose: { type: "choice", choice: "GOODS_OR_SERVICES", confidence: 0.91 } } })));
    const result = await classifyWithJev("I am buying a camera from a friend for USD 50", "test-key");
    expect(result.intent).toBe("GOODS_OR_SERVICES");
    expect(result.suggestedAction).toBe("explain");
  });

  it("asks for clarification when model confidence is low", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ answers: { paymentPurpose: { type: "choice", choice: "PERSONAL_GIFT", confidence: 0.52 } } })));
    const result = await classifyWithJev("Pay John USD 50", "test-key");
    expect(result.intent).toBe("UNKNOWN");
    expect(result.requiresClarification).toBe(true);
  });
});
