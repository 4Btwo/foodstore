import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout, PageHeader } from '@/components/Layout'
import { useAuth } from '@/hooks/useAuth'
import {
  subscribeMarmitaOrders,
  subscribeMarmitaOrderItems,
  updateMarmitaOrderStatus,
  createDeliveryRun,
} from '@/services/marmitaria'
import { subscribeUsers } from '@/services/users'
import type { MarmitaOrder, MarmitaOrderItem, MarmitaOrderStatus, AppUser } from '@/types'

const STATUS_LABEL: Record<MarmitaOrderStatus, string> = {
  new:              'Novo',
  preparing:        'Preparando',
  ready:            'Pronto',
  out_for_delivery: 'Em rota',
  delivered:        'Entregue',
  cancelled:        'Cancelado',
}
const STATUS_COLOR: Record<MarmitaOrderStatus, string> = {
  new:              'bg-blue-100 text-blue-700',
  preparing:        'bg-amber-100 text-amber-700',
  ready:            'bg-green-100 text-green-700',
  out_for_delivery: 'bg-purple-100 text-purple-700',
  delivered:        'bg-gray-100 text-gray-500',
  cancelled:        'bg-red-100 text-red-400',
}
const DONE_STATUSES: MarmitaOrderStatus[] = ['delivered', 'cancelled']

