// Saved health profile — feeds the Alerts tab's suggested threshold and the
// AI plain-language summary's personalization. Stored client-side only
// (localStorage); never sent anywhere except as part of a /api/summary
// request body when generating a summary.
const STORAGE_KEY = 'airtrack:healthProfile'

export type HealthCondition =
  | 'asthma'
  | 'heart_or_lung_disease'
  | 'older_adult'
  | 'child'
  | 'pregnant'
  | 'outdoor_worker'

export const HEALTH_CONDITIONS: { id: HealthCondition; label: string }[] = [
  { id: 'asthma', label: 'Asthma or another respiratory condition' },
  { id: 'heart_or_lung_disease', label: 'Heart or lung disease' },
  { id: 'older_adult', label: 'Older adult (65+)' },
  { id: 'child', label: 'Young child in the household' },
  { id: 'pregnant', label: 'Pregnant' },
  { id: 'outdoor_worker', label: 'Works outdoors regularly' }
]

export interface HealthProfile {
  conditions: HealthCondition[]
}

const DEFAULT_PROFILE: HealthProfile = { conditions: [] }

export function loadHealthProfile(): HealthProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PROFILE
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.conditions)) return DEFAULT_PROFILE
    return { conditions: parsed.conditions }
  } catch {
    return DEFAULT_PROFILE
  }
}

export function saveHealthProfile(profile: HealthProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // Best-effort — localStorage may be unavailable (private mode, quota).
  }
}

/** Whether the saved profile puts this person in any EPA "sensitive group". */
export function isSensitiveGroup(profile: HealthProfile): boolean {
  return profile.conditions.length > 0
}
