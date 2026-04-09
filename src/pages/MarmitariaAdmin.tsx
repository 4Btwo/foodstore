import { useState, useEffect } from 'react'
import { Layout, PageHeader } from '@/components/Layout'
import { useAuth } from '@/hooks/useAuth'
import {
  subscribeDailyDishes, createDailyDish, updateDailyDish, deleteDailyDish,
} from '@/services/marmitaria'
import { createProduct, updateProduct, deleteProduct } from '@/services/productsAdmin'
import type { DailyDish, ProductSize } from '@/types'

function todayISO() { return new Date().toISOString().split('T')[0] }

function StockPill({ stock }: { stock?: number | null }) {
  if (stock === null || stock === undefined)
    return <span className="text-xs text-gray-400">Ilimitado</span>
  if (stock <= 0)
    return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">Esgotado</span>
  if (stock <= 3)
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-600">⚠ {stock} restantes</span>
  return <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">{stock} restantes</span>
}

export default function MarmitariaAdminPage() {
  const { restaurantId }        = useAuth()
  const [dishes, setDishes]     = useState<DailyDish[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editDish, setEditDish] = useState<DailyDish | null>(null)

  const [name, setName]       = useState('')
  const [desc, setDesc]       = useState('')
  const [price, setPrice]     = useState('')
  const [useStock, setUseStock] = useState(false)
  const [stock, setStock]     = useState('20')
  const [saving, setSaving]   = useState(false)

  // Tamanhos (P, M, G)
  const [useSizes, setUseSizes] = useState(false)
  const DEFAULT_SIZES = [
    { label: 'P', price: '' },
    { label: 'M', price: '' },
    { label: 'G', price: '' },
  ]
  const [sizes, setSizes] = useState(DEFAULT_SIZES)

  const today = todayISO()

  useEffect(() => {
    if (!restaurantId) return
    const unsub = subscribeDailyDishes(restaurantId, today, (d) => {
      setDishes(d); setLoading(false)
    })
    return unsub
  }, [restaurantId, today])

  function openNew() {
    setEditDish(null); setName(''); setDesc(''); setPrice(''); setUseStock(false); setStock('20')
    setUseSizes(false); setSizes(DEFAULT_SIZES)
    setShowForm(true)
  }

  function openEdit(dish: DailyDish) {
    setEditDish(dish); setName(dish.name); setDesc(dish.description); setPrice(String(dish.price))
    setUseStock(dish.stock !== null && dish.stock !== undefined)
    setStock(String(dish.stock ?? 20))
    if (dish.sizes && dish.sizes.length > 0) {
      setUseSizes(true)
      setSizes(dish.sizes.map(s => ({ label: s.label, price: String(s.price) })))
    } else {
      setUseSizes(false)
      setSizes(DEFAULT_SIZES)
    }
    setShowForm(true)
  }

  async function handleSave() {
    if (!restaurantId || !name) return
    // Se não usa tamanhos, precisa de preço base
    if (!useSizes && !price) return
    // Se usa tamanhos, todos devem ter preço
    if (useSizes && sizes.some(s => !s.price)) return

    setSaving(true)
    try {
      const stockVal = useStock ? parseInt(stock) || 0 : null
      const sizesVal: ProductSize[] = useSizes
        ? sizes.map(s => ({ label: s.label, price: parseFloat(s.price) }))
        : []
      const priceVal = useSizes ? 0 : parseFloat(price)

      if (editDish) {
        await updateDailyDish(editDish.id, {
          name, description: desc,
          price: priceVal, stock: stockVal,
          sizes: sizesVal,
        })
        if (editDish.productId) {
          await updateProduct(editDish.productId, {
            name, price: priceVal, stock: stockVal, sizes: sizesVal,
          })
        }
      } else {
        const productId = await createProduct({
          restaurantId,
          name,
          price:    priceVal,
          category: 'Prato do Dia',
          image:    '',
          active:   true,
          stock:    stockVal,
          sizes:    sizesVal,
        })
        await createDailyDish(restaurantId, {
          name, description: desc,
          price: priceVal, date: today, active: true,
          stock: stockVal, sizes: sizesVal, productId,
        })
      }
      setShowForm(false)
    } finally { setSaving(false) }
  }

  const esgotados = dishes.filter(d => d.stock !== null && d.stock !== undefined && d.stock <= 0)
  const baixos    = dishes.filter(d => d.stock !== null && d.stock !== undefined && d.stock > 0 && d.stock <= 3)

  return (
    <Layout>
      <PageHeader
        title="Marmitaria — Pratos do Dia"
        subtitle={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        action={
          <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
            + Novo Prato
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">

        {/* Alertas de estoque */}
        {esgotados.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <span className="text-lg">🚫</span>
            <div>
              <p className="text-sm font-semibold text-red-700">Pratos esgotados</p>
              <p className="text-xs text-red-600">{esgotados.map(d => d.name).join(' · ')}</p>
            </div>
          </div>
        )}
        {baixos.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-amber-700">Estoque baixo</p>
              <p className="text-xs text-amber-600">{baixos.map(d => `${d.name} (${d.stock} restantes)`).join(' · ')}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center pt-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>
        ) : dishes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 pt-20 text-gray-400">
            <span className="text-5xl">🍱</span>
            <p className="text-sm">Nenhum prato cadastrado para hoje</p>
            <button onClick={openNew} className="mt-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white">Criar primeiro prato</button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dishes.map((dish) => (
              <div key={dish.id} className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
                dish.stock !== null && dish.stock !== undefined && dish.stock <= 0
                  ? 'border-red-200 opacity-70'
                  : dish.active ? 'border-green-200' : 'border-gray-200 opacity-60'
              }`}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-800">{dish.name}</h3>
                    {dish.description && <p className="mt-0.5 text-xs text-gray-500">{dish.description}</p>}
                  </div>
                  <span className="shrink-0 rounded-lg bg-brand-50 px-2 py-1 text-sm font-bold text-brand-600">
                    {dish.sizes && dish.sizes.length > 0
                      ? dish.sizes.map(s => `${s.label} R$${s.price.toFixed(2)}`).join(' · ')
                      : `R$ ${dish.price.toFixed(2)}`}
                  </span>
                </div>
                <div className="mb-3">
                  <StockPill stock={dish.stock} />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(dish)} className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">✏️ Editar</button>
                  <button
                    onClick={async () => {
                      await updateDailyDish(dish.id, { active: !dish.active })
                      if (dish.productId) await updateProduct(dish.productId, { active: !dish.active })
                    }}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition border ${
                      dish.active ? 'border-amber-200 text-amber-600 hover:bg-amber-50' : 'border-green-200 text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {dish.active ? '⏸ Pausar' : '▶️ Ativar'}
                  </button>
                  <button
                    onClick={async () => {
                      await deleteDailyDish(dish.id)
                      if (dish.productId) await deleteProduct(dish.productId)
                    }}
                    className="rounded-lg border border-red-100 px-2 py-1.5 text-xs text-red-400 hover:bg-red-50"
                  >🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-bold text-gray-800">{editDish ? 'Editar Prato' : 'Novo Prato do Dia'}</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Nome do prato *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Frango grelhado com arroz"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Descrição</label>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Acompanhamentos..."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
              </div>

              {/* Toggle tamanhos */}
              <div className="rounded-xl border border-gray-100 p-3">
                <label className="flex items-center gap-3 cursor-pointer mb-2">
                  <div onClick={() => setUseSizes(!useSizes)}
                    className={`relative h-5 w-9 rounded-full transition ${useSizes ? 'bg-brand-500' : 'bg-gray-200'}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${useSizes ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Marmitex com tamanhos (P, M, G)</span>
                </label>

                {useSizes ? (
                  <div className="space-y-2 mt-3">
                    <p className="text-xs text-gray-400 mb-2">Defina o preço de cada tamanho:</p>
                    {sizes.map((s, i) => (
                      <div key={s.label} className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-xs font-black text-white shrink-0">{s.label}</span>
                        <div className="flex-1">
                          <input
                            type="number" step="0.01" min="0"
                            value={s.price}
                            onChange={(e) => setSizes(prev => prev.map((x, j) => j === i ? { ...x, price: e.target.value } : x))}
                            placeholder="R$ 0,00"
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2">
                    <label className="mb-1 block text-xs font-medium text-gray-600">Preço único (R$) *</label>
                    <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
                  </div>
                )}
              </div>

              {/* Controle de unidades */}
              <div className="rounded-xl border border-gray-100 p-3">
                <label className="flex items-center gap-3 cursor-pointer mb-2">
                  <div onClick={() => setUseStock(!useStock)}
                    className={`relative h-5 w-9 rounded-full transition ${useStock ? 'bg-brand-500' : 'bg-gray-200'}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${useStock ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Controlar unidades disponíveis</span>
                </label>
                {useStock && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Quantidade</label>
                    <input type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)}
                      className="w-28 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
                    <p className="mt-1 text-xs text-gray-400">Aviso quando restar ≤ 3 unidades</p>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave}
                disabled={saving || !name || (useSizes ? sizes.some(s => !s.price) : !price)}
                className="flex-1 rounded-xl bg-brand-500 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
