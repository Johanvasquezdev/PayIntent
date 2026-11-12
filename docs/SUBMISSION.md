# PayIntent — submission copy

## Tagline

Know what you are paying for before you choose how to pay.

## Short description

PayIntent interprets a payment request, distinguishes personal transfers from goods and services, explains the implications, and asks one focused question when the purpose is unclear. Commercial invoice requests can become reviewed PayPal Sandbox drafts; personal payments remain guidance only.

## Inspiration

Sending money should be simple, yet one of the most important decisions often appears as a small payment-type choice: is this personal, or is someone receiving goods or services? People can misunderstand the difference, lose purchase protection, or represent a sale as a personal transfer. We built PayIntent to make the purpose clear before any action is taken.

## What it does

Users describe a payment in everyday language. PayIntent extracts its purpose and relevant fields, then applies deterministic rules:

- Personal gifts and reimbursements receive clear guidance and never execute inside PayIntent.
- Purchases and services are directed toward the appropriate commercial payment path.
- Ambiguous requests trigger a focused clarification question.
- Complete business invoice requests show an exact preview, bind human approval to a content fingerprint, and create an unsent PayPal Sandbox invoice draft.
- Every decision is recorded locally without retaining the original request text.

## How we built it

PayIntent is a Next.js and TypeScript application with Zod validation, a deterministic policy engine, SQLite audit events, and provider adapters. Gemini or Jev performs structured intent classification. The model can interpret language but cannot authorize a provider action. PayPal OAuth and Invoicing v2 run only on the server, and the invoice integration creates a draft without sending it or moving money.

## Challenges we ran into

PayPal's checkout and invoicing APIs model commercial payments; they are not a public Friends and Family transfer API. We therefore designed personal transfers as guidance and made a Sandbox invoice draft the only provider action. The harder engineering problem was preserving usefulness without handing financial authority to a model, so we separated probabilistic interpretation from deterministic policy and exact-content approval.

## Accomplishments that we are proud of

- A working end-to-end flow rather than a conversational wrapper.
- Human approval is cryptographically tied to the exact reviewed invoice payload.
- Ambiguous and adversarial requests cannot silently become provider operations.
- Provider calls are idempotent and every result is visibly labeled as mock or Sandbox.
- The product has a responsive, accessible English interface and a reproducible test suite.

## What we learned

AI is most useful in a payment flow when it reduces ambiguity, not when it receives unrestricted authority. Clear boundaries create a better user experience: the model explains intent, fixed rules control actions, and the person approves exact details.

## What's next for PayIntent

We would add authenticated multi-user storage, localized payment guidance, a PayPal Orders Sandbox flow with buyer approval, provider status reconciliation, and a browser side panel that can offer guidance without scraping or controlling a PayPal session.

## Demo sequence

1. Analyze `Send $50 to Carlos` and show the clarification step.
2. Choose `I'm buying an item` and show Goods and Services guidance.
3. Analyze `Create an invoice of USD 250 for web design for client@example.com`.
4. Review the exact recipient, amount, currency, item, and fingerprint.
5. Create the Sandbox draft and show the audit events.
6. Point out the visible AI/Sandbox mode badge and explain that the invoice remains unsent.
