import type { MealLog } from '../lib/types'

interface Props {
  meal: MealLog
}

const FIT_DOT: Record<string, string> = {
  good: 'bg-green-500',
  okay: 'bg-yellow-400',
  watch_out: 'bg-orange-400',
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
}

export default function MealCard({ meal }: Props) {
  const { analysis } = meal

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      {/* time + dot */}
      <div className="flex flex-col items-center gap-1 pt-1 min-w-[36px]">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${FIT_DOT[analysis.fit_with_goal]}`} />
        <span className="text-[10px] text-gray-400 leading-none">{formatTime(meal.timestamp)}</span>
      </div>

      {/* description + numbers */}
      <div className="flex-1 min-w-0">
        <p dir="auto" className="text-sm text-gray-800 leading-snug mb-1 truncate">
          {meal.description}
        </p>
        <div className="flex gap-3 text-xs text-gray-500">
          <span>~{analysis.calories_estimate} کال</span>
          <span>~{analysis.protein_estimate}g پروتئین</span>
        </div>
        {analysis.suggestion && (
          <p dir="auto" className="text-xs text-gray-400 mt-1 leading-snug">{analysis.suggestion}</p>
        )}
      </div>

      {analysis.is_mock && (
        <span className="text-[9px] text-gray-200 self-start mt-1">mock</span>
      )}
    </div>
  )
}
