import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { Restaurant } from '@/types'

export async function getRestaurant(restaurantId: string): Promise<Restaurant | null> {
  const snap = await getDoc(doc(db, 'restaurants', restaurantId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Restaurant
}

export async function updateRestaurant(
  restaurantId: string,
  data: Partial<Omit<Restaurant, 'id' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(doc(db, 'restaurants', restaurantId), data)
}
