import { useEffect, useRef, useState } from 'react'
import { Layout, PageHeader } from '@/components/Layout'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { NotificationBell } from '@/components/NotificationBell'
import { useOrders } from '@/hooks/useOrders'
import { useAuth } from '@/hooks/useAuth'
import { usePushNotification } from '@/hooks/usePushNotification'
import { updateOrderStatus, subscribeOrderItems } from '@/services/orders'
import { subscribeMarmitaOrders, subscribeMarmitaOrderItems, updateMarmitaOrderStatus } from '@/services/marmitaria'
import type { Order, OrderItem, MarmitaOrder, MarmitaOrderItem } from '@/types'

// ─── Impressora Térmica ───────────────────────────────────────────────────────
// Protocolo ESC/POS via Web Serial API ou impressão via window.print()

async function printOrderTicket(data: {
  type: 'mesa' | 'marmita'
  identifier: string   // ex: "Mesa 5" ou "João Silva"
  delivery?: string    // para marmita: "Retirada" | "Entrega — Rua X"
  items: { name: string; qty: number }[]
  notes?: string
  total: number
  createdAt: Date
}) {
  const time = data.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const lines = [
    '================================',
    data.type === 'mesa' ? `       PEDIDO — ${data.identifier}` : '       MARMITARIA',
    data.type === 'marmita' ? `    ${data.identifier}` : '',
    data.delivery ? `    ${data.delivery}` : '',
    `    ${time}`,
    '================================',
    ...data.items.map((i) => `  ${String(i.qty).padStart(2)}x  ${i.name}`),
    '--------------------------------',
    data.notes ? `  OBS: ${data.notes}` : '',
    `  TOTAL: R$ ${data.total.toFixed(2)}`,
    '================================',
    '',
  ].filter((l) => l !== undefined)

  // Tenta Web Serial API (impressora ESC/POS USB/Serial)
  if ('serial' in navigator) {
    try {
      // @ts-ignore
      const port = await navigator.serial.requestPort()
      await port.open({ baudRate: 9600 })
      const writer = port.writable.getWriter()
      const encoder = new TextEncoder()
      // ESC/POS: inicializar + texto + corte
      const ESC = 0x1b
      const GS  = 0x1d
      const init  = new Uint8Array([ESC, 0x40])           // ESC @ — init
      const cut   = new Uint8Array([GS,  0x56, 0x41, 0])  // GS V A — full cut
      await writer.write(init)
      await writer.write(encoder.encode(lines.join('\n')))
      await writer.write(cut)
      writer.releaseLock()
      await port.close()
      return
    } catch {
      // fallback para impressão do browser
    }
  }

  // Fallback: abre janela de impressão estilizada para 80mm
  const win = window.open('', '_blank', 'width=350,height=600')
  if (!win) return
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>Pedido</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          width: 80mm;
          padding: 4mm;
          background: white;
          color: black;
        }
        pre { white-space: pre-wrap; word-break: break-word; }
        @media print {
          body { width: 80mm; }
          @page { margin: 0; size: 80mm auto; }
        }
      </style>
    </head>
    <body>
      <pre>${lines.join('\n')}</pre>
      <script>window.onload = () => { window.print(); window.close(); }<\/script>
    </body>
    </html>
  `)
  win.document.close()
}

// ─── Card pedido mesa ─────────────────────────────────────────────────────────

function KitchenCard({ order, onPrint }: { order: Order; onPrint: (o: Order) => void }) {
  const [items, setItems]       = useState<OrderItem[]>([])
  const [updating, setUpdating] = useState(false)
  const printed                 = useRef(false)

  useEffect(() => {
    const unsub = subscribeOrderItems(order.id, (itms) => {
      setItems(itms)
      // Imprime automaticamente quando o pedido chega (status new) e ainda não imprimiu
      if (order.status === 'new' && !printed.current && itms.length > 0) {
        printed.current = true
        onPrint(order)
      }
    })
    return unsub
  }, [order.id, order.status, onPrint])

  const elapsed  = Math.floor((Date.now() - order.createdAt.getTime()) / 60000)
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
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <button
            onClick={() => onPrint(order)}
            title="Reimprimir"
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
          >
            🖨️
          </button>
        </div>
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

// ─── Card pedido marmitaria ───────────────────────────────────────────────────

function MarmitaKitchenCard({ order, onPrint }: { order: MarmitaOrder; onPrint: (o: MarmitaOrder) => void }) {
  const [items, setItems]       = useState<MarmitaOrderItem[]>([])
  const [updating, setUpdating] = useState(false)
  const printed                 = useRef(false)

  useEffect(() => {
    const unsub = subscribeMarmitaOrderItems(order.id, (itms) => {
      setItems(itms)
      if (order.status === 'new' && !printed.current && itms.length > 0) {
        printed.current = true
        onPrint(order)
      }
    })
    return unsub
  }, [order.id, order.status, onPrint])

  const elapsed = Math.floor((Date.now() - order.createdAt.getTime()) / 60000)

  async function advance() {
    setUpdating(true)
    const next = order.status === 'new' ? 'preparing' : order.status === 'preparing' ? 'ready' : order.deliveryType === 'delivery' ? 'out_for_delivery' : 'delivered'
    await updateMarmitaOrderStatus(order.id, next as any)
    setUpdating(false)
  }

  const nextLabel: Record<string, string> = {
    new:       '🍳 Preparando',
    preparing: '✅ Pronto',
    ready:     order.deliveryType === 'delivery' ? '🛵 Saiu p/ entrega' : '🏃 Retirado',
  }

  const borderColor: Record<string, string> = {
    new:       'border-purple-300',
    preparing: 'border-amber-300',
    ready:     'border-green-300',
  }

  return (
    <div className={`flex flex-col rounded-2xl border-2 bg-white p-4 transition ${borderColor[order.status] ?? 'border-gray-200'}`}>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-600">🍱 Marmita</span>
          <span className={`text-xs ${order.deliveryType === 'delivery' ? 'text-purple-500' : 'text-teal-500'}`}>
            {order.deliveryType === 'delivery' ? '🛵' : '🏃'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{elapsed}min</span>
          <button
            onClick={() => onPrint(order)}
            title="Reimprimir"
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
          >
            🖨️
          </button>
        </div>
      </div>

      <p className="mb-0.5 font-bold text-gray-800">{order.customerName}</p>
      {order.address && (
        <p className="mb-2 text-xs text-purple-600">📍 {order.address}</p>
      )}

      <ul className="mb-3 flex-1 space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-50 text-xs font-bold text-purple-600">
              {item.qty}
            </span>
            <span className="text-gray-700">{item.name}</span>
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className="mb-3 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
          📝 {order.notes}
        </p>
      )}

      {['new', 'preparing', 'ready'].includes(order.status) && (
        <button
          onClick={advance}
          disabled={updating}
          className={`w-full rounded-xl py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${
            order.status === 'new'
              ? 'bg-amber-500 hover:bg-amber-600'
              : order.status === 'preparing'
              ? 'bg-green-500 hover:bg-green-600'
              : 'bg-purple-500 hover:bg-purple-600'
          }`}
        >
          {updating ? '…' : nextLabel[order.status]}
        </button>
      )}
    </div>
  )
}

// ─── Página principal cozinha ─────────────────────────────────────────────────

export default function KitchenPage() {
  const { restaurantId }       = useAuth()
  const { orders, loading }    = useOrders(['new', 'preparing', 'ready'])
  const { notify, subscribed } = usePushNotification()
  const prevOrderIds           = useRef<Set<string>>(new Set())

  const [marmitaOrders, setMarmitaOrders]   = useState<MarmitaOrder[]>([])
  const [marmitaLoading, setMarmitaLoading] = useState(true)
  const [view, setView]                     = useState<'all' | 'mesa' | 'marmita'>('all')

  // Subscribe marmita orders
  useEffect(() => {
    if (!restaurantId) return
    const unsub = subscribeMarmitaOrders(
      restaurantId,
      ['new', 'preparing', 'ready'],
      (data) => {
        setMarmitaOrders(data)
        setMarmitaLoading(false)
      },
    )
    return unsub
  }, [restaurantId])

  // Notificações pedidos mesa
  useEffect(() => {
    if (loading) return
    const currentIds = new Set(orders.map((o) => o.id))
    orders.forEach((o) => {
      if (o.status === 'new' && !prevOrderIds.current.has(o.id)) {
        if (subscribed) notify('🍔 Novo pedido!', `Mesa ${o.tableNumber} — ${o.id.slice(-4).toUpperCase()}`)
      }
    })
    prevOrderIds.current = currentIds
  }, [orders, loading, subscribed, notify])

  // Auto-print helpers
  const handlePrintMesa = async (order: Order) => {
    // items will be passed via the card; here we just call with partial (items loaded in card)
    // We fetch items via the card component; this is a re-print trigger
    const { subscribeOrderItems } = await import('@/services/orders')
    let resolved = false
    const unsub = subscribeOrderItems(order.id, (items) => {
      if (!resolved) {
        resolved = true
        unsub()
        printOrderTicket({
          type:       'mesa',
          identifier: `Mesa ${order.tableNumber}`,
          items:      items.map((i) => ({ name: i.name, qty: i.qty })),
          total:      order.total,
          createdAt:  order.createdAt,
        })
      }
    })
  }

  const handlePrintMarmita = async (order: MarmitaOrder) => {
    let resolved = false
    const unsub = subscribeMarmitaOrderItems(order.id, (items) => {
      if (!resolved) {
        resolved = true
        unsub()
        printOrderTicket({
          type:       'marmita',
          identifier: order.customerName,
          delivery:   order.deliveryType === 'delivery'
            ? `🛵 Entrega — ${order.address}`
            : '🏃 Retirada no local',
          items:     items.map((i) => ({ name: i.name, qty: i.qty })),
          notes:     order.notes,
          total:     order.total,
          createdAt: order.createdAt,
        })
      }
    })
  }

  const grouped = {
    new:       orders.filter((o) => o.status === 'new'),
    preparing: orders.filter((o) => o.status === 'preparing'),
    ready:     orders.filter((o) => o.status === 'ready'),
  }

  const marmitaGrouped = {
    new:       marmitaOrders.filter((o) => o.status === 'new'),
    preparing: marmitaOrders.filter((o) => o.status === 'preparing'),
    ready:     marmitaOrders.filter((o) => o.status === 'ready'),
  }

  const totalActive = orders.length + marmitaOrders.length
  const isLoading   = loading && marmitaLoading

  return (
    <Layout>
      <PageHeader
        title="Cozinha"
        subtitle={`${totalActive} pedido${totalActive !== 1 ? 's' : ''} ativo${totalActive !== 1 ? 's' : ''}`}
        action={<NotificationBell />}
      />

      {/* Filtro mesa/marmita */}
      <div className="flex gap-2 border-b border-gray-100 px-6">
        {(['all', 'mesa', 'marmita'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition ${
              view === v
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {v === 'all' ? `Todos (${totalActive})` : v === 'mesa' ? `Mesas (${orders.length})` : `Marmita (${marmitaOrders.length})`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : totalActive === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-gray-400">
          <span className="text-5xl">🍽️</span>
          <p className="text-sm">Nenhum pedido ativo no momento</p>
          <NotificationBell />
        </div>
      ) : (
        <div className="flex flex-1 gap-4 overflow-x-auto p-6">
          {(['new', 'preparing', 'ready'] as const).map((status) => {
            const mesaCards    = view !== 'marmita' ? grouped[status] : []
            const marmitaCards = view !== 'mesa'   ? marmitaGrouped[status] : []
            const count        = mesaCards.length + marmitaCards.length

            return (
              <div key={status} className="flex w-72 shrink-0 flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold uppercase tracking-wide text-gray-600">
                    {{ new: 'Novos', preparing: 'Preparando', ready: 'Prontos' }[status]}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 text-xs text-gray-500">{count}</span>
                </div>
                <div className="space-y-3 overflow-y-auto">
                  {mesaCards.map((o) => (
                    <KitchenCard key={o.id} order={o} onPrint={handlePrintMesa} />
                  ))}
                  {marmitaCards.map((o) => (
                    <MarmitaKitchenCard key={o.id} order={o} onPrint={handlePrintMarmita} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
