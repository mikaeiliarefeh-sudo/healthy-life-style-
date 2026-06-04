import type { MealLog, Goals } from '../lib/types'
import { calcDayScore, scoreLabel } from '../lib/score'
import { getStreak } from '../lib/storage'

interface Props {
  meals: MealLog[]
  goals: Goals
  onClose: () => void
}

const SCORE_ENCOURAGEMENT: Array<{ min: number; text: string }> = [
  { min: 80, text: 'امروز واقعاً خوب بودی. همین روند رو ادامه بده! 🌟' },
  { min: 60, text: 'روز خوبی داشتی. یه قدم کوچیک مونده که عالی بشه 💪' },
  { min: 40, text: 'مشکلی نیست — فردا یه شروع تازه‌ست. همین که ثبت کردی مهمه 🌱' },
  { min: 0,  text: 'شروع کردی — این مهم‌ترین قدمه. فردا بهتر میشه 😊' },
]

export default function DailySummary({ meals, goals: _goals, onClose }: Props) {
  const totalCal = meals.reduce((s, m) => s + m.analysis.calories_estimate, 0)
  const totalProtein = meals.reduce((s, m) => s + m.analysis.protein_estimate, 0)
  const score = calcDayScore(meals)
  const sl = scoreLabel(score)
  const streak = getStreak()
  const encouragement = SCORE_ENCOURAGEMENT.find((e) => score >= e.min)!.text

  const goodCount = meals.filter((m) => m.analysis.fit_with_goal === 'good').length
  const okayCount = meals.filter((m) => m.analysis.fit_with_goal === 'okay').length
  const watchCount = meals.filter((m) => m.analysis.fit_with_goal === 'watch_out').length

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 px-4 pb-6">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl">
        <h2 className="text-lg font-bold text-gray-800 text-center mb-4">خلاصه‌ی امروز</h2>

        {meals.length === 0 ? (
          <p className="text-center text-gray-400 py-6">هنوز وعده‌ای ثبت نشده</p>
        ) : (
          <>
            {/* Score circle */}
            <div className="flex flex-col items-center mb-5">
              <div className={`w-20 h-20 rounded-full ${sl.ring} flex items-center justify-center mb-2 shadow-md`}>
                <div className="w-16 h-16 bg-white rounded-full flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-gray-800">{score}</span>
                  <span className="text-[10px] text-gray-400">از ۱۰۰</span>
                </div>
              </div>
              <span className="text-sm font-semibold text-gray-700">{sl.emoji} {sl.text}</span>
              {streak > 1 && (
                <span className="text-xs text-orange-500 mt-1">🔥 {streak} روز پشت سر هم</span>
              )}
            </div>

            {/* Macros */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1 bg-green-50 rounded-2xl p-3 text-center">
                <div className="text-xl font-bold text-green-700">~{totalCal}</div>
                <div className="text-xs text-gray-500">کالری (تقریبی)</div>
              </div>
              <div className="flex-1 bg-blue-50 rounded-2xl p-3 text-center">
                <div className="text-xl font-bold text-blue-700">~{totalProtein}g</div>
                <div className="text-xs text-gray-500">پروتئین (تقریبی)</div>
              </div>
            </div>

            {/* Meal breakdown */}
            <div className="flex gap-2 mb-4 text-xs text-center">
              <div className="flex-1 bg-green-50 rounded-xl p-2">
                <div className="font-bold text-green-600 text-base">{goodCount}</div>
                <div className="text-gray-500">عالی</div>
              </div>
              <div className="flex-1 bg-yellow-50 rounded-xl p-2">
                <div className="font-bold text-yellow-600 text-base">{okayCount}</div>
                <div className="text-gray-500">قابل‌قبول</div>
              </div>
              <div className="flex-1 bg-orange-50 rounded-xl p-2">
                <div className="font-bold text-orange-500 text-base">{watchCount}</div>
                <div className="text-gray-500">توجه</div>
              </div>
            </div>

            {/* Encouragement */}
            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
              <p className="text-gray-700 text-sm text-center leading-relaxed">{encouragement}</p>
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
