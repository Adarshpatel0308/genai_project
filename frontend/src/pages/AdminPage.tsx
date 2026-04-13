import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ShieldCheck, Users, FileText, Microscope, Upload, CheckCircle, Flag, Bug, TrendingUp, BookOpen, Leaf } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import toast from 'react-hot-toast'
import { adminAPI } from '../services/api'

const DOC_TYPES = [
  { value: 'government_scheme', label: '🏛️ Government Scheme' },
  { value: 'crop_guide', label: '🌾 Crop Guide' },
  { value: 'pest_management', label: '🐛 Pest Management' },
  { value: 'market', label: '📈 Market Policy' },
  { value: 'general', label: '📄 General' },
]

export default function AdminPage() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [diseaseKBDocs, setDiseaseKBDocs] = useState<any[]>([])
  const [soilKBDocs, setSoilKBDocs] = useState<any[]>([])
  const [flagged, setFlagged] = useState<any[]>([])
  const [experts, setExperts] = useState<any[]>([])
  const [tab, setTab] = useState<'overview' | 'analytics' | 'users' | 'docs' | 'disease_kb' | 'soil_kb' | 'experts' | 'forum'>('overview')
  const [uploading, setUploading] = useState(false)
  const [docForm, setDocForm] = useState({ title: '', doc_type: 'government_scheme', language: 'hi' })
  const [diseaseKBForm, setDiseaseKBForm] = useState({ title: '', crop_type: 'general', language: 'hi' })
  const [soilKBForm, setSoilKBForm] = useState({ title: '', doc_type: 'soil_guide', language: 'hi' })
  const [expertForm, setExpertForm] = useState({ name: '', phone: '', password: '', email: '', specialization: 'general', state: '', district: '', designation: '' })

  useEffect(() => {
    adminAPI.stats().then(r => setStats(r.data)).catch(() => {})
    adminAPI.users().then(r => setUsers(r.data)).catch(() => {})
    adminAPI.documents().then(r => setDocs(r.data)).catch(() => {})
    adminAPI.flaggedPosts().then(r => setFlagged(r.data)).catch(() => {})
    adminAPI.listDiseaseKB().then(r => setDiseaseKBDocs(r.data)).catch(() => {})
    adminAPI.listSoilKB().then(r => setSoilKBDocs(r.data)).catch(() => {})
    adminAPI.listExperts().then(r => setExperts(r.data)).catch(() => {})
  }, [])

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!docForm.title) { toast.error('Please enter a document title first'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', docForm.title)
      fd.append('doc_type', docForm.doc_type)
      fd.append('language', docForm.language)
      const res = await adminAPI.uploadDoc(fd)
      toast.success(`✅ Indexed ${res.data.chunks_indexed} chunks into KrishiGPT knowledge base!`)
      setDocForm(f => ({ ...f, title: '' }))
      adminAPI.documents().then(r => setDocs(r.data))
    } catch { toast.error('Upload failed') }
    finally { setUploading(false) }
  }

  const handleApprove = async (id: number) => {
    await adminAPI.approvePost(id)
    setFlagged(f => f.filter(p => p.id !== id))
    toast.success('Post approved')
  }

  const STAT_CARDS = stats ? [
    { label: 'Total Farmers', value: stats.total_users, icon: Users, color: '#1d4ed8' },
    { label: 'Disease Scans', value: stats.total_scans, icon: Microscope, color: '#f472b6' },
    { label: 'Forum Posts', value: stats.total_forum_posts, icon: FileText, color: '#60a5fa' },
    { label: 'Knowledge Docs', value: stats.total_documents, icon: BookOpen, color: '#f59e0b' },
  ] : []

  const TABS = [
    { key: 'overview', label: 'Overview', icon: ShieldCheck },
    { key: 'analytics', label: 'Disease Analytics', icon: Bug },
    { key: 'docs', label: 'KrishiGPT KB', icon: BookOpen },
    { key: 'disease_kb', label: 'Disease KB', icon: Microscope },
    { key: 'soil_kb', label: 'Soil & Crop KB', icon: Leaf },
    { key: 'experts', label: 'Experts', icon: Users },
    { key: 'users', label: 'Farmers', icon: Users },
    { key: 'forum', label: 'Moderation', icon: Flag },
  ]

  const diseaseChartData = stats?.top_diseases?.map((d: any) => ({
    name: d.disease?.split(' ').slice(0, 2).join(' ') || 'Unknown',
    count: d.count,
    crop: d.crop,
  })) || []

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display font-bold text-2xl text-white flex items-center gap-3">
          <ShieldCheck className="text-brand-400" size={28} />
          Admin Dashboard
        </h1>
        <p className="text-gray-400 text-sm mt-1">Manage farmers, knowledge base, and monitor disease trends</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors
              ${tab === key ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            style={tab === key
              ? { background: '#1d4ed8' }
              : { background: '#162040', border: '1px solid #1e3a5f' }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STAT_CARDS.map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }} className="stat-card">
                <s.icon size={20} style={{ color: s.color }} />
                <p className="font-display font-bold text-2xl text-white">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Quick disease summary */}
          {stats?.top_diseases?.length > 0 && (
            <div className="glass-card p-6">
              <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
                <Bug size={16} className="text-red-400" /> Most Reported Diseases
              </h2>
              <p className="text-xs text-gray-500 mb-4">Based on farmer scans — helps identify regional disease outbreaks</p>
              <div className="space-y-2">
                {stats.top_diseases.slice(0, 5).map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 rounded-xl" style={{ background: '#162040' }}>
                    <div>
                      <span className="text-white text-sm font-medium">{d.disease}</span>
                      <span className="text-gray-500 text-xs ml-2">in {d.crop}</span>
                    </div>
                    <span className="text-brand-300 text-sm font-bold">{d.count} reports</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Disease Analytics */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
              <TrendingUp size={16} className="text-brand-400" /> Disease Outbreak Analysis
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              This data helps government identify which diseases are affecting farmers most — enabling targeted support and advisories.
            </p>
            {diseaseChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={diseaseChartData} layout="vertical">
                  <XAxis type="number" stroke="#374151" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" stroke="#374151" tick={{ fill: '#9ca3af', fontSize: 11 }} width={120} />
                  <Tooltip
                    contentStyle={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: 12 }}
                    formatter={(v: any, _: any, props: any) => [`${v} reports`, props.payload.crop]}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {diseaseChartData.map((_: any, i: number) => (
                      <Cell key={i} fill={i === 0 ? '#ef4444' : i === 1 ? '#f97316' : i === 2 ? '#f59e0b' : '#1d4ed8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Bug size={40} className="mx-auto mb-3 opacity-30" />
                <p>No disease scan data yet. Data will appear as farmers use the Disease Scanner.</p>
              </div>
            )}
          </div>

          <div className="glass-card p-6">
            <h2 className="font-semibold text-white mb-4">All Disease Reports</h2>
            <div className="space-y-2">
              {stats?.top_diseases?.map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: '#162040' }}>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: '#1d4ed8' }}>{i + 1}</span>
                    <div>
                      <p className="text-white text-sm font-medium">{d.disease}</p>
                      <p className="text-gray-500 text-xs">Crop: {d.crop}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold">{d.count}</p>
                    <p className="text-gray-500 text-xs">reports</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Knowledge Base */}
      {tab === 'docs' && (
        <div className="space-y-4">
          <div className="glass-card p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Upload size={16} className="text-brand-400" /> Upload to KrishiGPT Knowledge Base
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Upload PDFs about new government schemes, crop policies, or farming guidelines.
                KrishiGPT will automatically learn from them and answer farmer questions.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Document Title <span className="text-red-400">*</span></label>
                <input value={docForm.title} onChange={(e) => setDocForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. PM-KISAN 2025 New Guidelines" className="input-field text-sm py-2" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Document Type</label>
                <select value={docForm.doc_type} onChange={(e) => setDocForm(f => ({ ...f, doc_type: e.target.value }))}
                  className="input-field text-sm py-2">
                  {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Language</label>
                <select value={docForm.language} onChange={(e) => setDocForm(f => ({ ...f, language: e.target.value }))}
                  className="input-field text-sm py-2">
                  {[['hi', 'Hindi'], ['mr', 'Marathi'], ['gu', 'Gujarati'], ['en', 'English']].map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className={`btn-primary w-full flex items-center justify-center gap-2 cursor-pointer ${uploading ? 'opacity-60 cursor-not-allowed' : ''}`}>
                  {uploading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Indexing into AI...</>
                    : <><Upload size={16} /> Upload PDF / TXT</>}
                  <input type="file" accept=".pdf,.txt" onChange={handleDocUpload} className="hidden" disabled={uploading} />
                </label>
              </div>
            </div>

            <div className="rounded-xl p-3 text-xs text-blue-300 flex items-start gap-2"
              style={{ background: 'rgba(29,78,216,0.1)', border: '1px solid rgba(29,78,216,0.2)' }}>
              <BookOpen size={14} className="flex-shrink-0 mt-0.5" />
              <span>After upload, KrishiGPT will immediately be able to answer questions about this document. Farmers can ask about new schemes, policies, or guidelines in Hindi, Marathi, Gujarati, or English.</span>
            </div>
          </div>

          {/* Documents list */}
          <div className="space-y-2">
            <h3 className="text-white font-medium text-sm">Indexed Documents ({docs.length})</h3>
            {docs.length === 0 ? (
              <div className="glass-card p-8 text-center text-gray-500 text-sm">No documents uploaded yet</div>
            ) : docs.map((doc) => (
              <div key={doc.id} className="glass-card p-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium text-sm">{doc.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {DOC_TYPES.find(t => t.value === doc.type)?.label || doc.type} · {doc.language} · {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                {doc.is_indexed && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle size={14} /> Indexed
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disease Knowledge Base */}
      {tab === 'disease_kb' && (
        <div className="space-y-4">
          <div className="glass-card p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Microscope size={16} className="text-brand-400" /> Disease Detection Knowledge Base
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Upload PDFs, PPTs, or images of crop diseases. AI will use this data to give more accurate disease detection and treatment plans.
                Supports: PDF, PPT, PPTX, TXT, JPG, PNG
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Document Title <span className="text-red-400">*</span></label>
                <input value={diseaseKBForm.title} onChange={e => setDiseaseKBForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Wheat Rust Disease Guide" className="input-field text-sm py-2" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Crop Type</label>
                <select value={diseaseKBForm.crop_type} onChange={e => setDiseaseKBForm(f => ({ ...f, crop_type: e.target.value }))}
                  className="input-field text-sm py-2">
                  {['general','wheat','rice','cotton','tomato','potato','maize','soybean','onion','sugarcane'].map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Language</label>
                <select value={diseaseKBForm.language} onChange={e => setDiseaseKBForm(f => ({ ...f, language: e.target.value }))}
                  className="input-field text-sm py-2">
                  {[['hi','Hindi'],['en','English'],['mr','Marathi'],['gu','Gujarati']].map(([v,l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className={`btn-primary flex items-center justify-center gap-2 cursor-pointer w-full ${uploading ? 'opacity-60' : ''}`}>
              {uploading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Indexing...</>
                : <><Upload size={16} /> Upload PDF / PPT / Image</>}
              <input type="file" accept=".pdf,.ppt,.pptx,.txt,.jpg,.jpeg,.png" className="hidden" disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file || !diseaseKBForm.title) { toast.error('Enter title first'); return }
                  setUploading(true)
                  try {
                    const fd = new FormData()
                    fd.append('file', file)
                    fd.append('title', diseaseKBForm.title)
                    fd.append('crop_type', diseaseKBForm.crop_type)
                    fd.append('language', diseaseKBForm.language)
                    const res = await adminAPI.uploadDiseaseKB(fd)
                    toast.success(res.data.message)
                    setDiseaseKBForm(f => ({ ...f, title: '' }))
                    adminAPI.listDiseaseKB().then(r => setDiseaseKBDocs(r.data))
                  } catch { toast.error('Upload failed') }
                  finally { setUploading(false) }
                }} />
            </label>
            <div className="rounded-xl p-3 text-xs text-blue-300 flex items-start gap-2"
              style={{ background: 'rgba(29,78,216,0.1)', border: '1px solid rgba(29,78,216,0.2)' }}>
              <Microscope size={14} className="flex-shrink-0 mt-0.5" />
              <span>When a farmer uploads a crop image, AI first searches this knowledge base for matching disease info, then combines it with visual analysis for a more accurate diagnosis and treatment plan.</span>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-white font-medium text-sm">Indexed Documents ({diseaseKBDocs.length})</h3>
            {diseaseKBDocs.length === 0
              ? <div className="glass-card p-8 text-center text-gray-500 text-sm">No disease documents uploaded yet</div>
              : diseaseKBDocs.map(doc => (
                <div key={doc.id} className="glass-card p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium text-sm">{doc.title}</p>
                    <p className="text-xs text-gray-500">{doc.type} · {doc.language} · {new Date(doc.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle size={14} /> Indexed</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Soil & Crop Knowledge Base */}
      {tab === 'soil_kb' && (
        <div className="space-y-4">
          <div className="glass-card p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Leaf size={16} className="text-brand-400" /> Soil & Crop Advisory Knowledge Base
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Upload soil health guides, crop advisory PDFs, fertilizer recommendations, or government soil reports.
                AI uses this to give better soil analysis and crop recommendations.
                Supports: PDF, PPT, PPTX, TXT, JPG, PNG
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Document Title <span className="text-red-400">*</span></label>
                <input value={soilKBForm.title} onChange={e => setSoilKBForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Soil Health Card Scheme Guide" className="input-field text-sm py-2" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Document Type</label>
                <select value={soilKBForm.doc_type} onChange={e => setSoilKBForm(f => ({ ...f, doc_type: e.target.value }))}
                  className="input-field text-sm py-2">
                  {[['soil_guide','Soil Health Guide'],['crop_guide','Crop Advisory'],['fertilizer_guide','Fertilizer Guide'],['soil_health','Soil Health Card']].map(([v,l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Language</label>
                <select value={soilKBForm.language} onChange={e => setSoilKBForm(f => ({ ...f, language: e.target.value }))}
                  className="input-field text-sm py-2">
                  {[['hi','Hindi'],['en','English'],['mr','Marathi'],['gu','Gujarati']].map(([v,l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className={`btn-primary flex items-center justify-center gap-2 cursor-pointer w-full ${uploading ? 'opacity-60' : ''}`}>
              {uploading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Indexing...</>
                : <><Upload size={16} /> Upload PDF / PPT / Image</>}
              <input type="file" accept=".pdf,.ppt,.pptx,.txt,.jpg,.jpeg,.png" className="hidden" disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file || !soilKBForm.title) { toast.error('Enter title first'); return }
                  setUploading(true)
                  try {
                    const fd = new FormData()
                    fd.append('file', file)
                    fd.append('title', soilKBForm.title)
                    fd.append('doc_type', soilKBForm.doc_type)
                    fd.append('language', soilKBForm.language)
                    const res = await adminAPI.uploadSoilKB(fd)
                    toast.success(res.data.message)
                    setSoilKBForm(f => ({ ...f, title: '' }))
                    adminAPI.listSoilKB().then(r => setSoilKBDocs(r.data))
                  } catch { toast.error('Upload failed') }
                  finally { setUploading(false) }
                }} />
            </label>
          </div>
          <div className="space-y-2">
            <h3 className="text-white font-medium text-sm">Indexed Documents ({soilKBDocs.length})</h3>
            {soilKBDocs.length === 0
              ? <div className="glass-card p-8 text-center text-gray-500 text-sm">No soil/crop documents uploaded yet</div>
              : soilKBDocs.map(doc => (
                <div key={doc.id} className="glass-card p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium text-sm">{doc.title}</p>
                    <p className="text-xs text-gray-500">{doc.type} · {doc.language} · {new Date(doc.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle size={14} /> Indexed</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Experts */}
      {tab === 'experts' && (
        <div className="space-y-4">
          <div className="glass-card p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Users size={16} className="text-brand-400" /> Register Krishi Expert
              </h2>
              <p className="text-xs text-gray-500 mt-1">Add government agriculture officers, KVK scientists, or field experts. Farmers can connect with them from the Disease Scanner.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'name', label: 'Full Name *', placeholder: 'Dr. Ramesh Kumar' },
                { key: 'phone', label: 'Phone *', placeholder: '9876543210' },
                { key: 'password', label: 'Password *', placeholder: 'Min 6 chars', type: 'password' },
                { key: 'email', label: 'Email', placeholder: 'expert@kvk.gov.in' },
                { key: 'designation', label: 'Designation', placeholder: 'KVK Subject Matter Specialist' },
                { key: 'state', label: 'State', placeholder: 'Madhya Pradesh' },
                { key: 'district', label: 'District', placeholder: 'Narmadapuram' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-400 mb-1">{label}</label>
                  <input type={type || 'text'} value={(expertForm as any)[key]}
                    onChange={e => setExpertForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder} className="input-field text-sm py-2" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Specialization</label>
                <select value={expertForm.specialization} onChange={e => setExpertForm(f => ({ ...f, specialization: e.target.value }))}
                  className="input-field text-sm py-2">
                  {['general','wheat','rice','cotton','soil','pest','horticulture'].map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
            <button onClick={async () => {
              if (!expertForm.name || !expertForm.phone || !expertForm.password) { toast.error('Name, phone and password required'); return }
              try {
                const res = await adminAPI.registerExpert(expertForm)
                toast.success(res.data.message)
                setExpertForm({ name: '', phone: '', password: '', email: '', specialization: 'general', state: '', district: '', designation: '' })
                adminAPI.listExperts().then(r => setExperts(r.data))
              } catch { toast.error('Registration failed') }
            }} className="btn-primary flex items-center gap-2">
              <Users size={16} /> Register Expert
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="text-white font-medium text-sm">Registered Experts ({experts.length})</h3>
            {experts.length === 0
              ? <div className="glass-card p-8 text-center text-gray-500 text-sm">No experts registered yet</div>
              : experts.map(e => (
                <div key={e.id} className="glass-card p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium text-sm">{e.name}</p>
                    <p className="text-xs text-gray-500">{e.district}, {e.state} · {e.phone}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${e.is_active ? 'text-green-400' : 'text-red-400'}`}
                    style={{ background: e.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }}>
                    {e.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #1e3a5f' }}>
                  {['ID', 'Name', 'Phone', 'Role', 'State', 'Joined'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(30,58,95,0.5)' }}
                    className="hover:bg-surface-elevated/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-400">#{u.id}</td>
                    <td className="px-4 py-3 text-sm text-white font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{u.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${u.role === 'admin' ? 'bg-brand-500/20 text-brand-300' : 'text-gray-400'}`}
                        style={u.role !== 'admin' ? { background: '#162040' } : {}}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{u.state || '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Forum moderation */}
      {tab === 'forum' && (
        <div className="space-y-3">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Flag size={16} className="text-red-400" /> Flagged Posts ({flagged.length})
          </h2>
          {flagged.length === 0 ? (
            <div className="glass-card p-8 text-center text-gray-500">No flagged posts — all clear ✅</div>
          ) : flagged.map((post) => (
            <div key={post.id} className="glass-card p-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-white font-medium">{post.title}</p>
                <p className="text-sm text-gray-400 mt-1">{post.content}</p>
              </div>
              <button onClick={() => handleApprove(post.id)}
                className="btn-primary text-xs px-3 py-2 flex-shrink-0">
                Approve
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
