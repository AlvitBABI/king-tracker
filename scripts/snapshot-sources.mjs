#!/usr/bin/env node
// Downloads the raw sources used to build and verify the catalogue into
// ./snapshot/, so they can be reviewed offline (the workflow pushes them to
// the `data-snapshot` branch). Nothing here changes the app.
//
//   SK_SITE=1        stephenking.com/works index + every work's detail page
//   WIKI="A|B"       Wikipedia pages (wikitext), separated by |
//   OL="q1|q2"       Open Library searches (title queries), separated by |
//
// Usage: SK_SITE=1 WIKI="List of short fiction by Stephen King" node scripts/snapshot-sources.mjs

import { mkdir, writeFile } from 'node:fs/promises'

const OUT = new URL('../snapshot/', import.meta.url)
const UA = { 'User-Agent': 'king-tracker catalogue snapshot (github.com/AlvitBABI/king-tracker)' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const list = (v) => (v || '').split('|').map((s) => s.trim()).filter(Boolean)

async function get(url, { json = false } = {}) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: UA }).catch((e) => ({ ok: false, status: e.message }))
    if (res.ok) return json ? res.json() : res.text()
    if (attempt >= 3) throw new Error(`${url} -> ${res.status}`)
    await sleep(4000 * attempt)
  }
}

const textLines = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<head[\s\S]*?<\/head>/g, '')
    .replace(/<(nav|footer|header)[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&rsquo;|&#8217;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;|&ndash;/g, '–')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

await mkdir(OUT, { recursive: true })
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

if (process.env.SK_SITE) {
  const html = await get('https://stephenking.com/works/')
  await writeFile(new URL('sk-works-index.html', OUT), html)
  const works = new Map()
  for (const m of html.matchAll(/href="\/works\/([a-z0-9-]+)\/([^"]+?)\.html"[^>]*>([\s\S]*?)<\/a>/g)) {
    const key = `${m[1]}/${m[2]}`
    if (!works.has(key)) works.set(key, { key, category: m[1], slug: m[2], linkText: textLines(m[3]).join(' ') })
  }
  console.log(`index: ${works.size} works`, Object.groupBy([...works.values()], (w) => w.category))
  const details = []
  for (const w of works.values()) {
    try {
      const page = await get(`https://stephenking.com/works/${w.key}.html`)
      details.push({ ...w, lines: textLines(page).slice(0, 120) })
    } catch (e) {
      details.push({ ...w, error: e.message })
    }
    await sleep(400)
  }
  await writeFile(new URL('sk-works.json', OUT), JSON.stringify(details, null, 1))
}

for (const title of list(process.env.WIKI)) {
  const data = await get(
    `https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=wikitext&redirects=1&page=${encodeURIComponent(title)}`,
    { json: true },
  )
  await writeFile(new URL(`wiki-${slug(title)}.wikitext`, OUT), data.parse?.wikitext?.['*'] ?? JSON.stringify(data))
  console.log(`wiki: ${title}`)
  await sleep(500)
}

const ol = {}
for (const q of list(process.env.OL)) {
  ol[q] = await get(
    `https://openlibrary.org/search.json?title=${encodeURIComponent(q)}&author=stephen+king&limit=5&fields=key,title,first_publish_year,publish_date,cover_edition_key,isbn,number_of_pages_median,first_sentence`,
    { json: true },
  ).catch((e) => ({ error: e.message }))
  await sleep(700)
}
if (Object.keys(ol).length) await writeFile(new URL('openlibrary.json', OUT), JSON.stringify(ol, null, 1))
console.log('done')
