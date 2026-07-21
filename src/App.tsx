import { useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView'
import SearchBar from './components/SearchBar'
import AqiGauge from './components/AqiGauge'
import DivergenceBanner from './components/DivergenceBanner'
import StatStrip from './components/StatStrip'
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
import { detectDivergence, summarizeDivergence } from './services/divergence'
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

  // Cross-checks official AirNow readings against nearby PurpleAir sensors
  // — flags sensors reading notably worse than the nearest official
  // station, a signal official data (updated hourly) hasn't caught up to
  // yet. Skipped on sample data for the same reason the AI summary call
  // is: no point flagging "divergence" between two sets of made-up numbers.
  const divergenceAlerts = useMemo(() => {
    if (air.usingSampleData || air.purpleAirUsingSampleData) return []
    return detectDivergence(air.aqiReadings, air.purpleAirReadings)
  }, [air.usingSampleData, air.purpleAirUsingSampleData, air.aqiReadings, air.purpleAirReadings])

  const divergenceNote = useMemo(() => summarizeDivergence(divergenceAlerts), [divergenceAlerts])

  const divergentSensorIds = useMemo(
    () => new Set(divergenceAlerts.map((a) => a.sensor.id)),
    [divergenceAlerts]
  )

  const summary = useSummary(
    air.stats.currentAqi,
    air.alert.level,
    air.stats.forecastPeakAqi,
    healthProfile,
    air.usingSampleData,
    selectedRegion?.reading ?? null,
    selectedRegion?.step ?? null,
    divergenceNote
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
  const alertsNeedAttention =
    (air.alert.level !== 'good' || divergenceAlerts.length > 0) && activeTab !== 'alerts'

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-200 dark:bg-night-900 p-0 sm:p-6 transition-colors">
      <div className="w-full sm:max-w-[390px] sm:h-[780px] sm:rounded-[28px] sm:border sm:border-ink-400 dark:sm:border-night-500 overflow-hidden bg-white dark:bg-night-800 flex flex-col transition-colors">
        {/* Blue chrome, modeled on AirNow's persistent blue top bar — stays
            on every tab (not just the map) so the app has one consistent
            branded frame, with the AqiGauge continuing this exact gradient
            (see AqiGauge.tsx) into one seamless panel on the map tab. */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-b from-[#1C5D99] to-[#2E6DA4] dark:from-[#0A2238] dark:to-[#0F2A47]">
          <span className="text-xs text-white/70">9:41</span>
          <span className="text-sm font-semibold text-white tracking-wide">AirTrack</span>
          <div className="flex items-center gap-1">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-white/85">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9ZM13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
        </div>

        {activeTab === 'map' && (
          <div className="flex-1 overflow-y-auto">
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
            <DivergenceBanner alerts={divergenceAlerts} />

            {/* One-line orientation for what the map underneath actually
                does — without it, the colored dots/polygons have no
                explained affordance until someone happens to tap one. */}
            <p className="px-4 pt-2.5 pb-1.5 text-[11px] text-ink-400 dark:text-night-400 m-0">
              Tap a colored dot for station details · switch layers above the map
            </p>

            <MapView
              aqiReadings={air.aqiReadings}
              fieldReports={air.fieldReports}
              smokePolygons={air.smokePolygons}
              purpleAirReadings={air.purpleAirReadings}
              divergentSensorIds={divergentSensorIds}
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
          </div>
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
            center={air.center}
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
