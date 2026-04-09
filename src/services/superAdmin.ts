import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, getDocs, query, where,
  Timestamp, type Unsubscribe, setDoc,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type { AppModule, AppUser, Restaurant, Role } from '@/types'

// ─── Restaurantes ─────────────────────────────────────────────────────────────

export function subscribeAllRestaurants(
  callback: (restaurants: Restaurant[]) => void,
): Unsubscribe {
  return onSnapshot(collection(db, 'restaurants'), (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
      }) as Restaurant),
    )
  })
}

export async function createRestaurant(data: {
  name:         string
  primaryColor: string
  serviceRate:  number
}): Promise<string> {
  const ref = await addDoc(collection(db, 'restaurants'), {
    name:           data.name,
    logo:           '',
    primaryColor:   data.primaryColor,
    secondaryColor: '#1f2937',
    serviceRate:    data.serviceRate / 100,
    createdAt:      Timestamp.now(),
  })
  return ref.id
}

export async function updateRestaurantById(
  id: string,
  data: Partial<Omit<Restaurant, 'id' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(doc(db, 'restaurants', id), data)
}

export async function deleteRestaurantById(id: string): Promise<void> {
  // Apaga o documento do restaurante
  await deleteDoc(doc(db, 'restaurants', id))
}

// ─── Usuários globais ─────────────────────────────────────────────────────────

export function subscribeAllUsers(
  callback: (users: AppUser[]) => void,
): Unsubscribe {
  return onSnapshot(collection(db, 'users'), (snap) => {
    callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as AppUser))
  })
}

export function subscribeUsersByRestaurant(
  restaurantId: string,
  callback: (users: AppUser[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'users'), where('restaurantId', '==', restaurantId))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as AppUser))
  })
}

export async function createUserForRestaurant(data: {
  name:         string
  email:        string
  password:     string
  role:         Role
  restaurantId: string
}): Promise<void> {
  if (!auth.currentUser) throw new Error('Não autenticado')

  const apiKey: string = import.meta.env.VITE_FIREBASE_API_KEY
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:             data.email,
        password:          data.password,
        returnSecureToken: true,
      }),
    },
  )
  const json = await res.json()
  if (json.error) {
    const code = json.error.message as string
    if (code.includes('EMAIL_EXISTS'))  throw new Error('E-mail já está em uso')
    if (code.includes('WEAK_PASSWORD')) throw new Error('Senha muito fraca (mín. 6 caracteres)')
    if (code.includes('INVALID_EMAIL')) throw new Error('E-mail inválido')
    throw new Error(`Erro: ${code}`)
  }
  await setDoc(doc(db, 'users', json.localId as string), {
    name:         data.name,
    email:        data.email,
    role:         data.role,
    restaurantId: data.restaurantId,
    disabled:     false,
  })
}

export async function updateUserById(
  uid: string,
  data: Partial<Pick<AppUser, 'name' | 'role' | 'disabled' | 'visibleModules' | 'restaurantId'>>,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), data)
}

export async function deleteUserById(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid))
}

// ─── Módulos padrão por role ───────────────────────────────────────────────────

export const DEFAULT_MODULES: Record<Role, AppModule[]> = {
  superadmin: [
    'central', 'dashboard', 'tables', 'orders', 'kitchen', 'cashier',
    'marmitaria', 'delivery', 'menu', 'users', 'qrcodes', 'settings', 'online-orders',
  ],
  admin: [
    'central', 'dashboard', 'tables', 'orders', 'kitchen', 'cashier',
    'marmitaria', 'delivery', 'menu', 'users', 'qrcodes', 'settings', 'online-orders',
  ],
  cashier:  ['central', 'cashier', 'marmitaria', 'tables', 'orders'],
  waiter:   ['central', 'tables', 'orders', 'marmitaria'],
  kitchen:  ['kitchen'],
  delivery: ['delivery'],
}

export const ALL_MODULES: { key: AppModule; label: string; icon: string }[] = [
  { key: 'central',      label: 'Central de Pedidos', icon: '📋' },
  { key: 'dashboard',     label: 'Dashboard',        icon: '📊' },
  { key: 'tables',        label: 'Mesas',             icon: '🍽️' },
  { key: 'orders',        label: 'Pedidos',           icon: '🧾' },
  { key: 'kitchen',       label: 'Cozinha',           icon: '👨‍🍳' },
  { key: 'cashier',       label: 'Caixa / PDV',       icon: '💳' },
  { key: 'marmitaria',    label: 'Marmitaria',        icon: '🍱' },
  { key: 'delivery',      label: 'Entregas',          icon: '🛵' },
  { key: 'online-orders', label: 'Pedidos Online',    icon: '🌐' },
  { key: 'menu',          label: 'Cardápio',          icon: '🍔' },
  { key: 'users',         label: 'Usuários',          icon: '👥' },
  { key: 'qrcodes',       label: 'QR Codes',          icon: '📷' },
  { key: 'settings',      label: 'Configurações',     icon: '⚙️' },
]
