import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout, PageHeader } from '@/components/Layout'
import { useAuth } from '@/hooks/useAuth'
import { subscribeDailyDishes, createMarmitaOrder } from '@/services/marmitaria'
import type { DailyDish, MarmitaDeliveryType, MarmitaOrderItem } from '@/types'

function todayISO() { return new Date().toISOString().split('T')[0] }

type CartItem = { dish: DailyDish; qty: number; size?: string; unitPrice: number }

function StockWarning({ dish, cartQty }: { dish: DailyDish; cartQty: number }) {
  if (dish.stock === null || dish.stock === undefined) return null
  const remaining = dish.stock - cartQty
  if (remaining <= 0) return <span className="text-xs text-red-500 font-medium">Esgotado</span>
  if (remaining <= 3) return <span className="text-xs text-amber-500">⚠ {remaining} restante{remaining !== 1 ? 's' : ''}</span>
  return <span className="text-xs text-gray-400">{dish.stock} un.</span>
}

export default function MarmitariaOrderPage() {
  const { restaurantId }          = useAuth()
  const navigate                  = useNavigate()
  const [dishes, setDishes]       = useState<DailyDish[]>([])
  const [loading, setLoading]     = useState(true)
  const [cart, setCart]           = useState<CartItem[]>([])
  const [step, setStep]           = useState<'dishes' | 'info'>('dishes')
  const [deliveryType, setDeliveryType] = useState<MarmitaDeliveryType>('pickup')
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone]         = useState('')
  const [address, setAddress]     = useState('')
  const [notes, setNotes]         = useState('')
  const [saving, setSaving]       = useState(false)
  const today = todayISO()

  useEffect(() => {
    if (!restaurantId) return
    return subscribeDailyDishes(restaurantId, today, (d) => {
      setDishes(d.filter((x) => x.active))
      setLoading(false)
    })
  }, [restaurantId, today])

  function cartQtyForDish(dishId: string) {
    return cart.filter(c => c.dish.id === dishId).reduce((s, c) => s + c.qty, 0)
  }

  function canAddMore(dish: DailyDish) {
    if (dish.stock === null || dish.stock === undefined) return true
    return cartQtyForDish(dish.id) < dish.stock
  }

  function addToCart(dish: DailyDish, size?: string) {
    if (!canAddMore(dish)) return
    const unitPrice = size && dish.sizes?.length
      ? (dish.sizes.find(s => s.label === size)?.price ?? dish.price)
      : dish.price
    const key = `${dish.id}__${size ?? ''}`
    setCart(prev => {
      const existing = prev.find(c => `${c.dish.id}__${c.size ?? ''}` === key)
      if (existing) return prev.map(c => `${c.dish.id}__${c.size ?? ''}` === key ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { dish, qty: 1, size, unitPrice }]
    })
  }

  function removeFromCart(dishId: string, size?: string) {
    const key = `${dishId}__${size ?? ''}`
    setCart(prev => {
      const ex = prev.find(c => `${c.dish.id}__${c.size ?? ''}` === key)
      if (!ex) return prev
      if (ex.qty === 1) return prev.filter(c => `${c.dish.id}__${c.size ?? ''}` !== key)
      return prev.map(c => `${c.dish.id}__${c.size ?? ''}` === key ? { ...c, qty: c.qty - 1 } : c)
    })
  }

  const cartTotal = cart.reduce((s, c) => s + c.unitPrice * c.qty, 0)
  const cartCount = cart.reduce((s, c) => s + c.qty, 0)

  async function handleFinalize() {
    if (!restaurantId || !customerName) return
    if (deliveryType === 'delivery' && !address) return
    setSaving(true)
    try {
      const items: Omit<MarmitaOrderItem, 'id' | 'marmitaOrderId'>[] = cart.map((c) => ({
        dishId: c.dish.id,
        name:   c.size ? `${c.dish.name} (${c.size})` : c.dish.name,
        qty:    c.qty,
        price:  c.unitPrice,
        ...(c.size ? { size: c.size } : {}),
      }))
      await createMarmitaOrder(restaurantId, {
        customerName,
        deliveryType,
        address:  deliveryType === 'delivery' ? address : undefined,
        phone:    phone || undefined,
        notes:    notes || undefined,
        total:    cartTotal,
      }, items)
      navigate('/marmitaria')
    } finally { setSaving(false) }
  }

  return (
    <Layout>
      <PageHeader
        title="Novo Pedido — Marmitaria"
        subtitle={step === 'dishes' ? 'Selecione os pratos' : 'Dados do cliente'}
        action={step === 'info' ? (
          <button onClick={() => setStep('dishes')} className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">← Voltar</button>
        ) : undefined}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {step === 'dishes' && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex justify-center pt-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>
              ) : dishes.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 pt-20 text-gray-400">
                  <span className="text-5xl">🍱</span>
                  <p className="text-sm">Nenhum prato disponível hoje</p>
                  <button onClick={() => navigate('/marmitaria/admin')} className="mt-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white">Cadastrar pratos</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {dishes.map((dish) => {
                    const totalInCart = cartQtyForDish(dish.id)
                    const isEsgotado  = dish.stock !== null && dish.stock !== undefined && dish.stock <= 0
                    const hasSizes    = (dish.sizes?.length ?? 0) > 0

                    return (
                      <div key={dish.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${isEsgotado ? 'opacity-50 border-red-200' : 'border-gray-100'}`}>
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-800">{dish.name}</p>
                              {isEsgotado && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">Esgotado</span>}
                            </div>
                            {dish.description && <p className="text-xs text-gray-500">{dish.description}</p>}
                            <div className="mt-1 flex items-center gap-3">
                              {!hasSizes && <p className="text-sm font-bold text-brand-600">R$ {dish.price.toFixed(2)}</p>}
                              <StockWarning dish={dish} cartQty={totalInCart} />
                            </div>
                          </div>

                          {/* Sem tamanhos — botões simples */}
                          {!hasSizes && !isEsgotado && (
                            <div className="flex items-center gap-2">
                              {totalInCart > 0 ? (
                                <>
                                  <button onClick={() => removeFromCart(dish.id)} className="h-8 w-8 rounded-full border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50">−</button>
                                  <span className="w-6 text-center text-sm font-bold">{totalInCart}</span>
                                  <button onClick={() => addToCart(dish)} disabled={!canAddMore(dish)} className="h-8 w-8 rounded-full bg-brand-500 text-lg font-bold text-white hover:bg-brand-600 disabled:opacity-40">+</button>
                                </>
                              ) : (
                                <button onClick={() => addToCart(dish)} className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-600">+ Add</button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Com tamanhos — grade de tamanhos */}
                        {hasSizes && !isEsgotado && (
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            {dish.sizes!.map((s) => {
                              const sCartItem = cart.find(c => c.dish.id === dish.id && c.size === s.label)
                              return (
                                <div key={s.label} className="rounded-xl border border-gray-100 p-2 text-center">
                                  <p className="text-xs font-bold text-gray-700">{s.label}</p>
                                  <p className="text-xs text-brand-600 font-semibold mb-1">R$ {s.price.toFixed(2)}</p>
                                  {sCartItem ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <button onClick={() => removeFromCart(dish.id, s.label)} className="h-6 w-6 rounded-full border text-sm font-bold text-gray-500 hover:bg-gray-50">−</button>
                                      <span className="text-xs font-bold w-4 text-center">{sCartItem.qty}</span>
                                      <button onClick={() => addToCart(dish, s.label)} disabled={!canAddMore(dish)} className="h-6 w-6 rounded-full bg-brand-500 text-sm font-bold text-white disabled:opacity-40">+</button>
                                    </div>
                                  ) : (
                                    <button onClick={() => addToCart(dish, s.label)} disabled={!canAddMore(dish)} className="w-full rounded-lg bg-brand-500 py-0.5 text-xs font-semibold text-white disabled:opacity-40">Add</button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {cartCount > 0 && (
              <div className="border-t border-gray-100 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600">{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
                  <span className="font-bold text-gray-800">R$ {cartTotal.toFixed(2)}</span>
                </div>
                <button onClick={() => setStep('info')} className="w-full rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600">Continuar →</button>
              </div>
            )}
          </div>
        )}

        {step === 'info' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-lg space-y-4">
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-700">Tipo de pedido</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['pickup', 'delivery'] as const).map((type) => (
                    <button key={type} onClick={() => setDeliveryType(type)}
                      className={`flex flex-col items-center gap-1 rounded-2xl border-2 py-4 text-sm font-semibold transition ${
                        deliveryType === type ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}>
                      <span className="text-2xl">{type === 'pickup' ? '🏃' : '🛵'}</span>
                      {type === 'pickup' ? 'Retirada' : 'Entrega'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Nome do cliente *</label>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome completo"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Telefone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400" />
              </div>
              {deliveryType === 'delivery' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Endereço *</label>
                  <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Rua, número, bairro..."
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400" />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Observações</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Sem cebola, pouco sal..."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400" />
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Resumo</p>
                {cart.map((c, i) => (
                  <div key={i} className="flex justify-between text-sm text-gray-700 py-0.5">
                    <span>{c.qty}× {c.dish.name}{c.size ? ` (${c.size})` : ''}</span>
                    <span>R$ {(c.unitPrice * c.qty).toFixed(2)}</span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-800">
                  <span>Total</span><span>R$ {cartTotal.toFixed(2)}</span>
                </div>
              </div>
              <button onClick={handleFinalize} disabled={saving || !customerName || (deliveryType === 'delivery' && !address)}
                className="w-full rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50">
                {saving ? 'Enviando…' : '✅ Finalizar Pedido'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
