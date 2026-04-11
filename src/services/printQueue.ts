/**
 * printQueue.ts
 *
 * Gerencia a fila de impressão no Firestore.
 *
 * Collection: print_queue/{jobId}
 *
 * Responsabilidades:
 *  - Criar jobs quando novos pedidos chegam (deduplicação via orderId)
 *  - Atualizar estado: pending → printing → printed | error
 *  - Retry automático com limite de tentativas
 *  - Observar fila em tempo real (onSnapshot)
 */

import {
  collection, doc, addDoc, updateDoc, onSnapshot,
  query, where, orderBy, Timestamp, getDocs,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { UnifiedOrder } from '@/types'
import type { PrintJob, PrintJobStatus } from '@/types/print'

// ─── Criar job de impressão ───────────────────────────────────────────────────

/**
 * Cria um PrintJob no Firestore a partir de um UnifiedOrder.
 * Antes de criar, verifica se já existe job para este orderId (anti-duplicação).
 */
export async function createPrintJob(order: UnifiedOrder): Promise<string | null> {
  // Anti-duplicação: verifica se já existe job para este orderId
  const existing = await getDocs(
    query(
      collection(db, 'print_queue'),
      where('restaurantId', '==', order.restaurantId),
      where('orderId', '==', order.originId),
    ),
  )
  if (!existing.empty) return null  // já existe — não duplica

  // Constrói label e deliveryInfo
  let label = ''
  let deliveryInfo: string | undefined

  if (order.origin === 'mesa') {
    label = `Mesa ${order.tableNumber}`
  } else if (order.origin === 'balcao') {
    label = order.customerName ?? 'Balcão'
    deliveryInfo = 'Retirada no Balcão'
  } else if (order.origin === 'marmita') {
    label = order.customerName ?? 'Cliente'
    deliveryInfo = order.deliveryType === 'delivery'
      ? `Entrega — ${order.address ?? 'Endereço não informado'}`
      : 'Retirada'
  } else if (order.origin === 'online') {
    label = order.customerName ?? 'Online'
    deliveryInfo = order.deliveryType === 'delivery'
      ? `Entrega — ${order.address ?? 'Endereço não informado'}`
      : 'Retirada'
  }

  const jobData = {
    restaurantId: order.restaurantId,
    orderId:      order.originId,
    origin:       order.origin,
    label,
    ...(deliveryInfo ? { deliveryInfo } : {}),
    ...(order.notes   ? { notes: order.notes }    : {}),
    ...(order.phone   ? { phone: order.phone }    : {}),
    items:        order.items,
    total:        order.total,
    createdAt:    Timestamp.fromDate(order.createdAt),
    print: {
      status:     'pending' as PrintJobStatus,
      tentativas: 0,
      ultimoErro: null,
      timestamp:  null,
    },
  }

  const ref = await addDoc(collection(db, 'print_queue'), jobData)
  return ref.id
}

// ─── Atualizar estado de impressão ───────────────────────────────────────────

export async function markPrinting(jobId: string): Promise<void> {
  await updateDoc(doc(db, 'print_queue', jobId), {
    'print.status': 'printing',
  })
}

export async function markPrinted(jobId: string, deviceName: string): Promise<void> {
  await updateDoc(doc(db, 'print_queue', jobId), {
    'print.status':    'printed',
    'print.timestamp': Date.now(),
    'print.device':    deviceName,
    'print.ultimoErro': null,
  })
}

export async function markError(
  jobId: string,
  errorMsg: string,
  tentativas: number,
): Promise<void> {
  await updateDoc(doc(db, 'print_queue', jobId), {
    'print.status':     'error',
    'print.ultimoErro': errorMsg,
    'print.tentativas': tentativas,
  })
}

export async function markCancelled(jobId: string): Promise<void> {
  await updateDoc(doc(db, 'print_queue', jobId), {
    'print.status': 'cancelled',
  })
}

export async function resetToPending(jobId: string): Promise<void> {
  await updateDoc(doc(db, 'print_queue', jobId), {
    'print.status':    'pending',
    'print.ultimoErro': null,
  })
}

// ─── Observar fila pendente ───────────────────────────────────────────────────

/**
 * Retorna unsub. Notifica apenas jobs com status pending ou error (para retry).
 */
export function subscribePrintQueue(
  restaurantId: string,
  cb: (jobs: PrintJob[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'print_queue'),
    where('restaurantId', '==', restaurantId),
    where('print.status', 'in', ['pending', 'error']),
    orderBy('createdAt', 'asc'),
  )

  return onSnapshot(q, (snap) => {
    const jobs: PrintJob[] = snap.docs.map((d) => {
      const data = d.data()
      return {
        id:           d.id,
        restaurantId: data.restaurantId,
        orderId:      data.orderId,
        origin:       data.origin,
        label:        data.label,
        deliveryInfo: data.deliveryInfo,
        notes:        data.notes,
        items:        data.items ?? [],
        total:        data.total ?? 0,
        createdAt:    (data.createdAt as Timestamp).toDate(),
        print:        data.print,
      } as PrintJob
    })
    cb(jobs)
  })
}

/**
 * Observa jobs recentes (últimas 2h) para exibir no painel.
 */
export function subscribeRecentJobs(
  restaurantId: string,
  cb: (jobs: PrintJob[]) => void,
): Unsubscribe {
  const twoHoursAgo = Timestamp.fromMillis(Date.now() - 2 * 60 * 60 * 1000)

  const q = query(
    collection(db, 'print_queue'),
    where('restaurantId', '==', restaurantId),
    where('createdAt', '>=', twoHoursAgo),
    orderBy('createdAt', 'desc'),
  )

  return onSnapshot(q, (snap) => {
    const jobs: PrintJob[] = snap.docs.map((d) => {
      const data = d.data()
      return {
        id:           d.id,
        restaurantId: data.restaurantId,
        orderId:      data.orderId,
        origin:       data.origin,
        label:        data.label,
        deliveryInfo: data.deliveryInfo,
        notes:        data.notes,
        items:        data.items ?? [],
        total:        data.total ?? 0,
        createdAt:    (data.createdAt as Timestamp).toDate(),
        print:        data.print,
      } as PrintJob
    })
    cb(jobs)
  })
}
