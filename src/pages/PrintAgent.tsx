/**
 * PrintAgent.tsx
 *
 * Página dedicada ao agente de impressão automática.
 * Ideal para um celular fixo na cozinha/caixa.
 *
 * Rota sugerida: /print-agent
 * Role: admin, kitchen, cashier
 */

import { Layout, PageHeader } from '@/components/Layout'
import { PrintAgentPanel } from '@/components/PrintAgentPanel'
import { usePrintAgent } from '@/hooks/usePrintAgent'
import { useAuth } from '@/hooks/useAuth'

export default function PrintAgentPage() {
  const { user }  = useAuth()
  const agent     = usePrintAgent(user?.restaurantId ?? '', 'kitchen')

  if (!user) return null

  const bluetoothSupported = 'bluetooth' in navigator

  return (
    <Layout>
      <PageHeader title="🖨️ Agente de Impressão" />

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Aviso de compatibilidade */}
        {!bluetoothSupported && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-amber-800 font-semibold text-sm">⚠️ Bluetooth não disponível</p>
            <p className="text-amber-700 text-xs mt-1">
              Use o Google Chrome no Android para habilitar a impressão via Bluetooth.
              Safari e Firefox não suportam Web Bluetooth API.
            </p>
          </div>
        )}

        {/* Painel principal */}
        <PrintAgentPanel agent={agent} />

        {/* Instruções de uso */}
        <div className="bg-blue-50 rounded-xl p-4 space-y-2">
          <p className="text-blue-800 font-semibold text-sm">📋 Como usar</p>
          <ol className="text-blue-700 text-xs space-y-1 list-decimal list-inside">
            <li>Ligue a impressora Bluetooth</li>
            <li>Toque em <strong>Conectar</strong> e selecione a impressora</li>
            <li>Deixe esta tela aberta — os pedidos serão impressos automaticamente</li>
            <li>Configure o modelo da impressora em ⚙️ se necessário</li>
          </ol>
        </div>

        {/* Dica de modo kiosk */}
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-gray-600 text-xs">
            💡 <strong>Dica:</strong> Para uso contínuo na cozinha, adicione esta página
            à tela inicial do celular (Menu do Chrome → "Adicionar à tela inicial").
            O app funciona sem interação humana enquanto estiver aberto.
          </p>
        </div>
      </div>
    </Layout>
  )
}
