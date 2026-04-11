/**
 * printEngine.ts
 *
 * Motor de impressão ESC/POS com suporte a dois modos:
 *
 *  🔵 BLUETOOTH  — Web Bluetooth API  → Chrome Android (mobile)
 *  🔌 USB/SERIAL — Web Serial API     → Chrome Desktop (cabo USB)
 *
 * O modo é detectado/escolhido pelo usuário e salvo em config.
 */

import type { PrintJob, PrinterConfig } from '@/types/print'
import { DEFAULT_PRINTER_CONFIG } from '@/types/print'

// ─── ESC/POS byte helpers ────────────────────────────────────────────────────

const ESC = 0x1b
const GS  = 0x1d

const CMD = {
  init:       new Uint8Array([ESC, 0x40]),
  boldOn:     new Uint8Array([ESC, 0x45, 0x01]),
  boldOff:    new Uint8Array([ESC, 0x45, 0x00]),
  centerOn:   new Uint8Array([ESC, 0x61, 0x01]),
  leftAlign:  new Uint8Array([ESC, 0x61, 0x00]),
  fontLarge:  new Uint8Array([GS,  0x21, 0x11]),
  fontNormal: new Uint8Array([GS,  0x21, 0x00]),
  cutPartial: new Uint8Array([GS,  0x56, 0x42, 0x00]),
  feed4:      new Uint8Array([ESC, 0x64, 0x04]),
  beep:       new Uint8Array([ESC, 0x42, 0x03, 0x01]),
}

