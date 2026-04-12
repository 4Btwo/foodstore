/**
 * printEngine.ts
 *
 * Motor de impressão ESC/POS + HTML com 5 templates de ticket.
 *
 * Templates:
 *  kitchen_prep     — Cozinha: itens a preparar, sem preço
 *  balcao_retirada  — Central: número grande para o cliente esperar
 *  online_control   — Central: dados do cliente (endereço/retirada)
 *  mesa_bill        — Central: conta do cliente (itens + totais)
 *  financial        — Central: cupom financeiro com forma de pagamento
 *
 * Conexão:
 *  browser   — iframe oculto → window.print() → qualquer impressora USB
 *  bluetooth — Web Bluetooth → Chrome Android
 *  serial    — Web Serial    → porta COM (avançado)
 */

import type { PrintJob, PrinterConfig, TicketTemplate, PrintTemplates } from '@/types/print'
import {
  DEFAULT_KITCHEN_CONFIG, DEFAULT_CENTRAL_CONFIG,
  DEFAULT_TEMPLATES,
} from '@/types/print'

// ─── Shared HTML styles ───────────────────────────────────────────────────────

const BASE_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body {
    font-family:'Courier New',Courier,monospace;
    font-size:11pt; width:72mm; background:#fff; color:#000;
  }
  @media print { @page { size:80mm auto; margin:4mm; } }
  .center { text-align:center; }
  .bold   { font-weight:bold; }
  .small  { font-size:9pt; }
  .muted  { color:#555; }
  .solid  { border-top:1px solid #000; margin:2.5mm 0; }
  .dashed { border-top:1px dashed #999; margin:2mm 0; }
  .stars  { text-align:center; letter-spacing:3px; font-size:9pt; }
  .restaurant { text-align:center; font-size:15pt; font-weight:bold; letter-spacing:1px; margin:1mm 0; }
`

function wrapHTML(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"/><title>${title}</title>
<style>${BASE_CSS}</style>
</head><body>${body}</body></html>`
}

function headerHTML(restaurantName: string, headerExtra?: string): string {
  return `
  <div class="stars">* * * * * * * * *</div>
  <div class="restaurant">${restaurantName}</div>
  ${headerExtra ? `<div class="center small muted">${headerExtra}</div>` : ''}
  <div class="stars">* * * * * * * * *</div>`
}

function itemsTableHTML(
  items: PrintJob['items'],
  showPrices: boolean,
  sizeStyle = '10pt',
): string {
  return `<table style="width:100%;border-collapse:collapse;margin:2mm 0">
    ${items.map((item) => {
      const name = item.size ? `${item.name} <span style="font-size:9pt;font-weight:normal">(${item.size})</span>` : item.name
      const price = showPrices ? `<td style="text-align:right;white-space:nowrap;padding:1.5mm 1mm;font-size:10pt">R$ ${(item.price * item.qty).toFixed(2)}</td>` : ''
      return `<tr>
        <td style="font-weight:bold;font-size:13pt;width:10mm;padding:1.5mm 1mm;vertical-align:top">${item.qty}x</td>
        <td style="font-weight:bold;font-size:${sizeStyle};padding:1.5mm 1mm;width:100%;vertical-align:top">${name}</td>
        ${price}
      </tr>`
    }).join('')}
  </table>`
}

function obsHTML(notes: string): string {
  return `<div style="border:1.5px dashed #000;padding:2mm 3mm;margin:2mm 0">
    <div style="font-weight:bold;font-size:9pt;margin-bottom:1mm">⚠ OBSERVACAO:</div>
    <div style="font-size:11pt">${notes}</div>
  </div>`
}

function totalsHTML(
  items: PrintJob['items'],
  serviceRate: number,
  showService: boolean,
  paymentMethod?: string,
  showPayment?: boolean,
): string {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const service  = subtotal * (serviceRate ?? 0)
  const total    = subtotal + service
  return `
  <div style="padding:2mm 1mm">
    <div style="display:flex;justify-content:space-between;font-size:10pt;padding:0.5mm 0;color:#555">
      <span>Subtotal</span><span>R$ ${subtotal.toFixed(2)}</span>
    </div>
    ${showService && serviceRate > 0 ? `
    <div style="display:flex;justify-content:space-between;font-size:10pt;padding:0.5mm 0;color:#666">
      <span>Taxa serviço (${(serviceRate * 100).toFixed(0)}%)</span><span>R$ ${service.toFixed(2)}</span>
    </div>` : ''}
    <div style="display:flex;justify-content:space-between;font-size:15pt;font-weight:bold;border-top:1.5px solid #000;padding-top:1.5mm;margin-top:0.5mm">
      <span>TOTAL</span><span>R$ ${total.toFixed(2)}</span>
    </div>
  </div>
  ${showPayment && paymentMethod ? `
  <div style="text-align:center;padding:2mm;background:#f0f0f0;font-size:12pt;font-weight:bold;margin:1.5mm 0">
    ✓ ${paymentMethod}
  </div>` : ''}`
}

// ─── 5 TEMPLATES DE TICKET ────────────────────────────────────────────────────

/** 🍳 Cozinha — preparo, sem preço */
export function buildKitchenTicket(job: PrintJob, tpl: TicketTemplate): string {
  const seqNumber = job.orderId.slice(-4).toUpperCase()
  const seqDisplay = job.seqIndex ?? '?'
  const time = job.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const ORIGIN: Record<string, string> = {
    mesa:'MESA', marmita:'MARMITARIA', balcao:'BALCAO', online:'ONLINE',
  }
  const body = `
  <div class="center small muted" style="padding:1mm 0">— ${tpl.restaurantName} —</div>
  <div class="dashed"></div>
  <div class="center" style="padding:2mm 0">
    <div style="font-size:48pt;font-weight:900;line-height:1">${seqDisplay}</div>
    <div class="small muted">Nº na fila</div>
  </div>
  <div class="solid"></div>
  <div class="center" style="font-size:14pt;font-weight:bold;text-transform:uppercase;margin:1mm 0">${ORIGIN[job.origin] ?? job.origin}</div>
  <div class="center bold" style="font-size:12pt">${job.label}</div>
  <div class="center small" style="color:#555;font-size:10pt">#${seqNumber} &nbsp;·&nbsp; ${time}</div>
  ${job.deliveryInfo ? `<div class="center bold" style="background:#000;color:#fff;padding:1mm 3mm;margin:1.5mm auto;display:block;font-size:10pt">${job.deliveryInfo}</div>` : ''}
  <div class="solid"></div>
  ${itemsTableHTML(job.items, false, '12pt')}
  ${job.notes ? obsHTML(job.notes) : ''}
  <div class="dashed"></div>
  <div class="center small muted">${time}</div>`
  return wrapHTML(`Cozinha #${seqNumber}`, body)
}

/** 🎫 Balcão — número de retirada para o cliente */
export function buildBalcaoRetiradaTicket(job: PrintJob, tpl: TicketTemplate): string {
  const seqNumber  = job.orderId.slice(-4).toUpperCase()
  const seqDisplay = job.seqIndex ?? seqNumber
  const time = job.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const body = `
  ${headerHTML(tpl.restaurantName, tpl.headerExtra)}
  <div class="solid"></div>
  <div class="center" style="padding:3mm 0">
    <div class="small muted">Número do pedido</div>
    <div style="font-size:56pt;font-weight:900;line-height:1;letter-spacing:3px">${seqDisplay}</div>
    <div class="small muted">#${seqNumber}</div>
  </div>
  <div class="solid"></div>
  <div class="center" style="font-size:13pt;font-weight:bold;padding:1mm 0">Aguarde ser chamado!</div>
  <div class="dashed"></div>
  ${itemsTableHTML(job.items, tpl.showPrices)}
  ${job.notes ? obsHTML(job.notes) : ''}
  <div class="solid"></div>
  <div class="center small muted">${time} &nbsp;·&nbsp; ${tpl.footerMessage || 'Balcão'}</div>`
  return wrapHTML(`Retirada #${seqDisplay}`, body)
}

/** 📍 Online — controle de entrega/retirada na central */
export function buildOnlineControlTicket(job: PrintJob, tpl: TicketTemplate): string {
  const seqNumber = job.orderId.slice(-4).toUpperCase()
  const time = job.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const date = job.createdAt.toLocaleDateString('pt-BR')
  const body = `
  ${headerHTML(tpl.restaurantName, tpl.headerExtra)}
  <div class="solid"></div>
  <div class="center" style="padding:2mm 0">
    <div style="font-size:14pt;font-weight:bold">PEDIDO ONLINE</div>
    <div style="font-size:18pt;font-weight:900">#${seqNumber}</div>
    <div style="font-size:12pt;font-weight:bold">${job.label}</div>
  </div>
  ${job.deliveryInfo ? `<div style="background:#000;color:#fff;text-align:center;padding:1.5mm 3mm;font-size:11pt;font-weight:bold;margin:1mm 0">${job.deliveryInfo}</div>` : ''}
  ${tpl.showPhone && job.phone ? `<div class="center small" style="margin:0.5mm 0">📞 ${job.phone}</div>` : ''}
  <div class="center small muted">${date} · ${time}</div>
  <div class="solid"></div>
  ${itemsTableHTML(job.items, tpl.showPrices)}
  ${job.notes ? obsHTML(job.notes) : ''}
  ${tpl.showTotal ? `<div class="dashed"></div>${totalsHTML(job.items, 0, false)}` : ''}
  <div class="solid"></div>
  <div class="center small muted">${tpl.footerMessage}</div>`
  return wrapHTML(`Online #${seqNumber}`, body)
}

/** 🧾 Mesa — conta do cliente (sem pagamento ainda) */
export function buildMesaBillTicket(job: PrintJob, tpl: TicketTemplate): string {
  const seqNumber = job.orderId.replace('_bill','').slice(-4).toUpperCase()
  const time  = job.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const date  = job.createdAt.toLocaleDateString('pt-BR')
  const now   = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const body = `
  ${headerHTML(tpl.restaurantName, tpl.headerExtra)}
  <div class="solid"></div>
  <div class="center" style="padding:2mm 0">
    <div style="font-size:14pt;font-weight:bold">${job.label}</div>
    <div class="small muted">#${seqNumber}</div>
    <div class="small muted">Abertura: ${time} · Fechamento: ${now}</div>
    <div class="small muted">${date}</div>
  </div>
  <div class="solid"></div>
  ${itemsTableHTML(job.items, true)}
  <div class="dashed"></div>
  ${totalsHTML(job.items, job.serviceRate ?? 0, tpl.showServiceRate)}
  ${job.notes ? obsHTML(job.notes) : ''}
  <div class="solid"></div>
  <div class="center small muted">${tpl.footerMessage}</div>`
  return wrapHTML(`Conta ${job.label}`, body)
}

/** 💳 Cupom financeiro — pós-pagamento */
export function buildFinancialTicket(job: PrintJob, tpl: TicketTemplate): string {
  const seqNumber = job.orderId.slice(-4).toUpperCase()
  const time  = job.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const date  = job.createdAt.toLocaleDateString('pt-BR')
  const now   = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const body = `
  ${headerHTML(tpl.restaurantName, tpl.headerExtra)}
  <div class="solid"></div>
  <div class="center" style="padding:2mm 0">
    <div style="font-size:12pt;font-weight:bold">${job.label}</div>
    <div class="small muted">#${seqNumber} · ${date} · ${time} → ${now}</div>
  </div>
  <div class="solid"></div>
  ${itemsTableHTML(job.items, true)}
  <div class="dashed"></div>
  ${totalsHTML(job.items, job.serviceRate ?? 0, tpl.showServiceRate, job.paymentMethod, tpl.showPayment)}
  ${job.notes ? obsHTML(job.notes) : ''}
  <div class="solid"></div>
  <div class="center small muted">${tpl.footerMessage}</div>`
  return wrapHTML(`Cupom #${seqNumber}`, body)
}

/** Dispatch — gera o HTML correto para cada ticketType */
export function buildTicketHTML(job: PrintJob, templates: PrintTemplates): string {
  const tpl = templates[job.ticketType]
  switch (job.ticketType) {
    case 'kitchen_prep':    return buildKitchenTicket(job, tpl)
    case 'balcao_retirada': return buildBalcaoRetiradaTicket(job, tpl)
    case 'online_control':  return buildOnlineControlTicket(job, tpl)
    case 'mesa_bill':       return buildMesaBillTicket(job, tpl)
    case 'financial':       return buildFinancialTicket(job, tpl)
    default:                return buildKitchenTicket(job, tpl)
  }
}

// ─── Interface comum das impressoras ─────────────────────────────────────────

export interface IPrinter {
  isConnected:   boolean
  deviceLabel:   string
  connect():     Promise<void>
  disconnect():  Promise<void>
  send(data: Uint8Array): Promise<void>
  sendHTML(html: string): Promise<void>
  updateConfig(config: PrinterConfig): void
}

// ─── 🖥️ Impressora via window.print() (USB plug-and-play) ───────────────────

export class BrowserPrinter implements IPrinter {
  private _connected = false
  private config: PrinterConfig

  constructor(config: PrinterConfig, _onStatusChange: (s: string) => void) {
    this.config = config
  }

  get isConnected() { return this._connected }
  get deviceLabel()  { return 'Impressora do Sistema' }

  async connect()    { this._connected = true }
  async disconnect() { this._connected = false }
  async send(_: Uint8Array) { /* não usado — usa sendHTML */ }

  async sendHTML(html: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = document.getElementById('__print_frame__')
      if (existing) existing.remove()

      const iframe = document.createElement('iframe')
      iframe.id = '__print_frame__'
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:80mm;height:1px;border:none;'
      document.body.appendChild(iframe)

      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (!doc) { reject(new Error('Erro ao criar frame de impressão')); return }

      doc.open(); doc.write(html); doc.close()

      const doprint = () => {
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
          setTimeout(() => { try { iframe.remove() } catch {} }, 2000)
          resolve()
        } catch (err) { reject(err) }
      }

      if (iframe.contentDocument?.readyState === 'complete') {
        setTimeout(doprint, 250)
      } else {
        iframe.onload = () => setTimeout(doprint, 250)
        setTimeout(doprint, 1000)
      }
    })
  }

  updateConfig(config: PrinterConfig) { this.config = config }
}

