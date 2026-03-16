import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Order } from '@/types'

export interface DashboardMetrics {
  salesToday:    number
  ordersToday:   number
  avgTicket:     number
  tablesOpen:    number
  salesByHour:   { hour: string; total: number }[]
  topProducts:   { name: string; qty: number }[]
}

function startOfToday(): Timestamp {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return Timestamp.fromDate(d)
}

export function subscribeDashboard(
  restaurantId: string,
  tablesOpen: number,
  callback: (metrics: DashboardMetrics) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'orders'),
    where('restaurantId', '==', restaurantId),
    where('createdAt', '>=', startOfToday()),
    orderBy('createdAt', 'asc'),
  )

  return onSnapshot(q, async (snap) => {
    const orders = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: (d.data().createdAt as Timestamp).toDate(),
    })) as Order[]

    const closedOrders = orders.filter((o) => o.status === 'closed')
    const salesToday   = closedOrders.reduce((s, o) => s + o.total, 0)
    const ordersToday  = closedOrders.length
    const avgTicket    = ordersToday > 0 ? salesToday / ordersToday : 0

    // Vendas por hora (0–23)
    const hourMap: Record<number, number> = {}
    for (let h = 7; h <= 23; h++) hourMap[h] = 0
    closedOrders.forEach((o) => {
      const h = new Date(o.createdAt).getHours()
      if (h in hourMap) hourMap[h] += o.total
    })
    const salesByHour = Object.entries(hourMap).map(([h, total]) => ({
      hour:  `${h}h`,
      total: parseFloat(total.toFixed(2)),
    }))

    // Top produtos — precisa buscar order_items de hoje
    const itemSnap = await Promise.all(
      orders.map((o) =>
        import('firebase/firestore').then(({ getDocs, query: q2, collection: col, where: w }) =>
          getDocs(q2(col(db, 'order_items'), w('orderId', '==', o.id))),
        ),
      ),
    )
    const productMap: Record<string, number> = {}
    itemSnap.forEach((s) =>
      s.docs.forEach((d) => {
        const item = d.data()
        productMap[item.name] = (productMap[item.name] ?? 0) + item.qty
      }),
    )
    const topProducts = Object.entries(productMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, qty]) => ({ name, qty }))

    callback({ salesToday, ordersToday, avgTicket, tablesOpen, salesByHour, topProducts })
  })
}
