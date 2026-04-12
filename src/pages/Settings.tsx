import { useEffect, useState, useCallback } from 'react'
import { usePrintAgent } from '@/hooks/usePrintAgent'
import type { PrinterConfig, TicketTemplate, PrintTemplates } from '@/types/print'
import { PRINTER_PRESETS } from '@/types/print'
import { loadLocalTemplates, saveLocalTemplates } from '@/services/printEngine'
import { Layout, PageHeader } from '@/components/Layout'
import { ImageUploader } from '@/components/ImageUploader'
import { getRestaurant, updateRestaurant } from '@/services/restaurant'
import { useAuth } from '@/hooks/useAuth'
import type { Restaurant } from '@/types'

type Tab = 'estabelecimento' | 'aparencia' | 'pedido-online' | 'financeiro' | 'impressao'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'estabelecimento', label: 'Estabelecimento', icon: '🏪' },
  { key: 'aparencia',       label: 'Aparência',       icon: '🎨' },
  { key: 'pedido-online',   label: 'Pedido Online',   icon: '🌐' },
  { key: 'financeiro',      label: 'Financeiro',      icon: '💰' },
  { key: 'impressao',      label: 'Impressão',       icon: '🖨️' },
]

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text', mono = false }: {
  value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; mono?: boolean
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 ${mono ? 'font-mono' : ''}`}
    />
  )
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
      <div onClick={() => onChange(!on)} className={`relative h-6 w-11 cursor-pointer rounded-full transition ${on ? 'bg-brand-500' : 'bg-gray-200'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
      </div>
    </div>
  )
}

function SavedToast({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t) }, [onDone])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-xl">
      <span className="text-green-400">✓</span> Configurações salvas!
    </div>
  )
}

