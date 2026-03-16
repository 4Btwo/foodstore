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

/** Busca o ID da mesa pelo número e atualiza o status */
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

  // Cria o pedido
  const orderRef = await addDoc(collection(db, 'orders'), {
    restaurantId,
    tableNumber,
    status:    'new' as OrderStatus,
    createdAt: Timestamp.now(),
    total,
  })

  // Cria os itens
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

  // Abre a mesa usando getDocs (correto — não usa onSnapshot)
  await setTableStatusByNumber(restaurantId, tableNumber, 'open')

  return orderRef.id
}

/**
 * Atualiza o status do pedido.
 * Quando fechado (closed), verifica se a mesa tem outros pedidos abertos.
 * Se não tiver, libera a mesa automaticamente.
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  restaurantId?: string,
  tableNumber?: number,
) {
  await updateDoc(doc(db, 'orders', orderId), { status })

  // Libera a mesa quando o pedido é fechado
  if (status === 'closed' && restaurantId && tableNumber !== undefined) {
    // Verifica se ainda há pedidos abertos nessa mesa
    const q = query(
      collection(db, 'orders'),
      where('restaurantId', '==', restaurantId),
      where('tableNumber', '==', tableNumber),
      where('status', 'in', ['new', 'preparing', 'ready']),
    )
    const snap = await getDocs(q)

    if (snap.empty) {
      // Nenhum pedido aberto → libera a mesa
      await setTableStatusByNumber(restaurantId, tableNumber, 'free')
    }
  }
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
