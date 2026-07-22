import { HealthProfile } from '../services/profile'
import ScreenHeader from './ScreenHeader'
import ProfileView from './ProfileView'

interface SettingsHealthProfileViewProps {
  onBack: () => void
  profile: HealthProfile
  onProfileChange: (profile: HealthProfile) => void
}

/**
 * Not a screen the reference app has — its health-condition questions
 * are folded into onboarding instead of living in Settings. Keeping it
 * here as its own row is a deliberate, original difference: it gives an
 * always-editable, revisitable home for the one thing in this app that
 * actually changes what advice you get.
 */
export default function SettingsHealthProfileView({
  onBack,
  profile,
  onProfileChange,
}: SettingsHealthProfileViewProps) {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="Health profile" onBack={onBack} />
      <ProfileView profile={profile} onChange={onProfileChange} />
    </div>
  )
}
