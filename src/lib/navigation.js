import {
  LayoutDashboard, Map, MapPin, Building2, Users, ScrollText, Syringe, PackagePlus,
  ClipboardCheck, Truck, BookOpen, Sunset, BarChart3, FileSpreadsheet, LifeBuoy, Activity,
  ShieldCheck, Eye, BadgeCheck,
} from 'lucide-react'

// Single source for sidebar items, section groups, per-role CTA and scope label.
// Group `items` with `depth` render as an indented tree (admin geography).

const records = (base, { sheet = true } = {}) => ({
  label: 'Records',
  items: [
    { to: `${base}/audit-log`, label: 'Audit Log', icon: ScrollText },
    { to: `${base}/analytics`, label: 'Analytics', icon: BarChart3 },
    ...(sheet ? [{ to: `${base}/sheet`, label: 'EPI Form B', icon: FileSpreadsheet }] : []),
  ],
})

const ADMIN_GROUPS = [
  { label: 'Overview', items: [{ to: '/super-admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Network',
    items: [
      { to: '/super-admin/districts',  label: 'Districts',       icon: Map,       depth: 0 },
      { to: '/super-admin/ucs',        label: 'Union Councils',  icon: MapPin,    depth: 1 },
      { to: '/super-admin/facilities', label: 'Facilities',      icon: Building2, depth: 2 },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/super-admin/vaccines', label: 'Vaccines', icon: Syringe },
      { to: '/super-admin/users',    label: 'Users',    icon: Users },
    ],
  },
  records('/super-admin'),
]

export const NAV = {
  super_admin: { section: 'Administration', groups: ADMIN_GROUPS, guide: '/super-admin/guide' },
  observer:    { section: 'Observer',       groups: ADMIN_GROUPS, guide: '/super-admin/guide' },
  district_supervisor: {
    section: 'District',
    guide: '/district/guide',
    groups: [
      { label: 'Overview', items: [
        { to: '/district/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
        { to: '/district/network',    label: 'Network',    icon: Map },
        { to: '/district/facilities', label: 'Facilities', icon: Building2 },
      ] },
      { label: 'Team', items: [{ to: '/district/users', label: 'Users', icon: Users }] },
      records('/district', { sheet: false }),
    ],
  },
  uc_supervisor: {
    section: 'Union Council',
    guide: '/uc/guide',
    cta: { to: '/uc/stock-requests', label: 'Stock Requests' },
    groups: [
      { label: 'Overview', items: [
        { to: '/uc/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
        { to: '/uc/facilities', label: 'Facilities', icon: Building2 },
      ] },
      { label: 'Daily work', items: [{ to: '/uc/stock-requests', label: 'Stock Requests', icon: Truck }] },
      { label: 'Team', items: [{ to: '/uc/users', label: 'Users', icon: Users }] },
      records('/uc'),
    ],
  },
  facility_supervisor: {
    section: 'Facility',
    guide: '/facility/guide',
    cta: { to: '/facility/assign-vials', label: 'Assign Vials' },
    groups: [
      { label: 'Overview', items: [{ to: '/facility/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
      { label: 'Daily work', items: [
        { to: '/facility/assign-vials', label: 'Assign Vials',   icon: PackagePlus },
        { to: '/facility/day-end',      label: 'Day End',        icon: Sunset },
        { to: '/facility/approvals',    label: 'Approvals',      icon: ClipboardCheck },
        { to: '/facility/record-stock', label: 'Stock Requests', icon: Truck },
      ] },
      { label: 'Records', items: [
        { to: '/facility/stock-register', label: 'Stock Register', icon: BookOpen },
        { to: '/facility/sheet',          label: 'EPI Form B',     icon: FileSpreadsheet },
        { to: '/facility/audit-log',      label: 'Audit Log',      icon: ScrollText },
        { to: '/facility/analytics',      label: 'Analytics',      icon: BarChart3 },
      ] },
      { label: 'Team', items: [{ to: '/facility/workers', label: 'Workers', icon: Users }] },
    ],
  },
  facility_head: {
    section: 'Facility Head',
    guide: '/head/guide',
    cta: { to: '/head/approvals', label: 'Approvals' },
    groups: [
      { label: 'Overview', items: [{ to: '/head/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
      { label: 'Daily work', items: [
        { to: '/head/approvals',      label: 'Approvals',      icon: ClipboardCheck },
        { to: '/head/stock-requests', label: 'Stock Requests', icon: Truck },
      ] },
      { label: 'Team', items: [{ to: '/head/users', label: 'Users', icon: Users }] },
      records('/head'),
    ],
  },
  facility_worker: {
    section: 'My Workspace',
    guide: '/worker/guide',
    groups: [
      { label: 'Today', items: [
        { to: '/worker/stock-entry', label: 'My Holdings',  icon: Syringe },
        { to: '/worker/status',      label: 'Stock Status', icon: Activity },
      ] },
    ],
  },
}

export const ROLE_LABELS = {
  super_admin:         'Super Admin',
  district_supervisor: 'District Supervisor',
  uc_supervisor:       'UC Supervisor',
  facility_supervisor: 'Facility Supervisor',
  facility_worker:     'Facility Worker',
  facility_head:       'Facility Head',
  observer:            'Observer',
}

// Category colour (StatCard ACCENT key) and icon per role, for role tags and user cards.
export const ROLE_ACCENT = {
  super_admin: 5, observer: 5, district_supervisor: 2, uc_supervisor: 4,
  facility_head: 3, facility_supervisor: 1, facility_worker: 'primary',
}
export const ROLE_ICON = {
  super_admin: ShieldCheck, observer: Eye, district_supervisor: Map, uc_supervisor: MapPin,
  facility_head: BadgeCheck, facility_supervisor: ClipboardCheck, facility_worker: Syringe,
}

export function navFor(role) {
  return NAV[role] ?? { section: 'Navigation', groups: [] }
}

// Where a notification (feed item or push) leads: the role's page for its entity, else the role's first page.
export function linkFor(role, n) {
  const items = navFor(role).groups.flatMap((g) => g.items)
  const label = n.entityType === 'approval' ? 'Approvals' : n.entityType === 'stock_request' || n.type?.startsWith('stock_request') ? 'Stock Requests' : null
  return (label && items.find((i) => i.label === label)?.to) ?? items[0]?.to
}

// What the signed-in user is responsible for (PRODUCT.md "Scope is always visible").
// facilityName is on the session user since Round 35; the district is the fallback for
// sessions stored before that.
export function scopeLabel(user) {
  if (!user) return ''
  if (user.facilityName) return [user.facilityName, user.ucName].filter(Boolean).join(' · ')
  if (user.ucNames?.length) return user.ucNames.join(', ')
  if (user.districtName) return `${user.districtName} District`
  return 'All districts'
}

export { LifeBuoy as GuideIcon }
