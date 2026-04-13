import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Volume2, VolumeX, Bot } from 'lucide-react'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import { useSpeech } from '../hooks/useSpeech'
import { voiceAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'

export default function VoicePage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [answer, setAnswer] = useState('')
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const { transcript, listening, resetTranscript, startListening, stopListening, browserSupportsSpeechRecognition } = useSpeech()

  const toggleListen = () => {
    if (listening) {
      stopListening()
      if (transcript) handleAsk(transcript)
    } else {
      resetTranscript()
      startListening(user?.language === 'en' ? 'en-IN' : 'hi-IN')
    }
  }

  const handleAsk = async (text: string) => {
    if (!text.trim()) return
    setQuestion(text)
    setAnswer('')
    setLoading(true)
    try {
      const res = await voiceAPI.ask(text, user?.language || 'hi')
      setAnswer(res.data.answer)
      await playTTS(res.data.answer)
    } catch { toast.error('Voice query failed') }
    finally { setLoading(false) }
  }

  const playTTS = async (text: string) => {
    try {
      const res = await voiceAPI.tts(text, user?.language || 'hi')
      const url = URL.createObjectURL(res.data)
      if (audioRef.current) {
        audioRef.current.src = url
        audioRef.current.play()
        setPlaying(true)
        audioRef.current.onended = () => { setPlaying(false); URL.revokeObjectURL(url) }
      }
    } catch {}
  }

  const stopAudio = () => {
    audioRef.current?.pause()
    setPlaying(false)
  }

  return (
    <div className="p-6 flex flex-col items-center gap-8 animate-fade-in">
      <div className="text-center">
        <h1 className="font-display font-bold text-2xl text-white flex items-center justify-center gap-3">
          <Mic className="text-brand-400" size={28} />
          {t('voice.title')}
        </h1>
        <p className="text-gray-400 text-sm mt-1">{t('voice.subtitle')}</p>
      </div>

      {/* Mic button */}
      <div className="relative">
        {listening && (
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute inset-0 rounded-full bg-brand-500/30"
          />
        )}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={toggleListen}
          disabled={!browserSupportsSpeechRecognition}
          className={`relative w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2 transition-all duration-300
            ${listening
              ? 'bg-red-500/20 border-2 border-red-500/60 text-red-400'
              : 'border-2 border-brand-500/50 text-brand-400 hover:border-brand-400'}`}
          style={!listening ? { background: 'linear-gradient(135deg, rgba(108,63,197,0.2), rgba(245,158,11,0.1))' } : {}}
        >
          {listening ? <MicOff size={40} /> : <Mic size={40} />}
          <span className="text-xs font-medium">{listening ? t('voice.listening') : t('voice.press_mic')}</span>
        </motion.button>
      </div>

      {/* Transcript */}
      {(transcript || question) && (
        <div className="glass-card p-4 w-full max-w-lg text-center">
          <p className="text-xs text-gray-500 mb-1">You asked:</p>
          <p className="text-white font-medium">{transcript || question}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-3 text-brand-300">
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-brand-400 animate-bounce"
                   style={{ animationDelay: `${i*0.15}s` }} />
            ))}
          </div>
          <span className="text-sm">{t('voice.processing')}</span>
        </motion.div>
      )}

      {/* Answer */}
      <AnimatePresence>
        {answer && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 w-full max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot size={18} className="text-brand-400" />
                <span className="text-sm font-medium text-brand-300">Krishi GPT</span>
              </div>
              <button onClick={playing ? stopAudio : () => playTTS(answer)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${playing ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-brand-500/20 text-brand-300 border border-brand-500/30'}`}>
                {playing ? <><VolumeX size={14} /> Stop</> : <><Volume2 size={14} /> {t('voice.play_response')}</>}
              </button>
            </div>
            <div className="text-sm text-gray-300 prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{answer}</ReactMarkdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <audio ref={audioRef} className="hidden" />

      {!browserSupportsSpeechRecognition && (
        <p className="text-amber-400 text-sm text-center">
          Your browser doesn't support speech recognition. Please use Chrome.
        </p>
      )}
    </div>
  )
}
