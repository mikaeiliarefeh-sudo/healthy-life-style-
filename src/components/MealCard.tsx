import type { MealLog } from '../lib/types'

interface Props {
  meal: MealLog
}

const FIT_CONFIG = {
  good: { label: 'عالی', bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  okay: { label: 'قابل‌قبول', bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  watch_out: { label: 'توجه کن', bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400' },
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
}

export default function MealCard({ meal }: Props) {
  const { analysis } = meal
  const fit = FIT_CONFIG[analysis.fit_with_goal]

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-3">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p dir="auto" className="text-gray-800 font-medium flex-1 leading-relaxed">
          {meal.description}
        </p>
        <span className="text-xs text-gray-400 whitespace-nowrap mt-0.5">{formatTime(meal.timestamp)}</span>
      </div>

      <div className="flex gap-3 mb-3">
        <div className="bg-green-50 rounded-xl px-3 py-2 text-center flex-1">
          <div className="text-lg font-bold text-green-700">~{analysis.calories_estimate}</div>
          <div className="text-xs text-gray-500">کالری (تقریبی)</div>
        </div>
        <div className="bg-blue-50 rounded-xl px-3 py-2 text-center flex-1">
          <div className="text-lg font-bold text-blue-700">~{analysis.protein_estimate}g</div>
          <div className="text-xs text-gray-500">پروتئین (تقریبی)</div>
        </div>
        <div className={`${fit.bg} rounded-xl px-3 py-2 text-center flex-1`}>
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <span className={`inline-block w-2 h-2 rounded-full ${fit.dot}`}></span>
          </div>
          <div className={`text-xs font-medium ${fit.text}`}>{fit.label}</div>
        </div>
      </div>

      <p dir="auto" className="text-sm text-gray-600 mb-1">{analysis.fit_sentence}</p>
      <p dir="auto" className="text-sm text-gray-500 italic">{analysis.suggestion}</p>

      {analysis.is_mock && (
        <p className="text-xs text-gray-300 mt-2 text-left">mock data</p>
      )}
    </div>
  )
}
