import { useEffect, useState } from 'react'
import { subscribeProducts } from '@/services/products'
import { useAuth } from './useAuth'
import type { Product } from '@/types'

export function useProducts() {
  const { restaurantId } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!restaurantId) return
    const unsub = subscribeProducts(restaurantId, (data) => {
      setProducts(data)
      setLoading(false)
    })
    return unsub
  }, [restaurantId])

  const byCategory = products.reduce<Record<string, Product[]>>((acc, p) => {
    acc[p.category] = [...(acc[p.category] ?? []), p]
    return acc
  }, {})

  return { products, byCategory, loading }
}
