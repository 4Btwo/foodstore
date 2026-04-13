/**
 * Landing.tsx — Página de captação de restaurantes
 * Rota pública: /
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createLead } from '@/services/superAdmin'

// ─── Planos ───────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id:       'starter',
    name:     'Starter',
    price:    'R$ 97',
    period:   '/mês',
    desc:     'Ideal para começar',
    color:    'from-gray-700 to-gray-900',
    features: [
      '1 restaurante',
      'Até 3 usuários',
      'Pedidos de mesa (QR Code)',
      'Cardápio digital',
      'Central de pedidos',
      'Suporte por e-mail',
    ],
    cta:      'Começar grátis por 7 dias',
    highlight: false,
  },
  {
    id:       'pro',
    name:     'Pro',
    price:    'R$ 197',
    period:   '/mês',
    desc:     'Mais vendido 🔥',
    color:    'from-orange-500 to-orange-700',
    features: [
      '1 restaurante',
      'Usuários ilimitados',
      'Tudo do Starter +',
      'Pedidos online (delivery)',
      'Impressão automática',
      'Marmitaria / delivery',
      'Dashboard completo',
      'Suporte prioritário',
    ],
    cta:      'Assinar Pro',
    highlight: true,
  },
  {
    id:       'enterprise',
    name:     'Enterprise',
    price:    'Sob consulta',
    period:   '',
    desc:     'Para redes e franquias',
    color:    'from-purple-600 to-purple-900',
    features: [
      'Múltiplos restaurantes',
      'White label',
      'API dedicada',
      'Onboarding personalizado',
      'SLA garantido',
      'Gerente de conta dedicado',
    ],
    cta:      'Falar com vendas',
    highlight: false,
  },
]

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: '📋', title: 'Central de Pedidos',    desc: 'Todos os pedidos (mesa, balcão, online e marmita) em uma única tela. Confirmação com um toque.' },
  { icon: '🖨️', title: 'Impressão Automática',  desc: 'Ticket na cozinha assim que o pedido é confirmado. Suporte a Bluetooth e USB, sem configuração.' },
  { icon: '🌐', title: 'Cardápio Digital',       desc: 'Link e QR Code únicos para o cliente pedir da mesa ou de casa. Sem app para baixar.' },
  { icon: '🛵', title: 'Gestão de Entregas',    desc: 'Atribua entregadores, rastreie corridas e veja os ganhos por motoboy em tempo real.' },
  { icon: '📊', title: 'Dashboard Financeiro',  desc: 'Faturamento do dia, ticket médio, produtos mais vendidos e controle de estoque automático.' },
  { icon: '🔐', title: 'Multi-usuário',          desc: 'Crie perfis de Admin, Garçom, Cozinheiro e Entregador. Cada um vê só o que precisa.' },
]

// ─── Formulário de captação ────────────────────────────────────────────────────

function LeadForm({ selectedPlan, onClose }: { selectedPlan: string; onClose: () => void }) {
  const [nome,        setNome]        = useState('')
  const [email,       setEmail]       = useState('')
  const [whatsapp,    setWhatsapp]    = useState('')
  const [restaurante, setRestaurante] = useState('')
  const [mensagem,    setMensagem]    = useState('')
  const [sending,     setSending]     = useState(false)
  const [sent,        setSent]        = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome || !email || !restaurante) return
    setSending(true)
    try {
      await createLead({ nome, email, whatsapp, restaurante, mensagem, plano: selectedPlan })
      setSent(true)
    } catch {
      // ignore
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="rounded-3xl bg-white p-10 text-center max-w-sm w-full" onClick={e => e.stopPropagation()}>
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-2xl font-black text-gray-900 mb-2">Recebemos seu contato!</h3>
          <p className="text-gray-500 mb-6">Nossa equipe vai entrar em contato em até 24h. Obrigado!</p>
          <button onClick={onClose} className="w-full rounded-2xl bg-orange-500 py-3 font-bold text-white hover:bg-orange-600">
            Fechar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-black text-gray-900 mb-1">Vamos começar? 🚀</h3>
        <p className="text-sm text-gray-500 mb-5">Plano <strong>{selectedPlan}</strong> — preencha seus dados e entraremos em contato.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input required value={nome} onChange={e => setNome(e.target.value)}
            placeholder="Seu nome *" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10" />
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="E-mail *" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10" />
          <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
            placeholder="WhatsApp (com DDD)" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10" />
          <input required value={restaurante} onChange={e => setRestaurante(e.target.value)}
            placeholder="Nome do restaurante *" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10" />
          <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} rows={2}
            placeholder="Alguma dúvida? (opcional)" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 resize-none" />
          <button type="submit" disabled={sending}
            className="w-full rounded-2xl bg-orange-500 py-3.5 font-bold text-white hover:bg-orange-600 disabled:opacity-60 transition">
            {sending ? 'Enviando…' : 'Quero conhecer o FoodStore →'}
          </button>
        </form>
        <button onClick={onClose} className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function LandingPage() {
  const navigate                    = useNavigate()
  const [formPlan, setFormPlan]     = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500 text-white font-black text-sm">F</div>
            <span className="text-lg font-black text-gray-900">FoodStore</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/login')}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium">
              Entrar
            </button>
            <button onClick={() => setFormPlan('Pro')}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 transition">
              Começar grátis
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-24 text-white">
        {/* Glow decorativo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-orange-500/20 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-500/20 border border-orange-500/30 px-4 py-1.5 text-sm text-orange-300 font-medium">
            🚀 Sistema completo para restaurantes
          </div>
          <h1 className="mb-6 text-5xl font-black leading-tight sm:text-6xl">
            Seu restaurante<br/>
            <span className="text-orange-400">no próximo nível</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-300 leading-relaxed">
            Pedidos de mesa, delivery, marmitaria e cardápio digital — tudo em um único sistema.
            Da cozinha ao caixa, automatizado e em tempo real.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => setFormPlan('Pro')}
              className="rounded-2xl bg-orange-500 px-8 py-4 text-base font-bold text-white hover:bg-orange-600 transition shadow-lg shadow-orange-500/30">
              Começar grátis por 7 dias →
            </button>
            <button onClick={() => navigate('/loja')}
              className="rounded-2xl border border-white/20 bg-white/10 px-8 py-4 text-base font-semibold text-white hover:bg-white/20 transition backdrop-blur-sm">
              Ver demonstração
            </button>
          </div>
          <p className="mt-4 text-xs text-gray-500">Sem cartão de crédito · Cancele quando quiser</p>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-black text-gray-900 mb-3">Tudo que você precisa, em um lugar só</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Chega de sistemas separados, impressoras que não conectam e pedidos perdidos.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl bg-white border border-gray-100 p-6 shadow-sm hover:shadow-md transition">
                <div className="mb-3 text-3xl">{f.icon}</div>
                <h3 className="mb-2 font-bold text-gray-900">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Fluxo visual ──────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-black text-gray-900 mb-3">Como funciona</h2>
          <p className="text-gray-500 mb-12">Do pedido à entrega, tudo automatizado</p>
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { step: '1', icon: '📱', title: 'Cliente pede', desc: 'QR Code na mesa ou link de delivery' },
              { step: '2', icon: '📋', title: 'Central recebe', desc: 'Confirmação com um toque' },
              { step: '3', icon: '🖨️', title: 'Cozinha imprime', desc: 'Ticket automático, sem erro' },
              { step: '4', icon: '✅', title: 'Entregue', desc: 'Histórico e financeiro completos' },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 border-2 border-orange-200 text-2xl">
                  {s.icon}
                </div>
                <p className="font-bold text-gray-900 text-sm">{s.title}</p>
                <p className="text-xs text-gray-400 text-center">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Planos ────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50" id="planos">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-black text-gray-900 mb-3">Planos e preços</h2>
            <p className="text-gray-500">Comece grátis, escale quando precisar</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <div key={plan.id}
                className={`relative rounded-3xl p-6 flex flex-col ${plan.highlight
                  ? 'bg-gradient-to-b from-orange-500 to-orange-700 text-white shadow-2xl shadow-orange-500/30 scale-105'
                  : 'bg-white border border-gray-100 shadow-sm text-gray-900'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-yellow-400 px-4 py-1 text-xs font-black text-yellow-900">
                    MAIS POPULAR
                  </div>
                )}
                <div className="mb-4">
                  <p className={`text-sm font-semibold ${plan.highlight ? 'text-orange-200' : 'text-gray-500'}`}>{plan.desc}</p>
                  <h3 className="text-xl font-black">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-black">{plan.price}</span>
                    <span className={`text-sm ${plan.highlight ? 'text-orange-200' : 'text-gray-400'}`}>{plan.period}</span>
                  </div>
                </div>
                <ul className="mb-6 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <span className={plan.highlight ? 'text-orange-200' : 'text-green-500'}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setFormPlan(plan.name)}
                  className={`w-full rounded-2xl py-3 font-bold transition ${plan.highlight
                    ? 'bg-white text-orange-600 hover:bg-orange-50'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-gray-900 to-gray-800 text-white text-center">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-4xl font-black mb-4">Pronto para decolar? 🚀</h2>
          <p className="text-gray-400 mb-8">Junte-se a centenas de restaurantes que já usam o FoodStore para vender mais e trabalhar menos.</p>
          <button onClick={() => setFormPlan('Pro')}
            className="rounded-2xl bg-orange-500 px-10 py-4 text-lg font-black text-white hover:bg-orange-600 transition shadow-lg shadow-orange-500/30">
            Começar grátis agora →
          </button>
          <p className="mt-4 text-xs text-gray-600">7 dias grátis · Sem cartão · Suporte incluído</p>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-white py-8 text-center text-xs text-gray-400">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500 text-white font-black text-xs">F</div>
          <span className="font-bold text-gray-700">FoodStore</span>
        </div>
        <p>© {new Date().getFullYear()} FoodStore. Todos os direitos reservados.</p>
        <div className="mt-2 flex justify-center gap-4">
          <button onClick={() => navigate('/login')} className="hover:text-gray-600">Entrar</button>
          <span>·</span>
          <button onClick={() => navigate('/loja')} className="hover:text-gray-600">Central de lojas</button>
        </div>
      </footer>

      {/* ── Modal de captação ─────────────────────────────────────────────── */}
      {formPlan && (
        <LeadForm selectedPlan={formPlan} onClose={() => setFormPlan(null)} />
      )}
    </div>
  )
}
