// The one Google Sheet this app talks to. Baked in at build time:
//   - deploy: GitHub repo secrets SHEET_URL and SHEET_KEY (see SETUP.md)
//   - local dev: .env.local with VITE_SHEET_URL and VITE_SHEET_KEY
// Note: values end up in the built JavaScript, so anyone who opens the site
// could find them. Fine for a personal reading log; don't store secrets in it.

function legacyDeviceSettings() {
  // Devices set up with the old "paste URL + key" screen keep working until
  // the build has its own config.
  try {
    const s = JSON.parse(localStorage.getItem('kt.settings'))
    return s?.mode === 'sheet' && s.url && s.key ? { url: s.url, key: s.key } : null
  } catch {
    return null
  }
}

const url = (import.meta.env.VITE_SHEET_URL || '').trim()
const key = (import.meta.env.VITE_SHEET_KEY || '').trim()

export const sheet = url && key ? { url, key } : legacyDeviceSettings()
