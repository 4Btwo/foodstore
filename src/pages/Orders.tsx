import { useEffect, useState } from 'react'
import { Layout, PageHeader } from '@/components/Layout'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { useOrders } from '@/hooks/useOrders'
import { subscribeOrderItems, updateOrderStatus } from '@/services/orders'
import type { Order, OrderItem } from '@/types'

function OrderRow({ order }: { order: Order }) {
  const [items, setItems]   = useState<OrderItem[]>([])
  const [open, setOpen]     = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const unsub = subscribeOrderItems(order.id, setItems)
    return unsub
  }, [open, order.id])

  async function advance() {
    setLoading(true)
    const next = order.status === 'new' ? 'preparing'
               : order.status === 'preparing' ? 'ready'
               : 'closed'
    await updateOrderStatus(order.id, next, order.restaurantId, order.tableNumber)
    setLoading(false)
  }

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50 transition"
        onClick={() => setOpen(!open)}
      >
        <td className="px-4 py-3 text-sm font-medium text-gray-800">Mesa {order.tableNumber}</td>
        <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
        <td className="px-4 py-3 text-sm text-gray-600">
          {order.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-gray-800">R$ {order.total.toFixed(2)}</td>
        <td className="px-4 py-3 text-right">
          {order.status !== 'closed' && (
            <button
              onClick={(e) => { e.stopPropagation(); advance() }}
              disabled={loading}
              className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              {loading ? '…' : 'Avançar →'}
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr className="bg-gray-50">
          <td colSpan={5} className="px-4 pb-3 pt-0">
            <ul className="space-y-1 pl-2">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium">{i.qty}×</span> {i.name}
                  <span className="ml-auto text-gray-500">R$ {(i.price * i.qty).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  )
}

export default function OrdersPage() {
  const { orders, loading } = useOrders()
  const [filter, setFilter] = useState<string>('all')

  const displayed = filter === 'all' ? orders : orders.filter((o) => o.status === filter)

  return (
    <Layout>
      <PageHeader title="Pedidos" subtitle={`${orders.length} no total`} />

      <div className="flex flex-1 flex-col overflow-hidden p-6">
        {/* Filtros */}
        <div className="mb-4 flex gap-2">
          {['all', 'new', 'preparing', 'ready', 'closed'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === s ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {{ all: 'Todos', new: 'Novos', preparing: 'Preparando', ready: 'Prontos', closed: 'Fechados' }[s]}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto rounded-2xl border border-gray-100 bg-white">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-gray-400">
              Nenhum pedido encontrado
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Mesa</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Hora</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Total</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayed.map((o) => <OrderRow key={o.id} order={o} />)}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  )
}
