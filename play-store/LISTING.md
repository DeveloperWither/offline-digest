# Google Play listing: Digest: News & Learn Offline

Copy and paste these into Play Console. Images are in this folder.

## App details
- **App name** (max 30): `Digest: News & Learn Offline`
- **Package name**: `com.developerwither.digest`
- **Category**: News & Magazines
- **Tags**: News, Education, Books & Reference
- **Price**: Free · **Contains ads**: **Yes** (Google AdMob) · **In-app purchases**: No
- **Privacy policy URL**: https://developerwither.github.io/offline-digest/privacy.html
- **Website**: https://developerwither.github.io/offline-digest/
- **Contact email**: (you enter this in Play Console; it is shown publicly)

## Short description (max 80)
```
Free world news, AI, tech & learning guides you can read offline. No ads.
```

## Full description (max 4000)
```
Digest brings you the news that matters and practical guides that make life better, all free and with no account. Read anywhere, even with no internet.

📰 IMPORTANT NEWS, CLEARLY EXPLAINED
World news, the Middle East and the Gulf, AI and tech, written in simple, clear English. Every article lists its sources and links to the original reporting.

📍 NEWS FOR YOUR REGION
Digest shows news about your country and region a little higher, so you never miss what happens close to home. It works out your region on your phone; nothing is sent anywhere.

🎓 LEARN SOMETHING USEFUL EVERY DAY
Practical guides on health (sleep, heat safety, blood pressure, first aid, healthy fasting), money (budgeting, saving, avoiding scams, halal options), study skills and science. Each one ends with a short "Test yourself" quiz.

📜 HISTORY MADE SIMPLE
The House of Wisdom, the unification of Saudi Arabia, the Silk Road, Al-Andalus, the World Wars, the Moon landing and more, written neutrally and clearly.

✈️ WORKS OFFLINE
Everything is saved on your phone. Read on a plane, on the metro or anywhere with no signal.

🔥 BUILD A READING HABIT
Set a daily goal, keep your streak alive with streak freezes, level up, and unlock 20 badges.

🎧 READ ALOUD
Listen to any article with your phone's voices, at your own speed.

✨ MADE FOR READING
• Instant full-text search
• Save articles, highlight text and share quote cards
• Continue reading where you stopped
• Dark, light and sepia themes, adjustable text size and font
• 6 languages: English, العربية, Español, Français, Português, हिन्दी

🔒 RESPECTFUL BY DESIGN
No account. Your reading, notes and progress stay on your device. Ads are light: one small ad at the end of an article, never pop-ups, and you can watch a short video to turn them off for 24 hours.
```

## Graphics (in this folder)
- App icon 512×512: `../icons/play-icon-512.png`
- Feature graphic 1024×500: `feature-graphic-1024x500.png`
- Phone screenshots 1080×1920: `screenshot-1-library.png` … `screenshot-6-arabic.png`

## App content forms (Play Console → Policy → App content)
- **Privacy policy**: the URL above.
- **Ads**: **Yes**, the app contains ads (Google AdMob).
- **App access**: All functionality is available without special access.
- **Content rating** (IARC questionnaire): category *Reference, News, or Educational*. Answer honestly. The news covers real conflicts and wars (text only, factual, no graphic images), so answer yes to any question about references to real-world violence in news. There is no user-to-user communication, no sharing of location and no purchases.
- **Target audience**: 13+ (or 18+). Not designed for children.
- **News app**: Yes. Declare it as a news app. The publisher is the developer (you), with the contact details above. Articles cite their original sources.
- **Data safety** (follows Google's AdMob guidance, so check Google's latest "Data disclosure for Google Mobile Ads SDK" page when you fill it in):
  - Does your app collect or share any of the required user data types? **Yes** (through the Google Mobile Ads SDK).
  - **Location → Approximate location**: collected and shared, for advertising and fraud prevention.
  - **App activity → App interactions**: collected and shared, for advertising and analytics.
  - **App info and performance → Diagnostics**: collected, for analytics and fraud prevention.
  - **Device or other IDs**: collected and shared, for advertising and fraud prevention.
  - Is data processed ephemerally? No. Is collection required? Yes (ads cannot be turned off, except with the 24-hour video option).
  - Is all user data encrypted in transit? **Yes**.
  - Can users request deletion? Reading data stays on the device (Reset library or uninstall). For ad data, point users to their phone's ad settings and Google's privacy policy.
- **Advertising ID declaration**: **Yes**, the app uses the advertising ID (for ads). The permission is added automatically by the Google Mobile Ads SDK.
- **Government app**: No. **Financial features**: No. **Health**: No (general wellbeing articles only, not a medical app).

## AdMob setup (before publishing)
1. Create a free account at https://admob.google.com and add an Android app called "Digest" (choose "not yet published" if it isn't live yet).
2. Create two ad units: a **Banner** (adaptive) and a **Rewarded** one.
3. Send me the **App ID** (`ca-app-pub-…~…`) and the two **ad unit IDs** (`ca-app-pub-…/…`). I'll replace Google's test IDs and rebuild.
4. In AdMob → Privacy & messaging, create a **GDPR consent message** (Europe/UK) for the app.
5. Never tap your own real ads. Google can close your account for that. Test builds use test ads.

## Important Play rules for new personal developer accounts
If your developer account is new and personal, Google requires a **closed test with at least 12 testers for 14 days in a row** before you can publish to everyone. Invite friends and family by email in Play Console → Testing → Closed testing.
