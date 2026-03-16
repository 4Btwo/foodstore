import { httpsCallable } from "firebase/functions"
import { functions } from "./firebase"

interface PixPaymentRequest {
  orderId:      string
  restaurantId: string
}

interface PixPaymentResponse {
  paymentId:    number
  qrCode:       string
  qrCodeBase64: string
  total:        number
  expiresAt:    string
}

interface PaymentStatusResponse {
  paymentStatus: "pending" | "approved" | "rejected" | "cancelled"
  orderStatus:   string
}

export async function createPixPayment(
  payload: PixPaymentRequest,
): Promise<PixPaymentResponse> {
  const fn = httpsCallable<PixPaymentRequest, PixPaymentResponse>(
    functions,
    "createPixPayment",
  )
  const result = await fn(payload)
  return result.data
}

export async function checkPaymentStatus(
  orderId: string,
): Promise<PaymentStatusResponse> {
  const fn = httpsCallable<{ orderId: string }, PaymentStatusResponse>(
    functions,
    "checkPaymentStatus",
  )
  const result = await fn({ orderId })
  return result.data
}
