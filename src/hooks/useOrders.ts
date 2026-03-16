import { useEffect, useState } from 'react'
import { subscribeOrders } from '@/services/orders'
import { useAuth } from './useAuth'
import type { Order, OrderStatus } from '@/types'

export function useOrders(statusFilter?: OrderStatus[]) {
  const { restaurantId } = useAuth()
  const [orders, setOrders]   = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!restaurantId) return
    const unsub = subscribeOrders(restaurantId, (data) => {
      setOrders(data)
      setLoading(false)
    }, statusFilter)
    return unsub
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  return { orders, loading }
}
