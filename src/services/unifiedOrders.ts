/**
 * Central de Pedidos — serviço unificado
 *
 * Normaliza pedidos de 4 origens diferentes em um único formato
 * e fornece actions centralizadas para cada tipo.
 *
 * Origens:
 *   mesa    → collection "orders" + "order_items"
 *   balcao  → collection "marmita_orders" com deliveryType=pickup e sem address
 *   marmita → collection "marmita_orders" com deliveryType=pickup|delivery
 *   online  → collection "online_orders" + "online_order_items"
 */

import {
  collection, doc, addDoc, updateDoc, onSnapshot,
  query, where, orderBy, Timestamp, getDocs,
  writeBatch, increment,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  UnifiedOrder, UnifiedOrderStatus, UnifiedOrderOrigin,
  Order, OrderItem, MarmitaOrder, MarmitaOrderItem,
  OnlineOrder, OnlineOrderItem, Product, AppUser,
} from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toUnifiedStatus(
  origin: UnifiedOrderOrigin,
  raw: string,
): UnifiedOrderStatus {
  const map: Record<string, UnifiedOrderStatus> = {
    // mesa (orders)
    new:              'pending',
    preparing:        'preparing',
    ready:            'ready',
    closed:           'closed',
    // marmita / online
    pending:          'pending',
    confirmed:        'confirmed',
    out_for_delivery: 'out_for_delivery',
    delivered:        'delivered',
    cancelled:        'cancelled',
  }
  return map[raw] ?? 'pending'
}

// ─── Subscriptions (leitura de cada collection) ───────────────────────────────

function subscribeMesaOrders(
  restaurantId: string,
  cb: (orders: UnifiedOrder[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'orders'),
    where('restaurantId', '==', restaurantId),
    where('status', 'in', ['new', 'preparing', 'ready']),
    orderBy('createdAt', 'desc'),
  )
  const itemsCache: Record<string, UnifiedOrderItem[]> = {}
  const unsubs: Unsubscribe[] = []
  let orders: Order[] = []

  function emit() {
    cb(orders.map((o) => ({
      id:           `mesa__${o.id}`,
      origin:       'mesa',
      originId:     o.id,
      restaurantId: o.restaurantId,
      tableNumber:  o.tableNumber,
      status:       toUnifiedStatus('mesa', o.status),
      total:        o.total,
      items:        itemsCache[o.id] ?? [],
      createdAt:    o.createdAt,
    })))
  }

  const unsub = onSnapshot(q, (snap) => {
    orders = snap.docs.map((d) => ({
      id: d.id, ...d.data(),
      createdAt: (d.data().createdAt as Timestamp).toDate(),
    }) as Order)

    // Subscribe items for each order
    orders.forEach((o) => {
      if (itemsCache[o.id]) return
      itemsCache[o.id] = []
      const iq = query(collection(db, 'order_items'), where('orderId', '==', o.id))
      const iu = onSnapshot(iq, (isnap) => {
        itemsCache[o.id] = isnap.docs.map((d) => {
          const x = d.data() as OrderItem
          return { name: x.name, qty: x.qty, price: x.price, ...(x.size ? { size: x.size } : {}) }
        })
        emit()
      })
      unsubs.push(iu)
    })
    emit()
  })

  return () => { unsub(); unsubs.forEach((u) => u()) }
}

function subscribeMarmitaOrdersUnified(
  restaurantId: string,
  cb: (orders: UnifiedOrder[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'marmita_orders'),
    where('restaurantId', '==', restaurantId),
    where('status', 'in', ['new', 'preparing', 'ready', 'out_for_delivery']),
    orderBy('createdAt', 'desc'),
  )
  const itemsCache: Record<string, UnifiedOrderItem[]> = {}
  const unsubs: Unsubscribe[] = []
  let orders: MarmitaOrder[] = []

  function emit() {
    cb(orders.map((o) => ({
      id:           `marmita__${o.id}`,
      origin:       o.deliveryType === 'pickup' && !o.address ? 'balcao' : 'marmita',
      originId:     o.id,
      restaurantId: o.restaurantId,
      customerName: o.customerName,
      phone:        o.phone,
      address:      o.address,
      notes:        o.notes,
      deliveryType: o.deliveryType,
      deliveryUserId: o.deliveryUserId,
      deliveryName:   o.deliveryName,
      status:       toUnifiedStatus('marmita', o.status),
      total:        o.total,
      items:        itemsCache[o.id] ?? [],
      createdAt:    o.createdAt,
    })))
  }

  const unsub = onSnapshot(q, (snap) => {
    orders = snap.docs.map((d) => ({
      id: d.id, ...d.data(),
      createdAt: (d.data().createdAt as Timestamp).toDate(),
    }) as MarmitaOrder)

    orders.forEach((o) => {
      if (itemsCache[o.id]) return
      itemsCache[o.id] = []
      const iq = query(collection(db, 'marmita_order_items'), where('marmitaOrderId', '==', o.id))
      const iu = onSnapshot(iq, (isnap) => {
        itemsCache[o.id] = isnap.docs.map((d) => {
          const x = d.data() as MarmitaOrderItem
          return { name: x.name, qty: x.qty, price: x.price, ...(x.size ? { size: x.size } : {}) }
        })
        emit()
      })
      unsubs.push(iu)
    })
    emit()
  })

  return () => { unsub(); unsubs.forEach((u) => u()) }
}

