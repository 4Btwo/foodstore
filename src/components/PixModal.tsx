import { useEffect } from "react"
import { usePixPayment } from "@/hooks/usePixPayment"

interface Props {
  orderId:      string
  restaurantId: string
  tableNumber:  number
  onSuccess:    () => void
  onClose:      () => void
}

export function PixModal({ orderId, restaurantId, tableNumber, onSuccess, onClose }: Props) {
  const { state, qrCode, qrBase64, total, errorMsg, generate, reset } = usePixPayment()

  useEffect(() => {
    generate(orderId, restaurantId)
    return () => reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  useEffect(() => {
    if (state === "approved") {
      setTimeout(onSuccess, 1500)
    }
  }, [state, onSuccess])

  function copyPix() {
    navigator.clipboard.writeText(qrCode)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Pagamento PIX</h2>
            <p className="text-xs text-gray-500">Mesa {tableNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Loading */}
        {state === "loading" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            <p className="text-sm text-gray-500">Gerando QR Code…</p>
          </div>
        )}

        {/* QR Code */}
        {state === "waiting" && (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-xl border-2 border-gray-100 p-3">
              {qrBase64 ? (
                <img
                  src={`data:image/png;base64,${qrBase64}`}
                  alt="QR Code PIX"
                  className="h-48 w-48"
                />
              ) : (
                <div className="flex h-48 w-48 items-center justify-center rounded-lg bg-gray-50 text-xs text-gray-400">
                  QR Code
                </div>
              )}
            </div>

            <div className="w-full rounded-xl bg-green-50 px-4 py-3 text-center">
              <p className="text-xs text-green-600 mb-1">Total a pagar</p>
              <p className="text-2xl font-bold text-green-700">
                R$ {total.toFixed(2)}
              </p>
            </div>

            {/* Copia e cola */}
            <div className="w-full">
              <p className="mb-1.5 text-xs font-medium text-gray-500">Pix Copia e Cola</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={qrCode}
                  className="input flex-1 truncate text-xs"
                />
                <button onClick={copyPix} className="btn-secondary px-3 text-xs whitespace-nowrap">
                  Copiar
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              Aguardando confirmação do pagamento…
            </div>
          </div>
        )}

        {/* Aprovado */}
        {state === "approved" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
              ✅
            </div>
            <p className="text-base font-semibold text-green-700">Pagamento confirmado!</p>
            <p className="text-sm text-gray-500">A mesa será liberada automaticamente</p>
          </div>
        )}

        {/* Rejeitado */}
        {state === "rejected" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
              ❌
            </div>
            <p className="text-base font-semibold text-red-700">Pagamento não aprovado</p>
            <button
              onClick={() => generate(orderId, restaurantId)}
              className="btn-primary text-sm"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Erro */}
        {state === "error" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl">
              ⚠️
            </div>
            <p className="text-sm text-red-600 text-center">{errorMsg}</p>
            <button
              onClick={() => generate(orderId, restaurantId)}
              className="btn-secondary text-sm"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
