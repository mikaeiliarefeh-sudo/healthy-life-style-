export type Goal = 'lose_weight' | 'maintain' | 'eat_healthier'
export type Goals = Goal[]

export interface MealAnalysis {
  calories_estimate: number
  protein_estimate: number
  fit_with_goal: 'good' | 'okay' | 'watch_out'
  fit_sentence: string
  suggestion: string
  coaching: string
  is_mock: boolean
}

export interface MealLog {
  id: string
  timestamp: number
  description: string
  analysis: MealAnalysis
}

export interface DayData {
  date: string // YYYY-MM-DD
  meals: MealLog[]
}
