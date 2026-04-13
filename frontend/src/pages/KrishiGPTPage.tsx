import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Plus, Mic, MicOff, Bot, User, History, X, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import { chatbotAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { useSpeech } from '../hooks/useSpeech'

const QUICK_QUESTIONS = [
  'Wheat mein kaun sa fertilizer use karu?',
  'Paddy ke sath crop rotation kya ho?',
  'PM-KISAN scheme ke baare mein batao',
  'Tomato mein kaunsa rog lag sakta hai?',
]

const MESSAGE_LIMIT = 100

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Session {
  session_id: string
  last_message: string
}

export default function KrishiGPTPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [sessions, setSessions] = useState<Session[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { transcript, listening, resetTranscript, startListening, stopListening, browserSupportsSpeechRecognition } = useSpeech()

  useEffect(() => { if (transcript) setInput(transcript) }, [transcript])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const isAtLimit = messages.length >= MESSAGE_LIMIT

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || loading || isAtLimit) return

    setInput('')
    resetTranscript()
    setMessages((m) => [...m, { role: 'user', content: msg }])
    setLoading(true)

    try {
      const res = await chatbotAPI.chat(msg, sessionId, user?.language)
      setSessionId(res.data.session_id)
      setMessages((m) => [...m, { role: 'assistant', content: res.data.answer }])
    } catch {
      try {
        await new Promise(r => setTimeout(r, 1500))
        const res = await chatbotAPI.chat(msg, sessionId, user?.language)
        setSessionId(res.data.session_id)
        setMessages((m) => [...m, { role: 'assistant', content: res.data.answer }])
      } catch {
        toast.error('Failed to get response')
        setMessages((m) => [...m, { role: 'assistant', content: 'माफ करें, कृपया दोबारा पूछें।' }])
      }
    } finally {
      setLoading(false)
    }
  }

  const newChat = () => {
    setMessages([])
    setSessionId(undefined)
    setInput('')
    setShowHistory(false)
  }

  const loadHistory = async () => {
    setHistoryLoading(true)
    setShowHistory(true)
    try {
      const res = await chatbotAPI.sessions()
      setSessions(res.data || [])
    } catch {
      toast.error('Could not load chat history')
    } finally {
      setHistoryLoading(false)
    }
  }

  const loadSession = async (sid: string) => {
    try {
      const res = await chatbotAPI.history(sid)
      const msgs: Message[] = res.data.map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
      setMessages(msgs)
      setSessionId(sid)
      setShowHistory(false)
    } catch {
      toast.error('Could not load session')
    }
  }

  const toggleVoice = () => {
    if (listening) stopListening()
    else { resetTranscript(); startListening(user?.language === 'en' ? 'en-IN' : 'hi-IN') }
  }

  return (
    <div className="flex flex-col h-full p-6 gap-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="font-display font-bold text-2xl text-white flex items-center gap-3">
            <Bot className="text-brand-400" size={28} />
            {t('chatbot.title')}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {t('chatbot.subtitle')}
            {messages.length > 0 && (
              <span className={`ml-2 text-xs ${isAtLimit ? 'text-red-400' : 'text-gray-600'}`}>
                {messages.length}/{MESSAGE_LIMIT} messages
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadHistory} className="btn-ghost flex items-center gap-2 text-sm">
            <History size={16} /> History
          </button>
          <button onClick={newChat} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> {t('chatbot.new_chat')}
          </button>
        </div>
      </div>

      {/* History sidebar */}
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="absolute right-6 top-24 z-50 w-72 glass-card p-4 space-y-2 shadow-2xl"
            style={{ maxHeight: 400, overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-sm font-semibold">Previous Chats</span>
              <button onClick={() => setShowHistory(false)}><X size={14} className="text-gray-400" /></button>
            </div>
            {historyLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-4">No previous chats</p>
            ) : (
              sessions.map((s) => (
                <button key={s.session_id} onClick={() => loadSession(s.session_id)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-gray-300 hover:bg-brand-500/10 transition-colors"
                  style={{ border: '1px solid #1e3a5f' }}>
                  <p className="truncate">{s.last_message}</p>
                  <p className="text-xs text-gray-600 mt-0.5 truncate">{s.session_id.slice(0, 8)}...</p>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden rounded-2xl"
        style={{ border: '1px solid #1e3a5f', background: 'linear-gradient(145deg, rgba(29,78,216,0.06) 0%, rgba(10,15,30,0.97) 100%)', minHeight: 0 }}>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-6 py-12">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(29,78,216,0.3), rgba(245,158,11,0.15))' }}>
                <Bot size={40} className="text-brand-400" />
              </div>
              <div className="text-center">
                <h3 className="font-display font-semibold text-white text-lg">{t('chatbot.title')}</h3>
                <p className="text-gray-500 text-sm mt-1">Powered by Llama 3.3 70B — Ask anything about farming</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {QUICK_QUESTIONS.map((q) => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="text-left px-4 py-3 rounded-xl text-sm text-gray-300 transition-colors"
                    style={{ border: '1px solid #1e3a5f', backgroundColor: '#0f1629' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(37,99,235,0.5)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e3a5f')}>
                    {q}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={msg.role === 'user'
                    ? { background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }
                    : { backgroundColor: '#0f1629', border: '1px solid #1e3a5f' }}>
                  {msg.role === 'user'
                    ? <User size={14} className="text-white" />
                    : <Bot size={14} className="text-brand-400" />}
                </div>
                <div className={msg.role === 'user' ? 'chat-user' : 'chat-ai'}>
                  {msg.role === 'assistant'
                    ? <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    : <p>{msg.content}</p>}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#0f1629', border: '1px solid #1e3a5f' }}>
                <Bot size={14} className="text-brand-400" />
              </div>
              <div className="chat-ai flex flex-col gap-1 px-4 py-3">
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-2 h-2 rounded-full bg-brand-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <p className="text-xs text-gray-500">KrishiGPT is thinking...</p>
              </div>
            </motion.div>
          )}

          {/* 100 message limit warning */}
          {isAtLimit && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl mx-2"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-amber-300 text-sm font-medium">Chat limit reached (100 messages)</p>
                <p className="text-amber-500 text-xs mt-0.5">Start a new chat to continue the conversation</p>
              </div>
              <button onClick={newChat} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                <Plus size={12} /> New Chat
              </button>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="p-4" style={{ borderTop: '1px solid #1e3a5f' }}>
          {isAtLimit ? (
            <div className="flex justify-center">
              <button onClick={newChat} className="btn-primary flex items-center gap-2">
                <Plus size={16} /> Start New Chat
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              {browserSupportsSpeechRecognition && (
                <button onClick={toggleVoice}
                  className={`p-3 rounded-xl transition-colors ${listening ? 'text-red-400' : 'text-gray-400 hover:text-brand-400'}`}
                  style={{ border: `1px solid ${listening ? 'rgba(239,68,68,0.3)' : '#1e3a5f'}`, backgroundColor: listening ? 'rgba(239,68,68,0.1)' : '#0f1629' }}>
                  {listening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              )}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={listening ? t('voice.listening') : t('chatbot.placeholder')}
                className="input-field flex-1"
              />
              <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                className="btn-primary px-4 disabled:opacity-50 disabled:cursor-not-allowed">
                <Send size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
