// NOTE: This file is intentionally fully self-contained (no imports from
// ./_lib/*) — see the comment at the top of api/hf-tree.ts for why:
// Vercel's Node.js function builder does not reliably include
// underscore-prefixed sibling folders in the deployed bundle for
// standalone API functions, which previously caused a hard runtime crash:
//   Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/api/_lib/aiPlaylists'
// (api/_lib/aiPlaylists.ts is still used by server.ts for local dev, which
// doesn't have this issue.)

export const config = {
  runtime: "nodejs",
};

const HF_USER = "CoolJaat";
const HF_REPO = "my-music-library";
const AUDIO_EXTS = [".mp3", ".wav", ".m4a", ".ogg", ".flac"];
const GEMINI_MODEL = "gemini-3.6-flash";
const MIN_TRACKS_PER_MIX = 2;

// The four mixes explicitly requested — Gemini only ever picks real tracks
// from the actual library to fill these, never invents song names.
const TARGET_MIXES: { name: string; emoji: string; hint: string }[] = [
  { name: "Punjabi Mix", emoji: "🎧", hint: "Punjabi-language tracks only" },
  { name: "Haryanvi Mix", emoji: "🌾", hint: "Haryanvi-language tracks only" },
  { name: "Punjabi + Haryanvi Mix", emoji: "🔥", hint: "combined — every Punjabi-language AND Haryanvi-language track together in one mix" },
  { name: "Hindi Mix", emoji: "🎬", hint: "Hindi-language tracks" },
  { name: "Love Mix", emoji: "❤️", hint: "romantic / love songs, any language" },
];

interface HFTrackDescriptor {
  path: string;
  title: string;
  artist: string;
}

export interface AiPlaylistsResult {
  generatedAt: string;
  playlists: { id: string; name: string; emoji: string; description: string; paths: string[] }[];
  note?: string;
}

async function fetchWithTimeout(url: string, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parseBasic(filePath: string): { title: string; artist: string } {
  const base = filePath.split("/").pop() || filePath;
  const noExt = base.replace(/\.[^/.]+$/, "");
  const parts = noExt.split(" - ");
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
  }
  return { artist: "", title: noExt.trim() };
}

async function fetchLibrary(): Promise<HFTrackDescriptor[]> {
  const buildUrl = (query: string) =>
    `https://huggingface.co/api/datasets/${encodeURIComponent(HF_USER)}/${encodeURIComponent(HF_REPO)}/tree/main${query}`;

  let url: string | null = buildUrl("?recursive=true");
  let all: any[] = [];
  let triedSimpleFallback = false;
  let pageCount = 0;
  const MAX_PAGES = 200;
  const TIME_BUDGET_MS = 6000; // this function has its own Gemini call to make too
  const startedAt = Date.now();

  while (url && pageCount < MAX_PAGES) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;
    pageCount++;

    let response: Response;
    try {
      response = await fetchWithTimeout(url);
    } catch {
      break;
    }

    if (!response.ok && all.length === 0 && !triedSimpleFallback) {
      triedSimpleFallback = true;
      url = buildUrl("");
      try {
        response = await fetchWithTimeout(url);
      } catch {
        break;
      }
    }

    if (!response.ok) {
      if (all.length > 0) break;
      return [];
    }

    let page: any;
    try {
      page = await response.json();
    } catch {
      break;
    }
    if (!Array.isArray(page)) break;
    all = all.concat(page);

    let nextUrl: string | null = null;
    const linkHeader = response.headers.get("link") || response.headers.get("Link");
    if (linkHeader) {
      const nextMatch = /<([^>]+)>\s*;\s*rel="next"/.exec(linkHeader);
      if (nextMatch) {
        try {
          nextUrl = new URL(nextMatch[1], "https://huggingface.co").toString();
        } catch {
          nextUrl = null;
        }
      }
    }
    url = nextUrl;
  }

  return all
    .filter((item: any) => {
      if (item.type !== "file" || !item.path) return false;
      const ext = item.path.substring(item.path.lastIndexOf(".")).toLowerCase();
      return AUDIO_EXTS.includes(ext);
    })
    .map((item: any) => {
      const { title, artist } = parseBasic(item.path);
      return { path: item.path as string, title, artist };
    });
}

