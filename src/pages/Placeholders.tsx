import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { signOut } from '@/services/auth'

function PageShell({ title, color }: { title: string; color: string }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Topbar */}
      <header className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-sm font-bold"
            style={{ background: color }}
          >
            F
          </div>
          <span className="font-semibold text-gray-800">FoodStore</span>
          <span className="text-gray-300">·</span>
          <span className="text-sm text-gray-500">{title}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.name} ({user?.role})</span>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Content placeholder */}
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white text-2xl font-bold"
            style={{ background: color }}
          >
            🚧
          </div>
          <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">Esta tela será construída na Fase 1</p>
        </div>
      </main>
    </div>
  )
}

export function DashboardPage()  { return <PageShell title="Dashboard"  color="#f97316" /> }
export function TablesPage()     { return <PageShell title="Mesas"      color="#3b82f6" /> }
export function OrdersPage()     { return <PageShell title="Pedidos"    color="#8b5cf6" /> }
export function KitchenPage()    { return <PageShell title="Cozinha"    color="#10b981" /> }
export function CashierPage()    { return <PageShell title="Caixa/PDV"  color="#f59e0b" /> }
export function MenuPage()       { return <PageShell title="Cardápio"   color="#ec4899" /> }
export function SettingsPage()   { return <PageShell title="Configurações" color="#6b7280" /> }

export function UnauthorizedPage() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50">
      <p className="text-lg font-semibold text-gray-700">Acesso não autorizado</p>
      <p className="text-sm text-gray-500">Você não tem permissão para acessar esta página.</p>
      <button
        onClick={() => navigate(-1)}
        className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600"
      >
        Voltar
      </button>
    </div>
  )
}
