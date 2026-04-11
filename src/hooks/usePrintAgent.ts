/**
 * usePrintAgent.ts
 *
 * Hook que age como agente autônomo de impressão.
 *
 * Responsabilidades:
 *  1. Escuta pedidos novos via subscribeAllOrders → cria print_jobs
 *  2. Escuta print_queue (pending/error) → imprime automaticamente
 *  3. Gerencia máquina de estados: pending → printing → printed | error
 *  4. Retry automático com backoff
 *  5. Anti-duplicação garantida (Firestore + flag local)
 *  6. Auto-reconexão Bluetooth
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { subscribeAllOrders } from '@/services/unifiedOrders'
import {
  createPrintJob,
  subscribePrintQueue,
  subscribeRecentJobs,
  markPrinting,
  markPrinted,
  markError,
  resetToPending,
} from '@/services/printQueue'
import {
  BluetoothPrinter,
  buildTicketBuffer,
  loadPrinterConfig,
  savePrinterConfig,
} from '@/services/printEngine'
import type { UnifiedOrder } from '@/types'
import type { PrintJob, PrinterConfig, PrinterConnectionStatus } from '@/types/print'

// ─── Estado exposto pelo hook ─────────────────────────────────────────────────

export interface PrintAgentState {
  // Conexão
  connectionStatus:  PrinterConnectionStatus
  printerDeviceName: string | null
  // Fila
  pendingCount:      number
  recentJobs:        PrintJob[]
  // Controles
  connect:           () => Promise<void>
  disconnect:        () => Promise<void>
  retryJob:          (jobId: string) => Promise<void>
  cancelJob:         (jobId: string) => Promise<void>
  // Config
  config:            PrinterConfig
  updateConfig:      (config: PrinterConfig) => void
  // Ativação
  isActive:          boolean
  setIsActive:       (v: boolean) => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePrintAgent(restaurantId: string): PrintAgentState {
  const [connectionStatus,  setConnectionStatus]  = useState<PrinterConnectionStatus>('disconnected')
  const [printerDeviceName, setPrinterDeviceName] = useState<string | null>(null)
  const [pendingCount,      setPendingCount]       = useState(0)
  const [recentJobs,        setRecentJobs]         = useState<PrintJob[]>([])
  const [config,            setConfig]             = useState<PrinterConfig>(loadPrinterConfig)
  const [isActive,          setIsActive]           = useState(true)

  // Referências estáveis (não provocam re-render em closures)
  const printerRef    = useRef<BluetoothPrinter | null>(null)
  const processingRef = useRef<Set<string>>(new Set())   // jobIds em andamento
  const retryTimers   = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const configRef     = useRef(config)
  configRef.current   = config

  // ── Inicializa o BluetoothPrinter ─────────────────────────────────────────
  useEffect(() => {
    printerRef.current = new BluetoothPrinter(config, (status) => {
      setConnectionStatus(status as PrinterConnectionStatus)
    })
  }, [])                                                 // apenas 1x

  // ── Sincroniza config no printer ──────────────────────────────────────────
  useEffect(() => {
    printerRef.current?.updateConfig(config)
  }, [config])

  // ── Controles de conexão ──────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (!printerRef.current) return
    await printerRef.current.connect()
    const deviceName = (printerRef.current as any).device?.name ?? 'Impressora'
    setPrinterDeviceName(deviceName)
  }, [])

  const disconnect = useCallback(async () => {
    await printerRef.current?.disconnect()
    setPrinterDeviceName(null)
  }, [])

  // ── Lógica de impressão (máquina de estados) ──────────────────────────────

  const processJob = useCallback(async (job: PrintJob) => {
    const printer = printerRef.current
    const cfg     = configRef.current

    // Guard: não reprocessar job já em andamento
    if (processingRef.current.has(job.id)) return
    processingRef.current.add(job.id)

    // Não imprimir origens desativadas
    if (!cfg.printOnOrigins.includes(job.origin)) {
      processingRef.current.delete(job.id)
      return
    }

    // Não imprimir se desconectado e sem retry configurado
    if (!printer?.isConnected) {
      processingRef.current.delete(job.id)
      return
    }

    try {
      // 1. Sinaliza "printing" no Firestore (anti-duplicação distribuída)
      await markPrinting(job.id)

      // 2. Gera buffer ESC/POS
      const buffer = buildTicketBuffer(job, cfg)

      // 3. Envia para a impressora
      await printer.send(buffer)

      // 4. Marca como impresso
      const deviceName = (printer as any).device?.name ?? cfg.deviceName
      await markPrinted(job.id, deviceName)

      // Limpa timer de retry se existia
      if (retryTimers.current.has(job.id)) {
        clearTimeout(retryTimers.current.get(job.id))
        retryTimers.current.delete(job.id)
      }
    } catch (err: any) {
      const tentativas = (job.print.tentativas ?? 0) + 1
      const errorMsg   = err?.message ?? String(err)

      await markError(job.id, errorMsg, tentativas)

      // Retry automático com backoff se ainda dentro do limite
      if (tentativas < cfg.maxRetries) {
        const delay = Math.min(cfg.retryDelayMs * tentativas, 60_000)
        const timer = setTimeout(async () => {
          retryTimers.current.delete(job.id)
          await resetToPending(job.id)
          // O listener do Firestore vai re-enfileirar automaticamente
        }, delay)
        retryTimers.current.set(job.id, timer)
      }
    } finally {
      processingRef.current.delete(job.id)
    }
  }, [])

  // ── Observa pedidos novos → cria print_jobs ───────────────────────────────

  useEffect(() => {
    if (!restaurantId || !isActive) return

    const seenOrderIds = new Set<string>()  // evita criar job pra pedidos já conhecidos

    const unsub = subscribeAllOrders(restaurantId, (orders: UnifiedOrder[]) => {
      for (const order of orders) {
        if (seenOrderIds.has(order.originId)) continue
        // Só cria job para pedidos novos (primeiro snapshot pode conter histórico)
        const isVeryNew = Date.now() - order.createdAt.getTime() < 60_000  // menos de 1 min
        if (isVeryNew) {
          createPrintJob(order).catch(console.error)
        }
        seenOrderIds.add(order.originId)
      }
      // Popula seenOrderIds no primeiro snapshot SEM criar jobs (pedidos antigos)
    })

    // No primeiro carregamento, marcar todos como já vistos sem imprimir
    const initUnsub = subscribeAllOrders(restaurantId, (orders) => {
      orders.forEach((o) => seenOrderIds.add(o.originId))
      initUnsub()   // desinscreve após primeiro snapshot
    })

    return unsub
  }, [restaurantId, isActive])

  // ── Observa fila de impressão (pending/error) → processa ─────────────────

  useEffect(() => {
    if (!restaurantId || !isActive) return

    const unsub = subscribePrintQueue(restaurantId, (jobs: PrintJob[]) => {
      setPendingCount(jobs.length)
      for (const job of jobs) {
        // Só processa se: pending OU (error com tentativas < max)
        const shouldProcess =
          job.print.status === 'pending' ||
          (job.print.status === 'error' && job.print.tentativas < configRef.current.maxRetries)

        if (shouldProcess && !processingRef.current.has(job.id)) {
          processJob(job)
        }
      }
    })

    return unsub
  }, [restaurantId, isActive, processJob])

  // ── Observa jobs recentes para exibir no painel ───────────────────────────

  useEffect(() => {
    if (!restaurantId) return
    return subscribeRecentJobs(restaurantId, setRecentJobs)
  }, [restaurantId])

  // ── Ações manuais ─────────────────────────────────────────────────────────

  const retryJob = useCallback(async (jobId: string) => {
    // Limpa timer de retry se houver
    if (retryTimers.current.has(jobId)) {
      clearTimeout(retryTimers.current.get(jobId))
      retryTimers.current.delete(jobId)
    }
    await resetToPending(jobId)
    // O listener vai capturar e reprocessar automaticamente
  }, [])

  const cancelJob = useCallback(async (jobId: string) => {
    const { markCancelled } = await import('@/services/printQueue')
    await markCancelled(jobId)
  }, [])

  const updateConfig = useCallback((newConfig: PrinterConfig) => {
    setConfig(newConfig)
    savePrinterConfig(newConfig)
  }, [])

  // ── Cleanup de timers ao desmontar ────────────────────────────────────────

  useEffect(() => {
    return () => {
      retryTimers.current.forEach((t) => clearTimeout(t))
      retryTimers.current.clear()
    }
  }, [])

  return {
    connectionStatus,
    printerDeviceName,
    pendingCount,
    recentJobs,
    connect,
    disconnect,
    retryJob,
    cancelJob,
    config,
    updateConfig,
    isActive,
    setIsActive,
  }
}
