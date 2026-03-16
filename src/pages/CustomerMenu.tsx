import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { getProductsByRestaurant } from "@/services/products"
import { callWaiter, createOrder } from "@/services/orders"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/services/firebase"
import type { Product, Restaurant } from "@/types"

type View = "menu" | "cart" | "pix" | "success"
type CartItem = { product: Product; qty: number }

export default function CustomerMenuPage() {
  const { restaurantId, table } = useParams<{ restaurantId: string; table: string }>()
  const tableNumber = parseInt(table ?? "0")

  const [restaurant, setRestaurant]   = useState<Restaurant | null>(null)
  const [products, setProducts]       = useState<Product[]>([])
  const [cart, setCart]               = useState<CartItem[]>([])
  const [view, setView]               = useState<View>("menu")
  const [activeCategory, setActiveCategory] = useState("")
  const [calledWaiter, setCalledWaiter]     = useState(false)
  const [loading, setLoading]               = useState(true)
  const [sending, setSending]               = useState(false)
  const [currentOrderId, setCurrentOrderId] = useState("")
  const [qrCode, setQrCode]                 = useState("")
  const [qrBase64, setQrBase64]             = useState("")
  const [pixTotal, setPixTotal]             = useState(0)
  const [pixPolling, setPixPolling]         = useState(false)

  useEffect(() => {
    if (!restaurantId) return
    Promise.all([
      getDoc(doc(db, "restaurants", restaurantId)),
      getProductsByRestaurant(restaurantId),
    ]).then(([restSnap, prods]) => {
      if (restSnap.exists()) setRestaurant({ id: restSnap.id, ...restSnap.data() } as Restaurant)
      setProducts(prods)
      const firstCat = [...new Set(prods.map((p) => p.category))][0] ?? ""
      setActiveCategory(firstCat)
      setLoading(false)
    })
  }, [restaurantId])

  const categories   = [...new Set(products.map((p) => p.category))]
  const byCategory   = products.reduce<Record<string, Product[]>>((acc, p) => {
    acc[p.category] = [...(acc[p.category] ?? []), p]
    return acc
  }, {})
  const cartTotal    = cart.reduce((s, i) => s + i.product.price * i.qty, 0)
  const cartCount    = cart.reduce((s, i) => s + i.qty, 0)
  const serviceRate  = restaurant?.serviceRate ?? 0.10
  const totalWithFee = cartTotal * (1 + serviceRate)

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

  async function handleCallWaiter() {
    if (!restaurantId || calledWaiter) return
    await callWaiter(restaurantId, tableNumber)
    setCalledWaiter(true)
    setTimeout(() => setCalledWaiter(false), 30000)
  }

  async function handleSendOrder() {
    if (!restaurantId || cart.length === 0) return
    setSending(true)
    try {
      const orderId = await createOrder(
        restaurantId,
        tableNumber,
        cart.map((i) => ({
          productId: i.product.id,
          name:      i.product.name,
          qty:       i.qty,
          price:     i.product.price,
        })),
      )
      setCurrentOrderId(orderId)
      // Gera PIX
      const { httpsCallable } = await import("firebase/functions")
      const { functions }     = await import("@/services/firebase")
      const fn  = httpsCallable(functions, "createPixPayment")
      const res = await fn({ orderId, restaurantId }) as { data: { qrCode: string; qrCodeBase64: string; total: number } }
      setQrCode(res.data.qrCode)
      setQrBase64(res.data.qrCodeBase64)
      setPixTotal(res.data.total)
      setView("pix")
      startPixPolling(orderId)
    } catch {
      alert("Erro ao enviar pedido. Tente novamente.")
    } finally {
      setSending(false)
    }
  }

  function startPixPolling(orderId: string) {
    setPixPolling(true)
    const interval = setInterval(async () => {
      const { httpsCallable } = await import("firebase/functions")
      const { functions }     = await import("@/services/firebase")
      const fn  = httpsCallable(functions, "checkPaymentStatus")
      const res = await fn({ orderId }) as { data: { paymentStatus: string } }
      if (res.data.paymentStatus === "approved") {
        clearInterval(interval)
        setPixPolling(false)
        setView("success")
      }
    }, 5000)
  }

  function copyPix() {
    navigator.clipboard.writeText(qrCode)
  }

  const primaryColor = restaurant?.primaryColor ?? "#f97316"

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: primaryColor, borderTopColor: "transparent" }} />
    </div>
  )

  // ─── Tela de sucesso ───────────────────────────────────────────────────────
  if (view === "success") return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">✅</div>
      <h2 className="text-xl font-bold text-gray-800">Pagamento confirmado!</h2>
      <p className="text-center text-sm text-gray-500">
        Obrigado! Seu pedido foi recebido e será preparado em breve.
      </p>
      <button
        onClick={() => { setCart([]); setView("menu") }}
        className="mt-4 rounded-xl px-6 py-3 text-sm font-semibold text-white"
        style={{ background: primaryColor }}
      >
        Fazer novo pedido
      </button>
    </div>
  )

  // ─── Tela PIX ──────────────────────────────────────────────────────────────
  if (view === "pix") return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="flex items-center gap-3 bg-white px-4 py-4 shadow-sm">
        <button onClick={() => setView("cart")} className="text-gray-400 text-xl">←</button>
        <div>
          <p className="font-semibold text-gray-800">{restaurant?.name}</p>
          <p className="text-xs text-gray-500">Mesa {tableNumber} — Pagar com PIX</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center gap-5 p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 text-center">
            <p className="text-sm text-gray-500">Total a pagar</p>
            <p className="text-3xl font-bold text-gray-800">R$ {pixTotal.toFixed(2)}</p>
            <p className="text-xs text-gray-400">Inclui {(serviceRate * 100).toFixed(0)}% taxa de serviço</p>
          </div>

          {qrBase64 ? (
            <div className="flex justify-center mb-4">
              <img src={`data:image/png;base64,${qrBase64}`} alt="QR PIX" className="h-52 w-52 rounded-xl border border-gray-100" />
            </div>
          ) : (
            <div className="mb-4 flex h-52 items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-400">
              Gerando QR Code…
            </div>
          )}

          <div className="mb-4">
            <p className="mb-1.5 text-xs font-medium text-gray-500">Pix Copia e Cola</p>
            <div className="flex gap-2">
              <input readOnly value={qrCode} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 truncate" />
              <button onClick={copyPix} className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 whitespace-nowrap">Copiar</button>
            </div>
          </div>

          {pixPolling && (
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              Aguardando confirmação…
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ─── Tela carrinho ─────────────────────────────────────────────────────────
  if (view === "cart") return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="flex items-center gap-3 bg-white px-4 py-4 shadow-sm">
        <button onClick={() => setView("menu")} className="text-gray-400 text-xl">←</button>
        <p className="font-semibold text-gray-800">Seu pedido</p>
      </div>

      <div className="flex-1 p-4">
        {cart.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">Carrinho vazio</div>
        ) : (
          <div className="space-y-2">
            {cart.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.product.name}</p>
                  <p className="text-xs text-gray-500">R$ {item.product.price.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => removeFromCart(item.product.id)} className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-600">−</button>
                  <span className="text-sm font-semibold w-4 text-center">{item.qty}</span>
                  <button onClick={() => addToCart(item.product)} className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: primaryColor }}>+</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="border-t border-gray-100 bg-white p-4">
          <div className="mb-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>R$ {cartTotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm text-gray-600"><span>Taxa serviço ({(serviceRate * 100).toFixed(0)}%)</span><span>R$ {(cartTotal * serviceRate).toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold text-gray-800"><span>Total</span><span>R$ {totalWithFee.toFixed(2)}</span></div>
          </div>
          <button
            onClick={handleSendOrder}
            disabled={sending}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: primaryColor }}
          >
            {sending ? "Processando…" : "Confirmar e pagar com PIX"}
          </button>
        </div>
      )}
    </div>
  )

  // ─── Tela cardápio (principal) ────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pb-3 pt-5 shadow-sm">
        <div className="mb-1 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white text-sm font-bold" style={{ background: primaryColor }}>
            {restaurant?.name?.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-gray-800">{restaurant?.name}</p>
            <p className="text-xs text-gray-500">Mesa {tableNumber}</p>
          </div>
        </div>

        {/* Categorias */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                activeCategory === cat ? "text-white" : "bg-gray-100 text-gray-600"
              }`}
              style={activeCategory === cat ? { background: primaryColor } : {}}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Produtos */}
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="space-y-3">
          {(byCategory[activeCategory] ?? []).map((product) => {
            const item = cart.find((i) => i.product.id === product.id)
            return (
              <div key={product.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
                {product.image ? (
                  <img src={product.image} alt={product.name} className="h-16 w-16 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-100 text-2xl">🍽️</div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{product.name}</p>
                  <p className="text-sm font-semibold text-gray-700">R$ {product.price.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {item && (
                    <>
                      <button onClick={() => removeFromCart(product.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600">−</button>
                      <span className="w-4 text-center text-sm font-semibold">{item.qty}</span>
                    </>
                  )}
                  <button
                    onClick={() => addToCart(product)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white"
                    style={{ background: primaryColor }}
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-4 py-3">
        <div className="flex gap-3">
          <button
            onClick={handleCallWaiter}
            disabled={calledWaiter}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-xs font-medium text-gray-600 disabled:opacity-50"
          >
            {calledWaiter ? "✅ Garçom chamado" : "🔔 Chamar garçom"}
          </button>
          {cartCount > 0 && (
            <button
              onClick={() => setView("cart")}
              className="flex-1 rounded-xl py-3 text-xs font-semibold text-white"
              style={{ background: primaryColor }}
            >
              Ver pedido ({cartCount}) · R$ {cartTotal.toFixed(2)}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
