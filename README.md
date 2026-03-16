# 🍽️ FoodStore — SaaS para Restaurantes

Sistema completo de gestão: PDV, mesas, pedidos em tempo real, cardápio digital via QR Code, pagamento PIX e dashboard de vendas.

---

## 🚀 Setup rápido

```bash
npm install
cp .env.example .env   # preencha com as chaves do Firebase
npm run dev            # http://localhost:5173
```

---

## 🗺️ Fases do projeto

| Fase | O que foi construído |
|------|----------------------|
| 0 | Estrutura, Firebase, Auth, Login |
| 1 | Mesas, Pedidos, Cozinha, PDV |
| 2 | PIX via Mercado Pago, QR Code, Cardápio cliente |
| 3 | Dashboard com Recharts, Configurações, Deploy CI/CD |

---

## 👤 Credenciais de teste (após rodar o seed)

| Role   | E-mail                     | Senha      | Redireciona para |
|--------|----------------------------|------------|-----------------|
| Admin  | admin@burgerhouse.com      | Admin@123  | /dashboard      |
| Caixa  | caixa@burgerhouse.com      | Caixa@123  | /cashier        |
| Garçom | garcom@burgerhouse.com     | Garcom@123 | /tables         |

---

## 📁 Estrutura completa

```
foodstore/
├── .github/workflows/deploy.yml    CI/CD Vercel via GitHub Actions
├── functions/src/index.ts          Cloud Functions: PIX + webhook
├── scripts/seed.mjs                Popula Firestore com dados iniciais
├── src/
│   ├── components/
│   │   ├── Layout.tsx              Sidebar + PageHeader
│   │   ├── PixModal.tsx            Modal QR Code PIX com polling
│   │   ├── ProtectedRoute.tsx      Proteção de rotas por role
│   │   ├── TableCard.tsx           Card de mesa com status
│   │   └── OrderStatusBadge.tsx    Badge de status do pedido
│   ├── contexts/AuthContext.tsx     Provider global de autenticação
│   ├── hooks/
│   │   ├── useAuth.ts              user, isAdmin, isCashier, isWaiter
│   │   ├── useTables.ts            Mesas em tempo real
│   │   ├── useOrders.ts            Pedidos com filtro de status
│   │   ├── useProducts.ts          Produtos por categoria
│   │   ├── useDashboard.ts         Métricas do dia
│   │   └── usePixPayment.ts        Estado PIX + polling
│   ├── pages/
│   │   ├── Login.tsx               Tela de login
│   │   ├── Dashboard.tsx           Métricas + gráficos Recharts
│   │   ├── Tables.tsx              Grid mesas + painel garçom
│   │   ├── Kitchen.tsx             Kanban cozinha
│   │   ├── Cashier.tsx             PDV + modal conta + PIX
│   │   ├── Orders.tsx              Lista de pedidos com filtros
│   │   ├── CustomerMenu.tsx        Cardápio público via QR
│   │   ├── QrCodes.tsx             Gerador QR por mesa
│   │   └── Settings.tsx            Configurações do restaurante
│   ├── services/
│   │   ├── firebase.ts             Init Firebase
│   │   ├── auth.ts                 signIn, signOut
│   │   ├── orders.ts               CRUD + listeners tempo real
│   │   ├── products.ts             Produtos com subscribe
│   │   ├── payments.ts             Chama Cloud Functions
│   │   ├── restaurant.ts           getRestaurant, updateRestaurant
│   │   └── dashboard.ts            Métricas e agregações
│   ├── types/index.ts              Tipos TypeScript
│   └── utils/qrcode.ts             URLs de QR Code
├── firestore.rules                 Regras de segurança
├── firestore.indexes.json          Índices compostos
├── vercel.json                     Config de deploy SPA
└── FASE2.md                        Setup Mercado Pago
```

---

## ☁️ Deploy na Vercel

### Opção 1 — Via painel (mais simples)
1. Push para GitHub
2. [vercel.com](https://vercel.com) → "Add New Project" → selecione o repo
3. Adicione as variáveis do `.env.example`
4. Deploy

### Opção 2 — CI/CD automático
Adicione estes secrets no GitHub (Settings > Secrets):

| Secret | Como obter |
|--------|-----------|
| `VERCEL_TOKEN` | vercel.com > Account Settings > Tokens |
| `VERCEL_ORG_ID` | `vercel whoami` |
| `VERCEL_PROJECT_ID` | `vercel link` |
| `VITE_FIREBASE_*` | Firebase Console |
| `VITE_APP_URL` | URL de produção |

---

## 🔄 Fluxo PIX

```
QR da mesa → /menu/:restaurantId/:table
→ cliente faz pedido → Cloud Function createPixPayment
→ Mercado Pago API → QR Code retornado
→ cliente paga → webhook confirma
→ pedido fechado + mesa liberada ✅
```

---

## 🔐 Schema Firestore

| Coleção | Campos principais |
|---------|-------------------|
| `restaurants` | name, logo, primaryColor, serviceRate, mpAccessToken |
| `users` | name, email, role (admin/cashier/waiter), restaurantId |
| `products` | restaurantId, name, price, category, active |
| `tables` | restaurantId, number, status (free/open/closing) |
| `orders` | restaurantId, tableNumber, status, total, mpPaymentId |
| `order_items` | orderId, productId, name, qty, price |
| `tableCalls` | restaurantId, tableNumber, status |
| `payments` | restaurantId, orderId, amount, method, paidAt |
