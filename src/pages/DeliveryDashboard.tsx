import { useEffect, useRef, useState } from 'react'
import { Layout, PageHeader } from '@/components/Layout'
import { useAuth } from '@/hooks/useAuth'
import { usePushNotification } from '@/hooks/usePushNotification'
import {
  subscribeDeliveryRuns,
  subscribeMarmitaOrders,
  subscribeMarmitaOrderItems,
  updateMarmitaOrderStatus,
  createDeliveryRun,
  completeDeliveryRun,
} from '@/services/marmitaria'
import { subscribeUsers } from '@/services/users'
import { subscribeOnlineOrders } from '@/services/onlineOrders'
import { getRestaurant } from '@/services/restaurant'
import type { OnlineOrder, Restaurant } from '@/types'
import type { DeliveryRun, MarmitaOrder, MarmitaOrderItem, AppUser } from '@/types'

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function elapsed(date: Date) {
  const min = Math.floor((Date.now() - date.getTime()) / 60000)
  if (min < 60) return `${min}min`
  return `${Math.floor(min / 60)}h${min % 60 > 0 ? `${min % 60}min` : ''}`
}

// ─── Card: pedido pronto aguardando entregador (visão admin) ─────────────────
function PendingCard({
  order,
  deliverers,
}: {
  order:      MarmitaOrder
  deliverers: AppUser[]
}) {
  const [items, setItems]         = useState<MarmitaOrderItem[]>([])
  const [selectedUid, setSelectedUid] = useState(deliverers[0]?.uid ?? '')
  const [assigning, setAssigning] = useState(false)
  const [expanded, setExpanded]   = useState(false)

  useEffect(() => { return subscribeMarmitaOrderItems(order.id, setItems) }, [order.id])

  async function handleAssign() {
    const deliverer = deliverers.find((d) => d.uid === selectedUid)
    if (!deliverer) return
    setAssigning(true)
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
    } finally { setAssigning(false) }
  }

  return (
    <div className="rounded-2xl border-2 border-green-300 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-bold text-gray-800">{order.customerName}</p>
          <p className="text-xs text-gray-400">{elapsed(order.createdAt)} atrás</p>
        </div>
        <span className="font-bold text-brand-600">{fmt(order.total)}</span>
      </div>

      {/* Endereço */}
      <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-purple-50 px-3 py-2">
        <span className="text-xs text-purple-700 flex-1">📍 {order.address}</span>
        <button onClick={() => navigator.clipboard.writeText(order.address!)} className="text-xs text-purple-400 hover:text-purple-600 shrink-0">copiar</button>
      </div>

      {/* Itens colapsáveis */}
      <button onClick={() => setExpanded(!expanded)} className="mb-2 text-xs text-gray-400 hover:text-gray-600">
        {expanded ? '▾' : '▸'} {items.length} item{items.length !== 1 ? 's' : ''}
      </button>
      {expanded && (
        <ul className="mb-3 space-y-0.5 pl-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm text-gray-600">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold">{item.qty}</span>
              {item.name}
            </li>
          ))}
        </ul>
      )}

      {order.phone && <p className="mb-3 text-xs text-gray-500">📞 {order.phone}</p>}
      {order.notes && <p className="mb-3 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700">📝 {order.notes}</p>}

      {/* Seletor de entregador + botão */}
      {deliverers.length === 0 ? (
        <p className="text-xs text-amber-600">⚠ Cadastre um entregador em Usuários</p>
      ) : (
        <div className="flex gap-2">
          <select
            value={selectedUid}
            onChange={(e) => setSelectedUid(e.target.value)}
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300"
          >
            {deliverers.map((d) => (
              <option key={d.uid} value={d.uid}>{d.name}</option>
            ))}
          </select>
          <button
            onClick={handleAssign}
            disabled={assigning || !selectedUid}
            className="shrink-0 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {assigning ? '…' : '🛵 Enviar'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Card: corrida em andamento ───────────────────────────────────────────────
function ActiveRunCard({
  run,
  isAdmin,
  onDelivered,
}: {
  run:         DeliveryRun
  isAdmin:     boolean
  onDelivered: (run: DeliveryRun) => void
}) {
  const timeOnRoad = elapsed(run.createdAt)
  const isLate     = Date.now() - run.createdAt.getTime() > 45 * 60 * 1000 // +45min

  return (
    <div className={`rounded-2xl border-2 bg-white p-4 shadow-sm ${isLate ? 'border-red-300' : 'border-purple-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-600">🛵 Em rota</span>
            {isLate && <span className="text-xs text-red-500 font-semibold">⚠ {timeOnRoad} em rota</span>}
            {!isLate && <span className="text-xs text-gray-400">{timeOnRoad}</span>}
          </div>
          <div className="flex items-center gap-1.5 mb-0.5">
            {run.orderOrigin === 'online' && (
              <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 font-semibold">🌐 Online</span>
            )}
            <p className="font-semibold text-gray-800">{run.customerName}</p>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-purple-600 flex-1 truncate">📍 {run.address}</span>
            <button onClick={() => navigator.clipboard.writeText(run.address)}
              className="shrink-0 text-xs text-purple-400 hover:text-purple-600">copiar</button>
          </div>
          {run.phone && (
            <a href={`tel:${run.phone}`} className="text-xs text-blue-500 hover:underline mt-0.5 block">
              📞 {run.phone}
            </a>
          )}
          {isAdmin && <p className="mt-1 text-xs text-gray-500">🛵 {run.deliveryName}</p>}
          <p className="mt-1 text-sm font-bold text-gray-700">{fmt(run.total)}</p>
        </div>
        <button
          onClick={() => onDelivered(run)}
          className="shrink-0 rounded-xl bg-green-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
        >
          ✅ Entregue
        </button>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function DeliveryDashboardPage() {
  const { restaurantId, user }    = useAuth()
  const [runs, setRuns]             = useState<DeliveryRun[]>([])
  const [pending, setPending]       = useState<MarmitaOrder[]>([])
  const [pendingOnline, setPendingOnline] = useState<OnlineOrder[]>([])
  const [deliverers, setDeliverers] = useState<AppUser[]>([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<'active' | 'history'>('active')
  const [deliveryFee, setDeliveryFee] = useState<number>(0)   // taxa de entrega do restaurante

  const { notify, subscribed } = usePushNotification()
  const prevPendingIds         = useRef<Set<string>>(new Set())
  const isAdmin   = user?.role === 'admin'
  const myUid     = user?.uid ?? null
  const myName    = user?.name ?? 'Entregador'
  const filterUid = isAdmin ? null : myUid

  useEffect(() => {
    if (!restaurantId) return
    // Carrega taxa de entrega do restaurante
    getRestaurant(restaurantId).then((r) => {
      if (r?.deliveryFee) setDeliveryFee(r.deliveryFee)
    })
    const u1 = subscribeDeliveryRuns(restaurantId, filterUid, (data) => {
      setRuns(data); setLoading(false)
    })
    const u2 = subscribeMarmitaOrders(restaurantId, ['ready'], (orders) => {
      setPending(orders.filter((o) => o.deliveryType === 'delivery' && !o.deliveryUserId))
    })
    const u3 = subscribeUsers(restaurantId, (users) => {
      setDeliverers(users.filter((u) => u.role === 'delivery'))
    })
    const u4 = subscribeOnlineOrders(
      restaurantId,
      (orders) => {
        setPendingOnline(orders.filter((o) => o.deliveryType === 'delivery' && o.status === 'ready'))
      },
      ['ready'],
    )
    return () => { u1(); u2(); u3(); u4() }
  }, [restaurantId, filterUid])

  // Notifica quando novos pedidos ficam prontos para entrega
  const pendingIds = pending.map(o => o.id)
  pendingIds.forEach(id => {
    if (!prevPendingIds.current.has(id) && subscribed) {
      notify('🛵 Novo pedido para entrega!', 'Há um pedido pronto aguardando entregador')
    }
  })
  prevPendingIds.current = new Set(pendingIds)

  // Entregador pega o pedido por conta própria (visão entregador)
  async function handleSelfAssign(order: MarmitaOrder) {
    if (!restaurantId || !myUid) return
    await updateMarmitaOrderStatus(order.id, 'out_for_delivery', {
      deliveryUserId: myUid,
      deliveryName:   myName,
    })
    await createDeliveryRun({
      restaurantId,
      deliveryUserId: myUid,
      deliveryName:   myName,
      orderId:        order.id,
      customerName:   order.customerName,
      address:        order.address ?? '',
      total:          order.total,
      status:         'assigned',
    })
  }

  async function handleDelivered(run: DeliveryRun) {
    await completeDeliveryRun(run.id)
    // Atualiza a collection correta com base na origem do pedido
    if (run.orderOrigin === 'online') {
      const { updateOnlineOrderStatus } = await import('@/services/onlineOrders')
      await updateOnlineOrderStatus(run.orderId, 'delivered')
    } else {
      // marmita, balcao, ou sem campo orderOrigin (legado)
      await updateMarmitaOrderStatus(run.orderId, 'delivered')
    }
  }

  const activeRuns  = runs.filter((r) => r.status === 'assigned')
  const historyRuns = runs.filter((r) => r.status === 'delivered')

  const todayRuns = historyRuns.filter((r) => {
    const d = new Date(r.deliveredAt ?? r.createdAt)
    return d.toDateString() === new Date().toDateString()
  })

  const totalToday    = todayRuns.reduce((s, r) => s + r.total, 0)
  const totalAll      = historyRuns.reduce((s, r) => s + r.total, 0)
  // Taxa de entrega: valor fixo por corrida
  const feeToday      = todayRuns.length * deliveryFee
  const feeTotal      = historyRuns.length * deliveryFee
  // Para entregador: ganhos = taxa * corridas
  const myFeeToday    = isAdmin ? 0 : feeToday
  const myFeeTotal    = isAdmin ? 0 : feeTotal

  // Agrupa histórico por data
  const historyByDate: Record<string, DeliveryRun[]> = {}
  historyRuns.forEach((r) => {
    const d = new Date(r.deliveredAt ?? r.createdAt)
    const key = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!historyByDate[key]) historyByDate[key] = []
    historyByDate[key].push(r)
  })

  return (
    <Layout>
      <PageHeader
        title={isAdmin ? 'Gestão de Entregas' : 'Minhas Corridas'}
        subtitle={isAdmin
          ? `${activeRuns.length} em rota · ${pending.length + pendingOnline.length} aguardando`
          : `Olá, ${myName}! ${activeRuns.length} em rota`
        }
      />

      <div className="flex-1 overflow-y-auto">

        {/* ── Métricas ── */}
        {/* ── Métricas gerais ── */}
        <div className="grid grid-cols-2 gap-3 p-4 pb-0 sm:grid-cols-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Em rota</p>
            <p className="mt-1 text-2xl font-bold text-purple-600">{activeRuns.length}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Entregas hoje</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{todayRuns.length}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Faturado hoje</p>
            <p className="mt-1 text-lg font-bold text-gray-800">{fmt(totalToday)}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total histórico</p>
            <p className="mt-1 text-lg font-bold text-gray-800">{fmt(totalAll)}</p>
          </div>
        </div>

        {/* ── Banner do entregador: ganhos por taxa de entrega ── */}
        {!isAdmin && (
          <div className="mx-4 mt-3 space-y-3">
            {/* Card principal — ganhos hoje */}
            <div className="rounded-2xl bg-gradient-to-r from-purple-600 to-purple-800 p-5 text-white">
              <p className="text-xs opacity-75 uppercase tracking-widest">Seus ganhos hoje</p>
              <p className="text-4xl font-black mt-1">{fmt(myFeeToday)}</p>
              <div className="flex gap-4 mt-2 text-xs opacity-80">
                <span>🛵 {todayRuns.length} entrega{todayRuns.length !== 1 ? 's' : ''}</span>
                {deliveryFee > 0 && <span>Taxa: {fmt(deliveryFee)}/corrida</span>}
              </div>
            </div>
            {/* Grid: hoje vs total */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <p className="text-xs text-gray-500">Taxa hoje</p>
                <p className="text-xl font-black text-purple-700 mt-1">{fmt(myFeeToday)}</p>
                <p className="text-xs text-gray-400">{todayRuns.length} corrida{todayRuns.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <p className="text-xs text-gray-500">Total a receber</p>
                <p className="text-xl font-black text-green-700 mt-1">{fmt(myFeeTotal)}</p>
                <p className="text-xs text-gray-400">{historyRuns.length} no total</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Painel admin: faturamento de entregas ── */}
        {isAdmin && (
          <div className="mx-4 mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-gradient-to-r from-green-600 to-green-700 p-4 text-white">
                <p className="text-xs opacity-80">Faturamento entregas hoje</p>
                <p className="text-2xl font-black mt-1">{fmt(totalToday)}</p>
                <p className="text-xs opacity-70">{todayRuns.length} entrega{todayRuns.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-r from-gray-700 to-gray-900 p-4 text-white">
                <p className="text-xs opacity-80">Total histórico</p>
                <p className="text-2xl font-black mt-1">{fmt(totalAll)}</p>
                <p className="text-xs opacity-70">{historyRuns.length} entregas</p>
              </div>
            </div>
            {deliveryFee > 0 && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-amber-700 font-semibold">Taxa de entrega configurada</p>
                    <p className="text-xs text-amber-600 mt-0.5">Pago por corrida ao entregador</p>
                  </div>
                  <p className="text-lg font-black text-amber-800">{fmt(deliveryFee)}</p>
                </div>
                <div className="flex justify-between mt-2 text-xs text-amber-700">
                  <span>A pagar hoje: <strong>{fmt(feeToday)}</strong> ({todayRuns.length} corridas)</span>
                  <span>Total: <strong>{fmt(feeTotal)}</strong></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Pedidos prontos aguardando atribuição ── */}
        {(isAdmin ? (pending.length > 0 || pendingOnline.length > 0) : false) && (
          <div className="p-6 pb-0">
            <p className="mb-3 text-sm font-semibold text-gray-700">
              🟢 Prontos para entrega
              <span className="ml-1.5 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">{pending.length}</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {pendingOnline.map((order) => (
                <div key={order.id} className="rounded-2xl border-2 border-blue-300 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-semibold">🌐 Online</span>
                      <p className="font-bold text-gray-800 mt-1">{order.customerName}</p>
                      <p className="text-xs text-purple-600 mt-0.5">📍 {order.address}</p>
                      {order.phone && <p className="text-xs text-gray-500 mt-0.5">📞 {order.phone}</p>}
                      <p className="mt-1 text-sm font-bold text-gray-700">{fmt(order.total)}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">Aguardando admin</span>
                  </div>
                </div>
              ))}
              {pending.map((order) =>
                isAdmin ? (
                  <PendingCard key={order.id} order={order} deliverers={deliverers} />
                ) : (
                  // Entregador pode pegar por conta própria
                  <div key={order.id} className="rounded-2xl border-2 border-green-300 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-800">{order.customerName}</p>
                        <p className="text-xs text-purple-600 mt-0.5">📍 {order.address}</p>
                        {order.phone && <p className="text-xs text-gray-500 mt-0.5">📞 {order.phone}</p>}
                        <p className="mt-1 text-sm font-bold text-gray-700">{fmt(order.total)}</p>
                      </div>
                      <button
                        onClick={() => handleSelfAssign(order)}
                        className="shrink-0 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                      >
                        🛵 Pegar
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-100 px-6 mt-5">
          {(['active', 'history'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition ${
                tab === t ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'active'
                ? `Em rota (${activeRuns.length})`
                : `Histórico (${historyRuns.length})`
              }
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center pt-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            </div>

          ) : tab === 'active' ? (
            activeRuns.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 pt-10 text-gray-400">
                <span className="text-5xl">🛵</span>
                <p className="text-sm">Nenhuma entrega em andamento</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {activeRuns.map((run) => (
                  <ActiveRunCard key={run.id} run={run} isAdmin={isAdmin} onDelivered={handleDelivered} />
                ))}
              </div>
            )

          ) : (
            /* ── Histórico agrupado por data ── */
            historyRuns.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 pt-10 text-gray-400">
                <span className="text-5xl">📋</span>
                <p className="text-sm">Nenhuma entrega no histórico</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(historyByDate).map(([date, dayRuns]) => {
                  const dayTotal = dayRuns.reduce((s, r) => s + r.total, 0)
                  return (
                    <div key={date}>
                      {/* Cabeçalho do dia */}
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-700 capitalize">{date}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{dayRuns.length} entrega{dayRuns.length !== 1 ? 's' : ''}</span>
                          <span className="text-sm font-bold text-gray-700">{fmt(dayTotal)}</span>
                          {!isAdmin && deliveryFee > 0 && (
                            <span className="text-xs font-semibold text-purple-600">+{fmt(dayRuns.length * deliveryFee)}</span>
                          )}
                        </div>
                      </div>

                      {/* Lista do dia */}
                      <div className="space-y-2">
                        {dayRuns.map((run) => (
                          <div key={run.id} className="rounded-2xl border border-gray-100 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  {run.orderOrigin === 'online' && (
                                    <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5">🌐</span>
                                  )}
                                  <p className="text-sm font-semibold text-gray-800">{run.customerName}</p>
                                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600">✅ Entregue</span>
                                </div>
                                <p className="text-xs text-gray-500 truncate">📍 {run.address}</p>
                                {run.phone && <p className="text-xs text-gray-400">📞 {run.phone}</p>}
                                {isAdmin && (
                                  <p className="text-xs text-gray-400 mt-0.5">🛵 {run.deliveryName}</p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-gray-700">{fmt(run.total)}</p>
                                {!isAdmin && deliveryFee > 0 && (
                                  <p className="text-xs font-semibold text-purple-600">+{fmt(deliveryFee)} taxa</p>
                                )}
                                {run.deliveredAt && (
                                  <p className="text-xs text-gray-400">
                                    {run.deliveredAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                )}
                                <button
                                  onClick={() => navigator.clipboard.writeText(run.address)}
                                  className="mt-0.5 text-xs text-brand-500 hover:underline"
                                >
                                  📋 copiar endereço
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* Resumo total histórico (admin) */}
                {isAdmin && historyRuns.length > 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="mb-3 text-sm font-semibold text-gray-700">Resumo por entregador</p>
                    {deliverers.map((d) => {
                      const dRuns  = historyRuns.filter((r) => r.deliveryUserId === d.uid)
                      const dTotal = dRuns.reduce((s, r) => s + r.total, 0)
                      if (dRuns.length === 0) return null
                      return (
                        <div key={d.uid} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">
                              {d.name.charAt(0)}
                            </div>
                            <span className="text-sm text-gray-700">{d.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-700">{fmt(dTotal)}</p>
                            <p className="text-xs text-gray-400">{dRuns.length} entrega{dRuns.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </Layout>
  )
}
