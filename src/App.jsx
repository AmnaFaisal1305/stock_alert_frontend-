import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { linkFor } from './lib/navigation'

// ── Lazy-loaded pages ─────────────────────────────────────────────────────────
const LoginPage             = lazy(() => import('./pages/login/LoginPage'))
const ForgotPassword        = lazy(() => import('./pages/login/ForgotPassword'))
const ResetPassword         = lazy(() => import('./pages/login/ResetPassword'))

const SuperAdminDashboard   = lazy(() => import('./pages/super-admin/Dashboard'))
const DistrictManagement    = lazy(() => import('./pages/super-admin/DistrictManagement'))
const DistrictDetail        = lazy(() => import('./pages/super-admin/DistrictDetail'))
const SuperAdminFacilities  = lazy(() => import('./pages/super-admin/FacilityManagement'))
const SuperAdminUsers       = lazy(() => import('./pages/super-admin/UserManagement'))
const SuperAdminAuditLog    = lazy(() => import('./pages/super-admin/AuditLog'))
const UCManagement          = lazy(() => import('./pages/super-admin/UCManagement'))
const UCDetail              = lazy(() => import('./pages/super-admin/UCDetail'))

const DistrictDashboard     = lazy(() => import('./pages/district-supervisor/Dashboard'))
const DistrictNetwork       = lazy(() => import('./pages/district-supervisor/Network'))
const FacilityManagement    = lazy(() => import('./pages/district-supervisor/FacilityManagement'))
const DistrictUsers         = lazy(() => import('./pages/district-supervisor/UserManagement'))
const DistrictAuditLog      = lazy(() => import('./pages/district-supervisor/AuditLog'))

const FacilityDetail        = lazy(() => import('./pages/shared/FacilityDetail'))

const FacilityDashboard     = lazy(() => import('./pages/facility-supervisor/Dashboard'))
const RecordStock           = lazy(() => import('./pages/facility-supervisor/RecordStock'))
const StockRegister         = lazy(() => import('./pages/facility-supervisor/StockRegister'))
const WorkerManagement      = lazy(() => import('./pages/facility-supervisor/WorkerManagement'))
const FacilityAuditLog      = lazy(() => import('./pages/facility-supervisor/AuditLog'))

const StockEntry            = lazy(() => import('./pages/facility-worker/StockEntry'))
const WorkerStatusView      = lazy(() => import('./pages/facility-worker/StatusView'))

const UCSupervisorDashboard  = lazy(() => import('./pages/uc-supervisor/Dashboard'))
const UCSupervisorFacilities = lazy(() => import('./pages/uc-supervisor/Facilities'))
const UCSupervisorUsers      = lazy(() => import('./pages/uc-supervisor/Users'))
const UCSupervisorAuditLog   = lazy(() => import('./pages/uc-supervisor/AuditLog'))

const SuperAdminVaccines     = lazy(() => import('./pages/super-admin/VaccineManagement'))

const AssignVials            = lazy(() => import('./pages/facility-supervisor/AssignVials'))
const DayEnd                 = lazy(() => import('./pages/facility-supervisor/DayEnd'))

const FacilityHeadDashboard  = lazy(() => import('./pages/facility-head/Dashboard'))
const FacilityHeadUsers      = lazy(() => import('./pages/facility-head/Users'))
const FacilityHeadAuditLog   = lazy(() => import('./pages/facility-head/AuditLog'))
const FacilityApprovals      = lazy(() => import('./pages/facility-supervisor/Approvals'))
const FacilityHeadApprovals  = lazy(() => import('./pages/facility-head/Approvals'))
const FacilityHeadStockReqs  = lazy(() => import('./pages/facility-head/StockRequests'))
const UCSupervisorStockReqs  = lazy(() => import('./pages/uc-supervisor/StockRequests'))
const Analytics              = lazy(() => import('./pages/shared/Analytics'))
const DashboardGuide         = lazy(() => import('./pages/shared/DashboardGuide'))
const FormBSheet             = lazy(() => import('./pages/shared/FormBSheet'))

// ── Page skeleton shown while a lazy chunk loads ──────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

const ROLE_DEFAULTS = {
  super_admin:         '/super-admin/dashboard',
  district_supervisor: '/district/dashboard',
  uc_supervisor:       '/uc/dashboard',
  facility_supervisor: '/facility/dashboard',
  facility_worker:     '/worker/stock-entry',
  facility_head:       '/head/dashboard',
  observer:            '/super-admin/dashboard',
}

// Each role's pages live under one URL prefix; the backend 403s the data, this keeps the screen out too.
const PREFIX_ROLES = {
  'super-admin': ['super_admin', 'observer'],
  district:      ['district_supervisor'],
  uc:            ['uc_supervisor'],
  facility:      ['facility_supervisor'],
  head:          ['facility_head'],
  worker:        ['facility_worker'],
}

function AuthLayout() {
  const { user, isAuthenticated, bootstrapping } = useAuth()
  const { pathname } = useLocation()
  if (bootstrapping) return <PageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  const allowed = PREFIX_ROLES[pathname.split('/')[1]]
  if (allowed && !allowed.includes(user.role)) return <Navigate to={ROLE_DEFAULTS[user.role] ?? '/login'} replace />
  return <Layout><Outlet /></Layout>
}