// ─── 🔵 Impressora Bluetooth ──────────────────────────────────────────────────

export class BluetoothPrinter implements IPrinter {
  private device:         BluetoothDevice | null = null
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null
  private config:         PrinterConfig
  private reconnecting    = false
  private onStatusChange: (s: string) => void

  constructor(config: PrinterConfig, onStatusChange: (s: string) => void) {
    this.config = config; this.onStatusChange = onStatusChange
  }

  get isConnected() { return !!(this.device?.gatt?.connected && this.characteristic) }
  get deviceLabel()  { return this.device?.name ? `${this.device.name} (BT)` : 'Bluetooth' }

  async connect(): Promise<void> {
    if (!('bluetooth' in navigator)) throw new Error('Web Bluetooth não suportado. Use Chrome Android.')
    this.onStatusChange('connecting')
    this.device = await (navigator as any).bluetooth.requestDevice({
      filters: [{ services: [this.config.serviceUUID] }],
      optionalServices: [this.config.serviceUUID],
    })
    this.device!.addEventListener('gattserverdisconnected', () => {
      this.characteristic = null
      this.onStatusChange('disconnected')
      if (this.config.autoReconnect) this.scheduleReconnect()
    })
    await this.connectGATT()
  }

  private async connectGATT() {
    const server = await this.device!.gatt!.connect()
    const svc    = await server.getPrimaryService(this.config.serviceUUID)
    this.characteristic = await svc.getCharacteristic(this.config.characteristicUUID)
    this.onStatusChange('connected')
  }

