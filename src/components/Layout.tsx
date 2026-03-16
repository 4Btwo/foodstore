import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { signOut } from '@/services/auth'
import { useAuth } from '@/hooks/useAuth'
import type { Role } from '@/types'

interface NavItem {
  label: string
  path:  string
  icon:  string
  roles: Role[]
}

const NAV: NavItem[] = [
  { label: 'Dashboard',     path: '/dashboard',    icon: '📊', roles: ['admin'] },
  { label: 'Mesas',         path: '/tables',       icon: '🍽️', roles: ['admin', 'waiter', 'cashier'] },
  { label: 'Pedidos',       path: '/orders',       icon: '🧾', roles: ['admin', 'waiter', 'cashier'] },
  { label: 'Cozinha',       path: '/kitchen',      icon: '👨‍🍳', roles: ['admin', 'kitchen'] },
  { label: 'Caixa / PDV',   path: '/cashier',      icon: '💳', roles: ['admin', 'cashier'] },
  { label: 'Cardápio',      path: '/menu',         icon: '🍔', roles: ['admin'] },
  { label: 'Gestão mesas',  path: '/tables-admin', icon: '🪑', roles: ['admin'] },
  { label: 'Usuários',      path: '/users',        icon: '👥', roles: ['admin'] },
  { label: 'QR Codes',      path: '/qrcodes',      icon: '📷', roles: ['admin'] },
  { label: 'Configurações', path: '/settings',     icon: '⚙️', roles: ['admin'] },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { user }      = useAuth()
  const location      = useLocation()
  const navigate      = useNavigate()
  const [open, setOpen] = useState(false)

  const visibleNav = NAV.filter((n) => user && n.roles.includes(user.role))

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-gray-100 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
          F
        </div>
        <span className="font-semibold text-gray-800">FoodStore</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {visibleNav.map((item) => {
            const active = location.pathname === item.path
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    active
                      ? 'bg-brand-50 font-medium text-brand-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 px-4 py-3">
        <p className="truncate text-xs font-medium text-gray-700">{user?.name}</p>
        <p className="truncate text-xs text-gray-400">{user?.email}</p>
        <button
          onClick={handleSignOut}
          className="mt-2 w-full rounded-md border border-gray-200 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
        >
          Sair
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r border-gray-100 bg-white">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-xs font-bold text-white">F</div>
          <span className="font-semibold text-gray-800 text-sm">FoodStore</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{user?.name}</span>
          <button
            onClick={() => setOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/30"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-64 flex flex-col bg-white shadow-xl transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-xs font-bold text-white">F</div>
            <span className="font-semibold text-gray-800">FoodStore</span>
          </div>
          <button onClick={() => setOpen(false)} className="text-gray-400 text-xl">✕</button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {visibleNav.map((item) => {
              const active = location.pathname === item.path
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition ${
                      active
                        ? 'bg-brand-50 font-medium text-brand-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="truncate text-xs font-medium text-gray-700">{user?.name}</p>
          <p className="truncate text-xs text-gray-400">{user?.email}</p>
          <button onClick={handleSignOut} className="mt-2 w-full rounded-md border border-gray-200 py-1.5 text-xs text-gray-500">
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden md:ml-0 mt-[53px] md:mt-0">
        {children}
      </main>
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: {
  title:     string
  subtitle?: string
  action?:   React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 md:px-6 py-3 md:py-4">
      <div>
        <h1 className="text-base md:text-lg font-semibold text-gray-800">{title}</h1>
        {subtitle && <p className="text-xs md:text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
