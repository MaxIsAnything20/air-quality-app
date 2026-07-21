import { useEffect, useState } from 'react'
import MapView from './components/MapView'
import SearchBar from './components/SearchBar'
import AqiGauge from './components/AqiGauge'
import StatStrip from './components/StatStrip'
import ReportsList from './components/ReportsList'
import BottomNav, { TabId } from './components/BottomNav'
import ThemeToggle from './components/ThemeToggle'
import HistoryView from './components/HistoryView'
import AlertsView from './components/AlertsView'
import ProfileView from './components/ProfileView'
import SummaryCard from './components/SummaryCard'
import { useTheme } from './hooks/useTheme'
import { useAirQuality } from './hooks/useAirQuality'
import { useSummary } from './hooks/useSummary'
import { useAlertNotifications } from './hooks/useAlertNotifications'
import { AlertSettings, loadAlertSettings, saveAlertSettings } from './services/alertSettings'
import { HealthProfile, isSensitiveGroup, loadHealthProfile, saveHealthProfile } from './services/profile'
import { RegionSelection } from './types'

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const air = useAirQuality()
  const [activeTab, setActiveTab] = useState<TabId>('map')
  // Read once up front (not a hook — just a plain value) so a first-time
  // alert threshold can be seeded from whatever profile is already saved,
  // instead of always defaulting to the non-sensitive preset.
  const initialProfile = loadHealthProfile()
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(() =>
    loadAlertSettings(isSensitiveGroup(initialProfile))
  )
  const [healthProfile, setHealthProfile] = useState<HealthProfile>(initialProfile)
  // Set by tapping an AQI circle on the map — the summary card then
  // describes that specific station instead of the overall location.
  // Carries the time-slider step it came from (today/tomorrow/a past
  // date) so the summary can say "was"/"is forecast to be" correctly
  // instead of always "is currently."
  const [selectedRegion, setSelectedRegion] = useState<RegionSelection | null>(null)

  // A new location (search or geolocation change) invalidates whatever
  // station was selected on the old map view.
  useEffect(() => {
    setSelectedRegion(null)
  }, [air.center[0], air.center[1]])

  // Only fires on real (non-sample) readings, so a demo/fallback AQI value
  // can never trigger a real browser notification.
  useAlertNotifications(air.usingSampleData ? null : air.stats.currentAqi, alertSettings)

  const summary = useSummary(
    air.stats.currentAqi,
    air.alert.level,
    air.stats.forecastPeakAqi,
    healthProfile,
    air.usingSampleData,
    selectedRegion?.reading ?? null,
    selectedRegion?.step ?? null
  )

  function handleAlertSettingsChange(next: AlertSettings) {
    setAlertSettings(next)
    saveAlertSettings(next)
  }

  function handleProfileChange(next: HealthProfile) {
    setHealthProfile(next)
    saveHealthProfile(next)
  }

  // Flags the Alerts tab with a dot whenever conditions are worth a look
  // and the user isn't already on that tab — a passive nudge instead of a
  // banner competing with the map for attention.
  const alertsNeedAttention = air.alert.level !== 'good' && activeTab !== 'alerts'

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-200 dark:bg-night-900 p-0 sm:p-6 transition-colors">
      <div className="w-full sm:max-w-[390px] sm:h-[780px] sm:rounded-[28px] sm:border sm:border-ink-400 dark:sm:border-night-500 overflow-hidden bg-white dark:bg-night-800 flex flex-col transition-colors">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-ink-200 dark:border-night-600">
          <span className="text-xs text-ink-400 dark:text-night-400">9:41</span>
          <span className="text-sm font-medium text-ink-900 dark:text-night-100">AirTrack</span>
          <div className="flex items-center gap-1">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-ink-600 dark:text-night-200">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9ZM13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
        </div>

        {activeTab === 'map' && (
          <>
            <SearchBar
              onSelectLocation={(result) =>
                air.searchLocation({ lat: result.lat, lng: result.lng }, result.label)
              }
              activeLabel={air.activeLocationLabel}
              onClear={air.clearLocationOverride}
            />

            {/* Sample-data notices moved below the search bar (they used to
                sit above everything, including the header's own tab
                content, pushing the map and gauge further down the screen
                on first load — a first-time user's very first impression
                of the app was a wall of grey warning text). They're still
                the first thing seen inside the map tab, just no longer
                ahead of the controls that let you act on them. */}
            {air.usingSampleData && air.status === 'error' && (
              <div className="px-4 py-2 text-xs text-ink-600 dark:text-night-200 bg-ink-100 dark:bg-night-700 border-b border-ink-200 dark:border-night-600">
                Showing sample data — {air.errorMessage ?? 'set AIRNOW_API_KEY on the server to see live conditions.'}
              </div>
            )}

            {!air.usingSampleData && air.smokeUsingSampleData && (
              <div className="px-4 py-2 text-xs text-ink-600 dark:text-night-200 bg-ink-100 dark:bg-night-700 border-b border-ink-200 dark:border-night-600">
                Showing sample smoke data — NOAA feed unreachable.
              </div>
            )}

            {!air.usingSampleData && air.fireUsingSampleData && (
              <div className="px-4 py-2 text-xs text-ink-600 dark:text-night-200 bg-ink-100 dark:bg-night-700 border-b border-ink-200 dark:border-night-600">
                Showing sample fire data — NOAA feed unreachable.
              </div>
            )}

            {!air.usingSampleData && air.purpleAirUsingSampleData && (
              <div className="px-4 py-2 text-xs text-ink-600 dark:text-night-200 bg-ink-100 dark:bg-night-700 border-b border-ink-200 dark:border-night-600">
                {air.purpleAirMissingKey
                  ? 'Showing sample PurpleAir data — set PURPLEAIR_API_KEY on the server to see real sensors nearby.'
                  : 'Showing sample PurpleAir data — request failed.'}
              </div>
            )}

            {/* AqiGauge replaces the old ConditionBanner: one dial owns the
                "what's the number and what does it mean" job instead of
                splitting it across a colored strip here and a repeated
                number in StatStrip below. It's the first thing after the
                search bar, since it's the single fact this app exists to
                answer. */}
            <AqiGauge value={air.stats.currentAqi} level={air.alert.level} detail={air.alert.detail} />

            <MapView
              aqiReadings={air.aqiReadings}
              fieldReports={air.fieldReports}
              smokePolygons={air.smokePolygons}
              purpleAirReadings={air.purpleAirReadings}
              center={air.center}
              pastMapDates={air.pastMapDates}
              getMapSnapshotForDate={air.getMapSnapshotForDate}
              tomorrowAqiReadings={air.tomorrowAqiReadings}
              selectedRegion={selectedRegion}
              onSelectRegion={setSelectedRegion}
            />
            <StatStrip stats={air.stats} />
            <SummaryCard
              summary={summary.summary}
              loading={summary.loading}
              usingFallback={summary.usingFallback}
              region={selectedRegion?.reading ?? null}
              step={selectedRegion?.step ?? null}
              onClearRegion={() => setSelectedRegion(null)}
            />
            <div className="flex-1 overflow-y-auto">
              <ReportsList reports={air.fieldReports} />
            </div>
          </>
        )}

        {activeTab === 'history' && (
          <HistoryView
            monthlyHistory={air.monthlyHistory}
            stats={air.stats}
            usingSampleData={air.historyUsingSampleData}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsView
            settings={alertSettings}
            onChange={handleAlertSettingsChange}
            sensitiveProfile={isSensitiveGroup(healthProfile)}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView profile={healthProfile} onChange={handleProfileChange} />
        )}

        <BottomNav active={activeTab} onChange={setActiveTab} badges={{ alerts: alertsNeedAttention }} />
      </div>
    </div>
  )
}
