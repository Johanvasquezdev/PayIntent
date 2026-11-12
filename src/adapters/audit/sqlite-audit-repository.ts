import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import type { Classification, InvoiceDraftPayload } from "@/domain/payment-intent";
import type { PolicyResult } from "@/domain/policy";

export type AuditEventType = "INTENT_ANALYZED" | "HUMAN_APPROVED" | "MOCK_INVOICE_DRAFT_CREATED" | "SANDBOX_INVOICE_DRAFT_CREATED" | "PROVIDER_OPERATION_FAILED";

export interface AuditEvent {
  id: number;
  intentId: string;
  type: AuditEventType;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export interface StoredIntent {
  intentId: string;
  inputHash: string;
  classification: Classification;
  policy: PolicyResult;
  approvalHash: string | null;
  status: "NEEDS_CLARIFICATION" | "GUIDE_ONLY" | "BLOCKED" | "PENDING_REVIEW" | "APPROVED_PENDING" | "COMPLETED" | "FAILED";
  createdAt: string;
}

export interface ProviderOperation {
  intentId: string;
  operationId: string;
  externalId: string;
  status: "DRAFT" | "FAILED";
  mode: "MOCK" | "SANDBOX";
  createdAt: string;
}

function json<T>(value: string): T {
  return JSON.parse(value) as T;
}

export class SqliteAuditRepository {
  readonly path: string;
  private readonly db: DatabaseSync;
  private closed = false;

