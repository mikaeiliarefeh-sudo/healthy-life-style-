import type { Goal } from '../lib/types'

interface Props {
  onGoalSelected: (goal: Goal) => void
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

export default function GoalSetup({ onGoalSelected }: Props) {
  return (
    <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-green-700 text-center mb-2">خوراک‌یار</h1>
        <p className="text-gray-500 text-center mb-8 text-sm">
          هدفت رو انتخاب کن تا بهتر کمکت کنم
        </p>
        <div className="flex flex-col gap-4">
          {GOALS.map((g) => (
            <button
              key={g.value}
              onClick={() => onGoalSelected(g.value)}
              className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 flex items-center gap-4 text-right hover:border-green-400 hover:shadow-md transition-all active:scale-95"
            >
              <span className="text-4xl">{g.emoji}</span>
              <div className="flex-1">
                <div className="font-semibold text-gray-800 text-lg">{g.title}</div>
                <div className="text-gray-500 text-sm mt-0.5">{g.subtitle}</div>
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 text-center mt-8">
          این انتخاب رو بعداً هم می‌تونی عوض کنی
        </p>
      </div>
    </div>
  )
}
