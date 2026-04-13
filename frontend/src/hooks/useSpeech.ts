// Simple Web Speech API hook — no external dependency needed
import { useState, useRef, useCallback } from 'react'

interface UseSpeechReturn {
  transcript: string
  listening: boolean
  resetTranscript: () => void
  startListening: (lang?: string) => void
  stopListening: () => void
  browserSupportsSpeechRecognition: boolean
}

export function useSpeech(): UseSpeechReturn {
  const [transcript, setTranscript] = useState('')
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  const SpeechRecognitionAPI =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null

  const browserSupportsSpeechRecognition = !!SpeechRecognitionAPI

  const startListening = useCallback((lang = 'hi-IN') => {
    if (!SpeechRecognitionAPI) return
    const recognition = new SpeechRecognitionAPI()
    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (e: any) => {
      setTranscript(e.results[0][0].transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const resetTranscript = useCallback(() => setTranscript(''), [])

  return { transcript, listening, resetTranscript, startListening, stopListening, browserSupportsSpeechRecognition }
}
