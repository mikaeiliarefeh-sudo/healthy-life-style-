// Keywords that signal a new meal in Persian input
const MEAL_KEYWORDS = [
  'صبحانه', 'ناهار', 'شام', 'میان‌وعده', 'میان وعده',
  'عصرانه', 'صبح', 'شب', 'سحری', 'افطار',
]


export interface MealChunk {
  label: string   // e.g. "صبحانه"
  text: string    // food description
}

export function splitMealInput(input: string): MealChunk[] {
  const trimmed = input.trim()
  if (!trimmed) return []

  // Check if any meal keyword exists in the input
  const hasKeyword = MEAL_KEYWORDS.some((kw) => trimmed.includes(kw))
  if (!hasKeyword) {
    return [{ label: '', text: trimmed }]
  }

  // Split on meal keywords
  const parts = trimmed.split(/(?=\s*(صبحانه|ناهار|شام|میان‌وعده|میان وعده|عصرانه|صبح|شب|سحری|افطار)\s*[:،:]?)/)
  const chunks: MealChunk[] = []

  for (const part of parts) {
    const p = part.trim()
    if (!p) continue

    const match = p.match(/^(صبحانه|ناهار|شام|میان‌وعده|میان وعده|عصرانه|صبح|شب|سحری|افطار)\s*[:،:]?\s*(.+)/s)
    if (match) {
      chunks.push({ label: match[1], text: match[2].trim() })
    } else if (chunks.length === 0) {
      chunks.push({ label: '', text: p })
    }
  }

  return chunks.length > 0 ? chunks : [{ label: '', text: trimmed }]
}
