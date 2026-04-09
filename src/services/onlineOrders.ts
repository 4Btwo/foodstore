import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  doc,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { OnlineOrder, OnlineOrderItem, OnlineOrderStatus } from '@/types'

// ─── Criar pedido online ──────────────────────────────────────────────────────

export async function createOnlineOrder(
  restaurantId: string,
  data: Omit<OnlineOrder, 'id' | 'restaurantId' | 'createdAt' | 'status'>,
  items: Omit<OnlineOrderItem, 'id' | 'onlineOrderId'>[],
): Promise<string> {
  try {
    const batch = writeBatch(db)

    // Cria referência do pedido
    const orderRef = doc(collection(db, 'online_orders'))

    // Remove campos undefined (Firestore não aceita)
    const cleanData = Object.fromEntries(
      Object.entries({ ...data, restaurantId, status: 'new' as OnlineOrderStatus, createdAt: Timestamp.now() })
        .filter(([, v]) => v !== undefined)
    )

    batch.set(orderRef, cleanData)
    // Adiciona itens no mesmo batch
    for (const item of items) {
      const itemRef = doc(collection(db, 'online_order_items'))
      batch.set(itemRef, {
        ...item,
        onlineOrderId: orderRef.id,
      })
    }

    await batch.commit()
    return orderRef.id

  } catch (err) {
    console.error('[createOnlineOrder] Erro ao salvar pedido:', err)
    throw err
  }
}

// ─── Subscrever pedidos online (painel admin) ─────────────────────────────────

export function subscribeOnlineOrders(
  restaurantId: string,
  callback: (orders: OnlineOrder[]) => void,
  statusFilter?: OnlineOrderStatus[],
): Unsubscribe {
  const q = statusFilter?.length
    ? query(
        collection(db, 'online_orders'),
        where('restaurantId', '==', restaurantId),
        where('status', 'in', statusFilter),
        orderBy('createdAt', 'desc'),
      )
    : query(
        collection(db, 'online_orders'),
        where('restaurantId', '==', restaurantId),
        orderBy('createdAt', 'desc'),
      )

  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: (d.data().createdAt as Timestamp).toDate(),
      }) as OnlineOrder),
    )
  })
}

// ─── Subscrever itens de um pedido online ─────────────────────────────────────

export function subscribeOnlineOrderItems(
  onlineOrderId: string,
  callback: (items: OnlineOrderItem[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'online_order_items'),
    where('onlineOrderId', '==', onlineOrderId),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OnlineOrderItem))
  })
}
