import { db } from './firebase'
import {
  collection, doc, setDoc, getDocs,
  query, where, deleteDoc,
} from 'firebase/firestore'

// VAPID public key — gere em https://web-push-codelab.glitch.me/
// ou via: npx web-push generate-vapid-keys
// Coloque a chave pública no .env como VITE_VAPID_PUBLIC_KEY
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = window.atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

/**
 * Registra o Service Worker e inscreve o navegador no push.
 * Salva o token no Firestore em pushTokens/{uid}
 */
export async function subscribePush(uid: string, restaurantId: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push não suportado neste navegador')
    return false
  }
  if (!VAPID_PUBLIC_KEY) {
    console.warn('VITE_VAPID_PUBLIC_KEY não configurada')
    return false
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const existing = await reg.pushManager.getSubscription()
    if (existing) await existing.unsubscribe()

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    await setDoc(doc(db, 'pushTokens', uid), {
      uid,
      restaurantId,
      subscription: JSON.stringify(sub),
      createdAt:    new Date(),
    })

    return true
  } catch (err) {
    console.error('Erro ao registrar push:', err)
    return false
  }
}

export async function unsubscribePush(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'pushTokens', uid))
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  if (reg) {
    const sub = await reg.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()
  }
}

/**
 * Envia notificação local (sem servidor) para o próprio navegador.
 * Funciona sem plano Blaze — usa a Notifications API diretamente.
 */
export function sendLocalNotification(title: string, body: string, tag = 'foodstore') {
  if (Notification.permission !== 'granted') return
  navigator.serviceWorker.ready.then((reg) => {
    reg.showNotification(title, {
      body,
      tag,
      icon:  '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: '/kitchen' },
    })
  })
}
