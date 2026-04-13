import { useState, useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Leaf, Upload, Download, ChevronRight, FlaskConical, Sprout, Languages } from 'lucide-react'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import { Country, State, City } from 'country-state-city'
import { soilAPI, translateAPI, downloadBlob } from '../services/api'
import { useAuthStore } from '../store/authStore'

const SOIL_TYPES = ['Alluvial', 'Black (Regur)', 'Red', 'Laterite', 'Desert', 'Mountain', 'Saline', 'Sandy Loam', 'Clay Loam', 'Loamy']

const defaultForm = {
  soil_type: '', ph: '', nitrogen: '', phosphorus: '', potassium: '',
  organic_carbon: '', zinc: '', iron: '', location_state: '', location_district: ''
}

// ── Build India state list once ─────────────────────────────────────────────
const INDIA_STATES = State.getStatesOfCountry('IN').map((s) => s.name)

// ── Reusable autocomplete input ──────────────────────────────────────────────
function AutocompleteInput({
  value, onChange, suggestions, placeholder, required, disabled
}: {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  placeholder?: string
  required?: boolean
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Filter by keyword
  const filtered = value.trim().length > 0
    ? suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : []

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        className={`input-field text-sm py-2 w-full ${
          required && !value ? 'border-red-500/40' : ''
        } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-xl"
          style={{ background: '#1a1030', border: '1px solid #2d1f4a' }}>
          {filtered.map((s) => (
            <li key={s}
              onMouseDown={() => { onChange(s); setOpen(false) }}
              className="px-3 py-2 text-sm text-gray-300 hover:bg-brand-500/20 hover:text-white cursor-pointer transition-colors">
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type PageTab = 'health' | 'advisory'
type InputTab = 'manual' | 'ocr'

function SoilInputPanel({
  form, setForm, onSubmit, loading, ocrLoading, submitLabel, submitIcon
}: {
  form: typeof defaultForm
  setForm: React.Dispatch<React.SetStateAction<typeof defaultForm>>
  onSubmit: () => void
  loading: boolean
  ocrLoading: boolean
  submitLabel: string
  submitIcon: React.ReactNode
}) {
  const { t } = useTranslation()
  const [inputTab, setInputTab] = useState<InputTab>('manual')

  const [ocrProcessing, setOcrProcessing] = useState(false)

  const onDrop = useCallback(async (files: File[]) => {
    const f = files[0]
    if (!f) return
    setOcrProcessing(true)
    const fd = new FormData()
    fd.append('file', f)
    try {
      const res = await soilAPI.ocr(fd)
      const ext = res.data.extracted
      setForm((prev) => ({
        ...prev,
        ph: ext.ph?.toString() || prev.ph,
        nitrogen: ext.nitrogen?.toString() || prev.nitrogen,
        phosphorus: ext.phosphorus?.toString() || prev.phosphorus,
        potassium: ext.potassium?.toString() || prev.potassium,
        organic_carbon: ext.organic_carbon?.toString() || prev.organic_carbon,
        zinc: ext.zinc?.toString() || prev.zinc,
        iron: ext.iron?.toString() || prev.iron,
        // Only override soil_type if OCR actually found one
        soil_type: ext.soil_type && ext.soil_type !== prev.soil_type ? ext.soil_type : prev.soil_type,
      }))
      setInputTab('manual')
      toast.success('Soil card data extracted! Please verify the values.')
    } catch {
      toast.error('OCR extraction failed')
    } finally {
      setOcrProcessing(false)
    }
  }, [setForm])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [], 'application/pdf': [] }, maxFiles: 1
  })

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  // Get districts for selected state
  const stateObj = State.getStatesOfCountry('IN').find(
    (s) => s.name.toLowerCase() === form.location_state.toLowerCase()
  )
  const districtList = stateObj
    ? City.getCitiesOfState('IN', stateObj.isoCode).map((c) => c.name)
    : []

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex gap-2 p-1 bg-surface-elevated rounded-xl">
        {(['manual', 'ocr'] as const).map((t_) => (
          <button key={t_} onClick={() => setInputTab(t_)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
              ${inputTab === t_ ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t_ === 'manual' ? t('soil.manual_entry') : t('soil.upload_soil_card')}
          </button>
        ))}
      </div>

      {inputTab === 'ocr' ? (
        <div {...getRootProps()}
          className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all
            ${isDragActive ? 'border-brand-400 bg-brand-500/10' : 'border-surface-border hover:border-brand-500/50'}`}>
          <input {...getInputProps()} />
          {ocrProcessing ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
              <p className="text-brand-300 text-sm font-medium">Reading soil card with AI...</p>
              <p className="text-gray-500 text-xs">This may take 10-20 seconds</p>
            </div>
          ) : (
            <>
              <Upload size={32} className="text-brand-400 mx-auto mb-3" />
              <p className="text-white font-medium text-sm">Upload Soil Health Card</p>
              <p className="text-gray-500 text-xs mt-1">JPG, PNG, PDF supported</p>
              <p className="text-gray-600 text-xs mt-2">AI will extract all values automatically</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'ph', label: t('soil.ph'), placeholder: '6.5' },
            { key: 'nitrogen', label: t('soil.nitrogen'), placeholder: '80' },
            { key: 'phosphorus', label: t('soil.phosphorus'), placeholder: '40' },
            { key: 'potassium', label: t('soil.potassium'), placeholder: '40' },
            { key: 'organic_carbon', label: t('soil.organic_carbon'), placeholder: '0.8' },
            { key: 'zinc', label: 'Zinc (ppm)', placeholder: '0.6' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs text-gray-400 mb-1">{label}</label>
              <input type="number" step="0.01" value={form[key as keyof typeof form]}
                onChange={(e) => update(key, e.target.value)}
                placeholder={placeholder} className="input-field text-sm py-2" />
            </div>
          ))}

          <div className="col-span-2">
            <label className="block text-xs text-gray-400 mb-1">
              {t('soil.soil_type')} <span className="text-red-400">*</span>
            </label>
            <select value={form.soil_type} onChange={(e) => update('soil_type', e.target.value)}
              className={`input-field text-sm py-2 ${!form.soil_type ? 'border-red-500/40' : ''}`}>
              <option value="">Select soil type (required)</option>
              {SOIL_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">State <span className="text-red-400">*</span></label>
            <AutocompleteInput
              value={form.location_state}
              onChange={(v) => { update('location_state', v); update('location_district', '') }}
              suggestions={INDIA_STATES}
              placeholder="Type state name..."
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">District <span className="text-red-400">*</span></label>
            <AutocompleteInput
              value={form.location_district}
              onChange={(v) => update('location_district', v)}
              suggestions={districtList}
              placeholder={stateObj ? 'Type district name...' : 'Select state first'}
              required
              disabled={!stateObj}
            />
          </div>
        </div>
      )}

      <button onClick={onSubmit} disabled={loading}
        className="btn-primary w-full flex items-center justify-center gap-2">
        {loading
          ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : submitIcon}
        {submitLabel}
      </button>
    </div>
  )
}

