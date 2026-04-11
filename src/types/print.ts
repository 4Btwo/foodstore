// ─── Print Job Types ──────────────────────────────────────────────────────────

export type PrintJobStatus =
  | 'pending'    // aguardando impressão
  | 'printing'   // enviando para impressora
  | 'printed'    // impresso com sucesso
  | 'error'      // falhou — pode ter retry
  | 'cancelled'  // cancelado manualmente

export type PrinterConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

// ─── Estrutura salva no Firestore (collection: print_queue) ──────────────────

export interface PrintJob {
  id:           string
  restaurantId: string
  orderId:      string          // id na collection original
  origin:       'mesa' | 'marmita' | 'balcao' | 'online'
  label:        string          // ex: "Mesa 5" | "João Silva" | "Online #123"
  deliveryInfo?: string         // ex: "Retirada" | "Entrega — Rua X, 100"
  notes?:       string
  items:        Array<{ name: string; qty: number; price: number; size?: string }>
  total:        number
  createdAt:    Date

  // ─── Estado de impressão (máquina de estados) ─────────────────────────────
  print: {
    status:     PrintJobStatus
    tentativas: number
    ultimoErro: string | null
    timestamp:  number | null   // ms epoch — quando foi impresso
    device?:    string          // nome do dispositivo bluetooth
  }
}

// ─── Config da impressora (salva em localStorage) ────────────────────────────

export interface PrinterConfig {
  deviceName:         string    // nome exibido
  serviceUUID:        string    // GATT service UUID
  characteristicUUID: string    // GATT characteristic UUID (write)
  paperWidth:         48 | 58   // colunas (58mm ≈ 48col, 80mm ≈ 48col)
  restaurantName:     string    // cabeçalho do cupom
  printOnOrigins:     ('mesa' | 'marmita' | 'balcao' | 'online')[]  // quais origens imprimir
  autoReconnect:      boolean
  maxRetries:         number
  retryDelayMs:       number
}

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  deviceName:         'Impressora Térmica',
  serviceUUID:        '000018f0-0000-1000-8000-00805f9b34fb',
  characteristicUUID: '00002af1-0000-1000-8000-00805f9b34fb',
  paperWidth:         48,
  restaurantName:     'FOODSTORE',
  printOnOrigins:     ['mesa', 'marmita', 'balcao', 'online'],
  autoReconnect:      true,
  maxRetries:         5,
  retryDelayMs:       5000,
}

// UUIDs alternativos para impressoras comuns
export const PRINTER_PRESETS: Record<string, Partial<PrinterConfig>> = {
  'Genérica (padrão)': {
    serviceUUID:        '000018f0-0000-1000-8000-00805f9b34fb',
    characteristicUUID: '00002af1-0000-1000-8000-00805f9b34fb',
  },
  'EPSON / Star': {
    serviceUUID:        '00001101-0000-1000-8000-00805f9b34fb',
    characteristicUUID: '00001101-0000-1000-8000-00805f9b34fb',
  },
  'Xprinter / POS-58': {
    serviceUUID:        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    characteristicUUID: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
  },
  'Tanca / Gertec': {
    serviceUUID:        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    characteristicUUID: '49535343-8841-43f4-a8d4-ecbe34729bb3',
  },
}