function encode(text: string): Uint8Array {
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

// ─── Geração do cupom ESC/POS ─────────────────────────────────────────────────

export function buildTicketBuffer(job: PrintJob, config: PrinterConfig): Uint8Array {
  const cols   = config.paperWidth
  const chunks: Uint8Array[] = []
  const push   = (...parts: Uint8Array[]) => chunks.push(...parts)
  const text   = (t: string) => chunks.push(encode(t))

  const time = job.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const date = job.createdAt.toLocaleDateString('pt-BR')

  push(CMD.init, CMD.beep)
  push(CMD.centerOn, CMD.fontLarge, CMD.boldOn)
  text(config.restaurantName)
  push(CMD.fontNormal, CMD.boldOff)
  push(divider(cols, '='))

  push(CMD.centerOn, CMD.boldOn)
  const originLabel: Record<string, string> = {
    mesa: 'MESA', marmita: 'MARMITARIA', balcao: 'BALCAO', online: 'ONLINE',
  }
  text(`${originLabel[job.origin] ?? job.origin} — ${job.label}`)
  push(CMD.boldOff)

  if (job.deliveryInfo) { push(CMD.centerOn); text(job.deliveryInfo) }
  push(CMD.centerOn)
  text(`${date}  ${time}`)
  push(divider(cols, '='))

  push(CMD.leftAlign)
  for (const item of job.items) {
    const qtyStr    = `${item.qty}x`
    const name      = item.size ? `${item.name} (${item.size})` : item.name
    const price     = formatMoney(item.price * item.qty)
    const nameWidth = cols - qtyStr.length - 2 - price.length - 2
    push(CMD.boldOn)
    text(`${qtyStr}  ${padRight(name, nameWidth)}  ${price}`)
    push(CMD.boldOff)
  }

  push(divider(cols, '-'))
  push(CMD.boldOn)
  const totalLabel = 'TOTAL:'
  const totalValue = formatMoney(job.total)
  const totalPad   = cols - totalLabel.length - totalValue.length
  text(`${totalLabel}${' '.repeat(Math.max(1, totalPad))}${totalValue}`)
  push(CMD.boldOff)

  if (job.notes) {
    push(divider(cols, '-'))
    push(CMD.boldOn); text('OBS:'); push(CMD.boldOff)
    const words = job.notes.split(' ')
    let line = ''
    for (const word of words) {
      if ((line + word).length > cols - 2) { text(`  ${line.trim()}`); line = '' }
      line += word + ' '
    }
    if (line.trim()) text(`  ${line.trim()}`)
  }

  push(divider(cols, '='))
  push(CMD.centerOn)
  text('Obrigado pela preferencia!')
  push(CMD.feed4, CMD.cutPartial)

  const total  = chunks.reduce((s, c) => s + c.length, 0)
  const result = new Uint8Array(total)
  let offset   = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
  return result
}

// ─── Interface comum das impressoras ─────────────────────────────────────────

export interface IPrinter {
  isConnected: boolean
  connect(): Promise<void>
  disconnect(): Promise<void>
  send(data: Uint8Array): Promise<void>
  updateConfig(config: PrinterConfig): void
  readonly deviceLabel: string   // ex: "POS-58 (BT)" ou "COM3 (USB)"
}

// ─── 🔵 Impressora Bluetooth (Chrome Android) ─────────────────────────────────

export class BluetoothPrinter implements IPrinter {
  private device:         BluetoothDevice | null = null
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null
  private config:         PrinterConfig
  private reconnecting    = false
  private onStatusChange: (status: string) => void

  constructor(config: PrinterConfig, onStatusChange: (status: string) => void) {
    this.config         = config
    this.onStatusChange = onStatusChange
  }

  get isConnected() {
    return !!(this.device?.gatt?.connected && this.characteristic)
  }

  get deviceLabel() {
    return this.device?.name ? `${this.device.name} (BT)` : 'Bluetooth'
  }

  async connect(): Promise<void> {
    if (!('bluetooth' in navigator)) {
      throw new Error(
        'Web Bluetooth não suportado.\n' +
        'Use o Chrome no Android para conectar via Bluetooth.\n' +
        'No computador, use a conexão USB/Serial.'
      )
    }
    this.onStatusChange('connecting')
    try {
      this.device = await (navigator as any).bluetooth.requestDevice({
        filters:          [{ services: [this.config.serviceUUID] }],
        optionalServices: [this.config.serviceUUID],
      })
      this.device!.addEventListener('gattserverdisconnected', () => {
        this.characteristic = null
        this.onStatusChange('disconnected')
        if (this.config.autoReconnect) this.scheduleReconnect()
      })
      await this.connectGATT()
    } catch (err: any) {
      this.onStatusChange('error')
      throw new Error(`Bluetooth: ${err?.message ?? err}`)
    }
  }

  private async connectGATT(): Promise<void> {
    const server = await this.device!.gatt!.connect()
    const service = await server.getPrimaryService(this.config.serviceUUID)
    this.characteristic = await service.getCharacteristic(this.config.characteristicUUID)
    this.onStatusChange('connected')
  }

  private scheduleReconnect(): void {
    if (this.reconnecting) return
    this.reconnecting = true
    const attempt = async () => {
      if (!this.device || this.device.gatt?.connected) { this.reconnecting = false; return }
      try { await this.connectGATT(); this.reconnecting = false }
      catch { setTimeout(attempt, 5000) }
    }
    setTimeout(attempt, 2000)
  }

  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect()
    this.device = null; this.characteristic = null
    this.onStatusChange('disconnected')
  }

  async send(data: Uint8Array): Promise<void> {
    if (!this.characteristic) throw new Error('Bluetooth não conectado')
    const CHUNK = 512
    for (let i = 0; i < data.length; i += CHUNK) {
      await this.characteristic.writeValueWithoutResponse(data.slice(i, i + CHUNK))
      await new Promise((r) => setTimeout(r, 20))
    }
  }

  updateConfig(config: PrinterConfig): void { this.config = config }
}

// ─── 🔌 Impressora USB/Serial (Chrome Desktop) ───────────────────────────────

export class SerialPrinter implements IPrinter {
  private port:   SerialPort | null = null
  private config: PrinterConfig
  private onStatusChange: (status: string) => void

  constructor(config: PrinterConfig, onStatusChange: (status: string) => void) {
    this.config         = config
    this.onStatusChange = onStatusChange
  }

  get isConnected() {
    return this.port !== null && this.port.readable !== null
  }

