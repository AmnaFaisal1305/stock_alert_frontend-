import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, PageOrientation, PageBreak,
} from 'docx'
import { writeFileSync } from 'fs'

// ── Palette ────────────────────────────────────────────────────────────────
const MAROON       = '7B1C2E'
const MAROON_DARK  = '5A1422'
const MAROON_LIGHT = 'F9EDEF'
const SLATE_LIGHT  = 'F8FAFC'
const SLATE_MID    = 'E2E8F0'
const WHITE        = 'FFFFFF'
const TEXT_DARK    = '1E293B'
const TEXT_MUTED   = '64748B'
const SUCCESS_BG   = 'F0FDF4'
const SUCCESS      = '15803D'
const WARNING_BG   = 'FFFBEB'
const WARNING      = 'B45309'
const DANGER_BG    = 'FEF2F2'
const DANGER       = 'B91C1C'
const INFO_BG      = 'EFF6FF'
const INFO         = '1D4ED8'
const PURPLE_BG    = 'F5F3FF'
const PURPLE       = '6D28D9'
const TEAL_BG      = 'F0FDFA'
const TEAL         = '0F766E'

const thinBorder   = { style: BorderStyle.SINGLE, size: 4,  color: SLATE_MID }
const maroonBorder = { style: BorderStyle.SINGLE, size: 8,  color: MAROON }
const noBorder     = { style: BorderStyle.NONE,   size: 0,  color: 'auto' }

// ── Primitives ─────────────────────────────────────────────────────────────
function run(text, opts = {}) {
  return new TextRun({ text, font: 'Calibri', size: opts.size ?? 22,
    bold: opts.bold ?? false, italics: opts.italic ?? false,
    color: opts.color ?? TEXT_DARK, ...opts })
}

function spacer(n = 1) {
  return Array.from({ length: n }, () =>
    new Paragraph({ spacing: { before: 0, after: 0 }, children: [run('')] }))
}

function pageBreak() {
  return new Paragraph({ children: [new TextRun({ break: 1 })] })
}

// ── Headings ───────────────────────────────────────────────────────────────
function sectionBanner(text, subtitle, color = MAROON) {
  return [
    new Paragraph({
      spacing: { before: 0, after: 0 },
      shading: { type: ShadingType.SOLID, color, fill: color },
      children: [
        new TextRun({ text: '  ' + text, font: 'Calibri', size: 44, bold: true, color: WHITE }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 200 },
      shading: { type: ShadingType.SOLID, color, fill: color },
      children: [
        new TextRun({ text: '  ' + subtitle, font: 'Calibri', size: 22, italics: true, color: 'DDDDDD' }),
      ],
    }),
  ]
}

function h2(text) {
  return new Paragraph({
    spacing: { before: 400, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: MAROON } },
    children: [run(text, { size: 30, bold: true, color: MAROON })],
  })
}

function h3(text, color = MAROON_DARK) {
  return new Paragraph({
    spacing: { before: 280, after: 100 },
    children: [run(text, { size: 24, bold: true, color })],
  })
}

function h4(text) {
  return new Paragraph({
    spacing: { before: 160, after: 60 },
    children: [run(text, { size: 22, bold: true, color: TEXT_DARK })],
  })
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 80 },
    alignment: opts.align ?? AlignmentType.LEFT,
    children: [run(text, { size: opts.size ?? 22, color: opts.color ?? TEXT_DARK, bold: opts.bold ?? false })],
  })
}

function bullet(text, level = 0, color = TEXT_DARK) {
  return new Paragraph({
    bullet: { level },
    spacing: { before: 40, after: 40 },
    children: [run(text, { size: 21, color })],
  })
}

function labeledBullet(label, text, labelColor = MAROON) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 40, after: 40 },
    children: [
      run(label + ': ', { size: 21, bold: true, color: labelColor }),
      run(text, { size: 21 }),
    ],
  })
}

