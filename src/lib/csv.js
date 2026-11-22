import { books, TYPE_LABEL } from './books.js'
import { ratingOf } from './entry.js'

const COLUMNS = ['title', 'published', 'type', 'pages', 'series', 'status', 'rating', 'date_finished', 'comment']

const cell = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function buildCsv(log) {
  const rows = books.map((b) => {
    const e = log[b.id] || {}
    return {
      title: b.title,
      published: b.published,
      type: TYPE_LABEL[b.type],
      pages: b.pages,
      series: b.series.join('; '),
      status: e.status || 'unread',
      rating: ratingOf(e) || '',
      date_finished: e.status === 'read' ? e.date_finished || '' : '',
      comment: e.comment || '',
    }
  })
  return [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => cell(r[c])).join(','))].join('\r\n')
}

// On iPhone the share sheet is the friendliest way to save a file;
// elsewhere fall back to a normal download.
export async function exportCsv(log) {
  const name = `king-tracker-${new Date().toISOString().slice(0, 10)}.csv`
  const blob = new Blob(['﻿' + buildCsv(log)], { type: 'text/csv' })
  const file = new File([blob], name, { type: 'text/csv' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'King Tracker export' })
      return
    } catch (err) {
      if (err.name === 'AbortError') return
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
