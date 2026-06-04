import type { MealLog } from '../lib/types'

interface Props {
  meal: MealLog
}

const FIT_CONFIG = {
  good:      { dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700',  label: 'عالی' },
  okay:      { dot: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-700', label: 'قابل‌قبول' },
  watch_out: { dot: 'bg-orange-400', badge: 'bg-orange-100 text-orange-700', label: 'توجه' },
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
}

export default function MealCard({ meal }: Props) {
  const { analysis } = meal
  const fit = FIT_CONFIG[analysis.fit_with_goal]

  return (
    <div className="py-4 border-b border-gray-100 last:border-0">
      {/* Row 1: time + description + badge */}
      <div className="flex items-start gap-2 mb-2">
        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${fit.dot}`} />
        <p dir="auto" className="flex-1 text-sm font-medium text-gray-800 leading-snug">
          {meal.description}
        </p>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${fit.badge}`}>{fit.label}</span>
          <span className="text-[10px] text-gray-400">{formatTime(meal.timestamp)}</span>
        </div>
      </div>

      {/* Row 2: cal + protein chips */}
      <div className="flex gap-2 mr-4 mb-2">
        <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
          ~{analysis.calories_estimate} کال
        </span>
        <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
          ~{analysis.protein_estimate}g پروتئین
        </span>
      </div>

      {/* Row 3: coaching */}
      <div className="mr-4 bg-gray-50 rounded-xl px-3 py-2.5 text-xs text-gray-600 leading-relaxed" dir="rtl">
        {analysis.coaching || analysis.suggestion}
      </div>

      {analysis.is_mock && (
        <span className="text-[9px] text-gray-200 block text-left mt-1">mock</span>
      )}
    </div>
  )
}
