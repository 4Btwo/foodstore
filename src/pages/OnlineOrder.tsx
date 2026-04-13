import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { getProductsByRestaurant } from '@/services/products'
import { createOnlineOrder } from '@/services/onlineOrders'
import { createOnlinePixPayment, checkOnlinePaymentStatus } from '@/services/payments'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/services/firebase'
import type { Product, ProductSize, Restaurant } from '@/types'

type Step = 'menu' | 'cart' | 'info' | 'pix' | 'success'
type CartItem = { product: Product; qty: number; size?: string; unitPrice: number }
type DeliveryType = 'pickup' | 'delivery'
type PaymentMethod = 'cash' | 'credit' | 'debit' | 'pix'

// ─── Modal de tamanhos ─────────────────────────────────────────────────────────
function SizeModal({
  product, color, onSelect, onClose,
}: {
  product: Product; color: string
  onSelect: (s: ProductSize) => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
        {product.image && (
          <img src={product.image} alt={product.name} className="mb-4 h-36 w-full rounded-2xl object-cover" />
        )}
        <h3 className="mb-1 text-lg font-bold text-gray-900">{product.name}</h3>
        <p className="mb-5 text-sm text-gray-500">Selecione o tamanho desejado</p>
        <div className="space-y-3">
          {product.sizes!.map((s) => (
            <button
              key={s.label}
              onClick={() => onSelect(s)}
              className="flex w-full items-center justify-between rounded-2xl border-2 border-gray-100 px-5 py-4 transition hover:border-gray-300 active:scale-[.98]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-white" style={{ background: color }}>
                  {s.label}
                </div>
                <span className="font-semibold text-gray-800">Tamanho {s.label}</span>
              </div>
              <span className="text-base font-bold" style={{ color }}>R$ {s.price.toFixed(2)}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full rounded-2xl border border-gray-200 py-3 text-sm text-gray-500 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Card de produto ───────────────────────────────────────────────────────────
function ProductCard({
  product, color, cartQty, onAdd, onRemove, onAddWithSizes,
  btnRadius, cardCls, fontCls, showDesc,
}: {
  product: Product; color: string; cartQty: number
  onAdd: () => void; onRemove: () => void; onAddWithSizes: () => void
  btnRadius: string; cardCls: string; fontCls: string; showDesc: boolean
}) {
  const isOut = product.stock !== null && product.stock !== undefined && product.stock <= 0
  const hasSizes = (product.sizes ?? []).length > 0

  return (
    <div className={`overflow-hidden rounded-2xl bg-white ${cardCls} transition ${isOut ? 'opacity-50' : ''}`}>
      {product.image ? (
        <div className="relative h-40 w-full overflow-hidden">
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
          {isOut && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-800">Esgotado</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-28 items-center justify-center bg-gray-100 text-4xl">🍽️</div>
      )}

      <div className="p-4">
        <p className={`font-bold text-gray-900 ${fontCls}`}>{product.name}</p>
        {showDesc && product.description && (
          <p className="mt-0.5 text-xs text-gray-400 leading-relaxed">{product.description}</p>
        )}
        {hasSizes ? (
          <p className="mt-0.5 text-xs text-gray-400">
            {product.sizes!.map((s) => `${s.label} R$${s.price.toFixed(2)}`).join(' · ')}
          </p>
        ) : (
          <p className="mt-0.5 text-base font-bold" style={{ color }}>
            R$ {product.price.toFixed(2)}
          </p>
        )}

        {!isOut && (
          <div className="mt-3 flex items-center justify-between">
            {!hasSizes && cartQty > 0 ? (
              <div className="flex items-center gap-3">
                <button onClick={onRemove} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-600">−</button>
                <span className="w-5 text-center text-sm font-bold">{cartQty}</span>
                <button onClick={onAdd} className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: color }}>+</button>
              </div>
            ) : (
              <button
                onClick={hasSizes ? onAddWithSizes : onAdd}
                className={`flex items-center gap-2 ${btnRadius} px-4 py-2 text-sm font-bold text-white transition active:scale-95`}
                style={{ background: color }}
              >
                <span>+</span> Adicionar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function OnlineOrderPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>()

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [products, setProducts]     = useState<Product[]>([])
  const [cart, setCart]             = useState<CartItem[]>([])
  const [step, setStep]             = useState<Step>('menu')
  const [activeCategory, setActiveCategory] = useState('')
  const [loading, setLoading]       = useState(true)
  const [sending, setSending]       = useState(false)
  const [sizePicker, setSizePicker] = useState<Product | null>(null)

  // Dados do cliente
  const [customerName, setCustomerName]   = useState('')
  const [phone, setPhone]                 = useState('')
  const [deliveryType, setDeliveryType]   = useState<DeliveryType>('delivery')
  const [address, setAddress]             = useState('')
  const [notes, setNotes]                 = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [changeFor, setChangeFor]         = useState('')       // troco para quanto
  // PIX state
  const [pixState, setPixState]   = useState<'idle'|'loading'|'waiting'|'approved'|'error'>('idle')
  const [pixQrCode, setPixQrCode] = useState('')
  const [pixBase64, setPixBase64] = useState('')
  const [pixError, setPixError]   = useState('')
  const [orderId, setOrderId]     = useState('')
  const pixPolling = useRef<ReturnType<typeof setInterval> | null>(null)

  const color       = restaurant?.primaryColor ?? '#f97316'
  const r           = restaurant as (Restaurant & Record<string, unknown>) | null
  const bannerImage = (r?.bannerImage as string) ?? ''
  const bannerColor = (r?.bannerColor as string) || color
  const btnRadius   = r?.buttonStyle === 'pill' ? 'rounded-full' : r?.buttonStyle === 'square' ? 'rounded-none' : 'rounded-xl'
  const fontCls     = r?.fontStyle === 'classic' ? 'font-serif' : r?.fontStyle === 'bold' ? 'font-black' : ''
  const cardCls     = r?.cardStyle === 'border' ? 'border border-gray-200' : r?.cardStyle === 'flat' ? 'bg-gray-50' : 'shadow-sm'
  const showDesc    = r?.showDescription !== false

  useEffect(() => {
    if (!restaurantId) return
    Promise.all([
      getDoc(doc(db, 'restaurants', restaurantId)),
      getProductsByRestaurant(restaurantId),
    ]).then(([snap, prods]) => {
      if (snap.exists()) setRestaurant({ id: snap.id, ...snap.data() } as Restaurant)
      const active = prods.filter((p) => p.active !== false)
      setProducts(active)
      const firstCat = [...new Set(active.map((p) => p.category))][0] ?? ''
      setActiveCategory(firstCat)
      setLoading(false)
    })
  }, [restaurantId])

  const categories = [...new Set(products.map((p) => p.category))]
  const byCategory = products.reduce<Record<string, Product[]>>((acc, p) => {
    acc[p.category] = [...(acc[p.category] ?? []), p]; return acc
  }, {})

  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const cartTotal = cart.reduce((s, i) => s + i.unitPrice * i.qty, 0)

  function cartQtyForProduct(productId: string) {
    return cart.filter((i) => i.product.id === productId).reduce((s, i) => s + i.qty, 0)
  }

  function addToCart(product: Product, size?: string, sizePrice?: number) {
    const unitPrice = sizePrice ?? product.price
    const key = `${product.id}__${size ?? ''}`
    setCart((prev) => {
      const ex = prev.find((i) => `${i.product.id}__${i.size ?? ''}` === key)
      if (ex) return prev.map((i) => `${i.product.id}__${i.size ?? ''}` === key ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { product, qty: 1, size, unitPrice }]
    })
  }

  function removeFromCart(productId: string, size?: string) {
    const key = `${productId}__${size ?? ''}`
    setCart((prev) =>
      prev.map((i) => `${i.product.id}__${i.size ?? ''}` === key ? { ...i, qty: i.qty - 1 } : i)
          .filter((i) => i.qty > 0),
    )
  }

  function stopPixPolling() {
    if (pixPolling.current) { clearInterval(pixPolling.current); pixPolling.current = null }
  }

  async function handleFinalize() {
    if (!restaurantId || !customerName.trim()) return
    if (deliveryType === 'delivery' && !address.trim()) return
    if (!paymentMethod) return
    setSending(true)
    try {
      const id = await createOnlineOrder(
        restaurantId,
        {
          customerName: customerName.trim(),
          ...(phone.trim()   ? { phone: phone.trim() } : {}),
          ...(notes.trim()   ? { notes: notes.trim() } : {}),
          ...(deliveryType === 'delivery' && address.trim() ? { address: address.trim() } : {}),
          deliveryType,
          total: cartTotal,
          paymentMethod,
          ...(paymentMethod === 'cash' && changeFor.trim() ? { changeFor: changeFor.trim() } : {}),
        },
        cart.map((i) => ({
          productId: i.product.id,
          name:      i.size ? `${i.product.name} (${i.size})` : i.product.name,
          qty:       i.qty,
          price:     i.unitPrice,
          ...(i.size ? { size: i.size } : {}),
        })),
      )
      setOrderId(id)
      if (paymentMethod === 'pix') {
        // Gera QR code PIX
        setPixState('loading')
        const pix = await createOnlinePixPayment({ orderId: id, restaurantId })
        setPixQrCode(pix.qrCode)
        setPixBase64(pix.qrCodeBase64)
        setPixState('waiting')
        pixPolling.current = setInterval(async () => {
          const s = await checkOnlinePaymentStatus(id)
          if (s.paymentStatus === 'approved') {
            stopPixPolling(); setPixState('approved')
            setTimeout(() => setStep('success'), 1500)
          } else if (s.paymentStatus === 'rejected' || s.paymentStatus === 'cancelled') {
            stopPixPolling(); setPixState('error'); setPixError('Pagamento não aprovado.')
          }
        }, 5000)
        setStep('pix' as Step)
      } else {
        setStep('success')
      }
    } catch (err) {
      console.error('[OnlineOrder] Erro ao finalizar pedido:', err)
      const msg = err instanceof Error ? err.message : String(err)
      alert(`Erro ao enviar pedido:\n${msg}`)
    } finally {
      setSending(false)
    }
  }

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: color, borderTopColor: 'transparent' }} />
        <p className="text-sm text-gray-400">Carregando cardápio…</p>
      </div>
    </div>
  )

  // ─── Sucesso ────────────────────────────────────────────────────────────────
  if (step === 'success') return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100 text-5xl">✅</div>
      <div>
        <h2 className="text-2xl font-black text-gray-900">Pedido enviado!</h2>
        <p className="mt-2 text-sm text-gray-500">
          Recebemos seu pedido, <strong>{customerName}</strong>!<br />
          Em breve entraremos em contato.
        </p>
      </div>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-sm text-left">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Resumo do pedido</p>
        {cart.map((item, i) => (
          <div key={i} className="flex justify-between py-1 text-sm text-gray-700">
            <span>{item.qty}× {item.product.name}{item.size ? ` (${item.size})` : ''}</span>
            <span className="font-semibold">R$ {(item.unitPrice * item.qty).toFixed(2)}</span>
          </div>
        ))}
        <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 font-black text-gray-900">
          <span>Total</span>
          <span style={{ color }}>R$ {cartTotal.toFixed(2)}</span>
        </div>
        {deliveryType === 'delivery' && address && (
          <p className="mt-3 text-xs text-gray-400">📍 {address}</p>
        )}
        {paymentMethod && (
          <p className="mt-2 text-xs text-gray-400">
            💳 Pagamento: {{
              pix: 'PIX ✅', cash: 'Dinheiro', credit: 'Cartão de crédito', debit: 'Cartão de débito',
            }[paymentMethod]}
          </p>
        )}
        {paymentMethod === 'cash' && changeFor && (
          <p className="mt-1 text-xs text-gray-400">💵 Troco para R$ {parseFloat(changeFor).toFixed(2)}</p>
        )}
        {(paymentMethod === 'credit' || paymentMethod === 'debit') && (
          <p className="mt-1 text-xs text-gray-400">🛵 Maquininha levada pelo entregador</p>
        )}
      </div>
      <button
        onClick={() => {
          stopPixPolling()
          setCart([]); setCustomerName(''); setPhone(''); setAddress(''); setNotes('')
          setPaymentMethod(null); setChangeFor(''); setOrderId('')
          setPixState('idle'); setPixQrCode(''); setPixBase64(''); setPixError('')
          setStep('menu')
        }}
        className="rounded-2xl px-8 py-3 text-sm font-bold text-white"
        style={{ background: color }}
      >
        Fazer novo pedido
      </button>
    </div>
  )

  // ─── PIX ─────────────────────────────────────────────────────────────────────
  if (step === 'pix') return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="sticky top-0 z-10 bg-white px-4 py-4 shadow-sm flex items-center gap-3">
        <button
          onClick={() => { stopPixPolling(); setStep('info') }}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-600"
        >←</button>
        <div>
          <p className="font-bold text-gray-900">Pagamento PIX</p>
          <p className="text-xs text-gray-500">Escaneie o QR Code para pagar</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        {pixState === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: color, borderTopColor: 'transparent' }} />
            <p className="text-sm text-gray-500">Gerando QR Code…</p>
          </div>
        )}

        {pixState === 'waiting' && (
          <div className="w-full max-w-sm space-y-5">
            {/* QR Code */}
            <div className="flex flex-col items-center rounded-2xl bg-white p-6 shadow-sm gap-4">
              <div className="rounded-2xl border-2 border-gray-100 p-3">
                {pixBase64 ? (
                  <img src={`data:image/png;base64,${pixBase64}`} alt="QR Code PIX" className="h-52 w-52" />
                ) : (
                  <div className="flex h-52 w-52 items-center justify-center bg-gray-50 rounded-xl text-xs text-gray-400">QR Code</div>
                )}
              </div>

              {/* Total */}
              <div className="w-full rounded-xl bg-green-50 py-3 text-center">
                <p className="text-xs text-green-600 mb-0.5">Total a pagar</p>
                <p className="text-2xl font-black text-green-700">R$ {cartTotal.toFixed(2)}</p>
              </div>

              {/* Pix copia e cola */}
              {pixQrCode && (
                <div className="w-full space-y-1.5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Pix Copia e Cola</p>
                  <div className="flex gap-2">
                    <input readOnly value={pixQrCode} className="flex-1 rounded-xl border-2 border-gray-100 px-3 py-2.5 text-xs text-gray-600 truncate outline-none" />
                    <button
                      onClick={() => navigator.clipboard.writeText(pixQrCode)}
                      className="rounded-xl px-4 py-2.5 text-xs font-bold text-white"
                      style={{ background: color }}
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                Aguardando confirmação do pagamento…
              </div>
            </div>
          </div>
        )}

        {pixState === 'approved' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">✅</div>
            <p className="text-xl font-black text-green-700">Pagamento confirmado!</p>
            <p className="text-sm text-gray-500">Seu pedido foi recebido. Em breve entraremos em contato.</p>
          </div>
        )}

        {pixState === 'error' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-4xl">❌</div>
            <p className="text-base font-bold text-red-700">Pagamento não confirmado</p>
            <p className="text-sm text-gray-500">{pixError || 'Tente gerar um novo QR Code.'}</p>
            <button
              onClick={async () => {
                setPixState('loading')
                try {
                  const pix = await createOnlinePixPayment({ orderId, restaurantId: restaurantId! })
                  setPixQrCode(pix.qrCode); setPixBase64(pix.qrCodeBase64); setPixState('waiting')
                } catch { setPixState('error'); setPixError('Não foi possível gerar o PIX.') }
              }}
              className="rounded-2xl px-6 py-3 text-sm font-bold text-white"
              style={{ background: color }}
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // ─── Dados do cliente ────────────────────────────────────────────────────────
  if (step === 'info') return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white px-4 py-4 shadow-sm flex items-center gap-3">
        <button onClick={() => setStep('cart')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-600">←</button>
        <div>
          <p className="font-bold text-gray-900">Seus dados</p>
          <p className="text-xs text-gray-500">Para finalizar o pedido</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="mx-auto max-w-md space-y-4">

          {/* Tipo de entrega */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="mb-3 text-sm font-bold text-gray-700">Como deseja receber?</p>
            <div className="grid grid-cols-2 gap-3">
              {(['delivery', 'pickup'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setDeliveryType(type)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border-2 py-5 text-sm font-bold transition ${
                    deliveryType === type ? 'border-current' : 'border-gray-100 text-gray-400 hover:bg-gray-50'
                  }`}
                  style={deliveryType === type ? { borderColor: color, color, background: `${color}10` } : {}}
                >
                  <span className="text-3xl">{type === 'delivery' ? '🛵' : '🏃'}</span>
                  {type === 'delivery' ? 'Entrega' : 'Retirada'}
                </button>
              ))}
            </div>
          </div>

          {/* Formulário */}
          <div className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Nome completo *</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Como você se chama?"
                className="w-full rounded-xl border-2 border-gray-100 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-gray-300"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">WhatsApp</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                type="tel"
                className="w-full rounded-xl border-2 border-gray-100 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-gray-300"
              />
            </div>
            {deliveryType === 'delivery' && (
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Endereço de entrega *</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, número, bairro, complemento…"
                  rows={3}
                  className="w-full rounded-xl border-2 border-gray-100 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-gray-300 resize-none"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Observações</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Sem cebola, bem passado, etc…"
                rows={2}
                className="w-full rounded-xl border-2 border-gray-100 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-gray-300 resize-none"
              />
            </div>
          </div>

          {/* Forma de pagamento */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="mb-3 text-sm font-bold text-gray-700">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: 'pix',    label: 'PIX',      icon: '⚡' },
                { key: 'cash',   label: 'Dinheiro', icon: '💵' },
                { key: 'credit', label: 'Crédito',  icon: '💳' },
                { key: 'debit',  label: 'Débito',   icon: '🏦' },
              ] as { key: PaymentMethod; label: string; icon: string }[]).map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setPaymentMethod(key)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border-2 py-4 text-sm font-bold transition ${
                    paymentMethod === key ? 'border-current' : 'border-gray-100 text-gray-400 hover:bg-gray-50'
                  }`}
                  style={paymentMethod === key ? { borderColor: color, color, background: `${color}10` } : {}}
                >
                  <span className="text-2xl">{icon}</span>
                  {label}
                </button>
              ))}
            </div>

            {/* Dinheiro → troco */}
            {paymentMethod === 'cash' && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Precisa de troco?</p>
                <input
                  value={changeFor}
                  onChange={(e) => setChangeFor(e.target.value)}
                  placeholder={`Troco para R$ (total: R$ ${cartTotal.toFixed(2)})`}
                  type="number"
                  min={cartTotal}
                  step="0.50"
                  className="w-full rounded-xl border-2 border-gray-100 px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-gray-300"
                />
                <p className="text-xs text-gray-400">Deixe em branco se não precisar de troco.</p>
              </div>
            )}

            {/* Cartão → aviso maquininha */}
            {(paymentMethod === 'credit' || paymentMethod === 'debit') && (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-blue-50 p-4">
                <span className="text-2xl">🛵</span>
                <div>
                  <p className="text-sm font-bold text-blue-800">Maquininha na entrega</p>
                  <p className="mt-0.5 text-xs text-blue-600 leading-relaxed">
                    Nosso entregador levará a maquininha de cartão. Você paga na hora da entrega.
                  </p>
                </div>
              </div>
            )}

            {/* PIX → aviso QR code */}
            {paymentMethod === 'pix' && (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-green-50 p-4">
                <span className="text-2xl">⚡</span>
                <div>
                  <p className="text-sm font-bold text-green-800">QR Code gerado após confirmar</p>
                  <p className="mt-0.5 text-xs text-green-600 leading-relaxed">
                    Após confirmar o pedido, você receberá o QR Code PIX para realizar o pagamento.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Resumo */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">Resumo</p>
            {cart.map((item, i) => (
              <div key={i} className="flex justify-between py-1 text-sm text-gray-700">
                <span>{item.qty}× {item.product.name}{item.size ? ` (${item.size})` : ''}</span>
                <span>R$ {(item.unitPrice * item.qty).toFixed(2)}</span>
              </div>
            ))}
            <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-base font-black text-gray-900">
              <span>Total</span>
              <span style={{ color }}>R$ {cartTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Botão fixo */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white p-4">
        <button
          onClick={handleFinalize}
          disabled={sending || !customerName.trim() || (deliveryType === 'delivery' && !address.trim()) || !paymentMethod}
          className="w-full rounded-2xl py-4 text-base font-black text-white transition active:scale-[.98] disabled:opacity-50"
          style={{ background: color }}
        >
          {sending ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75"/>
              </svg>
              Enviando…
            </span>
          ) : '✅ Confirmar Pedido'}
        </button>
      </div>
    </div>
  )

  // ─── Carrinho ─────────────────────────────────────────────────────────────────
  if (step === 'cart') return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="sticky top-0 z-10 bg-white px-4 py-4 shadow-sm flex items-center gap-3">
        <button onClick={() => setStep('menu')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-600">←</button>
        <p className="font-bold text-gray-900">Seu carrinho</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {cart.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center gap-3 text-gray-400">
            <span className="text-5xl">🛒</span>
            <p className="text-sm">Carrinho vazio</p>
            <button onClick={() => setStep('menu')} className="mt-1 rounded-xl px-5 py-2 text-sm font-bold text-white" style={{ background: color }}>
              Ver cardápio
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-md space-y-3">
            {cart.map((item, idx) => (
              <div key={idx} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
                {item.product.image ? (
                  <img src={item.product.image} alt={item.product.name} className="h-14 w-14 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-2xl">🍽️</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm">{item.product.name}{item.size ? ` (${item.size})` : ''}</p>
                  <p className="text-xs text-gray-400 mt-0.5">R$ {item.unitPrice.toFixed(2)} cada</p>
                  <p className="text-sm font-black mt-1" style={{ color }}>R$ {(item.unitPrice * item.qty).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => removeFromCart(item.product.id, item.size)} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-600">−</button>
                  <span className="w-5 text-center text-sm font-black">{item.qty}</span>
                  <button onClick={() => addToCart(item.product, item.size, item.unitPrice)} className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: color }}>+</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white p-4 space-y-3">
          <div className="flex justify-between text-base font-black text-gray-900">
            <span>Total</span>
            <span style={{ color }}>R$ {cartTotal.toFixed(2)}</span>
          </div>
          <button onClick={() => setStep('info')} className="w-full rounded-2xl py-4 text-base font-black text-white active:scale-[.98]" style={{ background: color }}>
            Continuar →
          </button>
        </div>
      )}
    </div>
  )

  // ─── Cardápio (tela principal) ────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {sizePicker && (
        <SizeModal
          product={sizePicker}
          color={color}
          onSelect={(s) => { addToCart(sizePicker, s.label, s.price); setSizePicker(null) }}
          onClose={() => setSizePicker(null)}
        />
      )}

      {/* Header do restaurante */}
      <div className="bg-white shadow-sm">
        {/* Banner / cor de fundo */}
        <div className="relative" style={{ background: bannerColor }}>
          {bannerImage && (
            <img src={bannerImage} alt="" className="w-full h-32 object-cover opacity-50" />
          )}
          {/* Botão voltar ao topo esquerdo */}
          <button
            onClick={() => window.history.back()}
            className="absolute top-3 left-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition active:scale-90"
            title="Voltar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z" clipRule="evenodd" />
            </svg>
          </button>
          <div className={`${bannerImage ? 'absolute inset-0' : 'pt-1'} flex items-end gap-3 px-4 pb-4 pt-4`}>
            {restaurant?.logo ? (
              <img src={restaurant.logo} alt="" className="h-12 w-12 rounded-2xl object-cover border-2 border-white/80 shadow shrink-0" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-black text-white shadow shrink-0"
                style={{ background: color }}>
                {restaurant?.name?.charAt(0) ?? '🍽'}
              </div>
            )}
            <div className="min-w-0">
              <h1 className={`text-lg font-black leading-tight text-white drop-shadow-sm ${fontCls}`}>
                {restaurant?.name ?? 'Cardápio'}
              </h1>
              <p className="text-xs text-white/75 truncate">
                {r?.description as string || 'Peça pelo app e receba em casa 🛵'}
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 pb-3 pt-2">
          {/* Infos de entrega */}
          {(r?.estimatedTime || r?.deliveryFee != null || r?.minOrderValue || r?.openingHours) && (
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              {r?.estimatedTime && <span>⏱ {r.estimatedTime as string}</span>}
              {(r?.deliveryFee as number) != null && (
                <span>{(r?.deliveryFee as number) > 0 ? `🛵 R$ ${(r?.deliveryFee as number).toFixed(2)}` : '🛵 Entrega grátis'}</span>
              )}
              {r?.minOrderValue && <span>📦 Mín. R$ {(r?.minOrderValue as number).toFixed(2)}</span>}
              {r?.openingHours && <span>🕐 {r.openingHours as string}</span>}
            </div>
          )}

          {/* Categorias */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-4 py-2 text-xs font-bold transition ${btnRadius} ${
                  activeCategory === cat ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                style={activeCategory === cat ? { background: color } : {}}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de produtos */}
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {products.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center gap-3 text-gray-400">
            <span className="text-5xl">🍽️</span>
            <p className="text-sm">Nenhum produto disponível</p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">{activeCategory}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(byCategory[activeCategory] ?? []).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  color={color}
                  cartQty={cartQtyForProduct(product.id)}
                  onAdd={() => addToCart(product)}
                  onRemove={() => removeFromCart(product.id)}
                  onAddWithSizes={() => setSizePicker(product)}
                  btnRadius={btnRadius}
                  cardCls={cardCls}
                  fontCls={fontCls}
                  showDesc={showDesc}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Barra de carrinho */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4">
          <button
            onClick={() => setStep('cart')}
            className={`mx-auto flex w-full max-w-md items-center justify-between ${btnRadius} px-5 py-4 text-white shadow-xl active:scale-[.98] transition`}
            style={{ background: color }}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-sm font-black">
              {cartCount}
            </span>
            <span className="text-sm font-black">Ver carrinho</span>
            <span className="text-sm font-black">R$ {cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  )
}
