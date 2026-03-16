import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Order, OrderItem, OrderStatus, Table, TableStatus } from '@/types'

// ─── Tables ───────────────────────────────────────────────────────────────────

export function subscribeTables(
  restaurantId: string,
  callback: (tables: Table[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'tables'),
    where('restaurantId', '==', restaurantId),
    orderBy('number'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Table))
  })
}

export async function updateTableStatus(tableId: string, status: TableStatus) {
  await updateDoc(doc(db, 'tables', tableId), { status })
}

async function setTableStatusByNumber(
  restaurantId: string,
  tableNumber: number,
  status: TableStatus,
) {
  const q    = query(
    collection(db, 'tables'),
    where('restaurantId', '==', restaurantId),
    where('number', '==', tableNumber),
  )
  const snap = await getDocs(q)
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { status })))
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export function subscribeOrders(
  restaurantId: string,
  callback: (orders: Order[]) => void,
  statusFilter?: OrderStatus[],
): Unsubscribe {
  const q = statusFilter?.length
    ? query(
        collection(db, 'orders'),
        where('restaurantId', '==', restaurantId),
        where('status', 'in', statusFilter),
        orderBy('createdAt', 'desc'),
      )
    : query(
        collection(db, 'orders'),
        where('restaurantId', '==', restaurantId),
        orderBy('createdAt', 'desc'),
      )

  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: (d.data().createdAt as Timestamp).toDate(),
      }) as Order),
    )
  })
}

export async function createOrder(
  restaurantId: string,
  tableNumber: number,
  items: Omit<OrderItem, 'id' | 'orderId'>[],
): Promise<string> {
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0)

  const orderRef = await addDoc(collection(db, 'orders'), {
    restaurantId,
    tableNumber,
    status:    'new' as OrderStatus,
    createdAt: Timestamp.now(),
    total,
  })

  await Promise.all(
    items.map((item) =>
      addDoc(collection(db, 'order_items'), {
        orderId:   orderRef.id,
        productId: item.productId,
        name:      item.name,
        qty:       item.qty,
        price:     item.price,
      }),
    ),
  )

  await setTableStatusByNumber(restaurantId, tableNumber, 'open')
  return orderRef.id
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
) {
  await updateDoc(doc(db, 'orders', orderId), { status })
}

/**
 * Fecha TODOS os pedidos de uma mesa de uma vez e libera a mesa.
 * Use este no Caixa ao fechar a conta.
 */
export async function closeTableOrders(
  restaurantId: string,
  tableNumber: number,
  orderIds: string[],
): Promise<void> {
  // 1. Fecha todos os pedidos simultaneamente
  await Promise.all(
    orderIds.map((id) => updateDoc(doc(db, 'orders', id), { status: 'closed' })),
  )
  // 2. Libera a mesa diretamente — sem precisar verificar
  await setTableStatusByNumber(restaurantId, tableNumber, 'free')
}

// ─── Order Items ──────────────────────────────────────────────────────────────

export function subscribeOrderItems(
  orderId: string,
  callback: (items: OrderItem[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'order_items'), where('orderId', '==', orderId))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OrderItem))
  })
}

// ─── Table Calls ─────────────────────────────────────────────────────────────

export async function callWaiter(restaurantId: string, tableNumber: number) {
  await addDoc(collection(db, 'tableCalls'), {
    restaurantId,
    tableNumber,
    createdAt: Timestamp.now(),
    status:    'pending',
  })
}
