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
