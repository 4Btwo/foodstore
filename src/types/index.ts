// ─── Roles ────────────────────────────────────────────────────────────────────
export type Role = 'admin' | 'cashier' | 'waiter' | 'kitchen'

// ─── User ─────────────────────────────────────────────────────────────────────
export interface AppUser {
  uid:          string
  name:         string
  email:        string
  role:         Role
  restaurantId: string
}

// ─── Restaurant ───────────────────────────────────────────────────────────────
export interface Restaurant {
  id:             string
  name:           string
  logo:           string
  primaryColor:   string
  secondaryColor: string
  serviceRate:    number   // e.g. 0.10 = 10%
  createdAt:      Date
}

// ─── Product ──────────────────────────────────────────────────────────────────
export type ProductCategory =
  | 'Hambúrguer'
  | 'Bebidas'
  | 'Porções'
  | 'Sobremesa'
  | 'Outros'

export interface Product {
  id:           string
  restaurantId: string
  name:         string
  price:        number
  category:     ProductCategory
  image:        string
  active:       boolean
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
