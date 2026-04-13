/**
 * Central de Lojas — UX moderno
 * Rota pública: /loja
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/services/firebase'
import type { Restaurant, Product } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function distLabel(km: number) {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`
}

// ─── Componente: Card do restaurante ─────────────────────────────────────────

function RestCard({ r, dist, onClick }: {
  r: Restaurant & { _dist?: number }
  dist?: number
  onClick: () => void
}) {
  const color = r.primaryColor || '#ea1d2c'
  const isFree = !r.deliveryFee || r.deliveryFee === 0

  return (
    <div
      onClick={onClick}
      className="group relative overflow-hidden rounded-3xl cursor-pointer"
      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}
    >
      {/* Hero */}
      <div className="relative h-36 overflow-hidden">
        {r.bannerImage ? (
          <img src={r.bannerImage} alt={r.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full transition-transform duration-500 group-hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${color}40 0%, ${color}99 100%)` }}>
            <div className="flex h-full items-center justify-center text-6xl opacity-30">🍽️</div>
          </div>
        )}
        {/* Overlay gradiente */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)' }} />

        {/* Badges */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 items-end">
          {isFree && (
            <span className="rounded-full bg-green-500 px-2.5 py-0.5 text-xs font-black text-white shadow-sm">
              Frete grátis
            </span>
          )}
          {dist !== undefined && (
            <span className="rounded-full bg-white/90 backdrop-blur px-2.5 py-0.5 text-xs font-bold text-gray-700 shadow-sm">
              📍 {distLabel(dist)}
            </span>
          )}
        </div>

        {/* Logo flutuante */}
        <div className="absolute -bottom-5 left-3">
          {r.logo ? (
            <img src={r.logo} alt={r.name}
              className="h-12 w-12 rounded-2xl object-cover border-2 border-white shadow-md" />
          ) : (
            <div className="h-12 w-12 rounded-2xl border-2 border-white shadow-md flex items-center justify-center text-lg font-black text-white"
              style={{ background: color }}>
              {r.name?.charAt(0)}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-white pt-7 pb-3.5 px-3.5">
        <p className="font-black text-sm text-gray-900 leading-tight truncate">{r.name}</p>
        {r.description && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{r.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {r.estimatedTime && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className="text-gray-300">⏱</span>{r.estimatedTime}
            </span>
          )}
          {!isFree && r.deliveryFee ? (
            <span className="text-xs text-gray-500">🛵 {fmt(r.deliveryFee)}</span>
          ) : null}
          {r.minOrderValue ? (
            <span className="text-xs text-gray-400">Mín {fmt(r.minOrderValue)}</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Componente: Card de promoção ─────────────────────────────────────────────

function PromoCard({ item, restName, restColor, onClick }: {
  item: Product
  restName?: string
  restColor?: string
  onClick: () => void
}) {
  const color = restColor || '#ea1d2c'
  const discount = item.price > 0 && item.promotionPrice
    ? Math.round(((item.price - item.promotionPrice) / item.price) * 100)
    : 0

  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-3 rounded-2xl bg-white p-3 cursor-pointer transition-all hover:shadow-md active:scale-[.98]"
      style={{ border: '1px solid #f3f4f6' }}
    >
      {/* Imagem */}
      <div className="relative shrink-0">
        {item.image ? (
          <img src={item.image} alt={item.name}
            className="h-16 w-16 rounded-xl object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="h-16 w-16 rounded-xl bg-gray-100 flex items-center justify-center text-2xl">🍽️</div>
        )}
        {discount > 0 && (
          <div className="absolute -top-1.5 -right-1.5 h-7 w-7 rounded-full bg-red-500 flex items-center justify-center shadow-sm">
            <span className="text-white font-black" style={{ fontSize: 9 }}>-{discount}%</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
        {restName && (
          <p className="text-xs font-semibold mt-0.5" style={{ color }}>🏪 {restName}</p>
        )}
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-base font-black" style={{ color }}>
            {fmt(item.promotionPrice ?? item.price)}
          </span>
          {item.promotionPrice && item.promotionPrice < item.price && (
            <span className="text-xs text-gray-400 line-through">{fmt(item.price)}</span>
          )}
        </div>
      </div>

      {/* Badge + seta */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        {item.promotionLabel && (
          <span className="rounded-full bg-red-50 text-red-600 text-xs font-bold px-2 py-0.5 border border-red-100">
            {item.promotionLabel}
          </span>
        )}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2.5" strokeLinecap="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function StoreFrontPage() {
  const navigate = useNavigate()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading]         = useState(true)
  const [promos, setPromos]           = useState<Product[]>([])
  const [promosLoading, setPromosLoading] = useState(true)
  const [search, setSearch]           = useState('')
  const [activeTab, setActiveTab]     = useState<'lojas' | 'promos'>('lojas')
  const [userLat, setUserLat]         = useState<number | null>(null)
  const [userLon, setUserLon]         = useState<number | null>(null)
  const [geoStatus, setGeoStatus]     = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle')
  const [sortByDist, setSortByDist]   = useState(false)

  // ── Restaurantes públicos ──
  useEffect(() => {
    const q = query(collection(db, 'restaurants'), where('onlineOrderEnabled', '==', true))
    const unsub = onSnapshot(q,
      (snap) => { setRestaurants(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Restaurant)); setLoading(false) },
      () => setLoading(false)
    )
    return unsub
  }, [])

  // ── Promoções ──
  useEffect(() => {
    const q = query(collection(db, 'products'), where('onPromotion', '==', true), where('active', '==', true))
    const unsub = onSnapshot(q,
      (snap) => { setPromos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product)); setPromosLoading(false) },
      () => setPromosLoading(false)
    )
    return unsub
  }, [])

  function requestLocation() {
    if (!navigator.geolocation) { setGeoStatus('denied'); return }
    setGeoStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (p) => { setUserLat(p.coords.latitude); setUserLon(p.coords.longitude); setGeoStatus('ok'); setSortByDist(true) },
      () => setGeoStatus('denied'),
      { timeout: 8000 },
    )
  }

  function getDist(r: Restaurant): number | undefined {
    if (!userLat || !userLon) return undefined
    const lat = (r as any).lat as number | undefined
    const lon = (r as any).lon as number | undefined
    if (!lat || !lon) return undefined
    return haversineKm(userLat, userLon, lat, lon)
  }

  const displayed = restaurants
    .filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()))
    .map((r) => ({ ...r, _dist: getDist(r) }))
    .sort((a, b) => sortByDist ? ((a._dist ?? Infinity) - (b._dist ?? Infinity)) : 0)

  const freeRests  = displayed.filter((r) => !r.deliveryFee || r.deliveryFee === 0)
  const otherRests = displayed.filter((r) => r.deliveryFee && r.deliveryFee > 0)

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: '#f4f4f4' }}>

      {/* ── HERO HEADER com glassmorphism ── */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #c8101e 0%, #ea1d2c 50%, #ff4655 100%)' }}>
        {/* Círculos decorativos */}
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full opacity-20" style={{ background: 'rgba(255,255,255,0.3)' }} />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full opacity-10" style={{ background: 'rgba(255,255,255,0.4)' }} />
        <div className="absolute top-8 right-32 h-20 w-20 rounded-full opacity-15" style={{ background: 'rgba(255,255,255,0.3)' }} />

        <div className="relative px-4 pt-8 pb-4 max-w-2xl mx-auto">
          {/* Logo / título */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">FoodStore</h1>
              <p className="text-white/70 text-xs mt-0.5">Peça do seu restaurante favorito</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-xl">🍽️</div>
          </div>

          {/* Busca com glass */}
          <div className="flex items-center gap-2 rounded-2xl px-4 py-3 mb-4"
            style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar restaurante ou prato…"
              className="flex-1 bg-transparent text-white placeholder-white/60 text-sm outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-white/60 hover:text-white text-sm">✕</button>
            )}
          </div>

          {/* Geo button */}
          <button
            onClick={geoStatus === 'ok' ? () => setSortByDist(!sortByDist) : requestLocation}
            className="flex items-center gap-2 mb-5"
          >
            <div className="flex items-center gap-2 rounded-full px-3 py-1.5"
              style={{ background: geoStatus === 'ok' && sortByDist ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}>
              {geoStatus === 'loading' ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke={geoStatus === 'ok' && sortByDist ? '#ea1d2c' : 'white'} strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
              )}
              <span className="text-xs font-bold" style={{ color: geoStatus === 'ok' && sortByDist ? '#ea1d2c' : 'white' }}>
                {geoStatus === 'idle'    && 'Usar minha localização'}
                {geoStatus === 'loading' && 'Localizando…'}
                {geoStatus === 'denied'  && 'Localização indisponível'}
                {geoStatus === 'ok' && (sortByDist ? 'Mais próximos primeiro' : 'Localização ativa')}
              </span>
            </div>
          </button>

          {/* Tabs */}
          <div className="flex gap-2">
            {[
              { id: 'lojas' as const,  label: '🏪 Lojas',    count: displayed.length },
              { id: 'promos' as const, label: '🏷️ Promoções', count: promos.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all"
                style={activeTab === tab.id
                  ? { background: 'white', color: '#ea1d2c' }
                  : { background: 'rgba(255,255,255,0.18)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }
                }
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="rounded-full px-1.5 py-0.5 text-xs font-black"
                    style={activeTab === tab.id
                      ? { background: '#ea1d2c', color: 'white' }
                      : { background: 'rgba(255,255,255,0.25)', color: 'white' }
                    }>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTEÚDO ── */}
      <div className="mx-auto max-w-2xl px-4 py-5">

        {/* ── ABA PROMOÇÕES ── */}
        {activeTab === 'promos' && (
          promosLoading ? (
            <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
              <p className="text-sm">Buscando promoções…</p>
            </div>
          ) : promos.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-20">
              <div className="h-20 w-20 rounded-3xl bg-red-50 flex items-center justify-center text-4xl">🏷️</div>
              <p className="text-sm font-semibold text-gray-500">Nenhuma promoção ativa agora</p>
              <p className="text-xs text-gray-400">Volte mais tarde — os restaurantes atualizam com frequência</p>
            </div>
          ) : (
            <>
              {/* Banner de destaque — primeira promoção */}
              {(() => {
                const star = promos[0]
                const starRest = restaurants.find((r) => r.id === star.restaurantId)
                const color = starRest?.primaryColor || '#ea1d2c'
                const disc = star.price > 0 && star.promotionPrice
                  ? Math.round(((star.price - star.promotionPrice) / star.price) * 100) : 0
                return (
                  <div
                    onClick={() => navigate(`/pedido/${star.restaurantId}`)}
                    className="relative overflow-hidden rounded-3xl mb-4 cursor-pointer"
                    style={{ background: `linear-gradient(135deg, ${color}15, ${color}30)`, border: `1.5px solid ${color}30` }}
                  >
                    <div className="flex items-center gap-4 p-4">
                      <div className="relative shrink-0">
                        {star.image ? (
                          <img src={star.image} alt={star.name} className="h-20 w-20 rounded-2xl object-cover shadow-md" />
                        ) : (
                          <div className="h-20 w-20 rounded-2xl bg-white/60 flex items-center justify-center text-3xl">🍽️</div>
                        )}
                        {disc > 0 && (
                          <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full flex items-center justify-center shadow-md"
                            style={{ background: color }}>
                            <span className="text-white font-black" style={{ fontSize: 10 }}>-{disc}%</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="rounded-full text-white text-xs font-black px-2.5 py-0.5" style={{ background: color }}>
                            ⭐ DESTAQUE
                          </span>
                          {star.promotionLabel && (
                            <span className="text-xs font-bold" style={{ color }}>{star.promotionLabel}</span>
                          )}
                        </div>
                        <p className="font-black text-gray-900 text-base leading-tight">{star.name}</p>
                        {starRest && <p className="text-xs font-semibold mt-0.5" style={{ color }}>🏪 {starRest.name}</p>}
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-xl font-black" style={{ color }}>{fmt(star.promotionPrice ?? star.price)}</span>
                          {star.promotionPrice && star.promotionPrice < star.price && (
                            <span className="text-sm text-gray-400 line-through">{fmt(star.price)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="absolute bottom-0 right-0 w-24 h-24 opacity-10 rounded-tl-full" style={{ background: color }} />
                  </div>
                )
              })()}

              {/* Lista */}
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3 px-1">
                Todas as promoções · {promos.length} item{promos.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-2.5">
                {promos.map((item) => {
                  const rest = restaurants.find((r) => r.id === item.restaurantId)
                  return (
                    <PromoCard
                      key={item.id}
                      item={item}
                      restName={rest?.name}
                      restColor={rest?.primaryColor}
                      onClick={() => navigate(`/pedido/${item.restaurantId}`)}
                    />
                  )
                })}
              </div>
            </>
          )
        )}

        {/* ── ABA LOJAS ── */}
        {activeTab === 'lojas' && (
          loading ? (
            <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
              <p className="text-sm">Buscando restaurantes…</p>
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-20">
              <div className="h-20 w-20 rounded-3xl bg-gray-100 flex items-center justify-center text-4xl">🍽️</div>
              <p className="text-sm font-semibold text-gray-500">
                {search ? `Nenhum resultado para "${search}"` : 'Nenhum restaurante disponível'}
              </p>
              {search && (
                <button onClick={() => setSearch('')} className="text-sm text-red-500 font-semibold underline">Limpar busca</button>
              )}
            </div>
          ) : (
            <>
              {/* Frete grátis */}
              {freeRests.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                      <span style={{ fontSize: 12 }}>🛵</span>
                    </div>
                    <p className="text-sm font-black text-gray-800">Frete grátis</p>
                    <span className="ml-auto rounded-full bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5">{freeRests.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {freeRests.map((r) => (
                      <RestCard key={r.id} r={r} dist={r._dist} onClick={() => navigate(`/pedido/${r.id}`)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Outros */}
              {otherRests.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center">
                      <span style={{ fontSize: 12 }}>🍽️</span>
                    </div>
                    <p className="text-sm font-black text-gray-800">
                      {freeRests.length > 0 ? 'Mais restaurantes' : 'Restaurantes'}
                    </p>
                    <span className="ml-auto rounded-full bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5">{otherRests.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {otherRests.map((r) => (
                      <RestCard key={r.id} r={r} dist={r._dist} onClick={() => navigate(`/pedido/${r.id}`)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Todos quando sem distinção */}
              {freeRests.length === 0 && otherRests.length === 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {displayed.map((r) => (
                    <RestCard key={r.id} r={r} dist={r._dist} onClick={() => navigate(`/pedido/${r.id}`)} />
                  ))}
                </div>
              )}
            </>
          )
        )}

      </div>
    </div>
  )
}
