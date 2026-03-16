import { useEffect, useState } from 'react'
import { subscribeDashboard, type DashboardMetrics } from '@/services/dashboard'
import { useAuth } from './useAuth'
import { useTables } from './useTables'

const EMPTY: DashboardMetrics = {
  salesToday:  0,
  ordersToday: 0,
  avgTicket:   0,
  tablesOpen:  0,
  salesByHour: [],
  topProducts: [],
}

export function useDashboard() {
  const { restaurantId }      = useAuth()
  const { tables }            = useTables()
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY)
  const [loading, setLoading] = useState(true)

  const tablesOpen = tables.filter((t) => t.status === 'open' || t.status === 'closing').length

  useEffect(() => {
    if (!restaurantId) return
    const unsub = subscribeDashboard(restaurantId, tablesOpen, (data) => {
      setMetrics(data)
      setLoading(false)
    })
    return unsub
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, tablesOpen])

  return { metrics, loading }
}
