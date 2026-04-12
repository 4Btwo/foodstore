/**
 * printQueue.ts — Fila de impressão no Firestore
 *
 * Dois alvos: 'kitchen' (cozinha) e 'central' (atendimento)
 *
 * Regras de criação de jobs por evento:
 *
 *  Balcão confirmado  → kitchen(kitchen_prep) + central(balcao_retirada)
 *  Online confirmado  → kitchen(kitchen_prep) + central(online_control)
 *  Mesa confirmada    → kitchen(kitchen_prep)
 *  Mesa fechada+pago  → central(mesa_bill) ou central(financial)
 *  Marmita confirmada → kitchen(kitchen_prep)
 */

import {
  collection, doc, addDoc, updateDoc, onSnapshot,
  query, where, orderBy, Timestamp, getDocs,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { UnifiedOrder } from '@/types'
import type { PrintJob, PrintJobStatus, PrinterTarget, TicketType } from '@/types/print'

// ─── Helper: remove campos undefined (Firestore rejeita undefined) ──────────────

function sanitize<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null)
  ) as Partial<T>
}

// ─── Anti-duplicação ──────────────────────────────────────────────────────────

async function jobExists(
  restaurantId: string,
  orderId: string,
  ticketType: TicketType,
): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(db, 'print_queue'),
      where('restaurantId', '==', restaurantId),
      where('orderId', '==', orderId),
      where('ticketType', '==', ticketType),
    )
  )
  return !snap.empty
}

// ─── Criação de jobs ──────────────────────────────────────────────────────────

interface JobPayload {
  restaurantId: string
  orderId:      string
  origin:       UnifiedOrder['origin']
  target:       PrinterTarget
  ticketType:   TicketType
  label:        string
  deliveryInfo?: string
  phone?:       string
  notes?:       string
  items:        UnifiedOrder['items']
  total:        number
  seqIndex?:    number
  paymentMethod?: string
  serviceRate?:   number
  createdAt:    Date
}

async function createJob(payload: JobPayload): Promise<string | null> {
  // Anti-duplicação por (orderId + ticketType)
  if (await jobExists(payload.restaurantId, payload.orderId, payload.ticketType)) {
    return null
  }

  // Sanitiza campos opcionais — Firestore rejeita undefined
  const { notes, phone, deliveryInfo, seqIndex, paymentMethod, serviceRate, ...required } = payload
  const optionals = sanitize({ notes, phone, deliveryInfo, seqIndex, paymentMethod, serviceRate })

  const ref = await addDoc(collection(db, 'print_queue'), {
    ...required,
    ...optionals,
    createdAt: Timestamp.fromDate(payload.createdAt),
    print: {
      status:     'pending' as PrintJobStatus,
      tentativas: 0,
      ultimoErro: null,
      timestamp:  null,
    },
  })
  return ref.id
}

// ─── Jobs específicos por evento ──────────────────────────────────────────────

/** Pedido confirmado → cria job(s) corretos para cada origem */
export async function createJobsOnConfirm(
  order: UnifiedOrder,
  seqIndex?: number,
): Promise<void> {
  const base = {
    restaurantId: order.restaurantId,
    orderId:      order.originId,
    origin:       order.origin,
    items:        order.items,
    total:        order.total,
    notes:        order.notes,
    phone:        order.phone,
    createdAt:    order.createdAt,
  }

  let label        = ''
  let deliveryInfo: string | undefined

  if (order.origin === 'mesa') {
    label = `Mesa ${order.tableNumber}`
  } else if (order.origin === 'balcao') {
    label = order.customerName ?? 'Balcão'
  } else if (order.origin === 'marmita' || order.origin === 'online') {
    label        = order.customerName ?? 'Cliente'
    deliveryInfo = order.deliveryType === 'delivery'
      ? `Entrega — ${order.address ?? ''}`
      : 'Retirada no local'
  }

  // SEMPRE: job de preparo na cozinha
  await createJob({
    ...base,
    label,
    deliveryInfo,
    target:     'kitchen',
    ticketType: 'kitchen_prep',
    seqIndex,
  })

  // Balcão → ticket de retirada na central
  if (order.origin === 'balcao') {
    await createJob({
      ...base,
      label,
      target:     'central',
      ticketType: 'balcao_retirada',
      seqIndex,
    })
  }

  // Online → controle de entrega/retirada na central
  if (order.origin === 'online') {
    await createJob({
      ...base,
      label,
      deliveryInfo,
      target:     'central',
      ticketType: 'online_control',
    })
  }
}

