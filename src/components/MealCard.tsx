import type { MealLog } from '../lib/types'

interface Props {
  meal: MealLog
}

const FIT_CONFIG = {
  good:      { label: 'عالی',       bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  okay:      { label: 'قابل‌قبول', bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  watch_out: { label: 'توجه کن',   bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400' },
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
}

export default function MealCard({ meal }: Props) {
  const { analysis } = meal
  const fit = FIT_CONFIG[analysis.fit_with_goal]

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-3">
      {/* Header: description + time */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <p dir="auto" className="text-gray-800 font-medium flex-1 leading-relaxed text-sm">
          {meal.description}
        </p>
        <span className="text-xs text-gray-400 whitespace-nowrap mt-0.5">{formatTime(meal.timestamp)}</span>
      </div>

      {/* Three metric boxes */}
      <div className="flex gap-2 mb-3">
        <div className="bg-green-50 rounded-xl px-3 py-2 text-center flex-1">
          <div className="text-lg font-bold text-green-700">~{analysis.calories_estimate}</div>
          <div className="text-[11px] text-gray-500">کالری (تقریبی)</div>
        </div>
        <div className="bg-blue-50 rounded-xl px-3 py-2 text-center flex-1">
          <div className="text-lg font-bold text-blue-600">~{analysis.protein_estimate}g</div>
          <div className="text-[11px] text-gray-500">پروتئین</div>
        </div>
        <div className={`${fit.bg} rounded-xl px-3 py-2 text-center flex-1`}>
          <div className="flex items-center justify-center mb-0.5">
            <span className={`w-2 h-2 rounded-full ${fit.dot}`} />
          </div>
          <div className={`text-[11px] font-semibold ${fit.text}`}>{fit.label}</div>
        </div>
      </div>

      {/* Coaching */}
      <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-xs text-gray-600 leading-relaxed" dir="rtl">
        {analysis.coaching || analysis.suggestion}
      </div>

      {analysis.is_mock && (
        <span className="text-[9px] text-gray-200 block text-left mt-1">mock</span>
      )}
    </div>
  )
}
