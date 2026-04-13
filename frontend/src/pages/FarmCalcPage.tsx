import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Calculator, Download, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import { farmAPI, downloadBlob } from '../services/api'
import { useAuthStore } from '../store/authStore'

const RISK_CONFIG = {
  low:    { color: '#10b981', label: 'Low Risk', icon: CheckCircle },
  medium: { color: '#f59e0b', label: 'Medium Risk', icon: AlertTriangle },
  high:   { color: '#ef4444', label: 'High Risk', icon: AlertTriangle },
}

export default function FarmCalcPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [form, setForm] = useState({
    crop_name: '', area_acres: '', seed_cost: '', fertilizer_cost: '',
    pesticide_cost: '', labour_cost: '', machinery_cost: '', irrigation_cost: '',
    other_cost: '', expected_yield_kg: '', selling_price_per_kg: ''
  })
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleCalculate = async () => {
    if (!form.crop_name || !form.area_acres) { toast.error('Crop name and area are required'); return }
    setLoading(true)
    try {
      const payload = {
        ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? 0 : isNaN(Number(v)) ? v : Number(v)])),
        language: user?.language || 'hi'
      }
      const res = await farmAPI.calculate(payload)
      setResult(res.data)
      toast.success('Calculation complete!')
    } catch { toast.error('Calculation failed') }
    finally { setLoading(false) }
  }

  const handleDownload = async () => {
    if (!result?.expense_id) return
    try {
      const res = await farmAPI.reportPdf(result.expense_id, user?.language || 'en')
      downloadBlob(res.data, `farm_report.pdf`)
    } catch { toast.error('PDF download failed') }
  }

  const pieData = result ? [
    { name: 'Seeds', value: Number(form.seed_cost) || 0, color: '#6C3FC5' },
    { name: 'Fertilizer', value: Number(form.fertilizer_cost) || 0, color: '#8b5cf6' },
    { name: 'Labour', value: Number(form.labour_cost) || 0, color: '#F59E0B' },
    { name: 'Pesticide', value: Number(form.pesticide_cost) || 0, color: '#f472b6' },
    { name: 'Machinery', value: Number(form.machinery_cost) || 0, color: '#60a5fa' },
    { name: 'Irrigation', value: Number(form.irrigation_cost) || 0, color: '#34d399' },
  ].filter(d => d.value > 0) : []

  const riskConf = result ? RISK_CONFIG[result.risk_level as keyof typeof RISK_CONFIG] : null

  const fields = [
    { key: 'seed_cost', label: t('farm_calc.seed_cost') },
    { key: 'fertilizer_cost', label: t('farm_calc.fertilizer_cost') },
    { key: 'pesticide_cost', label: t('farm_calc.pesticide_cost') },
    { key: 'labour_cost', label: t('farm_calc.labour_cost') },
    { key: 'machinery_cost', label: t('farm_calc.machinery_cost') },
    { key: 'irrigation_cost', label: t('farm_calc.irrigation_cost') },
  ]

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display font-bold text-2xl text-white flex items-center gap-3">
          <Calculator className="text-brand-400" size={28} />
          {t('farm_calc.title')}
        </h1>
        <p className="text-gray-400 text-sm mt-1">{t('farm_calc.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input form */}
        <div className="glass-card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">{t('farm_calc.crop_name')}</label>
              <input value={form.crop_name} onChange={(e) => update('crop_name', e.target.value)}
                placeholder="Wheat" className="input-field text-sm py-2" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('farm_calc.area')}</label>
              <input type="number" value={form.area_acres} onChange={(e) => update('area_acres', e.target.value)}
                placeholder="5" className="input-field text-sm py-2" />
            </div>
            {fields.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs text-gray-400 mb-1">{label}</label>
                <input type="number" value={form[key as keyof typeof form]}
                  onChange={(e) => update(key, e.target.value)}
                  placeholder="0" className="input-field text-sm py-2" />
              </div>
            ))}
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('farm_calc.expected_yield')}</label>
              <input type="number" value={form.expected_yield_kg} onChange={(e) => update('expected_yield_kg', e.target.value)}
                placeholder="2000" className="input-field text-sm py-2" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('farm_calc.selling_price')}</label>
              <input type="number" value={form.selling_price_per_kg} onChange={(e) => update('selling_price_per_kg', e.target.value)}
                placeholder="25" className="input-field text-sm py-2" />
            </div>
          </div>

          <button onClick={handleCalculate} disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Calculator size={18} />}
            {t('farm_calc.calculate')}
          </button>
        </div>

        {/* Results */}
        <AnimatePresence>
          {result ? (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="glass-card p-6 space-y-5 overflow-y-auto" style={{ maxHeight: 600 }}>

              {/* Key metrics */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: t('farm_calc.total_cost'), value: `₹${result.total_cost?.toLocaleString()}`, color: '#ef4444' },
                  { label: t('farm_calc.revenue'), value: `₹${result.gross_revenue?.toLocaleString()}`, color: '#10b981' },
                  { label: t('farm_calc.profit'), value: `₹${result.net_profit?.toLocaleString()}`, color: result.net_profit >= 0 ? '#10b981' : '#ef4444' },
                  { label: t('farm_calc.roi'), value: `${result.roi_percent}%`, color: '#F59E0B' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl bg-surface-elevated p-4">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className="font-display font-bold text-xl" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Risk */}
              {riskConf && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                     style={{ background: `${riskConf.color}15`, border: `1px solid ${riskConf.color}30` }}>
                  <riskConf.icon size={18} style={{ color: riskConf.color }} />
                  <span className="font-medium text-sm" style={{ color: riskConf.color }}>{riskConf.label}</span>
                </div>
              )}

              {/* Cost breakdown pie */}
              {pieData.length > 0 && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Cost Breakdown</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value">
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#1a1030', border: '1px solid #2d1f4a', borderRadius: 12 }}
                        formatter={(v: any) => [`₹${v}`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* AI Tips */}
              <div>
                <p className="text-sm font-medium text-brand-300 mb-2 flex items-center gap-2">
                  <TrendingUp size={14} /> {t('farm_calc.ai_tips')}
                </p>
                <div className="rounded-xl bg-surface-elevated p-4 text-sm text-gray-300 prose prose-invert prose-sm max-w-none max-h-40 overflow-y-auto">
                  <ReactMarkdown>{result.ai_optimization_tips}</ReactMarkdown>
                </div>
              </div>

              <button onClick={handleDownload} className="btn-amber w-full flex items-center justify-center gap-2">
                <Download size={16} /> {t('common.download_pdf')}
              </button>
            </motion.div>
          ) : (
            <div className="glass-card p-6 flex flex-col items-center justify-center gap-3 text-center">
              <Calculator size={40} className="text-gray-600" />
              <p className="text-gray-500 text-sm">Enter farm expenses to calculate profitability</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
