# Connect King Tracker to your own Google Sheet (5 minutes)

King Tracker keeps your reading log in **your own** Google Sheet, so your ratings and notes belong to you and sync across your devices. You can also skip this and keep everything on one device ("Just use this device").

You need a Google account and a computer (the Apps Script editor is awkward on a phone). After that, everything happens on your phone.

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

## 5. Connect the app

1. Open King Tracker on your phone. To install it, tap Share → **Add to Home Screen** in Safari.
2. Choose **Connect my Google Sheet**, or go to **Settings** if you're already using it.
3. Paste the **Web app URL** and the **secret key**, then tap **Connect**.

That's it. The dot in the top-right corner shows sync status:

| Dot | Meaning |
|---|---|
| 🟢 green | Everything saved to your sheet |
| 🟡 amber, pulsing | Saving… |
| 🔴 red | Couldn't save. It retries automatically, or tap the dot to retry now |
| ⚪ grey | Offline. Changes are kept and sync when you're back online |

## Sharing with a friend

Send them the app link and this guide. Each person makes their own sheet and key, so nobody can see anyone else's log.

## Troubleshooting

- **"Wrong secret key"**: re-copy the key from the `setup` log. Running `setup` again shows the same key.
- **"Unexpected response…"**: the deployment's access isn't set to **Anyone**. Go to Deploy → Manage deployments → ✏️ edit → Who has access: Anyone.
- **Changed the script later?** Use Deploy → Manage deployments → ✏️ → Version: **New version** so the URL stays the same.
- **New key:** in the Apps Script editor, open ⚙️ Project Settings → Script Properties, delete `KEY`, and run `setup` again.
