import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'
import {
  LayoutDashboard, Microscope, MessageSquare, CloudSun, Leaf,
  TrendingUp, Calculator, Users, ShieldCheck, LogOut,
  Menu, X, Globe, ChevronDown
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { authAPI } from '../../services/api'
import toast from 'react-hot-toast'

const LANGUAGES = [
  { code: 'hi', label: 'हिंदी', full: 'Hindi' },
  { code: 'mr', label: 'मराठी', full: 'Marathi' },
  { code: 'gu', label: 'ગુજરાતી', full: 'Gujarati' },
  { code: 'en', label: 'English', full: 'English' },
]

export default function Layout() {
  const { t } = useTranslation()
  const { user, logout, setLanguage } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [langOpen, setLangOpen] = useState(false)
  const [headerLangOpen, setHeaderLangOpen] = useState(false)
  const headerLangRef = useRef<HTMLDivElement>(null)

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/disease', icon: Microscope, label: t('nav.disease_scanner') },
    { to: '/chatbot', icon: MessageSquare, label: t('nav.krishi_gpt') },
    { to: '/weather', icon: CloudSun, label: t('nav.weather') },
    { to: '/soil', icon: Leaf, label: t('nav.soil_crop') },
    { to: '/market', icon: TrendingUp, label: t('nav.market') },
    { to: '/farm', icon: Calculator, label: t('nav.farm_calc') },
    { to: '/forum', icon: Users, label: t('nav.forum') },
    ...(user?.role === 'admin' ? [{ to: '/admin', icon: ShieldCheck, label: t('nav.admin') }] : []),
  ]

  const handleLanguageChange = async (code: string) => {
    setLanguage(code)
    setLangOpen(false)
    setHeaderLangOpen(false)
    try { await authAPI.updateLanguage(code) } catch {}
    toast.success('Language changed')
  }

  const handleLogout = () => { logout(); navigate('/login') }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (headerLangRef.current && !headerLangRef.current.contains(e.target as Node))
        setHeaderLangOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const location = useLocation()
  const currentLang = LANGUAGES.find(l => l.code === user?.language) || LANGUAGES[0]

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#0a0f1e' }}>
      {/* Background orbs */}
      <div className="particles-bg">
        <div className="orb orb-purple w-96 h-96 top-10 left-10" />
        <div className="orb orb-amber w-64 h-64 bottom-20 right-20" style={{ animationDelay: '3s' }} />
        <div className="orb orb-blue w-48 h-48 top-1/2 right-1/3" style={{ animationDelay: '5s' }} />
      </div>

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative z-20 flex flex-col w-64 h-full border-r backdrop-blur-xl"
            style={{ backgroundColor: 'rgba(15,22,41,0.97)', borderColor: '#1e3a5f' }}
          >
            {/* Logo */}
            <div className="flex items-center gap-3 px-6 py-5" style={{ borderBottom: '1px solid #1e3a5f' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, #1d4ed8, #f59e0b)' }}>
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <div>
                <h1 className="font-display font-bold text-white text-lg leading-none">{t('app_name')}</h1>
                <p className="text-xs text-gray-500 mt-0.5">{t('tagline')}</p>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <Icon size={18} />
                  <span className="text-sm font-medium">{label}</span>
                </NavLink>
              ))}
            </nav>

            {/* User section */}
            <div className="px-3 py-4 space-y-2" style={{ borderTop: '1px solid #1e3a5f' }}>
              {/* Language switcher */}
              <div className="relative">
                <button onClick={() => setLangOpen(!langOpen)} className="nav-item w-full justify-between">
                  <div className="flex items-center gap-3">
                    <Globe size={18} />
                    <span className="text-sm font-medium">{t('common.language')}</span>
                  </div>
                  <ChevronDown size={14} className={`transition-transform ${langOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {langOpen && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="absolute bottom-full left-0 right-0 mb-1 glass-card p-2 space-y-1">
                      {LANGUAGES.map((l) => (
                        <button key={l.code} onClick={() => handleLanguageChange(l.code)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
                            ${user?.language === l.code ? 'bg-brand-500/20 text-brand-300' : 'text-gray-400 hover:text-white'}`}
                          style={user?.language !== l.code ? { ':hover': { background: '#162040' } } as any : {}}>
                          {l.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* User info */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#162040' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                     style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
                  {user?.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                </div>
                <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition-colors">
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-6 py-4 backdrop-blur-sm"
          style={{ borderBottom: '1px solid #1e3a5f', backgroundColor: 'rgba(15,22,41,0.6)' }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg text-gray-400 hover:text-white transition-colors">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex-1" />

          {/* Header language dropdown */}
          <div className="relative" ref={headerLangRef}>
            <button onClick={() => setHeaderLangOpen(!headerLangOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-300 hover:text-white transition-colors"
              style={{ backgroundColor: '#0f1629', border: '1px solid #1e3a5f' }}>
              <Globe size={15} className="text-brand-400" />
              <span>{currentLang.label}</span>
              <ChevronDown size={13} className={`transition-transform text-gray-500 ${headerLangOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {headerLangOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }} transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-44 glass-card p-2 space-y-1 z-50">
                  {LANGUAGES.map((l) => (
                    <button key={l.code} onClick={() => handleLanguageChange(l.code)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors
                        ${user?.language === l.code ? 'bg-brand-500/20 text-brand-300' : 'text-gray-400 hover:text-white'}`}>
                      <span>{l.label}</span>
                      <span className="text-xs text-gray-600">{l.full}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }} className="h-full">
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
