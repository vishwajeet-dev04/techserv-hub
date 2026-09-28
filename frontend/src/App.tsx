import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './hooks/useAuth'
import { DateRangeProvider } from './hooks/useDateRange'
import { onPermissionDenied } from './api/permissionNotice'
import { notify } from './lib/notify'
import Layout from './components/Layout'
import HubShell from './components/HubShell'
import SettingsLayout from './components/SettingsLayout'
import RoleProtectedRoute from './components/RoleProtectedRoute'
import PageLoading from './components/PageLoading'
import {
  CapitalPage,
  CashflowPage,
  FinanceClientsPage,
  InvoicesPage,
  PayablesPage,
  PurchaseOrdersPage,
} from './pages/FinanceLedger'
import type { UserRole } from './types'

const Hub = lazy(() => import('./pages/Hub'))
const ExecutiveSummary = lazy(() => import('./pages/ExecutiveSummary'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const OpsPipeline = lazy(() => import('./pages/OpsPipeline'))
const OpsTeam = lazy(() => import('./pages/OpsTeam'))
const Business = lazy(() => import('./pages/Business'))
const CompanyDetail = lazy(() => import('./pages/CompanyDetail'))
const Deals = lazy(() => import('./pages/Deals'))
const DealDetail = lazy(() => import('./pages/DealDetail'))
const Finance = lazy(() => import('./pages/Finance'))
const FinanceBooks = lazy(() => import('./pages/FinanceBooks'))
const FinanceMis = lazy(() => import('./pages/FinanceMis'))
const FinanceCompliance = lazy(() => import('./pages/FinanceCompliance'))
const Reports = lazy(() => import('./pages/Reports'))
const Users = lazy(() => import('./pages/Users'))
const Login = lazy(() => import('./pages/Login'))
const PulseLayout = lazy(() => import('./components/PulseLayout'))
const PulseContacts = lazy(() => import('./pages/pulse/PulseContacts'))
const PulseOpportunities = lazy(() => import('./pages/pulse/PulseOpportunities'))
const PulseReminders = lazy(() => import('./pages/pulse/PulseReminders'))

const CRM_ROLES: UserRole[] = ['ADMIN', 'MANAGEMENT', 'SALES']
const FINANCE_ROLES: UserRole[] = ['ADMIN', 'MANAGEMENT', 'SALES', 'FINANCE', 'VIEWER']
const ALL_ROLES: UserRole[] = ['ADMIN', 'MANAGEMENT', 'SALES', 'FINANCE', 'VIEWER']

function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = localStorage.getItem('access_token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  useEffect(() => onPermissionDenied((message) => notify.error(message)), [])

  return (
    <AuthProvider>
      <DateRangeProvider>
        <Toaster
          position="top-right"
          containerStyle={{ zIndex: 100000 }}
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--color-surface)',
              color: 'var(--color-ink)',
              border: '1px solid var(--color-line)',
              borderRadius: '12px',
              fontSize: '13px',
            },
          }}
        />
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <HubShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Hub />} />
              <Route
                path="summary"
                element={
                  <RoleProtectedRoute allowedRoles={ALL_ROLES}>
                    <ExecutiveSummary />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <RoleProtectedRoute allowedRoles={['ADMIN']}>
                    <SettingsLayout />
                  </RoleProtectedRoute>
                }
              >
                <Route index element={<Navigate to="users" replace />} />
                <Route path="users" element={<Users />} />
              </Route>
            </Route>
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
            <Route path="ops" element={<Dashboard />} />
            <Route
              path="ops/pipeline"
              element={
                <RoleProtectedRoute allowedRoles={CRM_ROLES}>
                  <OpsPipeline />
                </RoleProtectedRoute>
              }
            />
            <Route path="ops/team" element={<Navigate to="/pulse/team" replace />} />
            <Route
              path="business"
              element={
                <RoleProtectedRoute allowedRoles={CRM_ROLES}>
                  <Business />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="business/:id"
              element={
                <RoleProtectedRoute allowedRoles={CRM_ROLES}>
                  <CompanyDetail />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="deals"
              element={
                <RoleProtectedRoute allowedRoles={CRM_ROLES}>
                  <Deals />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="deals/:id"
              element={
                <RoleProtectedRoute allowedRoles={CRM_ROLES}>
                  <DealDetail />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="finance"
              element={
                <RoleProtectedRoute allowedRoles={FINANCE_ROLES}>
                  <Finance />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="finance/books"
              element={
                <RoleProtectedRoute allowedRoles={FINANCE_ROLES}>
                  <FinanceBooks />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="finance/mis"
              element={
                <RoleProtectedRoute allowedRoles={FINANCE_ROLES}>
                  <FinanceMis />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="finance/cashflow"
              element={
                <RoleProtectedRoute allowedRoles={FINANCE_ROLES}>
                  <CashflowPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="finance/clients"
              element={
                <RoleProtectedRoute allowedRoles={FINANCE_ROLES}>
                  <FinanceClientsPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="finance/payables"
              element={
                <RoleProtectedRoute allowedRoles={FINANCE_ROLES}>
                  <PayablesPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="finance/purchase-orders"
              element={
                <RoleProtectedRoute allowedRoles={FINANCE_ROLES}>
                  <PurchaseOrdersPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="finance/invoices"
              element={
                <RoleProtectedRoute allowedRoles={FINANCE_ROLES}>
                  <InvoicesPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="finance/compliance"
              element={
                <RoleProtectedRoute allowedRoles={FINANCE_ROLES}>
                  <FinanceCompliance />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="finance/capital/:type"
              element={
                <RoleProtectedRoute allowedRoles={FINANCE_ROLES}>
                  <CapitalPage />
                </RoleProtectedRoute>
              }
            />
            <Route path="finance/settings" element={<Navigate to="/finance/books" replace />} />
            <Route
              path="reports"
              element={
                <RoleProtectedRoute allowedRoles={ALL_ROLES}>
                  <Reports />
                </RoleProtectedRoute>
              }
            />
            <Route path="users" element={<Navigate to="/settings/users" replace />} />
          </Route>
          <Route
            path="pulse"
            element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={CRM_ROLES}>
                  <PulseLayout />
                </RoleProtectedRoute>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="contacts" replace />} />
            <Route path="contacts" element={<PulseContacts />} />
            <Route path="opportunities" element={<PulseOpportunities />} />
            <Route path="reminders" element={<PulseReminders />} />
            <Route path="team" element={<OpsTeam />} />
            <Route path="settings" element={<Navigate to="/pulse/contacts" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </DateRangeProvider>
    </AuthProvider>
  )
}
