import {
  collection, doc, addDoc, deleteDoc,
  query, where, getDocs,
} from 'firebase/firestore'
import { db } from './firebase'

export async function addTable(restaurantId: string, number: number): Promise<void> {
  await addDoc(collection(db, 'tables'), {
    restaurantId,
    number,
    status: 'free',
  })
}

export async function deleteTable(tableId: string): Promise<void> {
  await deleteDoc(doc(db, 'tables', tableId))
}

export async function tableNumberExists(restaurantId: string, number: number): Promise<boolean> {
  const q = query(
    collection(db, 'tables'),
    where('restaurantId', '==', restaurantId),
    where('number', '==', number),
  )
  const snap = await getDocs(q)
  return !snap.empty
}
