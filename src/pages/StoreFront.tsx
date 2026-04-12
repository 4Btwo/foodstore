/**
 * Central de Lojas — UX estilo iFood
 *
 * Rota pública: /loja
 *
 * Exibe todos os restaurantes cadastrados com onlineOrderEnabled = true
 * O cliente pode navegar, buscar e acessar cada restaurante individualmente
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { subscribeAllRestaurants } from '@/services/superAdmin'
import type { Restaurant } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  'Todos':       '🔥',
  'Lanches':     '🍔',
  'Pizza':       '🍕',
  'Japonesa':    '🍣',
  'Brasileira':  '🍲',
  'Saudável':    '🥗',
  'Doces':       '🧁',
  'Bebidas':     '🥤',
}

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Calcula distância em km entre dois pontos (Haversine) */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function distanceLabel(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`
  return `${km.toFixed(1)}km`
}

// ─── Card do restaurante ──────────────────────────────────────────────────────

function RestaurantCard({
  restaurant, distanceKm, onClick,
}: {
  restaurant: Restaurant & { rating?: number; deliveryTime?: string }
  distanceKm?: number
  onClick: () => void
}) {
  const color = restaurant.primaryColor || '#ea1d2c'
  const isFree = !restaurant.deliveryFee || restaurant.deliveryFee === 0

  return (
    <div
      onClick={onClick}
      className="cursor-pointer overflow-hidden rounded-2xl bg-white border border-gray-100 transition hover:shadow-md active:scale-[.98]"
    >
      {/* Hero */}
      <div className="relative h-32 overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}55, ${color})` }}>
        {restaurant.bannerImage ? (
          <img src={restaurant.bannerImage} alt={restaurant.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-5xl opacity-30">🍽️</div>
        )}
        {/* Logo */}
        <div className="absolute bottom-0 left-3 translate-y-1/2">
          {restaurant.logo ? (
            <img
              src={restaurant.logo}
              alt={restaurant.name}
              className="h-12 w-12 rounded-xl object-cover border-2 border-white shadow-sm"
            />
          ) : (
            <div
              className="h-12 w-12 rounded-xl border-2 border-white shadow-sm flex items-center justify-center text-lg font-black text-white"
              style={{ background: color }}
            >
              {restaurant.name?.charAt(0)}
            </div>
          )}
        </div>
        {isFree && (
          <div className="absolute top-2 right-2 rounded-full bg-green-500 px-2.5 py-0.5 text-xs font-bold text-white">
            Frete grátis
          </div>
        )}
      </div>

      {/* Info */}
      <div className="pt-8 pb-3 px-3">
        <p className="font-bold text-gray-900 text-sm">{restaurant.name}</p>
        {restaurant.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{restaurant.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {distanceKm !== undefined && (
            <span className="text-xs font-semibold text-blue-600">📍 {distanceLabel(distanceKm)}</span>
          )}
          {restaurant.estimatedTime && (
            <span className="text-xs text-gray-500">🕐 {restaurant.estimatedTime}</span>
          )}
          {!isFree && restaurant.deliveryFee && (
            <span className="text-xs text-gray-500">🛵 {fmt(restaurant.deliveryFee)}</span>
          )}
          {restaurant.minOrderValue ? (
            <span className="text-xs text-gray-400">Min: {fmt(restaurant.minOrderValue)}</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function StoreFrontPage() {
  const navigate = useNavigate()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [userLat, setUserLat]         = useState<number | null>(null)
  const [userLon, setUserLon]         = useState<number | null>(null)
  const [geoStatus, setGeoStatus]     = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle')
  const [sortByDistance, setSortByDistance] = useState(false)

  useEffect(() => {
    const unsub = subscribeAllRestaurants((all) => {
      // Apenas restaurantes com pedido online habilitado
      setRestaurants(all.filter((r) => r.onlineOrderEnabled === true))
      setLoading(false)
    })
    return unsub
  }, [])

  function requestLocation() {
    if (!navigator.geolocation) { setGeoStatus('denied'); return }
    setGeoStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude)
        setUserLon(pos.coords.longitude)
        setGeoStatus('ok')
        setSortByDistance(true)
      },
      () => setGeoStatus('denied'),
      { timeout: 8000 },
    )
  }

  function getDistance(r: Restaurant): number | undefined {
    if (userLat === null || userLon === null) return undefined
    // Restaurante precisa ter coordenadas salvas
    const lat = (r as any).lat as number | undefined
    const lon = (r as any).lon as number | undefined
    if (!lat || !lon) return undefined
    return haversineKm(userLat, userLon, lat, lon)
  }

  const categories = ['Todos', ...Object.keys(CATEGORY_ICONS).slice(1)]

  const displayed = restaurants
    .filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()))
    .map((r) => ({ ...r, _dist: getDistance(r) }))
    .sort((a, b) => {
      if (!sortByDistance) return 0
      const da = a._dist ?? Infinity
      const db = b._dist ?? Infinity
      return da - db
    })

  const freeDelivery = displayed.filter((r) => !r.deliveryFee || r.deliveryFee === 0)
  const others       = displayed.filter((r) => r.deliveryFee && r.deliveryFee > 0)

  return (
    <div className="min-h-screen" style={{ background: '#f7f7f7' }}>

      {/* Header vermelho estilo iFood */}
      <div style={{ background: '#ea1d2c' }} className="sticky top-0 z-20">
        <div className="px-4 pt-4 pb-3 max-w-2xl mx-auto">
          {/* Localização */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={geoStatus === 'ok' ? () => setSortByDistance(!sortByDistance) : requestLocation}
              className="flex items-center gap-1.5 text-white/90 hover:text-white transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span className="text-sm font-semibold">
                {geoStatus === 'idle'   && 'Usar minha localização'}
                {geoStatus === 'loading'&& 'Localizando…'}
                {geoStatus === 'denied' && 'Localização negada'}
                {geoStatus === 'ok'     && (sortByDistance ? '📍 Mais próximos primeiro' : '📍 Localização ativa')}
              </span>
              {geoStatus === 'loading' && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {geoStatus === 'ok' && (
                <span className={`text-xs rounded-full px-2 py-0.5 font-bold transition ${sortByDistance ? 'bg-white text-red-600' : 'bg-white/20 text-white'}`}>
                  {sortByDistance ? 'ativado' : 'ordenar'}
                </span>
              )}
            </button>
            <span className="text-white/60 text-xs">{displayed.length} lojas</span>
          </div>
          {/* Campo de busca */}
          <div className="flex items-center gap-2 rounded-xl bg-white/20 border border-white/30 px-3 py-2.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar restaurante…"
              className="flex-1 bg-transparent text-white placeholder-white/70 text-sm outline-none"
            />
          </div>
        </div>

        {/* Categorias */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 max-w-2xl mx-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                activeCategory === cat
                  ? 'bg-white text-red-600'
                  : 'bg-white/20 text-white border border-white/30'
              }`}
            >
              {CATEGORY_ICONS[cat] || '🍽️'} {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="mx-auto max-w-2xl px-4 py-4">

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
            <p className="text-sm">Buscando restaurantes…</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
            <span className="text-6xl">🍽️</span>
            <p className="text-sm font-medium">Nenhum restaurante encontrado</p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-xs text-red-500 underline"
              >
                Limpar busca
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Frete grátis */}
            {freeDelivery.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🛵</span>
                  <p className="text-sm font-black text-gray-800">Frete grátis</p>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                    {freeDelivery.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {freeDelivery.map((r) => (
                    <RestaurantCard
                      key={r.id}
                      restaurant={r}
                      distanceKm={r._dist}
                      onClick={() => navigate(`/pedido/${r.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Outros */}
            {others.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🍽️</span>
                  <p className="text-sm font-black text-gray-800">
                    {freeDelivery.length > 0 ? 'Outros restaurantes' : 'Restaurantes'}
                  </p>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
                    {others.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {others.map((r) => (
                    <RestaurantCard
                      key={r.id}
                      restaurant={r}
                      distanceKm={r._dist}
                      onClick={() => navigate(`/pedido/${r.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Todos juntos quando não há distinção */}
            {freeDelivery.length === 0 && others.length === 0 && displayed.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {displayed.map((r) => (
                  <RestaurantCard
                    key={r.id}
                    restaurant={r}
                    distanceKm={r._dist}
                    onClick={() => navigate(`/pedido/${r.id}`)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
