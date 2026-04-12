/**
 * usePrintAgent.ts
 *
 * Hook do agente de impressão. Instanciado separadamente para cada alvo:
 *   usePrintAgent('kitchen') — cozinha
 *   usePrintAgent('central') — central / balcão
 *
 * Cada instância escuta apenas os jobs do seu target no Firestore.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  subscribePrintQueue,
  subscribeRecentJobs,
  markPrinting,
  markPrinted,
  markError,
  markCancelled,
  resetToPending,
} from '@/services/printQueue'
import {
  createPrinter,
  buildTicketHTML,
  loadPrinterConfig,
  savePrinterConfig,
  loadLocalTemplates,
  saveLocalTemplates,
  type IPrinter,
} from '@/services/printEngine'
import type {
  PrintJob,
  PrinterConfig,
  PrinterConnectionStatus,
  PrinterTarget,
  PrintTemplates,
} from '@/types/print'

export interface PrintAgentState {
  target:            PrinterTarget
  connectionStatus:  PrinterConnectionStatus
  printerDeviceName: string | null
  pendingCount:      number
  recentJobs:        PrintJob[]
  connect:           () => Promise<void>
  disconnect:        () => Promise<void>
  retryJob:          (jobId: string) => Promise<void>
  cancelJob:         (jobId: string) => Promise<void>
  config:            PrinterConfig
  updateConfig:      (c: PrinterConfig) => void
  templates:         PrintTemplates
  updateTemplates:   (t: PrintTemplates) => void
  isActive:          boolean
  setIsActive:       (v: boolean) => void
}

export function usePrintAgent(
  restaurantId: string,
  target: PrinterTarget,
): PrintAgentState {
  const [connectionStatus,  setConnectionStatus]  = useState<PrinterConnectionStatus>('disconnected')
  const [printerDeviceName, setPrinterDeviceName] = useState<string | null>(null)
  const [pendingCount,      setPendingCount]       = useState(0)
  const [recentJobs,        setRecentJobs]         = useState<PrintJob[]>([])
  const [config,            setConfig]             = useState<PrinterConfig>(() => loadPrinterConfig(target))
  const [templates,         setTemplates]          = useState<PrintTemplates>(loadLocalTemplates)
  const [isActive,          setIsActive]           = useState(true)

  const printerRef    = useRef<IPrinter | null>(null)
  const processingRef = useRef<Set<string>>(new Set())
  const retryTimers   = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const configRef     = useRef(config)
  const templatesRef  = useRef(templates)
  configRef.current   = config
  templatesRef.current = templates

  // Inicializa driver
  useEffect(() => {
    const printer = createPrinter(config, (status) => {
      setConnectionStatus(status as PrinterConnectionStatus)
    })
    printerRef.current = printer
    // Modo browser: conecta automaticamente
    if (config.connectionType === 'browser') {
      printer.connect().then(() => setPrinterDeviceName('Impressora do Sistema')).catch(() => {})
    }
  }, []) // eslint-disable-line

  useEffect(() => { printerRef.current?.updateConfig(config) }, [config])

  const connect = useCallback(async () => {
    if (!printerRef.current) return
    const currentType = (printerRef.current as any).config?.connectionType
    if (currentType !== configRef.current.connectionType) {
      printerRef.current = createPrinter(configRef.current, (status) => {
        setConnectionStatus(status as PrinterConnectionStatus)
      })
    }
    await printerRef.current.connect()
    setPrinterDeviceName(printerRef.current.deviceLabel)
  }, [])

  const disconnect = useCallback(async () => {
    await printerRef.current?.disconnect()
    setPrinterDeviceName(null)
  }, [])

  // Processa um job
  const processJob = useCallback(async (job: PrintJob) => {
    const printer = printerRef.current
    const cfg     = configRef.current
    const tpls    = templatesRef.current

    if (processingRef.current.has(job.id)) return
    processingRef.current.add(job.id)

    // Verifica conexão (browser sempre passa)
    if (!printer?.isConnected && cfg.connectionType !== 'browser') {
      processingRef.current.delete(job.id)
      return
    }

    try {
      await markPrinting(job.id)
      const html = buildTicketHTML(job, tpls)
      await printer!.sendHTML(html)
      await markPrinted(job.id, printer!.deviceLabel)

      if (retryTimers.current.has(job.id)) {
        clearTimeout(retryTimers.current.get(job.id))
        retryTimers.current.delete(job.id)
      }
    } catch (err: any) {
      const tentativas = (job.print.tentativas ?? 0) + 1
      await markError(job.id, err?.message ?? String(err), tentativas)

      if (tentativas < cfg.maxRetries) {
        const delay = Math.min(cfg.retryDelayMs * tentativas, 60_000)
        const timer = setTimeout(async () => {
          retryTimers.current.delete(job.id)
          await resetToPending(job.id)
        }, delay)
        retryTimers.current.set(job.id, timer)
      }
    } finally {
      processingRef.current.delete(job.id)
    }
  }, [])

  // Escuta fila pendente
  useEffect(() => {
    if (!restaurantId || !isActive) return
    return subscribePrintQueue(restaurantId, target, (jobs) => {
      setPendingCount(jobs.length)
      for (const job of jobs) {
        const shouldProcess =
          job.print.status === 'pending' ||
          (job.print.status === 'error' && job.print.tentativas < configRef.current.maxRetries)
        if (shouldProcess && !processingRef.current.has(job.id)) {
          processJob(job)
        }
      }
    })
  }, [restaurantId, target, isActive, processJob])

  // Histórico recente
  useEffect(() => {
    if (!restaurantId) return
    return subscribeRecentJobs(restaurantId, target, setRecentJobs)
  }, [restaurantId, target])

  // Ações manuais
  const retryJob = useCallback(async (jobId: string) => {
    if (retryTimers.current.has(jobId)) {
      clearTimeout(retryTimers.current.get(jobId))
      retryTimers.current.delete(jobId)
    }
    await resetToPending(jobId)
  }, [])

  const cancelJob = useCallback(async (jobId: string) => {
    await markCancelled(jobId)
  }, [])

  const updateConfig = useCallback((newConfig: PrinterConfig) => {
    setConfig(newConfig)
    savePrinterConfig(newConfig)
  }, [])

  const updateTemplates = useCallback((newTpl: PrintTemplates) => {
    setTemplates(newTpl)
    saveLocalTemplates(newTpl)
  }, [])

  useEffect(() => {
    return () => {
      retryTimers.current.forEach(t => clearTimeout(t))
      retryTimers.current.clear()
    }
  }, [])

  return {
    target, connectionStatus, printerDeviceName,
    pendingCount, recentJobs,
    connect, disconnect, retryJob, cancelJob,
    config, updateConfig,
    templates, updateTemplates,
    isActive, setIsActive,
  }
}
