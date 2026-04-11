/**
 * PrintAgentPanel.tsx
 *
 * Painel de controle do agente de impressão automática.
 * Pode ser usado como widget flutuante ou página dedicada.
 *
 * Exibe:
 *  - Status da conexão Bluetooth
 *  - Fila de impressão (pendentes)
 *  - Histórico recente (últimas 2h)
 *  - Configurações da impressora
 */

import { useState } from 'react'
import type { PrintAgentState } from '@/hooks/usePrintAgent'
import type { PrintJob, PrinterConfig } from '@/types/print'
import { PRINTER_PRESETS } from '@/types/print'

// ─── Helpers visuais ──────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  connected:    'bg-green-500',
  connecting:   'bg-yellow-400 animate-pulse',
  disconnected: 'bg-gray-400',
  error:        'bg-red-500',
}

const STATUS_LABEL: Record<string, string> = {
  connected:    'Conectada',
  connecting:   'Conectando…',
  disconnected: 'Desconectada',
  error:        'Erro',
}

const PRINT_STATUS_LABEL: Record<string, { label: string; color: string; icon: string }> = {
  pending:   { label: 'Pendente',   color: 'text-yellow-600', icon: '⏳' },
  printing:  { label: 'Imprimindo', color: 'text-blue-600',   icon: '🖨️' },
  printed:   { label: 'Impresso',   color: 'text-green-600',  icon: '✅' },
  error:     { label: 'Erro',       color: 'text-red-600',    icon: '❌' },
  cancelled: { label: 'Cancelado',  color: 'text-gray-400',   icon: '🚫' },
}

const ORIGIN_LABEL: Record<string, string> = {
  mesa:    '🍽️ Mesa',
  marmita: '🍱 Marmitaria',
  balcao:  '🏪 Balcão',
  online:  '🌐 Online',
}

