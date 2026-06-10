import type { Goals, MealLog, DayData, UserProfile } from './types'

const GOAL_KEY = 'khorak_goal'
const DAYS_KEY = 'khorak_days'
const PROFILE_KEY = 'qaliz_profile'
const MOTIVATION_KEY = 'khorak_motivation'

export function getGoals(): Goals | null {
  try {
    const raw = localStorage.getItem(GOAL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return null
  }
}

export function setGoals(goals: Goals): void {
  localStorage.setItem(GOAL_KEY, JSON.stringify(goals))
}

export function getMotivation(): string {
  return localStorage.getItem(MOTIVATION_KEY) || ''
}

export function setMotivation(text: string): void {
  localStorage.setItem(MOTIVATION_KEY, text)
}

export function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function getAllDays(): DayData[] {
  try {
    return JSON.parse(localStorage.getItem(DAYS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveAllDays(days: DayData[]): void {
  localStorage.setItem(DAYS_KEY, JSON.stringify(days))
}

export function getTodayData(): DayData {
  const today = getTodayDate()
  const days = getAllDays()
  return days.find((d) => d.date === today) || { date: today, meals: [] }
}

export function getStreak(): number {
  const days = getAllDays()
  if (days.length === 0) return 0
  const today = getTodayDate()
  let streak = 0
  const d = new Date(today)
  while (true) {
    const dateStr = d.toISOString().slice(0, 10)
    const found = days.find((x) => x.date === dateStr && x.meals.length > 0)
    if (!found) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

export function getProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setProfile(p: UserProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
}

export function addMealToToday(meal: MealLog): void {
  const today = getTodayDate()
  const days = getAllDays()
  const idx = days.findIndex((d) => d.date === today)
  if (idx >= 0) {
    days[idx].meals.push(meal)
  } else {
    days.push({ date: today, meals: [meal] })
  }
  saveAllDays(days)
}
