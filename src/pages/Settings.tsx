import { useEffect, useState } from 'react'
import { Layout, PageHeader } from '@/components/Layout'
import { ImageUploader } from '@/components/ImageUploader'
import { getRestaurant, updateRestaurant } from '@/services/restaurant'
import { useAuth } from '@/hooks/useAuth'
import type { Restaurant } from '@/types'

type Tab = 'estabelecimento' | 'aparencia' | 'pedido-online' | 'financeiro'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'estabelecimento', label: 'Estabelecimento', icon: '🏪' },
  { key: 'aparencia',       label: 'Aparência',       icon: '🎨' },
  { key: 'pedido-online',   label: 'Pedido Online',   icon: '🌐' },
  { key: 'financeiro',      label: 'Financeiro',      icon: '💰' },
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
export default function SettingsPage() {
  const { restaurantId } = useAuth()
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
