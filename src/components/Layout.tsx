import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { signOut } from '@/services/auth'
import { useAuth } from '@/hooks/useAuth'
import { DEFAULT_MODULES } from '@/services/superAdmin'
import type { AppModule, Role } from '@/types'

interface NavItem {
  label:    string
  path:     string
  icon:     string
  module:   AppModule
  roles:    Role[]
  section?: string
}

const NAV: NavItem[] = [
  { label: 'Central de Pedidos', path: '/central',           icon: '📋', module: 'central',    roles: ['admin', 'cashier', 'waiter'] },
  { label: 'Dashboard',          path: '/dashboard',         icon: '📊', module: 'dashboard',  roles: ['admin'] },
  { label: 'Cozinha',            path: '/kitchen',           icon: '👨‍🍳', module: 'kitchen',    roles: ['admin', 'kitchen'] },
  { label: 'Entregas',           path: '/delivery',          icon: '🛵', module: 'delivery',   roles: ['admin', 'delivery'] },
  { label: 'Pratos do Dia',      path: '/marmitaria/admin', icon: '🍱', module: 'marmitaria', roles: ['admin'] },
  { label: 'Cardápio',           path: '/menu',             icon: '🍔', module: 'menu',       roles: ['admin'] },
  { label: 'Gestão de Mesas',    path: '/tables-admin',     icon: '🪑', module: 'tables',     roles: ['admin'] },
  { label: 'QR Codes',           path: '/qrcodes',          icon: '📷', module: 'qrcodes',    roles: ['admin'] },
  { label: 'Usuários',           path: '/users',            icon: '👥', module: 'users',      roles: ['admin'] },
  { label: 'Configurações',      path: '/settings',         icon: '⚙️', module: 'settings',   roles: ['admin'] },
  { label: 'Impressão Auto',     path: '/print-agent',      icon: '🖨️', module: 'kitchen',    roles: ['admin', 'kitchen', 'cashier'] },
  { label: 'Mesas',              path: '/tables',   icon: '🍽️', module: 'tables',  roles: ['admin', 'waiter', 'cashier'], section: 'extra' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { user }        = useAuth()
  const location        = useLocation()
  const navigate        = useNavigate()
  const [open, setOpen] = useState(false)

  const allowedModules: AppModule[] = user
    ? (user.visibleModules ?? DEFAULT_MODULES[user.role] ?? [])
    : []

  function isAllowed(item: NavItem): boolean {
    if (!user) return false
    return item.roles.includes(user.role) && allowedModules.includes(item.module)
  }

  const mainNav  = NAV.filter((n) => !n.section && isAllowed(n))
  const extraNav = NAV.filter((n) => n.section === 'extra' && isAllowed(n))

  async function handleSignOut() { await signOut(); navigate('/login') }

  function NavLink({ item }: { item: NavItem }) {
    const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
    return (
      <Link to={item.path} onClick={() => setOpen(false)}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
          active ? 'bg-brand-50 font-medium text-brand-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
        }`}>
        <span className="text-base">{item.icon}</span>
        {item.label}
        {item.path === '/central' && active && (
          <span className="ml-auto rounded-full bg-brand-500 w-2 h-2" />
        )}
      </Link>
    )
  }

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-2.5 border-b border-gray-100 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">F</div>
        <span className="font-semibold text-gray-800">FoodStore</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {mainNav.map((item) => <li key={item.path}><NavLink item={item} /></li>)}
          {extraNav.length > 0 && (
            <>
              <li className="pt-4 pb-1 px-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Módulos</span>
              </li>
              {extraNav.map((item) => <li key={item.path}><NavLink item={item} /></li>)}
            </>
          )}
        </ul>
      </nav>
      <div className="border-t border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-gray-700">{user?.name}</p>
            <p className="truncate text-xs text-gray-400">{user?.email}</p>
          </div>
        </div>
        <button onClick={handleSignOut} className="w-full rounded-md border border-gray-200 py-1.5 text-xs text-gray-500 hover:bg-gray-50">Sair</button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="hidden md:flex w-56 flex-col border-r border-gray-100 bg-white"><SidebarContent /></aside>

      <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-xs font-bold text-white">F</div>
          <span className="font-semibold text-gray-800 text-sm">FoodStore</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{user?.name}</span>
          <button onClick={() => setOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600">☰</button>
        </div>
      </div>

      {open && <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)} />}

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
            {mainNav.map((item) => <li key={item.path}><NavLink item={item} /></li>)}
            {extraNav.length > 0 && (
              <>
                <li className="pt-4 pb-1 px-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Módulos</span>
                </li>
                {extraNav.map((item) => <li key={item.path}><NavLink item={item} /></li>)}
              </>
            )}
          </ul>
        </nav>
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="truncate text-xs font-medium text-gray-700">{user?.name}</p>
          <p className="truncate text-xs text-gray-400">{user?.email}</p>
          <button onClick={handleSignOut} className="mt-2 w-full rounded-md border border-gray-200 py-1.5 text-xs text-gray-500">Sair</button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden md:ml-0 mt-[53px] md:mt-0">{children}</main>
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: React.ReactNode
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
