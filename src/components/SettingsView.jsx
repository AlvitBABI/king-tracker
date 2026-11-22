import { exportCsv } from '../lib/csv.js'
import { resetLocalData, syncNow, useStore } from '../lib/store.js'

const SETUP_URL = 'https://github.com/AlvitBABI/king-tracker/blob/main/SETUP.md'

// Only shown when the build has no sheet configured (missing repo secrets / .env.local).
export function NotConfigured() {
  return (
    <div className="welcome">
      <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="welcome-icon" />
      <h1>King Tracker</h1>
      <p className="welcome-lead">
        No Google Sheet is connected to this build yet. Add the <code>SHEET_URL</code> and <code>SHEET_KEY</code> secrets to the
        GitHub repo and redeploy.
      </p>
      <a className="btn primary big block" href={SETUP_URL} target="_blank" rel="noreferrer">
        Open the setup guide
      </a>
    </div>
  )
}

export default function SettingsView({ theme, setTheme }) {
  const { sync, syncError, lastSync, pending, log } = useStore()
  const pendingCount = Object.keys(pending).length

  return (
    <div className="settings">
      <h2 className="view-title">Settings</h2>

      <section className="panel">
        <h3>Storage</h3>
        <p className="status-line">
          <span className={`dot ${sync}`} /> Google Sheet ·{' '}
          {sync === 'syncing'
            ? 'syncing…'
            : sync === 'error'
              ? 'sync failed, retrying'
              : sync === 'offline'
                ? 'offline, will sync later'
                : 'all saved'}
        </p>
        {syncError && <p className="form-msg err">{syncError}</p>}
        <p className="muted small">
          {pendingCount ? `${pendingCount} change${pendingCount > 1 ? 's' : ''} waiting to sync. ` : ''}
          {lastSync ? `Last synced ${new Date(lastSync).toLocaleString()}` : 'Not synced yet'}
        </p>
        <div className="btn-row">
          <button className="btn" onClick={() => syncNow()}>
            Sync now
          </button>
        </div>
      </section>

      <section className="panel">
        <h3>Appearance</h3>
        <div className="seg" role="group" aria-label="Theme">
          {[
            ['dark', 'Dark'],
            ['light', 'Light'],
            ['auto', 'Auto'],
          ].map(([id, label]) => (
            <button key={id} className={theme === id ? 'on' : ''} onClick={() => setTheme(id)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Your data</h3>
        <button className="btn block" onClick={() => exportCsv(log)}>
          Export CSV
        </button>
        <button
          className="link-btn danger"
          onClick={() => {
            if (
              confirm(
                `Clear this device’s cache and reload everything from the Google Sheet?${pendingCount ? ` ${pendingCount} unsynced change${pendingCount > 1 ? 's' : ''} will be lost.` : ''}`,
              )
            )
              resetLocalData()
          }}
        >
          Reload from sheet
        </button>
      </section>

      <p className="muted small center">
        Covers from Open Library · Not affiliated with Stephen King
        <br />
        Book list follows stephenking.com/works (original editions only)
      </p>
    </div>
  )
}
