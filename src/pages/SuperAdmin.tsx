import { useState, useEffect } from 'react'
import { signOut } from '@/services/auth'
import { useNavigate } from 'react-router-dom'
import {
  subscribeAllRestaurants,
  subscribeLeads,
  updateLeadStatus,
  type Lead, type LeadStatus, subscribeUsersByRestaurant,
  createRestaurant, updateRestaurantById, deleteRestaurantById,
  createUserForRestaurant, updateUserById, deleteUserById,
  ALL_MODULES, DEFAULT_MODULES,
} from '@/services/superAdmin'
import type { Restaurant, AppUser, Role, AppModule } from '@/types'

const ROLE_LABEL: Record<Role, string> = {
  superadmin: '👑 Super Admin',
  admin:      '🔑 Admin',
  cashier:    '💳 Caixa',
  waiter:     '🧑‍🍳 Garçom',
  kitchen:    '👨‍🍳 Cozinha',
  delivery:   '🛵 Entregador',
}

const ROLE_COLOR: Record<Role, string> = {
  superadmin: 'bg-yellow-100 text-yellow-800',
  admin:      'bg-purple-100 text-purple-700',
  cashier:    'bg-blue-100 text-blue-700',
  waiter:     'bg-amber-100 text-amber-700',
  kitchen:    'bg-green-100 text-green-700',
  delivery:   'bg-orange-100 text-orange-700',
}

const SUB_ROLES: Role[] = ['admin', 'cashier', 'waiter', 'kitchen', 'delivery']

// ─── Componentes utilitários ──────────────────────────────────────────────────
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">✕</button>
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  )
}

function SAInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 ${props.className ?? ''}`}
    />
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{msg}</div>
}

function ModalFooter({ onClose, onSave, saving, label }: {
  onClose: () => void; onSave: () => void; saving: boolean; label: string
}) {
  return (
    <div className="mt-2 flex gap-2 pt-2">
      <button
        onClick={onClose}
        className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
      >
        Cancelar
      </button>
      <button
        onClick={onSave}
        disabled={saving}
        className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? 'Salvando…' : label}
      </button>
    </div>
  )
}

// ─── Modal: Novo Restaurante ──────────────────────────────────────────────────
function NewRestaurantModal({ onClose, onCreated }: {
  onClose: () => void; onCreated: (id: string) => void
}) {
  const [name, setName]     = useState('')
  const [color, setColor]   = useState('#f97316')
  const [rate, setRate]     = useState(10)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSave() {
    if (!name.trim()) { setError('Nome obrigatório'); return }
    setSaving(true); setError('')
    try {
      const id = await createRestaurant({ name: name.trim(), primaryColor: color, serviceRate: rate })
      onCreated(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar')
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Novo Restaurante" onClose={onClose}>
      {error && <ErrorBox msg={error} />}
      <Field label="Nome do restaurante *">
        <SAInput value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Burger House" />
      </Field>
      <Field label="Cor principal">
        <div className="flex gap-3 items-center">
          <input
            type="color" value={color} onChange={e => setColor(e.target.value)}
            className="h-10 w-14 rounded-lg border border-gray-200 p-0.5 cursor-pointer"
          />
          <SAInput className="flex-1 font-mono" value={color} onChange={e => setColor(e.target.value)} maxLength={7} />
        </div>
      </Field>
      <Field label={`Taxa de serviço: ${rate}%`}>
        <input
          type="range" min={0} max={20} step={1} value={rate}
          onChange={e => setRate(Number(e.target.value))}
          className="w-full accent-brand-500"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0%</span><span>20%</span>
        </div>
      </Field>
      <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} label="Criar restaurante" />
    </Modal>
  )
}

// ─── Modal: Novo Usuário ──────────────────────────────────────────────────────
function NewUserModal({ restaurantId, restaurantName, onClose }: {
  restaurantId: string; restaurantName: string; onClose: () => void
}) {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState<Role>('waiter')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function handleSave() {
    if (!name.trim() || !email.trim() || password.length < 6) {
      setError('Preencha todos os campos (senha mín. 6 caracteres)'); return
    }
    setSaving(true); setError('')
    try {
      await createUserForRestaurant({ name, email, password, role, restaurantId })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`Novo usuário — ${restaurantName}`} onClose={onClose}>
      {error && <ErrorBox msg={error} />}
      <Field label="Nome completo *">
        <SAInput value={name} onChange={e => setName(e.target.value)} placeholder="Nome do usuário" />
      </Field>
      <Field label="E-mail *">
        <SAInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@email.com" />
      </Field>
      <Field label="Senha *">
        <SAInput type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mín. 6 caracteres" />
      </Field>
      <Field label="Função">
        <div className="grid grid-cols-2 gap-2">
          {SUB_ROLES.map(r => (
            <button key={r} onClick={() => setRole(r)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition text-left ${
                role === r
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </Field>
      <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} label="Criar usuário" />
    </Modal>
  )
}

// ─── Modal: Permissões do usuário ─────────────────────────────────────────────
function PermissionsModal({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const defaultMods = DEFAULT_MODULES[user.role] ?? []
  const currentMods = user.visibleModules ?? defaultMods
  const [selected, setSelected] = useState<Set<AppModule>>(new Set(currentMods))
  const [saving, setSaving]     = useState(false)

  function toggle(mod: AppModule) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(mod) ? next.delete(mod) : next.add(mod)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    await updateUserById(user.uid, { visibleModules: Array.from(selected) })
    setSaving(false)
    onClose()
  }

  function resetToDefault() {
    setSelected(new Set(DEFAULT_MODULES[user.role] ?? []))
  }

  return (
    <Modal title={`Permissões — ${user.name}`} onClose={onClose}>
      <p className="text-xs text-gray-500">Defina quais módulos este usuário pode acessar no menu lateral.</p>
      <button onClick={resetToDefault} className="text-xs text-brand-600 hover:underline">
        ↺ Restaurar padrão da função ({ROLE_LABEL[user.role]})
      </button>
      <div className="grid grid-cols-2 gap-2">
        {ALL_MODULES.map(({ key, label, icon }) => {
          const on = selected.has(key)
          return (
            <button key={key} onClick={() => toggle(key)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                on
                  ? 'border-brand-400 bg-brand-50 text-brand-700'
                  : 'border-gray-100 text-gray-400 hover:bg-gray-50'
              }`}>
              <span>{icon}</span>
              <span className="text-xs">{label}</span>
              <span className={`ml-auto h-4 w-4 rounded-full border-2 ${on ? 'border-brand-500 bg-brand-500' : 'border-gray-300'}`} />
            </button>
          )
        })}
      </div>
      <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} label="Salvar permissões" />
    </Modal>
  )
}

