import { useEffect, useState } from 'react'
import { Layout, PageHeader } from '@/components/Layout'
import { getRestaurant, updateRestaurant } from '@/services/restaurant'
import { useAuth } from '@/hooks/useAuth'
import type { Restaurant } from '@/types'

// ─── Tipos de aba ─────────────────────────────────────────────────────────────
type Tab = 'estabelecimento' | 'aparencia' | 'pedido-online' | 'financeiro'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'estabelecimento', label: 'Estabelecimento', icon: '🏪' },
  { key: 'aparencia',       label: 'Aparência',       icon: '🎨' },
  { key: 'pedido-online',   label: 'Pedido Online',   icon: '🌐' },
  { key: 'financeiro',      label: 'Financeiro',      icon: '💰' },
]

// ─── Componentes de campo ─────────────────────────────────────────────────────
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
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 ${mono ? 'font-mono' : ''}`}
    />
  )
}

// ─── Toast de sucesso ─────────────────────────────────────────────────────────
function SavedToast({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t) }, [onDone])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-xl">
      <span className="text-green-400">✓</span> Configurações salvas!
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { restaurantId } = useAuth()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [tab, setTab]           = useState<Tab>('estabelecimento')

  // ── Campos ──
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

  const [primaryColor, setPrimaryColor]     = useState('#f97316')
  const [secondaryColor, setSecondaryColor] = useState('#1f2937')

  const [onlineEnabled, setOnlineEnabled]   = useState(true)
  const [deliveryFee, setDeliveryFee]       = useState('')
  const [minOrderValue, setMinOrderValue]   = useState('')
  const [estimatedTime, setEstimatedTime]   = useState('')
  const [openingHours, setOpeningHours]     = useState('')

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
      const updates: Partial<Restaurant> & Record<string, unknown> = {
        name, logo, phone, whatsapp, email, address, city,
        instagram, facebook, description,
        primaryColor, secondaryColor,
        onlineOrderEnabled: onlineEnabled,
        deliveryFee:    deliveryFee    ? parseFloat(deliveryFee)    : null,
        minOrderValue:  minOrderValue  ? parseFloat(minOrderValue)  : null,
        estimatedTime, openingHours,
        serviceRate: serviceRate / 100,
      }
      // Remove campos vazios para não sobrescrever com null desnecessariamente
      Object.keys(updates).forEach(k => {
        if (updates[k] === '' || updates[k] === null) delete updates[k]
      })
      if (mpToken) updates.mpAccessToken = mpToken
      await updateRestaurant(restaurantId, updates)
      setSaved(true)
    } finally { setSaving(false) }
  }

  const onlineLink = `${window.location.origin}/pedido/${restaurantId}`

  function copyLink() {
    navigator.clipboard.writeText(onlineLink)
  }

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
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-t-xl px-4 py-2.5 text-sm font-medium transition border-b-2 ${
                tab === t.key
                  ? 'border-brand-500 text-brand-600 bg-brand-50/60'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-2xl space-y-5">

            {/* ── ABA: ESTABELECIMENTO ── */}
            {tab === 'estabelecimento' && (
              <>
                {/* Logo + nome */}
                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="relative">
                      {logo ? (
                        <img src={logo} alt="logo" className="h-16 w-16 rounded-2xl object-cover border border-gray-100 shadow-sm"
                          onError={e => (e.currentTarget.style.display = 'none')} />
                      ) : (
                        <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-sm"
                          style={{ background: primaryColor }}>
                          {name.charAt(0) || '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{name || 'Seu restaurante'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{city || 'Cidade não definida'}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Field label="Nome do restaurante">
                      <TextInput value={name} onChange={setName} placeholder="Ex: Burger House" />
                    </Field>
                    <Field label="Slogan / Descrição curta">
                      <textarea
                        value={description} onChange={e => setDescription(e.target.value)}
                        rows={2} placeholder="Ex: Os melhores burgers artesanais da cidade 🍔"
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 resize-none"
                      />
                    </Field>
                    <Field label="URL do logo">
                      <TextInput value={logo} onChange={setLogo} placeholder="https://..." type="url" />
                    </Field>
                  </div>
                </section>

                {/* Contato */}
                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-4 text-sm font-bold text-gray-700 flex items-center gap-2">📞 Contato</h3>
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

                {/* Localização */}
                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-4 text-sm font-bold text-gray-700 flex items-center gap-2">📍 Localização</h3>
                  <div className="space-y-4">
                    <Field label="Endereço completo">
                      <TextInput value={address} onChange={setAddress} placeholder="Rua, número, bairro" />
                    </Field>
                    <Field label="Cidade / Estado">
                      <TextInput value={city} onChange={setCity} placeholder="Ex: São Paulo – SP" />
                    </Field>
                  </div>
                </section>

                {/* Redes sociais */}
                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-4 text-sm font-bold text-gray-700 flex items-center gap-2">📲 Redes sociais</h3>
                  <div className="space-y-4">
                    <Field label="Instagram">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm">instagram.com/</span>
                        <input
                          value={instagram} onChange={e => setInstagram(e.target.value)}
                          placeholder="seurestaurante"
                          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-400"
                        />
                      </div>
                    </Field>
                    <Field label="Facebook">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm">facebook.com/</span>
                        <input
                          value={facebook} onChange={e => setFacebook(e.target.value)}
                          placeholder="seurestaurante"
                          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-400"
                        />
                      </div>
                    </Field>
                  </div>
                </section>
              </>
            )}

            {/* ── ABA: APARÊNCIA ── */}
            {tab === 'aparencia' && (
              <>
                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-1 text-sm font-bold text-gray-700">Cores do cardápio</h3>
                  <p className="mb-5 text-xs text-gray-400">Aplicadas no cardápio digital e na página de pedido online que o cliente vê.</p>

                  <div className="space-y-5">
                    <Field label="Cor principal">
                      <div className="flex items-center gap-3">
                        <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                          className="h-11 w-14 cursor-pointer rounded-xl border border-gray-200 p-0.5" />
                        <TextInput value={primaryColor} onChange={setPrimaryColor} mono />
                      </div>
                    </Field>
                    <Field label="Cor secundária">
                      <div className="flex items-center gap-3">
                        <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                          className="h-11 w-14 cursor-pointer rounded-xl border border-gray-200 p-0.5" />
                        <TextInput value={secondaryColor} onChange={setSecondaryColor} mono />
                      </div>
                    </Field>
                  </div>

                  {/* Preview */}
                  <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Preview</p>
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center text-base font-black text-white"
                          style={{ background: primaryColor }}>
                          {name.charAt(0) || 'F'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{name || 'Seu restaurante'}</p>
                          <p className="text-xs text-gray-400">Peça pelo app 🛵</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mb-4">
                        {['Hambúrguer', 'Bebidas', 'Sobremesa'].map((c, i) => (
                          <button key={c} className={`rounded-full px-3 py-1 text-xs font-medium ${i === 0 ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                            style={i === 0 ? { background: primaryColor } : {}}>
                            {c}
                          </button>
                        ))}
                      </div>
                      <button className="w-full rounded-xl py-3 text-sm font-bold text-white"
                        style={{ background: primaryColor }}>
                        Ver carrinho (3) · R$ 89,90
                      </button>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* ── ABA: PEDIDO ONLINE ── */}
            {tab === 'pedido-online' && (
              <>
                {/* Link */}
                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-bold text-gray-700">🔗 Link de pedidos</h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${onlineEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {onlineEnabled ? 'Ativo' : 'Desativado'}
                    </span>
                  </div>
                  <p className="mb-4 text-xs text-gray-400">
                    Compartilhe esse link com seus clientes pelo WhatsApp, Instagram ou qualquer canal.
                  </p>

                  {/* Link box */}
                  <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <span className="flex-1 truncate font-mono text-sm text-gray-600">{onlineLink}</span>
                    <button onClick={copyLink}
                      className="shrink-0 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-600 transition active:scale-95">
                      Copiar
                    </button>
                  </div>

                  {/* Botões de compartilhar */}
                  <div className="mt-3 flex gap-2">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Faça seu pedido agora! 🍔\n${onlineLink}`)}`}
                      target="_blank" rel="noreferrer"
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 py-2.5 text-xs font-bold text-green-700 hover:bg-green-100 transition"
                    >
                      <span>📱</span> WhatsApp
                    </a>
                    {instagram && (
                      <a
                        href={`https://instagram.com/${instagram}`}
                        target="_blank" rel="noreferrer"
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-pink-200 bg-pink-50 py-2.5 text-xs font-bold text-pink-700 hover:bg-pink-100 transition"
                      >
                        <span>📸</span> Instagram
                      </a>
                    )}
                  </div>

                  {/* Toggle ativo */}
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Receber pedidos online</p>
                      <p className="text-xs text-gray-400">Quando desativado, o link exibe uma mensagem de indisponibilidade</p>
                    </div>
                    <div onClick={() => setOnlineEnabled(!onlineEnabled)}
                      className={`relative h-6 w-11 cursor-pointer rounded-full transition ${onlineEnabled ? 'bg-brand-500' : 'bg-gray-200'}`}>
                      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${onlineEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </div>
                  </div>
                </section>

                {/* Configurações de entrega */}
                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-4 text-sm font-bold text-gray-700">🛵 Entrega</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Taxa de entrega (R$)" hint="Deixe vazio para grátis">
                        <TextInput value={deliveryFee} onChange={setDeliveryFee} placeholder="0,00" type="number" />
                      </Field>
                      <Field label="Pedido mínimo (R$)" hint="Deixe vazio para sem mínimo">
                        <TextInput value={minOrderValue} onChange={setMinOrderValue} placeholder="0,00" type="number" />
                      </Field>
                    </div>
                    <Field label="Tempo estimado" hint="Exibido no cardápio para o cliente">
                      <TextInput value={estimatedTime} onChange={setEstimatedTime} placeholder="Ex: 30–45 min" />
                    </Field>
                    <Field label="Horário de funcionamento" hint="Exibido no cardápio">
                      <TextInput value={openingHours} onChange={setOpeningHours} placeholder="Ex: Seg–Sex 11h às 22h · Sáb 11h às 23h" />
                    </Field>
                  </div>
                </section>

                {/* Preview do cartão */}
                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-3 text-sm font-bold text-gray-700">Preview do cabeçalho do cardápio</h3>
                  <div className="rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="h-1.5 w-full" style={{ background: primaryColor }} />
                    <div className="p-4 bg-white">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-12 w-12 rounded-2xl flex items-center justify-center font-black text-white text-lg shadow-sm"
                          style={{ background: primaryColor }}>
                          {name.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-black text-gray-900 text-base">{name || 'Seu restaurante'}</p>
                          <p className="text-xs text-gray-400">{description || 'Peça pelo app e receba em casa 🛵'}</p>
                        </div>
                      </div>
                      <div className="flex gap-3 text-xs text-gray-500">
                        {estimatedTime && <span className="flex items-center gap-1">⏱ {estimatedTime}</span>}
                        {deliveryFee ? <span className="flex items-center gap-1">🛵 R$ {deliveryFee}</span> : <span className="flex items-center gap-1">🛵 Entrega grátis</span>}
                        {minOrderValue && <span className="flex items-center gap-1">📦 Mín. R$ {minOrderValue}</span>}
                      </div>
                      {openingHours && <p className="mt-2 text-xs text-gray-400">🕐 {openingHours}</p>}
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* ── ABA: FINANCEIRO ── */}
            {tab === 'financeiro' && (
              <>
                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                  <h3 className="mb-1 text-sm font-bold text-gray-700">Taxa de serviço</h3>
                  <p className="mb-4 text-xs text-gray-400">Adicionada automaticamente ao fechar conta no salão e nos pagamentos PIX.</p>
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
                    Obtenha seu token em{' '}
                    <a href="https://www.mercadopago.com.br/developers" target="_blank" rel="noreferrer"
                      className="text-brand-500 underline">mercadopago.com.br/developers</a>
                  </p>
                  <Field label="Access Token" hint="Deixe vazio para não alterar">
                    <TextInput value={mpToken} onChange={setMpToken} type="password" mono
                      placeholder="APP_USR-xxxxxxxx" />
                  </Field>
                </section>
              </>
            )}

            {/* Botão salvar */}
            <div className="flex items-center justify-end gap-3 pb-6">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-brand-500 px-8 py-3 text-sm font-bold text-white hover:bg-brand-600 transition active:scale-95 disabled:opacity-60">
                {saving ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75"/>
                    </svg>
                    Salvando…
                  </>
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