function subscribeOnlineOrdersUnified(
  restaurantId: string,
  cb: (orders: UnifiedOrder[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'online_orders'),
    where('restaurantId', '==', restaurantId),
    where('status', 'in', ['new', 'preparing', 'ready', 'out_for_delivery']),
    orderBy('createdAt', 'desc'),
  )
  const itemsCache: Record<string, UnifiedOrderItem[]> = {}
  const unsubs: Unsubscribe[] = []
  let orders: OnlineOrder[] = []

  function emit() {
    cb(orders.map((o) => ({
      id:           `online__${o.id}`,
      origin:       'online',
      originId:     o.id,
      restaurantId: o.restaurantId,
      customerName: o.customerName,
      phone:        o.phone,
      address:      o.address,
      notes:        o.notes,
      deliveryType: o.deliveryType,
      status:       toUnifiedStatus('online', o.status),
      total:        o.total,
      items:        itemsCache[o.id] ?? [],
      createdAt:    o.createdAt,
    })))
  }

  const unsub = onSnapshot(q, (snap) => {
    orders = snap.docs.map((d) => ({
      id: d.id, ...d.data(),
      createdAt: (d.data().createdAt as Timestamp).toDate(),
    }) as OnlineOrder)

    orders.forEach((o) => {
      if (itemsCache[o.id]) return
      itemsCache[o.id] = []
      const iq = query(collection(db, 'online_order_items'), where('onlineOrderId', '==', o.id))
      const iu = onSnapshot(iq, (isnap) => {
        itemsCache[o.id] = isnap.docs.map((d) => {
          const x = d.data() as OnlineOrderItem
          return { name: x.name, qty: x.qty, price: x.price, ...(x.size ? { size: x.size } : {}) }
        })
        emit()
      })
      unsubs.push(iu)
    })
    emit()
  })

  return () => { unsub(); unsubs.forEach((u) => u()) }
}

// ─── Subscribe principal (merge das 3 origens) ────────────────────────────────

export function subscribeAllOrders(
  restaurantId: string,
  cb: (orders: UnifiedOrder[]) => void,
): Unsubscribe {
  let mesaOrders:    UnifiedOrder[] = []
  let marmitaOrders: UnifiedOrder[] = []
  let onlineOrders:  UnifiedOrder[] = []

  function merge() {
    const all = [...mesaOrders, ...marmitaOrders, ...onlineOrders]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    cb(all)
  }

  const u1 = subscribeMesaOrders(restaurantId, (o) => { mesaOrders = o; merge() })
  const u2 = subscribeMarmitaOrdersUnified(restaurantId, (o) => { marmitaOrders = o; merge() })
  const u3 = subscribeOnlineOrdersUnified(restaurantId, (o) => { onlineOrders = o; merge() })

  return () => { u1(); u2(); u3() }
}

// ─── Actions unificadas ───────────────────────────────────────────────────────

/** Confirma pedido → vai pra cozinha */
export async function confirmOrder(order: UnifiedOrder): Promise<void> {
  if (order.origin === 'mesa') {
    await updateDoc(doc(db, 'orders', order.originId), { status: 'preparing' })
  } else if (order.origin === 'marmita' || order.origin === 'balcao') {
    await updateDoc(doc(db, 'marmita_orders', order.originId), { status: 'preparing' })
  } else if (order.origin === 'online') {
    await updateDoc(doc(db, 'online_orders', order.originId), { status: 'preparing' })
  }
}

