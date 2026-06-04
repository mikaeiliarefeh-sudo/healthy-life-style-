import { useState, useRef, useEffect } from 'react'
import type { Goal, Goals, MealLog, UserProfile } from '../lib/types'
import { analyzeMeal } from '../lib/claude'
import { addMealToToday, getStreak } from '../lib/storage'
import { calcDayScore, scoreLabel, mealToast } from '../lib/score'
import { getTargets } from '../lib/profile'
import MealCard from './MealCard'
import DailySummary from './DailySummary'

interface Props {
  goals: Goals
  meals: MealLog[]
  profile: UserProfile | null
  onMealAdded: (meal: MealLog) => void
  onChangeGoal: () => void
  onOpenProfile: () => void
}

const GOAL_LABEL: Record<Goal, string> = {
  lose_weight: 'کاهش وزن',
  maintain: 'حفظ وزن',
  eat_healthier: 'غذای سالم‌تر',
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

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5">
      <div
        className={`h-1.5 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function MealLogger({ goals, meals, profile, onMealAdded, onChangeGoal, onOpenProfile }: Props) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const streak = getStreak()
  const recognitionRef = useRef<RecognitionInstance | null>(null)
  const listEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [meals])

  // Use targets from the first (primary) goal
  const targets = getTargets(profile, goals)
  const totalCal = meals.reduce((s, m) => s + m.analysis.calories_estimate, 0)
  const totalProtein = meals.reduce((s, m) => s + m.analysis.protein_estimate, 0)
  const calRemaining = Math.max(0, targets.cal - totalCal)
  const dayScore = calcDayScore(meals)
  const sl = scoreLabel(dayScore)

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
      recognition.lang = 'en-US'
      try { recognition.start() } catch { setListening(false) }
    }
    recognition.onend = () => setListening(false)
    try { recognition.start(); setListening(true) } catch { setListening(false) }
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  const handleSubmit = async () => {
    const text = input.trim()
    if (!text || loading) return
    setLoading(true)
    setError(null)
    try {
      const analysis = await analyzeMeal(text, goals, profile)
      const meal: MealLog = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        description: text,
        analysis,
      }
      addMealToToday(meal)
      onMealAdded(meal)
      setInput('')
      textareaRef.current?.focus()
      const msg = mealToast(analysis.fit_with_goal)
      setToast(msg)
      setTimeout(() => setToast(null), 2200)
    } catch {
      setError('مشکلی پیش آمد. دوباره امتحان کن.')
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toLocaleDateString('fa-IR', { weekday: 'long', month: 'long', day: 'numeric' })
  const goalsLabel = goals.map((g) => GOAL_LABEL[g]).join(' + ')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-sm mx-auto">
      {/* Header */}
      <header className="bg-white px-4 pt-3 pb-3 sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-gray-900">قلیز هلثی لایف</h1>
            {streak > 1 && (
              <span className="text-xs bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full font-medium">
                🔥 {streak} روز
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {profile && (
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                {profile.weight_kg}kg
              </span>
            )}
            <button
              onClick={onOpenProfile}
              className="text-gray-400 hover:text-green-600 transition-colors"
              title="پروفایل"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={onChangeGoal}
              className="text-xs text-green-600 bg-green-50 px-3 py-1 rounded-full font-medium"
            >
              {goalsLabel}
            </button>
          </div>
        </div>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* Summary card — top, always visible */}
        <div className="mx-4 mt-4 mb-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400">{today}</span>
            {meals.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${sl.ring}`} />
                <span className={`text-xs font-bold ${sl.color}`}>{dayScore}</span>
                <span className={`text-xs ${sl.color}`}>{sl.text}</span>
              </div>
            )}
          </div>

          {/* Big numbers */}
          <div className="flex gap-3 mb-3">
            <div className="flex-1 bg-green-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-green-700">
                {totalCal > 0 ? `~${totalCal}` : '—'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">کالری امروز</div>
            </div>
            <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {totalProtein > 0 ? `~${totalProtein}g` : '—'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">پروتئین</div>
            </div>
          </div>

          {/* Progress bars */}
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">کالری</span>
                <span className="text-gray-400">{calRemaining > 0 ? `${calRemaining} باقی‌مانده` : 'رسیدی!'} / {targets.cal}</span>
              </div>
              <ProgressBar value={totalCal} max={targets.cal} color="bg-green-500" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">پروتئین</span>
                <span className="text-gray-400">{targets.protein}g هدف</span>
              </div>
              <ProgressBar value={totalProtein} max={targets.protein} color="bg-blue-400" />
            </div>
          </div>

          {meals.length > 0 && (
            <button
              onClick={() => setShowSummary(true)}
              className="mt-3 w-full text-xs text-green-600 hover:text-green-700 font-medium border border-green-100 rounded-xl py-2 hover:bg-green-50 transition-colors"
            >
              خلاصه‌ی کامل روز ←
            </button>
          )}
        </div>

        {/* Meal list — scroll to see detail */}
        <div className="px-4 pb-4">
          {meals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <span className="text-4xl mb-3">🍽️</span>
              <p className="text-gray-400 text-sm">هنوز چیزی ثبت نشده</p>
              <p className="text-gray-300 text-xs mt-1">هر چیزی خوردی بنویس یا بگو</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl px-4 shadow-sm border border-gray-100">
              {meals.map((meal) => (
                <MealCard key={meal.id} meal={meal} />
              ))}
            </div>
          )}
          <div ref={listEndRef} className="h-2" />
        </div>

      </div>

      {/* Input area */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 sticky bottom-0">
        {error && (
          <p className="text-orange-500 text-xs mb-2 text-center">{error}</p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            dir="auto"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="چی خوردی؟ مثلاً: نیمرو با نان، یه لیوان شیر"
            rows={2}
            className="flex-1 resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-green-400 leading-relaxed bg-gray-50"
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
                listening ? 'bg-orange-400 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              🎙️
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-11 h-11 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 disabled:opacity-40 transition-all active:scale-95"
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
      </div>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-2.5 rounded-full shadow-lg whitespace-nowrap">
          {toast}
        </div>
      )}

      {showSummary && (
        <DailySummary meals={meals} goals={goals} onClose={() => setShowSummary(false)} />
      )}
    </div>
  )
}
