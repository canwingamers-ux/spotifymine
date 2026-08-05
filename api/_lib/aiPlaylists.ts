// Used by server.ts for local dev only. The Vercel-deployed version
// (api/ai-playlists.ts) is intentionally self-contained instead of
// importing this file — see the comment at the top of api/hf-tree.ts for
// why cross-file imports from api/_lib/* don't reliably survive Vercel's
// deployment bundling for standalone API functions.
import { fetchLibrary, HFTrackDescriptor } from "./hf";

const GEMINI_MODEL = "gemini-3.6-flash";
const MIN_TRACKS_PER_MIX = 2;

const TARGET_MIXES: { name: string; emoji: string; hint: string; description: string }[] = [
  { name: "Punjabi Mix", emoji: "🎧", hint: "Punjabi-language tracks only", description: "Punjabi-language tracks from your library." },
  { name: "Haryanvi Mix", emoji: "🌾", hint: "Haryanvi-language tracks only", description: "Haryanvi-language tracks from your library." },
  { name: "Punjabi + Haryanvi Mix", emoji: "🔥", hint: "combined — every Punjabi-language AND Haryanvi-language track together in one mix", description: "Punjabi and Haryanvi tracks together in one mix." },
  { name: "Hindi Mix", emoji: "🎬", hint: "Hindi-language tracks", description: "Hindi-language tracks from your library." },
  { name: "Love Mix", emoji: "❤️", hint: "romantic / love songs, any language", description: "Romantic songs, any language." },
];

export interface AiPlaylistsResult {
  generatedAt: string;
  playlists: { id: string; name: string; emoji: string; description: string; paths: string[] }[];
  note?: string;
}

// No descriptions requested from Gemini — supplied statically from
// TARGET_MIXES instead, to match api/ai-playlists.ts exactly (which drops
// them specifically to cut output tokens/latency on Vercel's 10s limit).
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

async function callGemini(model: string, apiKey: string, prompt: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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

export async function generateAiPlaylists(apiKey?: string): Promise<AiPlaylistsResult> {
  if (!apiKey) {
    return { generatedAt: new Date().toISOString(), playlists: [], note: "No Gemini API key configured yet." };
  }

  const library = await fetchLibrary();
  if (library.length === 0) {
    return { generatedAt: new Date().toISOString(), playlists: [] };
  }

  const prompt = buildPrompt(library);
  const modelCandidates = [GEMINI_MODEL, "gemini-3.5-flash", "gemini-2.5-flash"];
  let geminiRes: Response | null = null;
  let lastErrText = "";

  const RETRYABLE_STATUSES = new Set([404, 429, 500, 502, 503, 504]);
  for (const model of modelCandidates) {
    try {
      geminiRes = await callGemini(model, apiKey, prompt);
    } catch (e: any) {
      lastErrText = e?.name === "AbortError" ? "request timed out" : e?.message || "network error";
      geminiRes = null;
      continue;
    }
    if (geminiRes.ok) break;
    lastErrText = await geminiRes.text().catch(() => "");
    if (!RETRYABLE_STATUSES.has(geminiRes.status)) break;
  }

  if (!geminiRes || !geminiRes.ok) {
    console.error("Gemini API error:", geminiRes?.status, lastErrText);
    return {
      generatedAt: new Date().toISOString(),
      playlists: [],
      note: `AI playlist generation failed upstream (${geminiRes?.status || lastErrText || "network error"}).`,
    };
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

  return { generatedAt: new Date().toISOString(), playlists };
}
