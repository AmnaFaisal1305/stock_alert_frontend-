import { useAuth } from '../../context/AuthContext'
import {
  Compass, Info, CheckCircle2, AlertTriangle,
  LayoutDashboard, Map, MapPin, Building2, Syringe, Users, ClipboardList,
  BarChart2, ClipboardCheck, PackageOpen, PackagePlus, UserCog, BookOpen,
} from 'lucide-react'
import PageHeader from '../../components/shared/PageHeader'

const GUIDE = {
  super_admin: {
    label: 'Super Admin',
    tagline: 'System-wide control over geography, accounts, the vaccine catalog, and monitoring.',
    purpose:
      "You are the only unscoped role. You build the system's structure — districts, towns, union councils and facilities — provision every supervisor and oversight account, maintain the global vaccine catalog, and monitor stock activity across every facility.",
    responsibilities: [
      'Create and manage districts, towns, union councils and facilities',
      'Provision District / UC / Facility Supervisors, Facility Heads and Observers',
      'Maintain the global vaccine catalog and its default thresholds',
      'Monitor stock status, analytics and the full audit log system-wide',
    ],
    workflow: [
      { title: 'Build the geography', desc: 'Create a district, then its towns, then union councils.' },
      { title: 'Add facilities', desc: 'Create facilities under each union council.' },
      { title: 'Staff the system', desc: 'Assign a District Supervisor; provision UC Supervisors, Facility Heads and Observers.' },
      { title: 'Maintain the catalog', desc: "Set each vaccine's doses-per-vial and critical/low thresholds." },
      { title: 'Monitor', desc: 'Watch the dashboard, analytics and audit log for critical/low stock.' },
    ],
    modules: [
      { icon: LayoutDashboard, name: 'Dashboard', desc: 'Live stock status across every facility, with status rollups.' },
      { icon: Map, name: 'Districts', desc: 'Create, rename, deactivate districts and drill into each one.' },
      { icon: MapPin, name: 'UC Management', desc: 'Manage towns and union councils under each district.' },
      { icon: Building2, name: 'Facilities', desc: 'Create and manage facilities; view per-facility stock.' },
      { icon: Syringe, name: 'Vaccines', desc: 'The global catalog — doses-per-vial and threshold defaults.' },
      { icon: Users, name: 'User Management', desc: 'Create and manage every account; reassign UC Supervisors.' },
      { icon: ClipboardList, name: 'Audit Log', desc: 'Every action, unscoped — who did what, when.' },
      { icon: BarChart2, name: 'Analytics', desc: 'Stock movement, balances, requests and approvals.' },
    ],
  },

  observer: {
    label: 'Observer',
    tagline: 'Read-only, system-wide monitoring — see everything, change nothing.',
    purpose:
      'You see exactly what the Super Admin sees across all districts and facilities, but you cannot create, edit, approve or delete anything. Your role is oversight and reporting.',
    responsibilities: [
      'Monitor stock status across the whole system',
      'Review analytics and the full audit log',
      'Verify data and report findings — without making any changes',
    ],
    workflow: [
      { title: 'Scan the dashboard', desc: 'Spot facilities in critical or low status at a glance.' },
      { title: 'Drill in', desc: 'Open any district or facility for detail.' },
      { title: 'Review analytics & history', desc: 'Check movement, balances and the audit log.' },
      { title: 'Report', desc: 'Share findings outside the system — no actions are taken here.' },
    ],
    note: 'Every create / edit / approve / delete control is hidden for your role. The view is read-only.',
    modules: [
      { icon: LayoutDashboard, name: 'Dashboard', desc: 'Live stock status across every facility.' },
      { icon: Map, name: 'Districts', desc: 'View every district and drill into its facilities.' },
      { icon: Building2, name: 'Facilities', desc: "View any facility's stock and status." },
      { icon: Syringe, name: 'Vaccines', desc: 'View the global vaccine catalog.' },
      { icon: Users, name: 'Users', desc: 'View every account in the system.' },
      { icon: ClipboardList, name: 'Audit Log', desc: 'Every action, unscoped.' },
      { icon: BarChart2, name: 'Analytics', desc: 'Stock movement, balances, requests and approvals.' },
    ],
  },

  district_supervisor: {
    label: 'District Supervisor',
    tagline: "Manage your district's facilities and their supervisors.",
    purpose:
      'You oversee one district. You create facilities within it, provision their Facility Supervisors, and monitor stock across the district. You are not part of the stock request / approval flow.',
    responsibilities: [
      'Create, rename and deactivate facilities in your district',
      'Create and manage Facility Supervisors',
      'Monitor district-wide stock status and activity',
    ],
    workflow: [
      { title: 'Create a facility', desc: 'Add a facility under one of your union councils.' },
      { title: 'Staff it', desc: 'Assign its Facility Supervisor (one active per facility).' },
      { title: 'Monitor', desc: 'Watch the district dashboard and vaccine performance.' },
      { title: 'Review', desc: 'Check the audit log and analytics for your district.' },
    ],
    modules: [
      { icon: LayoutDashboard, name: 'Dashboard', desc: "Stock status across your district's facilities." },
      { icon: Building2, name: 'Vaccine Performance', desc: 'Per-facility vaccine stock within your district.' },
      { icon: Users, name: 'Users', desc: 'Create and manage your Facility Supervisors.' },
      { icon: ClipboardList, name: 'Audit Log', desc: 'Activity within your district (admin actions hidden).' },
      { icon: BarChart2, name: 'Analytics', desc: 'Movement, balances and requests for your district.' },
    ],
  },

  uc_supervisor: {
    label: 'UC Supervisor',
    tagline: 'Handle stock handovers for the facilities in your union council(s).',
    purpose:
      'You cover one or more union councils. Your active role is in the stock request flow: when a facility requests stock, you record what you sent. You can also decline a request before anything is handed over. Otherwise you monitor the facilities under your UCs.',
    responsibilities: [
      'Record what was sent for each stock request (in vials, per vaccine)',
      'Decline a request before any handover, with a reason',
      'Monitor the facilities and staff under your union council(s)',
    ],
    workflow: [
      { title: 'Request raised', desc: 'A facility raises a stock request — you are notified.' },
      { title: 'Hand over stock', desc: 'Physically provide the requested stock to the facility.' },
      { title: "Record 'sent'", desc: 'Enter the sent figures per vaccine (may differ from requested).' },
      { title: 'Figures must match', desc: "Sent must equal the facility's received before the Head can approve." },
      { title: 'Monitor', desc: "Track your UCs' dashboard and analytics." },
    ],
    modules: [
      { icon: LayoutDashboard, name: 'Dashboard', desc: 'Stock status for facilities under your UCs.' },
      { icon: Building2, name: 'Vaccine Performance', desc: 'Per-facility vaccine stock in your UCs.' },
      { icon: Users, name: 'Users', desc: 'View supervisors and workers under your UCs.' },
      { icon: PackageOpen, name: 'Stock Requests', desc: 'Record sent figures; decline requests before handover.' },
      { icon: ClipboardList, name: 'Audit Log', desc: 'Activity under your UCs (admin actions hidden).' },
      { icon: BarChart2, name: 'Analytics', desc: 'Movement, balances and requests for your UCs.' },
    ],
  },

  facility_supervisor: {
    label: 'Facility Supervisor',
    tagline: 'Run day-to-day stock for your facility: requests, assignments and daily usage.',
    purpose:
      "You manage one facility's stock end to end. You request new stock, assign vials to vaccinators each morning, record each worker's end-of-day usage, and propose corrections or threshold changes for the Head to approve. All incoming stock comes through an approved request — there is no direct stock entry.",
    responsibilities: [
      'Raise stock requests and record what was received (with batch details)',
      'Assign vials to vaccinators each morning',
      "Record each worker's day-end: used + returned + wasted",
      'Propose stock corrections and threshold changes (Head approves)',
      "Create and manage your facility's workers",
    ],
    workflow: [
      { title: 'Request stock', desc: 'Raise a stock request — the UC Supervisor and Head are notified.' },
      { title: 'Receive it', desc: "When stock arrives, record 'received' with batch, expiry and manufacturer." },
      { title: 'Head approves', desc: 'Once sent equals received, the Head approves and stock enters the store.' },
      { title: 'Assign in the morning', desc: 'Hand out vials to each vaccinator from the store.' },
      { title: 'Record day-end', desc: "Enter each worker's used + returned + wasted — must equal what they held." },
      { title: 'Corrections', desc: 'Need a stock correction or threshold change? Propose it for Head approval.' },
    ],
    modules: [
      { icon: LayoutDashboard, name: 'Dashboard', desc: "Your facility's live stock status." },
      { icon: ClipboardCheck, name: 'Approvals', desc: 'Propose stock corrections and threshold changes.' },
      { icon: PackageOpen, name: 'Stock Requests', desc: 'Raise requests and record received stock.' },
      { icon: BookOpen, name: 'Stock Register', desc: 'The inward / outward ledger with running balance.' },
      { icon: UserCog, name: 'Users Info', desc: 'Create and manage your vaccinators.' },
      { icon: PackagePlus, name: 'Assign Vials', desc: 'Morning handout of vials to each worker.' },
      { icon: ClipboardList, name: 'Day End', desc: "Record each worker's used / returned / wasted." },
      { icon: BarChart2, name: 'Analytics', desc: 'Movement, balances and requests for your facility.' },
    ],
  },

  facility_worker: {
    label: 'Vaccinator',
    tagline: 'View the vials assigned to you, your usage and what remains.',
    purpose:
      "You are view-only. Your supervisor assigns vials to you each morning and records your usage at the end of the day. You can see what you hold, what has been used, and what remains — you don't record entries yourself.",
    responsibilities: [
      'Review the stock assigned to you and your current holdings',
      "Check your facility's stock status",
    ],
    note: "You don't enter any data. Your supervisor assigns your vials and records your day-end usage.",
    workflow: [
      { title: 'Assigned in the morning', desc: 'Your supervisor assigns you vials from the store.' },
      { title: 'Administer doses', desc: 'Give vaccinations during the day.' },
      { title: 'Supervisor records day-end', desc: 'Your used / returned / wasted is entered by your supervisor.' },
      { title: 'Check anytime', desc: "Review your holdings and your facility's stock status." },
    ],
    modules: [
      { icon: Syringe, name: 'My Holdings', desc: 'Vials assigned to you, used, returned, wasted and remaining.' },
      { icon: LayoutDashboard, name: 'Stock Status', desc: "Your facility's current vaccine stock status." },
    ],
  },

  facility_head: {
    label: 'Facility Head',
    tagline: "Approve your facility's stock movements and monitor all its activity.",
    purpose:
      'You oversee one facility and are its approval authority. You approve stock corrections and threshold changes, and you give the final approval that lets requested stock enter the store once sent and received figures match. You also monitor every action at your facility.',
    responsibilities: [
      'Approve or reject stock corrections and threshold changes',
      'Give final approval on stock requests (once sent = received)',
      'Monitor all facility activity, with current status per item',
    ],
    note: 'You cannot reject a stock request — only approve once figures match. Disputes are resolved outside the system.',
    workflow: [
      { title: 'Review proposals', desc: 'A supervisor proposes a correction or threshold change — you approve or reject it.' },
      { title: 'Figures recorded', desc: "A stock request's sent and received figures are entered by the UC Supervisor and Supervisor." },
      { title: 'Approve the request', desc: 'When sent equals received, you approve — stock enters the store.' },
      { title: 'Monitor', desc: 'Follow the activity history, dashboard and analytics.' },
    ],
    modules: [
      { icon: LayoutDashboard, name: 'Dashboard', desc: "Your facility's live stock status." },
      { icon: Users, name: 'Users', desc: 'View the supervisor and workers at your facility.' },
      { icon: ClipboardCheck, name: 'Approvals', desc: 'Approve or reject corrections and threshold changes.' },
      { icon: PackageOpen, name: 'Stock Requests', desc: 'Give the final approval once figures match.' },
      { icon: ClipboardList, name: 'Audit Log', desc: 'Every action at your facility, with current status.' },
      { icon: BarChart2, name: 'Analytics', desc: 'Movement, balances and requests for your facility.' },
    ],
  },
}

