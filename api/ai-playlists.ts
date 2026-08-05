// NOTE: This file is intentionally fully self-contained (no imports from
// ./_lib/*) — see the comment at the top of api/hf-tree.ts for why:
// Vercel's Node.js function builder does not reliably include
// underscore-prefixed sibling folders in the deployed bundle for
// standalone API functions, which previously caused a hard runtime crash:
//   Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/api/_lib/aiPlaylists'
// (api/_lib/aiPlaylists.ts is still used by server.ts for local dev, which
// doesn't have this issue.)
//
// IMPORTANT — timing: Vercel logs showed this endpoint hitting
// "Task timed out after 10 seconds" with ZERO application-level error logs,
// meaning the whole function (library fetch + Gemini call, retried across
// up to 3 models) was hard-killed by the platform mid-request, before our
// own try/catch ever got a chance to run or respond. Everything below is
// built around one hard rule: the handler must ALWAYS send its own response
// well before Vercel's real 10-second limit, even if that means responding
// with "try again shortly" instead of actual playlists.

export const config = {
  runtime: "nodejs",
};

const HF_USER = "CoolJaat";
const HF_REPO = "my-music-library";
const AUDIO_EXTS = [".mp3", ".wav", ".m4a", ".ogg", ".flac"];
const GEMINI_MODEL = "gemini-3.6-flash";
const MIN_TRACKS_PER_MIX = 2;

// Hard ceiling for the WHOLE handler (library fetch + every Gemini attempt
// combined), kept well under Vercel's real 10s limit so we always control
// the response ourselves instead of risking a platform-level 504.
const HANDLER_DEADLINE_MS = 8500;

const TARGET_MIXES: { name: string; emoji: string; hint: string; description: string }[] = [
  { name: "Punjabi Mix", emoji: "🎧", hint: "Punjabi-language tracks only", description: "Punjabi-language tracks from your library." },
  { name: "Haryanvi Mix", emoji: "🌾", hint: "Haryanvi-language tracks only", description: "Haryanvi-language tracks from your library." },
  { name: "Punjabi + Haryanvi Mix", emoji: "🔥", hint: "combined — every Punjabi-language AND Haryanvi-language track together in one mix", description: "Punjabi and Haryanvi tracks together in one mix." },
  { name: "Hindi Mix", emoji: "🎬", hint: "Hindi-language tracks", description: "Hindi-language tracks from your library." },
  { name: "Love Mix", emoji: "❤️", hint: "romantic / love songs, any language", description: "Romantic songs, any language." },
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

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(timeoutMs, 500));
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

async function fetchLibrary(deadline: number): Promise<HFTrackDescriptor[]> {
  const buildUrl = (query: string) =>
    `https://huggingface.co/api/datasets/${encodeURIComponent(HF_USER)}/${encodeURIComponent(HF_REPO)}/tree/main${query}`;

  let url: string | null = buildUrl("?recursive=true");
  let all: any[] = [];
  let triedSimpleFallback = false;
  let pageCount = 0;
  const MAX_PAGES = 200;

  while (url && pageCount < MAX_PAGES) {
    const remaining = deadline - Date.now();
    if (remaining < 500) break;
    pageCount++;

    let response: Response;
    try {
      response = await fetchWithTimeout(url, remaining);
    } catch {
      break;
    }

    if (!response.ok && all.length === 0 && !triedSimpleFallback) {
      triedSimpleFallback = true;
      url = buildUrl("");
      try {
        response = await fetchWithTimeout(url, deadline - Date.now());
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

// No descriptions requested from Gemini anymore — generating prose for each
// mix adds meaningful output tokens (and therefore latency) for something
// we can just supply statically from TARGET_MIXES. This alone noticeably
// shrinks response time.
function buildPrompt(library: HFTrackDescriptor[]): string {
  const list = library
    .map((t, i) => `${i}. ${t.artist ? `${t.artist} - ` : ""}${t.title}`)
    .join("\n");

  const mixLines = TARGET_MIXES.map((m) => `- "${m.name}": ${m.hint}`).join("\n");

  return `Classify songs from a fixed library into playlists. Songs (numbered):

${list}

Playlists to fill, using ONLY the numbers above (never invent a song):
${mixLines}

Rules:
- Return every matching index per playlist, not just a few.
- A song can appear in more than one playlist if it fits more than one.
- Only include a playlist if it has at least ${MIN_TRACKS_PER_MIX} matches.
- Skip unclear matches.
- Output indices only — no descriptions, no extra text.`;
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
          indices: { type: "ARRAY", items: { type: "INTEGER" } },
        },
        required: ["name", "indices"],
      },
    },
  },
  required: ["playlists"],
};

async function callGemini(model: string, apiKey: string, prompt: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(timeoutMs, 500));
  try {
    return await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0.3,
          },
        }),
      }
    );
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: any, res: any) {
  const deadline = Date.now() + HANDLER_DEADLINE_MS;

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
    const library = await fetchLibrary(Date.now() + 2500); // library fetch gets its own short slice of the budget
    if (library.length === 0) {
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ generatedAt: new Date().toISOString(), playlists: [] });
      return;
    }

    const prompt = buildPrompt(library);
    const modelCandidates = [GEMINI_MODEL, "gemini-3.5-flash", "gemini-2.5-flash"];
    const RETRYABLE_STATUSES = new Set([404, 429, 500, 502, 503, 504]);

    let geminiRes: Response | null = null;
    let lastErrText = "";
    let ranOutOfTime = false;

    for (const model of modelCandidates) {
      const remaining = deadline - Date.now();
      if (remaining < 1500) {
        // Not enough of the budget left for a meaningful attempt — stop
        // trying rather than risk getting hard-killed mid-request.
        ranOutOfTime = true;
        break;
      }
      try {
        geminiRes = await callGemini(model, apiKey, prompt, remaining);
      } catch (e: any) {
        lastErrText = e?.name === "AbortError" ? "request timed out" : e?.message || "network error";
        geminiRes = null;
        continue; // try the next model if time remains
      }
      if (geminiRes.ok) break;
      lastErrText = await geminiRes.text().catch(() => "");
      if (!RETRYABLE_STATUSES.has(geminiRes.status)) break; // e.g. bad key — no point trying other models
    }

    if (!geminiRes || !geminiRes.ok) {
      console.error("Gemini API error:", geminiRes?.status, lastErrText);
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({
        generatedAt: new Date().toISOString(),
        playlists: [],
        note: ranOutOfTime
          ? "AI playlist generation is taking longer than usual — try again shortly."
          : `AI playlist generation failed upstream (${geminiRes?.status || lastErrText || "network error"}).`,
      });
      return;
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed: { playlists?: { name: string; indices: number[] }[] };
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
          name: p.name || target?.name || `Mix ${i + 1}`,
          emoji: target?.emoji || "✨",
          description: target?.description || "",
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