/** Mesa fechada → cupom financeiro na central */
export async function createBillJob(
  order: UnifiedOrder,
  paymentMethod: string,
  serviceRate: number,
): Promise<string | null> {
  return createJob({
    restaurantId:  order.restaurantId,
    orderId:       order.originId,
    origin:        order.origin,
    target:        'central',
    ticketType:    'financial',
    label:         order.origin === 'mesa' ? `Mesa ${order.tableNumber}` : (order.customerName ?? ''),
    notes:         order.notes,
    items:         order.items,
    total:         order.total,
    paymentMethod,
    serviceRate,
    createdAt:     order.createdAt,
  })
}

/** Conta da mesa (sem pagamento) → para o cliente ver o que consumiu */
export async function createMesaBillJob(
  order: UnifiedOrder,
  serviceRate: number,
  items: Array<{ name: string; qty: number; price: number; size?: string }>,
): Promise<string | null> {
  return createJob({
    restaurantId: order.restaurantId,
    orderId:      order.originId + '_bill',   // sufixo para não colidir com o prep
    origin:       order.origin,
    target:       'central',
    ticketType:   'mesa_bill',
    label:        `Mesa ${order.tableNumber}`,
    notes:        order.notes,
    items,
    total:        items.reduce((s, i) => s + i.price * i.qty, 0),
    serviceRate,
    createdAt:    order.createdAt,
  })
}

// ─── Atualizar estado ─────────────────────────────────────────────────────────

export async function markPrinting(jobId: string) {
  await updateDoc(doc(db, 'print_queue', jobId), { 'print.status': 'printing' })
}

export async function markPrinted(jobId: string, deviceName: string) {
  await updateDoc(doc(db, 'print_queue', jobId), {
    'print.status':    'printed',
    'print.timestamp': Date.now(),
    'print.device':    deviceName,
    'print.ultimoErro': null,
  })
}

export async function markError(jobId: string, errorMsg: string, tentativas: number) {
  await updateDoc(doc(db, 'print_queue', jobId), {
    'print.status':     'error',
    'print.ultimoErro': errorMsg,
    'print.tentativas': tentativas,
  })
}

export async function markCancelled(jobId: string) {
  await updateDoc(doc(db, 'print_queue', jobId), { 'print.status': 'cancelled' })
}

export async function resetToPending(jobId: string) {
  await updateDoc(doc(db, 'print_queue', jobId), {
    'print.status':    'pending',
    'print.ultimoErro': null,
  })
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

function docToJob(d: any): PrintJob {
  const data = d.data()
  return {
    id:           d.id,
    restaurantId: data.restaurantId,
    orderId:      data.orderId,
    origin:       data.origin,
    target:       data.target,
    ticketType:   data.ticketType,
    label:        data.label,
    deliveryInfo: data.deliveryInfo,
    phone:        data.phone,
    notes:        data.notes,
    items:        data.items ?? [],
    total:        data.total ?? 0,
    seqIndex:     data.seqIndex,
    paymentMethod: data.paymentMethod,
    serviceRate:   data.serviceRate,
    createdAt:    (data.createdAt as Timestamp).toDate(),
    print:        data.print,
  }
}

/** Fila pendente/erro filtrada por target (kitchen ou central) */
export function subscribePrintQueue(
  restaurantId: string,
  target: PrinterTarget,
  cb: (jobs: PrintJob[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'print_queue'),
    where('restaurantId', '==', restaurantId),
    where('target', '==', target),
    where('print.status', 'in', ['pending', 'error']),
    orderBy('createdAt', 'asc'),
  )
  return onSnapshot(q, (snap) => cb(snap.docs.map(docToJob)))
}

/** Histórico recente (2h) por target */
export function subscribeRecentJobs(
  restaurantId: string,
  target: PrinterTarget,
  cb: (jobs: PrintJob[]) => void,
): Unsubscribe {
  const twoHoursAgo = Timestamp.fromMillis(Date.now() - 2 * 60 * 60 * 1000)
  const q = query(
    collection(db, 'print_queue'),
    where('restaurantId', '==', restaurantId),
    where('target', '==', target),
    where('createdAt', '>=', twoHoursAgo),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => cb(snap.docs.map(docToJob)))
}
