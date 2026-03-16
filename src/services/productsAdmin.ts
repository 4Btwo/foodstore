import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  query, where, onSnapshot, type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Product, ProductCategory } from '@/types'

export function subscribeAllProducts(
  restaurantId: string,
  callback: (products: Product[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'products'), where('restaurantId', '==', restaurantId))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product))
  })
}

export async function createProduct(data: Omit<Product, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'products'), data)
  return ref.id
}

export async function updateProduct(id: string, data: Partial<Omit<Product, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'products', id), data)
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, 'products', id))
}

export async function toggleProductActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, 'products', id), { active })
}

export const CATEGORIES: ProductCategory[] = [
  'Hambúrguer', 'Bebidas', 'Porções', 'Sobremesa', 'Outros',
]
