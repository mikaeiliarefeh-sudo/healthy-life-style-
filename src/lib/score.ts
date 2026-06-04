import type { MealLog } from './types'

const FIT_POINTS: Record<string, number> = { good: 3, okay: 2, watch_out: 1 }

export function calcDayScore(meals: MealLog[]): number {
  if (meals.length === 0) return 0
  const total = meals.reduce((s, m) => s + (FIT_POINTS[m.analysis.fit_with_goal] ?? 1), 0)
  return Math.round((total / (meals.length * 3)) * 100)
}

export function scoreLabel(score: number): { emoji: string; text: string; color: string; ring: string } {
  if (score >= 80) return { emoji: '🌟', text: 'عالی', color: 'text-green-600', ring: 'bg-green-500' }
  if (score >= 60) return { emoji: '👍', text: 'خوب', color: 'text-lime-600', ring: 'bg-lime-400' }
  if (score >= 40) return { emoji: '💪', text: 'تلاش کن', color: 'text-yellow-600', ring: 'bg-yellow-400' }
  return { emoji: '🔄', text: 'شروع کن', color: 'text-gray-400', ring: 'bg-gray-300' }
}

export function mealToast(fit: 'good' | 'okay' | 'watch_out'): string {
  const messages = {
    good: ['آفرین! ✨', 'عالی بود 🌿', 'انتخاب خوبی داشتی 👌'],
    okay: ['ثبت شد 👍', 'قابل‌قبوله', 'خوبه، ادامه بده'],
    watch_out: ['ثبت شد 📝', 'مشکلی نیست، وعده بعدی سبک‌تر', 'گاهی هم میشه 😊'],
  }
  const arr = messages[fit]
  return arr[Math.floor(Math.random() * arr.length)]
}
