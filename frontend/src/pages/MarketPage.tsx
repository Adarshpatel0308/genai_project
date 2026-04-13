import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Download, ArrowUp, ArrowDown, Minus, MapPin, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import toast from 'react-hot-toast'
import { marketAPI, downloadBlob } from '../services/api'
import { useAuthStore } from '../store/authStore'
import NearestMandiFinder from '../components/modules/NearestMandiFinder'

const COMMODITIES = ['wheat', 'rice', 'cotton', 'soybean', 'maize', 'onion', 'tomato', 'potato', 'groundnut', 'mustard', 'garlic', 'chilli']
const STATES = ['Maharashtra', 'Gujarat', 'Punjab', 'Madhya Pradesh', 'Uttar Pradesh', 'Rajasthan', 'Haryana', 'Karnataka', 'Andhra Pradesh', 'Tamil Nadu']

export default function MarketPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [commodity, setCommodity] = useState('wheat')
  const [state, setState] = useState('Madhya Pradesh')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [mandiFilter, setMandiFilter] = useState('')

  useEffect(() => { fetchPrices() }, [commodity, state])

  const fetchPrices = async () => {
    setLoading(true)
    try {
      const res = await marketAPI.prices(commodity, state)
      setData(res.data)
    } catch { toast.error('Failed to fetch prices') }
    finally { setLoading(false) }
  }

  const handleDownload = async () => {
    try {
      const res = await marketAPI.reportPdf(commodity, state, user?.language || 'en')
      downloadBlob(res.data, `market_${commodity}.pdf`)
    } catch { toast.error('PDF download failed') }
  }

  const chartData = [
    ...(data?.historical_prices?.filter((_: any, i: number) => i % 3 === 0).slice(-14).map((p: any) => ({
      date: p.date.slice(5), price: p.modal_price, type: 'actual'
    })) || []),
    ...(data?.price_predictions?.slice(0, 7).map((p: any) => ({
      date: p.date.slice(5), predicted: p.predicted_price, type: 'predicted'
    })) || [])
  ]

  const advice = data?.sell_advice
  const adviceConfig = {
    sell_now: { color: '#ef4444', icon: ArrowDown, label: t('market.sell_now') },
    hold: { color: '#10b981', icon: ArrowUp, label: t('market.hold') },
    neutral: { color: '#f59e0b', icon: Minus, label: 'Neutral' },
  }
  const ac = advice ? adviceConfig[advice.action as keyof typeof adviceConfig] : null

  // Filter today's mandi prices
  const todayPrices = (data?.today_prices || []).filter((p: any) =>
    !mandiFilter || p.mandi.toLowerCase().includes(mandiFilter.toLowerCase()) ||
    p.district?.toLowerCase().includes(mandiFilter.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white flex items-center gap-3">
            <TrendingUp className="text-brand-400" size={28} />
            {t('market.title')}
          </h1>
          <p className="text-gray-400 text-sm mt-1">{t('market.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchPrices} disabled={loading}
            className="btn-ghost flex items-center gap-2 text-sm px-3 py-2">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={handleDownload} className="btn-ghost flex items-center gap-2 text-sm">
            <Download size={16} /> {t('common.download_pdf')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {COMMODITIES.map((c) => (
            <button key={c} onClick={() => setCommodity(c)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize
                ${commodity === c ? 'text-white' : 'text-gray-400 hover:text-white'}`}
              style={commodity === c
                ? { background: '#1d4ed8' }
                : { background: '#162040', border: '1px solid #1e3a5f' }}>
              {c}
            </button>
          ))}
        </div>
        <select value={state} onChange={(e) => setState(e.target.value)}
          className="input-field w-auto text-sm py-2">
          {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <AnimatePresence>
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="glass-card p-6 h-32 shimmer rounded-2xl" />)}
          </div>
        ) : data && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Data source badge */}
            <div className="flex items-center gap-2">
              {data.data_source === 'live' ? (
                <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full text-green-400"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <Wifi size={11} /> Live data from data.gov.in — {data.total_mandis} mandis
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full text-amber-400"
                  style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                  <WifiOff size={11} /> Estimated prices — {data.total_mandis} mandis
                </span>
              )}
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="stat-card">
                <p className="text-xs text-gray-500">{t('market.current_price')} (Avg)</p>
                <p className="font-display font-bold text-3xl text-white">₹{data.current_price}</p>
                <p className="text-xs text-gray-500">{t('common.per_quintal')}</p>
              </div>
              {ac && (
                <div className="stat-card" style={{ borderColor: `${ac.color}30` }}>
                  <p className="text-xs text-gray-500">{t('market.sell_advice')}</p>
                  <div className="flex items-center gap-2">
                    <ac.icon size={20} style={{ color: ac.color }} />
                    <p className="font-display font-bold text-xl text-white">{ac.label}</p>
                  </div>
                  <p className="text-xs text-gray-400">{advice.reason}</p>
                </div>
              )}
              <div className="stat-card">
                <p className="text-xs text-gray-500">{t('market.best_mandi')}</p>
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-amber-400 flex-shrink-0" />
                  <p className="font-semibold text-white text-sm truncate">{data.best_mandi}</p>
                </div>
                <p className="text-xs text-gray-500">{state}</p>
              </div>
            </div>

            {/* Today's mandi prices — ALL mandis */}
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-white">
                  Today's Mandi Prices — {state}
                  <span className="ml-2 text-xs text-gray-500 font-normal">({data.today_prices?.length || 0} mandis)</span>
                </h2>
                <input value={mandiFilter} onChange={e => setMandiFilter(e.target.value)}
                  placeholder="Search mandi or district..."
                  className="input-field text-sm py-1.5 w-48" />
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {todayPrices.length > 0 ? todayPrices.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl"
                    style={{ background: '#162040' }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin size={12} className="text-brand-400 flex-shrink-0" />
                      <span className="text-sm text-white font-medium truncate">{p.mandi}</span>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Min</p>
                        <p className="text-sm text-gray-300">₹{p.min_price}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Modal</p>
                        <p className="text-sm font-bold text-white">₹{p.modal_price}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Max</p>
                        <p className="text-sm text-green-400">₹{p.max_price}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <p className="text-gray-500 text-sm text-center py-4">No mandi data found for this filter</p>
                )}
              </div>
            </div>

            {/* Price chart */}
            <div className="glass-card p-6">
              <h2 className="font-semibold text-white mb-4">Price Trend & Prediction</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" stroke="#374151" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis stroke="#374151" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: 12 }}
                    formatter={(v: any) => [`₹${v}`, '']} />
                  <ReferenceLine x={data.historical_prices?.slice(-1)[0]?.date?.slice(5)}
                    stroke="#1d4ed8" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="price" stroke="#1d4ed8" strokeWidth={2.5}
                    dot={{ fill: '#1d4ed8', r: 3 }} name="Actual Price" connectNulls />
                  <Line type="monotone" dataKey="predicted" stroke="#f59e0b" strokeWidth={2}
                    strokeDasharray="5 5" dot={{ fill: '#f59e0b', r: 3 }} name="Predicted" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Nearest Mandi Finder */}
            <NearestMandiFinder />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
