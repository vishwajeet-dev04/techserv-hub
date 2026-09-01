import type { ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import Layout from './components/Layout'
import RoleProtectedRoute from './components/RoleProtectedRoute'
import Dashboard from './pages/Dashboard'
import Business from './pages/Business'
import CompanyDetail from './pages/CompanyDetail'
import Deals from './pages/Deals'
import DealDetail from './pages/DealDetail'
import Finance from './pages/Finance'
import FinanceBooks from './pages/FinanceBooks'
import {
  CapitalPage,
  CashflowPage,
  FinanceClientsPage,
  FinanceSettingsPage,
  InvoicesPage,
  PayablesPage,
  PurchaseOrdersPage,
} from './pages/FinanceLedger'
import Reports from './pages/Reports'
import Users from './pages/Users'
import Login from './pages/Login'
import type { UserRole } from './types'

const CRM_ROLES: UserRole[] = ['ADMIN', 'MANAGEMENT', 'SALES']
const FINANCE_ROLES: UserRole[] = ['ADMIN', 'MANAGEMENT', 'SALES', 'FINANCE', 'VIEWER']
const ALL_ROLES: UserRole[] = ['ADMIN', 'MANAGEMENT', 'SALES', 'FINANCE', 'VIEWER']

function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = localStorage.getItem('access_token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
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
            path="finance/capital/:type"
            element={
              <RoleProtectedRoute allowedRoles={FINANCE_ROLES}>
                <CapitalPage />
              </RoleProtectedRoute>
            }
          />
          <Route
            path="finance/settings"
            element={
              <RoleProtectedRoute allowedRoles={FINANCE_ROLES}>
                <FinanceSettingsPage />
              </RoleProtectedRoute>
            }
          />
          <Route
            path="reports"
            element={
              <RoleProtectedRoute allowedRoles={ALL_ROLES}>
                <Reports />
              </RoleProtectedRoute>
            }
          />
          <Route
            path="users"
            element={
              <RoleProtectedRoute allowedRoles={['ADMIN']}>
                <Users />
              </RoleProtectedRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