  private scheduleReconnect() {
    if (this.reconnecting) return
    this.reconnecting = true
    const attempt = async () => {
      if (!this.device || this.device.gatt?.connected) { this.reconnecting = false; return }
      try { await this.connectGATT(); this.reconnecting = false }
      catch { setTimeout(attempt, 5000) }
    }
    setTimeout(attempt, 2000)
  }

  async disconnect() {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect()
    this.device = null; this.characteristic = null
    this.onStatusChange('disconnected')
  }

  async send(data: Uint8Array) {
    if (!this.characteristic) throw new Error('Bluetooth não conectado')
    const CHUNK = 512
    for (let i = 0; i < data.length; i += CHUNK) {
      await this.characteristic.writeValueWithoutResponse(data.slice(i, i + CHUNK))
      await new Promise(r => setTimeout(r, 20))
    }
  }

  async sendHTML(html: string) {
    // Bluetooth usa ESC/POS — converte via BrowserPrinter como fallback
    const bp = new BrowserPrinter(this.config, () => {})
    await bp.sendHTML(html)
  }

  updateConfig(config: PrinterConfig) { this.config = config }
}

// ─── 🔌 Impressora Serial/COM ─────────────────────────────────────────────────

export class SerialPrinter implements IPrinter {
  private port:   SerialPort | null = null
  private config: PrinterConfig
  private onStatusChange: (s: string) => void