function buildPrompt(library: HFTrackDescriptor[]): string {
  const list = library
    .map((t, i) => `${i}. ${t.artist ? `${t.artist} - ` : ""}${t.title}`)
    .join("\n");

  const mixLines = TARGET_MIXES.map((m) => `- "${m.name}": ${m.hint}`).join("\n");

  return `You are curating themed playlists for a music app from a fixed song library. Below is every song available, numbered.

${list}

Build these exact playlists, choosing ONLY from the numbered list above (never invent a song that isn't listed):
${mixLines}

Rules:
- For each playlist, return the indices (numbers from the list above) of every song that genuinely fits that theme. Include ALL matching songs, not just a few.
- A song can appear in more than one playlist if it genuinely fits more than one theme.
- Only include a playlist in your output if it has at least ${MIN_TRACKS_PER_MIX} matching songs.
- Write a short one-sentence description for each playlist.
- Do not include songs that don't clearly match — when unsure, leave it out.`;
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    playlists: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          description: { type: "STRING" },
          indices: { type: "ARRAY", items: { type: "INTEGER" } },
        },
        required: ["name", "description", "indices"],
      },
    },
  },
  required: ["playlists"],
};

export default async function handler(req: any, res: any) {
  // Prefer a key the browser sends (entered in-app, stored in that
  // browser's localStorage only); fall back to a server env var if one is
  // configured. Whichever key generated the cached response is what every
  // visitor sees for the rest of that 24h window (see Cache-Control below).
  // Prefer the server-configured key (GEMINI_API_KEY in Vercel's project
  // env vars) — that's what makes the AI mixes work reliably for every
  // visitor, not just whichever browser happened to have a key saved in
  // localStorage. The in-app key (sent as this header) is only a fallback
  // for quick testing before setting up the env var properly.
  const headerKey = (req.headers?.["x-gemini-key"] as string) || "";
  const apiKey = process.env.GEMINI_API_KEY || headerKey || "";

  if (!apiKey) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      generatedAt: new Date().toISOString(),
      playlists: [],
      note: "No Gemini API key configured yet.",
    });
    return;
  }

  try {
    const library = await fetchLibrary();
    if (library.length === 0) {
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ generatedAt: new Date().toISOString(), playlists: [] });
      return;
    }

    const modelCandidates = [GEMINI_MODEL, "gemini-3.5-flash", "gemini-2.5-flash"];
    let geminiRes: Response | null = null;
    let lastErrText = "";

    const RETRYABLE_STATUSES = new Set([404, 429, 500, 502, 503, 504]);
    for (const model of modelCandidates) {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: buildPrompt(library) }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: RESPONSE_SCHEMA,
              temperature: 0.4,
            },
          }),
        }
      );
      if (geminiRes.ok) break;
      lastErrText = await geminiRes.text().catch(() => "");
      if (!RETRYABLE_STATUSES.has(geminiRes.status)) break; // e.g. bad key (401/403) — no point trying other models
    }

    if (!geminiRes || !geminiRes.ok) {
      const errText = geminiRes ? await geminiRes.text().catch(() => lastErrText) : lastErrText;
      console.error("Gemini API error:", geminiRes?.status, errText);
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({
        generatedAt: new Date().toISOString(),
        playlists: [],
        note: `AI playlist generation failed upstream (${geminiRes?.status || "network error"}).`,
      });
      return;
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed: { playlists?: { name: string; description: string; indices: number[] }[] };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { playlists: [] };
    }

    const playlists = (parsed.playlists || [])
      .map((p, i) => {
        const paths = (p.indices || [])
          .map((idx) => library[idx]?.path)
          .filter((p): p is string => Boolean(p));
        const target = TARGET_MIXES.find((m) => m.name.toLowerCase() === p.name?.toLowerCase());
        return {
          id: `ai_${i}_${p.name?.replace(/\s+/g, "_").toLowerCase() || i}`,
          name: p.name || `Mix ${i + 1}`,
          emoji: target?.emoji || "✨",
          description: p.description || "",
          paths,
        };
      })
      .filter((p) => p.paths.length >= MIN_TRACKS_PER_MIX);

    const result: AiPlaylistsResult = { generatedAt: new Date().toISOString(), playlists };

    // Shared across every visitor for 24h — the first request of the day
    // triggers generation, everyone else for the rest of that day gets
    // this identical cached response, at zero extra Gemini calls.
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=3600");
    res.status(200).json(result);
  } catch (err: any) {
    console.error("AI playlists error:", err);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      generatedAt: new Date().toISOString(),
      playlists: [],
      note: err?.message || "Failed to generate AI playlists.",
    });
  }
}