// ─── Modal para selecionar entregador ────────────────────────────────────────
function AssignDeliveryModal({
  order,
  deliverers,
  onClose,
}: {
  order:      MarmitaOrder
  deliverers: AppUser[]
  onClose:    () => void
}) {
  const [selectedUid, setSelectedUid] = useState('')
  const [saving, setSaving]           = useState(false)

  async function handleAssign() {
    const deliverer = deliverers.find((d) => d.uid === selectedUid)
    if (!deliverer) return
    setSaving(true)
    try {
      await updateMarmitaOrderStatus(order.id, 'out_for_delivery', {
        deliveryUserId: deliverer.uid,
        deliveryName:   deliverer.name,
      })
      await createDeliveryRun({
        restaurantId:   order.restaurantId,
        deliveryUserId: deliverer.uid,
        deliveryName:   deliverer.name,
        orderId:        order.id,
        customerName:   order.customerName,
        address:        order.address ?? '',
        total:          order.total,
        status:         'assigned',
      })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-base font-bold text-gray-800">Atribuir entregador</h2>
        <p className="mb-4 text-xs text-gray-500">
          {order.customerName} · 📍 {order.address}
        </p>

        {deliverers.length === 0 ? (
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
            Nenhum entregador cadastrado. Adicione um usuário com a função <strong>Entregador</strong> em Usuários.
          </div>
        ) : (
          <div className="space-y-2 mb-5">
            {deliverers.map((d) => (
              <button
                key={d.uid}
                onClick={() => setSelectedUid(d.uid)}
                className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
                  selectedUid === d.uid
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">
                  {d.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-800">{d.name}</span>
                {selectedUid === d.uid && <span className="ml-auto text-brand-500">✓</span>}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedUid || saving || deliverers.length === 0}
            className="flex-1 rounded-xl bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-40"
          >
            {saving ? 'Atribuindo…' : '🛵 Atribuir'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card de pedido ───────────────────────────────────────────────────────────
function OrderCard({
  order,
  deliverers,
}: {
  order:      MarmitaOrder
  deliverers: AppUser[]
}) {
  const [items, setItems]       = useState<MarmitaOrderItem[]>([])
  const [showAssign, setShowAssign] = useState(false)

  useEffect(() => {
    return subscribeMarmitaOrderItems(order.id, setItems)
  }, [order.id])

  async function advance() {
    // Se pronto + entrega → abre modal de atribuição
    if (order.status === 'ready' && order.deliveryType === 'delivery') {
      setShowAssign(true)
      return
    }
    const next: Partial<Record<MarmitaOrderStatus, MarmitaOrderStatus>> = {
      new:              'preparing',
      preparing:        'ready',
      ready:            'delivered',           // retirada
      out_for_delivery: 'delivered',
    }
    const n = next[order.status]
    if (n) await updateMarmitaOrderStatus(order.id, n)
  }

  async function cancel() {
    if (!confirm('Cancelar este pedido?')) return
    await updateMarmitaOrderStatus(order.id, 'cancelled')
  }

  const elapsed = Math.floor((Date.now() - order.createdAt.getTime()) / 60000)
  const isUrgent = elapsed >= 20 && !DONE_STATUSES.includes(order.status)

  const nextLabel: Partial<Record<MarmitaOrderStatus, string>> = {
    new:              '🍳 Iniciar preparo',
    preparing:        '✅ Marcar pronto',
    ready:            order.deliveryType === 'delivery' ? '🛵 Atribuir entregador' : '🏃 Retirado — concluir',
    out_for_delivery: '✅ Confirmar entrega',
  }

  const isDone = DONE_STATUSES.includes(order.status)

  return (
    <>
      <div className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
        isUrgent ? 'border-red-300' : 'border-gray-100'
      }`}>
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-800">{order.customerName}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[order.status]}`}>
                {STATUS_LABEL[order.status]}
              </span>
              {isUrgent && <span className="text-xs text-red-500 font-semibold">⚠ {elapsed}min</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-medium ${order.deliveryType === 'delivery' ? 'text-purple-500' : 'text-teal-500'}`}>
                {order.deliveryType === 'delivery' ? '🛵 Entrega' : '🏃 Retirada'}
              </span>
              <span className="text-xs text-gray-400">· {elapsed}min atrás</span>
            </div>
          </div>
          <span className="shrink-0 font-bold text-brand-600">
            R$ {order.total.toFixed(2)}
          </span>
        </div>

        {/* Endereço */}
        {order.address && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-purple-50 px-3 py-1.5">
            <span className="text-xs text-purple-700">📍 {order.address}</span>
            <button
              onClick={() => navigator.clipboard.writeText(order.address!)}
              className="shrink-0 text-xs text-purple-400 hover:text-purple-600"
            >
              copiar
            </button>
          </div>
        )}

        {/* Entregador atribuído */}
        {order.deliveryName && (
          <p className="mb-2 rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700">
            🛵 {order.deliveryName}
            {order.status === 'out_for_delivery' && (
              <button
                onClick={() => setShowAssign(true)}
                className="ml-2 text-purple-400 hover:text-purple-600 underline"
              >
                trocar
              </button>
            )}
          </p>
        )}

        {/* Itens */}
        <ul className="mb-3 space-y-0.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm text-gray-700">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold">
                {item.qty}
              </span>
              {item.name}
            </li>
          ))}
        </ul>

        {/* Observações e telefone */}
        {order.notes && (
          <p className="mb-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">📝 {order.notes}</p>
        )}
        {order.phone && (
          <p className="mb-3 text-xs text-gray-500">📞 {order.phone}</p>
        )}

        {/* Ações */}
        {!isDone && (
          <div className="flex gap-2">
            <button
              onClick={advance}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition ${
                order.status === 'ready' && order.deliveryType === 'delivery'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-brand-500 hover:bg-brand-600'
              }`}
            >
              {nextLabel[order.status]}
            </button>
            {!['ready', 'out_for_delivery'].includes(order.status) && (
              <button
                onClick={cancel}
                className="rounded-xl border border-red-200 px-3 py-2 text-xs text-red-400 hover:bg-red-50"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {showAssign && (
        <AssignDeliveryModal
          order={order}
          deliverers={deliverers}
          onClose={() => setShowAssign(false)}
        />
      )}
    </>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function MarmitariaListPage() {
  const { restaurantId }        = useAuth()
  const navigate                = useNavigate()
  const [orders, setOrders]     = useState<MarmitaOrder[]>([])
  const [deliverers, setDeliverers] = useState<AppUser[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'active' | 'done'>('active')

  useEffect(() => {
    if (!restaurantId) return
    const u1 = subscribeMarmitaOrders(restaurantId, undefined, (data) => {
      setOrders(data); setLoading(false)
    })
    // Busca entregadores do restaurante
    const u2 = subscribeUsers(restaurantId, (users) => {
      setDeliverers(users.filter((u) => u.role === 'delivery'))
    })
    return () => { u1(); u2() }
  }, [restaurantId])

  const activeOrders = orders.filter((o) => !DONE_STATUSES.includes(o.status))
  const doneOrders   = orders.filter((o) =>  DONE_STATUSES.includes(o.status))
  const displayed    = tab === 'active' ? activeOrders : doneOrders

  // Contadores por status para barra de progresso visual
  const countByStatus = (s: MarmitaOrderStatus) => activeOrders.filter(o => o.status === s).length

  return (
    <Layout>
      <PageHeader
        title="Marmitaria"
        subtitle={`${activeOrders.length} pedido${activeOrders.length !== 1 ? 's' : ''} ativo${activeOrders.length !== 1 ? 's' : ''}`}
        action={
          <button
            onClick={() => navigate('/marmitaria/novo')}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            + Novo Pedido
          </button>
        }
      />

      {/* Mini pipeline de status */}
      {activeOrders.length > 0 && (
        <div className="flex gap-2 border-b border-gray-100 bg-white px-6 py-3 overflow-x-auto">
          {([
            { status: 'new',              label: 'Novos',       color: 'bg-blue-500' },
            { status: 'preparing',        label: 'Preparando',  color: 'bg-amber-500' },
            { status: 'ready',            label: 'Prontos',     color: 'bg-green-500' },
            { status: 'out_for_delivery', label: 'Em rota',     color: 'bg-purple-500' },
          ] as const).map(({ status, label, color }) => {
            const n = countByStatus(status)
            return (
              <div key={status} className="flex items-center gap-1.5 shrink-0">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full ${color} text-xs font-bold text-white`}>
                  {n}
                </span>
                <span className="text-xs text-gray-500">{label}</span>
              </div>
            )
          })}
          {deliverers.length === 0 && (
            <span className="ml-auto shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
              ⚠ Sem entregadores cadastrados
            </span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-6">
        {(['active', 'done'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${
              tab === t ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'active' ? `Ativos (${activeOrders.length})` : `Concluídos (${doneOrders.length})`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center pt-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 pt-20 text-gray-400">
            <span className="text-5xl">🍱</span>
            <p className="text-sm">
              {tab === 'active' ? 'Nenhum pedido ativo no momento' : 'Nenhum pedido concluído ainda'}
            </p>
            {tab === 'active' && (
              <button
                onClick={() => navigate('/marmitaria/novo')}
                className="mt-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Criar pedido
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayed.map((order) => (
              <OrderCard key={order.id} order={order} deliverers={deliverers} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
