import { useEffect, useState } from 'react'
import { Layout, PageHeader } from '@/components/Layout'
import { useAuth } from '@/hooks/useAuth'
import {
  subscribeAllProducts, createProduct, updateProduct,
  deleteProduct, toggleProductActive, CATEGORIES,
} from '@/services/productsAdmin'
import type { Product, ProductCategory } from '@/types'

const EMPTY: Omit<Product, 'id'> = {
  restaurantId: '',
  name:         '',
  price:        0,
  category:     'Hambúrguer',
  image:        '',
  active:       true,
}

function ProductModal({
  product,
  restaurantId,
  onClose,
}: {
  product:      Partial<Product> | null
  restaurantId: string
  onClose:      () => void
}) {
  const isNew = !product?.id
  const [form, setForm] = useState<Omit<Product, 'id'>>({
    ...EMPTY,
    restaurantId,
    ...product,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    if (form.price <= 0)   { setError('Preço deve ser maior que zero'); return }
    setSaving(true)
    try {
      if (isNew) {
        await createProduct(form)
      } else {
        await updateProduct(product!.id!, form)
      }
      onClose()
    } catch {
      setError('Erro ao salvar produto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">
            {isNew ? 'Novo produto' : 'Editar produto'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: X-Burguer" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Preço (R$)</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.price || ''}
                onChange={(e) => set('price', parseFloat(e.target.value) || 0)}
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) => set('category', e.target.value as ProductCategory)}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">URL da imagem (opcional)</label>
            <input className="input" value={form.image} onChange={(e) => set('image', e.target.value)} placeholder="https://..." />
            {form.image && (
              <img src={form.image} alt="" className="mt-2 h-16 w-16 rounded-xl object-cover border border-gray-100"
                onError={(e) => (e.currentTarget.style.display = 'none')} />
            )}
          </div>

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
  const { restaurantId }          = useAuth()
  const [products, setProducts]   = useState<Product[]>([])
  const [editing, setEditing]     = useState<Partial<Product> | null | false>(false)
  const [filter, setFilter]       = useState<string>('all')
  const [search, setSearch]       = useState('')
  const [deleting, setDeleting]   = useState<string | null>(null)

  useEffect(() => {
    if (!restaurantId) return
    return subscribeAllProducts(restaurantId, setProducts)
  }, [restaurantId])

  const categories = ['all', ...CATEGORIES]

  const displayed = products
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
        action={
          <button onClick={() => setEditing({})} className="btn-primary text-sm">
            + Novo produto
          </button>
        }
      />

      <div className="flex flex-1 flex-col overflow-hidden p-6">
        {/* Filtros */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar produto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-48 text-sm"
          />
          <div className="flex gap-1.5 flex-wrap">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filter === c ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {c === 'all' ? 'Todos' : c}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-y-auto rounded-2xl border border-gray-100 bg-white">
          {displayed.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-gray-400">
              Nenhum produto encontrado
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Categoria</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Preço</th>
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
                        <span className="text-sm font-medium text-gray-800">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">{p.category}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      R$ {p.price.toFixed(2)}
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
                        <button
                          onClick={() => setEditing(p)}
                          className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deleting === p.id}
                          className="rounded-lg border border-red-100 px-3 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50"
                        >
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
        <ProductModal
          product={editing}
          restaurantId={restaurantId}
          onClose={() => setEditing(false)}
        />
      )}
    </Layout>
  )
}
