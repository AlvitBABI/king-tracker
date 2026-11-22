// Thin client for the Apps Script web app (see apps-script/Code.gs).
// Everything is a text/plain POST: the browser skips the CORS preflight
// (which Apps Script can't answer) and the key never appears in a URL.

// Version 2 of the script stores the collection columns.
export const SCRIPT_VERSION = 2

async function parse(res) {
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  let data
  try {
    data = await res.json()
  } catch {
    throw new Error('Unexpected response. Is the web app access set to "Anyone"?')
  }
  if (!data.ok) throw new Error(data.error === 'unauthorised' ? 'Wrong secret key' : data.error || 'Unknown error')
  return data
}

const post = (url, body) =>
  fetch(url, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  }).then(parse)

// -> { rows, version }
export async function fetchRows({ url, key }) {
  const data = await post(url, { key, action: 'list' })
  if (Array.isArray(data.rows)) return { rows: data.rows, version: data.version || 1 }
  // Very old script without the "list" action: fall back to GET.
  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${sep}key=${encodeURIComponent(key)}`, { redirect: 'follow' })
  return { rows: (await parse(res)).rows || [], version: 1 }
}

// -> { saved, version }
export const pushRows = ({ url, key }, rows) =>
  post(url, { key, rows: rows.map((r) => ({ ...r, formats: (r.formats || []).join(',') })) }).then((d) => ({
    saved: d.saved,
    version: d.version || 1,
  }))
