import type { OrderStatus } from '@/types'

const CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  new:       { label: 'Novo',       className: 'bg-blue-50 text-blue-700' },
  preparing: { label: 'Preparando', className: 'bg-amber-50 text-amber-700' },
  ready:     { label: 'Pronto',     className: 'bg-green-50 text-green-700' },
  closed:    { label: 'Fechado',    className: 'bg-gray-100 text-gray-500' },
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, className } = CONFIG[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