  constructor(path = process.env.DATABASE_PATH ?? "./data/payintent.db") {
    this.path = path === ":memory:" ? path : isAbsolute(path) ? path : resolve(path);
    if (this.path !== ":memory:") mkdirSync(dirname(this.path), { recursive: true });
    this.db = new DatabaseSync(this.path);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS intents (
        intent_id TEXT PRIMARY KEY,
        input_hash TEXT NOT NULL,
        classification_json TEXT NOT NULL,
        policy_json TEXT NOT NULL,
        approval_hash TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        intent_id TEXT NOT NULL REFERENCES intents(intent_id),
        type TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS audit_events_intent_id ON audit_events(intent_id, id);
      CREATE TABLE IF NOT EXISTS provider_operations (
        intent_id TEXT PRIMARY KEY REFERENCES intents(intent_id),
        operation_id TEXT NOT NULL UNIQUE,
        external_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        mode TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  createIntent(intent: StoredIntent): void {
    this.transaction(() => {
      this.db.prepare(`INSERT INTO intents
        (intent_id, input_hash, classification_json, policy_json, approval_hash, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(intent.intentId, intent.inputHash, JSON.stringify(intent.classification), JSON.stringify(intent.policy), intent.approvalHash, intent.status, intent.createdAt);
      this.appendEvent(intent.intentId, "INTENT_ANALYZED", {
        decision: intent.policy.decision,
        intent: intent.classification.intent,
        inputHash: intent.inputHash,
        approvalHash: intent.approvalHash,
      });
    });
  }

  getIntent(intentId: string): StoredIntent | null {
    const row = this.db.prepare("SELECT * FROM intents WHERE intent_id = ?").get(intentId) as Record<string, string> | undefined;
    if (!row) return null;
    return {
      intentId: row.intent_id,
      inputHash: row.input_hash,
      classification: json<Classification>(row.classification_json),
      policy: json<PolicyResult>(row.policy_json),
      approvalHash: row.approval_hash ?? null,
      status: row.status as StoredIntent["status"],
      createdAt: row.created_at,
    };
  }

  markApproved(intentId: string, expectedHash: string, occurredAt: string): StoredIntent {
    return this.transaction(() => {
      const intent = this.getIntent(intentId);
      if (!intent) throw new Error("Intent not found.");
      if (intent.status !== "PENDING_REVIEW" && intent.status !== "APPROVED_PENDING") throw new Error("Intent is not awaiting approval.");
      if (!intent.approvalHash || intent.approvalHash !== expectedHash) throw new Error("Approval hash does not match the reviewed payload.");
      if (intent.status === "PENDING_REVIEW") {
        this.db.prepare("UPDATE intents SET status = 'APPROVED_PENDING' WHERE intent_id = ?").run(intentId);
        this.appendEvent(intentId, "HUMAN_APPROVED", { approvalHash: expectedHash, approvedAt: occurredAt });
      }
      return this.getIntent(intentId)!;
    });
  }

  saveOperation(operation: ProviderOperation): ProviderOperation {
    return this.transaction(() => {
      this.db.prepare(`INSERT OR IGNORE INTO provider_operations
        (intent_id, operation_id, external_id, status, mode, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(operation.intentId, operation.operationId, operation.externalId, operation.status, operation.mode, operation.createdAt);
      const stored = this.getOperation(operation.intentId);
      if (!stored) throw new Error("Could not persist provider operation.");
      this.db.prepare("UPDATE intents SET status = ? WHERE intent_id = ?").run(stored.status === "DRAFT" ? "COMPLETED" : "FAILED", operation.intentId);
      if (stored.status === "DRAFT") this.appendEvent(operation.intentId, stored.mode === "SANDBOX" ? "SANDBOX_INVOICE_DRAFT_CREATED" : "MOCK_INVOICE_DRAFT_CREATED", { externalId: stored.externalId, mode: stored.mode, status: stored.status });
      return stored;
    });
  }

  recordFailure(intentId: string, occurredAt: string, mode: "MOCK" | "SANDBOX"): void {
    this.transaction(() => {
      this.db.prepare("UPDATE intents SET status = 'FAILED' WHERE intent_id = ?").run(intentId);
      this.appendEvent(intentId, "PROVIDER_OPERATION_FAILED", { occurredAt, mode, message: "Provider adapter failed." });
    });
  }

  getOperation(intentId: string): ProviderOperation | null {
    const row = this.db.prepare("SELECT * FROM provider_operations WHERE intent_id = ?").get(intentId) as Record<string, string> | undefined;
    return row ? {
      intentId: row.intent_id,
      operationId: row.operation_id,
      externalId: row.external_id,
      status: row.status as ProviderOperation["status"],
      mode: row.mode as ProviderOperation["mode"],
      createdAt: row.created_at,
    } : null;
  }

  listEvents(intentId: string): AuditEvent[] {
    const rows = this.db.prepare("SELECT * FROM audit_events WHERE intent_id = ? ORDER BY id ASC").all(intentId) as Array<Record<string, string | number>>;
    return rows.map((row) => ({
      id: Number(row.id),
      intentId: String(row.intent_id),
      type: String(row.type) as AuditEventType,
      occurredAt: String(row.occurred_at),
      metadata: json<Record<string, unknown>>(String(row.metadata_json)),
    }));
  }

  listRecentEvents(limit = 12): AuditEvent[] {
    const rows = this.db.prepare("SELECT * FROM audit_events ORDER BY id DESC LIMIT ?").all(limit) as Array<Record<string, string | number>>;
    return rows.reverse().map((row) => ({
      id: Number(row.id),
      intentId: String(row.intent_id),
      type: String(row.type) as AuditEventType,
      occurredAt: String(row.occurred_at),
      metadata: json<Record<string, unknown>>(String(row.metadata_json)),
    }));
  }

  close(): void {
    if (!this.closed) {
      this.db.close();
      this.closed = true;
    }
  }

  private appendEvent(intentId: string, type: AuditEventType, metadata: Record<string, unknown>): void {
    this.db.prepare("INSERT INTO audit_events (intent_id, type, occurred_at, metadata_json) VALUES (?, ?, ?, ?)")
      .run(intentId, type, new Date().toISOString(), JSON.stringify(metadata));
  }

  private transaction<T>(callback: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = callback();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}
