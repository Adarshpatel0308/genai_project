import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, Microscope, AlertTriangle, Download, RotateCcw, CheckCircle,
  Leaf, Languages, Clock, TrendingDown, Shield, Phone, ChevronDown, ChevronUp, FlaskConical
} from 'lucide-react'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import { diseaseAPI, downloadBlob, translateAPI, adminAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'

const SEVERITY_CONFIG: Record<string, { class: string; label: string; color: string; bg: string }> = {
  none:     { class: 'badge-none',     label: '✅ Healthy',  color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  low:      { class: 'badge-low',      label: '🟡 Low',      color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  medium:   { class: 'badge-medium',   label: '🟠 Medium',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  high:     { class: 'badge-high',     label: '🔴 High',     color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  critical: { class: 'badge-critical', label: '🚨 Critical', color: '#dc2626', bg: 'rgba(220,38,38,0.15)' },
}

const CROP_LIST = [
  'Wheat', 'Rice', 'Maize (Corn)', 'Cotton', 'Tomato', 'Potato', 'Sugarcane',
  'Soybean', 'Groundnut', 'Onion', 'Chilli', 'Mango', 'Grape', 'Apple',
  'Banana', 'Mustard', 'Chickpea', 'Lentil', 'Sunflower', 'Barley'
]

export default function DiseaseScannerPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [cropName, setCropName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [translating, setTranslating] = useState(false)
  const [translatedText, setTranslatedText] = useState<string | null>(null)
  // AI always responds in English first, so current lang is 'en', next target is 'hi'
  const [transLang, setTransLang] = useState<'en' | 'hi'>('en')
  const [showExpert, setShowExpert] = useState(false)
  const [experts, setExperts] = useState<any[]>([])
  const [treatmentTab, setTreatmentTab] = useState<'chemical' | 'organic'>('chemical')
  const [expandedSection, setExpandedSection] = useState<string | null>('treatment')

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]
    if (!f) return
    setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setTranslatedText(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, maxFiles: 1
  })

  const handleScan = async () => {
    if (!file) return
    setLoading(true); setTranslatedText(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('language', user?.language || 'hi')
      if (cropName) fd.append('crop_hint', cropName)
      const res = await diseaseAPI.scan(fd)
      setResult(res.data)
      setTransLang('en')  // reset: AI response is in English
      toast.success('Analysis complete!')
    } catch { toast.error('Scan failed. Please try again.') }
    finally { setLoading(false) }
  }

  const handleDownload = async () => {
    if (!result?.scan_id) return
    try {
      const res = await diseaseAPI.reportPdf(result.scan_id, user?.language || 'en')
      downloadBlob(res.data, `disease_report_${result.scan_id}.pdf`)
    } catch { toast.error('PDF download failed') }
  }

  const handleTranslate = async () => {
    if (!result?.explanation) return
    // transLang = current language of displayed text; toggle to the other
    const targetLang = transLang === 'en' ? 'hi' : 'en'
    setTranslating(true)
    try {
      const sourceText = translatedText || result.explanation
      const res = await translateAPI.translate(sourceText, targetLang)
      setTranslatedText(res.data.translated || res.data.translated_text)
      setTransLang(targetLang)
    } catch { toast.error('Translation failed') }
    finally { setTranslating(false) }
  }

  const handleExpertConnect = async () => {
    setShowExpert(true)
    try {
      const res = await adminAPI.publicExperts()
      setExperts(res.data)
    } catch { setExperts([]) }
  }

  const reset = () => { setFile(null); setPreview(null); setResult(null); setTranslatedText(null); setCropName(''); setShowExpert(false) }

  const sev = result ? SEVERITY_CONFIG[result.severity] || SEVERITY_CONFIG.medium : null
  const fullText = translatedText || result?.explanation || ''

  // Split explanation into chemical and organic sections
  const parseSection = (text: string, type: 'chemical' | 'organic'): string => {
    if (!text) return ''
    const chemMarkers = ['🧪 Chemical Treatment', '🧪 Chemical', 'Chemical Treatment', 'रासायनिक उपचार', '🧪 रासायनिक']
    const orgMarkers  = ['🌿 Organic Treatment', '🌿 Organic', 'Organic Treatment', 'जैविक उपचार', '🌿 जैविक']
    const prevMarkers = ['Prevention', 'Preventive', 'बचाव', 'निवारण']

    const findIdx = (markers: string[]) => {
      for (const m of markers) {
        const i = text.indexOf(m)
        if (i !== -1) return i
      }
      return -1
    }

    const chemIdx = findIdx(chemMarkers)
    const orgIdx  = findIdx(orgMarkers)
    const prevIdx = findIdx(prevMarkers)

    if (type === 'chemical') {
      if (chemIdx === -1) return text  // no split possible, show all
      const end = orgIdx > chemIdx ? orgIdx : (prevIdx > chemIdx ? prevIdx : text.length)
      return text.slice(chemIdx, end).trim()
    } else {
      if (orgIdx === -1) return text
      const end = prevIdx > orgIdx ? prevIdx : text.length
      return text.slice(orgIdx, end).trim()
    }
  }

  const displayText = parseSection(fullText, treatmentTab)

  const toggle = (s: string) => setExpandedSection(expandedSection === s ? null : s)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display font-bold text-2xl text-white flex items-center gap-3">
          <Microscope className="text-brand-400" size={28} />
          {t('disease.title')}
        </h1>
        <p className="text-gray-400 text-sm mt-1">{t('disease.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Panel */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Upload size={16} className="text-brand-400" /> Upload Crop Image
          </h3>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Select Crop (improves accuracy)</label>
            <select value={cropName} onChange={(e) => setCropName(e.target.value)} className="input-field text-sm py-2">
              <option value="">-- Auto-detect from image --</option>
              {CROP_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div {...getRootProps()}
            className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden
              ${isDragActive ? 'border-brand-400 bg-brand-500/10' : 'border-surface-border hover:border-brand-500/50'}`}
            style={{ minHeight: 200 }}>
            <input {...getInputProps()} />
            {preview ? (
              <img src={preview} alt="crop" className="w-full object-cover" style={{ minHeight: 200 }} />
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center" style={{ minHeight: 200 }}>
                <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity }}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: 'rgba(29,78,216,0.15)', border: '1px solid rgba(29,78,216,0.3)' }}>
                  <Upload size={24} className="text-brand-400" />
                </motion.div>
                <p className="text-white font-medium text-sm">{t('disease.upload_prompt')}</p>
                <p className="text-gray-500 text-xs mt-1">JPG, PNG, WEBP supported</p>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={handleScan} disabled={!file || loading}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('disease.analyzing')}</>
                : <><Microscope size={18} /> Scan Disease</>}
            </button>
            {(file || result) && <button onClick={reset} className="btn-ghost px-4"><RotateCcw size={18} /></button>}
          </div>
        </div>

        {/* Results Panel */}
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="glass-card p-6 flex flex-col items-center justify-center gap-4" style={{ minHeight: 400 }}>
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-4 border-brand-500/20" />
                <div className="absolute inset-0 rounded-full border-4 border-t-brand-500 animate-spin" />
                <Microscope size={28} className="absolute inset-0 m-auto text-brand-400" />
              </div>
              <p className="text-brand-300 font-medium">Analyzing crop image...</p>
              <p className="text-gray-500 text-xs">Searching knowledge base + AI analysis</p>
              <div className="w-48 progress-bar"><div className="progress-fill animate-pulse" style={{ width: '70%' }} /></div>
            </motion.div>
          )}

          {result && !loading && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="glass-card p-5 space-y-3 overflow-y-auto" style={{ maxHeight: 700 }}>

              {/* 1. Disease Identification */}
              <div className="rounded-xl p-4" style={{ background: sev?.bg, border: `1px solid ${sev?.color}30` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {result.severity === 'none'
                        ? <CheckCircle size={16} className="text-green-400" />
                        : <AlertTriangle size={16} style={{ color: sev?.color }} />}
                      <span className="text-xs text-gray-400">Disease Detected</span>
                    </div>
                    <h3 className="font-bold text-lg text-white">{result.disease}</h3>
                    {result.scientific_name && (
                      <p className="text-xs text-gray-500 italic mt-0.5">{result.scientific_name}</p>
                    )}
                    <p className="text-sm mt-1" style={{ color: sev?.color }}>{result.crop}</p>
                  </div>
                  <span className={sev?.class}>{sev?.label}</span>
                </div>

                {/* Confidence bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>AI Confidence</span>
                    <span className="text-white font-medium">{result.confidence}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${result.confidence}%` }} />
                  </div>
                </div>

                {/* Affected area estimate */}
                {result.affected_area_estimate && (
                  <p className="text-xs text-gray-400 mt-2">📊 {result.affected_area_estimate}</p>
                )}
              </div>

              {/* 2. Urgency + Yield Impact */}
              <div className="grid grid-cols-2 gap-2">
                {result.urgency && (
                  <div className="rounded-xl p-3" style={{ background: '#162040', border: '1px solid #1e3a5f' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock size={13} className="text-amber-400" />
                      <span className="text-xs text-gray-400 font-medium">Urgency</span>
                    </div>
                    <p className="text-xs text-white">{result.urgency}</p>
                  </div>
                )}
                {result.yield_impact && (
                  <div className="rounded-xl p-3" style={{ background: '#162040', border: '1px solid #1e3a5f' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingDown size={13} className="text-red-400" />
                      <span className="text-xs text-gray-400 font-medium">Yield Impact</span>
                    </div>
                    <p className="text-xs text-white">{result.yield_impact}</p>
                  </div>
                )}
              </div>

              {/* 3. Treatment Plan */}
              <Section title="💊 Treatment Plan" id="treatment" expanded={expandedSection} toggle={toggle}>
                <div className="flex gap-1 p-0.5 rounded-lg mb-3" style={{ background: '#0f1629' }}>
                  {(['chemical', 'organic'] as const).map(tab => (
                    <button key={tab} onClick={() => { setTreatmentTab(tab); setTranslatedText(null); setTransLang('en') }}
                      className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors
                        ${treatmentTab === tab ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                      style={treatmentTab === tab ? { background: '#1d4ed8' } : {}}>
                      {tab === 'chemical' ? '🧪 Chemical' : '🌿 Organic'}
                    </button>
                  ))}
                </div>
                <div className="text-sm text-gray-300 prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{displayText}</ReactMarkdown>
                </div>
                <button onClick={handleTranslate} disabled={translating}
                  className="flex items-center gap-1.5 text-xs text-brand-300 hover:text-brand-200 mt-2 transition-colors">
                  {translating
                    ? <div className="w-3 h-3 border border-brand-400/30 border-t-brand-400 rounded-full animate-spin" />
                    : <Languages size={12} />}
                  {transLang === 'en' ? 'हिंदी में अनुवाद करें' : 'Translate to English'}
                </button>
              </Section>

              {/* 4. Preventive Measures */}
              {result.preventive_measures?.length > 0 && (
                <Section title="🛡️ Preventive Measures" id="prevention" expanded={expandedSection} toggle={toggle}>
                  <ul className="space-y-1.5">
                    {result.preventive_measures.map((m: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <Shield size={12} className="text-brand-400 flex-shrink-0 mt-1" />
                        {m}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* 5. Expert Connect */}
              <Section title="📞 Expert Connect" id="expert" expanded={expandedSection} toggle={toggle}>
                {!showExpert ? (
                  <button onClick={handleExpertConnect}
                    className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-2">
                    <Phone size={15} /> Connect with Krishi Expert
                  </button>
                ) : (
                  <div className="space-y-2">
                    {experts.length > 0 ? experts.map((e: any) => (
                      <div key={e.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                        style={{ background: '#162040', border: '1px solid #1e3a5f' }}>
                        <div>
                          <p className="text-white text-sm font-medium">{e.name}</p>
                          <p className="text-xs text-gray-500">{e.district}, {e.state}</p>
                        </div>
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Available
                        </span>
                      </div>
                    )) : (
                      <div className="text-center py-4">
                        <p className="text-gray-400 text-sm">No experts available in your area right now</p>
                        <p className="text-gray-600 text-xs mt-1">Contact your local Krishi Vigyan Kendra</p>
                        <p className="text-brand-300 text-xs mt-1 font-medium">Helpline: 1800-180-1551 (Toll Free)</p>
                      </div>
                    )}
                  </div>
                )}
              </Section>

              {/* Download */}
              <button onClick={handleDownload} className="btn-amber w-full flex items-center justify-center gap-2">
                <Download size={16} /> {t('disease.download_report')}
              </button>
            </motion.div>
          )}

          {!result && !loading && !file && (
            <div className="glass-card p-6 flex flex-col items-center justify-center gap-3 text-center" style={{ minHeight: 400 }}>
              <Microscope size={40} className="text-gray-600" />
              <p className="text-gray-500 text-sm">Upload a crop image to detect diseases</p>
              <p className="text-gray-600 text-xs">Select crop name for better accuracy</p>
              <div className="mt-4 grid grid-cols-2 gap-2 w-full max-w-xs text-xs text-gray-600">
                {['🔍 Disease Identification', '⚠️ Severity Level', '💊 Treatment Plan', '🛡️ Prevention Tips',
                  '📊 Yield Impact', '📞 Expert Connect'].map(f => (
                  <div key={f} className="px-3 py-2 rounded-lg text-left" style={{ background: '#162040' }}>{f}</div>
                ))}
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// Collapsible section component
function Section({ title, id, expanded, toggle, children }: {
  title: string; id: string; expanded: string | null
  toggle: (id: string) => void; children: React.ReactNode
}) {
  const isOpen = expanded === id
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e3a5f' }}>
      <button onClick={() => toggle(id)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-brand-500/5"
        style={{ background: '#162040' }}>
        <span className="text-sm font-medium text-white">{title}</span>
        {isOpen ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>
      {isOpen && <div className="px-4 py-3" style={{ background: '#0f1629' }}>{children}</div>}
    </div>
  )
}
