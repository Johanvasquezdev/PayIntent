# PayIntent design direction

## Product context

PayIntent is a fintech workflow application, not a payment landing page. Its job is to help a person understand a payment request, review a commercial draft, and keep control of the only provider action. The interface therefore favors readable evidence and stable states over decorative effects.

## Concept

**Intent → evidence → controlled action.** The user writes in plain language, sees why a classification was made, reviews exact provider fields, and approves a draft deliberately. The signature moment is the transition from a review state to an explicit saved-draft state.

## System

- Ground: `#f7f9fc`; paper: `#ffffff`; ink: `#111318`.
- Action: original PayIntent blue `#002991`; a brighter blue identifies live, non-financial interface state.
- Success: restrained green `#185c43`, reserved for an actual completed draft action.
- Type: Plus Jakarta Sans. Large headings use compact tracking; body copy stays legible at 14px or larger.
- Shapes: one soft card family, light hairlines, and pill actions. The brand mark is an original route-and-check symbol, not a PayPal-like monogram.

## Completed refinement

The success view no longer leaves `Review before creating` visible after a draft has been created. It now states `Invoice draft saved`, marks the outcome as `DRAFT SAVED`, and explains that the recipient was not notified and no money moved. The same wording appears in the presentation film and local activity proof.

## Deliberately not added

- No extra dashboard, pricing page, fake metrics, testimonials, or decorative feature-card grid. None adds evidence to the payment decision.
- No automatic provider action, inline PayPal session control, or claim that a personal transfer was executed.
- No heavy motion or WebGL in the application. A short success check animation is enough to confirm the state without distracting from the audit trail.

## Next optional polish

If time remains after submission assets are ready, capture one real Sandbox result state for the demo and add a read-only deep link to the developer dashboard or a locally filtered activity history. Do not add an invoice-send control to the hackathon prototype.
