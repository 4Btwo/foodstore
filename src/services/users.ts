import {
  collection, query, where, onSnapshot,
  doc, updateDoc, setDoc, type Unsubscribe,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type { AppUser, Role } from '@/types'

export function subscribeUsers(
  restaurantId: string,
  callback: (users: AppUser[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'users'),
    where('restaurantId', '==', restaurantId),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as AppUser))
  })
}

/**
 * Cria usuário via Firebase Auth REST API.
 * NÃO afeta a sessão do admin logado.
 * NÃO precisa de Cloud Functions nem plano Blaze.
 */
export async function createUser(data: {
  name:         string
  email:        string
  password:     string
  role:         Role
  restaurantId: string
}): Promise<void> {
  if (!auth.currentUser) throw new Error('Admin não autenticado')

  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string

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
    if (code.includes('EMAIL_EXISTS'))   throw new Error('Este e-mail já está em uso')
    if (code.includes('WEAK_PASSWORD'))  throw new Error('Senha muito fraca (mínimo 6 caracteres)')
    if (code.includes('INVALID_EMAIL'))  throw new Error('E-mail inválido')
    throw new Error(`Erro ao criar usuário: ${code}`)
  }

  const newUid = json.localId as string

  await setDoc(doc(db, 'users', newUid), {
    name:         data.name,
    email:        data.email,
    role:         data.role,
    restaurantId: data.restaurantId,
    disabled:     false,
  })
}

export async function updateUserRole(uid: string, role: Role): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { role })
}

/**
 * Desabilita localmente (Firestore).
 * O ProtectedRoute bloqueia o acesso quando disabled=true.
 * Para revogar o login ativo do usuário, delete-o no Firebase Console → Authentication.
 */
export async function disableUser(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { disabled: true })
}

export async function enableUser(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { disabled: false })
}
