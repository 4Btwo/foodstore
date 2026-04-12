/**
 * PrintAgentPanel.tsx — Painel de controle do agente de impressão.
 * FAB flutuante + painel com fila, histórico e status de conexão.
 */

import { useState } from 'react'
import { PRINTER_PRESETS } from '@/types/print'
import type { PrintAgentState } from '@/hooks/usePrintAgent'
import type { PrintJob } from '@/types/print'

// ─── Helpers visuais ──────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  connected:    'bg-green-500',
  connecting:   'bg-yellow-400 animate-pulse',
  disconnected: 'bg-gray-400',
  error:        'bg-red-500',
}
const STATUS_LABEL: Record<string, string> = {
  connected: 'Conectada', connecting: 'Conectando…',
  disconnected: 'Desconectada', error: 'Erro',
}
const TICKET_ICON: Record<string, string> = {
  kitchen_prep:    '🍳',
  balcao_retirada: '🎫',
  online_control:  '📍',
  mesa_bill:       '🧾',
  financial:       '💳',
}
const PRINT_STATUS: Record<string, { label: string; color: string; icon: string }> = {
  pending:   { label: 'Pendente',   color: 'text-yellow-600', icon: '⏳' },
  printing:  { label: 'Imprimindo', color: 'text-blue-600',   icon: '🖨️' },
  printed:   { label: 'Impresso',   color: 'text-green-600',  icon: '✅' },
  error:     { label: 'Erro',       color: 'text-red-600',    icon: '❌' },
  cancelled: { label: 'Cancelado',  color: 'text-gray-400',   icon: '🚫' },
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({ job, onRetry, onCancel }: {
  job: PrintJob
  onRetry:  (id: string) => void
  onCancel: (id: string) => void
}) {
  const ps   = PRINT_STATUS[job.print.status] ?? PRINT_STATUS.error
  const time = job.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 text-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-gray-800 text-xs">
          {TICKET_ICON[job.ticketType] ?? '🖨️'} {job.label}
        </span>
        <span className="text-xs text-gray-400">{time}</span>
      </div>
      <div className="text-xs text-gray-500 mb-1.5">
        {job.items.slice(0, 2).map((item, i) => (
          <span key={i} className="mr-2">{item.qty}x {item.name}</span>
        ))}
        {job.items.length > 2 && <span className="text-gray-400">+{job.items.length - 2}</span>}
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${ps.color}`}>
          {ps.icon} {ps.label}
          {job.print.tentativas > 0 && <span className="text-gray-400 ml-1">({job.print.tentativas})</span>}
        </span>
        <span className="font-semibold text-gray-600 text-xs">R$ {job.total.toFixed(2)}</span>
      </div>
      {job.print.ultimoErro && (
        <p className="text-xs text-red-500 mt-1 truncate">{job.print.ultimoErro}</p>
      )}
      {job.print.status === 'error' && (
        <div className="flex gap-2 mt-2">
          <button onClick={() => onRetry(job.id)}
            className="flex-1 text-xs bg-blue-50 text-blue-700 rounded px-2 py-1 hover:bg-blue-100">
            🔄 Tentar novamente
          </button>
          <button onClick={() => onCancel(job.id)}
            className="text-xs bg-gray-50 text-gray-500 rounded px-2 py-1 hover:bg-gray-100">
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Painel principal ─────────────────────────────────────────────────────────

export function PrintAgentPanel({ agent, label }: { agent: PrintAgentState; label?: string }) {
  const [tab, setTab] = useState<'queue' | 'history'>('queue')

  const pending = agent.recentJobs.filter((j) =>
    ['pending', 'printing', 'error'].includes(j.print.status))
  const history = agent.recentJobs.filter((j) =>
    ['printed', 'cancelled'].includes(j.print.status))

  const connType = agent.config.connectionType
  const connIcon = connType === 'browser' ? '🖥️' : connType === 'bluetooth' ? '🔵' : '🔌'

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🖨️</span>
          <span className="font-semibold text-gray-800 text-sm">
            {label ?? 'Impressão'} {agent.target === 'kitchen' ? '· Cozinha' : '· Central'}
          </span>
        </div>
        <div
          onClick={() => agent.setIsActive(!agent.isActive)}
          className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${agent.isActive ? 'bg-blue-500' : 'bg-gray-300'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full shadow m-0.5 transition-transform ${agent.isActive ? 'translate-x-5' : ''}`} />
        </div>
      </div>

      {/* Status conexão */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[agent.connectionStatus]}`} />
            <span className="text-sm text-gray-700">
              {connIcon} {STATUS_LABEL[agent.connectionStatus]}
              {agent.printerDeviceName && (
                <span className="text-gray-400 ml-1">— {agent.printerDeviceName}</span>
              )}
            </span>
          </div>
          {agent.config.connectionType === 'browser' ? (
            <span className="text-xs text-green-600 font-medium">✓ Pronto</span>
          ) : agent.connectionStatus === 'connected' ? (
            <button onClick={agent.disconnect}
              className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1">
              Desconectar
            </button>
          ) : (
            <button onClick={agent.connect}
              disabled={agent.connectionStatus === 'connecting'}
              className="text-xs bg-blue-600 text-white rounded-lg px-3 py-1 disabled:opacity-50">
              {agent.connectionStatus === 'connecting' ? 'Conectando…' : 'Conectar'}
            </button>
          )}
        </div>
        {!agent.isActive && (
          <p className="text-xs text-amber-600 mt-1.5">⚠️ Agente pausado</p>
        )}
        {agent.pendingCount > 0 && agent.connectionStatus !== 'connected' && agent.config.connectionType !== 'browser' && (
          <p className="text-xs text-red-500 mt-1.5">
            {agent.pendingCount} pedido(s) aguardando conexão
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {(['queue', 'history'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
            {t === 'queue' ? `Fila${pending.length > 0 ? ` (${pending.length})` : ''}` : `Histórico (${history.length})`}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
        {tab === 'queue' ? (
          pending.length === 0
            ? <p className="text-xs text-gray-400 text-center py-4">Nenhum na fila ✓</p>
            : pending.map((job) => (
                <JobCard key={job.id} job={job} onRetry={agent.retryJob} onCancel={agent.cancelJob} />
              ))
        ) : (
          history.length === 0
            ? <p className="text-xs text-gray-400 text-center py-4">Nenhum nas últimas 2h</p>
            : history.map((job) => (
                <JobCard key={job.id} job={job} onRetry={agent.retryJob} onCancel={agent.cancelJob} />
              ))
        )}
      </div>
    </div>
  )
}

// ─── FAB flutuante ────────────────────────────────────────────────────────────

export function PrintAgentFAB({ agent }: { agent: PrintAgentState }) {
  const [open, setOpen] = useState(false)

  const hasError   = agent.recentJobs.some((j) => j.print.status === 'error')
  const isPrinting = agent.recentJobs.some((j) => j.print.status === 'printing')

  const fabColor = hasError
    ? 'bg-red-500'
    : isPrinting
    ? 'bg-blue-500 animate-pulse'
    : agent.connectionStatus === 'connected' || agent.config.connectionType === 'browser'
    ? 'bg-green-500'
    : 'bg-gray-400'

  return (
    <div className="fixed bottom-20 right-4 z-40">
      {open && (
        <div className="mb-3 w-72">
          <PrintAgentPanel agent={agent} />
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`${fabColor} text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl transition-all active:scale-95`}
      >
        {isPrinting ? '⏳' : '🖨️'}
      </button>
      {agent.pendingCount > 0 && !open && (
        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
          {agent.pendingCount}
        </div>
      )}
    </div>
  )
}