  constructor(config: PrinterConfig, onStatusChange: (s: string) => void) {
    this.config = config; this.onStatusChange = onStatusChange
  }

  get isConnected() { return this.port !== null && this.port.readable !== null }
  get deviceLabel()  { return 'USB/Serial (COM)' }

  async connect() {
    if (!('serial' in navigator)) throw new Error('Web Serial não suportado. Use Chrome Desktop.')
    this.onStatusChange('connecting')
    this.port = await (navigator as any).serial.requestPort()
    await this.port!.open({ baudRate: this.config.serialBaudRate ?? 9600 })
    this.onStatusChange('connected')
  }

  async disconnect() {
    try { await this.port?.close() } catch {}
    this.port = null; this.onStatusChange('disconnected')
  }

  async send(data: Uint8Array) {
    if (!this.port?.writable) throw new Error('Porta serial não conectada')
    const writer = this.port.writable.getWriter()
    try {
      const CHUNK = 256
      for (let i = 0; i < data.length; i += CHUNK) {
        await writer.write(data.slice(i, i + CHUNK))
        await new Promise(r => setTimeout(r, 15))
      }
      await new Promise(r => setTimeout(r, 200))
    } finally { writer.releaseLock() }
  }

  async sendHTML(html: string) {
    const bp = new BrowserPrinter(this.config, () => {})
    await bp.sendHTML(html)
  }