// ── Callout boxes ──────────────────────────────────────────────────────────
function callout(text, type = 'info') {
  const cfg = {
    info:    { bg: INFO_BG,    border: INFO,    prefix: 'ℹ  ' },
    success: { bg: SUCCESS_BG, border: SUCCESS, prefix: '✓  ' },
    warning: { bg: WARNING_BG, border: WARNING, prefix: '⚠  ' },
    danger:  { bg: DANGER_BG,  border: DANGER,  prefix: '✕  ' },
    note:    { bg: SLATE_LIGHT,border: MAROON,  prefix: '→  ' },
  }[type] ?? { bg: SLATE_LIGHT, border: MAROON, prefix: '' }

  return new Paragraph({
    spacing: { before: 100, after: 120 },
    indent:  { left: 240, right: 240 },
    shading: { type: ShadingType.SOLID, color: cfg.bg, fill: cfg.bg },
    border:  { left: { style: BorderStyle.SINGLE, size: 14, color: cfg.border } },
    children: [run(cfg.prefix + text, { size: 20, color: cfg.border })],
  })
}

// ── Tables ─────────────────────────────────────────────────────────────────
function cell(text, opts = {}) {
  const bg = opts.bg ?? WHITE
  return new TableCell({
    width:   opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: { type: ShadingType.SOLID, color: bg, fill: bg },
    borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
    margins: { top: 80, bottom: 80, left: 140, right: 100 },
    verticalAlign: opts.vAlign ?? 'top',
    children: [new Paragraph({
      children: [run(text, { bold: opts.bold ?? false, color: opts.color ?? TEXT_DARK, size: opts.size ?? 20 })],
    })],
  })
}

function tableRow(cells) {
  return new TableRow({ children: cells })
}

function headerRow(labels, widths = []) {
  return new TableRow({
    tableHeader: true,
    children: labels.map((l, i) =>
      new TableCell({
        width: widths[i] ? { size: widths[i], type: WidthType.DXA } : undefined,
        shading: { type: ShadingType.SOLID, color: MAROON, fill: MAROON },
        borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
        margins: { top: 80, bottom: 80, left: 140, right: 100 },
        children: [new Paragraph({ children: [run(l, { bold: true, color: WHITE, size: 20 })] })],
      })
    ),
  })
}

function simpleTable(headers, rows, widths = []) {
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [
      headerRow(headers, widths),
      ...rows.map((r) => tableRow(r.map((v, i) => {
        const isFirst = i === 0
        return cell(v, { bg: isFirst ? SLATE_LIGHT : WHITE, bold: isFirst, size: 20 })
      }))),
    ],
  })
}

// ── Screen box (visual representation of a page) ───────────────────────────
function screenBox(title, items, color = MAROON) {
  const rows = [
    new TableRow({
      children: [new TableCell({
        columnSpan: 1,
        shading: { type: ShadingType.SOLID, color, fill: color },
        borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
        margins: { top: 80, bottom: 80, left: 200, right: 80 },
        children: [new Paragraph({ children: [run('  📄  ' + title, { bold: true, color: WHITE, size: 22 })] })],
      })],
    }),
    ...items.map((item) =>
      new TableRow({
        children: [new TableCell({
          shading: { type: ShadingType.SOLID, color: SLATE_LIGHT, fill: SLATE_LIGHT },
          borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: thinBorder, left: thinBorder, right: thinBorder },
          margins: { top: 60, bottom: 60, left: 200, right: 80 },
          children: [new Paragraph({ children: [run('  ▸  ' + item, { size: 20 })] })],
        })],
      })
    ),
  ]

  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows,
  })
}

// ── Role pill table (overview) ─────────────────────────────────────────────
function rolePillRow(role, scope, pages, color) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 2200, type: WidthType.DXA },
        shading: { type: ShadingType.SOLID, color, fill: color },
        borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
        margins: { top: 100, bottom: 100, left: 140, right: 100 },
        children: [new Paragraph({ children: [run(role, { bold: true, color: WHITE, size: 20 })] })],
      }),
      new TableCell({
        width: { size: 2200, type: WidthType.DXA },
        borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
        margins: { top: 100, bottom: 100, left: 140, right: 100 },
        children: [new Paragraph({ children: [run(scope, { size: 20 })] })],
      }),
      new TableCell({
        width: { size: 4600, type: WidthType.DXA },
        borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
        margins: { top: 100, bottom: 100, left: 140, right: 100 },
        children: [new Paragraph({ children: [run(pages, { size: 20 })] })],
      }),
    ],
  })
}

