# Backend Changes Required

This file tracks frontend features that are built and waiting on backend endpoints.
Frontend code is in place; wire up each endpoint when ready.

---

## 1. Per-facility vaccine values

**Status:** Frontend built, endpoint not yet implemented.

**Endpoint:**
```
PUT /api/facilities/:facilityId/vaccines/:vaccineId
```

**Auth:** `super_admin` only

**Request body:**
```json
{
  "dosesPerVial":  10,
  "criticalDoses": 20,
  "lowDoses":      40,
  "criticalVials": 2,
  "lowVials":      4
}
```

- Any field may be omitted to leave it unchanged.
- Send `null` for any field to reset it to the global vaccine default.

**Response 200:**
```json
{
  "vaccine": {
    "vaccineId":      "...",
    "dosesPerVial":   10,
    "criticalDoses":  20,
    "lowDoses":       40,
    "criticalVials":  2,
    "lowVials":       4,
    "thresholdOverridden": true
  }
}
```

**Response 404:** Facility or vaccine not found
**Response 422:** Invalid values (e.g. `dosesPerVial < 1`, `lowDoses < criticalDoses`)

**How it is used:**
The Vaccine Catalog page (`/super-admin/vaccines`) now has a District → UC → Facility cascade filter.
When a facility is selected, `GET /api/facilities/:id` is called (already exists) and its
`facility.vaccines[]` array is shown. Each vaccine row has an edit button that opens a modal
allowing all 5 values to be overridden for that facility. "Reset to Global" sends all fields as `null`.
The `thresholdOverridden` flag on each vaccine drives the "Custom" amber badge in the table.

**Frontend function:** `updateFacilityVaccine(facilityId, vaccineId, payload)` in `src/lib/api.js`

---

## 2. Analytics — facility/UC/district filter

**Status:** Frontend cascade UI built; filter not yet wired to analytics data.

**Problem:** The Analytics page Stock Requests tab has a District → UC → Facility cascade filter.
Currently the main analytics data (`GET /api/analytics`) is fetched without facility scope, so
the chart and totals always show all facilities. The facility filter only applies client-side to
the individual-request detail panel (filtered by `req.facilityName`).

**Endpoint change needed:**
```
GET /api/analytics?from=&to=&districtId=&ucId=&facilityId=
```

All three filter params are optional and additive. When provided, restrict all analytics
aggregations (movement, remaining, requests, pendingApprovals) to matching facilities.

**How it is used:**
- `src/pages/shared/Analytics.jsx` passes `{ from, to }` to `getAnalytics` today.
- Once the backend supports the extra params, update `getAnalytics` to accept
  `{ from, to, districtId, ucId, facilityId }` and pass the selected cascade values.

**Frontend function:** `getAnalytics({ from, to })` in `src/lib/api.js`

---

## 3. Stock requests — month filter

**Status:** Frontend filters client-side; backend could make it more efficient.

**Problem:** `GET /api/stock-requests?status=X` returns all requests for the given status.
The Analytics detail panel filters by month client-side using `req.createdAt.startsWith(reqMonth)`.
For deployments with large request histories this could return a large payload unnecessarily.

**Endpoint change (optional optimisation):**
```
GET /api/stock-requests?status=&month=YYYY-MM
```

`month` parameter: if provided, return only requests whose `createdAt` falls in that month.

**Frontend function:** `getStockRequests(status)` in `src/lib/api.js` — extend signature to
`getStockRequests(status, month)` and pass `month` in the query string when provided.
