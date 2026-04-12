import { useEffect, useState } from 'react'
import { Layout, PageHeader } from '@/components/Layout'
import { ImageUploader } from '@/components/ImageUploader'
import { useAuth } from '@/hooks/useAuth'
import {
  subscribeAllProducts, createProduct, updateProduct,
  deleteProduct, toggleProductActive, CATEGORIES,
} from '@/services/productsAdmin'
import type { Product, ProductCategory, ProductSize } from '@/types'

const EMPTY: Omit<Product, 'id'> = {
  restaurantId: '',
  name:         '',
  description:  '',
  price:        0,
  category:     'Hambúrguer',
  image:        '',
  active:       true,
  sizes:        [],
  stock:        null,
  onPromotion:    false,
  promotionPrice: 0,
  promotionLabel: '',
}

const DEFAULT_SIZES: ProductSize[] = [
  { label: 'P', price: 0 },
  { label: 'M', price: 0 },
  { label: 'G', price: 0 },
]

function StockBadge({ stock }: { stock?: number | null }) {
  if (stock === null || stock === undefined) return null
  if (stock <= 0)  return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">Esgotado</span>
  if (stock <= 5)  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-600">⚠ {stock} un.</span>
  return <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">{stock} un.</span>
}

function ProductModal({
  product, restaurantId, onClose,
}: {
  product:      Partial<Product> | null
  restaurantId: string
  onClose:      () => void
}) {
  const isNew = !product?.id
  const [form, setForm]       = useState<Omit<Product, 'id'>>({ ...EMPTY, restaurantId, ...product })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [useSizes, setUseSizes] = useState((product?.sizes?.length ?? 0) > 0)
  const [useStock, setUseStock] = useState(product?.stock !== null && product?.stock !== undefined)
  const [usePromo, setUsePromo] = useState(product?.onPromotion ?? false)

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function updateSize(idx: number, field: 'label' | 'price', val: string) {
    const sizes = [...(form.sizes ?? [])]
    sizes[idx] = { ...sizes[idx], [field]: field === 'price' ? parseFloat(val) || 0 : val }
    set('sizes', sizes)
  }

  function addSize() {
    set('sizes', [...(form.sizes ?? []), { label: '', price: 0 }])
  }

  function removeSize(idx: number) {
    set('sizes', (form.sizes ?? []).filter((_, i) => i !== idx))
  }

  function toggleSizes(on: boolean) {
    setUseSizes(on)
    if (on && (form.sizes ?? []).length === 0) set('sizes', DEFAULT_SIZES)
    if (!on) set('sizes', [])
  }

  function toggleStock(on: boolean) {
    setUseStock(on)
    set('stock', on ? 10 : null)
  }

  function togglePromo(on: boolean) {
    setUsePromo(on)
    set('onPromotion', on)
    if (!on) { set('promotionPrice', 0); set('promotionLabel', '') }
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    if (!useSizes && form.price <= 0) { setError('Preço deve ser maior que zero'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        sizes: useSizes ? (form.sizes ?? []) : [],
        stock: useStock ? (form.stock ?? 0) : null,
        onPromotion:    usePromo,
        promotionPrice: usePromo ? (form.promotionPrice ?? 0) : 0,
        promotionLabel: usePromo ? (form.promotionLabel ?? '') : '',
      }
      if (isNew) await createProduct(payload)
      else       await updateProduct(product!.id!, payload)
      onClose()
    } catch { setError('Erro ao salvar produto') }
    finally   { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">
            {isNew ? 'Novo produto' : 'Editar produto'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: X-Burguer" />
          </div>

          {/* Descrição — só para Prato do Dia */}
          {form.category === 'Prato do Dia' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Descrição / Acompanhamentos</label>
              <textarea
                className="input resize-none"
                rows={2}
                value={form.description ?? ''}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Ex: Arroz, feijão, salada, carne grelhada…"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Preço base (R$) {useSizes ? '— override por tamanho' : ''}
              </label>
              <input
                className="input"
                type="number" min="0" step="0.01"
                value={form.price || ''}
                onChange={(e) => set('price', parseFloat(e.target.value) || 0)}
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
              <select className="input" value={form.category} onChange={(e) => set('category', e.target.value as ProductCategory)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Tamanhos */}
          <div className="rounded-xl border border-gray-100 p-3">
            <label className="flex items-center gap-3 cursor-pointer mb-3">
              <div
                onClick={() => toggleSizes(!useSizes)}
                className={`relative h-5 w-9 rounded-full transition ${useSizes ? 'bg-brand-500' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${useSizes ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">Usar tamanhos (P / M / G)</span>
            </label>

            {useSizes && (
              <div className="space-y-2">
                {(form.sizes ?? []).map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="input w-16 text-center font-bold"
                      value={s.label}
                      onChange={(e) => updateSize(i, 'label', e.target.value)}
                      placeholder="P"
                      maxLength={4}
                    />
                    <input
                      className="input flex-1"
                      type="number" min="0" step="0.01"
                      value={s.price || ''}
                      onChange={(e) => updateSize(i, 'price', e.target.value)}
                      placeholder="Preço R$"
                    />
                    <button onClick={() => removeSize(i)} className="text-red-400 hover:text-red-600 px-1">✕</button>
                  </div>
                ))}
                <button onClick={addSize} className="text-xs text-brand-600 hover:underline">+ Adicionar tamanho</button>
              </div>
            )}
          </div>

          {/* Controle de estoque */}
          <div className="rounded-xl border border-gray-100 p-3">
            <label className="flex items-center gap-3 cursor-pointer mb-3">
              <div
                onClick={() => toggleStock(!useStock)}
                className={`relative h-5 w-9 rounded-full transition ${useStock ? 'bg-brand-500' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${useStock ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">Controlar estoque</span>
            </label>

            {useStock && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Unidades disponíveis</label>
                <input
                  className="input w-32"
                  type="number" min="0" step="1"
                  value={form.stock ?? ''}
                  onChange={(e) => set('stock', parseInt(e.target.value) || 0)}
                />
                <p className="mt-1 text-xs text-gray-400">Aviso automático quando ≤ 5 unidades</p>
              </div>
            )}
          </div>

          {/* Promoção */}
          <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-3">
            <label className="flex items-center gap-3 cursor-pointer mb-3">
              <div
                onClick={() => togglePromo(!usePromo)}
                className={`relative h-5 w-9 rounded-full transition ${usePromo ? 'bg-orange-500' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${usePromo ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">🏷️ Colocar em promoção</span>
            </label>

            {usePromo && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Preço promocional (R$)</label>
                    <input
                      className="input"
                      type="number" min="0" step="0.01"
                      value={form.promotionPrice || ''}
                      onChange={(e) => set('promotionPrice', parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                    />
                    {form.promotionPrice > 0 && form.price > 0 && (
                      <p className="text-xs text-orange-600 mt-1 font-semibold">
                        Desconto: {Math.round(((form.price - form.promotionPrice) / form.price) * 100)}%
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Etiqueta do badge</label>
                    <input
                      className="input"
                      value={form.promotionLabel ?? ''}
                      onChange={(e) => set('promotionLabel', e.target.value)}
                      placeholder="Ex: 30% OFF"
                      maxLength={20}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-100 rounded-lg px-3 py-2">
                  <span>👁️</span>
                  <span>Badge "{form.promotionLabel || '% OFF'}" aparece no card do produto na loja do cliente</span>
                </div>
              </div>
            )}
          </div>

          <ImageUploader
            label="Imagem do produto"
            value={form.image}
            storagePath={`restaurants/${restaurantId}/products/${Date.now()}`}
            aspectClass="aspect-video"
            hint="Recomendado: 800×600px, fundo claro"
            onChange={(url) => set('image', url)}
          />

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => set('active', !form.active)}
              className={`relative h-5 w-9 rounded-full transition ${form.active ? 'bg-brand-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-gray-600">{form.active ? 'Ativo no cardápio' : 'Oculto no cardápio'}</span>
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MenuAdminPage() {
  const { restaurantId }        = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [editing, setEditing]   = useState<Partial<Product> | null | false>(false)
  const [filter, setFilter]     = useState<string>('all')
  const [search, setSearch]     = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [stockAlert, setStockAlert] = useState<Product[]>([])

  useEffect(() => {
    if (!restaurantId) return
    return subscribeAllProducts(restaurantId, (prods) => {
      setProducts(prods)
      setStockAlert(prods.filter((p) => p.stock !== null && p.stock !== undefined && p.stock <= 5 && p.stock > 0))
    })
  }, [restaurantId])

  const categories = ['all', ...CATEGORIES]
  const displayed  = products
    .filter((p) => filter === 'all' || p.category === filter)
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  async function handleDelete(id: string) {
    setDeleting(id)
    await deleteProduct(id)
    setDeleting(null)
  }

  return (
    <Layout>
      <PageHeader
        title="Cardápio"
        subtitle={`${products.length} produtos · ${products.filter(p => p.active).length} ativos`}
        action={<button onClick={() => setEditing({})} className="btn-primary text-sm">+ Novo produto</button>}
      />

      <div className="flex flex-1 flex-col overflow-hidden p-6">

        {/* Alerta de estoque baixo */}
        {stockAlert.length > 0 && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-amber-700">Estoque baixo</p>
              <p className="text-xs text-amber-600">
                {stockAlert.map((p) => `${p.name} (${p.stock} un.)`).join(' · ')}
              </p>
            </div>
          </div>
        )}

        {/* Alerta de esgotados */}
        {products.filter(p => p.stock !== null && p.stock !== undefined && p.stock <= 0).length > 0 && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <span className="text-lg">🚫</span>
            <div>
              <p className="text-sm font-semibold text-red-700">Esgotados</p>
              <p className="text-xs text-red-600">
                {products.filter(p => p.stock !== null && p.stock !== undefined && p.stock <= 0).map(p => p.name).join(' · ')}
              </p>
            </div>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text" placeholder="Buscar produto…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="input w-48 text-sm"
          />
          <div className="flex gap-1.5 flex-wrap">
            {categories.map((c) => (
              <button
                key={c} onClick={() => setFilter(c)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filter === c ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {c === 'all' ? 'Todos' : c}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto rounded-2xl border border-gray-100 bg-white">
          {displayed.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-gray-400">Nenhum produto encontrado</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Categoria</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Preço</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Promoção</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Estoque</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayed.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.image ? (
                          <img src={p.image} alt="" className="h-9 w-9 rounded-lg object-cover border border-gray-100"
                            onError={(e) => (e.currentTarget.style.display = 'none')} />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-base">🍽️</div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-800">{p.name}</p>
                          {p.description && (
                            <p className="text-xs text-gray-400 truncate max-w-[180px]">{p.description}</p>
                          )}
                          {!p.description && (p.sizes ?? []).length > 0 && (
                            <p className="text-xs text-gray-400">{p.sizes!.map(s => s.label).join(' / ')}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">{p.category}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {(p.sizes ?? []).length > 0
                        ? <span className="text-xs text-gray-500">{p.sizes!.map(s => `${s.label} R$${s.price.toFixed(2)}`).join(' · ')}</span>
                        : `R$ ${p.price.toFixed(2)}`
                      }
                    </td>
                    <td className="px-4 py-3">
                      {p.onPromotion && p.promotionPrice ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">
                            {p.promotionLabel || '% OFF'}
                          </span>
                          <span className="text-xs text-orange-600 font-semibold">R$ {p.promotionPrice.toFixed(2)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StockBadge stock={p.stock} />
                      {(p.stock === null || p.stock === undefined) && <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleProductActive(p.id, !p.active)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                          p.active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {p.active ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setEditing(p)} className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">Editar</button>
                        <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                          className="rounded-lg border border-red-100 px-3 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50">
                          {deleting === p.id ? '…' : 'Excluir'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editing !== false && restaurantId && (
        <ProductModal product={editing} restaurantId={restaurantId} onClose={() => setEditing(false)} />
      )}
    </Layout>
  )
}
