import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import LoginPage             from '@/pages/Login'
import TablesPage            from '@/pages/Tables'
import KitchenPage           from '@/pages/Kitchen'

import OrdersPage            from '@/pages/Orders'
import QrCodesPage           from '@/pages/QrCodes'
import DashboardPage         from '@/pages/Dashboard'
import SettingsPage          from '@/pages/Settings'
import CustomerMenuPage      from '@/pages/CustomerMenu'
import MenuAdminPage         from '@/pages/MenuAdmin'
import TablesAdminPage       from '@/pages/TablesAdmin'
import UsersPage             from '@/pages/Users'
import { UnauthorizedPage }  from '@/pages/Placeholders'
import MarmitariaAdminPage   from '@/pages/MarmitariaAdmin'
import DeliveryDashboardPage from '@/pages/DeliveryDashboard'
import OnlineOrderPage       from '@/pages/OnlineOrder'
import StoreFrontPage        from '@/pages/StoreFront'
import SuperAdminPage        from '@/pages/SuperAdmin'
import OrdersCenterPage        from '@/pages/OrdersCenter'
import OnlineOrdersDashboard   from '@/pages/OnlineOrdersDashboard'
import PrintAgentPage          from '@/pages/PrintAgent'

const ALL_STAFF = ['admin', 'cashier', 'waiter'] as const

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path="/login"        element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="/superadmin"   element={<ProtectedRoute allowedRoles={['superadmin']}><SuperAdminPage /></ProtectedRoute>} />

          {/* ── Pedidos Online (dashboard admin) ── */}
          <Route path="/online-orders" element={<ProtectedRoute allowedRoles={['admin']}><OnlineOrdersDashboard /></ProtectedRoute>} />

          {/* ── Central de Pedidos — rota principal de operação ── */}
          <Route path="/central" element={
            <ProtectedRoute allowedRoles={['admin', 'cashier', 'waiter']}>
              <OrdersCenterPage />
            </ProtectedRoute>
          } />

          {/* ── Admin ── */}
          <Route path="/dashboard"    element={<ProtectedRoute allowedRoles={['admin']}><DashboardPage /></ProtectedRoute>} />
          <Route path="/settings"     element={<ProtectedRoute allowedRoles={['admin']}><SettingsPage /></ProtectedRoute>} />
          <Route path="/menu"         element={<ProtectedRoute allowedRoles={['admin']}><MenuAdminPage /></ProtectedRoute>} />
          <Route path="/tables-admin" element={<ProtectedRoute allowedRoles={['admin']}><TablesAdminPage /></ProtectedRoute>} />
          <Route path="/users"        element={<ProtectedRoute allowedRoles={['admin']}><UsersPage /></ProtectedRoute>} />

          {/* ── Operação (mantidos para acesso direto se necessário) ── */}
          <Route path="/tables"  element={<ProtectedRoute allowedRoles={['admin', 'waiter', 'cashier']}><TablesPage /></ProtectedRoute>} />
          <Route path="/kitchen" element={<ProtectedRoute allowedRoles={['admin', 'kitchen']}><KitchenPage /></ProtectedRoute>} />
          <Route path="/orders"  element={<ProtectedRoute allowedRoles={['admin', 'waiter']}><OrdersPage /></ProtectedRoute>} />

          {/* ── Marmitaria (admin apenas — configuração de pratos) ── */}
          <Route path="/marmitaria/admin" element={<ProtectedRoute allowedRoles={['admin']}><MarmitariaAdminPage /></ProtectedRoute>} />

          {/* ── Entregador ── */}
          <Route path="/delivery" element={<ProtectedRoute allowedRoles={['admin', 'delivery']}><DeliveryDashboardPage /></ProtectedRoute>} />

          {/* ── Agente de Impressão ── */}
          <Route path="/print-agent" element={<ProtectedRoute allowedRoles={['admin', 'kitchen', 'cashier']}><PrintAgentPage /></ProtectedRoute>} />

          {/* ── Público ── */}
          <Route path="/menu/:restaurantId/:table" element={<CustomerMenuPage />} />
          <Route path="/pedido/:restaurantId"      element={<OnlineOrderPage />} />
          <Route path="/loja"                      element={<StoreFrontPage />} />
          <Route path="/qrcodes" element={<ProtectedRoute allowedRoles={['admin']}><QrCodesPage /></ProtectedRoute>} />

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