  updateConfig(config: PrinterConfig) { this.config = config }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createPrinter(config: PrinterConfig, onStatusChange: (s: string) => void): IPrinter {
  if (config.connectionType === 'bluetooth') return new BluetoothPrinter(config, onStatusChange)
  if (config.connectionType === 'serial')    return new SerialPrinter(config, onStatusChange)
  return new BrowserPrinter(config, onStatusChange)
}

export function detectBestConnectionType(): 'browser' | 'bluetooth' | 'serial' {
  if ('bluetooth' in navigator && !('serial' in navigator)) return 'bluetooth'
  return 'browser'
}

// ─── Config storage (separado por target) ─────────────────────────────────────

const KEY = (target: string) => `foodstore_printer_${target}`

export function loadPrinterConfig(target: 'kitchen' | 'central'): PrinterConfig {
  const defaults = target === 'kitchen' ? DEFAULT_KITCHEN_CONFIG : DEFAULT_CENTRAL_CONFIG
  try {
    const raw = localStorage.getItem(KEY(target))
    if (raw) return { ...defaults, ...JSON.parse(raw), target }
  } catch {}
  return { ...defaults, connectionType: detectBestConnectionType() }
}

export function savePrinterConfig(config: PrinterConfig): void {
  localStorage.setItem(KEY(config.target), JSON.stringify(config))
}

// ─── Template storage (Firestore via restaurantId) ────────────────────────────

export function loadLocalTemplates(): PrintTemplates {
  try {
    const raw = localStorage.getItem('foodstore_print_templates')
    if (raw) return { ...DEFAULT_TEMPLATES, ...JSON.parse(raw) }
  } catch {}
  return { ...DEFAULT_TEMPLATES }
}

export function saveLocalTemplates(tpl: PrintTemplates): void {
  localStorage.setItem('foodstore_print_templates', JSON.stringify(tpl))
}
