import { useEffect, useState } from 'react'
import { subscribeTables } from '@/services/orders'
import { useAuth } from './useAuth'
import type { Table } from '@/types'

export function useTables() {
  const { restaurantId } = useAuth()
  const [tables, setTables]   = useState<Table[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!restaurantId) return
    const unsub = subscribeTables(restaurantId, (data) => {
      setTables(data)
      setLoading(false)
    })
    return unsub
  }, [restaurantId])

  return { tables, loading }
}
