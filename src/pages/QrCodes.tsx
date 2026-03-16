import { useState } from "react"
import { Layout, PageHeader } from "@/components/Layout"
import { useTables } from "@/hooks/useTables"
import { useAuth } from "@/hooks/useAuth"
import { getTableQrUrl, getQrImageUrl } from "@/utils/qrcode"

function QrCard({ tableNumber, restaurantId }: { tableNumber: number; restaurantId: string }) {
  const url      = getTableQrUrl(restaurantId, tableNumber)
  const imageUrl = getQrImageUrl(url, 160)
  const [copied, setCopied] = useState(false)

  function copyUrl() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-5 print:break-inside-avoid">
      <p className="text-sm font-semibold text-gray-700">Mesa {tableNumber}</p>
      <img
        src={imageUrl}
        alt={`QR Mesa ${tableNumber}`}
        className="h-40 w-40 rounded-xl border border-gray-100"
      />
      <p className="max-w-[160px] truncate text-center text-xs text-gray-400">{url}</p>
      <button
        onClick={copyUrl}
        className="w-full rounded-lg border border-gray-200 py-1.5 text-xs text-gray-600 hover:bg-gray-50 print:hidden"
      >
        {copied ? "✅ Copiado!" : "Copiar URL"}
      </button>
    </div>
  )
}

export default function QrCodesPage() {
  const { tables }     = useTables()
  const { restaurantId } = useAuth()

  if (!restaurantId) return null

  return (
    <Layout>
      <PageHeader
        title="QR Codes das mesas"
        subtitle="Imprima e cole nas mesas para os clientes acessarem o cardápio"
        action={
          <button
            onClick={() => window.print()}
            className="btn-primary text-sm print:hidden"
          >
            🖨️ Imprimir todos
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {tables.map((t) => (
            <QrCard key={t.id} tableNumber={t.number} restaurantId={restaurantId} />
          ))}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .grid, .grid * { visibility: visible; }
          .grid { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 16px; }
        }
      `}</style>
    </Layout>
  )
}
