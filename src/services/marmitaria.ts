import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, Timestamp,
  increment, type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  DailyDish, MarmitaOrder, MarmitaOrderItem,
  MarmitaOrderStatus, DeliveryRun,
} from '@/types'

// ─── Pratos do Dia ────────────────────────────────────────────────────────────

export function subscribeDailyDishes(
  restaurantId: string,
  date: string,
  callback: (dishes: DailyDish[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'daily_dishes'),
    where('restaurantId', '==', restaurantId),
    orderBy('createdAt', 'asc'),
  )
  return onSnapshot(q, (snap) => {
    const all = snap.docs.map((d) => ({
      id: d.id, ...d.data(),
      createdAt: (d.data().createdAt as Timestamp).toDate(),
    }) as DailyDish)
    callback(all.filter((d) => d.date === date))
  })
}

export async function createDailyDish(
  restaurantId: string,
  data: Omit<DailyDish, 'id' | 'restaurantId' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'daily_dishes'), {
    ...data,
    stock: data.stock ?? null,
    restaurantId,
    createdAt: Timestamp.now(),
  })
  return ref.id
}

export async function updateDailyDish(
  dishId: string,
  data: Partial<Pick<DailyDish, 'name' | 'description' | 'price' | 'active' | 'stock' | 'sizes' | 'productId'>>,
) {
  await updateDoc(doc(db, 'daily_dishes', dishId), data)
}

export async function deleteDailyDish(dishId: string) {
  await deleteDoc(doc(db, 'daily_dishes', dishId))
}

// Decrementa estoque quando pedido é criado
export async function decrementDishStock(dishId: string, qty: number) {
  await updateDoc(doc(db, 'daily_dishes', dishId), {
    stock: increment(-qty),
  })
}

// ─── Pedidos Marmitaria ───────────────────────────────────────────────────────

export function subscribeMarmitaOrders(
  restaurantId: string,
  statusFilter: MarmitaOrderStatus[] | undefined,
  callback: (orders: MarmitaOrder[]) => void,
): Unsubscribe {
  const q = statusFilter?.length
    ? query(
        collection(db, 'marmita_orders'),
        where('restaurantId', '==', restaurantId),
        where('status', 'in', statusFilter),
        orderBy('createdAt', 'desc'),
      )
    : query(
        collection(db, 'marmita_orders'),
        where('restaurantId', '==', restaurantId),
        orderBy('createdAt', 'desc'),
      )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({
      id: d.id, ...d.data(),
      createdAt: (d.data().createdAt as Timestamp).toDate(),
    }) as MarmitaOrder))
  })
}

export async function createMarmitaOrder(
  restaurantId: string,
  order: Omit<MarmitaOrder, 'id' | 'restaurantId' | 'createdAt' | 'status'>,
  items: Omit<MarmitaOrderItem, 'id' | 'marmitaOrderId'>[],
): Promise<string> {
  const sanitized = Object.fromEntries(
    Object.entries(order).filter(([, v]) => v !== undefined),
  )
  const orderRef = await addDoc(collection(db, 'marmita_orders'), {
    ...sanitized, restaurantId,
    status: 'new' as MarmitaOrderStatus,
    createdAt: Timestamp.now(),
  })
  await Promise.all(
    items.map((item) =>
      addDoc(collection(db, 'marmita_order_items'), {
        ...item, marmitaOrderId: orderRef.id,
      }),
    ),
  )
  // Decrementa estoque dos pratos
  await Promise.all(
    items
      .filter((i) => i.dishId)
      .map((i) => decrementDishStock(i.dishId, i.qty)),
  )
  return orderRef.id
}

export async function updateMarmitaOrderStatus(
  orderId: string,
  status: MarmitaOrderStatus,
  extra?: { deliveryUserId?: string; deliveryName?: string },
) {
  await updateDoc(doc(db, 'marmita_orders', orderId), {
    status,
    ...(extra ?? {}),
  })
}

export function subscribeMarmitaOrderItems(
  marmitaOrderId: string,
  callback: (items: MarmitaOrderItem[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'marmita_order_items'),
    where('marmitaOrderId', '==', marmitaOrderId),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MarmitaOrderItem))
  })
}

// ─── Entregador / Corridas ────────────────────────────────────────────────────

export async function createDeliveryRun(
  run: Omit<DeliveryRun, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'delivery_runs'), {
    ...run,
    createdAt: Timestamp.now(),
  })
  return ref.id
}

export async function completeDeliveryRun(runId: string) {
  await updateDoc(doc(db, 'delivery_runs', runId), {
    status:      'delivered',
    deliveredAt: Timestamp.now(),
  })
}

export function subscribeDeliveryRuns(
  restaurantId: string,
  deliveryUserId: string | null,
  callback: (runs: DeliveryRun[]) => void,
): Unsubscribe {
  const q = deliveryUserId
    ? query(
        collection(db, 'delivery_runs'),
        where('restaurantId', '==', restaurantId),
        where('deliveryUserId', '==', deliveryUserId),
        orderBy('createdAt', 'desc'),
      )
    : query(
        collection(db, 'delivery_runs'),
        where('restaurantId', '==', restaurantId),
        orderBy('createdAt', 'desc'),
      )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({
      id: d.id, ...d.data(),
      createdAt:   (d.data().createdAt   as Timestamp).toDate(),
      deliveredAt: d.data().deliveredAt
        ? (d.data().deliveredAt as Timestamp).toDate()
        : undefined,
    }) as DeliveryRun))
  })
}

// ─── Dashboard marmitaria ─────────────────────────────────────────────────────

export function subscribeMarmitaDashboard(
  restaurantId: string,
  callback: (data: { salesToday: number; ordersToday: number }) => void,
): Unsubscribe {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const q = query(
    collection(db, 'marmita_orders'),
    where('restaurantId', '==', restaurantId),
    where('createdAt', '>=', Timestamp.fromDate(start)),
  )
  return onSnapshot(q, (snap) => {
    const delivered = snap.docs.map((d) => d.data()).filter((o) => o.status === 'delivered')
    callback({
      salesToday:  delivered.reduce((s, o) => s + (o.total ?? 0), 0),
      ordersToday: delivered.length,
    })
  })
}
