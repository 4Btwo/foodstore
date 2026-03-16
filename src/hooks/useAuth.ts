import { useAuthContext } from '@/contexts/AuthContext'

/**
 * Hook principal de autenticação.
 *
 * Uso:
 *   const { user, loading, restaurantId, isAdmin, isCashier, isWaiter } = useAuth()
 */
export function useAuth() {
  const { user, loading, restaurantId } = useAuthContext()

  return {
    user,
    loading,
    restaurantId,
    isAdmin:   user?.role === 'admin',
    isCashier: user?.role === 'cashier',
    isWaiter:  user?.role === 'waiter',
    isKitchen: user?.role === 'kitchen',
  }
}
