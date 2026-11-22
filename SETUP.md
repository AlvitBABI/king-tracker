# Connect King Tracker to its Google Sheet (one-time, 5 minutes)

King Tracker keeps the reading log in one Google Sheet. You set it up once: the sheet's URL and key are built into the app, so every device opens straight into your log with nothing to type.

You need a Google account and a computer (the Apps Script editor is awkward on a phone).

## 1. Make the sheet

1. Go to [sheets.new](https://sheets.new) to create a blank Google Sheet.
2. Name it something like **King Tracker**.

You don't need to add any columns. The script creates a `log` tab with the right headers for you.

## 2. Paste the script

1. In the sheet, open **Extensions → Apps Script**.
2. Delete the sample code in `Code.gs`.
3. Paste in everything from [`apps-script/Code.gs`](apps-script/Code.gs). On GitHub, use the "Copy raw file" button.
4. Click **💾 Save**.

## 3. Create your secret key

1. In the function dropdown at the top of the editor, pick **`setup`** and click **▶ Run**.
2. Google asks for permission. Click **Review permissions**, choose your account, then **Advanced → Go to King Tracker (unsafe) → Allow**.
   It says "unsafe" only because you wrote the script yourself and Google hasn't reviewed it. The script can only touch this one spreadsheet.
3. Open **View → Execution log** (or look at the log panel). It shows:
   `Your secret key is: 3f9c…`
   **Copy that key.**

## 4. Deploy it as a web app

1. Click **Deploy → New deployment**.
2. Click the ⚙️ gear next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**, then copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy…/exec`.

"Anyone" only means the URL is reachable from the app. Every request must include your secret key, and requests without it are rejected.

## 5. Give the URL and key to the app

1. On GitHub, open the repo **Settings → Secrets and variables → Actions → New repository secret**.
2. Add two secrets:
   - `SHEET_URL` = the Web app URL from step 4
   - `SHEET_KEY` = the secret key from step 3
3. Go to **Actions → Deploy to GitHub Pages → Run workflow** (or just push to `main`). The deploy bakes both values into the app.
4. Open King Tracker on your phone. To install it, tap Share → **Add to Home Screen** in Safari.

For local development, put the same values in a `.env.local` file (git-ignored):

```
VITE_SHEET_URL=https://script.google.com/macros/s/…/exec
VITE_SHEET_KEY=…
```

That's it. The dot in the top-right corner shows sync status:

| Dot | Meaning |
|---|---|
| 🟢 green | Everything saved to your sheet |
| 🟡 amber, pulsing | Saving… |
| 🔴 red | Couldn't save. It retries automatically, or tap the dot to retry now |
| ⚪ grey | Offline. Changes are kept and sync when you're back online |

## Good to know

- The URL and key end up inside the published JavaScript, so someone who digs through the site's code could find them and read or edit the log. Fine for a reading log; don't put anything sensitive in comments.
- To switch to a different sheet, update the two secrets and redeploy.

## Troubleshooting

- **"Wrong secret key"**: re-copy the key from the `setup` log into the `SHEET_KEY` secret and redeploy. Running `setup` again shows the same key.
- **"No Google Sheet is connected to this build"**: the secrets are missing or misspelled (`SHEET_URL`, `SHEET_KEY`). Add them and re-run the deploy.
- **"Unexpected response…"**: the deployment's access isn't set to **Anyone**. Go to Deploy → Manage deployments → ✏️ edit → Who has access: Anyone.
- **Changed the script later?** Paste the new `Code.gs`, save, then Deploy → Manage deployments → ✏️ → Version: **New version** so the URL stays the same. Run `setup` once more too: it's safe to repeat and also cleans up old rows (for example, a rating left on a book marked unread).
- **Editing the sheet by hand** is fine: the script stamps `updated_at` on the row you edit, so the app keeps your change instead of overwriting it.
- **New key:** in the Apps Script editor, open ⚙️ Project Settings → Script Properties, delete `KEY`, run `setup` again, then update the `SHEET_KEY` secret and redeploy.
