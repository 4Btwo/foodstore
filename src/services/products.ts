import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Product } from '@/types'

export function subscribeProducts(
  restaurantId: string,
  callback: (products: Product[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'products'),
    where('restaurantId', '==', restaurantId),
    where('active', '==', true),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product))
  })
}

export async function getProductsByRestaurant(restaurantId: string): Promise<Product[]> {
  const q = query(
    collection(db, 'products'),
    where('restaurantId', '==', restaurantId),
    where('active', '==', true),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product)
}
