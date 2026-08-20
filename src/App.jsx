import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import ErrorBoundary from './components/ErrorBoundary'

// ── Lazy-loaded pages ─────────────────────────────────────────────────────────
const LoginPage             = lazy(() => import('./pages/Login/LoginPage'))
const ForgotPassword        = lazy(() => import('./pages/Login/ForgotPassword'))
const ResetPassword         = lazy(() => import('./pages/Login/ResetPassword'))

const SuperAdminDashboard   = lazy(() => import('./pages/super-admin/Dashboard'))
const DistrictManagement    = lazy(() => import('./pages/super-admin/DistrictManagement'))
const DistrictDetail        = lazy(() => import('./pages/super-admin/DistrictDetail'))
const SuperAdminFacilities  = lazy(() => import('./pages/super-admin/FacilityManagement'))
const SuperAdminUsers       = lazy(() => import('./pages/super-admin/UserManagement'))
const SuperAdminAuditLog    = lazy(() => import('./pages/super-admin/AuditLog'))
const UCManagement          = lazy(() => import('./pages/super-admin/UCManagement'))

const DistrictDashboard     = lazy(() => import('./pages/district-supervisor/Dashboard'))
const FacilityManagement    = lazy(() => import('./pages/district-supervisor/FacilityManagement'))
const DistrictUsers         = lazy(() => import('./pages/district-supervisor/UserManagement'))
const DistrictAuditLog      = lazy(() => import('./pages/district-supervisor/AuditLog'))

const FacilityDetail        = lazy(() => import('./pages/shared/FacilityDetail'))

const FacilityDashboard     = lazy(() => import('./pages/facility-supervisor/Dashboard'))
const RecordStock           = lazy(() => import('./pages/facility-supervisor/RecordStock'))
const StockRegister         = lazy(() => import('./pages/facility-supervisor/StockRegister'))
const ThresholdManagement   = lazy(() => import('./pages/facility-supervisor/ThresholdManagement'))
const WorkerManagement      = lazy(() => import('./pages/facility-supervisor/WorkerManagement'))
const FacilityAuditLog      = lazy(() => import('./pages/facility-supervisor/AuditLog'))

const StockEntry            = lazy(() => import('./pages/facility-worker/StockEntry'))
const WorkerStatusView      = lazy(() => import('./pages/facility-worker/StatusView'))

const UCSupervisorDashboard  = lazy(() => import('./pages/uc-supervisor/Dashboard'))
const UCSupervisorFacilities = lazy(() => import('./pages/uc-supervisor/Facilities'))
const UCSupervisorAuditLog   = lazy(() => import('./pages/uc-supervisor/AuditLog'))

const SuperAdminVaccines     = lazy(() => import('./pages/super-admin/VaccineManagement'))

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
}

function AuthLayout() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Layout><Outlet /></Layout>
}

function LoginRoute() {
  const { isAuthenticated, defaultRoute } = useAuth()
  if (isAuthenticated) return <Navigate to={defaultRoute} replace />
  return <LoginPage />
}

function RoleRedirect() {
  const { user } = useAuth()
  const dest = user ? (ROLE_DEFAULTS[user.role] ?? '/login') : '/login'
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
                <Route path="/super-admin/vaccines"         element={<SuperAdminVaccines />} />
                <Route path="/super-admin/audit-log"        element={<SuperAdminAuditLog />} />

                <Route path="/district/dashboard"      element={<DistrictDashboard />} />
                <Route path="/district/facilities"     element={<FacilityManagement />} />
                <Route path="/district/facilities/:id" element={<FacilityDetail />} />
                <Route path="/district/users"          element={<DistrictUsers />} />
                <Route path="/district/audit-log"      element={<DistrictAuditLog />} />

                <Route path="/facility/dashboard"    element={<FacilityDashboard />} />
                <Route path="/facility/record-stock"    element={<RecordStock />} />
                <Route path="/facility/stock-register"  element={<StockRegister />} />
                <Route path="/facility/thresholds"   element={<ThresholdManagement />} />
                <Route path="/facility/workers"      element={<WorkerManagement />} />
                <Route path="/facility/audit-log"    element={<FacilityAuditLog />} />

                <Route path="/uc/dashboard"          element={<UCSupervisorDashboard />} />
                <Route path="/uc/facilities"         element={<UCSupervisorFacilities />} />
                <Route path="/uc/facilities/:id"     element={<FacilityDetail />} />
                <Route path="/uc/audit-log"          element={<UCSupervisorAuditLog />} />

                <Route path="/worker/stock-entry" element={<StockEntry />} />
                <Route path="/worker/status"      element={<WorkerStatusView />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
