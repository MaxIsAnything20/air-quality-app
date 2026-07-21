import { HEALTH_CONDITIONS, HealthCondition, HealthProfile } from '../services/profile'

interface ProfileViewProps {
  profile: HealthProfile
  onChange: (profile: HealthProfile) => void
}

export default function ProfileView({ profile, onChange }: ProfileViewProps) {
  function toggle(condition: HealthCondition) {
    const has = profile.conditions.includes(condition)
    onChange({
      conditions: has
        ? profile.conditions.filter((c) => c !== condition)
        : [...profile.conditions, condition]
    })
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <h2 className="text-sm font-medium text-ink-900 dark:text-night-100 mb-1">Health profile</h2>
      <p className="text-xs text-ink-600 dark:text-night-200 mb-4">
        Saved on this device only. Used to personalize the plain-language summary and to suggest an
        alert threshold — nothing here is sent anywhere except as part of generating that summary.
      </p>

      <p className="text-xs font-medium text-ink-900 dark:text-night-100 mb-2">
        Do any of these apply to you or your household?
      </p>
      <div className="flex flex-col gap-2">
        {HEALTH_CONDITIONS.map((item) => {
          const checked = profile.conditions.includes(item.id)
          return (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className={`flex items-center gap-2.5 text-left text-xs px-3 py-2.5 rounded-xl border transition-colors ${
                checked
                  ? 'border-ink-900 dark:border-night-100 text-ink-900 dark:text-night-100 bg-ink-100 dark:bg-night-700'
                  : 'border-ink-200 dark:border-night-600 text-ink-600 dark:text-night-200'
              }`}
            >
              <span
                className={`shrink-0 w-4 h-4 rounded-md border flex items-center justify-center ${
                  checked
                    ? 'bg-ink-900 dark:bg-night-100 border-ink-900 dark:border-night-100'
                    : 'border-ink-300 dark:border-night-500'
                }`}
              >
                {checked && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-white dark:text-ink-900"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </span>
              {item.label}
            </button>
          )
        })}
      </div>

      {profile.conditions.length === 0 && (
        <p className="text-[11px] text-ink-400 dark:text-night-400 mt-4">
          Nothing selected — the summary and alerts will use general guidance instead of anything
          personalized.
        </p>
      )}
    </div>
  )
}