// ─── Modal: Editar Restaurante ────────────────────────────────────────────────
function EditRestaurantModal({ restaurant, onClose }: { restaurant: Restaurant; onClose: () => void }) {
  const [name, setName]   = useState(restaurant.name)
  const [color, setColor] = useState(restaurant.primaryColor)
  const [rate, setRate]   = useState(Math.round((restaurant.serviceRate ?? 0) * 100))
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSave() {
    if (!name.trim()) { setError('Nome obrigatório'); return }
    setSaving(true); setError('')
    try {
      await updateRestaurantById(restaurant.id, {
        name: name.trim(),
        primaryColor: color,
        serviceRate: rate / 100,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`Editar — ${restaurant.name}`} onClose={onClose}>
      {error && <ErrorBox msg={error} />}
      <Field label="Nome do restaurante *">
        <SAInput value={name} onChange={e => setName(e.target.value)} />
      </Field>
      <Field label="Cor principal">
        <div className="flex gap-3 items-center">
          <input
            type="color" value={color} onChange={e => setColor(e.target.value)}
            className="h-10 w-14 rounded-lg border border-gray-200 p-0.5 cursor-pointer"
          />
          <SAInput className="flex-1 font-mono" value={color} onChange={e => setColor(e.target.value)} maxLength={7} />
        </div>
      </Field>
      <Field label={`Taxa de serviço: ${rate}%`}>
        <input
          type="range" min={0} max={20} step={1} value={rate}
          onChange={e => setRate(Number(e.target.value))}
          className="w-full accent-brand-500"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0%</span><span>20%</span>
        </div>
      </Field>
      <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} label="Salvar alterações" />
    </Modal>
  )
}

// ─── Card de restaurante com usuários ────────────────────────────────────────
function RestaurantCard({
  restaurant, expanded, onToggle, onAddUser, onDeleteRestaurant,
}: {
  restaurant: Restaurant
  expanded: boolean
  onToggle: () => void
  onAddUser: () => void
  onDeleteRestaurant: () => void
}) {
  const [users, setUsers]       = useState<AppUser[]>([])
  const [permUser, setPermUser] = useState<AppUser | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    if (!expanded) return
    return subscribeUsersByRestaurant(restaurant.id, setUsers)
  }, [expanded, restaurant.id])

  async function handleDeleteUser(u: AppUser) {
    if (!confirm(`Excluir usuário "${u.name}"? Esta ação não pode ser desfeita.`)) return
    await deleteUserById(u.uid)
  }

  async function handleToggleDisable(u: AppUser) {
    await updateUserById(u.uid, { disabled: !u.disabled })
  }

  async function handleRoleChange(u: AppUser, role: Role) {
    await updateUserById(u.uid, { role })
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black text-white shadow-sm"
          style={{ background: restaurant.primaryColor }}
        >
          {restaurant.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900">{restaurant.name}</p>
          <p className="text-xs text-gray-400">
            ID: <span className="font-mono select-all">{restaurant.id}</span>
            {' · '}Taxa: {(restaurant.serviceRate * 100).toFixed(0)}%
            {' · '}<span style={{ color: restaurant.primaryColor }}>●</span> cor
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* Toggle loja online */}
          <button
            onClick={() => updateRestaurantById(restaurant.id, {
              onlineOrderEnabled: !restaurant.onlineOrderEnabled
            })}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              restaurant.onlineOrderEnabled
                ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                : 'border-gray-200 text-gray-400 hover:bg-gray-50'
            }`}
            title={restaurant.onlineOrderEnabled ? 'Desabilitar loja na central' : 'Habilitar loja na central'}
          >
            🛍️ {restaurant.onlineOrderEnabled ? 'Loja ativa' : 'Loja off'}
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/pedido/${restaurant.id}`)
              alert('Link copiado!')
            }}
            className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
            title="Copiar link de pedidos online"
          >
            🔗 Link
          </button>
          <button
            onClick={() => setEditOpen(true)}
            className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            title="Editar restaurante"
          >
            ✏️ Editar
          </button>
          <button
            onClick={onAddUser}
            className="rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700"
          >
            + Usuário
          </button>
          <button
            onClick={onDeleteRestaurant}
            className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50"
          >
            🗑
          </button>
          <button
            onClick={onToggle}
            className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
          >
            {expanded ? '▲ Fechar' : '▼ Usuários'}
          </button>
        </div>
      </div>

      {/* Tabela de usuários */}
      {expanded && (
        <div className="border-t border-gray-100">
          {users.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-400">
              Nenhum usuário neste restaurante
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-gray-400">Usuário</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-gray-400">Função</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-gray-400 hidden sm:table-cell">Status</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-gray-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.uid} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.role === 'admin' || u.role === 'superadmin' ? (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ROLE_COLOR[u.role]}`}>
                          {ROLE_LABEL[u.role]}
                        </span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={e => handleRoleChange(u, e.target.value as Role)}
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          {SUB_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.disabled ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-700'
                      }`}>
                        {u.disabled ? 'Desabilitado' : 'Ativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setPermUser(u)}
                          className="rounded-lg border border-brand-200 px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                          title="Permissões"
                        >
                          🔒 Módulos
                        </button>
                        <button
                          onClick={() => handleToggleDisable(u)}
                          className={`rounded-lg border px-2 py-1 text-xs font-medium transition ${
                            u.disabled
                              ? 'border-green-200 text-green-600 hover:bg-green-50'
                              : 'border-amber-200 text-amber-600 hover:bg-amber-50'
                          }`}
                        >
                          {u.disabled ? 'Ativar' : 'Pausar'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="rounded-lg border border-red-100 px-2 py-1 text-xs text-red-400 hover:bg-red-50"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {permUser && <PermissionsModal user={permUser} onClose={() => setPermUser(null)} />}
      {editOpen  && <EditRestaurantModal restaurant={restaurant} onClose={() => setEditOpen(false)} />}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

// ─── Status badges ────────────────────────────────────────────────────────────

const LEAD_STATUS_CFG: Record<LeadStatus, { label: string; cls: string }> = {
  novo:       { label: 'Novo',       cls: 'bg-blue-100 text-blue-700' },
  contatado:  { label: 'Contatado',  cls: 'bg-amber-100 text-amber-700' },
  convertido: { label: 'Convertido', cls: 'bg-green-100 text-green-700' },
  perdido:    { label: 'Perdido',    cls: 'bg-gray-100 text-gray-500' },
}

function LeadsPanel({ leads }: { leads: Lead[] }) {
  const newCount       = leads.filter(l => l.status === 'novo').length
  const convertedCount = leads.filter(l => l.status === 'convertido').length

  async function changeStatus(id: string, status: LeadStatus) {
    await updateLeadStatus(id, status)
  }

  return (
    <div className="space-y-4">
      {/* Métricas rápidas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
          <p className="text-2xl font-black text-gray-900">{leads.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total de leads</p>
        </div>
        <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 shadow-sm">
          <p className="text-2xl font-black text-blue-700">{newCount}</p>
          <p className="text-xs text-blue-500 mt-0.5">Novos hoje</p>
        </div>
        <div className="rounded-2xl bg-green-50 border border-green-100 p-4 shadow-sm">
          <p className="text-2xl font-black text-green-700">{convertedCount}</p>
          <p className="text-xs text-green-500 mt-0.5">Convertidos</p>
        </div>
      </div>

      {/* Lista de leads */}
      {leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
          <span className="text-5xl">🔥</span>
          <p className="text-sm">Nenhum lead ainda</p>
          <p className="text-xs">Os interessados pelo plano aparecerão aqui</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => {
            const cfg = LEAD_STATUS_CFG[lead.status]
            const date = lead.createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
            const time = lead.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            return (
              <div key={lead.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-gray-900">{lead.nome}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>
                      <span className="text-xs text-gray-400">{date} {time}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-0.5">🍴 <span className="font-medium">{lead.restaurante}</span></p>
                    <p className="text-xs text-gray-500">📧 {lead.email}</p>
                    {lead.whatsapp && (
                      <p className="text-xs text-gray-500">📱 {lead.whatsapp}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">Plano: <span className="font-semibold text-gray-600">{lead.plano}</span></p>
                    {lead.mensagem && (
                      <p className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 italic">"{lead.mensagem}"</p>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {lead.whatsapp && (
                      <a
                        href={`https://wa.me/55${lead.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${lead.nome}! Vi seu interesse no FoodStore. Posso te ajudar?`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-xl bg-green-500 px-3 py-2 text-xs font-bold text-white hover:bg-green-600"
                      >
                        💬 WhatsApp
                      </a>
                    )}
                    <select
                      value={lead.status}
                      onChange={e => changeStatus(lead.id, e.target.value as LeadStatus)}
                      className="rounded-xl border border-gray-200 px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-brand-400"
                    >
                      <option value="novo">Novo</option>
                      <option value="contatado">Contatado</option>
                      <option value="convertido">Convertido</option>
                      <option value="perdido">Perdido</option>
                    </select>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function SuperAdminPage() {
  const navigate = useNavigate()
  const [restaurants, setRestaurants]   = useState<Restaurant[]>([])
  const [loading, setLoading]           = useState(true)
  const [expanded, setExpanded]         = useState<string | null>(null)
  const [newRestModal, setNewRestModal] = useState(false)
  const [newUserFor, setNewUserFor]     = useState<Restaurant | null>(null)
  const [search, setSearch]             = useState('')
  const [activeTab, setActiveTab]       = useState<'restaurants' | 'leads'>('restaurants')
  const [leads, setLeads]               = useState<Lead[]>([])

  useEffect(() => {
    const u1 = subscribeAllRestaurants((list) => {
      setRestaurants(list.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')))
      setLoading(false)
    })
    const u2 = subscribeLeads(setLeads)
    return () => { u1(); u2() }
  }, [])

  async function handleDeleteRestaurant(r: Restaurant) {
    if (!confirm(`Excluir restaurante "${r.name}"?\n\nATENÇÃO: Os usuários vinculados NÃO serão excluídos automaticamente.`)) return
    await deleteRestaurantById(r.id)
  }

  const filtered = restaurants.filter(r =>
    (r.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    r.id.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Topbar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400 text-sm font-black text-gray-900 shadow-sm">
            👑
          </div>
          <div>
            <p className="font-bold text-gray-800 text-base">Super Admin</p>
            <p className="text-xs text-gray-400">Controle total da plataforma · FoodStore</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/loja"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-100 transition hidden sm:flex items-center gap-1.5"
          >
            🛍️ Central de lojas
          </a>
          <button
            onClick={async () => { await signOut(); navigate('/login') }}
            className="rounded-xl border border-gray-200 px-4 py-2 text-xs text-gray-500 hover:bg-gray-50"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-2xl font-black text-gray-900">{restaurants.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Restaurantes</p>
            </div>
            <div className="rounded-2xl border border-green-100 bg-green-50 p-4 shadow-sm">
              <p className="text-2xl font-black text-green-600">{restaurants.filter(r => r.onlineOrderEnabled).length}</p>
              <p className="text-xs text-green-500 mt-0.5">Lojas ativas na central</p>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm">
              <p className="text-2xl font-black text-yellow-700">Full</p>
              <p className="text-xs text-yellow-500 mt-0.5">Nível de acesso</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 rounded-2xl bg-gray-100 p-1">
            <button
              onClick={() => setActiveTab('restaurants')}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${activeTab === 'restaurants' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🏪 Restaurantes ({restaurants.length})
            </button>
            <button
              onClick={() => setActiveTab('leads')}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${activeTab === 'leads' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🔥 Leads
              {leads.filter(l => l.status === 'novo').length > 0 && (
                <span className="ml-1.5 rounded-full bg-red-500 text-white text-xs px-1.5 py-0.5">
                  {leads.filter(l => l.status === 'novo').length}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'restaurants' ? (
            <>
              {/* Barra de ações restaurantes */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="🔍 Buscar restaurante…"
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none placeholder-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 sm:w-72"
                />
                <button
                  onClick={() => setNewRestModal(true)}
                  className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700 transition"
                >
                  + Novo restaurante
                </button>
              </div>

              {/* Lista restaurantes */}
              {loading ? (
                <div className="flex justify-center py-20">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
                  <span className="text-5xl">🏪</span>
                  <p className="text-sm">
                    {search ? 'Nenhum restaurante encontrado' : 'Nenhum restaurante cadastrado'}
                  </p>
                  {!search && (
                    <button
                      onClick={() => setNewRestModal(true)}
                      className="mt-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
                    >
                      Criar primeiro restaurante
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filtered.map(r => (
                    <RestaurantCard
                      key={r.id}
                      restaurant={r}
                      expanded={expanded === r.id}
                      onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                      onAddUser={() => setNewUserFor(r)}
                      onDeleteRestaurant={() => handleDeleteRestaurant(r)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            /* ── Painel de Leads ── */
            <LeadsPanel leads={leads} />
          )}
        </div>
      </main>

      {newRestModal && (
        <NewRestaurantModal
          onClose={() => setNewRestModal(false)}
          onCreated={(id) => { setNewRestModal(false); setExpanded(id) }}
        />
      )}
      {newUserFor && (
        <NewUserModal
          restaurantId={newUserFor.id}
          restaurantName={newUserFor.name}
          onClose={() => setNewUserFor(null)}
        />
      )}
    </div>
  )
}
