<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/a88e1225-0fc2-4083-a3d0-64937a43961c

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploying to Vercel

This project was originally built for a single always-on Express server (`server.ts`), which
Vercel does not run as-is. To make it work on Vercel, the two API routes it needs
(`/api/hf-tree` and `/api/audio`) have been re-implemented as standalone serverless
functions in the `api/` folder, and a `vercel.json` was added so Vercel:

- Builds the frontend with `vite build` and serves the static `dist/` output.
- Deploys `api/hf-tree.ts` and `api/audio.ts` as serverless functions automatically
  (any file in `api/` becomes `/api/<filename>` on Vercel — no extra config needed
  beyond what's in `vercel.json`).
- Rewrites all non-`/api` routes back to `index.html` so the SPA loads correctly.

`server.ts` is still there and works for local development (`npm run dev` / `npm run build`
+ `npm start`), but it is not used on Vercel — Vercel ignores it and uses the `api/` functions
and static build instead.

No environment variables are required for the song list/audio to load, since that data comes
from a public Hugging Face dataset.

`package.json` was also trimmed of unused leftover dependencies from the original AI Studio
template (`@google/genai`, `@distube/ytdl-core`, `youtube-sr`, `yt-search`, `dotenv`, `motion`)
and the stray `bun.lock` was removed so Vercel unambiguously installs with npm. Run
`npm install` once locally (or let Vercel do it on first deploy) to generate a fresh
`package-lock.json`.

## App icon

The browser tab icon / favicon and PWA/home-screen icons are now the cropped headphones +
pickaxe mark from the logo (`public/favicon.ico`, `favicon-*.png`, `apple-touch-icon.png`,
`pwa-192x192.png`, `pwa-512x512.png`, and maskable variants). These were missing before, which
is also why the PWA icons never showed up.

## "Download" button / installing as an app

There's now a **Download** button in the header that opens an install dialog:

- **Android / Chrome / Edge / desktop:** shows a native **Install App** button (using the
  `beforeinstallprompt` event). Tapping it installs the site as a real app with its own icon,
  its own window, and offline-capable caching (via `vite-plugin-pwa`).
- **iPhone/iPad (Safari):** shows step-by-step instructions to use **Share → Add to Home
  Screen**, since iOS doesn't support the install-prompt API — this is Apple's restriction,
  not something any web app can bypass.

### About the `.apk` request

A genuine installable Android `.apk` has to be built and signed with the Android SDK/Gradle
(or a packaging service) — that's not something that can be produced inside this chat
environment. The good news is the app is already a fully configured installable PWA, which
covers "install like an app" for both Android and desktop without needing an `.apk` at all.

If you specifically want a real, distributable `.apk`/`.aab` (e.g. for the Play Store), once
this is deployed on Vercel:

1. Go to **[pwabuilder.com](https://www.pwabuilder.com)**.
2. Enter your live Vercel URL.
3. Choose **Android** as the package type — PWABuilder will read the manifest (icons, name,
   theme color already configured here) and generate a signed `.apk`/`.aab` you can download
   or upload straight to the Play Store.
