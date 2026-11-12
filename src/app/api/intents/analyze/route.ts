import { analysisBodySchema } from "@/domain/payment-intent";
import { getPayIntentSystem } from "@/application/system";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The request body must be valid JSON." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const parsed = analysisBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Describe the payment in 5 to 2000 characters.", issues: parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message })) }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const result = await getPayIntentSystem().service.analyze(parsed.data.text);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Intent analysis failed:", error instanceof Error ? error.message : "Unknown error.");
    return Response.json({ error: "Could not analyze the request. Check the details and try again." }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
