import { z } from "zod";

export const paymentIntentTypes = [
  "PERSONAL_REIMBURSEMENT",
  "PERSONAL_GIFT",
  "GOODS_OR_SERVICES",
  "BUSINESS_INVOICE",
  "UNKNOWN",
] as const;

export const userRequestSchema = z.string().trim().min(5).max(2000);

const amountSchema = z.string().regex(/^\d{1,8}(?:\.\d{1,2})?$/, "Use a decimal amount with at most 2 places.").refine((value) => Number(value) > 0, "Amount must be greater than zero.");
const currencySchema = z.string().regex(/^[A-Z]{3}$/);
const invoiceCurrencySchema = z.enum(["USD", "EUR", "GBP"]);

export const classificationSchema = z.object({
  intent: z.enum(paymentIntentTypes),
  confidence: z.number().min(0).max(1),
  rationale: z.string().trim().min(1).max(500),
  missingFields: z.array(z.string().trim().min(1)).max(12),
  requiresClarification: z.boolean(),
  suggestedAction: z.enum(["explain", "create_invoice_draft", "create_commercial_order", "clarify"]),
  recipientEmail: z.email().optional(),
  amount: amountSchema.optional(),
  currency: currencySchema.optional(),
  itemName: z.string().trim().min(1).max(120).optional(),
}).strict();

export type PaymentIntentType = (typeof paymentIntentTypes)[number];
export type Classification = z.infer<typeof classificationSchema>;

export const analysisBodySchema = z.object({ text: userRequestSchema }).strict();

export const invoiceDraftPayloadSchema = z.object({
  recipientEmail: z.email(),
  amount: amountSchema,
  currency: invoiceCurrencySchema,
  itemName: z.string().trim().min(1).max(120),
}).strict();

export type InvoiceDraftPayload = z.infer<typeof invoiceDraftPayloadSchema>;
