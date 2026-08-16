import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, PageOrientation,
} from 'docx'
import { readFileSync, writeFileSync } from 'fs'

// ── Colour palette ─────────────────────────────────────────────────────────
const MAROON      = '7B1C2E'   // AKUH primary
const MAROON_DARK = '5a1422'
const MAROON_LIGHT= 'f5e8eb'
const SLATE_LIGHT = 'F8FAFC'
const SLATE_MID   = 'E2E8F0'
const WHITE       = 'FFFFFF'
const TEXT_DARK   = '1E293B'
const TEXT_MUTED  = '64748B'
const SUCCESS     = '15803D'
const WARNING     = 'B45309'
const DANGER      = 'B91C1C'

// ── Helpers ────────────────────────────────────────────────────────────────
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'auto' }
const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: SLATE_MID }

function run(text, opts = {}) {
  return new TextRun({
    text,
    font: 'Calibri',
    size: opts.size ?? 22,
    bold: opts.bold ?? false,
    italics: opts.italic ?? false,
    color: opts.color ?? TEXT_DARK,
    ...opts,
  })
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, font: 'Calibri', size: 40, bold: true, color: WHITE })],
    shading: { type: ShadingType.SOLID, color: MAROON, fill: MAROON },
    indent: { left: 200, right: 200 },
  })
}

function h2(text) {
  return new Paragraph({
    spacing: { before: 480, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: MAROON } },
    children: [new TextRun({ text, font: 'Calibri', size: 32, bold: true, color: MAROON })],
  })
}

function h3(text) {
  return new Paragraph({
    spacing: { before: 320, after: 120 },
    children: [new TextRun({ text, font: 'Calibri', size: 26, bold: true, color: MAROON_DARK })],
  })
}

function h4(text) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, font: 'Calibri', size: 22, bold: true, color: TEXT_DARK })],
  })
}

function para(children, opts = {}) {
  const runs = typeof children === 'string'
    ? [run(children, opts)]
    : children
  return new Paragraph({
    spacing: { before: 60, after: 80 },
    alignment: opts.align ?? AlignmentType.LEFT,
    children: runs,
  })
}

function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { before: 40, after: 40 },
    children: [run(text, { size: 21 })],
  })
}

function spacer(lines = 1) {
  return Array.from({ length: lines }, () =>
    new Paragraph({ spacing: { before: 0, after: 0 }, children: [run('')] })
  )
}

function note(text) {
  return new Paragraph({
    spacing: { before: 100, after: 100 },
    indent: { left: 300, right: 300 },
    shading: { type: ShadingType.SOLID, color: 'FFF8E1', fill: 'FFF8E1' },
    border: {
      left: { style: BorderStyle.SINGLE, size: 12, color: WARNING },
    },
    children: [
      run('Note: ', { bold: true, color: WARNING, size: 20 }),
      run(text, { size: 20, color: '78350F' }),
    ],
  })
}

function infoRow(label, value) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 2500, type: WidthType.DXA },
        shading: { type: ShadingType.SOLID, color: SLATE_LIGHT, fill: SLATE_LIGHT },
        borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
        margins: { top: 80, bottom: 80, left: 120, right: 80 },
        children: [new Paragraph({ children: [run(label, { bold: true, size: 20, color: TEXT_MUTED })] })],
      }),
      new TableCell({
        width: { size: 6000, type: WidthType.DXA },
        borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
        margins: { top: 80, bottom: 80, left: 120, right: 80 },
        children: [new Paragraph({ children: [run(value, { size: 20 })] })],
      }),
    ],
  })
}

function metaTable(rows) {
  return new Table({
    width: { size: 8500, type: WidthType.DXA },
    rows: rows.map(([l, v]) => infoRow(l, v)),
  })
}

