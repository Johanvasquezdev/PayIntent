import { getPayIntentSystem } from "@/application/system";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const system = getPayIntentSystem();
  const events = system.repository.listRecentEvents(20);
  return Response.json({ paymentMode: system.paymentMode, aiMode: system.aiMode, events }, { headers: { "Cache-Control": "no-store" } });
}
