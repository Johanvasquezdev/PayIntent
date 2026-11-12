import { createHash, timingSafeEqual } from "node:crypto";

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function createApprovalHash(payload: unknown): string {
  return createHash("sha256").update(canonicalize(payload)).digest("hex");
}

export function verifyApproval(expectedHash: string, payload: unknown): boolean {
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(createApprovalHash(payload), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
