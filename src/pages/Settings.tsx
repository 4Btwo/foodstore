import { useEffect, useState } from 'react'
import { Layout, PageHeader } from '@/components/Layout'
import { getRestaurant, updateRestaurant } from '@/services/restaurant'
import { useAuth } from '@/hooks/useAuth'
import type { Restaurant } from '@/types'

export default function SettingsPage() {
  const { restaurantId }          = useAuth()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  // Form fields
  const [name, setName]                 = useState('')
  const [primaryColor, setPrimaryColor] = useState('#f97316')
  const [secondaryColor, setSecondaryColor] = useState('#1f2937')
  const [serviceRate, setServiceRate]   = useState(10)
  const [logo, setLogo]                 = useState('')
  const [mpToken, setMpToken]           = useState('')

  useEffect(() => {
    if (!restaurantId) return
    getRestaurant(restaurantId).then((r) => {
      if (r) {
        setRestaurant(r)
        setName(r.name)
        setPrimaryColor(r.primaryColor)
        setSecondaryColor(r.secondaryColor)
        setServiceRate(Math.round(r.serviceRate * 100))
        setLogo(r.logo ?? '')
      }
      setLoading(false)
    })
  }, [restaurantId])

  async function handleSave() {
    if (!restaurantId) return
    setSaving(true)
    try {
      const updates: Partial<Restaurant> = {
        name,
        primaryColor,
        secondaryColor,
        serviceRate: serviceRate / 100,
        logo,
      }
      if (mpToken) (updates as Record<string, unknown>).mpAccessToken = mpToken
      await updateRestaurant(restaurantId, updates)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
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

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* Informações básicas */}
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Informações do restaurante</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Nome do restaurante
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="Ex: Burger House"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  URL do logo (imagem)
                </label>
                <input
                  type="url"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  className="input"
                  placeholder="https://..."
                />
                {logo && (
                  <img
                    src={logo}
                    alt="Preview logo"
                    className="mt-2 h-12 w-12 rounded-xl object-cover border border-gray-100"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
              </div>
            </div>
          </section>

          {/* Aparência */}
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Aparência</h2>
            <p className="mb-4 text-xs text-gray-500">
              As cores são aplicadas no cardápio digital que o cliente vê pelo QR Code.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Cor principal
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-gray-200 p-0.5"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="input flex-1 font-mono text-sm"
                    maxLength={7}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Cor secundária
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-gray-200 p-0.5"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="input flex-1 font-mono text-sm"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="mt-4 rounded-xl border border-gray-100 p-4">
              <p className="mb-2 text-xs text-gray-500">Preview do botão no cardápio:</p>
              <button
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition"
                style={{ background: primaryColor }}
              >
                Ver pedido (2) · R$ 57,80
              </button>
            </div>
          </section>

          {/* Financeiro */}
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Configurações financeiras</h2>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Taxa de serviço (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={serviceRate}
                  onChange={(e) => setServiceRate(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="w-12 text-center text-sm font-semibold text-gray-700">
                  {serviceRate}%
                </span>
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                Adicionada automaticamente ao fechar a conta e nos pagamentos PIX.
              </p>
            </div>
          </section>

          {/* Mercado Pago */}
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <h2 className="mb-1 text-sm font-semibold text-gray-700">Mercado Pago (PIX)</h2>
            <p className="mb-4 text-xs text-gray-500">
              Obtenha seu token em{' '}
              <a
                href="https://www.mercadopago.com.br/developers"
                target="_blank"
                rel="noreferrer"
                className="text-brand-500 underline"
              >
                mercadopago.com.br/developers
              </a>
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Access Token
              </label>
              <input
                type="password"
                value={mpToken}
                onChange={(e) => setMpToken(e.target.value)}
                className="input font-mono text-sm"
                placeholder="APP_USR-xxxxxxxx (deixe vazio para não alterar)"
              />
            </div>
          </section>

          {/* Salvar */}
          <div className="flex items-center justify-end gap-3 pb-4">
            {saved && (
              <span className="text-sm font-medium text-green-600">✅ Configurações salvas!</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary px-8"
            >
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>

        </div>
      </div>
    </Layout>
  )
}
