import { useState, useRef, useEffect } from 'react'
import type { Goal, MealLog } from '../lib/types'
import { analyzeMeal } from '../lib/claude'
import { addMealToToday } from '../lib/storage'
import MealCard from './MealCard'
import DailySummary from './DailySummary'

interface Props {
  goal: Goal
  meals: MealLog[]
  onMealAdded: (meal: MealLog) => void
  onChangeGoal: () => void
}

const hasSpeechRecognition =
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

type RecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: Event) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function createRecognition(): RecognitionInstance | null {
  if (!hasSpeechRecognition) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  return new SR()
}

export default function MealLogger({ goal, meals, onMealAdded, onChangeGoal }: Props) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<RecognitionInstance | null>(null)
  const listEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [meals])

  const startListening = () => {
    const recognition = createRecognition()
    if (!recognition) return
    recognitionRef.current = recognition
    recognition.lang = 'fa-IR'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript
      setInput((prev) => (prev ? prev + ' ' + transcript : transcript))
    }
    recognition.onerror = () => {
      // fallback to en-US
      recognition.lang = 'en-US'
      try { recognition.start() } catch { setListening(false) }
    }
    recognition.onend = () => setListening(false)

    try {
      recognition.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  const handleSubmit = async () => {
    const text = input.trim()
    if (!text) return
    setLoading(true)
    setError(null)
    try {
      const analysis = await analyzeMeal(text, goal)
      const meal: MealLog = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        description: text,
        analysis,
      }
      addMealToToday(meal)
      onMealAdded(meal)
      setInput('')
    } catch {
      setError('مشکلی پیش آمد. دوباره امتحان کن.')
    } finally {
      setLoading(false)
    }
  }

  const GOAL_LABEL: Record<Goal, string> = {
    lose_weight: 'کاهش وزن',
    maintain: 'حفظ وزن',
    eat_healthier: 'غذای سالم‌تر',
  }

  return (
    <div className="min-h-screen bg-green-50 flex flex-col max-w-sm mx-auto relative">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-lg font-bold text-green-700">خوراک‌یار</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSummary(true)}
            className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-medium hover:bg-green-200 transition-colors"
          >
            خلاصه‌ی امروز
          </button>
          <button
            onClick={onChangeGoal}
            title="تغییر هدف"
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-full transition-colors"
          >
            {GOAL_LABEL[goal]}
          </button>
        </div>
      </header>

      {/* Meals list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {meals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <span className="text-5xl mb-3">🍽️</span>
            <p className="text-gray-400 text-sm">هنوز وعده‌ای ثبت نشده</p>
            <p className="text-gray-300 text-xs mt-1">چی خوردی؟ بنویس یا بگو</p>
          </div>
        ) : (
          meals.map((meal) => <MealCard key={meal.id} meal={meal} />)
        )}
        <div ref={listEndRef} />
      </div>

      {/* Input area */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 sticky bottom-0">
        {error && (
          <p className="text-orange-600 text-xs mb-2 text-center">{error}</p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            dir="auto"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="چی خوردی؟ مثلاً: یه بشقاب برنج با مرغ و سالاد"
            rows={2}
            className="flex-1 resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-green-400 leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
          />
          {hasSpeechRecognition && (
            <button
              onClick={listening ? stopListening : startListening}
              className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                listening
                  ? 'bg-orange-400 text-white animate-pulse'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={listening ? 'توقف ضبط' : 'ضبط صدا'}
            >
              🎙️
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-11 h-11 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            title="ثبت وعده"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            )}
          </button>
        </div>
        {!hasSpeechRecognition && (
          <p className="text-xs text-gray-300 mt-1 text-center">
            مرورگر شما از ورود صوتی پشتیبانی نمی‌کند
          </p>
        )}
      </div>

      {showSummary && (
        <DailySummary meals={meals} goal={goal} onClose={() => setShowSummary(false)} />
      )}
    </div>
  )
}