function changeRow(cells, isHeader = false) {
  return new TableRow({
    tableHeader: isHeader,
    children: cells.map((text, i) => {
      const widths = [400, 2200, 4000, 1800]
      return new TableCell({
        width: { size: widths[i] ?? 2000, type: WidthType.DXA },
        shading: isHeader
          ? { type: ShadingType.SOLID, color: MAROON, fill: MAROON }
          : { type: ShadingType.SOLID, color: i % 2 === 0 ? WHITE : SLATE_LIGHT, fill: i % 2 === 0 ? WHITE : SLATE_LIGHT },
        borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
        margins: { top: 80, bottom: 80, left: 120, right: 80 },
        children: [new Paragraph({
          children: [run(text, {
            bold: isHeader,
            color: isHeader ? WHITE : TEXT_DARK,
            size: isHeader ? 20 : 20,
          })],
        })],
      })
    }),
  })
}

function twoColRow(label, value, isHeader = false) {
  const bg = isHeader ? MAROON : SLATE_LIGHT
  const valueBg = isHeader ? MAROON : WHITE
  return new TableRow({
    tableHeader: isHeader,
    children: [
      new TableCell({
        width: { size: 2500, type: WidthType.DXA },
        shading: { type: ShadingType.SOLID, color: bg, fill: bg },
        borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
        margins: { top: 80, bottom: 80, left: 120, right: 80 },
        children: [new Paragraph({ children: [run(label, { bold: true, color: isHeader ? WHITE : TEXT_MUTED, size: 20 })] })],
      }),
      new TableCell({
        width: { size: 6000, type: WidthType.DXA },
        shading: { type: ShadingType.SOLID, color: valueBg, fill: valueBg },
        borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
        margins: { top: 80, bottom: 80, left: 120, right: 80 },
        children: [new Paragraph({ children: [run(value, { bold: isHeader, color: isHeader ? WHITE : TEXT_DARK, size: 20 })] })],
      }),
    ],
  })
}

function twoColTable(rows) {
  return new Table({
    width: { size: 8500, type: WidthType.DXA },
    rows: rows.map(([l, v], i) => twoColRow(l, v, i === 0)),
  })
}

function changeBlock(label, value) {
  return [
    new Paragraph({
      spacing: { before: 100, after: 0 },
      children: [run(label, { bold: true, size: 20, color: TEXT_MUTED })],
    }),
    new Paragraph({
      spacing: { before: 40, after: 120 },
      indent: { left: 200 },
      children: [run(value, { size: 21 })],
    }),
  ]
}

