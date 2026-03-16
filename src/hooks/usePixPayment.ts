import { useState, useEffect, useRef } from "react"
import { createPixPayment, checkPaymentStatus } from "@/services/payments"

type PixState = "idle" | "loading" | "waiting" | "approved" | "rejected" | "error"

export function usePixPayment() {
  const [state, setState]           = useState<PixState>("idle")
  const [qrCode, setQrCode]         = useState("")
  const [qrBase64, setQrBase64]     = useState("")
  const [total, setTotal]           = useState(0)
  const [errorMsg, setErrorMsg]     = useState("")
  const [currentOrderId, setCurrentOrderId] = useState("")
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  useEffect(() => () => stopPolling(), [])

  async function generate(orderId: string, restaurantId: string) {
    setState("loading")
    setErrorMsg("")
    setCurrentOrderId(orderId)
    try {
      const result = await createPixPayment({ orderId, restaurantId })
      setQrCode(result.qrCode)
      setQrBase64(result.qrCodeBase64)
      setTotal(result.total)
      setState("waiting")

      // Polling a cada 5s para checar pagamento
      pollingRef.current = setInterval(async () => {
        const status = await checkPaymentStatus(orderId)
        if (status.paymentStatus === "approved") {
          setState("approved")
          stopPolling()
        } else if (
          status.paymentStatus === "rejected" ||
          status.paymentStatus === "cancelled"
        ) {
          setState("rejected")
          stopPolling()
        }
      }, 5000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar PIX"
      setErrorMsg(msg)
      setState("error")
    }
  }

  function reset() {
    stopPolling()
    setState("idle")
    setQrCode("")
    setQrBase64("")
    setTotal(0)
    setErrorMsg("")
    setCurrentOrderId("")
  }

  return {
    state,
    qrCode,
    qrBase64,
    total,
    errorMsg,
    currentOrderId,
    generate,
    reset,
  }
}