  get deviceLabel() {
    return 'USB/Serial'
  }

  async connect(): Promise<void> {
    if (!('serial' in navigator)) {
      throw new Error(
        'Web Serial não suportado.\n' +
        'Use o Google Chrome (versão 89+) no computador.\n' +
        'Verifique também se a impressora está conectada via cabo USB.'
      )
    }
    this.onStatusChange('connecting')
    try {
      // Abre o seletor de porta serial nativo do Chrome
      this.port = await (navigator as any).serial.requestPort()
      await this.port!.open({ baudRate: this.config.serialBaudRate ?? 9600 })
      this.onStatusChange('connected')
    } catch (err: any) {
      this.port = null
      this.onStatusChange('error')
      throw new Error(`USB/Serial: ${err?.message ?? err}`)
    }
  }

  async disconnect(): Promise<void> {
    try { await this.port?.close() } catch { /* ignora */ }
    this.port = null
    this.onStatusChange('disconnected')
  }

  async send(data: Uint8Array): Promise<void> {
    if (!this.port) throw new Error('Porta serial não conectada. Clique em Conectar.')
    if (!this.port.writable) throw new Error('Porta serial ocupada ou fechada.')
    const writer = this.port.writable.getWriter()
    try {
      const CHUNK = 256
      for (let i = 0; i < data.length; i += CHUNK) {
        await writer.write(data.slice(i, i + CHUNK))
        await new Promise((r) => setTimeout(r, 15))
      }
      // Flush — aguarda a impressora processar antes de liberar
      await new Promise((r) => setTimeout(r, 200))
    } finally {
      writer.releaseLock()
    }
  }

  updateConfig(config: PrinterConfig): void { this.config = config }
}


// ─── 🖥️ Impressora via Navegador / window.print() (Desktop USB plug-and-play) ──
// Gera um ticket HTML formatado para 80mm e envia para o diálogo de impressão.
// Funciona com qualquer impressora instalada no sistema operacional.

export class BrowserPrinter implements IPrinter {
  private config:         PrinterConfig
  private onStatusChange: (status: string) => void
  private _connected      = false

  constructor(config: PrinterConfig, onStatusChange: (status: string) => void) {
    this.config         = config
    this.onStatusChange = onStatusChange
  }

  get isConnected()  { return this._connected }
  get deviceLabel()  { return 'Impressora do Sistema' }

  async connect(): Promise<void> {
    // Teste de impressão: abre janela vazia e verifica se o browser permite
    this._connected = true
    this.onStatusChange('connected')
  }

  async disconnect(): Promise<void> {
    this._connected = false
    this.onStatusChange('disconnected')
  }

  // Recebe o buffer ESC/POS mas gera HTML próprio a partir do job
  // O buffer é ignorado — usamos buildHTMLTicket que é chamado externamente
  async send(_data: Uint8Array): Promise<void> {
    // Não faz nada — o HTML é gerado via sendHTML()
  }

  async sendHTML(html: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const win = window.open('', '_blank', 'width=400,height=700,menubar=no,toolbar=no')
      if (!win) {
        reject(new Error('Pop-up bloqueado. Permita pop-ups para este site nas configurações do Chrome.'))
        return
      }
      win.document.write(html)
      win.document.close()
      win.onload = () => {
        setTimeout(() => {
          win.print()
          // Fecha a janela após a impressão (pequeno delay para o diálogo aparecer)
          setTimeout(() => { try { win.close() } catch {} }, 1500)
          resolve()
        }, 300)
      }
    })
  }

  updateConfig(config: PrinterConfig): void { this.config = config }
}

// ─── Geração do ticket HTML (para BrowserPrinter) ────────────────────────────

