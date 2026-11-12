# PayIntent AI Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a functional, auditable mock-first slice from natural-language request to safe decision, exact preview, explicit approval, and recorded result.

**Architecture:** Next.js App Router hosts a small application layer, pure deterministic policy, mock interpreter/provider adapters, and SQLite audit repository. Browser code never receives provider credentials and no model or provider directly authorizes payment.

**Tech Stack:** Node 24.22.1, npm, Next.js, TypeScript, Zod, built-in `node:sqlite`, Vitest, Playwright (if browser execution is available).

**Spec:** `docs/ARCHITECTURE.md`; source context: `C:\Users\johan\Downloads\CODEX_HANDOFF_PAYINTENT_CODEGEIST_2026.md`.

## Global Constraints

- Personal reimbursements/gifts remain guide-only; no P2P API call.
- No live payment, no secret in browser/logs/chat, no real provider success in mock mode.
- Commercial draft requires validated fields and explicit approval tied to exact payload.
- Money values use decimal strings and currency codes, never binary float math.
- Display `DEMO / MOCK` anywhere mock decisions/results are shown.
- Codegeist/ChangeScope stays out of this repository/work.

## Review Focus

- Ambiguous recipient/purpose must clarify and make zero provider calls.
- Personal gift/reimbursement must guide only, never create mock or PayPal operation.
- Prompt injection must not override classification/policy safeguards.
- Invalid/untrusted classifier JSON must be rejected before side effects.
- Changed payload or replay must not reuse stale approval or duplicate operation.

---

### Task 1: Scaffold and test harness

**Files:** Next.js app scaffold, `package.json`, Vitest config, `.gitignore`, `.env.example`.

- [ ] Create app using documented Next.js App Router setup and Node-compatible dependencies.
- [ ] Add unit, integration, typecheck, lint, build scripts.
- [ ] Verify dependency installation and baseline production build.

### Task 2: Domain schemas and intent decisions

**Files:** `src/domain/payment-intent.ts`, `src/domain/policy.ts`, `src/domain/*.test.ts`.

- [ ] Write failing tests for malformed values, unknown purpose, personal guide-only, commercial missing fields, adversarial prompt, and valid invoice draft review.
- [ ] Verify expected RED failures.
- [ ] Implement Zod schemas, typed classification and deterministic policy.
- [ ] Verify targeted tests then complete unit suite.

### Task 3: Approval hash and audit persistence

**Files:** `src/domain/approval.ts`, audit repository, tests, SQLite migration/schema initialization.

- [ ] Write failing tests for stable canonical hash, changed-payload rejection, audit append/read.
- [ ] Verify RED; implement exact-payload confirmation and parameterized SQLite operations.
- [ ] Verify GREEN and restart-persistence test.

### Task 4: Application service and mock adapters

**Files:** interpreter mock, provider mock, application service, integration tests.

- [ ] Write failing integration tests for personal, clarify, invalid model output, business review, approval, replay/idempotency, and audit ordering.
- [ ] Verify RED; implement orchestration with provider calls only after revalidation and explicit approval.
- [ ] Verify GREEN; assert all provider operations in mock are explicitly marked mock.

### Task 5: API and professional responsive UI

**Files:** Next route handlers, home page, focused components, CSS, UI/API tests.

- [ ] Write request/response tests for Zod rejection, valid analysis, approval, and errors.
- [ ] Verify RED; add API and UI to exercise the full mock slice with mode/decision/history visible.
- [ ] Verify suite, lint, typecheck and production build.
- [ ] Run browser smoke if a browser is available; otherwise state not run.

### Task 6: Audit and handoff

**Files:** `README.md`, `.env.example`, docs status/research/decision/test report.

- [ ] Document setup and mock limitations; no credential values.
- [ ] Run final verification commands and report actual output/results.
- [ ] Review file changes and ensure no secrets or Codegeist implementation entered.