export default function DashboardGuide() {
  const { user } = useAuth()
  const g = GUIDE[user?.role] ?? GUIDE.super_admin

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200 max-w-5xl">

      <PageHeader
        breadcrumb="Guide"
        title={`${g.label} Guide`}
        subtitle={g.tagline}
      />

      {/* Purpose */}
      <section className="bg-surface rounded-2xl border border-surface-border p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Info size={16} className="text-primary flex-shrink-0" />
          <h2 className="text-sm font-bold text-text uppercase tracking-wider">What this dashboard is for</h2>
        </div>
        <p className="text-sm text-text-muted leading-relaxed">{g.purpose}</p>
      </section>

      {/* Note callout (role-specific) */}
      {g.note && (
        <div className="flex items-start gap-2.5 bg-warning-bg border border-warning/20 rounded-2xl px-5 py-4">
          <AlertTriangle size={16} className="text-warning-dark flex-shrink-0 mt-0.5" />
          <p className="text-sm text-warning-dark font-medium leading-relaxed">{g.note}</p>
        </div>
      )}

      {/* Responsibilities */}
      <section className="bg-surface rounded-2xl border border-surface-border p-5 shadow-sm">
        <h2 className="text-sm font-bold text-text uppercase tracking-wider mb-3">Your responsibilities</h2>
        <ul className="flex flex-col gap-2.5">
          {g.responsibilities.map((r) => (
            <li key={r} className="flex items-start gap-2.5">
              <CheckCircle2 size={16} className="text-success flex-shrink-0 mt-0.5" />
              <span className="text-sm text-text-muted leading-relaxed">{r}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Workflow — numbered visual flow */}
      <section className="bg-surface rounded-2xl border border-surface-border p-5 shadow-sm">
        <h2 className="text-sm font-bold text-text uppercase tracking-wider mb-4">Your workflow</h2>
        <ol className="flex flex-col">
          {g.workflow.map((step, i) => {
            const last = i === g.workflow.length - 1
            return (
              <li key={step.title} className="flex gap-3.5">
                {/* Number + connector */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <span className="w-7 h-7 rounded-full bg-primary-bg text-primary text-xs font-bold flex items-center justify-center tabular-nums">
                    {i + 1}
                  </span>
                  {!last && <span className="w-px flex-1 bg-surface-border my-1" aria-hidden="true" />}
                </div>
                {/* Content */}
                <div className={last ? '' : 'pb-4'}>
                  <p className="text-sm font-semibold text-text leading-tight">{step.title}</p>
                  <p className="text-sm text-text-muted mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      {/* Modules */}
      <section className="bg-surface rounded-2xl border border-surface-border p-5 shadow-sm">
        <h2 className="text-sm font-bold text-text uppercase tracking-wider mb-4">Sections on your dashboard</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {g.modules.map((m) => {
            const Icon = m.icon
            return (
              <div key={m.name} className="flex items-start gap-3 border border-surface-border rounded-xl p-3.5">
                <div className="p-2 rounded-lg bg-primary-bg flex-shrink-0">
                  <Icon size={16} className="text-primary" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-text leading-tight">{m.name}</p>
                  <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{m.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
