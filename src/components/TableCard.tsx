import type { Table } from '@/types'

const STATUS_CONFIG = {
  free:    { label: 'Livre',     bg: 'bg-green-50',  border: 'border-green-200', dot: 'bg-green-400', text: 'text-green-700' },
  open:    { label: 'Ocupada',   bg: 'bg-amber-50',  border: 'border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700' },
  closing: { label: 'Fechando',  bg: 'bg-red-50',    border: 'border-red-200',   dot: 'bg-red-400',   text: 'text-red-700'   },
}

interface Props {
  table:    Table
  onClick?: (table: Table) => void
}

export function TableCard({ table, onClick }: Props) {
  const cfg = STATUS_CONFIG[table.status]

  return (
    <button
      onClick={() => onClick?.(table)}
      className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-2 p-5 transition hover:scale-105 hover:shadow-md active:scale-100 ${cfg.bg} ${cfg.border}`}
    >
      <span className="text-2xl font-bold text-gray-700">{table.number}</span>
      <span className={`flex items-center gap-1.5 text-xs font-medium ${cfg.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </span>
    </button>
  )
}
