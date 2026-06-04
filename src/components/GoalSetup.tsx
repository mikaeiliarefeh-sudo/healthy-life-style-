import { useState } from 'react'
import type { Goal, Goals } from '../lib/types'

interface Props {
  onGoalsSelected: (goals: Goals) => void
}

const GOALS: { value: Goal; emoji: string; title: string; subtitle: string }[] = [
  {
    value: 'lose_weight',
    emoji: '🌱',
    title: 'کاهش وزن',
    subtitle: 'می‌خوام آروم‌آروم وزنم رو کم کنم',
  },
  {
    value: 'maintain',
    emoji: '⚖️',
    title: 'حفظ وزن',
    subtitle: 'می‌خوام وزنم رو ثابت نگه دارم',
  },
  {
    value: 'eat_healthier',
    emoji: '🥗',
    title: 'غذای سالم‌تر',
    subtitle: 'می‌خوام انتخاب‌های غذایی بهتری داشته باشم',
  },
]

export default function GoalSetup({ onGoalsSelected }: Props) {
  const [selected, setSelected] = useState<Goals>([])

  const toggle = (g: Goal) => {
    setSelected((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    )
  }

  return (
    <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-green-700 text-center mb-1">جینگیلی</h1>
        <p className="text-gray-500 text-center mb-2 text-sm">
          هدف‌هات رو انتخاب کن (می‌تونی بیشتر از یکی انتخاب کنی)
        </p>
        <p className="text-xs text-gray-400 text-center mb-6">تا ۲ هدف انتخاب کن</p>

        <div className="flex flex-col gap-3 mb-6">
          {GOALS.map((g) => {
            const isSelected = selected.includes(g.value)
            const isDisabled = !isSelected && selected.length >= 2
            return (
              <button
                key={g.value}
                onClick={() => !isDisabled && toggle(g.value)}
                className={`rounded-2xl border p-5 flex items-center gap-4 text-right transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-green-500 border-green-500 shadow-md'
                    : isDisabled
                    ? 'bg-white border-gray-100 opacity-40 cursor-not-allowed'
                    : 'bg-white border-green-100 shadow-sm hover:border-green-400 hover:shadow-md'
                }`}
              >
                <span className="text-4xl">{g.emoji}</span>
                <div className="flex-1">
                  <div className={`font-semibold text-lg ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                    {g.title}
                  </div>
                  <div className={`text-sm mt-0.5 ${isSelected ? 'text-green-100' : 'text-gray-500'}`}>
                    {g.subtitle}
                  </div>
                </div>
                {isSelected && (
                  <span className="text-white text-xl flex-shrink-0">✓</span>
                )}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => selected.length > 0 && onGoalsSelected(selected)}
          disabled={selected.length === 0}
          className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all active:scale-95 text-base"
        >
          {selected.length === 0 ? 'یه هدف انتخاب کن' : `شروع کن (${selected.length} هدف)`}
        </button>

        <p className="text-xs text-gray-400 text-center mt-4">
          این انتخاب رو بعداً هم می‌تونی عوض کنی
        </p>
      </div>
    </div>
  )
}
