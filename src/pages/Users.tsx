import { useEffect, useState } from 'react'
import { Layout, PageHeader } from '@/components/Layout'
import { useAuth } from '@/hooks/useAuth'
import { subscribeUsers, createUser, disableUser, enableUser, updateUserRole } from '@/services/users'
import type { AppUser, Role } from '@/types'

const ROLE_LABEL: Record<Role, string> = {
  admin:   'Admin',
  cashier: 'Caixa',
  waiter:  'Garçom',
  kitchen: 'Cozinha',
}
const ROLE_COLOR: Record<Role, string> = {
  admin:   'bg-purple-50 text-purple-700',
  cashier: 'bg-blue-50 text-blue-700',
  waiter:  'bg-amber-50 text-amber-700',
  kitchen: 'bg-green-50 text-green-700',
}

type ExtUser = AppUser & { disabled?: boolean }

function UserModal({ restaurantId, onClose }: { restaurantId: string; onClose: () => void }) {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState<Role>('waiter')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function handleSave() {
    if (!name.trim())          { setError('Nome é obrigatório'); return }
    if (!email.trim())         { setError('E-mail é obrigatório'); return }
    if (password.length < 6)   { setError('Senha mínimo 6 caracteres'); return }
    setSaving(true)
    setError('')
    try {
      await createUser({ name, email, password, role, restaurantId })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar usuário')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Novo usuário</h2>
          <button onClick={onClose} className="text-xl text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Nome completo</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: João Silva" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">E-mail</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="joao@restaurante.com" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Senha</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Função</label>
            <div className="flex gap-2">
              {(['waiter', 'cashier', 'kitchen'] as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition ${
                    role === r
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {r === 'waiter' ? '🧑‍🍳 Garçom' : r === 'cashier' ? '💳 Caixa' : '👨‍🍳 Cozinha'}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              {{ waiter: 'Acessa: Mesas e Pedidos', cashier: 'Acessa: Caixa / PDV', kitchen: 'Acessa: apenas Cozinha + notificações' }[role]}
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Criando…' : 'Criar usuário'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const { restaurantId, user: me } = useAuth()
  const [users, setUsers]          = useState<ExtUser[]>([])
  const [showModal, setModal]      = useState(false)
  const [busy, setBusy]            = useState<string | null>(null)

  useEffect(() => {
    if (!restaurantId) return
    return subscribeUsers(restaurantId, (list) => setUsers(list as ExtUser[]))
  }, [restaurantId])

  async function toggleDisable(u: ExtUser) {
    const action = u.disabled ? 'reativar' : 'desabilitar'
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${u.name}?`)) return
    setBusy(u.uid)
    try {
      if (u.disabled) await enableUser(u.uid)
      else            await disableUser(u.uid)
    } finally {
      setBusy(null)
    }
  }

  async function handleRoleChange(uid: string, role: Role) {
    await updateUserRole(uid, role)
  }

  const sorted = [...users].sort((a, b) => {
    const order: Record<Role, number> = { admin: 0, cashier: 1, waiter: 2, kitchen: 3 }
    return order[a.role] - order[b.role]
  })

  return (
    <Layout>
      <PageHeader
        title="Usuários"
        subtitle={`${users.length} cadastrados · ${users.filter(u => !u.disabled).length} ativos`}
        action={
          <button onClick={() => setModal(true)} className="btn-primary text-sm">
            + Novo usuário
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">

        {/* Tabela */}
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          {users.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-gray-400">
              Nenhum usuário encontrado
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Usuário</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Função</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 hidden sm:table-cell">E-mail</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((u) => (
                  <tr key={u.uid} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{u.name}</p>
                          {u.uid === me?.uid && (
                            <p className="text-xs text-gray-400">você</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.role === 'admin' ? (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLOR[u.role]}`}>
                          {ROLE_LABEL[u.role]}
                        </span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.uid, e.target.value as Role)}
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          <option value="waiter">Garçom</option>
                          <option value="cashier">Caixa</option>
                          <option value="kitchen">Cozinha</option>
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.disabled ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
                      }`}>
                        {u.disabled ? 'Desabilitado' : 'Ativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.uid !== me?.uid && u.role !== 'admin' && (
                        <button
                          onClick={() => toggleDisable(u)}
                          disabled={busy === u.uid}
                          className={`rounded-lg border px-3 py-1 text-xs transition disabled:opacity-50 ${
                            u.disabled
                              ? 'border-green-100 text-green-600 hover:bg-green-50'
                              : 'border-red-100 text-red-500 hover:bg-red-50'
                          }`}
                        >
                          {busy === u.uid ? '…' : u.disabled ? 'Reativar' : 'Desabilitar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Info */}
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <strong>Sem custo extra:</strong> usuários são criados direto pelo Firebase Auth, sem Cloud Functions.
          Ao desabilitar, o acesso é bloqueado imediatamente no app.
        </div>

      </div>

      {showModal && restaurantId && (
        <UserModal restaurantId={restaurantId} onClose={() => setModal(false)} />
      )}
    </Layout>
  )
}
