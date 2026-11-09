# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Internal staff of Aga Khan University Hospital (AKUH) and its network, working in a strict location cascade: District → Union Council (UC) → Facility. There are seven roles:

- **Super Admin** (AKUH): the only role that creates and manages accounts. Also manages districts, UCs, facilities and the vaccine catalog, including per-facility thresholds.
- **Observer:** read-only view of everything the Super Admin sees.
- **District Supervisor:** oversees one district and manages its facilities.
- **UC Supervisor:** records what is sent for stock requests from the facilities in their UCs.
- **Facility Supervisor:** runs one facility day to day:
  - raises and receives stock requests;
  - assigns vials to vaccinators each morning;
  - records each vaccinator's day end (used, returned, wasted);
  - proposes stock corrections and threshold changes.
- **Facility Head:** signs off the facility's stock. Approves deliveries, corrections and threshold changes. Nothing changes the facility's stock without their approval.
- **Facility Worker (vaccinator):** view-only; sees the vials they currently hold.

Their context is a busy clinic or field setting, not a desk. Field-entry screens are used on a phone, often one-handed, sometimes with no signal. Decisions here (is a vaccine about to run out?) have real consequences for patient care.

## Product Purpose

Smart Stock Alert tracks vaccine stock across districts, UCs and facilities so that low stock is caught before it becomes a stock-out.
- **Scope:** each role sees only its slice of the cascade.
- **Movements:** stock moves through a recorded chain (request → sent → received → Head approval; morning assignment → day end), against a running balance in vials and doses.
- **Status:** every facility × vaccine gets a clear red / amber / green read.

Success means a supervisor can tell in seconds whether a vaccine needs restocking, and every stock movement, approval and account change is attributable in the audit log.

## Positioning

Built around Pakistan's EPI (Expanded Programme on Immunization) workflow, for AKUH's work in Karachi's super high-risk union councils:
- Stock is counted in vials and doses against cold-chain thresholds.
- The monthly EPI Form B is produced from the same records.
- Every stock movement needs the Facility Head's sign-off.

A generic inventory tool has none of these: the EPI vocabulary and Form B, the UC-level handover between sender and receiver, and the Head approval on each movement.

## Operating Context

- **Monthly cycle:** the EPI Form B per facility (deferred to a later phase and hidden in the app).
- **Daily cycle:** the morning vial handout to each vaccinator and the end-of-day record of used, returned and wasted vials.
- **Restocking:** the facility raises a request; the UC Supervisor records what was sent and the facility what was received; the two must agree; then the Head approves. A short delivery stays open for further rounds.
- **Offline:** deferred to a later phase. The offline queue for Assign Vials and Day End is built but switched off; with no signal they say nothing was saved.
- **Notifications:** in-app and push notifications for critical stock and every handoff, and email for actions someone must take.

## Capabilities and Constraints

- **Accounts:** only the Super Admin creates, activates, deactivates or resets accounts. Self-service password reset by email exists for everyone.
- **Units and thresholds:** stock is entered in vials. Doses are shown for usage and balances. Doses per vial is global per vaccine. Thresholds are global with optional per-facility overrides.
- **Per-batch stock:** stock is tracked per batch (batch number, expiry, manufacturer recorded on receipt). Assign Vials picks a batch, Day End closes each held batch, and Analytics shows vials near expiry (within two months).
- **Back-dating:** Assign Vials and Day End can be dated up to 7 days back.
- **Exports:** CSV, plus Excel and PDF for Analytics, built in the browser.

## Brand Commitments

- **Personality:** clinical, trustworthy, efficient. Hospital-grade software, not a consumer product: precise and dependable rather than playful or decorative. Every number and status must feel authoritative, because users act on it (restock now vs. wait).
- **Partner identity:** the partner-logo card on the login screen (`public/images/login-hero.jpeg`) is the real asset; reuse it, never redraw it.
- **Visual system:** `DESIGN.md` ("The Ward Ledger") is the visual source of truth.
- **Anti-references:** not a consumer or marketing app. No gradient-heavy hero treatments, no playful illustration, no "delight" flourishes that don't serve the workflow. It is a work tool used under time pressure, so motion, colour and copy serve faster comprehension of stock status, never decoration.

## Evidence on Hand

- **Partner logos:** the login card at `public/images/login-hero.jpeg`.
- **Data:** production holds the **real Kemari pilot** (live since 2026-11-06; users recording stock since 2026-11-09). The pilot started from zero stock: there is no opening balance; all stock enters through stock requests.
- **Absences:** no real usage figures, outcomes, testimonials or case studies exist yet. Never invent them.

## Product Principles

1. **Status at a glance.** Red / amber / green stock status is the most important thing on any screen. It must be readable in under a second, never by reading a number.
2. **Scope is always visible.** Every role works inside the cascade (system → district → UC → facility); the current scope is shown on screen, not implied by what's missing.
3. **Field-entry screens minimize friction.** Assign Vials and Day End are used on a phone, one-handed, in a clinic, sometimes offline. Fewer fields, fewer taps, immediate confirmation, forgiving of interruption and lost signal.
4. **Every movement is accountable.** Stock changes only through the recorded chain with the Head's sign-off. Each step is attributable, and nothing is silently overwritten.
5. **Errors are informative.** When a rule is hit (insufficient stock, figures that differ, wrong scope, an entry too old to sync), say exactly what's true now ("Only 12 left") so the user can act.

## Accessibility & Inclusion

WCAG AA baseline:
- sufficient contrast on all text and status indicators;
- full keyboard operability;
- screen-reader labels.

Status colour is never the only signal: red / amber / green is always paired with a text label or icon, given the field-use context.
