/**
 * Central de Pedidos
 *
 * Uma única tela onde a atendente vê e processa TODOS os pedidos:
 *   🍽️  Mesa    — pedidos via QR / garçom
 *   🏪  Balcão  — pedido feito na hora pelo caixa
 *   🍱  Marmita — delivery / retirada
 *   🌐  Online  — link público
 *
 * Fluxo por tipo:
 *   Mesa    → confirmar → pronto → fechar conta (libera mesa)
 *   Balcão  → confirmar → pronto → entregar na hora
 *   Marmita → confirmar → pronto → [atribuir entregador | retirada]
 *   Online  → confirmar → pronto → [atribuir entregador | retirada]
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout, PageHeader } from '@/components/Layout'
import { useAuth } from '@/hooks/useAuth'
import { usePrintAgent } from '@/hooks/usePrintAgent'
import { PrintAgentFAB } from '@/components/PrintAgentPanel'
import {
  subscribeAllOrders,
  confirmOrder,
  advanceOrder,
  cancelOrder,
  createBalcaoOrder,
} from '@/services/unifiedOrders'
import { subscribeUsers } from '@/services/users'
import { subscribeAllProducts } from '@/services/productsAdmin'
import type {
  UnifiedOrder, UnifiedOrderStatus, UnifiedOrderOrigin,
  AppUser, Product, ProductSize,
} from '@/types'

// ─── Configurações visuais por origem ────────────────────────────────────────

const ORIGIN_CFG: Record<UnifiedOrderOrigin, { label: string; icon: string; color: string; bg: string }> = {
  mesa:    { label: 'Mesa',    icon: '🍽️', color: 'text-blue-700',   bg: 'bg-blue-50  border-blue-200'   },
  balcao:  { label: 'Balcão',  icon: '🏪', color: 'text-teal-700',   bg: 'bg-teal-50  border-teal-200'   },
  marmita: { label: 'Marmita', icon: '🍱', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  online:  { label: 'Online',  icon: '🌐', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
}

const STATUS_CFG: Record<UnifiedOrderStatus, { label: string; pill: string }> = {
  pending:          { label: 'Aguardando',  pill: 'bg-yellow-100 text-yellow-700' },
  confirmed:        { label: 'Confirmado',  pill: 'bg-blue-100   text-blue-700'   },
  preparing:        { label: 'Preparando',  pill: 'bg-amber-100  text-amber-700'  },
  ready:            { label: 'Pronto',      pill: 'bg-green-100  text-green-700'  },
  out_for_delivery: { label: 'Em rota',     pill: 'bg-purple-100 text-purple-700' },
  delivered:        { label: 'Entregue',    pill: 'bg-gray-100   text-gray-500'   },
  closed:           { label: 'Fechado',     pill: 'bg-gray-100   text-gray-500'   },
  cancelled:        { label: 'Cancelado',   pill: 'bg-red-100    text-red-500'    },
}

const DONE: UnifiedOrderStatus[] = ['delivered', 'closed', 'cancelled']

// ─── Modal de atribuição de entregador ───────────────────────────────────────

function AssignModal({
  order, deliverers, onClose,
}: {
  order: UnifiedOrder; deliverers: AppUser[]; onClose: () => void
}) {
  const [uid, setUid]       = useState(deliverers[0]?.uid ?? '')
  const [saving, setSaving] = useState(false)

  async function confirm() {
    const d = deliverers.find((x) => x.uid === uid)
    if (!d) return
    setSaving(true)
    await advanceOrder(order, { deliveryUserId: d.uid, deliveryName: d.name })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-1 font-bold text-gray-800">Atribuir entregador</h2>
        <p className="mb-4 text-xs text-gray-500">{order.customerName} · 📍 {order.address}</p>
        {deliverers.length === 0 ? (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
            Nenhum entregador cadastrado. Adicione em <strong>Usuários</strong>.
          </p>
        ) : (
          <div className="space-y-2 mb-5">
            {deliverers.map((d) => (
              <button
                key={d.uid}
                onClick={() => setUid(d.uid)}
                className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
                  uid === d.uid ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">
                  {d.name.charAt(0)}
                </div>
                <span className="text-sm font-medium">{d.name}</span>
                {uid === d.uid && <span className="ml-auto text-brand-500">✓</span>}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button
            onClick={confirm}
            disabled={!uid || saving || deliverers.length === 0}
            className="flex-1 rounded-xl bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-40"
          >
            {saving ? '…' : '🛵 Atribuir'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal novo pedido de balcão ──────────────────────────────────────────────

function NewBalcaoModal({
  restaurantId, products, onClose,
}: {
  restaurantId: string; products: Product[]; onClose: () => void
}) {
  type CartItem = { product: Product; qty: number; size?: string; unitPrice: number }
  const [cart, setCart]           = useState<CartItem[]>([])
  const [search, setSearch]       = useState('')
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone]         = useState('')
  const [notes, setNotes]         = useState('')
  const [sizePicker, setSizePicker] = useState<Product | null>(null)
  const [saving, setSaving]       = useState(false)
  const [step, setStep]           = useState<'items' | 'info'>('items')

  const filtered = products
    .filter((p) => p.active && p.stock !== 0)
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))

  const cartTotal = cart.reduce((s, c) => s + c.unitPrice * c.qty, 0)
  const cartCount = cart.reduce((s, c) => s + c.qty, 0)

  function addToCart(product: Product, size?: string, sizePrice?: number) {
    const unitPrice = sizePrice ?? product.price
    const key       = `${product.id}__${size ?? ''}`
    setCart((prev) => {
      const ex = prev.find((c) => `${c.product.id}__${c.size ?? ''}` === key)
      if (ex) return prev.map((c) => `${c.product.id}__${c.size ?? ''}` === key ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { product, qty: 1, size, unitPrice }]
    })
  }

  function removeFromCart(productId: string, size?: string) {
    const key = `${productId}__${size ?? ''}`
    setCart((prev) =>
      prev.map((c) => `${c.product.id}__${c.size ?? ''}` === key ? { ...c, qty: c.qty - 1 } : c)
          .filter((c) => c.qty > 0)
    )
  }

  async function handleSend() {
    setSaving(true)
    try {
      await createBalcaoOrder(restaurantId, cart, { customerName, phone, notes })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
        <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        <h2 className="font-semibold text-gray-800 flex-1">
          🏪 Novo Pedido — Balcão
        </h2>
        {step === 'info' && (
          <button onClick={() => setStep('items')} className="text-sm text-brand-500">← Itens</button>
        )}
      </div>

      {step === 'items' ? (
        <>
          {/* Busca */}
          <div className="p-4 border-b border-gray-100">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </div>

          {/* Produtos */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {filtered.map((p) => {
              const hasSizes = (p.sizes ?? []).length > 0
              const inCart   = cart.filter((c) => c.product.id === p.id).reduce((s, c) => s + c.qty, 0)
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                    {hasSizes ? (
                      <p className="text-xs text-gray-400">{p.sizes!.map((s) => `${s.label} R$${s.price.toFixed(2)}`).join(' · ')}</p>
                    ) : (
                      <p className="text-xs text-brand-600 font-semibold">R$ {p.price.toFixed(2)}</p>
                    )}
                    {p.stock !== null && p.stock !== undefined && p.stock <= 5 && (
                      <p className="text-xs text-amber-500">⚠ {p.stock} restantes</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!hasSizes && inCart > 0 && (
                      <>
                        <button onClick={() => removeFromCart(p.id)} className="h-7 w-7 rounded-full border border-gray-200 text-gray-600 text-sm">−</button>
                        <span className="text-sm font-bold w-4 text-center">{inCart}</span>
                      </>
                    )}
                    <button
                      onClick={() => hasSizes ? setSizePicker(p) : addToCart(p)}
                      className="h-7 w-7 rounded-full bg-brand-500 text-white text-sm font-bold hover:bg-brand-600"
                    >
                      +
                    </button>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-gray-400 pt-10">Nenhum produto encontrado</p>
            )}
          </div>

          {/* Carrinho fixo */}
          {cartCount > 0 && (
            <div className="border-t border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
                <span className="font-bold text-gray-800">R$ {cartTotal.toFixed(2)}</span>
              </div>
              <button
                onClick={() => setStep('info')}
                className="w-full rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600"
              >
                Continuar →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-lg mx-auto w-full">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Nome (opcional)</label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome do cliente"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Telefone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Observações</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Sem cebola, etc…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400" />
          </div>
          {/* Resumo */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Resumo</p>
            {cart.map((c, i) => (
              <div key={i} className="flex justify-between text-sm text-gray-700 py-0.5">
                <span>{c.qty}× {c.product.name}{c.size ? ` (${c.size})` : ''}</span>
                <span>R$ {(c.unitPrice * c.qty).toFixed(2)}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-800">
              <span>Total</span><span>R$ {cartTotal.toFixed(2)}</span>
            </div>
          </div>
          <button
            onClick={handleSend}
            disabled={saving}
            className="w-full rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? 'Enviando…' : '✅ Confirmar pedido'}
          </button>
        </div>
      )}

      {/* Size picker overlay */}
      {sizePicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8">
            <h3 className="mb-4 font-bold text-gray-800">{sizePicker.name} — Escolha o tamanho</h3>
            <div className="grid grid-cols-3 gap-3">
              {sizePicker.sizes!.map((s) => (
                <button
                  key={s.label}
                  onClick={() => { addToCart(sizePicker, s.label, s.price); setSizePicker(null) }}
                  className="flex flex-col items-center rounded-2xl border-2 border-gray-200 py-4 hover:border-brand-400"
                >
                  <span className="text-xl font-bold text-gray-800">{s.label}</span>
                  <span className="text-sm font-semibold text-brand-600 mt-1">R$ {s.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setSizePicker(null)} className="mt-4 w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Card de pedido ───────────────────────────────────────────────────────────

function OrderCard({
  order, deliverers, onAssign,
}: {
  order:      UnifiedOrder
  deliverers: AppUser[]
  onAssign:   (order: UnifiedOrder) => void
}) {
  const [expanded, setExpanded]   = useState(true)
  const [acting, setActing]       = useState(false)
  const elapsed = Math.floor((Date.now() - order.createdAt.getTime()) / 60000)
  const isUrgent = elapsed >= 20 && !DONE.includes(order.status)
  const cfg = ORIGIN_CFG[order.origin]
  const st  = STATUS_CFG[order.status]

  async function handleAdvance() {
    // Se precisa de entregador, abre modal
    if (
      order.status === 'ready' &&
      order.deliveryType === 'delivery'
    ) {
      onAssign(order)
      return
    }
    setActing(true)
    await advanceOrder(order)
    setActing(false)
  }

  async function handleConfirm() {
    setActing(true)
    await confirmOrder(order)
    setActing(false)
  }

  async function handleCancel() {
    if (!confirm('Cancelar este pedido?')) return
    setActing(true)
    await cancelOrder(order)
    setActing(false)
  }

  const actionLabel = (() => {
    if (order.status === 'pending')          return '✅ Confirmar pedido'
    if (order.status === 'preparing')        return '🍳 Marcar pronto'
    if (order.status === 'ready') {
      if (order.deliveryType === 'delivery') return '🛵 Atribuir entregador'
      if (order.origin === 'mesa')           return '🧾 Fechar conta'
      return '🏃 Entregue / Retirado'
    }
    if (order.status === 'out_for_delivery') return '✅ Confirmar entrega'
    return ''
  })()

  const actionColor = (() => {
    if (order.status === 'pending')  return 'bg-brand-500 hover:bg-brand-600'
    if (order.status === 'ready' && order.deliveryType === 'delivery') return 'bg-purple-600 hover:bg-purple-700'
    if (order.status === 'ready' && order.origin === 'mesa') return 'bg-gray-700 hover:bg-gray-800'
    return 'bg-green-600 hover:bg-green-700'
  })()

  return (
    <div className={`rounded-2xl border-2 bg-white shadow-sm transition ${isUrgent ? 'border-red-300' : 'border-gray-100'}`}>
      {/* Cabeçalho */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 pt-4 pb-3"
      >
        <div className="flex items-start gap-3">
          {/* Badge de origem */}
          <span className={`shrink-0 rounded-xl px-2.5 py-1 text-xs font-bold border ${cfg.bg} ${cfg.color}`}>
            {cfg.icon} {cfg.label}
            {order.tableNumber ? ` ${order.tableNumber}` : ''}
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {order.customerName && (
                <span className="text-sm font-bold text-gray-800 truncate">{order.customerName}</span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.pill}`}>{st.label}</span>
              {isUrgent && <span className="text-xs text-red-500 font-bold">⚠ {elapsed}min</span>}
              {!isUrgent && <span className="text-xs text-gray-400">{elapsed}min</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {order.deliveryType === 'delivery' && (
                <span className="text-xs text-purple-500">🛵 Entrega</span>
              )}
              {order.deliveryType === 'pickup' && order.origin !== 'mesa' && (
                <span className="text-xs text-teal-500">🏃 Retirada</span>
              )}
              <span className="text-sm font-bold text-gray-700">R$ {order.total.toFixed(2)}</span>
            </div>
          </div>

          <span className="text-gray-400 text-sm">{expanded ? '▾' : '▸'}</span>
        </div>
      </button>

      {/* Detalhe expandido */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {/* Endereço */}
          {order.address && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-purple-50 px-3 py-1.5">
              <span className="text-xs text-purple-700 flex-1 truncate">📍 {order.address}</span>
              <button onClick={() => navigator.clipboard.writeText(order.address!)} className="text-xs text-purple-400 hover:text-purple-600 shrink-0">copiar</button>
            </div>
          )}

          {/* Telefone */}
          {order.phone && (
            <p className="text-xs text-gray-500">📞 {order.phone}</p>
          )}

          {/* Entregador */}
          {order.deliveryName && (
            <p className="text-xs text-purple-600 font-medium">🛵 {order.deliveryName}</p>
          )}

          {/* Itens */}
          <ul className="space-y-0.5">
            {order.items.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold">{item.qty}</span>
                {item.name}
                {item.size && <span className="text-xs text-gray-400">({item.size})</span>}
              </li>
            ))}
          </ul>

          {/* Observações */}
          {order.notes && (
            <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">📝 {order.notes}</p>
          )}

          {/* Ações */}
          {!DONE.includes(order.status) && (
            <div className="flex gap-2 pt-1">
              {actionLabel && (
                <button
                  onClick={order.status === 'pending' ? handleConfirm : handleAdvance}
                  disabled={acting}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 ${actionColor}`}
                >
                  {acting ? '…' : actionLabel}
                </button>
              )}
              {!['ready', 'out_for_delivery'].includes(order.status) && (
                <button
                  onClick={handleCancel}
                  disabled={acting}
                  className="rounded-xl border border-red-200 px-3 py-2 text-xs text-red-400 hover:bg-red-50 disabled:opacity-50"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

const ORIGIN_FILTERS: Array<{ key: UnifiedOrderOrigin | 'all'; label: string; icon: string }> = [
  { key: 'all',    label: 'Todos',   icon: '📋' },
  { key: 'mesa',   label: 'Mesa',    icon: '🍽️' },
  { key: 'balcao', label: 'Balcão',  icon: '🏪' },
  { key: 'marmita',label: 'Marmita', icon: '🍱' },
  { key: 'online', label: 'Online',  icon: '🌐' },
]

export default function OrdersCenterPage() {
  const { restaurantId }          = useAuth()
  const agent                     = usePrintAgent(restaurantId ?? '')
  const [orders, setOrders]       = useState<UnifiedOrder[]>([])
  const [deliverers, setDeliverers] = useState<AppUser[]>([])
  const [products, setProducts]   = useState<Product[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<UnifiedOrderOrigin | 'all'>('all')
  const [tab, setTab]             = useState<'active' | 'done'>('active')
  const [assignTarget, setAssignTarget] = useState<UnifiedOrder | null>(null)
  const [showBalcao, setShowBalcao]     = useState(false)

  useEffect(() => {
    if (!restaurantId) return
    const u1 = subscribeAllOrders(restaurantId, (data) => {
      setOrders(data); setLoading(false)
    })
    const u2 = subscribeUsers(restaurantId, (users) => {
      setDeliverers(users.filter((u) => u.role === 'delivery'))
    })
    const u3 = subscribeAllProducts(restaurantId, setProducts)
    return () => { u1(); u2(); u3() }
  }, [restaurantId])

  const activeOrders = orders.filter((o) => !DONE.includes(o.status))
  const doneOrders   = orders.filter((o) =>  DONE.includes(o.status)).slice(0, 50)

  const displayed = (tab === 'active' ? activeOrders : doneOrders)
    .filter((o) => filter === 'all' || o.origin === filter)

  // Contadores para os badges
  const countActive = (key: UnifiedOrderOrigin | 'all') =>
    key === 'all' ? activeOrders.length : activeOrders.filter((o) => o.origin === key).length

  // Pedidos urgentes (pendentes há +10min)
  const urgentCount = activeOrders.filter((o) => {
    const min = (Date.now() - o.createdAt.getTime()) / 60000
    return o.status === 'pending' && min >= 10
  }).length

  return (
    <Layout>
      <PageHeader
        title="Central de Pedidos"
        subtitle={`${activeOrders.length} ativo${activeOrders.length !== 1 ? 's' : ''}${urgentCount > 0 ? ` · ⚠ ${urgentCount} urgente${urgentCount !== 1 ? 's' : ''}` : ''}`}
        action={
          <button
            onClick={() => setShowBalcao(true)}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            🏪 Balcão
          </button>
        }
      />

      {/* Filtros por origem */}
      <div className="flex gap-2 overflow-x-auto border-b border-gray-100 bg-white px-4 py-2.5">
        {ORIGIN_FILTERS.map(({ key, label, icon }) => {
          const n = countActive(key)
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                filter === key
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {icon} {label}
              {n > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                  filter === key ? 'bg-white/30 text-white' : 'bg-brand-100 text-brand-700'
                }`}>
                  {n}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tabs ativos / concluídos */}
      <div className="flex border-b border-gray-100 px-4">
        {(['active', 'done'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'active' ? `Ativos (${activeOrders.length})` : `Concluídos (${doneOrders.length})`}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center pt-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 pt-20 text-gray-400">
            <span className="text-5xl">📋</span>
            <p className="text-sm">
              {tab === 'active' ? 'Nenhum pedido ativo no momento' : 'Nenhum pedido concluído ainda'}
            </p>
            {tab === 'active' && (
              <button
                onClick={() => setShowBalcao(true)}
                className="mt-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
              >
                🏪 Criar pedido balcão
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayed.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                deliverers={deliverers}
                onAssign={setAssignTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modais */}
      {assignTarget && (
        <AssignModal
          order={assignTarget}
          deliverers={deliverers}
          onClose={() => setAssignTarget(null)}
        />
      )}

      {showBalcao && restaurantId && (
        <NewBalcaoModal
          restaurantId={restaurantId}
          products={products}
          onClose={() => setShowBalcao(false)}
        />
      )}

      {/* Agente de impressão automática */}
      <PrintAgentFAB agent={agent} />
    </Layout>
  )
}