function LoginRoute() {
  const { isAuthenticated, defaultRoute, bootstrapping } = useAuth()
  if (bootstrapping) return <PageLoader />
  if (isAuthenticated) return <Navigate to={defaultRoute} replace />
  return <LoginPage />
}

function RoleRedirect() {
  const { user } = useAuth()
  const { search } = useLocation()
  // A tapped push opens /?notif=<type>&entityType=…; the backend's url is only the app root.
  const params = new URLSearchParams(search)
  const pushed = user && params.get('notif')
    ? linkFor(user.role, { type: params.get('notif'), entityType: params.get('entityType') })
    : null
  const dest = pushed ?? (user ? (ROLE_DEFAULTS[user.role] ?? '/login') : '/login')
  return <Navigate to={dest} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login"           element={<LoginRoute />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password"  element={<ResetPassword />} />

              <Route element={<AuthLayout />}>
                <Route path="/" element={<RoleRedirect />} />

                <Route path="/super-admin/dashboard"        element={<SuperAdminDashboard />} />
                <Route path="/super-admin/districts"        element={<DistrictManagement />} />
                <Route path="/super-admin/districts/:id"    element={<DistrictDetail />} />
                <Route path="/super-admin/facilities"       element={<SuperAdminFacilities />} />
                <Route path="/super-admin/facilities/:id"   element={<FacilityDetail />} />
                <Route path="/super-admin/users"            element={<SuperAdminUsers />} />
                <Route path="/super-admin/ucs"              element={<UCManagement />} />
                <Route path="/super-admin/ucs/:id"          element={<UCDetail />} />
                <Route path="/super-admin/vaccines"         element={<SuperAdminVaccines />} />
                <Route path="/super-admin/audit-log"        element={<SuperAdminAuditLog />} />
                <Route path="/super-admin/analytics"       element={<Analytics />} />
                <Route path="/super-admin/sheet"           element={<FormBSheet />} />
                <Route path="/super-admin/guide"           element={<DashboardGuide />} />

                <Route path="/district/dashboard"      element={<DistrictDashboard />} />
                <Route path="/district/network"        element={<DistrictNetwork />} />
                <Route path="/district/facilities"     element={<FacilityManagement />} />
                <Route path="/district/facilities/:id" element={<FacilityDetail />} />
                <Route path="/district/users"          element={<DistrictUsers />} />
                <Route path="/district/audit-log"      element={<DistrictAuditLog />} />
                <Route path="/district/analytics"      element={<Analytics />} />
                <Route path="/district/guide"          element={<DashboardGuide />} />

                <Route path="/facility/dashboard"    element={<FacilityDashboard />} />
                <Route path="/facility/approvals"    element={<FacilityApprovals />} />
                <Route path="/facility/record-stock"    element={<RecordStock />} />
                <Route path="/facility/stock-register"  element={<StockRegister />} />
                <Route path="/facility/workers"      element={<WorkerManagement />} />
                <Route path="/facility/assign-vials" element={<AssignVials />} />
                <Route path="/facility/day-end"      element={<DayEnd />} />
                <Route path="/facility/audit-log"    element={<FacilityAuditLog />} />
                <Route path="/facility/analytics"    element={<Analytics />} />
                <Route path="/facility/sheet"        element={<FormBSheet />} />
                <Route path="/facility/guide"        element={<DashboardGuide />} />

                <Route path="/head/dashboard"      element={<FacilityHeadDashboard />} />
                <Route path="/head/users"          element={<FacilityHeadUsers />} />
                <Route path="/head/approvals"      element={<FacilityHeadApprovals />} />
                <Route path="/head/stock-requests" element={<FacilityHeadStockReqs />} />
                <Route path="/head/audit-log"      element={<FacilityHeadAuditLog />} />
                <Route path="/head/analytics"      element={<Analytics />} />
                <Route path="/head/sheet"          element={<FormBSheet />} />
                <Route path="/head/guide"          element={<DashboardGuide />} />

                <Route path="/uc/dashboard"          element={<UCSupervisorDashboard />} />
                <Route path="/uc/facilities"         element={<UCSupervisorFacilities />} />
                <Route path="/uc/facilities/:id"     element={<FacilityDetail />} />
                <Route path="/uc/users"              element={<UCSupervisorUsers />} />
                <Route path="/uc/stock-requests"     element={<UCSupervisorStockReqs />} />
                <Route path="/uc/audit-log"          element={<UCSupervisorAuditLog />} />
                <Route path="/uc/analytics"          element={<Analytics />} />
                <Route path="/uc/sheet"              element={<FormBSheet />} />
                <Route path="/uc/guide"              element={<DashboardGuide />} />

                <Route path="/worker/stock-entry" element={<StockEntry />} />
                <Route path="/worker/status"      element={<WorkerStatusView />} />
                <Route path="/worker/guide"       element={<DashboardGuide />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
