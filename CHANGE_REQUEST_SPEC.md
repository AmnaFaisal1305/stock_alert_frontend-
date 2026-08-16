# Change Request Specification
## Smart Stock Alert System — AKUH Pilot
### Client Review & Approval Document

---

| Field | Detail |
|---|---|
| **Document Date** | 11 August 2026 |
| **Status** | Pending Client Approval |
| **Prepared By** | Development Team |
| **Version** | 1.0 |

---

## Table of Contents

1. [District Supervisor Module](#1-district-supervisor-module)
2. [Facility Supervisor Module](#2-facility-supervisor-module)
3. [New Role — UC Supervisor Module](#3-new-role--uc-supervisor-module)
4. [Super Admin Module](#4-super-admin-module)

---

## Overview

This document captures all change requests raised by the client following the project presentation. Each change is described with its current state (what exists today) and the requested new behaviour. No development work will begin until the client has reviewed and signed off on this document.

The system currently supports four roles: **Super Admin**, **District Supervisor**, **Facility Supervisor**, and **Facility Worker**. Changes touch all four roles and introduce a fifth — **UC Supervisor**.

---

## 1. District Supervisor Module

### 1.1 Dashboard — Rename Navigation Tabs

| | |
|---|---|
| **Affected Screen** | Sidebar navigation (District Supervisor) |
| **Current Labels** | Dashboard · Facilities · Users · Audit Log |
| **Requested Labels** | Dashboard Analytics · Vaccine Performance · Users · Audit Log |

**Details:**
- The sidebar item currently labelled **"Dashboard"** will be renamed to **"Dashboard Analytics"**.
- The sidebar item currently labelled **"Facilities"** will be renamed to **"Vaccine Performance"**.
- All other navigation items remain unchanged.

---

### 1.2 Dashboard — Top-Level Analytics Banner

| | |
|---|---|
| **Affected Screen** | District Supervisor → Dashboard Analytics |
| **Current State** | No summary statistics are shown at the top of the dashboard |
| **Requested Change** | Add a summary banner showing key district metrics with filter controls |

**Details:**

The top of the dashboard will display the following summary statistics for the district:

| Metric | Description |
|---|---|
| District Name | Name of the district the supervisor manages |
| Total Towns | Count of towns within the district |
| Total Union Councils (UCs) | Count of UCs within the district |
| Total Facilities | Count of registered facilities within the district |

A filter panel will accompany these stats allowing the supervisor to narrow the dashboard view by:
- **Town** — filter all sections below to a specific town
- **UC** — filter all sections below to a specific union council
- When a filter is applied, all counts and tables on the page update accordingly.

---

### 1.3 Dashboard — Facility Performance Summary

| | |
|---|---|
| **Affected Screen** | District Supervisor → Dashboard Analytics (below the banner) |
| **Current State** | Not present |
| **Requested Change** | Add a facility performance section showing counts grouped by stock status |

**Details:**

This section provides a high-level health snapshot of all facilities in the district. Facilities will be grouped into three status categories:

| Status | Meaning |
|---|---|
| **Critical** | One or more vaccines at the facility are critically low |
| **Low** | One or more vaccines at the facility are running low |
| **Normal** | All vaccines at the facility are at or above the normal level |

> **Note:** The label **"OK"** used throughout the existing system is renamed to **"Normal"** across all screens in this change request.

Each category will display the count of facilities in that state. A visual indicator (colour-coded) will differentiate the three statuses.

---

### 1.4 Dashboard — Facility-Level Performance Table

| | |
|---|---|
| **Affected Screen** | District Supervisor → Dashboard Analytics (below Facility Performance) |
| **Current State** | Not present |
| **Requested Change** | Add a detailed table listing every facility with geographic and operational context |

**Details:**

A table will list each facility in the district with the following columns:

| Column | Description |
|---|---|
| Facility Name | Name of the health facility |
| Town | Town where the facility is located |
| UC | Union Council the facility belongs to |
| Facility Supervisor | Name of the assigned supervisor (or "Unstaffed" if none) |
| Last Activity | Date and time the supervisor or a worker last logged an action |
| Status | Active / Inactive — if inactive, show "Inactive since [date]" |

The table should be sortable by status and searchable by facility name. Rows with critical or low stock status should be visually highlighted.

---

### 1.5 Dashboard — Vaccine Live Stock & Consumption Matrix

| | |
|---|---|
| **Affected Screen** | District Supervisor → Dashboard Analytics (bottom section) |
| **Current State** | Not present |
| **Requested Change** | Add a cross-tab matrix showing live stock and consumption per vaccine per facility |

**Details:**

A matrix (grid) table will be displayed with:
- **Rows** — each facility in the district (one row per facility)
- **Columns** — each of the 13 configured vaccines (one column per vaccine)
- **Cells** — showing the current stock quantity and doses consumed for that vaccine at that facility

The section heading will read: **"Vaccine Live Stock & Consumption"**

Each cell should convey at minimum:
- Current stock (doses in hand)
- Total consumed (doses used/issued)

Status colouring (Critical / Low / Normal) should be applied to each cell to allow instant identification of problem areas across the district.

> **Dependency:** This matrix relies on all facilities having their vaccines and thresholds configured. Empty/unconfigured cells will display "—".

---

### 1.6 Vaccine Performance Page — Remove Status Column

| | |
|---|---|
| **Affected Screen** | District Supervisor → Vaccine Performance (formerly "Facilities") |
| **Current State** | The facilities table includes a "Status" column |
| **Requested Change** | Remove the Status column from this table |

**Details:**

The **Status** column is to be removed from the facility listing table on the Vaccine Performance page. All other columns remain as-is.

---

### 1.7 Audit Log — Scope Restriction & Heading Rename

| | |
|---|---|
| **Affected Screen** | District Supervisor → Audit Log |
| **Current State** | Shows all action types including administrative actions (Add Vaccine, Add User, Set Threshold, etc.) across all roles |
| **Requested Change** | Restrict entries to operational activity only; rename column headings |

**Details:**

**Scope restriction — actions to remove from this view:**
The following action types will be hidden from the District Supervisor audit log view (they are administrative and not relevant at this level):

- Add Vaccine
- Rename Vaccine
- Delete Vaccine
- Set Threshold
- Add User
- Activate User
- Deactivate User
- Reset Password

**Actions that will remain visible:**
- Stock Entry (dose usage logged by facility workers)
- Stock Correction (adjustments made by facility supervisors)

**Heading renames:**
The column headings in the audit log table will be updated to clearer, plain-language labels. Specific final labels to be confirmed with the client, but the intent is to use operational language (e.g. "Action Taken", "Vaccine", "Doses", "Recorded By", "Date & Time").

---

### 1.8 Facility Creation — Remove from Frontend

| | |
|---|---|
| **Affected Screen** | District Supervisor → All screens |
| **Current State** | District Supervisor has the ability to create new facilities from the frontend |
| **Requested Change** | Remove the facility creation capability from the District Supervisor frontend. No backend changes. |

**Details:**

The "Create Facility" / "Add Facility" button and associated form/modal will be removed from the District Supervisor interface. This is a **frontend-only change** — the backend API endpoint remains intact and facility creation continues to be available to the Super Admin.

---

## 2. Facility Supervisor Module

### 2.1 Dashboard — Rename "No Data" Status

| | |
|---|---|
| **Affected Screen** | Facility Supervisor → Dashboard |
| **Current State** | Vaccines with no recorded stock show the status label **"No Data"** |
| **Requested Change** | Rename to **"Stock Not Updated"** across all screens and stat cards |

**Details:**

Every instance of the text "No Data" (stat cards, badge labels, filter pills, empty state messages) will be updated to read **"Stock Not Updated"**. The visual styling (colour, icon) remains unchanged.

---

### 2.2 Dashboard & Thresholds — Standard Threshold Levels

| | |
|---|---|
| **Affected Screen** | Facility Supervisor → Dashboard, Vaccines & Thresholds |
| **Current State** | Thresholds are set manually per vaccine with no standard defaults |
| **Requested Change** | Introduce standardised default threshold values and display them in both dose and vial units |

**Details:**

The system will adopt the following standard threshold criteria:

| Status | Dose Count | Vial Count |
|---|---|---|
| **Critical** | ≤ 30 doses | ≤ 3 vials |
| **Low** | ≤ 60 doses | ≤ 6 vials |
| **Normal** | > 60 doses | > 6 vials |

- These values will serve as the **default thresholds** pre-populated when a new vaccine is added, but supervisors may still adjust them per vaccine.
- The dashboard and vaccine cards will display **both** the dose count and the equivalent vial count (calculated from doses-per-vial set at the time of delivery).

> **Note:** The current system tracks doses only. Vial count display requires the doses-per-vial value recorded during a stock delivery (already captured in the Record Stock form). No new data collection is required.

---

### 2.3 Dashboard — Vaccine Consumed Section

| | |
|---|---|
| **Affected Screen** | Facility Supervisor → Dashboard |
| **Current State** | Not present |
| **Requested Change** | Add a vaccine-level consumption summary section to the dashboard |

**Details:**

A section will be added to the Facility Supervisor dashboard (below the stock cards) showing consumption data for each vaccine at the facility. This mirrors the district-level matrix described in §1.5 but scoped to a single facility. For each vaccine:

- Current stock (doses in hand)
- Total doses consumed (issued/used)
- Vial equivalent

This section will use the same visual language (status colours) as the rest of the dashboard.

---

### 2.4 Dashboard — Recent Activity Feed Simplification

| | |
|---|---|
| **Affected Screen** | Facility Supervisor → Dashboard → Recent Activity |
| **Current State** | The activity feed shows all action types (threshold updates, user management, stock entries, etc.) |
| **Requested Change** | Restrict the Recent Activity feed to show only worker dose usage entries |

**Details:**

The Recent Activity feed on the dashboard will be filtered to show only **stock entries logged by facility workers** (action type: `STOCK_ENTRY`, entry type: `used`). Each row should clearly show:

- Which worker recorded the entry
- Which vaccine was used
- How many doses were used
- When it was recorded

Administrative actions (threshold changes, user management, corrections by the supervisor) are removed from this specific feed. The full history remains accessible via the Audit Log page.

---

### 2.5 Record Stock — Add Vial Count Display

| | |
|---|---|
| **Affected Screen** | Facility Supervisor → Record Stock |
| **Current State** | Only dose quantities are displayed |
| **Requested Change** | Add a vial count column/field showing the total number of vials equivalent to the dose quantity |

**Details:**

In the Record Stock wizard:
- When the supervisor enters the dose quantity and the doses-per-vial value, the system will automatically calculate and display the **total number of vials** (doses ÷ doses-per-vial).
- The confirmation screen (Step 4) will show both the dose count and the vial equivalent.
- The running balance will also display in both doses and vials.

---

### 2.6 Stock Register — Column Rename & Status Column

| | |
|---|---|
| **Affected Screen** | Facility Supervisor → Stock Register |
| **Current State** | Column labelled "Issued"; no entry type/status column |
| **Requested Change** | Rename "Issued" to "Consumed"; add a Status/Entry Type column |

**Details:**

Two changes to the Stock Register table:

1. **Column rename:** The column currently labelled **"Issued"** will be renamed to **"Consumed"**.

2. **New Status column:** A new column will be added to indicate the type/nature of each entry. Possible values:
   - Received (stock delivered to facility)
   - Consumed (doses used by workers)
   - Returned (doses returned from field)
   - Corrected (stock correction made by supervisor)

   This column will use colour-coded badges consistent with the rest of the UI.

---

## 3. New Role — UC Supervisor Module

### 3.1 Overview

| | |
|---|---|
| **Type** | Entirely new user role and dashboard |
| **Scope** | A UC Supervisor manages a single Union Council — their view mirrors the District Supervisor's view but filtered to their UC only |

**Details:**

A new role — **UC Supervisor** — will be added to the system. This role will have its own dashboard and pages, structured identically to the District Supervisor module but scoped to a single Union Council rather than an entire district.

### 3.2 Pages & Features

All of the following pages will be available to the UC Supervisor, with data filtered to their assigned UC only:

| Page | Description |
|---|---|
| **Dashboard Analytics** | Same layout as District Supervisor dashboard (§1.2–1.5) — metrics, facility performance, facility-level table, vaccine consumption matrix — but limited to facilities within the supervisor's UC |
| **Vaccine Performance** | Facility listing table scoped to the UC (same columns as District Supervisor, Status column excluded) |
| **Users** | View users assigned to facilities within the UC |
| **Audit Log** | Audit entries scoped to facilities within the UC (same restrictions as §1.7 — operational activity only) |

### 3.3 Access & Restrictions

- UC Supervisors **cannot** create facilities, UCs, or districts.
- UC Supervisors **cannot** manage users (view-only, or restricted to their UC).
- The UC Supervisor is assigned to a specific UC by the Super Admin at account creation time.

> **Note:** Backend role and data-scoping logic will need to be added. This is a new backend + frontend feature.

---

## 4. Super Admin Module

### 4.1 Vaccine-Level Dashboard View

| | |
|---|---|
| **Affected Screen** | Super Admin → Dashboard |
| **Current State** | System-wide facility listing with aggregate stats |
| **Requested Change** | Add a vaccine-level live stock and consumption view — same as the Facility Supervisor dashboard vaccine section (§2.3) but system-wide |

**Details:**

The Super Admin dashboard will include a **Vaccine Live Stock & Consumption** section showing a system-wide matrix:
- **Rows** — every facility across all districts
- **Columns** — all 13 vaccines
- **Cells** — current stock and consumed doses per vaccine per facility

Grouping by district (and optionally by UC) should be supported for readability.

---

### 4.2 Enhanced Create Capabilities

| | |
|---|---|
| **Affected Screen** | Super Admin → Various management pages |
| **Current State** | Super Admin can create Districts, Facilities, and Users |
| **Requested Change** | Extend Super Admin create capabilities to include UCs and Vaccines |

**Details:**

The Super Admin will gain the following additional create/management capabilities:

| Capability | Description |
|---|---|
| **Create UC** | Add a new Union Council, assign it to a district, set its town |
| **Create Facility** | Assign a facility to a UC (in addition to a district) |
| **Add Vaccine** | Add a new vaccine to the system-wide vaccine catalog |
| **Rename Vaccine** | Rename an existing vaccine in the catalog |
| **Set Threshold** | Set the minimum stock threshold for any vaccine at any facility system-wide |

> **Note:** UC creation is a new backend entity. The existing UC Management page (currently derived from facility data) will evolve into a dedicated management screen where Super Admin can create and manage UCs directly.

---

## Summary of All Changes

| # | Module | Change | Type |
|---|---|---|---|
| 1.1 | District Supervisor | Rename sidebar tabs | UI Label |
| 1.2 | District Supervisor | Add analytics banner with filters | New Feature |
| 1.3 | District Supervisor | Add facility performance summary | New Feature |
| 1.4 | District Supervisor | Add facility-level performance table | New Feature |
| 1.5 | District Supervisor | Add vaccine live stock & consumption matrix | New Feature |
| 1.6 | District Supervisor | Remove Status column from facilities table | UI Change |
| 1.7 | District Supervisor | Restrict & rename audit log | Scope Change |
| 1.8 | District Supervisor | Remove facility creation from frontend | Feature Removal |
| 2.1 | Facility Supervisor | Rename "No Data" → "Stock Not Updated" | UI Label |
| 2.2 | Facility Supervisor | Standardised threshold levels + vial display | Logic Change |
| 2.3 | Facility Supervisor | Add vaccine consumed section to dashboard | New Feature |
| 2.4 | Facility Supervisor | Simplify Recent Activity to worker usage only | Scope Change |
| 2.5 | Facility Supervisor | Add vial count to Record Stock | UI Change |
| 2.6 | Facility Supervisor | Rename "Issued" → "Consumed", add Status column | UI Change |
| 3.x | UC Supervisor | Entire new role with scoped dashboard | New Role |
| 4.1 | Super Admin | Add vaccine live stock & consumption matrix | New Feature |
| 4.2 | Super Admin | Add UC, vaccine create/manage capabilities | New Feature |

---

## Open Questions for Client

The following points require clarification before development can begin:

1. **Vaccine Consumption Matrix (§1.5, §2.3, §4.1):** Should cells show both current stock and total-ever consumed, or consumed within a specific time period (e.g., this month)? If time-scoped, what is the default window?

2. **UC Supervisor Role (§3):** Who assigns a UC Supervisor to a UC — the Super Admin only, or also the District Supervisor?

3. **Standard Thresholds (§2.2):** Are the values (30 doses / 3 vials for critical, 60 doses / 6 vials for low) fixed system-wide, or are they defaults that individual facility supervisors can override per vaccine?

4. **Audit Log Headings (§1.7):** Please confirm the preferred column heading labels for the restricted District Supervisor audit log view.

5. **UC Supervisor — User Management (§3.3):** Should UC Supervisors be able to view users only, or also deactivate/reset passwords for workers within their UC?

6. **Vial Calculation (§2.2, §2.5):** The doses-per-vial value differs per vaccine delivery batch. Should the system use the most recent batch's doses-per-vial to calculate the vial display, or a fixed standard value per vaccine type?

---

*This document is prepared for client review. Once approved, it will serve as the specification baseline for the development sprint. Any changes to requirements after approval will be tracked as a separate change request.*
