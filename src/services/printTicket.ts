/**
 * printTicket — impressão de cupom de cozinha configurável.
 * Suporta ESC/POS via Web Serial API e fallback window.print() para 80mm.
 */

export interface PrintConfig {
  // Campos a imprimir
  showRestaurantName: boolean
  showOrderType:      boolean   // Mesa / Marmita / Online / Balcão
  showDateTime:       boolean
  showCustomerName:   boolean
  showPhone:          boolean
  showAddress:        boolean
  showItems:          boolean   // sempre true
  showNotes:          boolean
  showTotal:          boolean
  showSeparator:      boolean   // linha divisória entre itens

  // Formatação
  paperWidth:   '58mm' | '80mm'
  fontSize:     'small' | 'normal' | 'large'
  copies:       number    // quantas vias imprimir
  headerText?:  string    // texto extra no topo (ex: "COZINHA")
  footerText?:  string    // texto extra no rodapé
}

export const DEFAULT_PRINT_CONFIG: PrintConfig = {
  showRestaurantName: true,
  showOrderType:      true,
  showDateTime:       true,
  showCustomerName:   true,
  showPhone:          false,
  showAddress:        true,
  showItems:          true,
  showNotes:          true,
  showTotal:          false,
  showSeparator:      true,
  paperWidth:         '80mm',
  fontSize:           'normal',
  copies:             1,
  headerText:         'COZINHA',
  footerText:         '',
}

export interface TicketData {
  origin:       'mesa' | 'marmita' | 'online' | 'balcao'
  identifier:   string           // "Mesa 5" | "João Silva" | "#001"
  customerName?: string
  phone?:        string
  address?:      string
  deliveryType?: 'pickup' | 'delivery'
  items:         { name: string; qty: number; size?: string }[]
  notes?:        string
  total:         number
  createdAt:     Date
  restaurantName?: string
}

const ORIGIN_LABEL: Record<string, string> = {
  mesa:    'MESA',
  marmita: 'MARMITARIA',
  online:  'PEDIDO ONLINE',
  balcao:  'BALCAO',
}

function buildLines(data: TicketData, config: PrintConfig): string[] {
  const width  = config.paperWidth === '58mm' ? 32 : 48
  const divider  = '='.repeat(width)
  const divider2 = '-'.repeat(width)
  const center = (text: string) => text.padStart(Math.floor((width + text.length) / 2)).padEnd(width)
  const time   = data.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const date   = data.createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

  const lines: string[] = []

  lines.push(divider)

  if (config.headerText) {
    lines.push(center(config.headerText))
    lines.push(divider)
  }

  if (config.showRestaurantName && data.restaurantName) {
    lines.push(center(data.restaurantName.toUpperCase()))
  }

  if (config.showOrderType) {
    lines.push(center(ORIGIN_LABEL[data.origin] ?? data.origin.toUpperCase()))
    lines.push(center(data.identifier.toUpperCase()))
  }

  if (config.showDateTime) {
    lines.push(center(`${date} ${time}`))
  }

  lines.push(divider)

  if (config.showCustomerName && data.customerName) {
    lines.push(`Cliente: ${data.customerName}`)
  }

  if (config.showPhone && data.phone) {
    lines.push(`Tel: ${data.phone}`)
  }

  if (config.showAddress && data.address) {
    const delivery = data.deliveryType === 'delivery' ? 'ENTREGA' : 'RETIRADA'
    lines.push(`${delivery}: ${data.address}`)
  } else if (data.deliveryType === 'pickup') {
    lines.push('RETIRADA NO LOCAL')
  }

  if (config.showCustomerName && data.customerName || config.showAddress && data.address) {
    lines.push(divider2)
  }

  // Itens
  if (config.showItems) {
    lines.push('ITENS:')
    data.items.forEach((item) => {
      const qty  = String(item.qty).padStart(3)
      const name = item.size ? `${item.name} (${item.size})` : item.name
      lines.push(`${qty}x ${name}`)
      if (config.showSeparator) lines.push(divider2)
    })
    if (!config.showSeparator) lines.push(divider2)
  }

  if (config.showNotes && data.notes) {
    lines.push(`OBS: ${data.notes}`)
    lines.push(divider2)
  }

  if (config.showTotal) {
    lines.push(`TOTAL: R$ ${data.total.toFixed(2)}`)
  }

  if (config.footerText) {
    lines.push(divider)
    lines.push(center(config.footerText))
  }

  lines.push(divider)
  lines.push('')
  lines.push('')

  return lines.filter((l) => l !== undefined)
}

function getFontSize(size: PrintConfig['fontSize']): string {
  return size === 'small' ? '11px' : size === 'large' ? '15px' : '13px'
}

export async function printTicket(data: TicketData, config: PrintConfig = DEFAULT_PRINT_CONFIG): Promise<void> {
  const allLines: string[] = []
  for (let i = 0; i < (config.copies || 1); i++) {
    allLines.push(...buildLines(data, config))
    if (i < (config.copies || 1) - 1) allLines.push('\f') // form feed entre vias
  }
  const text = allLines.join('\n')

  // Tenta Web Serial API (ESC/POS)
  if ('serial' in navigator) {
    try {
      // @ts-ignore
      const port = await navigator.serial.requestPort()
      await port.open({ baudRate: 9600 })
      const writer  = port.writable.getWriter()
      const encoder = new TextEncoder()
      const ESC = 0x1b, GS = 0x1d

      // Negrito para letra grande
      const bold  = new Uint8Array([ESC, 0x45, 0x01])
      const unbold = new Uint8Array([ESC, 0x45, 0x00])
      const init  = new Uint8Array([ESC, 0x40])
      const cut   = new Uint8Array([GS, 0x56, 0x41, 0x00])

      await writer.write(init)
      if (config.fontSize === 'large') await writer.write(bold)
      await writer.write(encoder.encode(text))
      if (config.fontSize === 'large') await writer.write(unbold)
      await writer.write(cut)
      writer.releaseLock()
      await port.close()
      return
    } catch {
      // fallback
    }
  }

  // Fallback: janela de impressão 80mm
  const win = window.open('', '_blank', `width=${config.paperWidth === '58mm' ? 280 : 350},height=700`)
  if (!win) return
  const fontSize = getFontSize(config.fontSize)
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Cupom</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Courier New', monospace; font-size: ${fontSize};
        width: ${config.paperWidth}; padding: 4mm; background: white; color: black; }
      pre { white-space: pre-wrap; word-break: break-word; }
      @media print { body { width: ${config.paperWidth}; } @page { margin: 0; size: ${config.paperWidth} auto; } }
    </style></head><body>
    <pre>${text.replace(/</g, '&lt;')}</pre>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}<\/script>
    </body></html>`)
  win.document.close()
}
