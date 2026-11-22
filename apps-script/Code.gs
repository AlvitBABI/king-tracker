/**
 * King Tracker – Google Sheets backend.
 *
 * Bound to a Google Sheet, deployed as a web app (Execute as: me, Access: anyone).
 *   GET  ?key=SECRET                        -> { ok, rows: [...] }
 *   POST text/plain {"key", "rows": [...]}  -> upserts each row by book_id
 *
 * Run setup() once from the editor: it creates the "log" tab and a secret key
 * (shown in the execution log, stored as Script Property KEY).
 */

const SHEET_NAME = 'log';
const HEADERS = ['book_id', 'title', 'status', 'rating', 'comment', 'date_finished', 'updated_at'];
const STATUSES = ['unread', 'reading', 'read'];

function setup() {
  const sheet = getSheet_();
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('KEY', key);
  }
  Logger.log('Sheet ready: "%s". Your secret key is: %s', sheet.getName(), key);
}

function doGet(e) {
  if (!authorised_(e.parameter.key)) return json_({ ok: false, error: 'unauthorised' });
  return json_({ ok: true, rows: readRows_() });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad json' });
  }
  if (!authorised_(body.key)) return json_({ ok: false, error: 'unauthorised' });

  const rows = Array.isArray(body.rows) ? body.rows : body.row ? [body.row] : [];
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    rows.forEach(upsert_);
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true, saved: rows.length });
}

// ---------------------------------------------------------------------------

function authorised_(key) {
  const expected = PropertiesService.getScriptProperties().getProperty('KEY');
  return Boolean(expected) && key === expected;
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    // Plain text everywhere, so dates stay "2024-05-01" and comments starting
    // with "=" are never treated as formulas.
    sheet.getRange(1, 1, sheet.getMaxRows(), HEADERS.length).setNumberFormat('@');
  }
  return sheet;
}

function readRows_() {
  const sheet = getSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const values = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  return values
    .filter((r) => r[0])
    .map((r) => {
      const row = {};
      HEADERS.forEach((h, i) => {
        let v = r[i];
        if (v instanceof Date) v = Utilities.formatDate(v, 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
        row[h] = v === '' ? null : v;
      });
      row.book_id = String(row.book_id);
      row.rating = row.rating ? Number(row.rating) : null;
      if (row.date_finished) row.date_finished = String(row.date_finished).slice(0, 10);
      return row;
    });
}

function upsert_(row) {
  if (!row || !row.book_id) return;
  const clean = {
    book_id: String(row.book_id).slice(0, 100),
    title: String(row.title || '').slice(0, 300),
    status: STATUSES.indexOf(row.status) >= 0 ? row.status : 'unread',
    rating: row.rating >= 1 && row.rating <= 5 ? Math.round(row.rating) : '',
    comment: String(row.comment || '').slice(0, 5000),
    date_finished: /^\d{4}-\d{2}-\d{2}$/.test(row.date_finished) ? row.date_finished : '',
    updated_at: String(row.updated_at || new Date().toISOString()),
  };

  const sheet = getSheet_();
  const last = sheet.getLastRow();
  const ids = last >= 2 ? sheet.getRange(2, 1, last - 1, 1).getValues().map((r) => String(r[0])) : [];
  const idx = ids.indexOf(clean.book_id);

  // Ignore stale writes (e.g. an old offline edit arriving after a newer one).
  if (idx >= 0) {
    const current = String(sheet.getRange(idx + 2, HEADERS.length).getValue());
    if (current && current > clean.updated_at) return;
  }

  const rowNumber = idx >= 0 ? idx + 2 : last + 1;
  const range = sheet.getRange(rowNumber, 1, 1, HEADERS.length);
  range.setNumberFormat('@');
  range.setValues([HEADERS.map((h) => clean[h])]);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
