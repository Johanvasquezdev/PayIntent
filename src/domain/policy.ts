import type { Classification, InvoiceDraftPayload } from "./payment-intent";
import { invoiceDraftPayloadSchema } from "./payment-intent";

export type PolicyDecisionType = "CLARIFY" | "GUIDE_ONLY" | "BLOCK" | "REVIEW_REQUIRED";

export interface PolicyResult {
  decision: PolicyDecisionType;
  explanation: string;
  missingFields: string[];
  providerAction: "CREATE_INVOICE_DRAFT" | null;
  payload?: InvoiceDraftPayload;
}

const adversarialIntent = /\b(?:ignore|ignora|bypass|override|elude|saltate)\b.{0,100}\b(?:rule|regla|policy|pol[ií]tica|gift|regalo|business|compra)\b/i;

export function decidePolicy(text: string, classification: Classification): PolicyResult {
  if (adversarialIntent.test(text)) {
    return {
      decision: "BLOCK",
      explanation: "This request tries to change how the payment purpose is represented. Describe the real purpose to continue.",
      missingFields: [],
      providerAction: null,
    };
  }
  if ((classification.intent === "PERSONAL_REIMBURSEMENT" || classification.intent === "PERSONAL_GIFT") && /\b(?:compr\w*|buy|purchase|product\w*|servic\w*|venta|vendedor|seller|factura|invoice)\b/i.test(text)) {
    return {
      decision: "CLARIFY",
      explanation: "This also mentions a purchase or service. Confirm whether you receive something in exchange before choosing a payment type. Do not use a personal transfer for a sale.",
      missingFields: ["paymentPurpose"],
      providerAction: null,
    };
  }
  if (classification.intent === "PERSONAL_REIMBURSEMENT" || classification.intent === "PERSONAL_GIFT") {
    return {
      decision: "GUIDE_ONLY",
      explanation: "This looks like a personal gift or reimbursement. If Friends and Family is available on your PayPal account, make sure no goods or services are exchanged. It does not include Purchase Protection. Check the payment type and fees in PayPal before sending.",
      missingFields: [],
      providerAction: null,
    };
  }
  if (classification.intent === "GOODS_OR_SERVICES") {
    return {
      decision: "GUIDE_ONLY",
      explanation: "This looks like a purchase or service. Use Goods and Services in PayPal when available. Eligible purchases may have Purchase Protection. Choosing Friends and Family for a sale can remove that protection.",
      missingFields: [],
      providerAction: null,
    };
  }
  if (classification.intent === "UNKNOWN" || classification.requiresClarification) {
    return {
      decision: "CLARIFY",
      explanation: "The reason for this payment is still unclear. Tell us whether it is a reimbursement, gift, purchase or service, or a business invoice.",
      missingFields: classification.missingFields,
      providerAction: null,
    };
  }
  if (classification.intent !== "BUSINESS_INVOICE") {
    return { decision: "CLARIFY", explanation: "There is not enough information to prepare an action.", missingFields: classification.missingFields, providerAction: null };
  }

  if (classification.currency && !["USD", "EUR", "GBP"].includes(classification.currency)) {
    return {
      decision: "CLARIFY",
      explanation: `This demo cannot prepare an invoice draft in ${classification.currency}. State the amount in USD, EUR, or GBP only if that is the actual invoice currency.`,
      missingFields: ["currency"],
      providerAction: null,
    };
  }

  const parsed = invoiceDraftPayloadSchema.safeParse({
    recipientEmail: classification.recipientEmail,
    amount: classification.amount,
    currency: classification.currency,
    itemName: classification.itemName,
  });
  if (!parsed.success) {
    const fields = ["recipientEmail", "amount", "currency", "itemName"] as const;
    return {
      decision: "CLARIFY",
      explanation: "An invoice draft needs a recipient email, exact amount and currency, and an item description. Add the missing details and analyze again.",
      missingFields: fields.filter((field) => !classification[field] || (field === "amount" && Number(classification.amount) <= 0)),
      providerAction: null,
    };
  }
  return {
    decision: "REVIEW_REQUIRED",
    explanation: "This looks like a business invoice. Review the exact recipient, amount, currency, and item. Approval creates a draft only; it does not send it.",
    missingFields: [],
    providerAction: "CREATE_INVOICE_DRAFT",
    payload: parsed.data,
  };
}
