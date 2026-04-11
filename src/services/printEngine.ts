/**
 * printEngine.ts
 *
 * Motor de impressão ESC/POS via Web Bluetooth API.
 * Gerencia conexão, reconexão automática e geração do cupom.
 *
 * Compatível com impressoras térmicas Bluetooth que expõem
 * um GATT characteristic gravável (write-without-response ou write).
 */

import type { PrintJob, PrinterConfig } from '@/types/print'
import { DEFAULT_PRINTER_CONFIG } from '@/types/print'

// ─── ESC/POS byte helpers ────────────────────────────────────────────────────

const ESC = 0x1b
const GS  = 0x1d
const LF  = 0x0a

const CMD = {
  init:       new Uint8Array([ESC, 0x40]),                    // ESC @ — inicializar
  boldOn:     new Uint8Array([ESC, 0x45, 0x01]),              // ESC E 1 — negrito ligado
  boldOff:    new Uint8Array([ESC, 0x45, 0x00]),              // ESC E 0 — negrito desligado
  centerOn:   new Uint8Array([ESC, 0x61, 0x01]),              // ESC a 1 — centralizar
  leftAlign:  new Uint8Array([ESC, 0x61, 0x00]),              // ESC a 0 — alinhar esquerda
  fontLarge:  new Uint8Array([GS,  0x21, 0x11]),              // GS ! 0x11 — fonte grande
  fontNormal: new Uint8Array([GS,  0x21, 0x00]),              // GS ! 0 — fonte normal
  cutFull:    new Uint8Array([GS,  0x56, 0x41, 0x00]),        // GS V A 0 — corte total
  cutPartial: new Uint8Array([GS,  0x56, 0x42, 0x00]),        // GS V B 0 — corte parcial
  feed2:      new Uint8Array([ESC, 0x64, 0x02]),              // ESC d 2 — avança 2 linhas
  feed4:      new Uint8Array([ESC, 0x64, 0x04]),              // ESC d 4 — avança 4 linhas
  beep:       new Uint8Array([ESC, 0x42, 0x03, 0x01]),        // ESC B 3 1 — bipe 3x
}

function encode(text: string): Uint8Array {
  // Substitui caracteres acentuados por equivalentes ASCII para compatibilidade
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '?')
  return new TextEncoder().encode(normalized + '\n')
}

function divider(cols: number, char = '-'): Uint8Array {
  return encode(char.repeat(cols))
}

function padRight(text: string, width: number): string {
  return text.slice(0, width).padEnd(width)
}

function formatMoney(value: number): string {
  return `R$ ${value.toFixed(2)}`
}

// ─── Geração do cupom ─────────────────────────────────────────────────────────