// ── Document build ─────────────────────────────────────────────────────────
const children = [

  // ── Cover ──────────────────────────────────────────────────────────────
  new Paragraph({
    spacing: { before: 0, after: 0 },
    shading: { type: ShadingType.SOLID, color: MAROON, fill: MAROON },
    children: [],
  }),
  new Paragraph({
    spacing: { before: 600, after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'CHANGE REQUEST SPECIFICATION', font: 'Calibri', size: 52, bold: true, color: MAROON })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 100 },
    children: [new TextRun({ text: 'Smart Stock Alert System — AKUH Pilot', font: 'Calibri', size: 30, color: TEXT_MUTED })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 600 },
    children: [new TextRun({ text: 'Client Review & Approval Document', font: 'Calibri', size: 24, italics: true, color: TEXT_MUTED })],
  }),

  // ── Meta table ─────────────────────────────────────────────────────────
  metaTable([
    ['Document Date',  '11 August 2026'],
    ['Status',         'Pending Client Approval'],
    ['Prepared By',    'Development Team'],
    ['Version',        '1.0'],
  ]),

  ...spacer(2),

  // ── Overview ───────────────────────────────────────────────────────────
  h2('Overview'),
  para(
    'This document captures all change requests raised by the client following the project presentation. ' +
    'Each change is described with its current state (what exists today) and the requested new behaviour. ' +
    'No development work will begin until the client has reviewed and approved this document.'
  ),
  para(
    'The system currently supports four roles: Super Admin, District Supervisor, Facility Supervisor, and Facility Worker. ' +
    'Changes touch all four roles and introduce a fifth — UC Supervisor.'
  ),

  ...spacer(1),

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 1 — DISTRICT SUPERVISOR
  // ══════════════════════════════════════════════════════════════════════
  h1('1   District Supervisor Module'),

  // 1.1
  h3('1.1  Rename Navigation Tabs'),
  ...changeBlock('Affected Screen', 'Sidebar navigation (District Supervisor)'),
  ...changeBlock('Current Labels', 'Dashboard · Facilities · Users · Audit Log'),
  ...changeBlock('Requested Labels', 'Dashboard Analytics · Vaccine Performance · Users · Audit Log'),
  para('The sidebar item "Dashboard" will be renamed to "Dashboard Analytics". The item "Facilities" will be renamed to "Vaccine Performance". All other items remain unchanged.'),

  ...spacer(1),

  // 1.2
  h3('1.2  Dashboard — Top-Level Analytics Banner'),
  ...changeBlock('Affected Screen', 'District Supervisor → Dashboard Analytics'),
  ...changeBlock('Current State', 'No summary statistics are shown at the top of the dashboard'),
  ...changeBlock('Requested Change', 'Add a summary banner showing key district metrics with filter controls'),
  para('The top of the dashboard will display the following summary statistics:'),
  twoColTable([
    ['Metric', 'Description'],
    ['District Name',             'Name of the district the supervisor manages'],
    ['Total Towns',               'Count of towns within the district'],
    ['Total Union Councils (UCs)','Count of UCs within the district'],
    ['Total Facilities',          'Count of registered facilities within the district'],
  ]),
  ...spacer(1),
  para('A filter panel will allow the supervisor to narrow the entire dashboard view by Town or UC. When a filter is applied, all counts and tables on the page update accordingly.'),

  ...spacer(1),

  // 1.3
  h3('1.3  Dashboard — Facility Performance Summary'),
  ...changeBlock('Affected Screen', 'District Supervisor → Dashboard Analytics (below the banner)'),
  ...changeBlock('Current State', 'Not present'),
  ...changeBlock('Requested Change', 'Add a colour-coded facility health snapshot grouped by stock status'),
  para('Facilities will be grouped into three status categories:'),
  twoColTable([
    ['Status', 'Meaning'],
    ['Critical', 'One or more vaccines at the facility are critically low'],
    ['Low',      'One or more vaccines at the facility are running low'],
    ['Normal',   'All vaccines at the facility are at or above the normal level'],
  ]),
  ...spacer(1),
  note('The label "OK" used throughout the existing system is renamed to "Normal" across all screens in this change request.'),

  ...spacer(1),

  // 1.4
  h3('1.4  Dashboard — Facility-Level Performance Table'),
  ...changeBlock('Affected Screen', 'District Supervisor → Dashboard Analytics (below Facility Performance)'),
  ...changeBlock('Current State', 'Not present'),
  ...changeBlock('Requested Change', 'Add a detailed table listing every facility with geographic and operational context'),
  para('The table will list each facility with the following columns:'),
  twoColTable([
    ['Column',               'Description'],
    ['Facility Name',        'Name of the health facility'],
    ['Town',                 'Town where the facility is located'],
    ['UC',                   'Union Council the facility belongs to'],
    ['Facility Supervisor',  'Name of assigned supervisor, or "Unstaffed" if none'],
    ['Last Activity',        'Date and time the supervisor or a worker last logged an action'],
    ['Status',               'Active / Inactive — if inactive, show "Inactive since [date]"'],
  ]),
  ...spacer(1),
  para('The table will be sortable by status and searchable by facility name. Rows with critical or low stock will be visually highlighted.'),

  ...spacer(1),

  // 1.5
  h3('1.5  Dashboard — Vaccine Live Stock & Consumption Matrix'),
  ...changeBlock('Affected Screen', 'District Supervisor → Dashboard Analytics (bottom section)'),
  ...changeBlock('Current State', 'Not present'),
  ...changeBlock('Requested Change', 'Add a cross-tab matrix showing live stock and consumption per vaccine per facility'),
  para('Section heading: "Vaccine Live Stock & Consumption". The matrix will be structured as:'),
  bullet('Rows — each facility in the district (one row per facility)'),
  bullet('Columns — each of the 13 configured vaccines (one column per vaccine)'),
  bullet('Cells — current stock quantity and doses consumed for that vaccine at that facility'),
  ...spacer(1),
  para('Status colouring (Critical / Low / Normal) will be applied to each cell for instant identification. Empty or unconfigured cells display "—".'),
  note('This matrix depends on facilities having their vaccines and thresholds configured. Cells for unconfigured vaccines will be blank.'),

  ...spacer(1),

  // 1.6
  h3('1.6  Vaccine Performance Page — Remove Status Column'),
  ...changeBlock('Affected Screen', 'District Supervisor → Vaccine Performance (formerly "Facilities")'),
  ...changeBlock('Current State', 'The facilities table includes a "Status" column'),
  ...changeBlock('Requested Change', 'Remove the Status column from this table. All other columns remain as-is.'),

  ...spacer(1),

  // 1.7
  h3('1.7  Audit Log — Scope Restriction & Heading Rename'),
  ...changeBlock('Affected Screen', 'District Supervisor → Audit Log'),
  ...changeBlock('Current State', 'Shows all action types including administrative actions across all roles'),
  ...changeBlock('Requested Change', 'Restrict entries to operational activity only; rename column headings'),
  para('Action types to be removed from this view:'),
  bullet('Add Vaccine'),
  bullet('Rename Vaccine'),
  bullet('Delete Vaccine'),
  bullet('Set Threshold'),
  bullet('Add User'),
  bullet('Activate User'),
  bullet('Deactivate User'),
  bullet('Reset Password'),
  ...spacer(1),
  para('Actions that will remain visible:'),
  bullet('Stock Entry — dose usage logged by facility workers'),
  bullet('Stock Correction — adjustments made by facility supervisors'),
  ...spacer(1),
  para('Column headings in the audit log table will be updated to plain-language operational labels. Final labels to be confirmed with the client.'),

  ...spacer(1),

  // 1.8
  h3('1.8  Facility Creation — Remove from Frontend'),
  ...changeBlock('Affected Screen', 'District Supervisor → All screens'),
  ...changeBlock('Current State', 'District Supervisor can create new facilities from the frontend'),
  ...changeBlock('Requested Change', 'Remove the facility creation button and form. No backend changes.'),
  note('This is a frontend-only change. The backend API endpoint remains intact and facility creation continues to be available to the Super Admin.'),

  ...spacer(2),

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 2 — FACILITY SUPERVISOR
  // ══════════════════════════════════════════════════════════════════════
  h1('2   Facility Supervisor Module'),

  // 2.1
  h3('2.1  Dashboard — Rename "No Data" Status'),
  ...changeBlock('Affected Screen', 'Facility Supervisor → Dashboard'),
  ...changeBlock('Current State', 'Vaccines with no recorded stock show the label "No Data"'),
  ...changeBlock('Requested Change', 'Rename to "Stock Not Updated" across all screens and stat cards'),
  para('Every instance of "No Data" — stat cards, badge labels, filter pills, empty state messages — will be updated to "Stock Not Updated". Visual styling (colour, icon) remains unchanged.'),

  ...spacer(1),

  // 2.2
  h3('2.2  Dashboard & Thresholds — Standard Threshold Levels'),
  ...changeBlock('Affected Screen', 'Facility Supervisor → Dashboard, Vaccines & Thresholds'),
  ...changeBlock('Current State', 'Thresholds are set manually per vaccine with no standard defaults'),
  ...changeBlock('Requested Change', 'Introduce standardised default threshold values displayed in both dose and vial units'),
  para('The system will adopt the following standard threshold criteria:'),
  twoColTable([
    ['Status',   'Dose Count   |   Vial Count'],
    ['Critical', '≤ 30 doses       ≤ 3 vials'],
    ['Low',      '≤ 60 doses       ≤ 6 vials'],
    ['Normal',   '> 60 doses       > 6 vials'],
  ]),
  ...spacer(1),
  para('These values will serve as default thresholds pre-populated when a new vaccine is added. Supervisors may still adjust them per vaccine. The dashboard and vaccine cards will display both dose count and vial equivalent.'),
  note('The current system tracks doses only. Vial count is calculated from the doses-per-vial value recorded during delivery (already captured in the Record Stock form). No new data collection is required.'),

  ...spacer(1),

  // 2.3
  h3('2.3  Dashboard — Vaccine Consumed Section'),
  ...changeBlock('Affected Screen', 'Facility Supervisor → Dashboard'),
  ...changeBlock('Current State', 'Not present'),
  ...changeBlock('Requested Change', 'Add a vaccine-level consumption summary section to the dashboard'),
  para('A section will be added below the stock cards showing consumption data for each vaccine at the facility. For each vaccine:'),
  bullet('Current stock (doses in hand)'),
  bullet('Total doses consumed (issued/used)'),
  bullet('Vial equivalent'),
  para('This section uses the same status colour coding (Critical / Low / Normal) as the rest of the dashboard.'),

  ...spacer(1),

  // 2.4
  h3('2.4  Dashboard — Recent Activity Feed Simplification'),
  ...changeBlock('Affected Screen', 'Facility Supervisor → Dashboard → Recent Activity'),
  ...changeBlock('Current State', 'The activity feed shows all action types — threshold updates, user management, stock entries, etc.'),
  ...changeBlock('Requested Change', 'Restrict the Recent Activity feed to show only worker dose usage entries'),
  para('The feed will be filtered to show only stock entries logged by facility workers (action: STOCK_ENTRY, type: used). Each row will show:'),
  bullet('Which worker recorded the entry'),
  bullet('Which vaccine was used'),
  bullet('How many doses were used'),
  bullet('When it was recorded'),
  para('Administrative actions (threshold changes, user management, corrections) are removed from this feed. The full history remains accessible via the Audit Log page.'),

  ...spacer(1),

  // 2.5
  h3('2.5  Record Stock — Add Vial Count Display'),
  ...changeBlock('Affected Screen', 'Facility Supervisor → Record Stock'),
  ...changeBlock('Current State', 'Only dose quantities are displayed'),
  ...changeBlock('Requested Change', 'Add a vial count field showing total vials equivalent to the dose quantity entered'),
  para('In the Record Stock wizard, when the supervisor enters a dose quantity and doses-per-vial value, the system will automatically calculate and display the total number of vials (doses ÷ doses-per-vial). The confirmation screen will show both the dose count and the vial equivalent. The running balance will also display in both units.'),

  ...spacer(1),

  // 2.6
  h3('2.6  Stock Register — Column Rename & Status Column'),
  ...changeBlock('Affected Screen', 'Facility Supervisor → Stock Register'),
  ...changeBlock('Current State', 'Column labelled "Issued"; no entry type/status column'),
  ...changeBlock('Requested Change', 'Rename "Issued" to "Consumed"; add a Status/Entry Type column'),
  para('Two changes to the Stock Register table:'),
  bullet('Column rename: "Issued" → "Consumed"'),
  bullet('New Status column indicating the type of each entry:'),
  bullet('Received — stock delivered to facility', 1),
  bullet('Consumed — doses used by workers', 1),
  bullet('Returned — doses returned from the field', 1),
  bullet('Corrected — stock correction made by supervisor', 1),
  para('The new column will use colour-coded badges consistent with the rest of the UI.'),

  ...spacer(2),

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 3 — UC SUPERVISOR
  // ══════════════════════════════════════════════════════════════════════
  h1('3   New Role — UC Supervisor Module'),

  h3('3.1  Overview'),
  para('A new role — UC Supervisor — will be added to the system. This role will have its own dashboard and pages, structured identically to the District Supervisor module but scoped to a single Union Council rather than an entire district.'),

  ...spacer(1),

  h3('3.2  Pages & Features'),
  para('All of the following pages will be available to the UC Supervisor, with data filtered to their assigned UC only:'),
  twoColTable([
    ['Page',                   'Description'],
    ['Dashboard Analytics',    'Same layout as District Supervisor dashboard (§1.2–1.5) — metrics, facility performance, facility-level table, vaccine consumption matrix — limited to facilities within the UC'],
    ['Vaccine Performance',    'Facility listing table scoped to the UC (Status column excluded)'],
    ['Users',                  'View users assigned to facilities within the UC'],
    ['Audit Log',              'Audit entries scoped to facilities within the UC (operational activity only — same restrictions as §1.7)'],
  ]),

  ...spacer(1),

  h3('3.3  Access & Restrictions'),
  bullet('UC Supervisors cannot create facilities, UCs, or districts'),
  bullet('UC Supervisors cannot manage users (view access only, scoped to their UC)'),
  bullet('UC Supervisors are assigned to a specific UC by the Super Admin at account creation time'),
  note('This is a new backend + frontend feature. Backend role definitions and data-scoping logic will need to be added.'),

  ...spacer(2),

  // ══════════════════════════════════════════════════════════════════════
  // SECTION 4 — SUPER ADMIN
  // ══════════════════════════════════════════════════════════════════════
  h1('4   Super Admin Module'),

  h3('4.1  Vaccine-Level Dashboard View'),
  ...changeBlock('Affected Screen', 'Super Admin → Dashboard'),
  ...changeBlock('Current State', 'System-wide facility listing with aggregate stats'),
  ...changeBlock('Requested Change', 'Add a vaccine live stock and consumption view — same as §2.3 but system-wide'),
  para('The Super Admin dashboard will include a "Vaccine Live Stock & Consumption" section showing a system-wide matrix:'),
  bullet('Rows — every facility across all districts'),
  bullet('Columns — all 13 vaccines'),
  bullet('Cells — current stock and consumed doses per vaccine per facility'),
  para('Grouping by district (and optionally by UC) will be supported for readability.'),

  ...spacer(1),

  h3('4.2  Enhanced Create & Management Capabilities'),
  ...changeBlock('Affected Screen', 'Super Admin → Various management pages'),
  ...changeBlock('Current State', 'Super Admin can create Districts, Facilities, and Users'),
  ...changeBlock('Requested Change', 'Extend capabilities to include UC and Vaccine management'),
  para('The Super Admin will gain the following additional capabilities:'),
  twoColTable([
    ['Capability',       'Description'],
    ['Create UC',        'Add a new Union Council, assign it to a district, set its town'],
    ['Create Facility',  'Assign a facility to a UC (in addition to a district)'],
    ['Add Vaccine',      'Add a new vaccine to the system-wide vaccine catalog'],
    ['Rename Vaccine',   'Rename an existing vaccine in the catalog'],
    ['Set Threshold',    'Set the minimum stock threshold for any vaccine at any facility system-wide'],
  ]),
  note('UC creation is a new backend entity. The existing UC Management page (currently derived from facility data) will evolve into a dedicated management screen where the Super Admin can create and manage UCs directly.'),

  ...spacer(2),

  // ══════════════════════════════════════════════════════════════════════
  // SUMMARY TABLE
  // ══════════════════════════════════════════════════════════════════════
  h2('Summary of All Changes'),
  new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [
      changeRow(['#', 'Module', 'Change', 'Type'], true),
      changeRow(['1.1', 'District Supervisor', 'Rename sidebar navigation tabs',                      'UI Label']),
      changeRow(['1.2', 'District Supervisor', 'Add analytics banner with filters',                   'New Feature']),
      changeRow(['1.3', 'District Supervisor', 'Add facility performance summary',                    'New Feature']),
      changeRow(['1.4', 'District Supervisor', 'Add facility-level performance table',                'New Feature']),
      changeRow(['1.5', 'District Supervisor', 'Add vaccine live stock & consumption matrix',         'New Feature']),
      changeRow(['1.6', 'District Supervisor', 'Remove Status column from facilities table',          'UI Change']),
      changeRow(['1.7', 'District Supervisor', 'Restrict & rename audit log',                         'Scope Change']),
      changeRow(['1.8', 'District Supervisor', 'Remove facility creation from frontend',              'Feature Removal']),
      changeRow(['2.1', 'Facility Supervisor', 'Rename "No Data" → "Stock Not Updated"',             'UI Label']),
      changeRow(['2.2', 'Facility Supervisor', 'Standardised threshold levels + vial display',        'Logic Change']),
      changeRow(['2.3', 'Facility Supervisor', 'Add vaccine consumed section to dashboard',           'New Feature']),
      changeRow(['2.4', 'Facility Supervisor', 'Simplify Recent Activity to worker usage only',       'Scope Change']),
      changeRow(['2.5', 'Facility Supervisor', 'Add vial count to Record Stock wizard',              'UI Change']),
      changeRow(['2.6', 'Facility Supervisor', 'Rename "Issued" → "Consumed", add Status column',   'UI Change']),
      changeRow(['3.x', 'UC Supervisor',       'Entire new role with scoped dashboard & pages',      'New Role']),
      changeRow(['4.1', 'Super Admin',          'Add vaccine live stock & consumption matrix',        'New Feature']),
      changeRow(['4.2', 'Super Admin',          'Add UC and vaccine create/manage capabilities',      'New Feature']),
    ],
  }),

  ...spacer(2),

  // ══════════════════════════════════════════════════════════════════════
  // OPEN QUESTIONS
  // ══════════════════════════════════════════════════════════════════════
  h2('Open Questions for Client'),
  para('The following points require clarification before development can begin:'),

  ...spacer(1),
  h4('Q1 — Vaccine Consumption Matrix Time Window  (§1.5, §2.3, §4.1)'),
  para('Should cells show consumption totals all-time, or within a specific time period (e.g., current month, last 30 days)? If time-scoped, what is the default window and can supervisors adjust it?'),

  h4('Q2 — UC Supervisor Assignment  (§3)'),
  para('Who assigns a UC Supervisor to a UC — the Super Admin only, or also the District Supervisor?'),

  h4('Q3 — Standard Threshold Values  (§2.2)'),
  para('Are the values (30 doses / 3 vials for Critical; 60 doses / 6 vials for Low) fixed system-wide, or are they defaults that individual facility supervisors can override per vaccine?'),

  h4('Q4 — Audit Log Column Labels  (§1.7)'),
  para('Please confirm the preferred column heading labels for the restricted District Supervisor audit log view.'),

  h4('Q5 — UC Supervisor — User Management  (§3.3)'),
  para('Should UC Supervisors be able to view users only, or also deactivate/reset passwords for workers within their UC?'),

  h4('Q6 — Vial Calculation Method  (§2.2, §2.5)'),
  para('The doses-per-vial value differs per vaccine delivery batch. Should the system use the most recent batch\'s doses-per-vial to calculate the vial display, or a fixed standard value per vaccine type?'),

  ...spacer(2),

  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 0 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: SLATE_MID } },
    children: [
      run(
        'This document is prepared for client review. Once approved, it will serve as the specification baseline ' +
        'for the development sprint. Any changes to requirements after approval will be tracked as a separate change request.',
        { size: 18, italic: true, color: TEXT_MUTED }
      ),
    ],
  }),
]

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 22, color: TEXT_DARK },
        paragraph: { spacing: { line: 276 } },
      },
    },
  },
  sections: [{
    properties: {
      page: {
        size: { orientation: PageOrientation.PORTRAIT },
        margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
      },
    },
    children,
  }],
})

const buffer = await Packer.toBuffer(doc)
writeFileSync('CHANGE_REQUEST_SPEC.docx', buffer)
console.log('Done — CHANGE_REQUEST_SPEC.docx written.')
