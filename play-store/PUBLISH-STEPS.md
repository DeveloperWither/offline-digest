# How to put Digest on Google Play

**Your app file:** `C:\Users\pc\offline-digest-release\digest-2.0.0.aab`
**Your account:** ahmed.essa81@gmail.com (use Chrome)
**Store text, forms, and images:** `LISTING.md` and the images in this folder

> ⚠️ The current app file uses Google's **test ads** (they earn nothing). Do **Step 1** first, so Claude can build a new file with your real ads, then upload that one.

---

## Step 1: AdMob (your real ads)
1. Open https://admob.google.com and sign in.
2. Go to **Apps → Add app → Android**. When it asks "Is the app listed?", choose **No**. Name it `Digest`.
3. Go to **Ad units → Add ad unit → Banner**, name it `Digest banner`, and create it.
4. Go to **Ad units → Add ad unit → Rewarded**, name it `Digest rewarded`, and create it.
5. Go to **Ad units → Add ad unit → Interstitial**, name it `Digest interstitial`, and create it.
6. Copy these 4 IDs and send them to Claude:
   - **App ID**: looks like `ca-app-pub-1234567890123456~1234567890`
   - **Banner ID**: looks like `ca-app-pub-1234567890123456/1234567890`
   - **Rewarded ID**: looks like `ca-app-pub-1234567890123456/1234567890`
   - **Interstitial ID**: looks like `ca-app-pub-1234567890123456/1234567890`
7. Go to **Privacy & messaging → GDPR**, then create and publish a consent message for Digest.
8. Never tap your own real ads. Google can ban the account for that.

Claude then builds a new `.aab` file in `C:\Users\pc\offline-digest-release`.

---

## Step 2: Developer account (one time)
1. Open https://play.google.com/console.
2. Choose **Personal** and pay **$25** (one time only).
3. Verify your ID (passport or national ID). Approval can take a few days.

---

## Step 3: Create the app
1. In Play Console, click **Create app**.
2. **App name:** `Digest: News & Learn Offline`
3. **Default language:** English
4. **App or game:** App · **Free or paid:** Free
5. Tick the declaration boxes, then click **Create app**.

---

## Step 4: Upload the app (closed test)
1. In the left menu, go to **Test and release → Testing → Closed testing**.
2. Click **Create track** if it asks, then **Create new release**.
3. **Drag the `.aab` file** from `C:\Users\pc\offline-digest-release` into the **App bundles** box.
4. Release name: `2.0.0`. Click **Next → Save**.
5. Open the **Testers** tab, create an email list, and add **at least 12 Gmail addresses** (friends and family).
6. Copy the **join link** and send it to them. Each tester must open it and install the app.

> New personal accounts must keep the closed test running with 12+ testers for **14 days in a row** before you can release to everyone.

---

## Step 5: Store listing
Go to **Grow users → Store presence → Main store listing**. Copy from `LISTING.md`:
- **App name**, **Short description**, **Full description**
- **App icon:** `C:\Users\pc\offline-digest\icons\play-icon-512.png`
- **Feature graphic:** `feature-graphic-1024x500.png` (in this folder)
- **Phone screenshots:** `screenshot-1-library.png` … `screenshot-6-arabic.png` (in this folder)
- **Contact email:** ahmed.essa81@gmail.com
- **Website:** https://developerwither.github.io/offline-digest/

Click **Save**.

---

## Step 6: App content (policy forms)
Go to **Policy and programs → App content**. All the answers are in `LISTING.md`:
- **Privacy policy:** https://developerwither.github.io/offline-digest/privacy.html
- **Ads:** Yes, the app contains ads
- **App access:** All functionality is available without special access
- **Content rating:** category *Reference, News, or Educational*
- **Target audience:** 13+
- **News app:** Yes
- **Data safety:** copy the answers from `LISTING.md`
- **Advertising ID:** Yes, used for ads
- **Government / Financial / Health:** No

---

## Step 7: Go live (after the 14 days)
1. Go to **Dashboard** and click **Apply for production**. Answer Google's questions about your test.
2. When it's approved, go to **Test and release → Production → Create new release**.
3. Choose the same app file (or a newer one) and click **Next → Save → Send for review**.
4. Google's review usually takes **1 to 7 days**. Then Digest is live on Google Play 🎉

---

## For every update later
Ask Claude to build a new version (the version number goes up every time), then upload the new `.aab` in **Production → Create new release**.
News articles **don't** need an app update, because they come from the website automatically.

**Stuck?** Send Claude a screenshot of the screen you're on.
