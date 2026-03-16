import { useState } from 'react'
import { Layout, PageHeader } from '@/components/Layout'
import { TableCard } from '@/components/TableCard'
import { useTables } from '@/hooks/useTables'
import { useProducts } from '@/hooks/useProducts'
import { useAuth } from '@/hooks/useAuth'
import { createOrder } from '@/services/orders'
import type { Table, Product } from '@/types'

type CartItem = { product: Product; qty: number }
type MobileView = 'tables' | 'menu' | 'cart'

// ─── Mobile Order Panel ───────────────────────────────────────────────────────
function MobileOrderPanel({
  table,
  onClose,
  onSuccess,
}: {
  table:     Table
  onClose:   () => void
  onSuccess: () => void
}) {
  const { byCategory }          = useProducts()
  const { restaurantId }        = useAuth()
  const [cart, setCart]         = useState<CartItem[]>([])
  const [view, setView]         = useState<MobileView>('menu')
  const [activeCategory, setActiveCategory] = useState(Object.keys(byCategory)[0] ?? '')
  const [sending, setSending]   = useState(false)

  const categories = Object.keys(byCategory)
  const cartTotal  = cart.reduce((s, i) => s + i.product.price * i.qty, 0)
  const cartCount  = cart.reduce((s, i) => s + i.qty, 0)

  function addToCart(product: Product) {
    setCart((prev) => {
      const ex = prev.find((i) => i.product.id === product.id)
      if (ex) return prev.map((i) => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { product, qty: 1 }]
    })
  }

  function removeFromCart(productId: string) {
    setCart((prev) =>
      prev.map((i) => i.product.id === productId ? { ...i, qty: i.qty - 1 } : i)
         .filter((i) => i.qty > 0),
    )
  }

  async function handleSend() {
    if (!restaurantId || cart.length === 0) return
    setSending(true)
    try {
      await createOrder(
        restaurantId,
        table.number,
        cart.map((i) => ({ productId: i.product.id, name: i.product.name, qty: i.qty, price: i.product.price })),
      )
      onSuccess()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 bg-white">
        <button onClick={onClose} className="text-gray-400 text-xl leading-none">←</button>
        <div className="flex-1">
          <p className="font-semibold text-gray-800">Mesa {table.number}</p>
          <p className="text-xs text-gray-400">
            {cartCount > 0 ? `${cartCount} item${cartCount > 1 ? 's' : ''} · R$ ${cartTotal.toFixed(2)}` : 'Selecione os itens'}
          </p>
        </div>
        {cartCount > 0 && (
          <button
            onClick={() => setView(view === 'cart' ? 'menu' : 'cart')}
            className="relative rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white"
          >
            {view === 'cart' ? 'Cardápio' : `Ver carrinho (${cartCount})`}
          </button>
        )}
      </div>

      {/* Menu View */}
      {view !== 'cart' && (
        <>
          {/* Categorias */}
          <div className="flex gap-2 overflow-x-auto border-b border-gray-100 px-4 py-2 bg-white">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition flex-shrink-0 ${
                  activeCategory === cat ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Produtos */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {(byCategory[activeCategory] ?? []).map((product) => {
              const item = cart.find((i) => i.product.id === product.id)
              return (
                <div key={product.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                  {product.image ? (
                    <img src={product.image} alt="" className="h-14 w-14 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 text-2xl flex-shrink-0">🍽️</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                    <p className="text-sm font-semibold text-brand-600">R$ {product.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item && (
                      <>
                        <button
                          onClick={() => removeFromCart(product.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-700 text-lg font-bold"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-sm font-bold text-gray-800">{item.qty}</span>
                      </>
                    )}
                    <button
                      onClick={() => addToCart(product)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-white text-lg font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Cart View */}
      {view === 'cart' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.map((item) => (
            <div key={item.product.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{item.product.name}</p>
                <p className="text-xs text-gray-500">R$ {item.product.price.toFixed(2)} un</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => removeFromCart(item.product.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-700 font-bold">−</button>
                <span className="w-5 text-center text-sm font-bold">{item.qty}</span>
                <button onClick={() => addToCart(item.product)} className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-white font-bold">+</button>
              </div>
              <span className="text-sm font-semibold text-gray-800 w-16 text-right">
                R$ {(item.product.price * item.qty).toFixed(2)}
              </span>
            </div>
          ))}

          <div className="rounded-2xl bg-gray-50 p-4 space-y-1">
            <div className="flex justify-between text-sm text-gray-600">
              <span>{cartCount} itens</span>
              <span>R$ {cartTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      {cartCount > 0 && (
        <div className="border-t border-gray-100 bg-white p-4 pb-safe">
          <button
            onClick={handleSend}
            disabled={sending}
            className="w-full rounded-2xl bg-brand-500 py-4 text-base font-semibold text-white disabled:opacity-60 active:scale-95 transition"
          >
            {sending ? 'Enviando pedido…' : `Enviar pedido · R$ ${cartTotal.toFixed(2)}`}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Desktop Order Panel (sidebar) ───────────────────────────────────────────
function DesktopOrderPanel({
  table,
  onClose,
  onSuccess,
}: {
  table:     Table
  onClose:   () => void
  onSuccess: () => void
}) {
  const { byCategory }   = useProducts()
  const { restaurantId } = useAuth()
  const [cart, setCart]  = useState<CartItem[]>([])
  const [activeCategory, setActiveCategory] = useState(Object.keys(byCategory)[0] ?? '')
  const [sending, setSending] = useState(false)

  const categories = Object.keys(byCategory)
  const cartTotal  = cart.reduce((s, i) => s + i.product.price * i.qty, 0)

  function addToCart(product: Product) {
    setCart((prev) => {
      const ex = prev.find((i) => i.product.id === product.id)
      if (ex) return prev.map((i) => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { product, qty: 1 }]
    })
  }

  function removeFromCart(productId: string) {
    setCart((prev) =>
      prev.map((i) => i.product.id === productId ? { ...i, qty: i.qty - 1 } : i).filter((i) => i.qty > 0),
    )
  }

  async function handleSend() {
    if (!restaurantId || cart.length === 0) return
    setSending(true)
    try {
      await createOrder(
        restaurantId, table.number,
        cart.map((i) => ({ productId: i.product.id, name: i.product.name, qty: i.qty, price: i.product.price })),
      )
      onSuccess()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex w-96 flex-col border-l border-gray-100 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <span className="font-semibold text-gray-800">Mesa {table.number}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-gray-100 px-4 py-2">
        {categories.map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${
              activeCategory === cat ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {(byCategory[activeCategory] ?? []).map((product) => {
            const item = cart.find((i) => i.product.id === product.id)
            return (
              <div key={product.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-800">{product.name}</p>
                  <p className="text-xs text-gray-500">R$ {product.price.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {item && (
                    <>
                      <button onClick={() => removeFromCart(product.id)} className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-200">−</button>
                      <span className="w-4 text-center text-sm font-semibold">{item.qty}</span>
                    </>
                  )}
                  <button onClick={() => addToCart(product)} className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white hover:bg-brand-600">+</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="border-t border-gray-100 p-4">
        {cart.length > 0 && (
          <div className="mb-3 space-y-1">
            {cart.map((i) => (
              <div key={i.product.id} className="flex justify-between text-sm">
                <span className="text-gray-600">{i.qty}x {i.product.name}</span>
                <span className="text-gray-800">R$ {(i.product.price * i.qty).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-gray-100 pt-1 text-sm font-semibold">
              <span>Total</span>
              <span>R$ {cartTotal.toFixed(2)}</span>
            </div>
          </div>
        )}
        <button
          onClick={handleSend}
          disabled={cart.length === 0 || sending}
          className="btn-primary w-full disabled:opacity-50"
        >
          {sending ? 'Enviando…' : `Enviar pedido${cart.length > 0 ? ` (${cart.length})` : ''}`}
        </button>
      </div>
    </div>
  )
}

// ─── Main Tables Page ─────────────────────────────────────────────────────────
export default function TablesPage() {
  const { tables, loading }         = useTables()
  const [selected, setSelected]     = useState<Table | null>(null)
  const [successMsg, setSuccessMsg] = useState('')
  const [isMobile, setIsMobile]     = useState(window.innerWidth < 768)

  // Detect mobile
  useState(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  })

  function openTable(table: Table) {
    setSelected(table)
  }

  function handleSuccess() {
    const num = selected?.number
    setSelected(null)
    setSuccessMsg(`Pedido enviado para Mesa ${num}!`)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  if (loading) return (
    <Layout>
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    </Layout>
  )

  return (
    <Layout>
      <PageHeader
        title="Mesas"
        subtitle={`${tables.filter(t => t.status === 'open').length} ocupadas · ${tables.filter(t => t.status === 'free').length} livres`}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {successMsg && (
            <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              ✅ {successMsg}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {tables.map((t) => (
              <TableCard key={t.id} table={t} onClick={openTable} />
            ))}
          </div>
        </div>

        {/* Desktop sidebar panel */}
        {selected && !isMobile && (
          <DesktopOrderPanel
            table={selected}
            onClose={() => setSelected(null)}
            onSuccess={handleSuccess}
          />
        )}
      </div>

      {/* Mobile fullscreen panel */}
      {selected && isMobile && (
        <MobileOrderPanel
          table={selected}
          onClose={() => setSelected(null)}
          onSuccess={handleSuccess}
        />
      )}
    </Layout>
  )
}
