"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Check, CircleDashed, CircleHelp, CornerDownRight, ExternalLink, Info, Plus, RefreshCw, X } from "lucide-react";

type Analysis = {
  intentId: string;
  classification: {
    intent: string;
    confidence: number;
    rationale: string;
    missingFields: string[];
  };
  policy: {
    decision: "CLARIFY" | "GUIDE_ONLY" | "BLOCK" | "REVIEW_REQUIRED";
    explanation: string;
    missingFields: string[];
    providerAction: string | null;
    payload?: { recipientEmail: string; amount: string; currency: string; itemName: string };
  };
  approvalHash: string | null;
  mode: "MOCK" | "JEV" | "GEMINI" | "RULES_FALLBACK";
};

type Operation = { operationId: string; externalId: string; status: string; mode: "MOCK" | "SANDBOX" };
type Event = { id: number; intentId: string; type: string; occurredAt: string; metadata: Record<string, unknown> };
type Configuration = { paymentMode: "MOCK" | "SANDBOX"; aiMode: "MOCK" | "JEV" | "GEMINI" };

const examples = [
  { label: "Split a dinner", text: "I owe Ana $35 for my share of dinner" },
  { label: "Prepare an invoice", text: "Create an invoice of USD 250 for web design for client@example.com" },
  { label: "Unclear payment", text: "Send $50 to Carlos" },
];

const clarificationOptions = [
  { label: "It's a gift", detail: "This is a personal gift; I receive no goods or services." },
  { label: "I'm paying someone back", detail: "I am repaying my share of a personal expense we split." },
  { label: "I'm buying an item", detail: "I am buying a product in exchange for this money." },
  { label: "I'm paying for a service", detail: "I am paying for a service I receive." },
];

const decisionCopy: Record<Analysis["policy"]["decision"], { title: string; className: string }> = {
  CLARIFY: { title: "Let's clarify the purpose", className: "decision-clarify" },
  GUIDE_ONLY: { title: "Here's the right path", className: "decision-guide" },
  BLOCK: { title: "Request blocked", className: "decision-block" },
  REVIEW_REQUIRED: { title: "Review before creating", className: "decision-review" },
};

const intentCopy: Record<string, string> = {
  PERSONAL_REIMBURSEMENT: "Personal reimbursement",
  PERSONAL_GIFT: "Personal gift",
  GOODS_OR_SERVICES: "Goods or services",
  BUSINESS_INVOICE: "Business invoice",
  UNKNOWN: "Purpose not confirmed",
};

const eventCopy: Record<string, string> = {
  INTENT_ANALYZED: "Intent analyzed",
  HUMAN_APPROVED: "Human approval recorded",
  MOCK_INVOICE_DRAFT_CREATED: "Demo invoice draft created",
  SANDBOX_INVOICE_DRAFT_CREATED: "PayPal Sandbox invoice draft created",
  PROVIDER_OPERATION_FAILED: "Provider operation failed",
};

function PolicyIcon({ decision }: { decision: Analysis["policy"]["decision"] }) {
  const Icon = decision === "BLOCK" ? X : decision === "GUIDE_ONLY" ? Info : decision === "CLARIFY" ? CircleHelp : Check;
  return <Icon size={19} strokeWidth={2.2} aria-hidden="true" />;
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(new Date(iso));
}