export function buildTicketBuffer(job: PrintJob, config: PrinterConfig): Uint8Array {
  const cols   = config.paperWidth
  const chunks: Uint8Array[] = []

  const push = (...parts: Uint8Array[]) => chunks.push(...parts)
  const text = (t: string) => chunks.push(encode(t))

  const time = job.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const date = job.createdAt.toLocaleDateString('pt-BR')

  // ── Cabeçalho ──────────────────────────────────────────────────────────────
  push(CMD.init, CMD.beep)
  push(CMD.centerOn, CMD.fontLarge, CMD.boldOn)
  text(config.restaurantName)
  push(CMD.fontNormal, CMD.boldOff)
  push(divider(cols, '='))

  // ── Identificação do pedido ────────────────────────────────────────────────
  push(CMD.centerOn, CMD.boldOn)
  const originLabel: Record<string, string> = {
    mesa:    'MESA',
    marmita: 'MARMITARIA',
    balcao:  'BALCAO',
    online:  'ONLINE',
  }
  text(`${originLabel[job.origin] ?? job.origin} — ${job.label}`)
  push(CMD.boldOff)

  if (job.deliveryInfo) {
    push(CMD.centerOn)
    text(job.deliveryInfo)
  }

  push(CMD.centerOn)
  text(`${date}  ${time}`)
  push(divider(cols, '='))

  // ── Itens ──────────────────────────────────────────────────────────────────
  push(CMD.leftAlign)
  for (const item of job.items) {
    const qtyStr  = `${item.qty}x`
    const name    = item.size ? `${item.name} (${item.size})` : item.name
    const price   = formatMoney(item.price * item.qty)
    // ex: "  2x  Hamburguer X-Tudo          R$ 30.00"
    const nameWidth = cols - qtyStr.length - 2 - price.length - 2
    const line = `${qtyStr}  ${padRight(name, nameWidth)}  ${price}`
    push(CMD.boldOn)
    text(line)
    push(CMD.boldOff)
  }

  push(divider(cols, '-'))

  // ── Total ──────────────────────────────────────────────────────────────────
  push(CMD.boldOn)
  const totalLabel = 'TOTAL:'
  const totalValue = formatMoney(job.total)
  const totalPad   = cols - totalLabel.length - totalValue.length
  text(`${totalLabel}${' '.repeat(Math.max(1, totalPad))}${totalValue}`)
  push(CMD.boldOff)

  // ── Observações ────────────────────────────────────────────────────────────
  if (job.notes) {
    push(divider(cols, '-'))
    push(CMD.boldOn)
    text('OBS:')
    push(CMD.boldOff)
    // quebra observação em linhas de cols caracteres
    const words = job.notes.split(' ')
    let line = ''
    for (const word of words) {
      if ((line + word).length > cols - 2) {
        text(`  ${line.trim()}`)
        line = ''
      }
      line += word + ' '
    }
    if (line.trim()) text(`  ${line.trim()}`)
  }

  push(divider(cols, '='))

  // ── Rodapé ─────────────────────────────────────────────────────────────────
  push(CMD.centerOn)
  text('Obrigado pela preferencia!')
  push(CMD.feed4, CMD.cutPartial)

  // Concatena todos os chunks
  const total = chunks.reduce((s, c) => s + c.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

// ─── Gerenciador de conexão Bluetooth ────────────────────────────────────────

export class BluetoothPrinter {
  private device:         BluetoothDevice | null = null
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null
  private config:         PrinterConfig
  private reconnecting    = false
  private onStatusChange: (status: string) => void

  constructor(
    config: PrinterConfig,
    onStatusChange: (status: string) => void,
  ) {
    this.config         = config
    this.onStatusChange = onStatusChange
  }

  get isConnected(): boolean {
    return !!(this.device?.gatt?.connected && this.characteristic)
  }

  /** Solicita ao usuário que escolha uma impressora Bluetooth */
  async connect(): Promise<void> {
    if (!('bluetooth' in navigator)) {
      throw new Error('Web Bluetooth não suportado neste navegador. Use Chrome no Android.')
    }

    this.onStatusChange('connecting')

    try {
      // Solicita dispositivo — abre seletor nativo do browser
      this.device = await (navigator as any).bluetooth.requestDevice({
        filters:          [{ services: [this.config.serviceUUID] }],
        optionalServices: [this.config.serviceUUID],
      })

      // Registra handler de desconexão para auto-reconexão
      this.device.addEventListener('gattserverdisconnected', () => {
        this.characteristic = null
        this.onStatusChange('disconnected')
        if (this.config.autoReconnect) {
          this.scheduleReconnect()
        }
      })

      await this.connectGATT()
    } catch (err: any) {
      this.onStatusChange('error')
      throw new Error(`Falha ao conectar: ${err?.message ?? err}`)
    }
  }

  private async connectGATT(): Promise<void> {
    if (!this.device) throw new Error('Nenhum dispositivo selecionado')

    const server = await this.device.gatt!.connect()
    const service = await server.getPrimaryService(this.config.serviceUUID)
    this.characteristic = await service.getCharacteristic(this.config.characteristicUUID)
    this.onStatusChange('connected')
  }

  private scheduleReconnect(): void {
    if (this.reconnecting) return
    this.reconnecting = true
    this.onStatusChange('connecting')

    const attempt = async () => {
      if (!this.device || this.device.gatt?.connected) {
        this.reconnecting = false
        return
      }
      try {
        await this.connectGATT()
        this.reconnecting = false
      } catch {
        setTimeout(attempt, 5000)
      }
    }

    setTimeout(attempt, 2000)
  }

  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect()
    }
    this.device         = null
    this.characteristic = null
    this.onStatusChange('disconnected')
  }

  /** Envia buffer ESC/POS para a impressora em chunks de 512 bytes */
  async send(data: Uint8Array): Promise<void> {
    if (!this.characteristic) {
      throw new Error('Impressora não conectada')
    }

    const CHUNK_SIZE = 512
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE)
      await this.characteristic.writeValueWithoutResponse(chunk)
      // pequeno delay entre chunks para não sobrecarregar o buffer
      await new Promise((r) => setTimeout(r, 20))
    }
  }

  updateConfig(config: PrinterConfig): void {
    this.config = config
  }
}

// ─── Config storage helpers ───────────────────────────────────────────────────

const STORAGE_KEY = 'foodstore_printer_config'

export function loadPrinterConfig(): PrinterConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_PRINTER_CONFIG, ...JSON.parse(raw) }
  } catch {
    // ignora erros de parse
  }
  return { ...DEFAULT_PRINTER_CONFIG }
}

export function savePrinterConfig(config: PrinterConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}
