import { z } from "zod";
import { getPayIntentSystem } from "@/application/system";

export const runtime = "nodejs";

const approvalSchema = z.object({ approvalHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();

export async function POST(request: Request, context: { params: Promise<{ intentId: string }> }): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The request body must be valid JSON." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const parsed = approvalSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "The approval fingerprint is invalid." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const { intentId } = await context.params;
  if (!z.uuid().safeParse(intentId).success) return Response.json({ error: "Invalid approval request." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    const operation = await getPayIntentSystem().service.approve(intentId, parsed.data.approvalHash);
    return Response.json(operation, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Approval failed.";
    const status = message === "Intent not found." ? 404 : 409;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
