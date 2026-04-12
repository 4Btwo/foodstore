/**
 * Kitchen.tsx — Tela da Cozinha
 *
 * Fluxo:
 *  1. Pedido chega → impressora imprime automaticamente (usePrintAgent)
 *  2. Cozinheiro pega o ticket de papel e prepara
 *  3. Quando termina → abre o app → clica "✅ Pronto"
 *  4. Central de Pedidos é notificada em tempo real
 *
 * Layout: fila única em rolagem, ordem cronológica (mais antigo primeiro = mais urgente)
 * Não há botão de "aceitar" — a cozinha só marca como Pronto.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Layout, PageHeader } from '@/components/Layout'
import { NotificationBell } from '@/components/NotificationBell'
import { useAuth } from '@/hooks/useAuth'
import { usePushNotification } from '@/hooks/usePushNotification'
import { usePrintAgent } from '@/hooks/usePrintAgent'
import { PrintAgentFAB } from '@/components/PrintAgentPanel'
import { updateOrderStatus, subscribeOrderItems } from '@/services/orders'
import { subscribeMarmitaOrders, subscribeMarmitaOrderItems, updateMarmitaOrderStatus } from '@/services/marmitaria'
import { subscribeOnlineOrders, subscribeOnlineOrderItems, updateOnlineOrderStatus } from '@/services/onlineOrders'
import { useOrders } from '@/hooks/useOrders'
import type { Order, OrderItem, MarmitaOrder, MarmitaOrderItem, OnlineOrder, OnlineOrderItem } from '@/types'

// ─── Helpers de tempo ─────────────────────────────────────────────────────────

function useElapsed(date: Date) {
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - date.getTime()) / 60000),
  )
  useEffect(() => {
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - date.getTime()) / 60000)),
      30_000,
    )
    return () => clearInterval(id)
  }, [date])
  return elapsed
}

// ─── Badge de urgência ────────────────────────────────────────────────────────

function UrgencyBadge({ elapsed, status }: { elapsed: number; status: string }) {
  if (status === 'ready') return null
  if (elapsed >= 15) return (
    <span className="animate-pulse rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
      🔴 {elapsed}min — URGENTE
    </span>
  )
  if (elapsed >= 10) return (
    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-600">
      🟠 {elapsed}min
    </span>
  )
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
      {elapsed}min
    </span>
  )
}

// ─── Número do pedido ─────────────────────────────────────────────────────────

function OrderNumber({ id, prefix }: { id: string; prefix?: string }) {
  return (
    <span className="font-mono text-xs font-bold tracking-widest text-gray-400 uppercase">
      #{(prefix ?? '') + id.slice(-4).toUpperCase()}
    </span>
  )
}

// ─── Card pedido mesa ─────────────────────────────────────────────────────────

function KitchenCard({
  order, seqIndex, onReprint,
}: {
  order: Order
  seqIndex: number
  onReprint: (orderId: string, origin: 'mesa'|'marmita', label: string, seqIndex: number, deliveryInfo?: string, notes?: string, createdAt?: Date) => void
}) {
  const [items, setItems]       = useState<OrderItem[]>([])
  const [updating, setUpdating] = useState(false)
  const elapsed                 = useElapsed(order.createdAt)
  const isReady                 = order.status === 'ready'

  useEffect(() => { return subscribeOrderItems(order.id, setItems) }, [order.id])

  async function markReady() {
    setUpdating(true)
    await updateOrderStatus(order.id, 'ready')
    setUpdating(false)
  }

  const borderColor = isReady
    ? 'border-green-300 bg-green-50'
    : elapsed >= 15 ? 'border-red-400 bg-red-50'
    : elapsed >= 10 ? 'border-orange-300 bg-orange-50'
    : 'border-blue-200 bg-white'

  return (
    <div className={`flex rounded-2xl border-2 gap-3 p-4 transition-all ${borderColor}`}>
      <div className="flex flex-col items-center justify-start pt-0.5 shrink-0">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${isReady ? 'bg-green-200 text-green-700' : 'bg-gray-800 text-white'}`}>
          {seqIndex}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="mb-2 flex items-start justify-between gap-2 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-black text-gray-900">Mesa {order.tableNumber}</span>
              <UrgencyBadge elapsed={elapsed} status={order.status} />
            </div>
            <OrderNumber id={order.id} />
          </div>
          <button
            onClick={() => onReprint(
              order.id, 'mesa', `Mesa ${order.tableNumber}`,
              seqIndex, undefined, undefined, order.createdAt
            )}
            className="shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 active:scale-95"
          >
            🖨️ Reimprimir
          </button>
        </div>

        <ul className="mb-3 space-y-1">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-gray-800 text-xs font-bold text-white">
                {item.qty}
              </span>
              <span className="text-gray-800 font-medium">
                {item.name}
                {item.size && <span className="ml-1 text-xs text-gray-400">({item.size})</span>}
              </span>
            </li>
          ))}
        </ul>

        {isReady ? (
          <div className="rounded-xl bg-green-100 py-2 text-center text-sm font-semibold text-green-700">
            ✅ Pronto — aguardando retirada
          </div>
        ) : (
          <button
            onClick={markReady}
            disabled={updating}
            className="w-full rounded-xl bg-green-500 py-2.5 text-sm font-bold text-white transition hover:bg-green-600 active:scale-95 disabled:opacity-50"
          >
            {updating ? '…' : '✅ Marcar como Pronto'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Card marmitaria / balcão / online ───────────────────────────────────────

function MarmitaKitchenCard({
  order, seqIndex, onReprint,
}: {
  order: MarmitaOrder
  seqIndex: number
  onReprint: (orderId: string, origin: 'mesa'|'marmita', label: string, seqIndex: number, deliveryInfo?: string, notes?: string, createdAt?: Date) => void
}) {
  const [items, setItems]       = useState<MarmitaOrderItem[]>([])
  const [updating, setUpdating] = useState(false)
  const elapsed                 = useElapsed(order.createdAt)
  const isReady                 = ['ready', 'out_for_delivery', 'delivered'].includes(order.status)

  useEffect(() => { return subscribeMarmitaOrderItems(order.id, setItems) }, [order.id])

  async function markReady() {
    setUpdating(true)
    await updateMarmitaOrderStatus(order.id, 'ready')
    setUpdating(false)
  }

  const borderColor = isReady
    ? 'border-green-300 bg-green-50'
    : elapsed >= 15 ? 'border-red-400 bg-red-50'
    : elapsed >= 10 ? 'border-orange-300 bg-orange-50'
    : 'border-purple-200 bg-white'

  const typeInfo = order.deliveryType === 'delivery'
    ? { icon: '🛵', label: 'Entrega', cls: 'bg-purple-100 text-purple-700' }
    : { icon: '🏃', label: 'Retirada', cls: 'bg-teal-100 text-teal-700' }

  return (
    <div className={`flex rounded-2xl border-2 gap-3 p-4 transition-all ${borderColor}`}>
      <div className="flex flex-col items-center justify-start pt-0.5 shrink-0">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${isReady ? 'bg-green-200 text-green-700' : 'bg-purple-700 text-white'}`}>
          {seqIndex}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="mb-2 flex items-start justify-between gap-2 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-black text-gray-900">{order.customerName}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${typeInfo.cls}`}>
                {typeInfo.icon} {typeInfo.label}
              </span>
              <UrgencyBadge elapsed={elapsed} status={order.status} />
            </div>
            <div className="flex items-center gap-2">
              <OrderNumber id={order.id} prefix="M" />
              {order.address && (
                <span className="text-xs text-purple-600 truncate max-w-[180px]">📍 {order.address}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              const delivery = order.deliveryType === 'delivery'
                ? `Entrega — ${order.address ?? ''}`
                : 'Retirada'
              onReprint(order.id, 'marmita', order.customerName, seqIndex, delivery, order.notes, order.createdAt)
            }}
            className="shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 active:scale-95"
          >
            🖨️ Reimprimir
          </button>
        </div>

        <ul className="mb-3 space-y-1">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-purple-700 text-xs font-bold text-white">
                {item.qty}
              </span>
              <span className="text-gray-800 font-medium">
                {item.name}
                {item.size && <span className="ml-1 text-xs text-gray-400">({item.size})</span>}
              </span>
            </li>
          ))}
        </ul>

        {order.notes && (
          <p className="mb-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
            📝 {order.notes}
          </p>
        )}

        {isReady ? (
          <div className="rounded-xl bg-green-100 py-2 text-center text-sm font-semibold text-green-700">
            ✅ Pronto — {order.deliveryType === 'delivery' ? 'aguardando entregador' : 'aguardando retirada'}
          </div>
        ) : (
          <button
            onClick={markReady}
            disabled={updating}
            className="w-full rounded-xl bg-green-500 py-2.5 text-sm font-bold text-white transition hover:bg-green-600 active:scale-95 disabled:opacity-50"
          >
            {updating ? '…' : '✅ Marcar como Pronto'}
          </button>
        )}
      </div>
    </div>
  )
}


// ─── Card pedido online ────────────────────────────────────────────────────────

function OnlineKitchenCard({
  order, seqIndex, onReprint,
}: {
  order: OnlineOrder
  seqIndex: number
  onReprint: (orderId: string, origin: 'mesa'|'marmita', label: string, seqIndex: number, deliveryInfo?: string, notes?: string, createdAt?: Date) => void
}) {
  const [items, setItems]       = useState<OnlineOrderItem[]>([])
  const [updating, setUpdating] = useState(false)
  const elapsed                 = useElapsed(order.createdAt)
  const isReady                 = ['ready', 'out_for_delivery', 'delivered'].includes(order.status)

  useEffect(() => { return subscribeOnlineOrderItems(order.id, setItems) }, [order.id])

  async function markReady() {
    setUpdating(true)
    await updateOnlineOrderStatus(order.id, 'ready')
    setUpdating(false)
  }

  const borderColor = isReady
    ? 'border-green-300 bg-green-50'
    : elapsed >= 15 ? 'border-red-400 bg-red-50'
    : elapsed >= 10 ? 'border-orange-300 bg-orange-50'
    : 'border-blue-200 bg-white'

  const typeInfo = order.deliveryType === 'delivery'
    ? { icon: '🛵', label: 'Entrega', cls: 'bg-blue-100 text-blue-700' }
    : { icon: '🏃', label: 'Retirada', cls: 'bg-teal-100 text-teal-700' }

  return (
    <div className={`flex rounded-2xl border-2 gap-3 p-4 transition-all ${borderColor}`}>
      <div className="flex flex-col items-center justify-start pt-0.5 shrink-0">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${isReady ? 'bg-green-200 text-green-700' : 'bg-blue-600 text-white'}`}>
          {seqIndex}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="mb-2 flex items-start justify-between gap-2 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">🌐 Online</span>
              <span className="text-base font-black text-gray-900">{order.customerName}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${typeInfo.cls}`}>
                {typeInfo.icon} {typeInfo.label}
              </span>
              <UrgencyBadge elapsed={elapsed} status={order.status} />
            </div>
            <OrderNumber id={order.id} prefix="W" />
          </div>
          <button
            onClick={() => {
              const delivery = order.deliveryType === 'delivery'
                ? `Entrega — ${order.address ?? ''}`
                : 'Retirada'
              onReprint(order.id, 'online', order.customerName, seqIndex, delivery, order.notes, order.createdAt)
            }}
            className="shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 active:scale-95"
          >
            🖨️ Reimprimir
          </button>
        </div>
        <ul className="mb-3 space-y-1">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {item.qty}
              </span>
              <span className="text-gray-800 font-medium">
                {item.name}
                {item.size && <span className="ml-1 text-xs text-gray-400">({item.size})</span>}
              </span>
            </li>
          ))}
        </ul>
        {order.notes && (
          <p className="mb-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
            📝 {order.notes}
          </p>
        )}
        {isReady ? (
          <div className="rounded-xl bg-green-100 py-2 text-center text-sm font-semibold text-green-700">
            ✅ Pronto — {order.deliveryType === 'delivery' ? 'aguardando entregador' : 'aguardando retirada'}
          </div>
        ) : (
          <button
            onClick={markReady}
            disabled={updating}
            className="w-full rounded-xl bg-green-500 py-2.5 text-sm font-bold text-white transition hover:bg-green-600 active:scale-95 disabled:opacity-50"
          >
            {updating ? '…' : '✅ Marcar como Pronto'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Tipo da fila unificada ───────────────────────────────────────────────────

type QueueItem =
  | { type: 'mesa';    order: Order;        createdAt: Date }
  | { type: 'marmita'; order: MarmitaOrder; createdAt: Date }
  | { type: 'online';  order: OnlineOrder;  createdAt: Date }

// ─── Página principal ─────────────────────────────────────────────────────────

export default function KitchenPage() {
  const { restaurantId }       = useAuth()
  const { orders, loading }    = useOrders(['new', 'preparing', 'ready'])
  const { notify, subscribed } = usePushNotification()
  const prevOrderIds           = useRef<Set<string>>(new Set())
  const agent                  = usePrintAgent(restaurantId ?? '', 'kitchen')

  const [marmitaOrders, setMarmitaOrders]   = useState<MarmitaOrder[]>([])
  const [marmitaLoading, setMarmitaLoading] = useState(true)
  const [onlineOrders, setOnlineOrders]     = useState<OnlineOrder[]>([])
  const [onlineLoading, setOnlineLoading]   = useState(true)
  const [filter, setFilter]                 = useState<'all' | 'pending' | 'ready'>('all')

  useEffect(() => {
    if (!restaurantId) return
    return subscribeMarmitaOrders(
      restaurantId,
      ['new', 'preparing', 'ready'],
      (data) => { setMarmitaOrders(data); setMarmitaLoading(false) },
    )
  }, [restaurantId])

  useEffect(() => {
    if (!restaurantId) return
    return subscribeOnlineOrders(
      restaurantId,
      (data) => { setOnlineOrders(data); setOnlineLoading(false) },
      ['preparing', 'ready'],   // Kitchen só vê online orders APÓS confirmação pela central
    )
  }, [restaurantId])

  // Notificação push de novos pedidos
  useEffect(() => {
    if (loading) return
    orders.forEach((o) => {
      if (!prevOrderIds.current.has(o.id) && subscribed) {
        notify('🍔 Novo pedido!', `Mesa ${o.tableNumber}`)
      }
    })
    prevOrderIds.current = new Set(orders.map((o) => o.id))
  }, [orders, loading, subscribed, notify])

  // Reimprimir — gera ticket de cozinha direto com itens em tempo real
  const handleReprint = useCallback(async (
    orderId: string,
    origin: 'mesa' | 'marmita' | 'online',
    label: string,
    seqIndex: number,
    deliveryInfo?: string,
    notes?: string,
    createdAt?: Date,
  ) => {
    if (!restaurantId) return
    try {
      const [
        { buildKitchenHTML },
        { BrowserPrinter, loadPrinterConfig },
        { getDocs, query, collection, where },
        { db },
      ] = await Promise.all([
        import('@/services/printEngine'),
        import('@/services/printEngine'),
        import('firebase/firestore'),
        import('@/services/firebase'),
      ])

      // Busca itens em tempo real da collection correta
      const collName = origin === 'mesa'
        ? 'order_items'
        : origin === 'online'
        ? 'online_order_items'
        : 'marmita_order_items'
      const fieldName = origin === 'mesa'
        ? 'orderId'
        : origin === 'online'
        ? 'onlineOrderId'
        : 'marmitaOrderId'
      const snap = await getDocs(
        query(collection(db, collName), where(fieldName, '==', orderId))
      )
      const items = snap.docs.map((d) => {
        const x = d.data()
        return { name: x.name as string, qty: x.qty as number, size: x.size as string | undefined }
      })

      const cfg = loadPrinterConfig()
      const html = buildKitchenHTML({
        seqIndex,
        orderId,
        origin,
        label,
        deliveryInfo,
        notes,
        items,
        createdAt:      createdAt ?? new Date(),
        restaurantName: cfg.restaurantName,
      })

      // Imprime via iframe (sem popup)
      const printer = new BrowserPrinter(cfg, () => {})
      await printer.sendHTML(html)
    } catch (e) {
      console.error('Reprint error:', e)
    }
  }, [restaurantId])

  // Fila unificada ordenada do mais antigo para o mais novo
  const allItems: QueueItem[] = [
    ...orders.map((o): QueueItem => ({ type: 'mesa', order: o, createdAt: o.createdAt })),
    ...marmitaOrders.map((o): QueueItem => ({ type: 'marmita', order: o, createdAt: o.createdAt })),
    ...onlineOrders.map((o): QueueItem => ({ type: 'online', order: o, createdAt: o.createdAt })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  const pendingItems = allItems.filter((i) => ['new', 'preparing'].includes(i.order.status))
  const readyItems   = allItems.filter((i) =>
    ['ready', 'out_for_delivery'].includes(i.order.status))

  const displayed = filter === 'pending' ? pendingItems
                  : filter === 'ready'   ? readyItems
                  : allItems

  const isLoading   = loading && marmitaLoading && onlineLoading
  const totalActive = orders.length + marmitaOrders.length + onlineOrders.length

  return (
    <Layout>
      <PageHeader
        title="Cozinha"
        subtitle={`${pendingItems.length} em preparo · ${readyItems.length} pronto${readyItems.length !== 1 ? 's' : ''} · ${onlineOrders.length} online`}
        action={<NotificationBell />}
      />

      {/* Filtros */}
      <div className="flex gap-2 border-b border-gray-100 px-4">
        {([
          { key: 'all',     label: `Todos (${totalActive})` },
          { key: 'pending', label: `Em preparo (${pendingItems.length})` },
          { key: 'ready',   label: `Prontos (${readyItems.length})` },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${
              filter === key
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>

      ) : totalActive === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-gray-400">
          <span className="text-6xl">🍽️</span>
          <p className="text-base font-medium">Nenhum pedido ativo</p>
          <p className="text-sm">Os pedidos aparecerão aqui automaticamente</p>
          <NotificationBell />
        </div>

      ) : displayed.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-gray-400">
          <span className="text-4xl">✅</span>
          <p className="text-sm">Nenhum pedido nessa categoria</p>
        </div>

      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {/* Legenda */}
          <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
            <span className="font-semibold uppercase tracking-wide">Fila por ordem de chegada</span>
            <div className="flex-1 h-px bg-gray-100" />
            <span>{displayed.length} pedido{displayed.length !== 1 ? 's' : ''}</span>
          </div>

          {displayed.map((item, idx) =>
            item.type === 'mesa' ? (
              <KitchenCard
                key={item.order.id}
                order={item.order as Order}
                seqIndex={idx + 1}
                onReprint={handleReprint}
              />
            ) : item.type === 'online' ? (
              <OnlineKitchenCard
                key={item.order.id}
                order={item.order as OnlineOrder}
                seqIndex={idx + 1}
                onReprint={handleReprint}
              />
            ) : (
              <MarmitaKitchenCard
                key={item.order.id}
                order={item.order as MarmitaOrder}
                seqIndex={idx + 1}
                onReprint={handleReprint}
              />
            )
          )}

          {/* Espaço para o FAB não cobrir o último card */}
          <div className="h-24" />
        </div>
      )}

      <PrintAgentFAB agent={agent} />
    </Layout>
  )
}
