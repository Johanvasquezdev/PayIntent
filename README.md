# PayIntent AI

**Understand the payment. Choose the right path. Stay in control.**

PayIntent is an intent-first payment assistant prototype. It separates personal payment guidance from commercial invoice preparation, applies deterministic safety rules, binds human approval to the exact preview, and records an audit trail.

## Current status

The app works without credentials in **DEMO · MOCK** mode. Gemini 3.1 Flash-Lite has been verified live for classification. PayPal Sandbox Invoicing v2 is also verified: the app creates an unsent draft only after deterministic rules and explicit review. P2P transfers remain guidance only.

Personal reimbursements and gifts stay informational. An ambiguous request asks for purpose. A commercial purchase receives guidance toward the official checkout flow. Only a complete business invoice request can reach the mock draft review.

## Requirements

- Node.js `24.22.1` or later in the Node 24 line (`node:sqlite` is used; SQLite is Release Candidate in Node 24).
- npm.

## Run locally

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. The app creates a local SQLite file at `data/payintent.db`. To change the location, set `DATABASE_PATH` before starting the process. The `.env.example` contains only non-secret defaults.

## Connect PayPal Sandbox and AI

Edit the ignored `.env.local` in the project root:

```dotenv
PAYINTENT_MODE=sandbox
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
PAYPAL_SANDBOX_BUSINESS_EMAIL=your_sandbox_business_email
GEMINI_API_KEY=your_google_ai_studio_api_key
```

Use a PayPal Sandbox **business** account, associate the REST app with that account, and request the Invoicing API permission on the app details page. Set `PAYPAL_SANDBOX_BUSINESS_EMAIL` to that account's exact email from **Testing Tools → Sandbox Accounts → ⋮ → View/Edit Account**. Confirm the OAuth token includes an Invoicing scope before testing invoice creation. Replace `GEMINI_API_KEY` with `TYPESAFE_API_KEY` if you want Jev instead. If both keys are set, Jev takes precedence. Restart `npm run dev` after editing `.env.local`. Do not commit or paste keys into chat.

The invoice action creates a **draft only**. It does not email the recipient or capture funds. A sandbox buyer email and synthetic invoice details are suitable for testing. The UI states which payment provider and AI mode are active.

Next.js is configured to use Webpack because the current Windows environment cannot load the installed SWC native binding; Webpack builds successfully with the available WASM fallback.

## Test and verify

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

## Safety and privacy limits

- Never add live PayPal credentials to this prototype. There is no live mode.
- Keep Sandbox and AI credentials in local environment variables; do not commit them or paste them into chat.
- The original request is not stored. SQLite stores the classification/policy preview needed for review, including the recipient email for a business invoice, plus hashes and audit metadata. Keep test data synthetic and the local database private.
- This demo has no authentication or multi-user isolation. Do not expose it publicly or use real customer/payment data.
- The mock classifier is a phrase-based demo. Jev and Gemini may also misclassify natural language. Users must verify purpose and fields; the server applies fixed rules and requires exact approval before invoice creation.

## PayPal integration roadmap

PayPal Invoicing v2 draft creation is implemented and verified in Sandbox. It creates only a `DRAFT`; sending an invoice is a separate excluded operation. PayPal Orders v2 is for commercial checkout with buyer approval; it is not a P2P/Friends & Family API.

See [architecture and acceptance phases](docs/ARCHITECTURE.md), [technical research](docs/RESEARCH.md), [decisions](docs/DECISIONS.md), and [test results](docs/TEST-REPORT.md).

## Presentation assets

The English [submission copy](docs/SUBMISSION.md) and [44-second video script](docs/VIDEO-SCRIPT.md) are ready for Devpost. The programmable film lives in `presentation/video` and renders at 60 fps:

```powershell
python presentation/video/make_audio.py
python presentation/video/render.py
```