// ── AI response with translate toggle ──────────────────────────────────────
function AIResponseBlock({ text }: { text: string }) {
  const [translated, setTranslated] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const [targetLang, setTargetLang] = useState<'en' | 'hi'>('hi')

  const handleTranslate = async () => {
    const to = targetLang === 'hi' ? 'en' : 'hi'
    setTranslating(true)
    try {
      const res = await translateAPI.translate(text, to)
      setTranslated(res.data.translated || res.data.translated_text)
      setTargetLang(to)
    } catch {
      toast.error('Translation failed')
    } finally {
      setTranslating(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white text-sm">AI Analysis</h3>
        <button onClick={handleTranslate} disabled={translating}
          className="flex items-center gap-1.5 text-xs text-brand-300 hover:text-brand-200 transition-colors disabled:opacity-50">
          {translating
            ? <div className="w-3 h-3 border border-brand-400/30 border-t-brand-400 rounded-full animate-spin" />
            : <Languages size={13} />}
          {targetLang === 'hi' ? 'Translate to English' : 'हिंदी में अनुवाद करें'}
        </button>
      </div>
      <div className="rounded-xl bg-surface-elevated p-4 text-sm text-gray-300 prose prose-invert prose-sm max-w-none">
        <ReactMarkdown>{translated || text}</ReactMarkdown>
      </div>
    </div>
  )
}

export default function SoilCropPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [pageTab, setPageTab] = useState<PageTab>('health')

  // Shared form state
  const [healthForm, setHealthForm] = useState(defaultForm)
  const [advisoryForm, setAdvisoryForm] = useState(defaultForm)

  const [healthResult, setHealthResult] = useState<any>(null)
  const [advisoryResult, setAdvisoryResult] = useState<any>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [advisoryLoading, setAdvisoryLoading] = useState(false)

  const handleSoilHealth = async () => {
    if (!healthForm.soil_type || !healthForm.location_state || !healthForm.location_district) {
      toast.error('Please fill Soil Type, State and District — they are required')
      return
    }
    setHealthLoading(true)
    try {
      const payload = {
        ...Object.fromEntries(Object.entries(healthForm).map(([k, v]) => [k, v === '' ? null : isNaN(Number(v)) ? v : Number(v)])),
        language: user?.language || 'hi',
        mode: 'health'
      }
      const res = await soilAPI.analyze(payload)
      setHealthResult(res.data)
      toast.success('Soil health analysis ready!')
    } catch {
      toast.error('Analysis failed')
    } finally {
      setHealthLoading(false)
    }
  }

  const handleCropAdvisory = async () => {
    if (!advisoryForm.soil_type || !advisoryForm.location_state || !advisoryForm.location_district) {
      toast.error('Please fill Soil Type, State and District — they are required')
      return
    }
    setAdvisoryLoading(true)
    try {
      const payload = {
        ...Object.fromEntries(Object.entries(advisoryForm).map(([k, v]) => [k, v === '' ? null : isNaN(Number(v)) ? v : Number(v)])),
        language: user?.language || 'hi',
        mode: 'advisory'
      }
      const res = await soilAPI.analyze(payload)
      setAdvisoryResult(res.data)
      toast.success('Crop recommendations ready!')
    } catch {
      toast.error('Analysis failed')
    } finally {
      setAdvisoryLoading(false)
    }
  }

  const handleDownload = async (recId: number) => {
    try {
      const res = await soilAPI.reportPdf(recId, user?.language || 'en')
      downloadBlob(res.data, `soil_report.pdf`)
    } catch { toast.error('PDF download failed') }
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display font-bold text-2xl text-white flex items-center gap-3">
          <Leaf className="text-brand-400" size={28} />
          {t('soil.title')}
        </h1>
        <p className="text-gray-400 text-sm mt-1">{t('soil.subtitle')}</p>
      </div>

      {/* Page tabs */}
      <div className="flex gap-3">
        <button onClick={() => setPageTab('health')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all
            ${pageTab === 'health' ? 'bg-brand-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          style={pageTab !== 'health' ? { backgroundColor: '#231540', border: '1px solid #2d1f4a' } : {}}>
          <FlaskConical size={16} /> Soil Health Analysis
        </button>
        <button onClick={() => setPageTab('advisory')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all
            ${pageTab === 'advisory' ? 'bg-brand-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          style={pageTab !== 'advisory' ? { backgroundColor: '#231540', border: '1px solid #2d1f4a' } : {}}>
          <Sprout size={16} /> Crop Advisory
        </button>
      </div>

      <AnimatePresence mode="wait">
        {/* ── SOIL HEALTH TAB ── */}
        {pageTab === 'health' && (
          <motion.div key="health" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SoilInputPanel
              form={healthForm} setForm={setHealthForm}
              onSubmit={handleSoilHealth} loading={healthLoading} ocrLoading={false}
              submitLabel="Analyze Soil Health"
              submitIcon={<FlaskConical size={18} />}
            />

            <AnimatePresence>
              {healthResult ? (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  className="glass-card p-6 space-y-5 overflow-y-auto" style={{ maxHeight: 620 }}>

                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <FlaskConical size={16} className="text-brand-400" /> Soil Health Report
                  </h3>

                  {/* Soil parameters summary */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'pH', value: healthForm.ph, ideal: '6.0–7.5' },
                      { label: 'Nitrogen', value: healthForm.nitrogen, ideal: '80–120 kg/ha' },
                      { label: 'Phosphorus', value: healthForm.phosphorus, ideal: '40–60 kg/ha' },
                      { label: 'Potassium', value: healthForm.potassium, ideal: '40–60 kg/ha' },
                      { label: 'Organic Carbon', value: healthForm.organic_carbon, ideal: '> 0.75%' },
                      { label: 'Zinc', value: healthForm.zinc, ideal: '> 0.6 ppm' },
                    ].map(({ label, value, ideal }) => (
                      <div key={label} className="px-3 py-2 rounded-xl bg-surface-elevated">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="text-white font-semibold text-sm">{value || '—'}</p>
                        <p className="text-xs text-gray-600">Ideal: {ideal}</p>
                      </div>
                    ))}
                  </div>

                  {/* AI soil health explanation */}
                  <AIResponseBlock text={healthResult.ai_explanation || ''} />

                  {healthResult.recommendation_id && (
                    <button onClick={() => handleDownload(healthResult.recommendation_id)}
                      className="btn-amber w-full flex items-center justify-center gap-2">
                      <Download size={16} /> Download Soil Report
                    </button>
                  )}
                </motion.div>
              ) : (
                <div className="glass-card p-6 flex flex-col items-center justify-center gap-3 text-center">
                  <FlaskConical size={40} className="text-gray-600" />
                  <p className="text-gray-500 text-sm">Enter soil data to get health analysis</p>
                  <p className="text-gray-600 text-xs">Upload your Soil Health Card or fill manually</p>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── CROP ADVISORY TAB ── */}
        {pageTab === 'advisory' && (
          <motion.div key="advisory" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SoilInputPanel
              form={advisoryForm} setForm={setAdvisoryForm}
              onSubmit={handleCropAdvisory} loading={advisoryLoading} ocrLoading={false}
              submitLabel="Get Crop Recommendations"
              submitIcon={<Sprout size={18} />}
            />

            <AnimatePresence>
              {advisoryResult ? (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  className="glass-card p-6 space-y-5 overflow-y-auto" style={{ maxHeight: 620 }}>

                  {/* Recommended crops */}
                  <div>
                    <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                      <Leaf size={16} className="text-brand-400" />
                      {t('soil.recommended_crops')}
                    </h3>
                    <div className="space-y-2">
                      {advisoryResult.recommended_crops?.slice(0, 5).map((c: any, i: number) => (
                        <div key={c.crop} className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-elevated">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-300 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                            <span className="text-white font-medium capitalize">{c.crop}</span>
                            <span className="text-xs text-gray-500 capitalize">{c.season}</span>
                          </div>
                          <div className="progress-bar w-20">
                            <div className="progress-fill" style={{ width: `${c.score}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI explanation with translate */}
                  <AIResponseBlock text={advisoryResult.ai_explanation || ''} />

                  {/* Rotation plan */}
                  {advisoryResult.rotation_plan?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-white mb-3">{t('soil.rotation_plan')}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        {advisoryResult.rotation_plan.map((crop: string, i: number) => (
                          <div key={crop} className="flex items-center gap-2">
                            <span className="px-3 py-1.5 rounded-lg bg-brand-500/20 text-brand-300 text-sm capitalize">{crop}</span>
                            {i < advisoryResult.rotation_plan.length - 1 && <ChevronRight size={14} className="text-gray-600" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {advisoryResult.recommendation_id && (
                    <button onClick={() => handleDownload(advisoryResult.recommendation_id)}
                      className="btn-amber w-full flex items-center justify-center gap-2">
                      <Download size={16} /> {t('common.download_pdf')}
                    </button>
                  )}
                </motion.div>
              ) : (
                <div className="glass-card p-6 flex flex-col items-center justify-center gap-3 text-center">
                  <Sprout size={40} className="text-gray-600" />
                  <p className="text-gray-500 text-sm">Enter soil data to get crop recommendations</p>
                  <p className="text-gray-600 text-xs">Upload your Soil Health Card or fill manually</p>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
