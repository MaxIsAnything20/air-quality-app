import { useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView'
import SearchBar from './components/SearchBar'
import AqiGauge from './components/AqiGauge'
import DivergenceBanner from './components/DivergenceBanner'
import StatStrip from './components/StatStrip'
import ThemeToggle from './components/ThemeToggle'
import HistoryView from './components/HistoryView'
import SummaryCard from './components/SummaryCard'
import ActivityView from './components/ActivityView'
import HomeView from './components/HomeView'
import HamburgerMenu, { ScreenId } from './components/HamburgerMenu'
import ScreenHeader from './components/ScreenHeader'
import MyActivitiesView from './components/MyActivitiesView'
import GroupsView from './components/GroupsView'
import IndoorAirView from './components/IndoorAirView'
import EventsView from './components/EventsView'
import RoutePlanningView from './components/RoutePlanningView'
import AirQualityForecastView from './components/AirQualityForecastView'
import SettingsView from './components/SettingsView'
import SettingsProfileView from './components/SettingsProfileView'
import SettingsHealthProfileView from './components/SettingsHealthProfileView'
import SettingsAutoTrackView from './components/SettingsAutoTrackView'
import SettingsSensorsView from './components/SettingsSensorsView'
import SettingsLocationsView from './components/SettingsLocationsView'
import SettingsConnectionsView from './components/SettingsConnectionsView'
import SettingsNotificationsView from './components/SettingsNotificationsView'
import SettingsCommunicationView from './components/SettingsCommunicationView'
import PaywallView from './components/PaywallView'
import { useTheme } from './hooks/useTheme'
import { useAirQuality } from './hooks/useAirQuality'
import { useSummary } from './hooks/useSummary'
import { useAlertNotifications } from './hooks/useAlertNotifications'
import { useActivityTracking } from './hooks/useActivityTracking'
import { AlertSettings, loadAlertSettings, saveAlertSettings } from './services/alertSettings'
import { HealthProfile, isSensitiveGroup, loadHealthProfile, saveHealthProfile } from './services/profile'
import { detectDivergence, summarizeDivergence } from './services/divergence'
import { getRecentDailyHistory } from './services/historyLog'
import { computeExposureScore } from './services/exposureScore'
import { computeActivityStreak, hasEarnedFirstActivityBadge } from './services/streak'
import { RegionSelection } from './types'

const EXPOSURE_SCORE_WINDOW_DAYS = 7

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const air = useAirQuality()
  // Foreground-only web tracking (see hooks/useActivityTracking.ts) — the
  // AQI readings feed lets each logged GPS point be paired with the
  // nearest station's value as the activity happens.
  const activityTracking = useActivityTracking(air.aqiReadings)

  // Screen-based navigation (replacing the old bottom-tab model) to match
  // the reference app's hamburger-drawer + card-grid home structure. A
  // small back stack (rather than just "always back to home") means
  // opening the paywall from Settings or Pollen returns to where you
  // actually came from.
  const [screen, setScreen] = useState<ScreenId>('home')
  const [screenStack, setScreenStack] = useState<ScreenId[]>([])
  const [menuOpen, setMenuOpen] = useState(false)

  function navigateTo(next: ScreenId) {
    setScreenStack((stack) => [...stack, screen])
    setScreen(next)
  }

  function goBack() {
    setScreenStack((stack) => {
      if (stack.length === 0) {
        setScreen('home')
        return stack
      }
      const copy = [...stack]
      const prev = copy.pop() as ScreenId
      setScreen(prev)
      return copy
    })
  }

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

  // A personal, rolling exposure score (see services/exposureScore.ts) —
  // combines the last 7 days of logged ambient AQI with any completed
  // activities in that window. getRecentDailyHistory reads localStorage
  // directly rather than coming from `air`, so it's recomputed off
  // air.monthlyHistory (which changes whenever a new day gets logged) and
  // activityTracking.history as the closest available "something changed,
  // recheck" signals, rather than polling on its own.
  const exposureScore = useMemo(
    () =>
      computeExposureScore(
        getRecentDailyHistory(EXPOSURE_SCORE_WINDOW_DAYS),
        activityTracking.history,
        isSensitiveGroup(healthProfile)
      ),
    [air.monthlyHistory, activityTracking.history, healthProfile]
  )

  // A real, honestly-computed streak and badge state (see
  // services/streak.ts) built only from completed activities already
  // saved in this browser — no server account, no invented milestones.
  const activityStreak = useMemo(
    () => computeActivityStreak(activityTracking.history),
    [activityTracking.history]
  )
  const firstBadgeEarned = useMemo(
    () => hasEarnedFirstActivityBadge(activityTracking.history),
    [activityTracking.history]
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-200 dark:bg-night-900 p-0 sm:p-6 transition-colors">
      <div className="relative w-full sm:max-w-[390px] sm:h-[780px] sm:rounded-[28px] sm:border sm:border-ink-400 dark:sm:border-night-500 overflow-hidden bg-white dark:bg-night-800 flex flex-col transition-colors">
        {/* Respira brand chrome — deep forest green, grounded in the
            clean-air/plant-life idea behind the name, rather than a
            borrowed reference palette. Stays on every screen so the app
            has one consistent branded frame, with the AqiGauge continuing
            this exact gradient (see AqiGauge.tsx) into one seamless panel
            on the outdoor air screen. Screens with their own colored hero
            (Home, Paywall) sit directly below this thin status bar. */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-b from-[#1F4D3A] to-[#2F6B4F] dark:from-[#0D2A1E] dark:to-[#123A29]">
          <span className="text-xs text-white/70">9:41</span>
          <span className="text-sm font-semibold text-white tracking-wide">Respira</span>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>

        {screen === 'home' && (
          <HomeView
            currentAqi={air.usingSampleData ? null : air.stats.currentAqi}
            forecastPeakAqi={air.usingSampleData ? null : air.stats.forecastPeakAqi}
            locationLabel={air.locationLabel}
            exposureScore={exposureScore}
            streak={activityStreak}
            badgeEarned={firstBadgeEarned}
            onNavigate={navigateTo}
            onOpenMenu={() => setMenuOpen(true)}
          />
        )}

        {screen === 'outdoorAir' && (
          <div className="flex-1 overflow-y-auto">
            <ScreenHeader title="Outdoor air" onBack={goBack} />
            <SearchBar
              onSelectLocation={(result) =>
                air.searchLocation({ lat: result.lat, lng: result.lng }, result.label)
              }
              activeLabel={air.activeLocationLabel}
              onClear={air.clearLocationOverride}
            />

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
                number in StatStrip below. */}
            <AqiGauge
              value={air.stats.currentAqi}
              level={air.alert.level}
              detail={air.alert.detail}
              location={air.locationLabel}
            />
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

        {screen === 'activity' && (
          <div className="flex-1 overflow-y-auto">
            <ScreenHeader title="Activity" onBack={goBack} />
            <ActivityView
              tracking={activityTracking}
              currentAqi={air.usingSampleData ? null : air.stats.currentAqi}
            />
          </div>
        )}

        {screen === 'myActivities' && (
          <div className="flex-1 overflow-y-auto">
            <MyActivitiesView
              onBack={goBack}
              activities={activityTracking.history}
              sensitiveGroup={isSensitiveGroup(healthProfile)}
            />
            {/* The old monthly-history chart + rolling 7-day exposure card
                didn't have a direct equivalent screen in the reference
                app, so rather than dropping that real, working feature it
                lives here, below the per-day picker — same section of the
                app ("your history"), a different time window (this month
                overall vs. one selected day). */}
            <div className="border-t border-ink-200 dark:border-night-600">
              <HistoryView
                monthlyHistory={air.monthlyHistory}
                stats={air.stats}
                usingSampleData={air.historyUsingSampleData}
                exposureScore={exposureScore}
              />
            </div>
          </div>
        )}

        {screen === 'groups' && <GroupsView onBack={goBack} />}

        {screen === 'indoorAir' && (
          <IndoorAirView
            onBack={goBack}
            outdoorAqi={air.usingSampleData ? null : air.stats.currentAqi}
            onManageSensors={() => navigateTo('settingsSensors')}
          />
        )}

        {screen === 'events' && <EventsView onBack={goBack} />}

        {screen === 'routePlanning' && (
          <RoutePlanningView
            onBack={goBack}
            onUpgrade={() => navigateTo('paywall')}
            aqiReadings={air.aqiReadings}
          />
        )}

        {screen === 'forecast' && (
          <AirQualityForecastView
            onBack={goBack}
            onUpgrade={() => navigateTo('paywall')}
            currentAqi={air.usingSampleData ? null : air.stats.currentAqi}
            forecastPeakAqi={air.usingSampleData ? null : air.stats.forecastPeakAqi}
          />
        )}

        {screen === 'settings' && <SettingsView onBack={goBack} onNavigate={navigateTo} />}

        {screen === 'settingsProfile' && (
          <SettingsProfileView onBack={goBack} streak={activityStreak} badgeEarned={firstBadgeEarned} />
        )}

        {screen === 'settingsHealthProfile' && (
          <SettingsHealthProfileView onBack={goBack} profile={healthProfile} onProfileChange={handleProfileChange} />
        )}

        {screen === 'settingsAutoTrack' && (
          <SettingsAutoTrackView onBack={goBack} onUpgrade={() => navigateTo('paywall')} />
        )}

        {screen === 'settingsSensors' && <SettingsSensorsView onBack={goBack} />}

        {screen === 'settingsLocations' && <SettingsLocationsView onBack={goBack} />}

        {screen === 'settingsConnections' && <SettingsConnectionsView onBack={goBack} />}

        {screen === 'settingsNotifications' && (
          <SettingsNotificationsView
            onBack={goBack}
            alertSettings={alertSettings}
            onAlertSettingsChange={handleAlertSettingsChange}
            sensitiveProfile={isSensitiveGroup(healthProfile)}
            center={air.center}
          />
        )}

        {screen === 'settingsCommunication' && <SettingsCommunicationView onBack={goBack} />}

        {screen === 'paywall' && <PaywallView onBack={goBack} />}

        <HamburgerMenu open={menuOpen} active={screen} onClose={() => setMenuOpen(false)} onNavigate={navigateTo} />
      </div>
    </div>
  )
}
