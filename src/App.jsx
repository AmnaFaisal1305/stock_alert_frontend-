import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import ErrorBoundary from './components/ErrorBoundary'

import LoginPage from './pages/Login/LoginPage'

import SuperAdminDashboard    from './pages/super-admin/Dashboard'
import DistrictManagement     from './pages/super-admin/DistrictManagement'
import SuperAdminUsers        from './pages/super-admin/UserManagement'
import SuperAdminAuditLog     from './pages/super-admin/AuditLog'

import DistrictDashboard      from './pages/district-supervisor/Dashboard'
import FacilityManagement     from './pages/district-supervisor/FacilityManagement'
import DistrictUsers          from './pages/district-supervisor/UserManagement'
import DistrictAuditLog       from './pages/district-supervisor/AuditLog'

import FacilityDashboard      from './pages/facility-supervisor/Dashboard'
import RecordStock            from './pages/facility-supervisor/RecordStock'
import ThresholdManagement    from './pages/facility-supervisor/ThresholdManagement'
import WorkerManagement       from './pages/facility-supervisor/WorkerManagement'
import FacilityAuditLog       from './pages/facility-supervisor/AuditLog'

import StockEntry             from './pages/facility-worker/StockEntry'
import WorkerStatusView       from './pages/facility-worker/StatusView'

const ROLE_DEFAULTS = {
  super_admin:         '/super-admin/dashboard',
  district_supervisor: '/district/dashboard',
  facility_supervisor: '/facility/dashboard',
  facility_worker:     '/worker/stock-entry',
}

// Layout route — redirects to /login if unauthenticated; renders sidebar+topbar with <Outlet> otherwise
function AuthLayout() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Layout><Outlet /></Layout>
}

// Redirects an already-authenticated user away from /login
function LoginRoute() {
  const { isAuthenticated, defaultRoute } = useAuth()
  if (isAuthenticated) return <Navigate to={defaultRoute} replace />
  return <LoginPage />
}

// Sends the user to their role's default page
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
          <Routes>
            <Route path="/login" element={<LoginRoute />} />

            {/* Authenticated layout — uses <Outlet> so no nested <Routes> needed */}
            <Route element={<AuthLayout />}>
              <Route path="/" element={<RoleRedirect />} />

              <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />
              <Route path="/super-admin/districts"  element={<DistrictManagement />} />
              <Route path="/super-admin/users"      element={<SuperAdminUsers />} />
              <Route path="/super-admin/audit-log"  element={<SuperAdminAuditLog />} />

              <Route path="/district/dashboard"  element={<DistrictDashboard />} />
              <Route path="/district/facilities" element={<FacilityManagement />} />
              <Route path="/district/users"      element={<DistrictUsers />} />
              <Route path="/district/audit-log"  element={<DistrictAuditLog />} />

              <Route path="/facility/dashboard"    element={<FacilityDashboard />} />
              <Route path="/facility/record-stock" element={<RecordStock />} />
              <Route path="/facility/thresholds"   element={<ThresholdManagement />} />
              <Route path="/facility/workers"      element={<WorkerManagement />} />
              <Route path="/facility/audit-log"    element={<FacilityAuditLog />} />

              <Route path="/worker/stock-entry" element={<StockEntry />} />
              <Route path="/worker/status"      element={<WorkerStatusView />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
