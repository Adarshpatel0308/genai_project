import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Sprout } from 'lucide-react'
import toast from 'react-hot-toast'
import { authAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'

const STATES = ['Maharashtra', 'Gujarat', 'Punjab', 'Madhya Pradesh', 'Uttar Pradesh',
  'Rajasthan', 'Karnataka', 'Andhra Pradesh', 'Tamil Nadu', 'Bihar', 'Other']

export default function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({ name: '', phone: '', password: '', email: '', state: '', language: 'hi' })
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await authAPI.register(form)
      setAuth(res.data.user, res.data.access_token)
      toast.success('Account created!')
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4 relative overflow-hidden">
      <div className="particles-bg">
        <div className="orb orb-purple w-[400px] h-[400px] top-0 right-0" />
        <div className="orb orb-amber w-72 h-72 bottom-0 left-0" style={{ animationDelay: '2s' }} />
      </div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }} className="relative z-10 w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
               style={{ background: 'linear-gradient(135deg, #6C3FC5, #F59E0B)' }}>
            <Sprout size={32} className="text-white" />
          </div>
          <h1 className="font-display font-bold text-3xl gradient-text">{t('app_name')}</h1>
        </div>

        <div className="glass-card p-8">
          <h2 className="font-display font-semibold text-xl text-white mb-6">{t('auth.register')}</h2>

          <form onSubmit={handleRegister} className="space-y-4">
            {[
              { key: 'name', label: t('auth.name'), type: 'text', placeholder: 'Ramesh Kumar' },
              { key: 'phone', label: t('auth.phone'), type: 'tel', placeholder: '9876543210' },
              { key: 'password', label: t('auth.password'), type: 'password', placeholder: '••••••••' },
              { key: 'email', label: t('auth.email'), type: 'email', placeholder: 'email@example.com' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-sm text-gray-400 mb-1.5">{label}</label>
                <input type={type} value={form[key as keyof typeof form]}
                  onChange={(e) => update(key, e.target.value)}
                  placeholder={placeholder} className="input-field"
                  required={key !== 'email'} />
              </div>
            ))}

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">{t('auth.state')}</label>
              <select value={form.state} onChange={(e) => update('state', e.target.value)}
                className="input-field">
                <option value="">Select State</option>
                {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">{t('auth.language')}</label>
              <div className="grid grid-cols-4 gap-2">
                {[['hi', 'हिंदी'], ['mr', 'मराठी'], ['gu', 'ગુજ.'], ['en', 'Eng']].map(([code, label]) => (
                  <button key={code} type="button" onClick={() => update('language', code)}
                    className={`py-2 rounded-xl text-sm font-medium transition-all border
                      ${form.language === code
                        ? 'bg-brand-500/20 border-brand-500/50 text-brand-300'
                        : 'border-surface-border text-gray-400 hover:border-brand-500/30'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
              {loading
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : t('auth.register_btn')}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            {t('auth.have_account')}{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
