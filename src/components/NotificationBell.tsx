import { usePushNotification } from '@/hooks/usePushNotification'

export function NotificationBell() {
  const { subscribed, permission, requestPermission, unsubscribe } = usePushNotification()

  if (permission === 'denied') {
    return (
      <span className="text-xs text-gray-400" title="Notificações bloqueadas no navegador">
        🔕 Bloqueado
      </span>
    )
  }

  if (subscribed) {
    return (
      <button
        onClick={unsubscribe}
        title="Desativar notificações"
        className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition"
      >
        🔔 Notificações ativas
      </button>
    )
  }

  return (
    <button
      onClick={requestPermission}
      title="Ativar notificações de novos pedidos"
      className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
    >
      🔕 Ativar notificações
    </button>
  )
}
