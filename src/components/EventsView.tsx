import { useState } from 'react'
import ScreenHeader from './ScreenHeader'

interface EventsViewProps {
  onBack: () => void
}

type EventsTab = 'upcoming' | 'past'

/**
 * Events (air quality context for gatherings you attend) is unbuilt —
 * this is a UI-only placeholder matching the reference app's own empty
 * state, including its Upcoming/Past toggle, rather than a fake list.
 */
export default function EventsView({ onBack }: EventsViewProps) {
  const [tab, setTab] = useState<EventsTab>('upcoming')

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="Events" onBack={onBack} />

      <div className="px-4 pt-4">
        <div className="flex bg-ink-100 dark:bg-night-700 rounded-full p-1">
          {(['upcoming', 'past'] as EventsTab[]).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 text-sm font-medium py-1.5 rounded-full capitalize transition-colors ${
                tab === id
                  ? 'bg-[#1F4D3A] dark:bg-[#0D2A1E] text-white'
                  : 'text-ink-600 dark:text-night-200'
              }`}
            >
              {id}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-3">
        <span className="w-14 h-14 rounded-full bg-ink-100 dark:bg-night-700 flex items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-ink-400 dark:text-night-400">
            <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          </svg>
        </span>
        <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">
          No {tab === 'upcoming' ? 'upcoming' : 'past'} events
        </p>
        <p className="text-xs text-ink-400 dark:text-night-400 m-0">
          New events near you will appear here.
        </p>
      </div>
    </div>
  )
}
