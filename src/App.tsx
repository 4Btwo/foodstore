import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import LoginPage from '@/pages/Login'
import TablesPage from '@/pages/Tables'
import KitchenPage from '@/pages/Kitchen'
import CashierPage from '@/pages/Cashier'
import OrdersPage from '@/pages/Orders'
import QrCodesPage from '@/pages/QrCodes'
import DashboardPage from '@/pages/Dashboard'
import SettingsPage from '@/pages/Settings'
import CustomerMenuPage from '@/pages/CustomerMenu'
import MenuAdminPage from '@/pages/MenuAdmin'
import TablesAdminPage from '@/pages/TablesAdmin'
import UsersPage from '@/pages/Users'
import { UnauthorizedPage } from '@/pages/Placeholders'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Pública */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Admin */}
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SettingsPage />
            </ProtectedRoute>
          } />
          <Route path="/menu" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <MenuAdminPage />
            </ProtectedRoute>
          } />
          <Route path="/tables-admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <TablesAdminPage />
            </ProtectedRoute>
          } />
          <Route path="/users" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UsersPage />
            </ProtectedRoute>
          } />

          {/* Garçom */}
          <Route path="/tables" element={
            <ProtectedRoute allowedRoles={['admin', 'waiter', 'cashier']}>
              <TablesPage />
            </ProtectedRoute>
          } />

          {/* Cozinha */}
          <Route path="/kitchen" element={
            <ProtectedRoute allowedRoles={['admin', 'kitchen']}>
              <KitchenPage />
            </ProtectedRoute>
          } />

          {/* Caixa */}
          <Route path="/cashier" element={
            <ProtectedRoute allowedRoles={['admin', 'cashier']}>
              <CashierPage />
            </ProtectedRoute>
          } />

          {/* Pedidos */}
          <Route path="/orders" element={
            <ProtectedRoute allowedRoles={['admin', 'waiter']}>
              <OrdersPage />
            </ProtectedRoute>
          } />

          {/* Cardápio público — cliente via QR */}
          <Route path="/menu/:restaurantId/:table" element={<CustomerMenuPage />} />

          {/* QR Codes das mesas — admin */}
          <Route path="/qrcodes" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <QrCodesPage />
            </ProtectedRoute>
          } />

          {/* Default */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
