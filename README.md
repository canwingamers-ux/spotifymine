Data Usage Optimization — What Changed & Why

This document explains everything that was changed in the Spotify clone to reduce data usage, and confirms exactly what was not touched (song playback speed, audio quality, and image quality/loading behavior all remain identical).

1. The Golden Rule: Audio Playback Was Never Touched

Before optimizing anything, it's important to understand how songs actually play in this app: the <audio> element streams directly from the Hugging Face CDN. There is no proxy, no server, and no service worker sitting in between.



This matters because it means every optimization below operates on a completely separate part of the app (images and metadata). None of them can slow down, degrade, or interrupt song playback — the audio path is physically unconnected to the caching changes.

2. Cover Art: From "Re-download Every Time" to "Download Once"

The problem: Every time the app loaded — home screen, search results, queue, now-playing view — it re-downloaded the exact same .jpg cover art files from Hugging Face, even if you'd seen that same album art five minutes earlier. There was no caching layer at all.

The fix: A CacheFirst service worker rule was added specifically for Hugging Face cover art images. Once an image is downloaded once, it's saved locally and never re-requested from the network again (for up to 60 days, or the most recent 500 images).

Show Image

What did NOT change:

The image files themselves — same resolution, same compression, same bytes.
The loading behavior — images still load exactly the same way, still lazy-load in grids the same way they did before.
The fallback logic if an image fails to load.

What changed: How many times the same image gets downloaded. First view = normal download. Every view after that = instant, from local storage, zero data used.

3. Track List: From "Full Network Round-Trip Every Time" to "Instant + Background Refresh"

The problem: Every time the app opened, it made a fresh request to /api/hf-tree to get the full song library listing, and that request always went all the way to Hugging Face's API — even though the library rarely changes minute-to-minute.

The fix: Two layers of caching were added:

Server-side (Cache-Control header): Vercel's edge network now caches the response for 5 minutes, and can serve a slightly-stale copy for up to an hour while quietly fetching a fresh one in the background.
Client-side (service worker): A StaleWhileRevalidate rule does the same thing locally in the browser/PWA.



What did NOT change: The data itself, how tracks are parsed, sorted, or displayed. The library will still reflect new uploads within minutes — it's just not re-fetching from scratch on literally every single page load.

4. App Shell (JS/CSS/Icons): Cached Forever, Safely

Vite already builds the JavaScript and CSS bundles with unique hash-based filenames (e.g. index-CynULOY0.js). That means if the code ever changes, the filename changes too — so it's completely safe to tell browsers "cache this forever, never check again":

Hashed JS/CSS bundles: Cache-Control: public, max-age=31536000, immutable (1 year)
Icons (.png, .ico, .webmanifest): cached for 30 days, refreshed quietly in the background if needed

Returning visitors now only ever download the tiny index.html file fresh — everything else loads instantly from cache.

5. Summary of Files Changed
File	What was added
vite.config.ts	Service worker rules: CacheFirst for cover art, StaleWhileRevalidate for track list
api/hf-tree.ts	Cache-Control header for edge/browser caching of the track listing
vercel.json	Long-term immutable caching headers for hashed JS/CSS and static icons

Nothing in App.tsx, PlayerBar.tsx, audioUtils.ts, or any audio-playback logic was modified.

6. Will Songs Still Play on iOS?

Short answer: yes, and this was already handled correctly before any of the above changes — but there are two pre-existing details worth knowing about, specific to iPhone/iPad:

Format support

iOS Safari's <audio> element does not support every audio format. Here's what actually works:



If any files in the Hugging Face music library are .ogg or .flac, those specific tracks will fail to play on iPhone/iPad only — desktop browsers (Chrome, Firefox, Edge, desktop Safari) handle all five formats fine. It's worth checking what formats are actually present in the library.

Autoplay & gestures
The <audio> element already has playsInline set — this is the one non-negotiable requirement for audio to work at all on iOS Safari, and it's already correctly in place.
iOS blocks audio from starting without a direct tap. Playback here is always triggered from a button onClick, which satisfies that requirement.
Auto-advancing to the next track when a song ends does not require a fresh tap (the audio session is already unlocked from the original gesture), so continuous playback keeps working normally.
7. Net Result
Song playback: identical speed, identical quality, identical instant-start behavior.
Image quality: identical — same files, same resolution.
Data usage: significantly lower on repeat visits, since cover art and track metadata are no longer re-downloaded on every single app load.
