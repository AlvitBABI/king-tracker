// Thin client for the Apps Script web app (see apps-script/Code.gs).
// POST bodies are text/plain so the browser skips the CORS preflight,
// which Apps Script can't answer.

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

export async function fetchRows({ url, key }) {
  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${sep}key=${encodeURIComponent(key)}`, { redirect: 'follow' })
  return (await parse(res)).rows || []
}

export async function pushRows({ url, key }, rows) {
  const res = await fetch(url, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ key, rows }),
  })
  return parse(res)
}
