import { httpsCallable } from "firebase/functions"
import { functions } from "./firebase"

// ─── Pagamento PIX — mesas (fluxo existente) ──────────────────────────────────

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

// ─── Pagamento PIX — pedidos online (novo) ────────────────────────────────────

export interface OnlinePixRequest {
  orderId:      string
  restaurantId: string
}

export interface OnlinePixResponse {
  provider:     string           // 'mercadopago' | 'pagbank' | 'static'
  paymentId:    string
  qrCode:       string           // código copia-e-cola
  qrCodeBase64: string           // imagem base64 (vazio para PagBank/estático)
  pixKey:       string           // chave exibida ao cliente
  total:        number
}

export async function createOnlinePixPayment(
  payload: OnlinePixRequest,
): Promise<OnlinePixResponse> {
  const fn = httpsCallable<OnlinePixRequest, OnlinePixResponse>(
    functions,
    "createOnlinePixPayment",
  )
  const result = await fn(payload)
  return result.data
}

export async function checkOnlinePaymentStatus(
  orderId: string,
): Promise<PaymentStatusResponse> {
  const fn = httpsCallable<{ orderId: string }, PaymentStatusResponse>(
    functions,
    "checkOnlinePaymentStatus",
  )
  const result = await fn({ orderId })
  return result.data
}
