import { useState } from 'react'
import { exportCsv } from '../lib/csv.js'
import { resetLocalData, saveSettings, syncNow, testConnection, useStore } from '../lib/store.js'

const SETUP_URL = 'https://github.com/AlvitBABI/king-tracker/blob/main/SETUP.md'

export function SheetForm({ onDone, submitLabel = 'Connect' }) {
  const settings = useStore((s) => s.settings)
  const [url, setUrl] = useState(settings?.url || '')
  const [key, setKey] = useState(settings?.key || '')
  const [state, setState] = useState({ busy: false, msg: null, ok: null })

  const submit = async (e) => {
    e.preventDefault()
    const clean = { mode: 'sheet', url: url.trim(), key: key.trim() }
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(clean.url)) {
      return setState({ busy: false, ok: false, msg: 'That doesn’t look like an Apps Script web app URL (https://script.google.com/…/exec).' })
    }
    setState({ busy: true, msg: 'Checking…', ok: null })
    try {
      const n = await testConnection(clean)
      saveSettings(clean)
      setState({ busy: false, ok: true, msg: `Connected · ${n} ${n === 1 ? 'row' : 'rows'} in your sheet` })
      onDone?.()
    } catch (err) {
      setState({ busy: false, ok: false, msg: `Couldn’t connect: ${err.message}` })
    }
  }

  return (
    <form className="sheet-form" onSubmit={submit}>
      <label className="field">
        <span className="field-label">Web app URL</span>
        <input
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck="false"
          placeholder="https://script.google.com/macros/s/…/exec"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
      </label>
      <label className="field">
        <span className="field-label">Secret key</span>
        <input
          type="password"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck="false"
          placeholder="From the setup() log"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          required
        />
      </label>
      {state.msg && <p className={`form-msg ${state.ok === false ? 'err' : state.ok ? 'ok' : ''}`}>{state.msg}</p>}
      <button className="btn primary big block" disabled={state.busy}>
        {state.busy ? 'Connecting…' : submitLabel}
      </button>
    </form>
  )
}

export function Welcome() {
  const [showForm, setShowForm] = useState(false)
  return (
    <div className="welcome">
      <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="welcome-icon" />
      <h1>King Tracker</h1>
      <p className="welcome-lead">Every Stephen King book. Track what you’ve read, rate it, and keep private notes.</p>

      {showForm ? (
        <>
          <SheetForm submitLabel="Connect my sheet" />
          <button className="btn ghost block" onClick={() => setShowForm(false)}>
            Back
          </button>
        </>
      ) : (
        <div className="welcome-options">
          <button className="btn primary big block" onClick={() => setShowForm(true)}>
            Connect my Google Sheet
          </button>
          <button className="btn big block" onClick={() => saveSettings({ mode: 'local' })}>
            Just use this device
          </button>
          <p className="muted small center">
            A sheet keeps your log safe and synced across devices.{' '}
            <a href={SETUP_URL} target="_blank" rel="noreferrer">
              5-minute setup guide
            </a>
            . You can connect one later in Settings.
          </p>
        </div>
      )}
    </div>
  )
}

export default function SettingsView({ theme, setTheme }) {
  const { settings, sync, syncError, lastSync, pending, log } = useStore()
  const pendingCount = Object.keys(pending).length
  const [editing, setEditing] = useState(false)
  const connected = settings?.mode === 'sheet'

  return (
    <div className="settings">
      <h2 className="view-title">Settings</h2>

      <section className="panel">
        <h3>Storage</h3>
        {connected && !editing ? (
          <>
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
              <button className="btn ghost" onClick={() => setEditing(true)}>
                Change sheet
              </button>
            </div>
            <button className="link-btn" onClick={() => saveSettings({ mode: 'local' })}>
              Disconnect (keep data on this device only)
            </button>
          </>
        ) : (
          <>
            {!connected && (
              <p className="muted small">
                Your log is saved on this device only. Connect a Google Sheet to back it up and use it on several devices.{' '}
                <a href={SETUP_URL} target="_blank" rel="noreferrer">
                  Setup guide
                </a>
              </p>
            )}
            <SheetForm onDone={() => setEditing(false)} submitLabel={connected ? 'Save' : 'Connect'} />
            {editing && (
              <button className="btn ghost block" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </>
        )}
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
            if (confirm('Remove your log and settings from this device? Your Google Sheet is not touched.')) resetLocalData()
          }}
        >
          Reset this device
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
