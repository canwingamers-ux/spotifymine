// Used by server.ts for local dev only. The Vercel-deployed version
// (api/ai-playlists.ts) is intentionally self-contained instead of
// importing this file — see the comment at the top of api/hf-tree.ts for
// why cross-file imports from api/_lib/* don't reliably survive Vercel's
// deployment bundling for standalone API functions.
import { fetchLibrary, HFTrackDescriptor } from "./hf";

const GEMINI_MODEL = "gemini-3.6-flash";
const MIN_TRACKS_PER_MIX = 2;

const TARGET_MIXES: { name: string; emoji: string; hint: string }[] = [
  { name: "Punjabi Mix", emoji: "🎧", hint: "Punjabi-language tracks only" },
  { name: "Haryanvi Mix", emoji: "🌾", hint: "Haryanvi-language tracks only" },
  { name: "Punjabi + Haryanvi Mix", emoji: "🔥", hint: "combined — every Punjabi-language AND Haryanvi-language track together in one mix" },
  { name: "Hindi Mix", emoji: "🎬", hint: "Hindi-language tracks" },
  { name: "Love Mix", emoji: "❤️", hint: "romantic / love songs, any language" },
];

export interface AiPlaylistsResult {
  generatedAt: string;
  playlists: { id: string; name: string; emoji: string; description: string; paths: string[] }[];
  note?: string;
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

export async function generateAiPlaylists(apiKey?: string): Promise<AiPlaylistsResult> {
  if (!apiKey) {
    return { generatedAt: new Date().toISOString(), playlists: [], note: "No Gemini API key configured yet." };
  }

  const library = await fetchLibrary();
  if (library.length === 0) {
    return { generatedAt: new Date().toISOString(), playlists: [] };
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
    if (!RETRYABLE_STATUSES.has(geminiRes.status)) break;
  }

  if (!geminiRes || !geminiRes.ok) {
    const errText = geminiRes ? await geminiRes.text().catch(() => lastErrText) : lastErrText;
    console.error("Gemini API error:", geminiRes?.status, errText);
    return {
      generatedAt: new Date().toISOString(),
      playlists: [],
      note: `AI playlist generation failed upstream (${geminiRes?.status || "network error"}).`,
    };
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

  return { generatedAt: new Date().toISOString(), playlists };
}