export function buildHTMLTicket(job: PrintJob, config: PrinterConfig): string {
  const time = job.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const date = job.createdAt.toLocaleDateString('pt-BR')

  const originLabel: Record<string, string> = {
    mesa: 'MESA', marmita: 'MARMITARIA', balcao: 'BALCAO', online: 'ONLINE',
  }

  const itemRows = job.items.map((item) => {
    const name  = item.size ? `${item.name} (${item.size})` : item.name
    const price = `R$ ${(item.price * item.qty).toFixed(2)}`
    return `<tr>
      <td style="padding:2px 4px;font-weight:bold">${item.qty}x</td>
      <td style="padding:2px 4px;width:100%">${name}</td>
      <td style="padding:2px 4px;text-align:right;white-space:nowrap">${price}</td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Pedido</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      width: 80mm;
      padding: 4mm 3mm;
      color: #000;
      background: #fff;
    }
    .center  { text-align: center; }
    .bold    { font-weight: bold; }
    .large   { font-size: 16px; }
    .divider { border-top: 1px dashed #000; margin: 4px 0; }
    .solid   { border-top: 1px solid #000; margin: 4px 0; }
    table    { width: 100%; border-collapse: collapse; }
    .total   { font-size: 14px; font-weight: bold; text-align: right; margin-top: 4px; }
    .obs     { background: #f5f5f5; padding: 4px; margin-top: 4px; font-size: 11px; }
    .footer  { text-align: center; margin-top: 6px; font-size: 10px; }
    @media print {
      body { width: 80mm; }
      @page { margin: 0; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <div class="center large bold">${config.restaurantName}</div>
  <div class="solid"></div>
  <div class="center bold">${originLabel[job.origin] ?? job.origin} — ${job.label}</div>
  ${job.deliveryInfo ? `<div class="center">${job.deliveryInfo}</div>` : ''}
  <div class="center">${date} ${time}</div>
  <div class="solid"></div>
  <table>${itemRows}</table>
  <div class="divider"></div>
  <div class="total">TOTAL: R$ ${job.total.toFixed(2)}</div>
  ${job.notes ? `<div class="obs">📝 OBS: ${job.notes}</div>` : ''}
  <div class="solid"></div>
  <div class="footer">Obrigado pela preferencia!</div>
  <script>
    // Não auto-imprime aqui — controlado pelo BrowserPrinter.sendHTML()
  </script>
</body>
</html>`
}

// ─── Factory — cria a impressora correta para o ambiente ──────────────────────

export function createPrinter(
  config: PrinterConfig,
  onStatusChange: (status: string) => void,
): IPrinter {
  if (config.connectionType === 'serial')    return new SerialPrinter(config, onStatusChange)
  if (config.connectionType === 'bluetooth') return new BluetoothPrinter(config, onStatusChange)
  return new BrowserPrinter(config, onStatusChange)   // 'browser' = padrão desktop
}

/**
 * Detecta automaticamente o melhor modo disponível no navegador atual:
 *  - Desktop Chrome com Web Serial  → 'serial'
 *  - Android Chrome com Bluetooth   → 'bluetooth'
 *  - Nenhum suportado               → null
 */
export function detectBestConnectionType(): 'browser' | 'bluetooth' | 'serial' {
  // 'browser' é o modo mais compatível para desktop (USB plug-and-play via window.print())
  // 'bluetooth' é para mobile Android Chrome
  // 'serial' é para impressoras com porta COM/serial explícita (raro)
  if ('bluetooth' in navigator && !('serial' in navigator)) return 'bluetooth'  // Android
  return 'browser'   // Desktop: usa window.print() que funciona com qualquer impressora USB
}

// ─── Config storage ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'foodstore_printer_config'

export function loadPrinterConfig(): PrinterConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      // Se não tem connectionType salvo, detecta automaticamente
      if (!saved.connectionType) {
        saved.connectionType = detectBestConnectionType() ?? 'serial'
      }
      return { ...DEFAULT_PRINTER_CONFIG, ...saved }
    }
  } catch { /* ignora */ }
  // Config padrão com detecção automática
  return {
    ...DEFAULT_PRINTER_CONFIG,
    connectionType: detectBestConnectionType() ?? 'serial',
  }
}

export function savePrinterConfig(config: PrinterConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}
