import { ConditionAlert } from '../types'
import { aqiColor } from '../aqiColors'

export default function ConditionBanner({ alert }: { alert: ConditionAlert }) {
  const color = aqiColor[alert.level]
  return (
    <div className="flex gap-2.5 items-start px-4 py-3 border-b border-ink-200 dark:border-night-600" style={{ backgroundColor: `${color}1F` }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" className="mt-0.5 shrink-0">
        <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      </svg>
      <div>
        <p className="text-sm font-medium m-0" style={{ color }}>
          {alert.headline}
        </p>
        <p className="text-xs text-ink-600 dark:text-night-200 m-0 mt-0.5">{alert.detail}</p>
      </div>
    </div>
  )
}
