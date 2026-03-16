/**
 * Gera a URL pública de acesso do cliente via QR Code.
 *
 * Exemplo: https://foodstore.app/menu/rest_001/5
 *
 * Em desenvolvimento usa window.location.origin automaticamente.
 */
export function getTableQrUrl(restaurantId: string, tableNumber: number): string {
  const base = import.meta.env.VITE_APP_URL ?? window.location.origin
  return `${base}/menu/${restaurantId}/${tableNumber}`
}

/**
 * Gera o SVG de um QR code usando a API do QR Server (gratuita, sem dependência npm).
 * Retorna a URL da imagem pronta para usar em <img src=...>
 */
export function getQrImageUrl(data: string, size = 200): string {
  const encoded = encodeURIComponent(data)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&format=png&margin=2`
}
