// sw.js — Service Worker do FoodStore
// Arquivo deve ficar em /public/sw.js

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

// Recebe push do servidor (quando Cloud Functions estiver ativo)
self.addEventListener('push', (event) => {
  let data = { title: 'FoodStore', body: 'Novo pedido na cozinha!', url: '/kitchen' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    '/icon-192.png',
      badge:   '/icon-192.png',
      tag:     'foodstore-order',
      vibrate: [200, 100, 200],
      data:    { url: data.url },
      actions: [
        { action: 'open',    title: 'Ver pedido' },
        { action: 'dismiss', title: 'Fechar'     },
      ],
    }),
  )
})

// Clique na notificação → abre ou foca a aba
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const url = event.notification.data?.url ?? '/kitchen'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url))
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    }),
  )
})
