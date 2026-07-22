import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)

// Registers the service worker unconditionally (not just when the user
// opts into push alerts in pushSubscription.ts, whose register() call is
// idempotent and safe to run again later). An always-registered SW with
// a manifest is what lets browsers offer "Add to Home Screen" / install.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal — the app works fine without an installable shell,
      // this just means the install prompt/offline shell won't be
      // offered (e.g. unsupported browser, or served over plain HTTP).
    })
  })
}
