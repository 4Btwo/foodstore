import { useEffect, useRef, useState } from 'react'
import { Layout, PageHeader } from '@/components/Layout'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { NotificationBell } from '@/components/NotificationBell'
import { useOrders } from '@/hooks/useOrders'
import { useAuth } from '@/hooks/useAuth'
import { usePushNotification } from '@/hooks/usePushNotification'
import { updateOrderStatus, subscribeOrderItems } from '@/services/orders'
import type { Order, OrderItem } from '@/types'

function KitchenCard({ order }: { order: Order }) {
  const [items, setItems]       = useState<OrderItem[]>([])
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    const unsub = subscribeOrderItems(order.id, setItems)
    return unsub
  }, [order.id])

  const elapsed = Math.floor((Date.now() - order.createdAt.getTime()) / 60000)
  const isUrgent = elapsed >= 10 && order.status !== 'ready'

  async function advance() {
    setUpdating(true)
    const next = order.status === 'new' ? 'preparing' : 'ready'
    await updateOrderStatus(order.id, next)
    setUpdating(false)
  }

  const borderColor = {
    new:       isUrgent ? 'border-red-400' : 'border-blue-300',
    preparing: 'border-amber-300',
    ready:     'border-green-300',
    closed:    'border-gray-200',
  }[order.status]

  return (
    <div className={`flex flex-col rounded-2xl border-2 bg-white p-4 transition ${borderColor}`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="text-xl font-bold text-gray-800">Mesa {order.tableNumber}</span>
          <span className={`ml-2 text-xs font-medium ${isUrgent ? 'text-red-500' : 'text-gray-400'}`}>
            {elapsed}min {isUrgent ? '⚠️' : ''}
          </span>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <ul className="mb-4 flex-1 space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
              {item.qty}
            </span>
            <span className="text-gray-700">{item.name}</span>
          </li>
        ))}
      </ul>

      {order.status !== 'ready' && order.status !== 'closed' && (
        <button
          onClick={advance}
          disabled={updating}
          className={`w-full rounded-xl py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${
            order.status === 'new' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-500 hover:bg-green-600'
          }`}
        >
          {updating ? '…' : order.status === 'new' ? '🍳 Preparando' : '✅ Pronto'}
        </button>
      )}
      {order.status === 'ready' && (
        <div className="rounded-xl bg-green-50 py-2 text-center text-sm font-medium text-green-700">
          ✅ Aguardando retirada
        </div>
      )}
    </div>
  )
}

export default function KitchenPage() {
  const { orders, loading }   = useOrders(['new', 'preparing', 'ready'])
  const { notify, subscribed } = usePushNotification()
  const prevOrderIds           = useRef<Set<string>>(new Set())

  // Dispara notificação quando chega pedido novo
  useEffect(() => {
    if (loading) return

    const currentIds = new Set(orders.map((o) => o.id))

    orders.forEach((o) => {
      if (o.status === 'new' && !prevOrderIds.current.has(o.id)) {
        if (subscribed) {
          notify(
            '🍔 Novo pedido!',
            `Mesa ${o.tableNumber} — ${o.id.slice(-4).toUpperCase()}`,
          )
        }
      }
    })

    prevOrderIds.current = currentIds
  }, [orders, loading, subscribed, notify])

  const grouped = {
    new:       orders.filter((o) => o.status === 'new'),
    preparing: orders.filter((o) => o.status === 'preparing'),
    ready:     orders.filter((o) => o.status === 'ready'),
  }

  return (
    <Layout>
      <PageHeader
        title="Cozinha"
        subtitle={`${orders.length} pedido${orders.length !== 1 ? 's' : ''} ativo${orders.length !== 1 ? 's' : ''}`}
        action={<NotificationBell />}
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-gray-400">
          <span className="text-5xl">🍽️</span>
          <p className="text-sm">Nenhum pedido ativo no momento</p>
          <NotificationBell />
        </div>
      ) : (
        <div className="flex flex-1 gap-4 overflow-x-auto p-6">
          {(['new', 'preparing', 'ready'] as const).map((status) => (
            <div key={status} className="flex w-72 shrink-0 flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold uppercase tracking-wide text-gray-600">
                  {{ new: 'Novos', preparing: 'Preparando', ready: 'Prontos' }[status]}
                </span>
                <span className="rounded-full bg-gray-100 px-2 text-xs text-gray-500">
                  {grouped[status].length}
                </span>
              </div>
              <div className="space-y-3 overflow-y-auto">
                {grouped[status].map((o) => (
                  <KitchenCard key={o.id} order={o} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
