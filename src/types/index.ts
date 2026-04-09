// ─── Roles ────────────────────────────────────────────────────────────────────
export type Role = 'superadmin' | 'admin' | 'cashier' | 'waiter' | 'kitchen' | 'delivery'

// ─── Modules (visibilidade por usuário) ───────────────────────────────────────
export type AppModule =
  | 'central' | 'dashboard' | 'tables' | 'orders' | 'kitchen' | 'cashier'
  | 'marmitaria' | 'delivery' | 'menu' | 'users' | 'qrcodes'
  | 'settings' | 'online-orders'

// ─── User ─────────────────────────────────────────────────────────────────────
export interface AppUser {
  uid:             string
  name:            string
  email:           string
  role:            Role
  restaurantId:    string
  disabled?:       boolean
  visibleModules?: AppModule[]   // undefined = usa padrão da role
}

// ─── Restaurant ───────────────────────────────────────────────────────────────
export interface Restaurant {
  id:             string
  name:           string
  logo:           string
  primaryColor:   string
  secondaryColor: string
  serviceRate:    number
  createdAt:      Date

  // Informações do estabelecimento
  phone?:         string
  whatsapp?:      string
  email?:         string
  address?:       string
  city?:          string
  instagram?:     string
  facebook?:      string
  description?:   string   // bio / slogan

  // Pedido online
  onlineOrderEnabled?: boolean
  deliveryFee?:        number
  minOrderValue?:      number
  estimatedTime?:      string   // ex: "30–45 min"
  openingHours?:       string   // ex: "Seg–Sex 11h–22h"
}

// ─── Product ──────────────────────────────────────────────────────────────────
export type ProductCategory =
  | 'Hambúrguer'
  | 'Bebidas'
  | 'Porções'
  | 'Sobremesa'
  | 'Prato do Dia'
  | 'Outros'

export interface ProductSize {
  label: string   // 'P' | 'M' | 'G' | custom
  price: number
}

export interface Product {
  id:           string
  restaurantId: string
  name:         string
  description?: string           // acompanhamentos / descrição (usado em Prato do Dia)
  price:        number           // preço base (sem tamanho)
  category:     ProductCategory
  image:        string
  active:       boolean
  sizes?:       ProductSize[]    // opcional — se preenchido, cliente escolhe tamanho
  stock?:       number | null    // null = ilimitado
}

// ─── Tables ───────────────────────────────────────────────────────────────────
export type TableStatus = 'free' | 'open' | 'closing'

export interface Table {
  id:           string
  restaurantId: string
  number:       number
  status:       TableStatus
}

// ─── Orders ───────────────────────────────────────────────────────────────────
export type OrderStatus = 'new' | 'preparing' | 'ready' | 'closed'

export interface Order {
  id:           string
  restaurantId: string
  tableNumber:  number
  status:       OrderStatus
  createdAt:    Date
  total:        number
}

// ─── Order Items ──────────────────────────────────────────────────────────────
export interface OrderItem {
  id:        string
  orderId:   string
  productId: string
  name:      string
  qty:       number
  price:     number
  size?:     string   // tamanho selecionado, ex: 'G'
}

// ─── Table Calls ─────────────────────────────────────────────────────────────
export type CallStatus = 'pending' | 'answered'

export interface TableCall {
  id:           string
  tableNumber:  number
  restaurantId: string
  createdAt:    Date
  status:       CallStatus
}

// ─── Marmitaria ──────────────────────────────────────────────────────────────
export type MarmitaDeliveryType = 'pickup' | 'delivery'
export type MarmitaOrderStatus  = 'new' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled'

export interface DailyDish {
  id:           string
  restaurantId: string
  name:         string
  description:  string
  price:        number
  date:         string
  active:       boolean
  stock?:       number | null
  sizes?:       ProductSize[]    // tamanhos P, M, G etc
  productId?:   string
  createdAt:    Date
}

export interface MarmitaOrder {
  id:             string
  restaurantId:   string
  customerName:   string
  deliveryType:   MarmitaDeliveryType
  address?:       string
  phone?:         string
  status:         MarmitaOrderStatus
  notes?:         string
  total:          number
  deliveryUserId?: string   // uid do entregador atribuído
  deliveryName?:  string
  createdAt:      Date
}

export interface MarmitaOrderItem {
  id:             string
  marmitaOrderId: string
  dishId:         string
  name:           string
  qty:            number
  price:          number
  size?:          string
}

// ─── Pedido Online (link público) ────────────────────────────────────────────
export type OnlineOrderStatus = 'new' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled'
export type OnlineDeliveryType = 'pickup' | 'delivery'

export interface OnlineOrder {
  id:             string
  restaurantId:   string
  customerName:   string
  phone?:         string
  deliveryType:   OnlineDeliveryType
  address?:       string
  notes?:         string
  total:          number
  status:         OnlineOrderStatus
  createdAt:      Date
}

export interface OnlineOrderItem {
  id:            string
  onlineOrderId: string
  productId:     string
  name:          string
  qty:           number
  price:         number
  size?:         string
}

// ─── Entregador ───────────────────────────────────────────────────────────────
export interface DeliveryRun {
  id:           string
  restaurantId: string
  deliveryUserId: string
  deliveryName: string
  orderId:      string        // marmita_order id
  customerName: string
  address:      string
  total:        number
  status:       'assigned' | 'delivered'
  createdAt:    Date
  deliveredAt?: Date
}

// ─── Central de Pedidos — tipo unificado ─────────────────────────────────────
export type UnifiedOrderOrigin = 'mesa' | 'balcao' | 'online' | 'marmita'

export type UnifiedOrderStatus =
  | 'pending'           // aguardando confirmação da atendente
  | 'confirmed'         // confirmado, foi pra cozinha
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'closed'
  | 'cancelled'

export interface UnifiedOrderItem {
  name:  string
  qty:   number
  price: number
  size?: string
}

// Snapshot normalizado — lido de qualquer collection
export interface UnifiedOrder {
  id:           string
  origin:       UnifiedOrderOrigin
  originId:     string          // id na collection original
  restaurantId: string

  // Cliente / destino
  customerName?: string         // balcão / marmita / online
  tableNumber?:  number         // mesa
  phone?:        string
  address?:      string
  notes?:        string

  // Entrega
  deliveryType?: 'pickup' | 'delivery'
  deliveryUserId?: string
  deliveryName?: string

  // Estado
  status:    UnifiedOrderStatus
  total:     number
  items:     UnifiedOrderItem[]
  createdAt: Date
}
