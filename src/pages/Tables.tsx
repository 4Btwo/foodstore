import { useState } from 'react'
import { Layout, PageHeader } from '@/components/Layout'
import { TableCard } from '@/components/TableCard'
import { useTables } from '@/hooks/useTables'
import { useProducts } from '@/hooks/useProducts'
import { useAuth } from '@/hooks/useAuth'
import { createOrder } from '@/services/orders'
import type { Table, Product } from '@/types'

type CartItem = { product: Product; qty: number }

export default function TablesPage() {
  const { tables, loading }         = useTables()
  const { byCategory }              = useProducts()
  const { restaurantId }            = useAuth()
  const [selected, setSelected]     = useState<Table | null>(null)
  const [cart, setCart]             = useState<CartItem[]>([])
  const [sending, setSending]       = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [successMsg, setSuccessMsg] = useState('')

  const categories = Object.keys(byCategory)

  function openTable(table: Table) {
    setSelected(table)
    setCart([])
    setActiveCategory(categories[0] ?? '')
  }

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { product, qty: 1 }]
    })
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev
      .map((i) => i.product.id === productId ? { ...i, qty: i.qty - 1 } : i)
      .filter((i) => i.qty > 0),
    )
  }

  const cartTotal = cart.reduce((sum, i) => sum + i.product.price * i.qty, 0)

  async function handleSend() {
    if (!restaurantId || !selected || cart.length === 0) return
    setSending(true)
    try {
      await createOrder(
        restaurantId,
        selected.number,
        cart.map((i) => ({
          productId: i.product.id,
          name:      i.product.name,
          qty:       i.qty,
          price:     i.product.price,
        })),
      )
      setSuccessMsg(`Pedido enviado para Mesa ${selected.number}!`)
      setSelected(null)
      setCart([])
      setTimeout(() => setSuccessMsg(''), 3000)
    } finally {
      setSending(false)
    }
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
      <PageHeader title="Mesas" subtitle={`${tables.filter(t => t.status === 'open').length} ocupadas · ${tables.filter(t => t.status === 'free').length} livres`} />

      <div className="flex flex-1 overflow-hidden">
        {/* Grid de mesas */}
        <div className="flex-1 overflow-y-auto p-6">
          {successMsg && (
            <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              ✅ {successMsg}
            </div>
          )}
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {tables.map((t) => (
              <TableCard key={t.id} table={t} onClick={openTable} />
            ))}
          </div>
        </div>

        {/* Painel lateral — selecionar itens */}
        {selected && (
          <div className="flex w-96 flex-col border-l border-gray-100 bg-white">
            {/* Header do painel */}
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="font-semibold text-gray-800">Mesa {selected.number}</span>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            {/* Categorias */}
            <div className="flex gap-2 overflow-x-auto border-b border-gray-100 px-4 py-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${
                    activeCategory === cat
                      ? 'bg-brand-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Produtos */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {(byCategory[activeCategory] ?? []).map((product) => {
                  const cartItem = cart.find((i) => i.product.id === product.id)
                  return (
                    <div key={product.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{product.name}</p>
                        <p className="text-xs text-gray-500">R$ {product.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {cartItem ? (
                          <>
                            <button onClick={() => removeFromCart(product.id)} className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-200">−</button>
                            <span className="w-4 text-center text-sm font-semibold">{cartItem.qty}</span>
                          </>
                        ) : null}
                        <button onClick={() => addToCart(product)} className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white hover:bg-brand-600">+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Carrinho / Enviar */}
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
        )}
      </div>
    </Layout>
  )
}