/** Avança status (confirmar pronto, confirmar entrega etc) */
export async function advanceOrder(
  order: UnifiedOrder,
  extra?: { deliveryUserId?: string; deliveryName?: string },
): Promise<void> {
  const nextMesa: Record<string, string> = {
    pending: 'preparing', preparing: 'ready', ready: 'closed',
  }
  const nextMarmita: Record<string, string> = {
    pending: 'preparing', preparing: 'ready',
    ready: order.deliveryType === 'delivery' ? 'out_for_delivery' : 'delivered',
    out_for_delivery: 'delivered',
  }
  const nextOnline: Record<string, string> = {
    pending: 'preparing', preparing: 'ready',
    ready: order.deliveryType === 'delivery' ? 'out_for_delivery' : 'delivered',
    out_for_delivery: 'delivered',
  }

  if (order.origin === 'mesa') {
    const next = nextMesa[order.status]
    if (!next) return
    await updateDoc(doc(db, 'orders', order.originId), { status: next })
    if (next === 'closed' && order.tableNumber) {
      // libera a mesa se todos os pedidos da mesa estiverem fechados
      const q = query(
        collection(db, 'orders'),
        where('restaurantId', '==', order.restaurantId),
        where('tableNumber', '==', order.tableNumber),
        where('status', 'in', ['new', 'preparing', 'ready']),
      )
      const snap = await getDocs(q)
      if (snap.empty) {
        const tq = query(
          collection(db, 'tables'),
          where('restaurantId', '==', order.restaurantId),
          where('number', '==', order.tableNumber),
        )
        const tsnap = await getDocs(tq)
        await Promise.all(tsnap.docs.map((d) => updateDoc(d.ref, { status: 'free' })))
      }
    }
  } else if (order.origin === 'marmita' || order.origin === 'balcao') {
    const next = nextMarmita[order.status]
    if (!next) return
    await updateDoc(doc(db, 'marmita_orders', order.originId), {
      status: next,
      ...(extra ?? {}),
    })
    if (next === 'out_for_delivery' && extra?.deliveryUserId) {
      await addDoc(collection(db, 'delivery_runs'), {
        restaurantId:   order.restaurantId,
        deliveryUserId: extra.deliveryUserId,
        deliveryName:   extra.deliveryName ?? '',
        orderId:        order.originId,
        customerName:   order.customerName ?? '',
        address:        order.address ?? '',
        total:          order.total,
        status:         'assigned',
        createdAt:      Timestamp.now(),
      })
    }
  } else if (order.origin === 'online') {
    const next = nextOnline[order.status]
    if (!next) return
    await updateDoc(doc(db, 'online_orders', order.originId), {
      status: next,
      ...(extra ?? {}),
    })
  }
}

/** Cancela pedido */
export async function cancelOrder(order: UnifiedOrder): Promise<void> {
  if (order.origin === 'mesa') {
    await updateDoc(doc(db, 'orders', order.originId), { status: 'closed' })
  } else if (order.origin === 'marmita' || order.origin === 'balcao') {
    await updateDoc(doc(db, 'marmita_orders', order.originId), { status: 'cancelled' })
  } else if (order.origin === 'online') {
    await updateDoc(doc(db, 'online_orders', order.originId), { status: 'cancelled' })
  }
}

// ─── Criar pedido de balcão (product do cardápio) ─────────────────────────────
export async function createBalcaoOrder(
  restaurantId: string,
  items: Array<{ product: Product; qty: number; size?: string; unitPrice: number }>,
  info: { customerName?: string; notes?: string; phone?: string },
): Promise<string> {
  const total = items.reduce((s, i) => s + i.unitPrice * i.qty, 0)
  const orderRef = await addDoc(collection(db, 'marmita_orders'), {
    restaurantId,
    customerName: info.customerName || 'Balcão',
    deliveryType: 'pickup',
    phone:        info.phone    || null,
    notes:        info.notes   || null,
    status:       'new',
    total,
    createdAt:    Timestamp.now(),
  })
  await Promise.all(items.map((i) =>
    addDoc(collection(db, 'marmita_order_items'), {
      marmitaOrderId: orderRef.id,
      dishId:  i.product.id,
      name:    i.size ? `${i.product.name} (${i.size})` : i.product.name,
      qty:     i.qty,
      price:   i.unitPrice,
      ...(i.size ? { size: i.size } : {}),
    }),
  ))
  // Decrementa estoque
  await Promise.all(
    items
      .filter((i) => i.product.stock !== null && i.product.stock !== undefined)
      .map((i) => updateDoc(doc(db, 'products', i.product.id), { stock: increment(-i.qty) })),
  )
  return orderRef.id
}