// ══════════════════════════════════════════════════════════════════════════
// DOCUMENT CONTENT
// ══════════════════════════════════════════════════════════════════════════
const children = [

  // ── Cover ────────────────────────────────────────────────────────────────
  new Paragraph({
    spacing: { before: 600, after: 200 },
    alignment: AlignmentType.CENTER,
    children: [run('DASHBOARD FLOW DOCUMENT', { size: 56, bold: true, color: MAROON })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 100 },
    children: [run('Smart Stock Alert System — AKUH Pilot', { size: 30, color: TEXT_MUTED })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 600 },
    children: [run('Complete User Journey & Screen Flow — All Roles', { size: 24, italic: true, color: TEXT_MUTED })],
  }),

  new Table({
    width: { size: 8000, type: WidthType.DXA },
    rows: [
      tableRow([cell('Document Date', { bg: SLATE_LIGHT, bold: true, color: TEXT_MUTED, width: 2500 }), cell('11 August 2026', { width: 5500 })]),
      tableRow([cell('Status',        { bg: SLATE_LIGHT, bold: true, color: TEXT_MUTED, width: 2500 }), cell('For Client Review', { width: 5500 })]),
      tableRow([cell('Prepared By',   { bg: SLATE_LIGHT, bold: true, color: TEXT_MUTED, width: 2500 }), cell('Development Team', { width: 5500 })]),
      tableRow([cell('Version',       { bg: SLATE_LIGHT, bold: true, color: TEXT_MUTED, width: 2500 }), cell('1.0', { width: 5500 })]),
    ],
  }),

  ...spacer(2),

  // ── Roles Overview ────────────────────────────────────────────────────────
  h2('System Roles Overview'),
  para('The Smart Stock Alert System serves five distinct roles. Each role has a dedicated dashboard and set of pages scoped to their level of responsibility.'),
  ...spacer(1),

  new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [
      headerRow(['Role', 'Data Scope', 'Pages Available'], [2200, 2200, 4600]),
      rolePillRow('Super Admin',          'System-wide (all districts)',         'Dashboard · Districts · UCs · Facilities · Users · Audit Log', MAROON),
      rolePillRow('District Supervisor',  'Single district',                     'Dashboard Analytics · Vaccine Performance · Users · Audit Log', '1D4ED8'),
      rolePillRow('UC Supervisor  (NEW)', 'Single Union Council',                'Dashboard Analytics · Vaccine Performance · Users · Audit Log', TEAL),
      rolePillRow('Facility Supervisor',  'Single facility',                     'Dashboard · Vaccines & Thresholds · Record Stock · Stock Register · Workers · Audit Log', '6D28D9'),
      rolePillRow('Facility Worker',      'Single facility (read + entry only)', 'Stock Entry · Stock Status', SUCCESS),
    ],
  }),

  ...spacer(1),
  callout('All roles share a common login page. After authentication, each user is automatically redirected to their role-specific default dashboard.', 'note'),

  pageBreak(),

  // ══════════════════════════════════════════════════════════════════════════
  // ROLE 1 — SUPER ADMIN
  // ══════════════════════════════════════════════════════════════════════════
  ...sectionBanner('Role 1 — Super Admin', 'System-wide management across all districts, UCs, and facilities', MAROON),

  ...spacer(1),
  para('The Super Admin has full visibility and control over the entire system. After login, they land directly on the System Dashboard.'),

  ...spacer(1),
  h3('Page 1 — System Dashboard'),
  screenBox('System Dashboard', [
    'System-wide summary banner — total districts, UCs, facilities, active users',
    'Facility Performance Summary — count of Critical / Low / Normal facilities system-wide',
    'Vaccine Live Stock & Consumption Matrix — rows: all facilities · columns: all 13 vaccines · cells: current stock + consumed doses',
    'Status colour coding (Critical / Low / Normal) applied to each cell in the matrix',
    'District grouping option to collapse matrix by district for readability',
  ], MAROON),
  ...spacer(1),
  h4('What the Super Admin can do here:'),
  bullet('Get an at-a-glance system health check across all facilities'),
  bullet('Identify which vaccines are critically low at which facilities'),
  bullet('See total consumption vs. remaining stock per vaccine per facility'),

  ...spacer(1),
  h3('Page 2 — District Management'),
  screenBox('District Management', [
    'Table listing all districts with name and creation date',
    'Create New District — form: district name',
    'Rename district',
    'Activate / Deactivate district',
    'Click a district row → drill into District Detail page',
  ], MAROON),
  ...spacer(1),
  h4('District Detail page shows:'),
  bullet('All facilities belonging to the district'),
  bullet('Per-facility vaccine stock summary'),

  ...spacer(1),
  h3('Page 3 — UC Management'),
  screenBox('UC Management', [
    'Table listing all Union Councils grouped by district',
    'Columns: UC Name · District · Town · Facilities within the UC · Active/Inactive badge per facility',
    'Create New UC — form: UC name, district, town',
    'Click facility name → navigate to Facility Detail',
  ], MAROON),
  ...spacer(1),
  callout('Previously UCs were derived from facility data. After this change, UCs become a first-class entity that the Super Admin manages directly.', 'note'),

  ...spacer(1),
  h3('Page 4 — Facility Management'),
  screenBox('Facility Management', [
    'Table listing all facilities across all districts',
    'Columns: Facility Name · District · UC · Supervisor · Status',
    'Create New Facility — form: name, district, UC assignment',
    'Activate / Deactivate facility',
    'Click a facility row → Facility Detail page',
  ], MAROON),
  ...spacer(1),
  h4('Facility Detail page shows:'),
  bullet('Facility info banner — name, district, supervisor, active status'),
  bullet('Status summary cards — Critical / Low / Normal / Stock Not Updated counts'),
  bullet('Vaccine inventory — card view and table view toggle'),
  bullet('Each vaccine card: current stock, minimum threshold, last recorded date, status badge'),

  ...spacer(1),
  h3('Page 5 — User Management'),
  screenBox('User Management', [
    'Table listing all users across all roles',
    'Columns: Email · Role · District · Facility · Active/Inactive',
    'Create new user — role, email, district/facility assignment',
    'Activate / Deactivate user',
    'Reset password',
  ], MAROON),

  ...spacer(1),
  h3('Page 6 — Vaccine Management  (New Capability)'),
  screenBox('Vaccine Management', [
    'List of all 13 vaccines in the system catalog',
    'Add Vaccine — select from standard list, assign to facilities',
    'Rename Vaccine — select new name from standard list',
    'Set Threshold — set minimum dose threshold for any vaccine at any facility system-wide',
  ], MAROON),
  callout('Vaccine management at the Super Admin level controls system-wide defaults. Facility Supervisors can still override thresholds locally for their own facility.', 'note'),

  ...spacer(1),
  h3('Page 7 — Audit Log'),
  screenBox('Audit Log', [
    'Full system-wide audit history — all roles, all action types',
    'Tabs: Super Admin · District Supervisors · Facility Supervisors · Workers',
    'Filters: Action Type · Date',
    'Columns: Date & Time · Actor · Role · Action · Vaccine/Subject · Detail · District · Facility · Balance',
    'Pagination — 10 entries per page',
  ], MAROON),

  pageBreak(),

  // ══════════════════════════════════════════════════════════════════════════
  // ROLE 2 — DISTRICT SUPERVISOR
  // ══════════════════════════════════════════════════════════════════════════
  ...sectionBanner('Role 2 — District Supervisor', 'Manages all facilities within a single district', INFO),

  ...spacer(1),
  para('The District Supervisor sees their district\'s data only. After login, they land on the Dashboard Analytics page.'),
  callout('Navigation tabs renamed: "Dashboard" → "Dashboard Analytics" | "Facilities" → "Vaccine Performance"', 'note'),

  ...spacer(1),
  h3('Page 1 — Dashboard Analytics'),
  ...spacer(1),

  h4('Section A — District Summary Banner  (top of page)'),
  screenBox('District Summary Banner', [
    'District name displayed prominently',
    'Stat tiles: Total Towns · Total UCs · Total Facilities',
    'Filter panel: filter entire dashboard by Town or UC',
    'All sections below respond to the selected filter',
  ], INFO),

  ...spacer(1),
  h4('Section B — Facility Performance Summary'),
  screenBox('Facility Performance Summary', [
    'Three colour-coded count cards:',
    '    🔴  Critical — facilities where one or more vaccines are critically low',
    '    🟡  Low — facilities where one or more vaccines are running low',
    '    🟢  Normal — facilities where all vaccines are at healthy levels',
    'Counts update based on Town / UC filter applied above',
  ], INFO),
  callout('"OK" has been renamed to "Normal" throughout the entire system.', 'note'),

  ...spacer(1),
  h4('Section C — Facility-Level Performance Table'),
  simpleTable(
    ['Column', 'What it shows'],
    [
      ['Facility Name',        'Name of the health facility'],
      ['Town',                 'Town where the facility is located'],
      ['UC',                   'Union Council the facility belongs to'],
      ['Facility Supervisor',  'Assigned supervisor name, or "Unstaffed"'],
      ['Last Activity',        'Date & time of the last recorded action at this facility'],
      ['Status',               'Active — or "Inactive since [date]" if no activity'],
    ],
    [2500, 6500]
  ),
  ...spacer(1),
  bullet('Table is sortable by Status column'),
  bullet('Rows are colour-highlighted for Critical and Low status facilities'),
  bullet('Searchable by facility name'),

  ...spacer(1),
  h4('Section D — Vaccine Live Stock & Consumption Matrix  (bottom of page)'),
  screenBox('Vaccine Live Stock & Consumption Matrix', [
    'Heading: "Vaccine Live Stock & Consumption"',
    'Rows — each facility within the district (filtered by Town/UC if set)',
    'Columns — all 13 vaccines',
    'Each cell shows: current stock in hand + total doses consumed',
    'Cell background colour: 🔴 Critical · 🟡 Low · 🟢 Normal · ⬜ Stock Not Updated',
    'Unconfigured vaccine cells display "—"',
  ], INFO),

  ...spacer(1),
  h3('Page 2 — Vaccine Performance  (formerly "Facilities")'),
  screenBox('Vaccine Performance', [
    'Table listing all facilities in the district',
    'Columns: Facility Name · Town · UC · Supervisor (Status column removed)',
    'Click a facility row → Facility Detail page (read-only view)',
    'Search and sort available',
  ], INFO),
  callout('The Status column has been removed from this table. Status is visible on the Dashboard Analytics page instead.', 'note'),

  ...spacer(1),
  h3('Page 3 — Users'),
  screenBox('Users', [
    'Table of all users assigned to facilities within this district',
    'Columns: Email · Role · Facility · Active/Inactive',
    'View-only — District Supervisor cannot create or deactivate users',
  ], INFO),

  ...spacer(1),
  h3('Page 4 — Audit Log'),
  screenBox('Audit Log', [
    'Operational activity only — no administrative actions shown',
    'Visible actions: Stock Entry (worker dose usage) · Stock Correction (supervisor adjustments)',
    'Hidden actions: Add Vaccine · Rename Vaccine · Set Threshold · Add/Activate/Deactivate User · Reset Password',
    'Filters: Action Type · Date Range',
    'Updated column headings — plain operational language',
    'Pagination — 10 entries per page',
  ], INFO),

  callout('District Supervisors cannot create facilities. The "Add Facility" button has been removed from all screens for this role.', 'warning'),

  pageBreak(),

  // ══════════════════════════════════════════════════════════════════════════
  // ROLE 3 — UC SUPERVISOR  (NEW)
  // ══════════════════════════════════════════════════════════════════════════
  ...sectionBanner('Role 3 — UC Supervisor  (New Role)', 'Manages all facilities within a single Union Council', TEAL),

  ...spacer(1),
  para('The UC Supervisor is a new role introduced in this update. Their dashboard is structured identically to the District Supervisor dashboard, but all data is filtered to their assigned Union Council only. They do not see any data outside their UC.'),
  callout('This is a brand new role. The Super Admin creates UC Supervisor accounts and assigns them to a specific UC.', 'note'),

  ...spacer(1),
  h3('Page 1 — Dashboard Analytics  (UC-scoped)'),
  screenBox('Dashboard Analytics — UC Supervisor', [
    'UC name displayed in the banner (instead of district name)',
    'Stat tiles: Total Facilities in UC (no Towns or district-level counts)',
    'Facility Performance Summary — Critical / Low / Normal counts for UC facilities only',
    'Facility-Level Performance Table — same columns, filtered to UC facilities',
    'Vaccine Live Stock & Consumption Matrix — same matrix, UC facilities only',
  ], TEAL),

  ...spacer(1),
  h3('Page 2 — Vaccine Performance  (UC-scoped)'),
  screenBox('Vaccine Performance — UC Supervisor', [
    'Table listing facilities within this UC only',
    'Same columns as District Supervisor Vaccine Performance (Status column excluded)',
    'Click a facility → Facility Detail (read-only)',
  ], TEAL),

  ...spacer(1),
  h3('Page 3 — Users  (UC-scoped)'),
  screenBox('Users — UC Supervisor', [
    'Table of users assigned to facilities within this UC only',
    'View-only — cannot create, activate, or deactivate users',
  ], TEAL),

  ...spacer(1),
  h3('Page 4 — Audit Log  (UC-scoped)'),
  screenBox('Audit Log — UC Supervisor', [
    'Operational activity only — same restrictions as District Supervisor audit log',
    'Entries scoped to facilities within this UC only',
    'Visible: Stock Entry · Stock Correction',
    'Filters: Action Type · Date Range',
    'Pagination — 10 entries per page',
  ], TEAL),

  ...spacer(1),
  h4('What a UC Supervisor cannot do:'),
  bullet('Create facilities, UCs, or districts', 0, DANGER),
  bullet('Create or manage user accounts', 0, DANGER),
  bullet('See data from facilities outside their UC', 0, DANGER),

  pageBreak(),

  // ══════════════════════════════════════════════════════════════════════════
  // ROLE 4 — FACILITY SUPERVISOR
  // ══════════════════════════════════════════════════════════════════════════
  ...sectionBanner('Role 4 — Facility Supervisor', 'Manages vaccine stock, workers, and thresholds for a single facility', PURPLE),

  ...spacer(1),
  para('The Facility Supervisor is the primary operational role. They manage daily stock, set thresholds, oversee workers, and review detailed audit records for their facility. They land on the Facility Dashboard after login.'),

  ...spacer(1),
  h3('Page 1 — Facility Dashboard'),
  ...spacer(1),

  h4('Section A — Page Header'),
  screenBox('Dashboard Header', [
    'Facility name as the page title',
    'District name shown as subtitle',
    'Live refresh indicator — data auto-refreshes every 15 seconds',
    'Quick-action buttons: Record Delivery · Manage Vaccines · Manage Workers',
  ], PURPLE),

  ...spacer(1),
  h4('Section B — Alert Banner'),
  screenBox('Alert Banner', [
    '🔴  Critical alert — pulsing red banner if any vaccine is critically low',
    '🟡  Low alert — amber banner if any vaccine is running low',
    '🟢  Normal — green banner if all vaccines are healthy',
    '⬜  Stock Not Updated — shown if vaccines have never been recorded  (renamed from "No Data")',
  ], PURPLE),

  ...spacer(1),
  h4('Section C — Stat Cards'),
  screenBox('Stat Cards Row', [
    'Four summary count cards: Critical · Low · Normal · Stock Not Updated',
    '"Stock Not Updated" replaces the former "No Data" label',
  ], PURPLE),

  ...spacer(1),
  h4('Section D — Vaccine Stock Cards  (Needs Attention + Normal Stock)'),
  screenBox('Vaccine Stock Cards', [
    'Vaccines split into two groups: "Needs Attention" (Critical / Low / Stock Not Updated) and "Normal Stock"',
    'Each card shows: vaccine name (Urdu) · ring gauge · dose count · threshold · doses short · last recorded time',
    'Standard threshold reference: Critical ≤ 30 doses / 3 vials · Low ≤ 60 doses / 6 vials · Normal > 60 doses / 6 vials',
    'Clicking a card navigates to Vaccines & Thresholds for that vaccine',
  ], PURPLE),

  ...spacer(1),
  h4('Section E — Vaccine Consumed Summary'),
  screenBox('Vaccine Consumed Summary', [
    'New section showing consumption data per vaccine',
    'Columns: Vaccine Name · Current Stock · Total Doses Consumed · Vial Equivalent',
    'Same status colour coding as stock cards',
  ], PURPLE),

  ...spacer(1),
  h4('Section F — Recent Activity Feed  (simplified)'),
  screenBox('Recent Activity Feed', [
    'Shows only worker dose usage entries (STOCK_ENTRY, type: used)',
    'Columns: Worker Name · Vaccine Used · Doses Used · Time',
    'Administrative actions (threshold changes, user management) removed from this feed',
    'Link to full Audit Log at the top right',
  ], PURPLE),

  ...spacer(1),
  h3('Page 2 — Vaccines & Thresholds'),
  screenBox('Vaccines & Thresholds', [
    'Filter pills: All · Critical · Low · OK · Stock Not Updated',
    'View toggle: Card view / Table view',
    'Card view — per vaccine: name (Urdu) · ring gauge · stock count · threshold · doses short · action buttons',
    'Table view — compact row per vaccine with status bar',
    'Actions per vaccine: Rename · Edit Threshold · Correct Stock · Delete (if never recorded)',
    'Add Vaccine button — select from standard list of 13 vaccines',
    'Default thresholds pre-filled: 30 doses (Critical) / 60 doses (Low)',
  ], PURPLE),

  ...spacer(1),
  h3('Page 3 — Record Stock  (4-Step Wizard)'),
  ...spacer(1),

  simpleTable(
    ['Step', 'What the Supervisor Does'],
    [
      ['Step 1 — Select Vaccine',  'Choose the vaccine from the dropdown. Current balance and status badge shown below the selector.'],
      ['Step 2 — Entry Type',      'Choose: "Received from District" (requires batch details) or "Returned to Facility" (no batch details needed).'],
      ['Step 3 — Quantity & Details', 'Enter dose count with ±1 / ±10 stepper buttons. For Received: enter Batch Number · Expiry Date · Doses Per Vial · Manufacturer · Remarks (Outreach/Fixed toggle). Vial count auto-calculated and displayed.'],
      ['Step 4 — Confirm & Record','Review summary: vaccine · entry type · previous balance · dose quantity + vial count · batch details (if received) · new projected balance. Confirm to save.'],
    ],
    [1800, 7200]
  ),
  ...spacer(1),
  callout('After saving, a success screen shows the new balance in both doses and vials. "Record Another" resets the wizard. "Dashboard" returns home.', 'success'),

  ...spacer(1),
  h3('Page 4 — Stock Register'),
  screenBox('Stock Register', [
    'Vaccine selector — choose a vaccine to view its full ledger',
    'EPI-standard ledger table: Date & Time · Manufacturer · Batch No · Doses/Vial · Expiry · Received · Consumed · Balance · Status · Remarks',
    '"Issued" column renamed to "Consumed"',
    'New Status column: Received / Consumed / Returned / Corrected (colour-coded badges)',
    'Running balance calculated chronologically from all entries',
  ], PURPLE),

  ...spacer(1),
  h3('Page 5 — Worker Management'),
  screenBox('Worker Management', [
    'Table of all facility workers at this facility',
    'Columns: Email · Status (Active/Inactive)',
    'Create new worker — email and password',
    'Activate / Deactivate worker',
    'Reset worker password',
  ], PURPLE),

  ...spacer(1),
  h3('Page 6 — Audit Log'),
  screenBox('Audit Log', [
    'Two tabs: "Supervisor Actions" and "Worker Entries"',
    'Supervisor Actions tab: all actions performed by the logged-in supervisor, paginated (10/page)',
    'Worker Entries tab: per-worker cards, each showing that worker\'s stock entries, paginated (5/page)',
    'Filters (apply to both tabs): Action Type · Start Date · End Date',
    'Reset Filters button shown when filters are active',
    'Entry columns: Action badge · Vaccine / Subject · Doses · Date & Time',
  ], PURPLE),

  pageBreak(),

  // ══════════════════════════════════════════════════════════════════════════
  // ROLE 5 — FACILITY WORKER
  // ══════════════════════════════════════════════════════════════════════════
  ...sectionBanner('Role 5 — Facility Worker', 'Records daily dose usage and checks current stock status', SUCCESS),

  ...spacer(1),
  para('The Facility Worker has the most focused interface — two pages only. They land directly on the Stock Entry page after login.'),

  ...spacer(1),
  h3('Page 1 — Stock Entry (Dose Entry Portal)'),
  screenBox('Stock Entry — Dose Entry Portal', [
    'Left panel (sticky): 2-step entry form',
    '    Step 1 — Select Vaccine: dropdown of facility vaccines (Urdu names). Current balance and status shown on selection.',
    '    Step 2 — Enter Doses: quantity field with quick preset buttons (1 · 5 · 10 · 20 · 50 doses). Calculation check shows: starting balance − used = remaining.',
    '    Critical stock warning shown if vaccine is critically low before proceeding',
    '    Submit → logs the entry, success screen shows new running balance',
    '    "Record Another Entry" resets the form',
    'Right panel (live): Live Facility Stock grid — all vaccines with mini status bars and dose counts. Selected vaccine is highlighted.',
  ], SUCCESS),

  ...spacer(1),
  h3('Page 2 — Stock Status  (Read-Only)'),
  screenBox('Stock Status — Catalog View', [
    'Page title: "Stock Catalog Status"',
    'Facility name and district shown as subtitle',
    'Summary pills: OK · Low · Critical · Stock Not Updated counts',
    'Card grid — one card per vaccine: name (Urdu) · status badge · progress bar · dose count · minimum threshold',
    'Data auto-refreshes every 20 seconds',
    'No actions available — read-only view',
  ], SUCCESS),

  ...spacer(2),

  // ══════════════════════════════════════════════════════════════════════════
  // SHARED FEATURES
  // ══════════════════════════════════════════════════════════════════════════
  h2('Shared Features — All Roles'),

  h3('Login & Authentication'),
  screenBox('Login Page', [
    'Email and password form',
    'On success: each role is automatically redirected to their default dashboard',
    'Forgot Password link → email-based reset flow',
    'Session persists on page refresh (stored in session storage)',
  ], TEXT_MUTED),

  ...spacer(1),
  h3('Sign Out'),
  bullet('Available in the sidebar on every page for all roles'),
  bullet('Clears session and redirects to the login page'),

  ...spacer(1),
  h3('Vaccine Name Display'),
  bullet('All vaccine names are displayed in Urdu throughout the system'),
  bullet('Backend stores canonical names ("Vaccine 01" … "Vaccine 13")'),
  bullet('Frontend maps these to their Urdu equivalents for display'),
  bullet('Text is rendered right-to-left (RTL) where vaccine names appear'),

  ...spacer(1),
  h3('Status Terminology — Standard Definitions'),
  simpleTable(
    ['Status Label', 'Meaning', 'Dose Threshold', 'Visual'],
    [
      ['Critical',          'Immediately requires restocking',     '≤ 30 doses / ≤ 3 vials',   'Red'],
      ['Low',               'Plan restocking soon',                '≤ 60 doses / ≤ 6 vials',   'Amber'],
      ['Normal',            'Healthy stock level',                 '> 60 doses / > 6 vials',   'Green'],
      ['Stock Not Updated', 'No entry has been recorded yet',      'N/A',                       'Grey'],
    ],
    [2000, 2500, 2200, 2300]
  ),

  ...spacer(2),

  // ── Footer ───────────────────────────────────────────────────────────────
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 0 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: SLATE_MID } },
    children: [
      run(
        'This document describes the intended post-change flow of all dashboards. ' +
        'It should be read alongside the Change Request Specification document. ' +
        'Development begins only after client approval of both documents.',
        { size: 18, italic: true, color: TEXT_MUTED }
      ),
    ],
  }),
]

// ── Assemble & write ────────────────────────────────────────────────────────
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
        margin: { top: 1080, bottom: 1080, left: 1000, right: 1000 },
      },
    },
    children,
  }],
})

const buffer = await Packer.toBuffer(doc)
writeFileSync('DASHBOARD_FLOW.docx', buffer)
console.log('Done — DASHBOARD_FLOW.docx written.')
