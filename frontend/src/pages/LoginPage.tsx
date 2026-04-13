import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Sprout } from 'lucide-react'
import toast from 'react-hot-toast'
import { authAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await authAPI.login(phone, password)
      setAuth(res.data.user, res.data.access_token)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="particles-bg">
        <div className="orb orb-purple w-[500px] h-[500px] -top-20 -left-20" />
        <div className="orb orb-amber w-80 h-80 bottom-0 right-0" style={{ animationDelay: '3s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #6C3FC5, #F59E0B)' }}
          >
            <Sprout size={32} className="text-white" />
          </motion.div>
          <h1 className="font-display font-bold text-3xl gradient-text">{t('app_name')}</h1>
          <p className="text-gray-400 mt-1 text-sm">{t('tagline')}</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <h2 className="font-display font-semibold text-xl text-white mb-6">{t('auth.login')}</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">{t('auth.phone')}</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">{t('auth.password')}</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pr-12"
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : t('auth.login_btn')}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            {t('auth.no_account')}{' '}
            <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              {t('auth.register')}
            </Link>
          </p>
        </div>

        {/* Demo credentials */}
        <div className="mt-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-center">
          <p className="text-xs text-amber-400/80">Demo: <span className="font-mono">9999999999</span> / <span className="font-mono">Admin@123</span></p>
        </div>
      </motion.div>
    </div>
  )
}
