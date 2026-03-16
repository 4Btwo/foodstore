import { useEffect, useState } from 'react'
import { subscribePush, unsubscribePush, sendLocalNotification } from '@/services/push'
import { useAuth } from './useAuth'

export function usePushNotification() {
  const { user } = useAuth()
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission)
      setSubscribed(Notification.permission === 'granted')
    }
  }, [])

  async function requestPermission(): Promise<boolean> {
    if (!user) return false
    const ok = await subscribePush(user.uid, user.restaurantId)
    if (ok) {
      setPermission('granted')
      setSubscribed(true)
    }
    return ok
  }

  async function unsubscribe() {
    if (!user) return
    await unsubscribePush(user.uid)
    setSubscribed(false)
  }

  function notify(title: string, body: string) {
    sendLocalNotification(title, body)
  }

  return { permission, subscribed, requestPermission, unsubscribe, notify }
}
