import { useState } from 'react'
import { Layout, PageHeader } from '@/components/Layout'
import { useTables } from '@/hooks/useTables'
import { useAuth } from '@/hooks/useAuth'
import { addTable, deleteTable, tableNumberExists } from '@/services/tablesAdmin'
import type { Table } from '@/types'

const STATUS_LABEL: Record<Table['status'], string> = {
  free:    'Livre',
  open:    'Ocupada',
  closing: 'Fechando',
}
const STATUS_COLOR: Record<Table['status'], string> = {
  free:    'bg-green-50 text-green-700',
  open:    'bg-amber-50 text-amber-700',
  closing: 'bg-red-50 text-red-700',
}

export default function TablesAdminPage() {
  const { tables, loading }         = useTables()
  const { restaurantId }            = useAuth()
  const [newNumber, setNewNumber]   = useState('')
  const [adding, setAdding]         = useState(false)
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')

  async function handleAdd() {
    const num = parseInt(newNumber)
    if (!num || num < 1 || num > 999) { setError('Número inválido (1–999)'); return }
    if (!restaurantId) return
    setAdding(true)
    setError('')
    try {
      const exists = await tableNumberExists(restaurantId, num)
      if (exists) { setError(`Mesa ${num} já existe`); return }
      await addTable(restaurantId, num)
      setNewNumber('')
      setSuccess(`Mesa ${num} adicionada!`)
      setTimeout(() => setSuccess(''), 3000)
    } catch {
      setError('Erro ao adicionar mesa')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(table: Table) {
    if (table.status !== 'free') {
      setError(`Mesa ${table.number} está ${STATUS_LABEL[table.status].toLowerCase()} — feche antes de remover`)
      setTimeout(() => setError(''), 4000)
      return
    }
    if (!confirm(`Remover mesa ${table.number}?`)) return
    setDeleting(table.id)
    await deleteTable(table.id)
    setDeleting(null)
  }

  const sorted = [...tables].sort((a, b) => a.number - b.number)

  return (
    <Layout>
      <PageHeader
        title="Gestão de mesas"
        subtitle={`${tables.length} mesas · ${tables.filter(t => t.status === 'free').length} livres`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Adicionar mesa */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Adicionar mesa</h2>
          {error  && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
          {success && <div className="mb-3 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-600">✅ {success}</div>}
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="1"
              max="999"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="input w-32"
              placeholder="Nº da mesa"
            />
            <button onClick={handleAdd} disabled={adding || !newNumber} className="btn-primary px-6 disabled:opacity-50">
              {adding ? 'Adicionando…' : '+ Adicionar'}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Dica: após adicionar, acesse QR Codes para imprimir o QR da nova mesa.
          </p>
        </div>

        {/* Lista de mesas */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          <div className="border-b border-gray-100 px-5 py-3">
            <span className="text-sm font-semibold text-gray-700">Mesas cadastradas</span>
          </div>
          {loading ? (
            <div className="flex h-24 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {sorted.map((table) => (
                <div key={table.id} className="flex flex-col items-center gap-2 rounded-xl border border-gray-100 p-3">
                  <span className="text-xl font-bold text-gray-700">{table.number}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[table.status]}`}>
                    {STATUS_LABEL[table.status]}
                  </span>
                  <button
                    onClick={() => handleDelete(table)}
                    disabled={deleting === table.id}
                    className={`text-xs transition disabled:opacity-40 ${
                      table.status === 'free'
                        ? 'text-red-400 hover:text-red-600'
                        : 'cursor-not-allowed text-gray-300'
                    }`}
                    title={table.status !== 'free' ? 'Feche a mesa antes de remover' : 'Remover mesa'}
                  >
                    {deleting === table.id ? '…' : 'Remover'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </Layout>
  )
}
