import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid,
} from 'recharts'
import { Layout, PageHeader } from '@/components/Layout'
import { useDashboard } from '@/hooks/useDashboard'
import { useTables } from '@/hooks/useTables'

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-800">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function DashboardPage() {
  const { metrics, loading } = useDashboard()
  const { tables }           = useTables()

  const tablesFree    = tables.filter((t) => t.status === 'free').length
  const tablesOccupied = tables.filter((t) => t.status !== 'free').length
  const occupancy     = tables.length > 0 ? Math.round((tablesOccupied / tables.length) * 100) : 0

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <Layout>
      <PageHeader title="Dashboard" subtitle={today} />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Métricas principais */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label="Vendas hoje"
              value={fmt(metrics.salesToday)}
              sub="pedidos fechados"
            />
            <MetricCard
              label="Pedidos"
              value={String(metrics.ordersToday)}
              sub="finalizados hoje"
            />
            <MetricCard
              label="Ticket médio"
              value={fmt(metrics.avgTicket)}
              sub="por pedido"
            />
            <MetricCard
              label="Mesas ocupadas"
              value={`${tablesOccupied} / ${tables.length}`}
              sub={`${occupancy}% de ocupação`}
            />
          </div>

          {/* Vendas por hora */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <p className="mb-4 text-sm font-semibold text-gray-700">Vendas por hora (hoje)</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={metrics.salesByHour} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor="#f97316" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `R$${v}`}
                  width={48}
                />
                <Tooltip
                  formatter={(v: number) => [fmt(v), 'Vendas']}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#grad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Top produtos */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <p className="mb-4 text-sm font-semibold text-gray-700">Produtos mais pedidos (hoje)</p>
              {metrics.topProducts.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum pedido fechado ainda</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={metrics.topProducts}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v: number) => [v, 'Unidades']}
                      contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }}
                    />
                    <Bar dataKey="qty" fill="#f97316" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Status das mesas */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <p className="mb-4 text-sm font-semibold text-gray-700">Status das mesas</p>
              <div className="space-y-3">
                {[
                  { label: 'Livres',    count: tablesFree,    color: 'bg-green-400',  pct: tables.length ? (tablesFree / tables.length) * 100 : 0 },
                  { label: 'Ocupadas',  count: tablesOccupied, color: 'bg-amber-400', pct: occupancy },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-gray-600">{row.label}</span>
                      <span className="font-medium text-gray-700">{row.count} mesas ({Math.round(row.pct)}%)</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-all ${row.color}`}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Lista de mesas ocupadas */}
              <div className="mt-4 flex flex-wrap gap-2">
                {tables
                  .filter((t) => t.status !== 'free')
                  .map((t) => (
                    <span
                      key={t.id}
                      className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                    >
                      Mesa {t.number}
                    </span>
                  ))}
                {tablesOccupied === 0 && (
                  <span className="text-xs text-gray-400">Nenhuma mesa ocupada</span>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </Layout>
  )
}