// ─── Preview da página do cliente ─────────────────────────────────────────────
function PagePreview({ name, logo, primaryColor, bannerImage, bannerColor, buttonStyle, cardStyle, fontStyle, description }: {
  name: string; logo: string; primaryColor: string; bannerImage: string; bannerColor: string
  buttonStyle: string; cardStyle: string; fontStyle: string; description: string
}) {
  const btnRadius = buttonStyle === 'pill' ? 'rounded-full' : buttonStyle === 'square' ? 'rounded-none' : 'rounded-xl'
  const font = fontStyle === 'classic' ? 'font-serif' : fontStyle === 'bold' ? 'font-black' : 'font-sans'
  const cardCls = cardStyle === 'border' ? 'border border-gray-200' : cardStyle === 'flat' ? 'bg-gray-50' : 'shadow-md'

  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white text-xs select-none" style={{ maxWidth: 320 }}>
      {/* Header */}
      <div className="relative" style={{ background: bannerColor || primaryColor }}>
        {bannerImage && (
          <img src={bannerImage} alt="" className="w-full h-24 object-cover opacity-60" />
        )}
        <div className={`${bannerImage ? 'absolute inset-0' : ''} flex items-end gap-2 px-3 py-3`}>
          {logo ? (
            <img src={logo} alt="" className="h-10 w-10 rounded-xl object-cover border-2 border-white shadow" />
          ) : (
            <div className="h-10 w-10 rounded-xl flex items-center justify-center font-black text-white text-base shrink-0"
              style={{ background: primaryColor }}>
              {name.charAt(0) || 'R'}
            </div>
          )}
          <div className="text-white min-w-0">
            <p className={`font-bold leading-tight truncate ${font}`}>{name || 'Restaurante'}</p>
            {description && <p className="text-[10px] opacity-80 truncate">{description}</p>}
          </div>
        </div>
      </div>

      {/* Categorias */}
      <div className="flex gap-1.5 px-3 py-2 overflow-hidden">
        {['Hambúrguer', 'Bebidas', 'Sobremesa'].map((c, i) => (
          <span key={c} className={`shrink-0 px-2 py-0.5 text-[10px] font-medium ${btnRadius} ${i === 0 ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
            style={i === 0 ? { background: primaryColor } : {}}>
            {c}
          </span>
        ))}
      </div>

      {/* Produto exemplo */}
      <div className="px-3 pb-3 space-y-2">
        {[
          { name: 'X-Burguer Artesanal', price: 'R$ 32,90', img: '' },
          { name: 'Batata Frita Crocante', price: 'R$ 18,90', img: '' },
        ].map((p) => (
          <div key={p.name} className={`flex items-center gap-2 rounded-xl overflow-hidden p-2 ${cardCls}`}>
            <div className="h-10 w-10 rounded-lg bg-gray-200 shrink-0 flex items-center justify-center text-base">🍔</div>
            <div className="flex-1 min-w-0">
              <p className={`text-[11px] font-semibold text-gray-800 truncate ${font}`}>{p.name}</p>
              <p className="text-[10px] font-bold" style={{ color: primaryColor }}>{p.price}</p>
            </div>
            <button className={`h-6 w-6 flex items-center justify-center text-white text-sm font-black shrink-0 ${btnRadius}`}
              style={{ background: primaryColor }}>+</button>
          </div>
        ))}
      </div>

      {/* Botão carrinho */}
      <div className="px-3 pb-3">
        <button className={`w-full py-2 text-[11px] font-bold text-white ${btnRadius}`} style={{ background: primaryColor }}>
          Ver carrinho (2) · R$ 51,80
        </button>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

// ─── Aba de configuração de impressão ────────────────────────────────────────

const TICKET_LABELS: Record<string, { label: string; icon: string; target: string; desc: string }> = {
  kitchen_prep:    { label: 'Cozinha — Preparo',         icon: '🍳', target: 'Cozinha',  desc: 'Impresso para todos os pedidos confirmados. Sem preços.' },
  balcao_retirada: { label: 'Balcão — Número de Retirada', icon: '🎫', target: 'Central', desc: 'Número grande para o cliente aguardar no balcão.' },
  online_control:  { label: 'Online — Controle Entrega',   icon: '📍', target: 'Central', desc: 'Dados do cliente online: endereço ou retirada.' },
  mesa_bill:       { label: 'Mesa — Conta do Cliente',     icon: '🧾', target: 'Central', desc: 'Conta detalhada entregue ao cliente antes do pagamento.' },
  financial:       { label: 'Cupom Financeiro',            icon: '💳', target: 'Central', desc: 'Comprovante com forma de pagamento, após fechar conta.' },
}

const CONNECTION_TYPES = [
  { key: 'browser',   icon: '🖥️', label: 'USB (Recomendado)', sub: 'Windows detecta automaticamente' },
  { key: 'bluetooth', icon: '🔵', label: 'Bluetooth',         sub: 'Chrome Android' },
  { key: 'serial',    icon: '🔌', label: 'Serial/COM',        sub: 'Porta COM avançada' },
]

function PrinterBlock({ agent, label }: { agent: any; label: string }) {
  const [draft, setDraft] = useState<PrinterConfig>({ ...agent.config })
  const STATUS_DOT: Record<string, string> = {
    connected: 'bg-green-500', connecting: 'bg-yellow-400 animate-pulse',
    disconnected: 'bg-gray-400', error: 'bg-red-500',
  }
  const STATUS_LABEL: Record<string, string> = {
    connected: 'Conectada', connecting: 'Conectando…',
    disconnected: 'Desconectada', error: 'Erro',
  }

  function save() { agent.updateConfig(draft) }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-700">🖨️ {label}</h3>
          <p className="text-xs text-gray-400">Configurações de conexão e hardware</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[agent.connectionStatus]}`} />
          <span className="text-xs text-gray-600">{STATUS_LABEL[agent.connectionStatus]}</span>
        </div>
      </div>

      {/* Tipo de conexão */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Tipo de conexão</label>
        <div className="flex flex-col gap-2">
          {CONNECTION_TYPES.map((ct) => (
            <button key={ct.key}
              onClick={() => setDraft(d => ({ ...d, connectionType: ct.key as any }))}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left text-sm transition ${draft.connectionType === ct.key ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              <span className="text-xl">{ct.icon}</span>
              <div>
                <div className="font-semibold text-xs">{ct.label}</div>
                <div className="text-xs opacity-60">{ct.sub}</div>
              </div>
              {draft.connectionType === ct.key && <span className="ml-auto text-brand-600 text-xs font-bold">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Bluetooth presets */}
      {draft.connectionType === 'bluetooth' && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Modelo (Bluetooth)</label>
          <select className="w-full border rounded-lg px-3 py-2 text-sm"
            onChange={e => {
              const p = PRINTER_PRESETS[e.target.value]
              if (p) setDraft(d => ({ ...d, ...p }))
            }}>
            <option value="">Selecione preset…</option>
            {Object.keys(PRINTER_PRESETS).map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      )}

      {/* Largura papel */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Largura do papel</label>
        <div className="flex gap-2">
          {([48, 58] as const).map(w => (
            <button key={w} onClick={() => setDraft(d => ({ ...d, paperWidth: w }))}
              className={`flex-1 py-2 rounded-lg text-sm border ${draft.paperWidth === w ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-300'}`}>
              {w} colunas
            </button>
          ))}
        </div>
      </div>

      {/* Botão conectar/salvar */}
      <div className="flex gap-2 pt-1">
        <button onClick={save}
          className="flex-1 rounded-xl bg-gray-800 py-2.5 text-sm font-semibold text-white hover:bg-gray-700">
          Salvar configuração
        </button>
        {draft.connectionType !== 'browser' && (
          agent.connectionStatus === 'connected'
            ? <button onClick={agent.disconnect} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50">Desconectar</button>
            : <button onClick={agent.connect} disabled={agent.connectionStatus === 'connecting'}
                className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                {agent.connectionStatus === 'connecting' ? 'Conectando…' : 'Conectar'}
              </button>
        )}
      </div>

      {/* Histórico */}
      {agent.recentJobs.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Últimas impressões (2h)</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {agent.recentJobs.map((j: any) => (
              <div key={j.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-50">
                <span className="text-gray-700">{j.label} · {TICKET_LABELS[j.ticketType]?.icon}</span>
                <span className={j.print.status === 'printed' ? 'text-green-600' : j.print.status === 'error' ? 'text-red-500' : 'text-yellow-600'}>
                  {j.print.status === 'printed' ? '✓' : j.print.status === 'error' ? '✗' : '…'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function TemplateEditor({ templates, onSave }: { templates: any; onSave: (t: any) => void }) {
  const [draft, setDraft]           = useState({ ...templates })
  const [selected, setSelected]     = useState('kitchen_prep')
  const tpl: TicketTemplate         = draft[selected]

  function updateTpl(key: keyof TicketTemplate, value: any) {
    setDraft((d: any) => ({ ...d, [selected]: { ...d[selected], [key]: value } }))
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
      <h3 className="text-sm font-bold text-gray-700">📄 Templates de Cupom</h3>

      {/* Seletor de template */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TICKET_LABELS).map(([key, meta]) => (
          <button key={key} onClick={() => setSelected(key)}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium border transition ${selected === key ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            {meta.icon} {meta.label.split('—')[0].trim()}
          </button>
        ))}
      </div>

      {/* Info do template */}
      <div className="rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-700">
        <strong>{TICKET_LABELS[selected]?.icon} {TICKET_LABELS[selected]?.label}</strong>
        <br/>Impresso na: <strong>{TICKET_LABELS[selected]?.target}</strong>
        <br/>{TICKET_LABELS[selected]?.desc}
      </div>

      {/* Campos editáveis */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Nome no cabeçalho</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" value={tpl.restaurantName}
            onChange={e => updateTpl('restaurantName', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Linha extra (endereço, telefone…)</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" value={tpl.headerExtra ?? ''}
            onChange={e => updateTpl('headerExtra', e.target.value)} placeholder="Opcional" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Mensagem de rodapé</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" value={tpl.footerMessage}
            onChange={e => updateTpl('footerMessage', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          {([
            ['showPrices',      'Mostrar preços'],
            ['showTotal',       'Mostrar total'],
            ['showServiceRate', 'Taxa de serviço'],
            ['showPhone',       'Telefone cliente'],
            ['showAddress',     'Endereço entrega'],
            ['showPayment',     'Forma de pagamento'],
          ] as const).map(([field, label]) => (
            <label key={field} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input type="checkbox" checked={!!tpl[field]} onChange={e => updateTpl(field, e.target.checked)}
                className="rounded" />
              {label}
            </label>
          ))}
        </div>
      </div>

      <button onClick={() => onSave(draft)}
        className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white hover:bg-brand-600">
        Salvar templates
      </button>
    </section>
  )
}

function PrintSettingsTab({ kitchenAgent, centralAgent }: { kitchenAgent: any; centralAgent: any }) {
  const templates = kitchenAgent.templates
  return (
    <div className="space-y-6">
      <PrinterBlock agent={kitchenAgent} label="Impressora Cozinha" />
      <PrinterBlock agent={centralAgent} label="Impressora Central / Balcão" />
      <TemplateEditor
        templates={templates}
        onSave={(t) => {
          kitchenAgent.updateTemplates(t)
          centralAgent.updateTemplates(t)
        }}
      />
    </div>
  )
}

export default function SettingsPage() {
  const { restaurantId } = useAuth()
  const kitchenAgent = usePrintAgent(restaurantId ?? '', 'kitchen')
  const centralAgent = usePrintAgent(restaurantId ?? '', 'central')
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [tab, setTab]         = useState<Tab>('estabelecimento')

  // ── Estabelecimento ──
  const [name, setName]               = useState('')
  const [logo, setLogo]               = useState('')
  const [phone, setPhone]             = useState('')
  const [whatsapp, setWhatsapp]       = useState('')
  const [email, setEmail]             = useState('')
  const [address, setAddress]         = useState('')
  const [city, setCity]               = useState('')
  const [lat, setLat]                 = useState('')
  const [lon, setLon]                 = useState('')
  const [geoCapturing, setGeoCapturing] = useState(false)
  const [instagram, setInstagram]     = useState('')
  const [facebook, setFacebook]       = useState('')
  const [description, setDescription] = useState('')

  // ── Aparência ──
  const [primaryColor, setPrimaryColor]     = useState('#f97316')
  const [secondaryColor, setSecondaryColor] = useState('#1f2937')
  const [bannerImage, setBannerImage]       = useState('')
  const [bannerColor, setBannerColor]       = useState('')
  const [buttonStyle, setButtonStyle]       = useState<'rounded' | 'pill' | 'square'>('rounded')
  const [fontStyle, setFontStyle]           = useState<'modern' | 'classic' | 'bold'>('modern')
  const [cardStyle, setCardStyle]           = useState<'shadow' | 'border' | 'flat'>('shadow')
  const [showDescription, setShowDescription] = useState(true)

  // ── Pedido online ──
  const [onlineEnabled, setOnlineEnabled] = useState(true)
  const [deliveryFee, setDeliveryFee]     = useState('')
  const [minOrderValue, setMinOrderValue] = useState('')
  const [estimatedTime, setEstimatedTime] = useState('')
  const [openingHours, setOpeningHours]   = useState('')

  // ── Financeiro ──
  const [serviceRate, setServiceRate] = useState(10)
  const [mpToken, setMpToken]         = useState('')

  useEffect(() => {
    if (!restaurantId) return
    getRestaurant(restaurantId).then((r) => {
      if (r) {
        setRestaurant(r)
        setName(r.name ?? '')
        setLogo(r.logo ?? '')
        setPhone(r.phone ?? '')
        setWhatsapp(r.whatsapp ?? '')
        setEmail(r.email ?? '')
        setAddress(r.address ?? '')
        setCity(r.city ?? '')
        setLat((r as any).lat != null ? String((r as any).lat) : '')
        setLon((r as any).lon != null ? String((r as any).lon) : '')
        setInstagram(r.instagram ?? '')
        setFacebook(r.facebook ?? '')
        setDescription(r.description ?? '')
        setPrimaryColor(r.primaryColor ?? '#f97316')
        setSecondaryColor(r.secondaryColor ?? '#1f2937')
        setBannerImage(r.bannerImage ?? '')
        setBannerColor(r.bannerColor ?? '')
        setButtonStyle(r.buttonStyle ?? 'rounded')
        setFontStyle(r.fontStyle ?? 'modern')
        setCardStyle(r.cardStyle ?? 'shadow')
        setShowDescription(r.showDescription ?? true)
        setOnlineEnabled(r.onlineOrderEnabled ?? true)
        setDeliveryFee(r.deliveryFee != null ? String(r.deliveryFee) : '')
        setMinOrderValue(r.minOrderValue != null ? String(r.minOrderValue) : '')
        setEstimatedTime(r.estimatedTime ?? '')
        setOpeningHours(r.openingHours ?? '')
        setServiceRate(Math.round((r.serviceRate ?? 0.1) * 100))
      }
      setLoading(false)
    })
  }, [restaurantId])

  async function handleSave() {
    if (!restaurantId) return
    setSaving(true)
    try {
      const updates: Record<string, unknown> = {
        name, logo, phone, whatsapp, email, address, city,
        instagram, facebook, description,
        primaryColor, secondaryColor,
        bannerImage, bannerColor,
        buttonStyle, fontStyle, cardStyle, showDescription,
        onlineOrderEnabled: onlineEnabled,
        deliveryFee:   deliveryFee   ? parseFloat(deliveryFee)   : null,
        minOrderValue: minOrderValue ? parseFloat(minOrderValue) : null,
        estimatedTime, openingHours,
        serviceRate: serviceRate / 100,
        ...(lat ? { lat: parseFloat(lat) } : {}),
        ...(lon ? { lon: parseFloat(lon) } : {}),
      }
      // Remove strings vazias e nulls desnecessários
      Object.keys(updates).forEach(k => {
        if (updates[k] === '' || updates[k] === null) delete updates[k]
      })
      if (mpToken) updates.mpAccessToken = mpToken
      await updateRestaurant(restaurantId, updates)
      setSaved(true)
    } finally { setSaving(false) }
  }

  const onlineLink = `${window.location.origin}/pedido/${restaurantId}`

  if (loading) return (
    <Layout>
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    </Layout>
  )

  return (
    <Layout>
      <PageHeader title="Configurações" subtitle={restaurant?.name} />

      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Abas */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-100 bg-white px-4 pt-3">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-t-xl px-4 py-2.5 text-sm font-medium transition border-b-2 ${
                tab === t.key
                  ? 'border-brand-500 text-brand-600 bg-brand-50/60'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              <span>{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-2xl space-y-5">

            {/* ══ ABA: ESTABELECIMENTO ══ */}
            {tab === 'estabelecimento' && (
              <>
                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="h-16 w-16 rounded-2xl overflow-hidden flex items-center justify-center font-black text-white text-2xl shrink-0 shadow-sm"
                      style={{ background: logo ? 'transparent' : primaryColor }}>
                      {logo
                        ? <img src={logo} alt="" className="h-full w-full object-cover" onError={e => (e.currentTarget.style.display='none')} />
                        : (name.charAt(0) || '?')
                      }
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{name || 'Seu restaurante'}</p>
                      <p className="text-xs text-gray-400">{city || 'Cidade não definida'}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Field label="Nome do restaurante">
                      <TextInput value={name} onChange={setName} placeholder="Ex: Burger House" />
                    </Field>
                    <Field label="Slogan / Descrição curta">
                      <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                        placeholder="Ex: Os melhores burgers artesanais da cidade 🍔"
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-400 resize-none" />
                    </Field>
                    <ImageUploader
                      label="Logo do restaurante"
                      value={logo}
                      storagePath={`restaurants/${restaurantId}/logo`}
                      aspectClass="aspect-square max-w-[140px]"
                      hint="Recomendado: imagem quadrada, mín. 200×200px"
                      onChange={setLogo}
                    />
                  </div>
                </section>

                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-4 text-sm font-bold text-gray-700">📞 Contato</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Telefone">
                        <TextInput value={phone} onChange={setPhone} placeholder="(00) 0000-0000" type="tel" />
                      </Field>
                      <Field label="WhatsApp">
                        <TextInput value={whatsapp} onChange={setWhatsapp} placeholder="(00) 00000-0000" type="tel" />
                      </Field>
                    </div>
                    <Field label="E-mail">
                      <TextInput value={email} onChange={setEmail} placeholder="contato@restaurante.com" type="email" />
                    </Field>
                  </div>
                </section>

                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-4 text-sm font-bold text-gray-700">📍 Localização</h3>
                  <div className="space-y-4">
                    <Field label="Endereço completo">
                      <TextInput value={address} onChange={setAddress} placeholder="Rua, número, bairro" />
                    </Field>
                    <Field label="Cidade / Estado">
                      <TextInput value={city} onChange={setCity} placeholder="Ex: São Paulo – SP" />
                    </Field>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Coordenadas GPS
                        <span className="ml-1 normal-case font-normal text-gray-400">(para aparecer na central de lojas por proximidade)</span>
                      </label>
                      <div className="flex gap-2 items-start">
                        <div className="flex-1 space-y-2">
                          <TextInput
                            value={lat}
                            onChange={setLat}
                            placeholder="Latitude  ex: -23.5505"
                          />
                          <TextInput
                            value={lon}
                            onChange={setLon}
                            placeholder="Longitude  ex: -46.6333"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={geoCapturing}
                          onClick={() => {
                            if (!navigator.geolocation) return
                            setGeoCapturing(true)
                            navigator.geolocation.getCurrentPosition(
                              (pos) => {
                                setLat(pos.coords.latitude.toFixed(6))
                                setLon(pos.coords.longitude.toFixed(6))
                                setGeoCapturing(false)
                              },
                              () => setGeoCapturing(false),
                              { timeout: 8000 },
                            )
                          }}
                          className="shrink-0 mt-0.5 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50 transition"
                        >
                          {geoCapturing ? '…' : '📡 Capturar\naqui'}
                        </button>
                      </div>
                      {lat && lon && (
                        <a
                          href={`https://www.google.com/maps?q=${lat},${lon}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 inline-block text-xs text-brand-600 hover:underline"
                        >
                          ✓ Ver no mapa →
                        </a>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-4 text-sm font-bold text-gray-700">📲 Redes sociais</h3>
                  <div className="space-y-4">
                    <Field label="Instagram">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm shrink-0">instagram.com/</span>
                        <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="seurestaurante"
                          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-400" />
                      </div>
                    </Field>
                    <Field label="Facebook">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm shrink-0">facebook.com/</span>
                        <input value={facebook} onChange={e => setFacebook(e.target.value)} placeholder="seurestaurante"
                          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-400" />
                      </div>
                    </Field>
                  </div>
                </section>
              </>
            )}

            {/* ══ ABA: APARÊNCIA ══ */}
            {tab === 'aparencia' && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 items-start">

                {/* Controles */}
                <div className="space-y-5">

                  {/* Cores */}
                  <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                    <h3 className="mb-4 text-sm font-bold text-gray-700">🎨 Cores</h3>
                    <div className="space-y-4">
                      <Field label="Cor principal" hint="Usada nos botões, categorias ativas e destaques">
                        <div className="flex items-center gap-3">
                          <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                            className="h-11 w-14 cursor-pointer rounded-xl border border-gray-200 p-0.5 shrink-0" />
                          <TextInput value={primaryColor} onChange={setPrimaryColor} mono />
                        </div>
                      </Field>
                      <Field label="Cor do cabeçalho" hint="Cor de fundo do topo quando sem imagem de capa">
                        <div className="flex items-center gap-3">
                          <input type="color" value={bannerColor || primaryColor}
                            onChange={e => setBannerColor(e.target.value)}
                            className="h-11 w-14 cursor-pointer rounded-xl border border-gray-200 p-0.5 shrink-0" />
                          <TextInput value={bannerColor} onChange={setBannerColor} mono placeholder={primaryColor} />
                        </div>
                      </Field>
                      <Field label="Cor secundária">
                        <div className="flex items-center gap-3">
                          <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                            className="h-11 w-14 cursor-pointer rounded-xl border border-gray-200 p-0.5 shrink-0" />
                          <TextInput value={secondaryColor} onChange={setSecondaryColor} mono />
                        </div>
                      </Field>
                    </div>
                  </section>

                  {/* Imagem de capa */}
                  <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                    <h3 className="mb-1 text-sm font-bold text-gray-700">🖼️ Imagem de capa</h3>
                    <p className="mb-4 text-xs text-gray-400">Exibida no topo do cardápio. Recomendado: 1200×400px.</p>
                    <ImageUploader
                      label="Banner / Capa"
                      value={bannerImage}
                      storagePath={`restaurants/${restaurantId}/banner`}
                      aspectClass="aspect-video"
                      hint="Será sobreposta com a cor do cabeçalho para legibilidade"
                      onChange={setBannerImage}
                    />
                  </section>

                  {/* Estilo dos botões */}
                  <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                    <h3 className="mb-4 text-sm font-bold text-gray-700">🔘 Estilo dos botões</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { key: 'rounded', label: 'Arredondado', preview: 'rounded-xl' },
                        { key: 'pill',    label: 'Pílula',       preview: 'rounded-full' },
                        { key: 'square',  label: 'Quadrado',     preview: 'rounded-none' },
                      ] as const).map(opt => (
                        <button key={opt.key} onClick={() => setButtonStyle(opt.key)}
                          className={`flex flex-col items-center gap-2 rounded-xl border-2 py-3 px-2 transition ${
                            buttonStyle === opt.key ? 'border-brand-500 bg-brand-50' : 'border-gray-100 hover:border-gray-200'
                          }`}>
                          <div className={`px-3 py-1.5 text-xs font-bold text-white ${opt.preview}`}
                            style={{ background: primaryColor }}>
                            Botão
                          </div>
                          <span className="text-xs text-gray-600">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Estilo do card de produto */}
                  <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                    <h3 className="mb-4 text-sm font-bold text-gray-700">🃏 Estilo dos cards</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { key: 'shadow', label: 'Sombra',   cls: 'shadow-md bg-white' },
                        { key: 'border', label: 'Bordas',   cls: 'border border-gray-300 bg-white' },
                        { key: 'flat',   label: 'Flat',     cls: 'bg-gray-100' },
                      ] as const).map(opt => (
                        <button key={opt.key} onClick={() => setCardStyle(opt.key)}
                          className={`flex flex-col items-center gap-2 rounded-xl border-2 py-3 px-2 transition ${
                            cardStyle === opt.key ? 'border-brand-500 bg-brand-50' : 'border-gray-100 hover:border-gray-200'
                          }`}>
                          <div className={`w-full rounded-lg p-2 text-[10px] text-gray-700 ${opt.cls}`}>
                            🍔 X-Burguer
                          </div>
                          <span className="text-xs text-gray-600">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Estilo da fonte */}
                  <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                    <h3 className="mb-4 text-sm font-bold text-gray-700">✍️ Estilo da fonte</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { key: 'modern',  label: 'Moderno',  cls: 'font-sans'   },
                        { key: 'classic', label: 'Clássico', cls: 'font-serif'  },
                        { key: 'bold',    label: 'Bold',     cls: 'font-black'  },
                      ] as const).map(opt => (
                        <button key={opt.key} onClick={() => setFontStyle(opt.key)}
                          className={`flex flex-col items-center gap-1 rounded-xl border-2 py-3 px-2 transition ${
                            fontStyle === opt.key ? 'border-brand-500 bg-brand-50' : 'border-gray-100 hover:border-gray-200'
                          }`}>
                          <span className={`text-base text-gray-800 ${opt.cls}`}>Aa</span>
                          <span className="text-xs text-gray-600">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Toggles */}
                  <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                    <h3 className="mb-4 text-sm font-bold text-gray-700">⚙️ Exibição</h3>
                    <Toggle
                      on={showDescription}
                      onChange={setShowDescription}
                      label="Mostrar descrição dos produtos"
                      hint="Exibe acompanhamentos/descrição abaixo do nome no card"
                    />
                  </section>
                </div>

                {/* Preview colado na lateral em telas grandes */}
                <div className="lg:sticky lg:top-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 text-center">Preview</p>
                  <PagePreview
                    name={name} logo={logo} primaryColor={primaryColor}
                    bannerImage={bannerImage} bannerColor={bannerColor || primaryColor}
                    buttonStyle={buttonStyle} cardStyle={cardStyle}
                    fontStyle={fontStyle} description={description}
                  />
                  <p className="mt-2 text-center text-[10px] text-gray-400">Aprox. como o cliente verá</p>
                </div>
              </div>
            )}

            {/* ══ ABA: PEDIDO ONLINE ══ */}
            {tab === 'pedido-online' && (
              <>
                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-bold text-gray-700">🔗 Link de pedidos</h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${onlineEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {onlineEnabled ? 'Ativo' : 'Desativado'}
                    </span>
                  </div>
                  <p className="mb-4 text-xs text-gray-400">Compartilhe com seus clientes pelo WhatsApp, Instagram ou qualquer canal.</p>
                  <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <span className="flex-1 truncate font-mono text-sm text-gray-600">{onlineLink}</span>
                    <button onClick={() => navigator.clipboard.writeText(onlineLink)}
                      className="shrink-0 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-600 transition active:scale-95">
                      Copiar
                    </button>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <a href={`https://wa.me/?text=${encodeURIComponent(`Faça seu pedido agora! 🍔\n${onlineLink}`)}`}
                      target="_blank" rel="noreferrer"
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 py-2.5 text-xs font-bold text-green-700 hover:bg-green-100 transition">
                      📱 WhatsApp
                    </a>
                    {instagram && (
                      <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noreferrer"
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-pink-200 bg-pink-50 py-2.5 text-xs font-bold text-pink-700 hover:bg-pink-100 transition">
                        📸 Instagram
                      </a>
                    )}
                  </div>
                  <div className="mt-4">
                    <Toggle on={onlineEnabled} onChange={setOnlineEnabled}
                      label="Receber pedidos online"
                      hint="Quando desativado, o link exibe mensagem de indisponibilidade" />
                  </div>
                </section>

                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-4 text-sm font-bold text-gray-700">🛵 Entrega</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Taxa de entrega (R$)" hint="Vazio = grátis">
                        <TextInput value={deliveryFee} onChange={setDeliveryFee} placeholder="0,00" type="number" />
                      </Field>
                      <Field label="Pedido mínimo (R$)" hint="Vazio = sem mínimo">
                        <TextInput value={minOrderValue} onChange={setMinOrderValue} placeholder="0,00" type="number" />
                      </Field>
                    </div>
                    <Field label="Tempo estimado">
                      <TextInput value={estimatedTime} onChange={setEstimatedTime} placeholder="Ex: 30–45 min" />
                    </Field>
                    <Field label="Horário de funcionamento">
                      <TextInput value={openingHours} onChange={setOpeningHours} placeholder="Ex: Seg–Sex 11h às 22h · Sáb 11h às 23h" />
                    </Field>
                  </div>
                </section>
              </>
            )}

            {/* ══ ABA: FINANCEIRO ══ */}
            {tab === 'financeiro' && (
              <>
                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-1 text-sm font-bold text-gray-700">Taxa de serviço</h3>
                  <p className="mb-4 text-xs text-gray-400">Adicionada ao fechar conta no salão e nos pagamentos PIX.</p>
                  <div className="flex items-center gap-4">
                    <input type="range" min={0} max={20} step={1} value={serviceRate}
                      onChange={e => setServiceRate(Number(e.target.value))} className="flex-1 accent-brand-500" />
                    <div className="flex h-12 w-16 items-center justify-center rounded-xl border-2 border-brand-500 text-base font-black text-brand-600">
                      {serviceRate}%
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                    Num pedido de <strong>R$ 100,00</strong>, o cliente pagará <strong>R$ {(100 * (1 + serviceRate / 100)).toFixed(2)}</strong>
                  </div>
                </section>

                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-1 text-sm font-bold text-gray-700">Mercado Pago (PIX)</h3>
                  <p className="mb-4 text-xs text-gray-400">
                    Obtenha em{' '}
                    <a href="https://www.mercadopago.com.br/developers" target="_blank" rel="noreferrer"
                      className="text-brand-500 underline">mercadopago.com.br/developers</a>
                  </p>
                  <Field label="Access Token" hint="Deixe vazio para não alterar">
                    <TextInput value={mpToken} onChange={setMpToken} type="password" mono placeholder="APP_USR-xxxxxxxx" />
                  </Field>
                </section>
              </>
            )}


            {/* ══ ABA: IMPRESSÃO ══ */}
            {tab === 'impressao' && (
              <PrintSettingsTab
                kitchenAgent={kitchenAgent}
                centralAgent={centralAgent}
              />
            )}

            {/* Botão salvar */}
            <div className="flex items-center justify-end pb-6">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-brand-500 px-8 py-3 text-sm font-bold text-white hover:bg-brand-600 transition active:scale-95 disabled:opacity-60">
                {saving ? (
                  <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75"/>
                  </svg> Salvando…</>
                ) : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {saved && <SavedToast onDone={() => setSaved(false)} />}
    </Layout>
  )
}
