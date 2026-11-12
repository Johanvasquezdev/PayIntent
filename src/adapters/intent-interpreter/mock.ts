import { classificationSchema, type Classification } from "@/domain/payment-intent";

function extractAmount(text: string): string | undefined {
  const amount = text.match(/(?:\b(?:USD|EUR|GBP|DOP)\s*|\$\s*)(\d{1,8}(?:[.,]\d{1,2})?)(?![\w@])/i)?.[1]
    ?? text.match(/\b(?:factura\s+de|invoice\s+(?:for|of)|importe\s+de|amount\s+of)\s+(\d{1,8}(?:[.,]\d{1,2})?)(?![\w@])/i)?.[1];
  const normalized = amount?.replace(",", ".");
  return normalized && Number(normalized) > 0 ? normalized : undefined;
}

function extractCurrency(text: string): string | undefined {
  return text.match(/\b(USD|EUR|GBP|DOP)\b/i)?.[1].toUpperCase();
}

function extractItem(text: string): string | undefined {
  const labeled = text.match(/\b(?:item|service|description)\s*:\s*(.+?)(?=\s*(?:[,;.]\s*)?\b(?:amount|recipient)\s*:|$)/i)?.[1];
  if (labeled) return labeled.trim().replace(/[.,;!?]+$/, "").slice(0, 120);
  const segment = text.match(/\b(?:por|for)\s+(.+?)(?=\s+[\w.+-]+@[\w.-]+\.[A-Z]{2,}|$)/i)?.[1];
  const cleaned = segment?.replace(/\s+(?:para|to|for)$/i, "").trim().replace(/[.,;!?]+$/, "");
  return cleaned ? cleaned.slice(0, 120) : undefined;
}

export async function classifyWithDemoInterpreter(text: string): Promise<Classification> {
  const lower = text.toLocaleLowerCase("es");
  const common = {
    confidence: 0.88,
    missingFields: [] as string[],
    recipientEmail: text.match(/[\w.+-]+@[\w.-]+\.[A-Z]{2,}/i)?.[0],
    amount: extractAmount(text),
    currency: extractCurrency(text),
  };
  let result: Classification;
  if (/\b(?:factura|invoice)\b/.test(lower) && /\b(?:crea|crear|prepara|make|create)\b/.test(lower)) {
    result = {
      ...common,
      intent: "BUSINESS_INVOICE",
      rationale: "The request explicitly asks to create or prepare an invoice.",
      requiresClarification: false,
      suggestedAction: "create_invoice_draft",
      itemName: extractItem(text),
    };
  } else if (/\b(?:regalo|gift|cumplea[nñ]os)\b/.test(lower)) {
    result = { ...common, intent: "PERSONAL_GIFT", rationale: "The request describes a personal gift.", requiresClarification: false, suggestedAction: "explain" };
  } else if (/\b(?:debo|devolver|reembols|mi parte|mitad|split|dinner|cena)\b/.test(lower)) {
    result = { ...common, intent: "PERSONAL_REIMBURSEMENT", rationale: "The request describes repaying or splitting a personal expense.", requiresClarification: false, suggestedAction: "explain" };
  } else if (/\b(?:compra|comprar|producto|servicio|vendedor|aud[ií]fonos|buy|purchase|seller)\b/.test(lower)) {
    result = { ...common, intent: "GOODS_OR_SERVICES", rationale: "The request describes buying an item or paying for a service.", requiresClarification: false, suggestedAction: "explain" };
  } else {
    result = { ...common, intent: "UNKNOWN", rationale: "The request does not explain the payment purpose clearly enough.", missingFields: ["paymentPurpose"], requiresClarification: true, suggestedAction: "clarify" };
  }
  return classificationSchema.parse(result);
}
