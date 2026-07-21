import { FieldReport } from '../types'

function timeAgo(minutes: number) {
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  return `${hours} hr ago`
}

export default function ReportsList({ reports }: { reports: FieldReport[] }) {
  return (
    <div className="px-4 py-3">
      <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0 mb-2">Nearby reports</p>
      <div className="flex flex-col">
        {reports.map((report, i) => (
          <div
            key={report.id}
            className={`flex gap-2.5 items-center py-2 ${i < reports.length - 1 ? 'border-b border-ink-200 dark:border-night-600' : ''}`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-ink-600 dark:text-night-200 shrink-0"
            >
              {report.kind === 'fire' ? (
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
              ) : (
                <path d="M17.5 19a4.5 4.5 0 1 0-1.44-8.765 5 5 0 1 0-9.14 4.05A4 4 0 0 0 8 19h9.5Z" />
              )}
            </svg>
            <div>
              <p className="text-sm text-ink-900 dark:text-night-100 m-0">{report.title}</p>
              <p className="text-xs text-ink-400 dark:text-night-400 m-0">{timeAgo(report.updatedMinutesAgo)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
