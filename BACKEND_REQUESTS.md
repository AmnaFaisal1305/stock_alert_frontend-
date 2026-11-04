# Backend Requests — Frontend → Backend

Updated 2026-11-02 · Frontend branch `main`

The one list of what the frontend still needs from the backend. Only open items are listed; delivered ones are removed (they're in this file's git history). Everything up to **Round 48** is adopted on the frontend. **Nothing is open.**

Add new requests below as numbered sections. All new parameters should be optional and additive, and combined with the caller's role scope (never widening it).

---

## Round 44 — Fix `dosesPerVial` for BCG, OPV (Polio), and Pneumococcal

**Found:** 2026-10-23, via analytics ledger verification (super admin, 11-month period).

**Problem:** `GET /api/vaccines` returns `dosesPerVial: 20` for BCG, OPV (Polio), and Pneumococcal. But the actual usage records in the movement data imply `dosesPerVial: 10` for BCG and OPV (2140 doses ÷ 214 vials = 10; 1620 ÷ 162 = 10), and an inconsistent `12` for Pneumococcal (60 doses ÷ 5 vials). Every other vaccine matches its catalog value exactly.

**Impact:** The Analytics page's **Doses Given** and **Stock Left (doses)** columns for these three vaccines are computed from `usedDoses` and `totalDoses`, which the backend derives using `dosesPerVial`. If the catalog value (20) diverges from what was used when day-end entries were recorded (effectively 10), those dose figures are wrong. Vial counts (received, wasted, remaining vials) are unaffected — the accounting identity holds for all 13 vaccines.

**Ask:** Confirm the correct `dosesPerVial` for BCG, OPV (Polio), and Pneumococcal, correct the catalog, and if the historical `usedDoses`/`totalDoses` were computed with the wrong multiplier, recompute them. Pneumococcal's implied value of 12 (not a round number) is especially worth investigating — it may indicate mixed records from two different `dosesPerVial` values.

**Additional requirement — super admin changes `dosesPerVial`:** The super admin can edit `dosesPerVial` via `PUT /api/vaccines/:id`. Whenever this value changes, the backend must retroactively recompute every historical `usedDoses` value for that vaccine (stored on day-end entries) and every derived `totalDoses` value (used by the remaining/holdings endpoint). Without this, analytics immediately splits into old dose figures at the old multiplier and new figures at the new multiplier — the "Doses Given" and "Stock Left (doses)" columns become wrong for that vaccine across all roles and all date ranges. The frontend cannot fix this; it only displays what the backend returns.
