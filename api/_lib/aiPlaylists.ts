// Used by server.ts for local dev only. The Vercel-deployed version
// (api/ai-playlists.ts) is intentionally self-contained instead of
// importing this file — see the comment at the top of api/hf-tree.ts for
// why cross-file imports from api/_lib/* don't reliably survive Vercel's
// deployment bundling for standalone API functions.
import { fetchLibrary, HFTrackDescriptor } from "./hf";

// gemini-2.5-flash leads the list because its free-tier quota is far more
// generous (10-15 RPM / 250-1500 RPD) than gemini-3.6-flash's, which is
// only 5 RPM / 20 RPD on the free tier — confirmed directly by the 429
// RESOURCE_EXHAUSTED errors seen in production logs. 3.6/3.5 stay as
// fallbacks for accounts with paid quota on the newer models.
const MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-3.6-flash", "gemini-3.5-flash"];
const MIN_TRACKS_PER_MIX = 2;

const TARGET_MIXES: { name: string; emoji: string; hint: string; description: string }[] = [
  { name: "Punjabi Mix", emoji: "🎧", hint: "Punjabi-language songs", description: "Punjabi-language tracks from your library." },
  { name: "Haryanvi Mix", emoji: "🌾", hint: "Haryanvi-language songs", description: "Haryanvi-language tracks from your library." },
  { name: "Punjabi + Haryanvi Mix", emoji: "🔥", hint: "Punjabi-language OR Haryanvi-language songs (both together)", description: "Punjabi and Haryanvi tracks together in one mix." },
  { name: "Hindi Mix", emoji: "🎬", hint: "Hindi-language songs", description: "Hindi-language tracks from your library." },
  { name: "Love Mix", emoji: "❤️", hint: "romantic / love songs, any language", description: "Romantic songs, any language." },
];

export interface AiPlaylistsResult {
  generatedAt: string;
  playlists: { id: string; name: string; emoji: string; description: string; paths: string[] }[];
  note?: string;
}

const SINGLE_MIX_SCHEMA = {
  type: "OBJECT",
  properties: {
    indices: { type: "ARRAY", items: { type: "INTEGER" } },
  },
  required: ["indices"],
};

function buildSingleMixPrompt(songList: string, hint: string): string {
  return `Numbered song library:

${songList}

Return the index of every song that is ${hint}. Use ONLY the numbers above, never invent one. Include every genuine match, not just a few. Skip anything unclear. Output indices only.`;
}

async function classifyOneMix(
  mix: { name: string; hint: string },
  songList: string,
  apiKey: string,
  timeoutMs = 15000
): Promise<number[] | null> {
  const RETRYABLE_STATUSES = new Set([404, 429, 500, 502, 503, 504]);

  for (const model of MODEL_CANDIDATES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: buildSingleMixPrompt(songList, mix.hint) }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: SINGLE_MIX_SCHEMA,
              temperature: 0.2,
            },
          }),
        }
      );
      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error(`Gemini error for "${mix.name}" on ${model}:`, res.status, errText);
        if (RETRYABLE_STATUSES.has(res.status)) continue; // different model = independent quota bucket
        return null;
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const parsed = JSON.parse(rawText);
      return Array.isArray(parsed.indices) ? parsed.indices : [];
    } catch (e: any) {
      clearTimeout(timer);
      console.error(`"${mix.name}" on ${model} failed:`, e?.name === "AbortError" ? "timed out" : e?.message);
      continue;
    }
  }

  return null;
}

export async function generateAiPlaylists(apiKey?: string): Promise<AiPlaylistsResult> {
  if (!apiKey) {
    return { generatedAt: new Date().toISOString(), playlists: [], note: "No Gemini API key configured yet." };
  }

  const library = await fetchLibrary();
  if (library.length === 0) {
    return { generatedAt: new Date().toISOString(), playlists: [] };
  }

  const songList = library
    .map((t, i) => `${i}. ${t.artist ? `${t.artist} - ` : ""}${t.title}`)
    .join("\n");

  const results = await Promise.all(
    TARGET_MIXES.map((mix) => classifyOneMix(mix, songList, apiKey))
  );

  const playlists = TARGET_MIXES.map((mix, i) => {
    const indices = results[i];
    const paths = (indices || [])
      .map((idx) => library[idx]?.path)
      .filter((p): p is string => Boolean(p));
    return {
      id: `ai_${i}_${mix.name.replace(/\s+/g, "_").toLowerCase()}`,
      name: mix.name,
      emoji: mix.emoji,
      description: mix.description,
      paths,
    };
  }).filter((p) => p.paths.length >= MIN_TRACKS_PER_MIX);

  const allFailed = results.every((r) => r === null);
  return {
    generatedAt: new Date().toISOString(),
    playlists,
    ...(allFailed ? { note: "AI playlist generation is taking longer than usual — try again shortly." } : {}),
  };
}
