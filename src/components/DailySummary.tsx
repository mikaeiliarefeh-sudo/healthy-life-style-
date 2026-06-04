import type { MealLog, Goal } from '../lib/types'

interface Props {
  meals: MealLog[]
  goal: Goal
  onClose: () => void
}

const GOAL_ENCOURAGEMENT: Record<Goal, string> = {
  lose_weight: 'امروز یک قدم کوچک برای خودت برداشتی. همین کافیه! 🌱',
  maintain: 'تعادل خوبی داشتی امروز. ادامه بده! ⚖️',
  eat_healthier: 'هر انتخاب سالم، یک پیشرفت واقعیه. آفرین! 🥗',
}

export default function DailySummary({ meals, goal, onClose }: Props) {
  const totalCal = meals.reduce((s, m) => s + m.analysis.calories_estimate, 0)
  const totalProtein = meals.reduce((s, m) => s + m.analysis.protein_estimate, 0)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 px-4 pb-6">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl">
        <h2 className="text-xl font-bold text-gray-800 text-center mb-1">خلاصه‌ی امروز</h2>
        <p className="text-sm text-gray-400 text-center mb-6">
          {meals.length} وعده ثبت شده
        </p>

        {meals.length === 0 ? (
          <p className="text-center text-gray-500 py-4">هنوز وعده‌ای ثبت نشده</p>
        ) : (
          <>
            <div className="flex gap-4 mb-6">
              <div className="flex-1 bg-green-50 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-green-700">~{totalCal}</div>
                <div className="text-xs text-gray-500 mt-1">کل کالری (تقریبی)</div>
              </div>
              <div className="flex-1 bg-blue-50 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-700">~{totalProtein}g</div>
                <div className="text-xs text-gray-500 mt-1">کل پروتئین (تقریبی)</div>
              </div>
            </div>

            <div className="bg-green-50 rounded-2xl p-4 mb-6">
              <p className="text-green-800 text-sm text-center leading-relaxed">
                {GOAL_ENCOURAGEMENT[goal]}
              </p>
            </div>
          </>
        )}

        <button
          onClick={onClose}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-2xl transition-colors"
        >
          بستن
        </button>
      </div>
    </div>
  )
}
