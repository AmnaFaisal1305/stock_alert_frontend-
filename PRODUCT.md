# Product

## Register

product

## Users

Internal staff at Aga Khan University Hospital (AKUH) and its network, across four cascading roles:

- **Super Admin** (AKUH) — onboards districts and district supervisors, unscoped visibility across the whole system.
- **District Supervisor** — runs one district: onboards facilities and facility supervisors within it.
- **Facility Supervisor** — runs one facility day-to-day: records stock received, manages the facility's vaccine catalog and thresholds, creates Facility Worker accounts, reviews their workers' activity.
- **Facility Worker** — field-level role, often on a phone in a clinic. Logs into a single, minimal screen to record doses used and check current stock. No other visibility.

Each role's context is a busy clinical/operational setting, not a desk-bound admin session — decisions here (is a vaccine about to run out?) have real downstream consequences for patient care.

## Product Purpose

Smart Stock Alert tracks vaccine stock levels across districts and facilities so that low-stock situations are caught before they become stockouts. Each role sees only the slice of the system it's responsible for (unscoped → one district → one facility), records stock movements (received vs. used) against a running balance, and gets a clear red/amber/green read on status per vaccine. Success looks like: a Facility Supervisor or Worker can tell in seconds whether a vaccine needs reordering, and every stock movement and account/threshold change is attributable via the audit log.

## Brand Personality

Clinical, trustworthy, efficient. This is hospital-grade software, not a consumer product — it should read as precise and dependable rather than playful or decorative. Every number and status needs to feel authoritative; this is the kind of tool where a user's trust in the data directly affects whether they act on it (reorder now vs. wait).

## Anti-references

Not a consumer or marketing-style app — no gradient-heavy hero treatments, no playful illustration, no "delight" flourishes that don't serve the workflow. This is a work tool used under time pressure, not a product being sold. Motion, color, and copy should always serve faster comprehension of stock status, never decoration for its own sake.

## Design Principles

1. **Status at a glance.** Red/amber/green stock status is the single most important thing on any screen — it must be scannable in under a second, never require reading a number to interpret.
2. **Scope is always visible, never assumed.** Every role operates inside a strict cascade (system → district → facility → worker); the current facility/district context should be visible on-screen, not just implied by what's absent from the nav.
3. **Field-entry screens minimize friction.** The Facility Worker's screen is used on a phone, often one-handed, in a clinical setting — fewer fields, fewer taps, immediate confirmation, forgiving of interruption.
4. **Precision over decoration.** Numbers, statuses, and confirmations are the product. Visual polish should sharpen clarity (contrast, hierarchy, spacing) rather than add ornament.
5. **Errors are informative, not just blocking.** When a constraint is hit (insufficient stock, duplicate vaccine name, wrong scope), the message should tell the user exactly what's true right now (e.g. "Only 12 left") so they can act, not just that something failed.

## Accessibility & Inclusion

Standard WCAG AA baseline: sufficient color contrast on all text and status indicators, full keyboard operability, and screen-reader-friendly labeling. Status colors (red/amber/green) should not rely on hue alone given the clinical/field-use context — pair with text labels (already the pattern in use) or icons, not color alone.
