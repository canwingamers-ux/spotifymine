# SpotifyMine

A full-featured, Spotify-styled music streaming web app that streams audio straight from a
Hugging Face dataset — no paid storage, no CDN bill, no backend database. Built with
React 19 + Vite 6, installable as a PWA on Android/desktop, with Firebase for accounts and an
optional Gemini-powered "AI-made" playlist row.

This README explains everything: how the app works end to end, every feature, every bug that
was fixed along the way and why, and how to run/deploy it yourself.

---

## Table of contents

- [What this app is](#what-this-app-is)
- [Tech stack](#tech-stack)
- [How music actually gets to the browser](#how-music-actually-gets-to-the-browser)
- [Features](#features)
  - [Playback, queue, lyrics](#playback-queue-lyrics)
  - [Search & the "All Songs" tab](#search--the-all-songs-tab)
  - [Shuffle](#shuffle)
  - [Accounts, playlists, admin panel](#accounts-playlists-admin-panel)
  - [AI-made playlists (Gemini)](#ai-made-playlists-gemini)
  - [Install as an app (PWA)](#install-as-an-app-pwa)
- [Data usage optimization](#data-usage-optimization)
- [The iOS Safari audio bug (and its fix)](#the-ios-safari-audio-bug-and-its-fix)
- [Why songs used to go missing / "Internal Server Error"](#why-songs-used-to-go-missing--internal-server-error)
- [Library-load error handling](#library-load-error-handling)
- [On branding vs. data source ("SpotifyMine" vs "CoolJaat")](#on-branding-vs-data-source-spotifymine-vs-cooljaat)
- [Running locally](#running-locally)
- [Deploying to Vercel](#deploying-to-vercel)
- [Deploying to Netlify](#deploying-to-netlify)
- [Environment variables](#environment-variables)
- [Known limitations](#known-limitations)
- [Project structure](#project-structure)

---

## What this app is

Picture Spotify's dark UI — sidebar, now-playing bar, search, queue, playlists — but instead of
Spotify's licensed catalog, every song is a file sitting in a Hugging Face **dataset repo**
(the same kind of repo people usually use for ML training data, repurposed here as free,
generous-bandwidth file storage). The app reads that repo's file list, turns filenames into
track metadata, and streams the audio directly from Hugging Face's CDN into a normal HTML
`<audio>` element.

There is intentionally **no database for songs** — the Hugging Face repo *is* the database.
Add or remove a file there and the app picks it up (within about 15 seconds, see
[Data usage optimization](#data-usage-optimization)). Firebase is only used for user accounts
and saved playlists, not for the songs themselves.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite 6 + Tailwind CSS 4 |
| Icons | lucide-react |
| Auth / user data | Firebase (Auth + Firestore) |
| Song storage & CDN | Hugging Face dataset repo (public, `resolve/main/...` URLs) |
| AI playlists | Google Gemini (server-side only) |
| Local dev server | Express (`server.ts`), run via `tsx` |
| Production hosting | Vercel — frontend as static `dist/`, API routes as serverless functions |
| PWA / offline | `vite-plugin-pwa` (generates the service worker, manifest, icons) |

## How music actually gets to the browser

1. The frontend calls `/api/hf-tree`, which asks Hugging Face's API for the dataset's full file
   tree (following pagination — see below — so nothing gets cut off).
2. Audio-file entries (`.mp3`, `.m4a`, `.wav`, `.ogg`, `.flac`) are turned into `Track` objects;
   title/artist are parsed from the filename (e.g. `Artist - Song Title.mp3`).
3. When you hit play, the `<audio>` element's `src` is pointed at Hugging Face's public
   `resolve/main/<path>` URL for that file — **the audio bytes flow straight from Hugging Face's
   CDN to your device**, never through the app's own server, except for the one Safari-specific
   case described in [the iOS fix](#the-ios-safari-audio-bug-and-its-fix). This is why playback
   starts instantly and isn't affected by any of the caching work described below.
4. Cover art and `.lrc` lyric files live in the same repo and are fetched the same way.

## Features

### Playback, queue, lyrics
Full playback bar with seek, volume, next/previous, an expandable "Now Playing" view, a queue
you can reorder, and synced lyrics (parsed from `.lrc` files, `src/utils/lrcParser.ts`) shown
in `LyricsView.tsx` line-by-line in time with the song.

### Search & the "All Songs" tab
Search is **real-time, not cache-based** — every search hits the live Hugging Face file list
(short-lived cache only, see below) rather than a stale snapshot. There's also a dedicated
**All Songs** tab in the sidebar (desktop and mobile) showing the complete, unfiltered library
with its own filter box and a grid/table view toggle — useful once your library is large enough
that scrolling through Home/Search isn't enough.

### Shuffle
Shuffle computes **one stable shuffled order** the moment you turn it on, and each "next track"
step just walks through that fixed order — it does *not* re-randomize on every track change or
every re-render. Once you've played through the whole shuffled order, it reshuffles and starts
a fresh pass. Turning shuffle off returns to the library's normal order.

### Accounts, playlists, admin panel
Firebase Auth handles sign-in; Firestore stores your custom playlists (create, rename, add/
remove tracks, right-click context menu). A built-in **Admin Panel** lets you enter a
Hugging-Face *write* API key (kept only in your browser's `localStorage`, never sent anywhere
else) so you can delete tracks straight from the dataset repo without leaving the app.

### AI-made playlists (Gemini)
A horizontally-scrollable **"✨ Made by AI · Refreshes daily"** row on the Home tab, containing
themed mixes (e.g. *Haryanvi Mix*, *Love Mix*, *Hindi Mix*, *Punjabi Mix*) that Gemini assembles
by picking real songs already in your library that fit each theme — it never invents tracks
that don't exist. Each mix gets a deterministic gradient-and-emoji cover (same playlist name
always gets the same look) and is fully playable like any other playlist.

The clever part is the caching: the `/api/ai-playlists` endpoint is cached at Vercel's shared
edge cache for **24 hours**. The *first* visitor on a given day triggers one Gemini call; every
other visitor for the rest of that day gets the identical cached result — so this is one Gemini
call per day, total, no matter how many people use the app, and no database is needed to
coordinate that. If `GEMINI_API_KEY` isn't set, this row just doesn't appear — nothing else in
the app depends on it.

### Install as an app (PWA)
A **Download** button opens an install dialog:
- **Android / Chrome / Edge / desktop** — a native **Install App** button using the real
  `beforeinstallprompt` event (this used to be hardcoded to show "Coming Soon" even when a
  valid native prompt was available — that bug is fixed, see `InstallAppModal.tsx` /
  `App.tsx`).
- **iPhone/iPad (Safari)** — step-by-step **Share → Add to Home Screen** instructions, since
  iOS doesn't expose an install-prompt API to any web app; this is an Apple platform
  restriction, not something fixable from the app side.

A real distributable `.apk`/`.aab` (e.g. for the Play Store) requires the Android SDK/Gradle
and can't be produced in a chat environment — but since the app is already a fully configured
installable PWA, you can generate a signed package for free by pointing
**[pwabuilder.com](https://www.pwabuilder.com)** at your live Vercel URL and choosing Android.

## Data usage optimization

The goal here was: **reduce repeated data usage, without ever touching playback speed, audio
quality, or lyrics.** Concretely:

- **Audio itself is untouched.** It streams directly from Hugging Face's CDN into `<audio>`,
  bypassing the app's server entirely (except the Safari-only proxy below). Nothing about the
  optimization work below can affect play speed or quality, because none of it sits in the
  audio path.
- **Cover art** uses a `CacheFirst` service-worker rule — once a piece of art is downloaded, it's
  never re-fetched; the exact same bytes are served from local cache on every later view.
- **Track list / metadata** (`/api/hf-tree`) uses a short edge cache
  (`s-maxage=15, stale-while-revalidate=30`) plus a `NetworkFirst` service-worker strategy — the
  app always tries to get the live list first, and only falls back to a cached copy if you're
  offline. This is intentionally short (15 seconds, not minutes) so the library stays close to
  real-time when you add/remove songs on Hugging Face, while still absorbing bursts of many
  users loading the app at the same instant.
- **Static app bundle** — Vite fingerprints hashed JS/CSS filenames, so those get an
  immutable, 1-year cache (`vercel.json`); PWA icons get a 30-day cache. Returning visitors
  barely re-download the app shell at all.

## The iOS Safari audio bug (and its fix)

**Symptom:** songs played fine on desktop Chrome/Firefox and on Android, but silently failed to
play on iPhone/iPad in Safari.

**Root cause:** Hugging Face serves audio files (which are Git-LFS-tracked) with
`Content-Type: application/octet-stream`. Chrome, Firefox, and Android all "sniff" the actual
audio bytes and play the file anyway, ignoring the wrong header — but Safari, per spec, flatly
refuses to play any media whose `Content-Type` isn't a real audio type. That mismatch is the
entire bug.

**The fix (`api/audio.ts` / `server.ts`):**
- A small proxy endpoint now forces the correct `Content-Type` based on the file extension
  (`.mp3` → `audio/mpeg`, `.m4a` → `audio/mp4`, `.wav` → `audio/wav`) and forwards Range/
  Content-Length headers correctly for seeking.
- `audioUtils.ts` detects **real Safari** (iOS Safari and macOS Safari specifically — not
  Chrome-on-iOS or Firefox-on-iOS, which are just Safari's engine underneath but behave
  differently) and routes **only** Safari's requests through this proxy. Every other browser
  keeps streaming directly from the Hugging Face CDN, completely unaffected — so this fix adds
  zero extra latency for the vast majority of users.
- `.ogg` and `.flac` genuinely cannot be decoded by Safari on any platform — no header fix can
  change that, since it's a real codec limitation, not a mislabeled-header problem. Selecting
  one of these manually now shows a clear "Safari can't play this format" message instead of
  silently doing nothing, and shuffle/autoplay-next skips them automatically when running in
  Safari.

## Why songs used to go missing / "Internal Server Error"

**Symptom:** the library only ever showed part of your songs (roughly the first ~1000), and at
one point the home page went completely blank with an "Internal Server Error" in the network
tab.

**Root cause:** three separate places (`api/hf-tree.ts`, `server.ts`, and the AI-playlist
generator) each did a *single*, unpaginated fetch to Hugging Face's tree API — which caps out at
a fixed number of entries per page. Anything past that page simply never made it into the app,
in search, home, or AI playlists alike. Later, a first attempt at fixing this added pagination
that wasn't defensive enough: if Hugging Face's "next page" link ever came back relative,
malformed, or shaped unexpectedly, the whole request threw an uncaught error — which is exactly
what surfaced as a 500 / "Internal Server Error" and an empty home page.

**The fix (`api/_lib/hf.ts`):** one shared `fetchFullTree()` helper that:
- Follows Hugging Face's `Link: rel="next"` header until every file is collected, so the whole
  library shows up everywhere consistently.
- Falls back to a simpler endpoint shape if the first request fails, before giving up.
- Never throws once it already has at least one page of data — a hiccup partway through just
  stops pagination and returns whatever was already collected, instead of failing the entire
  request.
- Has a hard cap (200 pages) as a safety net against any future pagination-loop bug.

All three call sites (`api/hf-tree.ts`, `server.ts`, the AI playlist generator) now use this one
shared, defensive function.

## Library-load error handling

Even with the fix above, failures can still happen (Hugging Face having a bad moment, a network
blip, etc.), so the frontend (`fetchHFMusicLibrary` in `src/App.tsx`) now:
1. Tries once, and if it fails, **automatically retries once** after a short delay — this quietly
   absorbs transient blips without bothering you.
2. If the retry also fails, shows a **visible error toast** with the actual server-provided
   reason, instead of just leaving the home page blank with only a console warning.

## On branding vs. data source ("SpotifyMine" vs "CoolJaat")

The app's visible name was renamed from **CoolJaat** to **SpotifyMine** — browser tab title,
PWA install name, and the fallback "artist" label shown when a track has no parsed artist name.

One thing was deliberately **left unchanged**: `HF_USER = "CoolJaat"` in `api/_lib/hf.ts` (and
the Hugging Face URLs built from it in `audioUtils.ts`, `LyricsView.tsx`, `api/audio.ts`,
`server.ts`). That's not branding — it's the actual Hugging Face account/repo (`CoolJaat/
my-music-library`) your songs and lyrics live in. Renaming that would point the app at a
dataset repo that doesn't exist, and every song would fail to load. If you ever migrate your
music to a different Hugging Face account, that's the one constant to update — everywhere else
already reads from it rather than hardcoding the name again.

## Running locally

**Prerequisites:** Node.js v18+ (built and tested on v22).

1. Install dependencies:
   ```bash
   npm install
   ```
2. (Optional) Set `GEMINI_API_KEY` in `.env` if you want the AI playlist row — copy
   `.env.example` to `.env` and paste your key in. Nothing else needs a key: songs and audio
   load from the public Hugging Face dataset with no configuration at all.
3. Start the dev server:
   ```bash
   npm run dev
   ```
   This runs `tsx server.ts` — a single Express server on **http://localhost:3000** serving
   both the Vite dev frontend (hot-reloading) and the `/api/hf-tree`, `/api/audio`,
   `/api/ai-playlists` routes locally, mirroring what Vercel does with serverless functions.

Other useful scripts:

| Command | What it does |
|---|---|
| `npm run build` | Production build → `dist/` (also what Vercel runs) |
| `npm run preview` | Serves the built `dist/` locally |
| `npm run lint` | Type-checks the whole project (`tsc --noEmit`) |
| `npm run clean` | Removes `dist/` |

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

## Deploying to Netlify

This app can also be deployed to Netlify instead of (or alongside) Vercel. The same four API
routes are re-implemented a second time as **Netlify Functions** in `netlify/functions/`
(`hf-tree.mts`, `audio.mts`, `ai-playlists.mts`, `admin-delete.mts`) using Netlify's modern
Web-standard `Request`/`Response` function format. Each one imports and reuses the *exact same*
`api/_lib/hf.ts` and `api/_lib/aiPlaylists.ts` that the Vercel routes use — there's one copy of
the actual logic (pagination, the timeout budget, the Gemini prompt), not two copies that could
drift apart.

`netlify.toml` handles the rest:
- Builds with `vite build`, publishes `dist/`.
- Points Netlify at `netlify/functions/` for its functions.
- Each function registers its own route directly via `export const config = { path: "/api/..." }`,
  so the frontend's existing `fetch('/api/hf-tree')`-style calls work completely unchanged —
  no code differences between the Vercel and Netlify builds.
- A catch-all rewrite sends any other route back to `index.html` for SPA routing.
- Cache headers for hashed assets/icons mirror the ones in `vercel.json`.

**To deploy:**
1. Push this repo to GitHub/GitLab/Bitbucket (or drag-and-drop the folder in Netlify's UI).
2. In Netlify: **Add new site → Import an existing project**, pick the repo. Build settings are
   already defined in `netlify.toml`, so the defaults it detects should just work.
3. If you want the AI playlist row, add `GEMINI_API_KEY` under **Site configuration →
   Environment variables**, then trigger a redeploy.

**One important platform difference to know about:** Netlify's **free plan hard-caps serverless
functions at 10 seconds** (Pro raises this to 26 seconds), and — like Vercel — kills the
function from *outside* your code if it's exceeded, meaning your own `try/catch` never even
runs. This is exactly the kind of thing that used to cause a bare, unhelpful "Internal Server
Error" (see [Why songs used to go missing](#why-songs-used-to-go-missing--internal-server-error)
above). The 8-second internal time budget already built into `fetchFullTree()` accounts for
this — it stops pagination and returns whatever's been collected well before either platform's
timeout wall, so this should behave safely on Netlify's free tier too, not just Vercel's.

You do not need to pick just one platform — the `api/` folder (Vercel) and `netlify/functions/`
folder (Netlify) can both stay in the repo at once; each platform only looks at its own folder
and ignores the other.

## App icon

The browser tab icon / favicon and PWA/home-screen icons are the cropped headphones + pickaxe
mark from the logo (`public/favicon.ico`, `favicon-*.png`, `apple-touch-icon.png`,
`pwa-192x192.png`, `pwa-512x512.png`, and maskable variants) — all wired into `index.html` and
the PWA manifest in `vite.config.ts`.

## Environment variables

| Variable | Required? | Used for |
|---|---|---|
| `GEMINI_API_KEY` | Optional | Enables the "Made by AI" playlist row. Without it, that row just doesn't render — nothing else breaks. Set it in `.env` locally, or in Vercel's Project Settings → Environment Variables (all three environments) for production, then redeploy. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). |
| Firebase config (in `src/lib/firebase.ts`) | Required for accounts/playlists | Auth + Firestore for user sign-in and saved playlists. Song streaming works with zero config even without this. |

No key or config of any kind is required for songs to load and play — that data comes entirely
from the public Hugging Face dataset.

## Known limitations

- **`.ogg` / `.flac` on Safari (iOS and macOS):** these formats can't be decoded by Safari's
  media engine at all — this is a codec limitation, not something a header fix can solve. The
  app detects this and shows a clear message / skips them automatically during shuffle rather
  than failing silently.
- **First load after adding a lot of new songs:** since the pagination fix means the app now
  sees your *entire* library (previously anything past ~1000 entries was silently invisible),
  a much larger library may take a little longer to load the first time as it pages through
  everything. A loading-progress indicator for this is a reasonable next improvement if your
  library is very large.
- **Real Android `.apk`/`.aab`:** not produced directly by this project — see
  [pwabuilder.com](https://www.pwabuilder.com) to generate one from the already-configured PWA
  manifest.

## Project structure

```
├── api/                    # Vercel serverless functions (production)
│   ├── _lib/hf.ts          # Shared, paginated Hugging Face fetch logic
│   ├── _lib/aiPlaylists.ts # Gemini playlist generation logic
│   ├── hf-tree.ts          # GET track/file list
│   ├── audio.ts            # Safari-only audio proxy (Content-Type fix)
│   ├── ai-playlists.ts     # GET the daily AI-made playlists (edge-cached 24h)
│   └── admin-delete.ts     # Delete a track from the HF dataset (admin panel)
├── netlify/functions/       # Netlify Functions (production) — same routes, reuses api/_lib/*
│   ├── hf-tree.mts
│   ├── audio.mts
│   ├── ai-playlists.mts
│   └── admin-delete.mts
├── server.ts                # Local dev server (Express) — mirrors api/ routes
├── src/
│   ├── components/          # All UI components (player, sidebar, modals, etc.)
│   ├── lib/firebase.ts      # Firebase auth/Firestore setup
│   ├── utils/
│   │   ├── audioUtils.ts    # Track metadata parsing, Safari detection, HF URL building
│   │   ├── lrcParser.ts     # Synced-lyrics (.lrc) parsing
│   │   └── storage.ts       # Local persistence helpers
│   ├── App.tsx               # Main app state/logic
│   └── types.ts              # Shared TypeScript types
├── public/                   # Static assets, PWA icons
├── vite.config.ts             # Build config + PWA manifest + service worker caching rules
├── vercel.json                 # Vercel routing/build config
└── netlify.toml                 # Netlify routing/build config
```