function JobCard({
  job, onRetry, onCancel,
}: {
  job:      PrintJob
  onRetry:  (id: string) => void
  onCancel: (id: string) => void
}) {
  const ps   = PRINT_STATUS_LABEL[job.print.status] ?? PRINT_STATUS_LABEL.error
  const time = job.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 text-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-gray-800">
          {ORIGIN_LABEL[job.origin]} — {job.label}
        </span>
        <span className="text-xs text-gray-400">{time}</span>
      </div>

      {job.deliveryInfo && (
        <p className="text-xs text-gray-500 mb-1">{job.deliveryInfo}</p>
      )}

      <div className="text-xs text-gray-600 mb-2">
        {job.items.slice(0, 3).map((item, i) => (
          <span key={i} className="mr-2">
            {item.qty}x {item.name}{item.size ? ` (${item.size})` : ''}
          </span>
        ))}
        {job.items.length > 3 && (
          <span className="text-gray-400">+{job.items.length - 3} itens</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${ps.color}`}>
          {ps.icon} {ps.label}
          {job.print.tentativas > 0 && (
            <span className="text-gray-400 ml-1">({job.print.tentativas} tent.)</span>
          )}
        </span>
        <span className="font-semibold text-gray-700">
          R$ {job.total.toFixed(2)}
        </span>
      </div>

      {job.print.ultimoErro && (
        <p className="text-xs text-red-500 mt-1 truncate" title={job.print.ultimoErro}>
          ⚠️ {job.print.ultimoErro}
        </p>
      )}

      {job.print.status === 'error' && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onRetry(job.id)}
            className="flex-1 text-xs bg-blue-50 text-blue-700 rounded px-2 py-1 hover:bg-blue-100"
          >
            🔄 Tentar novamente
          </button>
          <button
            onClick={() => onCancel(job.id)}
            className="text-xs bg-gray-50 text-gray-500 rounded px-2 py-1 hover:bg-gray-100"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Modal de configuração ────────────────────────────────────────────────────

function ConfigModal({
  config, onSave, onClose,
}: {
  config:  PrinterConfig
  onSave:  (c: PrinterConfig) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<PrinterConfig>({ ...config })

  function applyPreset(presetName: string) {
    const preset = PRINTER_PRESETS[presetName]
    if (preset) setDraft((d) => ({ ...d, ...preset, deviceName: presetName }))
  }

  function toggleOrigin(origin: string) {
    const origins = draft.printOnOrigins as string[]
    setDraft((d) => ({
      ...d,
      printOnOrigins: origins.includes(origin)
        ? (origins.filter((o) => o !== origin) as typeof d.printOnOrigins)
        : ([...origins, origin] as typeof d.printOnOrigins),
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">⚙️ Configurar Impressora</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>

          {/* Preset */}
          <label className="block text-xs font-medium text-gray-600 mb-1">Modelo da impressora</label>
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
            onChange={(e) => applyPreset(e.target.value)}
            defaultValue=""
          >
            <option value="">Selecione um preset…</option>
            {Object.keys(PRINTER_PRESETS).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          {/* Nome do restaurante */}
          <label className="block text-xs font-medium text-gray-600 mb-1">Nome no cupom</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
            value={draft.restaurantName}
            onChange={(e) => setDraft((d) => ({ ...d, restaurantName: e.target.value }))}
          />

          {/* Largura do papel */}
          <label className="block text-xs font-medium text-gray-600 mb-1">Largura (colunas)</label>
          <div className="flex gap-3 mb-3">
            {([48, 58] as const).map((w) => (
              <button
                key={w}
                onClick={() => setDraft((d) => ({ ...d, paperWidth: w }))}
                className={`flex-1 py-2 rounded-lg text-sm border ${draft.paperWidth === w ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
              >
                {w} colunas
              </button>
            ))}
          </div>

          {/* Service UUID */}
          <label className="block text-xs font-medium text-gray-600 mb-1">Service UUID</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm mb-3 font-mono text-xs"
            value={draft.serviceUUID}
            onChange={(e) => setDraft((d) => ({ ...d, serviceUUID: e.target.value }))}
          />

          {/* Characteristic UUID */}
          <label className="block text-xs font-medium text-gray-600 mb-1">Characteristic UUID</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm mb-4 font-mono text-xs"
            value={draft.characteristicUUID}
            onChange={(e) => setDraft((d) => ({ ...d, characteristicUUID: e.target.value }))}
          />

          {/* Origens */}
          <label className="block text-xs font-medium text-gray-600 mb-2">Imprimir pedidos de</label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {(['mesa', 'marmita', 'balcao', 'online'] as const).map((origin) => {
              const active = draft.printOnOrigins.includes(origin)
              return (
                <button
                  key={origin}
                  onClick={() => toggleOrigin(origin)}
                  className={`py-2 px-3 rounded-lg text-sm border text-left ${active ? 'bg-green-50 border-green-400 text-green-800' : 'bg-white border-gray-200 text-gray-400'}`}
                >
                  {active ? '✓' : '○'} {ORIGIN_LABEL[origin]}
                </button>
              )
            })}
          </div>

          {/* Retry config */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Máx. tentativas</label>
              <input
                type="number" min={1} max={10}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={draft.maxRetries}
                onChange={(e) => setDraft((d) => ({ ...d, maxRetries: Number(e.target.value) }))}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Delay (ms)</label>
              <input
                type="number" min={1000} step={1000}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={draft.retryDelayMs}
                onChange={(e) => setDraft((d) => ({ ...d, retryDelayMs: Number(e.target.value) }))}
              />
            </div>
          </div>

          {/* Auto-reconexão */}
          <label className="flex items-center gap-3 cursor-pointer mb-5">
            <div
              onClick={() => setDraft((d) => ({ ...d, autoReconnect: !d.autoReconnect }))}
              className={`w-11 h-6 rounded-full transition-colors ${draft.autoReconnect ? 'bg-blue-500' : 'bg-gray-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow m-0.5 transition-transform ${draft.autoReconnect ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-sm text-gray-700">Auto-reconexão Bluetooth</span>
          </label>

          <button
            onClick={() => { onSave(draft); onClose() }}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold"
          >
            Salvar configurações
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Painel principal ─────────────────────────────────────────────────────────

export function PrintAgentPanel({ agent }: { agent: PrintAgentState }) {
  const [tab,        setTab]        = useState<'queue' | 'history'>('queue')
  const [showConfig, setShowConfig] = useState(false)

  const pending  = agent.recentJobs.filter((j) => ['pending', 'printing', 'error'].includes(j.print.status))
  const history  = agent.recentJobs.filter((j) => ['printed', 'cancelled'].includes(j.print.status))

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🖨️</span>
            <span className="font-semibold text-gray-800">Impressão Automática</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle ativo/inativo */}
            <div
              onClick={() => agent.setIsActive(!agent.isActive)}
              className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${agent.isActive ? 'bg-blue-500' : 'bg-gray-300'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow m-0.5 transition-transform ${agent.isActive ? 'translate-x-5' : ''}`} />
            </div>

            <button
              onClick={() => setShowConfig(true)}
              className="text-gray-400 hover:text-gray-700 text-lg leading-none"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* ── Status da impressora ──────────────────────────────────────── */}
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[agent.connectionStatus]}`} />
              <span className="text-sm text-gray-700">
                {STATUS_LABEL[agent.connectionStatus]}
                {agent.printerDeviceName && (
                  <span className="text-gray-400 ml-1">— {agent.printerDeviceName}</span>
                )}
              </span>
            </div>

            {agent.connectionStatus === 'connected' ? (
              <button
                onClick={agent.disconnect}
                className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1"
              >
                Desconectar
              </button>
            ) : (
              <button
                onClick={agent.connect}
                disabled={agent.connectionStatus === 'connecting'}
                className="text-xs bg-blue-600 text-white rounded-lg px-3 py-1 disabled:opacity-50"
              >
                {agent.connectionStatus === 'connecting' ? 'Conectando…' : 'Conectar'}
              </button>
            )}
          </div>

          {!agent.isActive && (
            <p className="text-xs text-amber-600 mt-1.5">
              ⚠️ Agente pausado — pedidos não serão impressos automaticamente
            </p>
          )}

          {agent.pendingCount > 0 && agent.connectionStatus !== 'connected' && (
            <p className="text-xs text-red-500 mt-1.5">
              {agent.pendingCount} pedido(s) aguardando impressora conectada
            </p>
          )}
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <div className="flex border-b">
          {(['queue', 'history'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
            >
              {t === 'queue'
                ? `Fila ${pending.length > 0 ? `(${pending.length})` : ''}`
                : `Histórico (${history.length})`}
            </button>
          ))}
        </div>

        {/* ── Conteúdo ──────────────────────────────────────────────────── */}
        <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
          {tab === 'queue' && (
            pending.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                Nenhum pedido na fila ✓
              </p>
            ) : (
              pending.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onRetry={agent.retryJob}
                  onCancel={agent.cancelJob}
                />
              ))
            )
          )}

          {tab === 'history' && (
            history.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                Nenhum cupom nas últimas 2 horas
              </p>
            ) : (
              history.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onRetry={agent.retryJob}
                  onCancel={agent.cancelJob}
                />
              ))
            )
          )}
        </div>
      </div>

      {/* ── Modal de configuração ──────────────────────────────────────── */}
      {showConfig && (
        <ConfigModal
          config={agent.config}
          onSave={agent.updateConfig}
          onClose={() => setShowConfig(false)}
        />
      )}
    </>
  )
}

// ─── Widget flutuante (para usar em qualquer tela) ────────────────────────────

export function PrintAgentFAB({ agent }: { agent: PrintAgentState }) {
  const [open, setOpen] = useState(false)

  const hasError   = agent.recentJobs.some((j) => j.print.status === 'error')
  const isPrinting = agent.recentJobs.some((j) => j.print.status === 'printing')

  const fabColor = hasError
    ? 'bg-red-500'
    : isPrinting
    ? 'bg-blue-500 animate-pulse'
    : agent.connectionStatus === 'connected'
    ? 'bg-green-500'
    : 'bg-gray-400'

  return (
    <div className="fixed bottom-20 right-4 z-40">
      {open && (
        <div className="mb-3 w-80">
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
