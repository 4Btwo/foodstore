import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { onAuthChange, getUserProfile } from '@/services/auth'
import type { AppUser } from '@/types'

interface AuthContextValue {
  user:          AppUser | null
  loading:       boolean
  restaurantId:  string | null
}

const AuthContext = createContext<AuthContextValue>({
  user:         null,
  loading:      true,
  restaurantId: null,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await getUserProfile(firebaseUser.uid)
        setUser(profile)
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        restaurantId: user?.restaurantId ?? null,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  return useContext(AuthContext)
}
