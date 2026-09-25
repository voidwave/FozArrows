# Leaderboard setup (free, about 5 minutes)

The leaderboard uses a Google Sheet and a small Apps Script web app. Both are free
with any Google account. Until the URL is set, the game works normally and just
hides the 🏆 button.

1. Create a new Google Sheet (sheets.new) and name it e.g. **Foz Arrows Leaderboard**.
2. In the sheet, open **Extensions → Apps Script**.
3. Delete the sample code, paste everything from [`Code.gs`](Code.gs), and click 💾 **Save**.
4. Click **Deploy → New deployment**. Click the ⚙️ next to "Select type" and choose **Web app**.
   - Description: `leaderboard`
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy**, then **Authorize access**. Pick your account. Google will warn that
   the app isn't verified. Click **Advanced → Go to … (unsafe)**. It's your own script,
   and it only touches this one sheet.
6. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy…/exec`.
7. In `index.html`, paste it into the meta tag near the top:
   ```html
   <meta name="leaderboard-url" content="https://script.google.com/macros/s/AKfy…/exec">
   ```
   Commit that change. You can edit the file directly on github.com; no rebuild is needed.

To check it's working, open the URL in a browser. You should see
`{"ok":true,"hello":"Foz Arrows leaderboard"}`. Scores show up in the **Scores** tab
of the sheet. You can delete or rename rows there to moderate.

## Updating the script later

Use **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
This keeps the same URL. "New deployment" gives you a different URL.

## Limits and cheating

- Google's free quotas are plenty for a hobby game, but a sudden rush of players
  could hit them. When that happens, the leaderboard stops loading for a while;
  it never costs money.
- Scores are checked against the most a player could possibly score for the level
  they've reached. Replaying a level only counts your best result. A determined
  cheater can still post a fake-but-plausible score. Delete their row in the sheet.
- If you change level sizes in `levelConfig()` (`src/main.js`), update `levelN_()`
  in `Code.gs` to match.
