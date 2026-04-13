import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  Microscope, MessageSquare, CloudSun, Leaf,
  TrendingUp, Calculator, Mic, Users, ArrowRight,
  Sprout, Activity, Zap
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'

const MODULES = [
  { to: '/disease', icon: Microscope, title: 'disease_scanner', color: '#e879f9', bg: 'rgba(232,121,249,0.1)', border: 'rgba(232,121,249,0.2)' },
  { to: '/chatbot', icon: MessageSquare, title: 'krishi_gpt', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.2)' },
  { to: '/weather', icon: CloudSun, title: 'weather', color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)' },
  { to: '/soil', icon: Leaf, title: 'soil_crop', color: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.2)' },
  { to: '/market', icon: TrendingUp, title: 'market', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
  { to: '/farm', icon: Calculator, title: 'farm_calc', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)' },
  { to: '/voice', icon: Mic, title: 'voice', color: '#f472b6', bg: 'rgba(244,114,182,0.1)', border: 'rgba(244,114,182,0.2)' },
  { to: '/forum', icon: Users, title: 'forum', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.2)' },
]

const STATS = [
  { label: 'Active Farmers', value: '12,847', icon: Users, change: '+8.2%' },
  { label: 'Scans Today', value: '1,293', icon: Activity, change: '+12%' },
  { label: 'AI Queries', value: '8,421', icon: Zap, change: '+5.7%' },
  { label: 'Crops Monitored', value: '47', icon: Sprout, change: '+3' },
]

export default function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      {/* Hero greeting */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-8"
        style={{
          background: 'linear-gradient(135deg, rgba(108,63,197,0.3) 0%, rgba(245,158,11,0.15) 100%)',
          border: '1px solid rgba(108,63,197,0.3)'
        }}
      >
        <div className="absolute inset-0 bg-gradient-hero opacity-50" />
        <div className="relative z-10">
          <p className="text-brand-300 text-sm font-medium mb-1">{greeting()},</p>
          <h1 className="font-display font-bold text-3xl text-white mb-2">{user?.name} 👋</h1>
          <p className="text-gray-400 text-sm max-w-lg">
            Your AI-powered agriculture platform is ready. Explore crop disease detection, market prices, weather forecasts, and more.
          </p>
        </div>
        <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10">
          <Sprout size={120} className="text-brand-400" />
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat, i) => (
          <motion.div key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="stat-card"
          >
            <div className="flex items-center justify-between">
              <stat.icon size={20} className="text-brand-400" />
              <span className="text-xs font-medium text-emerald-400">{stat.change}</span>
            </div>
            <div>
              <p className="font-display font-bold text-2xl text-white">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Module grid */}
      <div>
        <h2 className="font-display font-semibold text-lg text-white mb-4">All Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MODULES.map((mod, i) => (
            <motion.div key={mod.to}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(mod.to)}
              className="module-card group"
              style={{ borderColor: mod.border }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                   style={{ background: mod.bg, border: `1px solid ${mod.border}` }}>
                <mod.icon size={22} style={{ color: mod.color }} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white text-sm">{t(`nav.${mod.title}`)}</h3>
              </div>
              <ArrowRight size={16} className="text-gray-600 group-hover:text-brand-400 transition-colors" />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
