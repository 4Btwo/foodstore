// ─── Tipos do Sistema de Impressão ────────────────────────────────────────────

export type PrintJobStatus =
  | 'pending'    // aguardando impressão
  | 'printing'   // enviando para impressora
  | 'printed'    // impresso com sucesso
  | 'error'      // falhou — pode ter retry
  | 'cancelled'  // cancelado manualmente

export type PrinterTarget =
  | 'kitchen'    // 🍳 Impressora da cozinha
  | 'central'    // 🖥️ Impressora da central/balcão

// Qual template usar para cada job
export type TicketType =
  | 'kitchen_prep'     // 🍳 Cozinha — todos os pedidos confirmados (sem preço)
  | 'balcao_retirada'  // 🎫 Central — número de retirada para o cliente (balcão)
  | 'online_control'   // 📍 Central — controle de entrega/retirada (online)
  | 'mesa_bill'        // 🧾 Central — conta do cliente (fechamento de mesa)
  | 'financial'        // 💳 Central — cupom financeiro pós-pagamento

export type PrinterConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

// ─── Job na fila (Firestore: print_queue) ────────────────────────────────────

export interface PrintJob {
  id:           string
  restaurantId: string
  orderId:      string
  origin:       'mesa' | 'marmita' | 'balcao' | 'online'
  target:       PrinterTarget   // qual impressora deve processar
  ticketType:   TicketType      // qual template usar
  label:        string          // "Mesa 5" | "João Silva" | "Balcão #3"
  deliveryInfo?: string
  phone?:       string
  notes?:       string
  items:        Array<{ name: string; qty: number; price: number; size?: string }>
  total:        number
  seqIndex?:    number          // posição na fila (para ticket de retirada)
  paymentMethod?: string        // para cupom financeiro
  serviceRate?:   number        // para cupom financeiro / conta mesa
  createdAt:    Date

  print: {
    status:     PrintJobStatus
    tentativas: number
    ultimoErro: string | null
    timestamp:  number | null
    device?:    string
  }
}

// ─── Config de cada impressora ────────────────────────────────────────────────

export interface PrinterConfig {
  target:             PrinterTarget
  connectionType:     'browser' | 'serial' | 'bluetooth'
  deviceName:         string
  serviceUUID:        string
  characteristicUUID: string
  serialBaudRate:     number
  paperWidth:         48 | 58
  autoReconnect:      boolean
  maxRetries:         number
  retryDelayMs:       number
}

// ─── Templates editáveis (salvos no Firestore por restaurante) ────────────────

export interface TicketTemplate {
  restaurantName:   string      // nome no cabeçalho
  headerExtra?:     string      // linha extra no cabeçalho (ex: endereço)
  footerMessage:    string      // mensagem de rodapé
  showPrices:       boolean     // exibir preços nos itens
  showTotal:        boolean     // exibir total
  showServiceRate:  boolean     // exibir taxa de serviço
  showPhone:        boolean     // exibir telefone do cliente
  showAddress:      boolean     // exibir endereço de entrega
  showPayment:      boolean     // exibir forma de pagamento
  paperWidth:       48 | 58
}

export interface PrintTemplates {
  kitchen_prep:    TicketTemplate
  balcao_retirada: TicketTemplate
  online_control:  TicketTemplate
  mesa_bill:       TicketTemplate
  financial:       TicketTemplate
}

export const DEFAULT_TEMPLATES: PrintTemplates = {
  kitchen_prep: {
    restaurantName:  'COZINHA',
    footerMessage:   '',
    showPrices:      false,
    showTotal:       false,
    showServiceRate: false,
    showPhone:       false,
    showAddress:     false,
    showPayment:     false,
    paperWidth:      48,
  },
  balcao_retirada: {
    restaurantName:  'BALCÃO',
    footerMessage:   'Aguarde ser chamado!',
    showPrices:      false,
    showTotal:       false,
    showServiceRate: false,
    showPhone:       false,
    showAddress:     false,
    showPayment:     false,
    paperWidth:      48,
  },
  online_control: {
    restaurantName:  'PEDIDO ONLINE',
    footerMessage:   'Confirmar dados do cliente',
    showPrices:      true,
    showTotal:       true,
    showServiceRate: false,
    showPhone:       true,
    showAddress:     true,
    showPayment:     false,
    paperWidth:      48,
  },
  mesa_bill: {
    restaurantName:  'CONTA',
    footerMessage:   'Obrigado pela preferência!',
    showPrices:      true,
    showTotal:       true,
    showServiceRate: true,
    showPhone:       false,
    showAddress:     false,
    showPayment:     false,
    paperWidth:      48,
  },
  financial: {
    restaurantName:  'CUPOM',
    footerMessage:   'Volte sempre!',
    showPrices:      true,
    showTotal:       true,
    showServiceRate: true,
    showPhone:       false,
    showAddress:     false,
    showPayment:     true,
    paperWidth:      48,
  },
}

// ─── Defaults de cada impressora ──────────────────────────────────────────────

export const DEFAULT_KITCHEN_CONFIG: PrinterConfig = {
  target:             'kitchen',
  connectionType:     'browser',
  deviceName:         'Impressora Cozinha',
  serviceUUID:        '000018f0-0000-1000-8000-00805f9b34fb',
  characteristicUUID: '00002af1-0000-1000-8000-00805f9b34fb',
  serialBaudRate:     9600,
  paperWidth:         48,
  autoReconnect:      true,
  maxRetries:         5,
  retryDelayMs:       5000,
}

export const DEFAULT_CENTRAL_CONFIG: PrinterConfig = {
  target:             'central',
  connectionType:     'browser',
  deviceName:         'Impressora Central',
  serviceUUID:        '000018f0-0000-1000-8000-00805f9b34fb',
  characteristicUUID: '00002af1-0000-1000-8000-00805f9b34fb',
  serialBaudRate:     9600,
  paperWidth:         48,
  autoReconnect:      true,
  maxRetries:         5,
  retryDelayMs:       5000,
}

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

// Re-exporta para compatibilidade
export type { PrinterConfig as PrinterConfigLegacy }
export const DEFAULT_PRINTER_CONFIG = DEFAULT_KITCHEN_CONFIG
