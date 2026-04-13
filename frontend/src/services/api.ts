import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
})

api.interceptors.request.use((config) => {
  const stored = localStorage.getItem('pragati-auth')
  if (stored) {
    const { state } = JSON.parse(stored)
    if (state?.token) {
      config.headers.Authorization = `Bearer ${state.token}`
    }
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pragati-auth')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const authAPI = {
  login: (phone: string, password: string) =>
    api.post('/auth/login', new URLSearchParams({ username: phone, password })),
  register: (data: object) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  updateLanguage: (lang: string) => api.patch(`/auth/language?language=${lang}`),
}

// Disease
export const diseaseAPI = {
  scan: (formData: FormData) => api.post('/disease/scan', formData),
  history: () => api.get('/disease/history'),
  reportPdf: (scanId: number, lang: string) =>
    api.get(`/disease/report/${scanId}/pdf?language=${lang}`, { responseType: 'blob' }),
}

// Chatbot — longer timeout for LLM responses
const chatApi = axios.create({
  baseURL: '/api',
  timeout: 180000,
})
chatApi.interceptors.request.use((config) => {
  const stored = localStorage.getItem('pragati-auth')
  if (stored) {
    const { state } = JSON.parse(stored)
    if (state?.token) config.headers.Authorization = `Bearer ${state.token}`
  }
  return config
})
chatApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pragati-auth')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Chatbot
export const chatbotAPI = {
  chat: (message: string, sessionId?: string, language?: string) =>
    chatApi.post('/chatbot/chat', { message, session_id: sessionId, language }),
  history: (sessionId: string) => chatApi.get(`/chatbot/history/${sessionId}`),
  sessions: () => chatApi.get('/chatbot/sessions'),
}

// Weather
export const weatherAPI = {
  forecast: (location: string) => api.get(`/weather/forecast?location=${encodeURIComponent(location)}`),
}

// Soil
export const soilAPI = {
  analyze: (data: object) => api.post('/soil/analyze', data),
  ocr: (formData: FormData) => api.post('/soil/ocr', formData),
  history: () => api.get('/soil/history'),
  reportPdf: (recId: number, lang: string) =>
    api.get(`/soil/report/${recId}/pdf?language=${lang}`, { responseType: 'blob' }),
}

// Market
export const marketAPI = {
  prices: (commodity: string, state: string) =>
    api.get(`/market/prices?commodity=${commodity}&state=${encodeURIComponent(state)}`),
  commodities: () => api.get('/market/commodities'),
  states: () => api.get('/market/states'),
  nearestMandis: (params: { lat?: number; lon?: number; location?: string; state?: string; district?: string; top?: number }) => {
    const q = new URLSearchParams()
    if (params.lat != null) q.set('lat', String(params.lat))
    if (params.lon != null) q.set('lon', String(params.lon))
    if (params.location) q.set('location', params.location)
    if (params.state) q.set('state', params.state)
    if (params.district) q.set('district', params.district)
    if (params.top) q.set('top', String(params.top))
    return api.get(`/market/nearest-mandis?${q.toString()}`)
  },
  reportPdf: (commodity: string, state: string, lang: string) =>
    api.get(`/market/report/pdf?commodity=${commodity}&state=${encodeURIComponent(state)}&language=${lang}`, { responseType: 'blob' }),
}

// Farm Calculator
export const farmAPI = {
  calculate: (data: object) => api.post('/farm/calculate', data),
  history: () => api.get('/farm/history'),
  reportPdf: (expenseId: number, lang: string) =>
    api.get(`/farm/report/${expenseId}/pdf?language=${lang}`, { responseType: 'blob' }),
}

// Forum
export const forumAPI = {
  posts: (category?: string, page = 1) =>
    api.get(`/forum/posts?page=${page}${category ? `&category=${category}` : ''}`),
  post: (id: number) => api.get(`/forum/posts/${id}`),
  createPost: (formData: FormData) => api.post('/forum/posts', formData),
  comment: (postId: number, content: string) =>
    api.post(`/forum/posts/${postId}/comment`, new URLSearchParams({ content })),
  upvote: (postId: number) => api.post(`/forum/posts/${postId}/upvote`),
}

// Voice
export const voiceAPI = {
  ask: (text: string, language: string) =>
    api.post('/voice/ask', new URLSearchParams({ text, language })),
  tts: (text: string, language: string) =>
    api.post('/voice/text-to-speech', { text, language }, { responseType: 'blob' }),
}

// Translation
export const translateAPI = {
  translate: (text: string, targetLanguage: string) =>
    api.post('/translate/translate', { text, target_language: targetLanguage }),
}

// Admin
export const adminAPI = {
  stats: () => api.get('/admin/stats'),
  uploadDoc: (formData: FormData) => api.post('/admin/documents/upload', formData),
  documents: () => api.get('/admin/documents'),
  flaggedPosts: () => api.get('/admin/forum/flagged'),
  approvePost: (id: number) => api.patch(`/admin/forum/posts/${id}/approve`),
  users: () => api.get('/admin/users'),
  uploadDiseaseKB: (formData: FormData) => api.post('/admin/knowledge/disease/upload', formData),
  listDiseaseKB: () => api.get('/admin/knowledge/disease/list'),
  uploadSoilKB: (formData: FormData) => api.post('/admin/knowledge/soil/upload', formData),
  listSoilKB: () => api.get('/admin/knowledge/soil/list'),
  registerExpert: (data: object) => api.post('/admin/experts/register', data),
  listExperts: () => api.get('/admin/experts'),
  publicExperts: () => api.get('/admin/experts/public'),
}

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default api