export default function Home() {
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const [sandboxSetupNeeded, setSandboxSetupNeeded] = useState(false);
  const [configuration, setConfiguration] = useState<Configuration>({ paymentMode: "MOCK", aiMode: "MOCK" });

  const loadActivity = useCallback(async () => {
    try {
      const response = await fetch("/api/activity", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json() as { events: Event[] } & Configuration;
        setEvents(data.events);
        setConfiguration({ paymentMode: data.paymentMode, aiMode: data.aiMode });
      }
    } catch {
      setError("Could not load local activity. Try refreshing it.");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/activity", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json() as { events: Event[] } & Configuration;
          setEvents(data.events);
          setConfiguration({ paymentMode: data.paymentMode, aiMode: data.aiMode });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Could not load local activity. Try refreshing it.");
      });
    return () => controller.abort();
  }, []);

  async function runAnalysis(requestText: string) {
    setLoading(true);
    setError("");
    setSandboxSetupNeeded(false);
    setOperation(null);
    setAnalysis(null);
    try {
      const response = await fetch("/api/intents/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: requestText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not analyze this request. Try again.");
      setAnalysis(data as Analysis);
      await loadActivity();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAnalysis(text);
  }

  async function clarify(detail: string) {
    const updated = `${text.trim().slice(0, 1700)}\nUser clarification: ${detail}`;
    setText(updated);
    await runAnalysis(updated);
  }

  async function approve() {
    if (!analysis?.approvalHash) return;
    setApproving(true);
    setError("");
    setSandboxSetupNeeded(false);
    try {
      const response = await fetch(`/api/intents/${analysis.intentId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalHash: analysis.approvalHash }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not record approval. Try again.");
      setOperation(data as Operation);
      await loadActivity();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Something went wrong. Try again.";
      if (message.startsWith("PayPal Sandbox denied Invoicing API access")) {
        setSandboxSetupNeeded(true);
      } else {
        setError(message);
      }
    } finally {
      setApproving(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="PayIntent home">
          <Image className="brand-logo" src="/payintent-logo.svg" width={350} height={76} alt="PayIntent" priority />
        </a>
        <div className="topbar-right">
          <span className="mode-pill"><span className="mode-dot" /> {configuration.paymentMode === "SANDBOX" ? "PAYPAL SANDBOX" : "LOCAL DEMO"} <span className="mode-separator">/</span> {configuration.aiMode === "MOCK" ? "RULES DEMO" : "AI ASSISTED"}</span>
        </div>
      </header>

      <div className="workspace" id="inicio">
        <section className="main-column" aria-labelledby="page-title">
          <h1 id="page-title">Know what you&apos;re<br /><span>paying for.</span></h1>
          <p className="intro">Describe a payment in your own words. PayIntent helps you understand whether it&apos;s personal or commercial before you take the next step.</p>

          <section className="composer-card" aria-label="Analyze a payment request">
            <div className="composer-head">
              <div>
                <span className="section-label">Your payment request</span>
                <p className="composer-hint">What is the money for?</p>
              </div>
              <span className="composer-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 7h13m0 0-3-3m3 3-3 3M20 17H7m0 0 3-3m-3 3 3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
            </div>
            <form onSubmit={analyze}>
              <label className="sr-only" htmlFor="intent-text">Describe the payment</label>
              <textarea id="intent-text" value={text} onChange={(event) => { setText(event.target.value); setAnalysis(null); setOperation(null); }} maxLength={2000} placeholder="e.g. I owe Ana $35 for my share of dinner…" rows={4} />
              <div className="composer-bottom">
                <span className="char-count">{text.length}/2000</span>
                <button className="primary-button" type="submit" disabled={loading || text.trim().length < 5}>
                  {loading ? "Analyzing…" : "Analyze payment"}<ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            </form>
            <div className="examples">
              <span className="examples-label">Try an example</span>
              {examples.map((example) => <button key={example.label} type="button" className="example-chip" onClick={() => { setText(example.text); setAnalysis(null); setOperation(null); }}>{example.label}<Plus size={14} aria-hidden="true" /></button>)}
            </div>
          </section>

          {error && <div className="error-banner" role="alert"><AlertCircle size={20} aria-hidden="true" />{error}</div>}

          {analysis && (
            <section className="result-card" aria-live="polite">
              <div className="result-topline">
                <span className="section-label">Payment guidance</span>
                <span className="confidence"><span>Confidence meter</span><i aria-hidden="true"><b style={{ width: `${Math.round(analysis.classification.confidence * 100)}%` }} /></i><strong>{Math.round(analysis.classification.confidence * 100)}%</strong></span>
              </div>
              <div className="intent-heading">
                <span className={`decision-icon ${operation ? "decision-success" : decisionCopy[analysis.policy.decision].className}`}><PolicyIcon decision={operation ? "GUIDE_ONLY" : analysis.policy.decision} /></span>
                <div>
                  <span className="intent-type">{intentCopy[analysis.classification.intent] ?? analysis.classification.intent}</span>
                  <h2>{operation ? "Invoice draft saved" : decisionCopy[analysis.policy.decision].title}</h2>
                </div>
                <span className={`decision-tag ${operation ? "decision-success" : decisionCopy[analysis.policy.decision].className}`}>{operation ? "DRAFT SAVED" : analysis.policy.decision.replaceAll("_", " ")}</span>
              </div>
              <p className="result-explanation">{operation ? (operation.mode === "SANDBOX" ? "The reviewed invoice is saved as a PayPal Sandbox draft. It has not been sent, so the recipient has not been notified and no money has moved." : "The reviewed invoice is saved as a local demo draft. No request was sent to PayPal.") : analysis.policy.explanation}</p>
              {analysis.mode === "RULES_FALLBACK" && <p className="fallback-note" role="status"><Info size={15} aria-hidden="true" />AI service was temporarily unavailable. Fixed rules completed this guidance.</p>}
              {(analysis.classification.intent === "PERSONAL_REIMBURSEMENT" || analysis.classification.intent === "PERSONAL_GIFT" || analysis.classification.intent === "GOODS_OR_SERVICES") && (
                <p className="approval-note"><a href="https://www.paypal.com/us/cshelp/article/whats-the-difference-between-friends-and-family-or-goods-and-services-payments-help277" target="_blank" rel="noopener noreferrer">Read PayPal&apos;s explanation of payment types <ExternalLink size={12} aria-hidden="true" /></a></p>
              )}
              <div className="rationale"><CornerDownRight className="rationale-mark" size={16} aria-hidden="true" /><span>{analysis.classification.rationale}</span></div>

              {analysis.policy.missingFields.length > 0 && (
                <div className="missing-fields"><span className="section-label">More information needed</span><div>{analysis.policy.missingFields.map((field) => <span className="field-chip" key={field}>{field.replace(/([A-Z])/g, " $1").toLowerCase()}</span>)}</div></div>
              )}

              {analysis.policy.decision === "CLARIFY" && analysis.policy.missingFields.includes("paymentPurpose") && (
                <div className="clarification-box">
                  <span className="section-label">One question to continue</span>
                  <p>What are you receiving in exchange for this money?</p>
                  <div className="clarification-options">
                    {clarificationOptions.map((option) => <button type="button" key={option.label} onClick={() => void clarify(option.detail)} disabled={loading}>{option.label}<ArrowRight size={14} aria-hidden="true" /></button>)}
                  </div>
                </div>
              )}

              {analysis.policy.payload && !operation && (
                <div className="invoice-preview">
                  <div className="preview-heading"><div><span className="section-label">Exact draft preview</span><p>{configuration.paymentMode === "SANDBOX" ? "A draft will be created in PayPal Sandbox" : "A local demo draft will be prepared"}</p></div><span className="preview-badge">NOT SENT</span></div>
                  <dl className="payload-grid">
                    <div><dt>Recipient</dt><dd>{analysis.policy.payload.recipientEmail}</dd></div>
                    <div><dt>Amount</dt><dd>{analysis.policy.payload.currency} {analysis.policy.payload.amount}</dd></div>
                    <div className="payload-wide"><dt>Item</dt><dd>{analysis.policy.payload.itemName}</dd></div>
                  </dl>
                  <div className="approval-row">
                    <span className="approval-hash">Review fingerprint <code>{analysis.approvalHash?.slice(0, 12)}…</code></span>
                    <button className="approve-button" type="button" onClick={approve} disabled={approving}>{approving ? "Creating…" : configuration.paymentMode === "SANDBOX" ? "Create Sandbox draft" : "Approve demo draft"}<ArrowRight size={16} aria-hidden="true" /></button>
                  </div>
                  <p className="approval-note">Approval is bound to these exact details. {configuration.paymentMode === "SANDBOX" ? "The test draft is not sent or paid." : "No request is sent to PayPal."}</p>
                  {sandboxSetupNeeded && (
                    <section className="sandbox-setup" role="status" aria-live="polite">
                      <span className="section-label">Sandbox setup needed</span>
                      <strong>Invoicing access is not enabled for this app.</strong>
                      <p>Request the Invoicing API permission, then associate an eligible Sandbox Business account. Create a new reviewed draft after the permission is active.</p>
                      <a href="https://developer.paypal.com/dashboard/applications" target="_blank" rel="noopener noreferrer">Open Developer Dashboard <ExternalLink size={13} aria-hidden="true" /></a>
                    </section>
                  )}
                </div>
              )}

              {operation && (
                <div className="operation-result" role="status">
                  <span className="operation-check"><Check size={17} strokeWidth={2.4} aria-hidden="true" /></span>
                  <div><strong>{operation.mode === "SANDBOX" ? "Saved as an unsent Sandbox draft" : "Saved as a local demo draft"}</strong><span>{operation.mode === "SANDBOX" ? "Recipient not notified · no money moved" : "No request sent to PayPal"}</span><code>{operation.externalId} · {operation.status}</code></div>
                  <span className="mock-stamp">{operation.mode === "SANDBOX" ? "SANDBOX" : "DEMO"}</span>
                </div>
              )}
            </section>
          )}
        </section>

        <aside className="side-column" aria-label="Safety and activity">
          <section className="guardrail-card">
            <div className="guardrail-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5 19 6v5.2c0 4.3-2.9 7.4-7 9.3-4.1-1.9-7-5-7-9.3V6l7-2.5Z" stroke="currentColor" strokeWidth="1.5"/><path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <span className="section-label">You stay in control</span>
            <h2>Guidance first.<br />Your decision, always.</h2>
            <p>Personal transfers are never sent here. Business invoice drafts require your review of the exact details.</p>
            <div className="guardrail-rule"><Check size={15} aria-hidden="true" /><span>Fixed rules govern every action</span></div>
            <div className="guardrail-rule"><Check size={15} aria-hidden="true" /><span>Nothing happens before approval</span></div>
            <div className="guardrail-rule"><Check size={15} aria-hidden="true" /><span>Every decision has a local record</span></div>
          </section>

          <section className="activity-card">
            <div className="activity-header"><div><span className="section-label">Activity</span><h2>Recent decisions</h2></div><span className="activity-count">{events.length.toString().padStart(2, "0")}</span></div>
            {events.length === 0 ? (
              <div className="empty-activity"><CircleDashed className="empty-orbit" size={25} aria-hidden="true" /><p>Your decisions will appear here.</p><span>Local activity only</span></div>
            ) : (
              <ol className="event-list">{events.slice(-6).reverse().map((item) => (
                <li key={item.id} className="event-row"><span className={`event-dot ${item.type.endsWith("INVOICE_DRAFT_CREATED") ? "event-dot-success" : ""}`} /><div><strong>{eventCopy[item.type] ?? item.type}</strong><span>{String(item.metadata.decision ?? item.metadata.externalId ?? "")}</span></div><time>{formatTime(item.occurredAt)}</time></li>
              ))}</ol>
            )}
            <button type="button" className="activity-refresh" onClick={() => void loadActivity()}>Refresh activity <RefreshCw size={15} aria-hidden="true" /></button>
          </section>

          <div className="privacy-note"><p><strong>Local prototype.</strong> Your original request text is not stored; the log keeps hashes and structured decision data.</p></div>
        </aside>
      </div>

      <footer className="footer"><span>PayIntent <span className="footer-dot">·</span> Hackathon prototype</span><span>No real money moves · {configuration.paymentMode === "SANDBOX" ? "Connected to PayPal Sandbox" : "Not connected to PayPal"}</span></footer>
    </main>
  );
}
