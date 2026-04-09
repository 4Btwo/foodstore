import { useEffect, useState } from 'react'
import { Layout, PageHeader } from '@/components/Layout'
import { useAuth } from '@/hooks/useAuth'
import { subscribeOnlineOrders, subscribeOnlineOrderItems } from '@/services/onlineOrders'
import { updateDoc, doc } from 'firebase/firestore'
import { db } from '@/services/firebase'
import type { OnlineOrder, OnlineOrderItem, OnlineOrderStatus } from '@/types'

const STATUS_LABEL: Record<OnlineOrderStatus, string> = {
  new:              'Novo',
  preparing:        'Preparando',
  ready:            'Pronto',
  out_for_delivery: 'Saiu p/ entrega',
  delivered:        'Entregue',
  cancelled:        'Cancelado',
}

const STATUS_COLOR: Record<OnlineOrderStatus, string> = {
  new:              'bg-blue-100 text-blue-700',
  preparing:        'bg-amber-100 text-amber-700',
  ready:            'bg-green-100 text-green-700',
  out_for_delivery: 'bg-purple-100 text-purple-700',
  delivered:        'bg-gray-100 text-gray-500',
  cancelled:        'bg-red-100 text-red-500',
}

const NEXT_STATUS: Partial<Record<OnlineOrderStatus, OnlineOrderStatus>> = {
  new:              'preparing',
  preparing:        'ready',
  ready:            'out_for_delivery',
  out_for_delivery: 'delivered',
}

const NEXT_LABEL: Partial<Record<OnlineOrderStatus, string>> = {
  new:              'Iniciar preparo →',
  preparing:        'Marcar pronto →',
  ready:            'Saiu p/ entrega →',
  out_for_delivery: 'Confirmar entrega →',
}

function OrderCard({ order }: { order: OnlineOrder }) {
  const [items, setItems]   = useState<OnlineOrderItem[]>([])
  const [open, setOpen]     = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    return subscribeOnlineOrderItems(order.id, setItems)
  }, [open, order.id])

  async function advance() {
    const next = NEXT_STATUS[order.status]
    if (!next) return
    setLoading(true)
    await updateDoc(doc(db, 'online_orders', order.id), { status: next })
    setLoading(false)
  }

  async function cancel() {
    if (!confirm('Cancelar este pedido?')) return
    await updateDoc(doc(db, 'online_orders', order.id), { status: 'cancelled' })
  }

  const time = order.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const date = order.createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

  return (
    <div className="rounded-2xl bg-white shadow-sm overflow-hidden border border-gray-100">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-lg">
            {order.deliveryType === 'delivery' ? '🛵' : '🏃'}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm truncate">{order.customerName}</p>
            <p className="text-xs text-gray-400">{date} às {time} · {order.deliveryType === 'delivery' ? 'Entrega' : 'Retirada'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_COLOR[order.status]}`}>
            {STATUS_LABEL[order.status]}
          </span>
          <span className="text-xs font-black text-gray-800">R$ {order.total.toFixed(2)}</span>
          <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50">
          {/* Itens */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Itens</p>
            {items.length === 0 ? (
              <p className="text-xs text-gray-400">Carregando…</p>
            ) : (
              <div className="space-y-1">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm text-gray-700">
                    <span>{item.qty}× {item.name}</span>
                    <span className="font-semibold">R$ {(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contato */}
          <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
            {order.phone && (
              <div className="rounded-xl bg-white p-3">
                <p className="font-bold text-gray-400 mb-0.5">Telefone</p>
                <a href={`tel:${order.phone}`} className="font-semibold text-blue-600">{order.phone}</a>
              </div>
            )}
            {order.deliveryType === 'delivery' && order.address && (
              <div className="rounded-xl bg-white p-3 col-span-2">
                <p className="font-bold text-gray-400 mb-0.5">Endereço</p>
                <p className="font-semibold">{order.address}</p>
              </div>
            )}
            {order.notes && (
              <div className="rounded-xl bg-white p-3 col-span-2">
                <p className="font-bold text-gray-400 mb-0.5">Observações</p>
                <p className="italic text-gray-600">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Ações */}
          {order.status !== 'delivered' && order.status !== 'cancelled' && (
            <div className="flex gap-2">
              {NEXT_STATUS[order.status] && (
                <button
                  onClick={advance}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-brand-500 py-2.5 text-xs font-bold text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {loading ? '…' : NEXT_LABEL[order.status]}
                </button>
              )}
              <button
                onClick={cancel}
                className="rounded-xl border border-red-200 px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const FILTERS: { label: string; statuses: OnlineOrderStatus[] | undefined }[] = [
  { label: 'Ativos', statuses: ['new', 'preparing', 'ready', 'out_for_delivery'] },
  { label: 'Todos', statuses: undefined },
  { label: 'Entregues', statuses: ['delivered'] },
  { label: 'Cancelados', statuses: ['cancelled'] },
]

export default function OnlineOrdersDashboard() {
  const { restaurantId }  = useAuth()
  const [orders, setOrders] = useState<OnlineOrder[]>([])
  const [filterIdx, setFilterIdx] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!restaurantId) return
    setLoading(true)
    const unsub = subscribeOnlineOrders(
      restaurantId,
      (data) => { setOrders(data); setLoading(false) },
      FILTERS[filterIdx].statuses,
    )
    return unsub
  }, [restaurantId, filterIdx])

  // Copiar link para área de transferência
  function copyLink() {
    const url = `${window.location.origin}/pedido/${restaurantId}`
    navigator.clipboard.writeText(url)
    alert(`Link copiado!\n${url}`)
  }

  return (
    <Layout>
      <PageHeader
        title="Pedidos Online"
        subtitle="Pedidos recebidos pelo link público"
        action={
          <button
            onClick={copyLink}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600"
          >
            🔗 Copiar link
          </button>
        }
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto border-b border-gray-100 bg-white px-4 py-3">
          {FILTERS.map((f, i) => (
            <button
              key={f.label}
              onClick={() => setFilterIdx(i)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition ${
                filterIdx === i ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center pt-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 pt-20 text-gray-400">
              <span className="text-5xl">📭</span>
              <p className="text-sm">Nenhum pedido encontrado</p>
              <button onClick={copyLink} className="mt-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600">
                🔗 Compartilhar link de pedidos
              </button>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-3">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
