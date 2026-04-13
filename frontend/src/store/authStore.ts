import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import i18n from '../i18n/i18n'

interface User {
  id: number
  name: string
  phone: string
  role: string
  language: string
  state?: string
}

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  setLanguage: (lang: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        i18n.changeLanguage(user.language)
        set({ user, token })
      },
      setLanguage: (lang) => {
        i18n.changeLanguage(lang)
        set((state) => ({ user: state.user ? { ...state.user, language: lang } : null }))
      },
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'pragati-auth' }
  )
)
