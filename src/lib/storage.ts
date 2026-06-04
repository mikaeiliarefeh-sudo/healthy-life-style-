import type { Goal, MealLog, DayData } from './types'

const GOAL_KEY = 'khorak_goal'
const DAYS_KEY = 'khorak_days'

export function getGoal(): Goal | null {
  return (localStorage.getItem(GOAL_KEY) as Goal) || null
}

export function setGoal(goal: Goal): void {
  localStorage.setItem(GOAL_KEY, goal)
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
