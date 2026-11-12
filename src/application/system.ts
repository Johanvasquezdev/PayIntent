import { SqliteAuditRepository } from "@/adapters/audit/sqlite-audit-repository";
import { MockInvoiceProvider } from "@/adapters/paypal/mock-invoice-provider";
import { SandboxInvoiceProvider } from "@/adapters/paypal/sandbox-invoice-provider";
import { classifyWithJev } from "@/adapters/intent-interpreter/jev";
import { classifyWithGemini } from "@/adapters/intent-interpreter/gemini";
import { classifyWithDemoInterpreter } from "@/adapters/intent-interpreter/mock";
import { createPayIntentService } from "./payintent-service";

interface PayIntentSystem {
  repository: SqliteAuditRepository;
  service: ReturnType<typeof createPayIntentService>;
  paymentMode: "MOCK" | "SANDBOX";
  aiMode: "MOCK" | "JEV" | "GEMINI";
}

const globalForPayIntent = globalThis as typeof globalThis & { payIntentSystem?: PayIntentSystem };

export function getPayIntentSystem(): PayIntentSystem {
  if (!globalForPayIntent.payIntentSystem) {
    const repository = new SqliteAuditRepository();
    const useSandbox = process.env.PAYINTENT_MODE === "sandbox";
    if (useSandbox && (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET)) {
      throw new Error("PayPal Sandbox mode requires PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.");
    }
    const provider = useSandbox
      ? new SandboxInvoiceProvider(process.env.PAYPAL_CLIENT_ID!, process.env.PAYPAL_CLIENT_SECRET!, process.env.PAYPAL_SANDBOX_BUSINESS_EMAIL)
      : new MockInvoiceProvider();
    const jevKey = process.env.TYPESAFE_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const aiMode = jevKey ? "JEV" : geminiKey ? "GEMINI" : "MOCK";
    const service = createPayIntentService({
      repository,
      provider,
      interpret: jevKey ? (text) => classifyWithJev(text, jevKey) : geminiKey ? (text) => classifyWithGemini(text, geminiKey) : undefined,
      fallbackInterpret: aiMode === "MOCK" ? undefined : classifyWithDemoInterpreter,
      analysisMode: aiMode,
    });
    globalForPayIntent.payIntentSystem = { repository, service, paymentMode: useSandbox ? "SANDBOX" : "MOCK", aiMode };
  }
  return globalForPayIntent.payIntentSystem;
}
