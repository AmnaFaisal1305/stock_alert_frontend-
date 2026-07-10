# API Requirements — Pending Integration

Fields shown as `—` in the UI are placeholders until the backend exposes them.
Share this file with the backend developer.

---

## 1. District list — `GET /api/districts`

**Current response shape per district object:**
```json
{
  "id": "abc123",
  "name": "North District",
  "createdAt": "2024-01-10T08:00:00.000Z",
  "isActive": true
}
```

**Fields to add:**
```json
{
  "supervisorName":  "Dr. Fatima Malik",
  "supervisorEmail": "f.malik@akuh.pilot"
}
```

**Where used in UI:**
- `DistrictManagement` table → "Supervisor" column and "Email" column (one row per district)

---

## 2. District detail — `GET /api/districts/:id`

**Current facility item shape (inside `district.facilities[]`):**
```json
{
  "id": "fac456",
  "name": "MCH Facility A",
  "facilitySupervisorName": "Dr. Ahmed Khan",
  "statusCounts": {
    "critical": 1,
    "low": 2,
    "adequate": 3,
    "no_data": 0
  }
}
```

**Field to add:**
```json
{
  "facilitySupervisorEmail": "a.khan@akuh.pilot"
}
```

**Where used in UI:**
- Inline expanded facility sub-table inside `DistrictManagement` → "Email" column per facility row

**Note — Vaccine type count:**
The total number of vaccine types a facility tracks is derived client-side by summing all `statusCounts` values:
```js
totalTypes = critical + low + adequate + no_data
```
No extra API field is required for this.

---

## 3. Facility detail (district supervisor) — `GET /api/facilities/:id`

**Context:**
The district supervisor dashboard shows facility cards (one per facility in their district). Clicking a card will navigate to `/district/facilities/:id` — a new page that displays the per-vaccine stock breakdown for that facility, matching what the super admin sees when navigating to `/super-admin/facilities/:id`.

**Required role access:**

The endpoint must accept requests from `district_supervisor` sessions, not just `super_admin`. If it currently returns `403` for district supervisors, access must be opened.

**Scope enforcement (must enforce server-side):**

A district supervisor may only fetch facilities that belong to their own district. If `:id` refers to a facility outside their `districtId`, the backend must return:
```json
// 403
{ "error": "Access denied" }
```
This is never trusted from the frontend — the backend must enforce it by comparing the facility's `districtId` against the session's `districtId`.

**Current response shape (super_admin today):**
```json
{
  "facility": {
    "id": "fac-uuid",
    "name": "MCH Facility A",
    "districtId": "dist-uuid",
    "districtName": "Karachi Central",
    "facilitySupervisorId": "user-uuid",
    "facilitySupervisorName": "Dr. Ahmed Khan",
    "isActive": true,
    "vaccines": [
      {
        "facilityId": "fac-uuid",
        "facilityName": "MCH Facility A",
        "districtId": "dist-uuid",
        "districtName": "Karachi Central",
        "vaccineId": "vacc-uuid",
        "vaccineName": "BCG",
        "thresholdId": "thresh-uuid",
        "minQuantity": 20,
        "quantity": 8,
        "recordedAt": "2025-01-15T09:00:00.000Z",
        "status": "critical"
      }
    ]
  }
}
```

**Required response shape for district supervisor:**

Identical to the super_admin shape above — no changes needed to the response body, only to the access control layer.

**Where used in UI:**
- New page to be created: `src/pages/district-supervisor/FacilityDetail.jsx`
- Route: `/district/facilities/:id` (this route pattern is already used in `district-supervisor/FacilityManagement.jsx` for "View Stock" links)
- Triggered from: clicking a `FacilityCard` on the district supervisor dashboard (`src/pages/district-supervisor/Dashboard.jsx`)

**How the facility ID reaches the frontend:**

The district supervisor dashboard already fetches `GET /api/dashboard`, which returns `summary.byFacility[]`. Each entry has a `facilityId` field. The frontend will use this as the `:id` route param — no additional API call or data field is needed for navigation.

**Frontend change required after backend ships:**
1. Confirm `GET /api/facilities/:id` returns `200` (not `403`) for a `district_supervisor` session
2. Create `src/pages/district-supervisor/FacilityDetail.jsx` (reusing the structure of `src/pages/super-admin/DistrictDetail.jsx` but showing vaccine rows instead of facility cards)
3. Make `FacilityCard` in the district supervisor dashboard a clickable link to `/district/facilities/:id`
4. Register the route in the district supervisor router

---

## 4. Audit log — `GET /api/audit-log`

**Current behaviour:**
The endpoint returns all audit entries. The dashboard fetches this via `getAuditLog()` and slices the first 5 client-side (`logs.slice(0, 5)`).

**Required query parameter:**
```
GET /api/audit-log?limit=5
```

Add a `limit` query parameter so the server only returns the most recent N entries. This avoids transferring the entire log on every dashboard poll.

**Where used in UI:**
- `facility-supervisor/Dashboard.jsx` → Recent Activity feed (shows last 5 entries)

**Frontend change required after backend ships:**
Update `getAuditLog` call in the dashboard to pass `{ limit: 5 }`, or add a separate `getRecentActivity(limit)` helper in `lib/api.js`.

---

## Integration checklist

- [ ] `GET /api/districts` — add `supervisorName` and `supervisorEmail` per district
- [ ] `GET /api/districts/:id` — add `facilitySupervisorEmail` per facility in the `facilities[]` array
- [ ] `GET /api/facilities/:id` — allow `district_supervisor` role; enforce scope (facility must be in session's `districtId`)
- [ ] `GET /api/audit-log?limit=N` — add `limit` query param to cap returned entries server-side
- [ ] After backend ships: remove `italic` + `?? '—'` fallbacks from `DistrictManagement.jsx`
- [ ] After backend ships: create `FacilityDetail.jsx` for district-supervisor, make `FacilityCard` a link, register route
- [ ] Confirm exact field names match the above (case-sensitive)
