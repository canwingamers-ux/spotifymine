import { fetchLibrary, HFTrackDescriptor } from "./hf";

export interface AiPlaylist {
  id: string;
  name: string;
  emoji: string;
  description: string;
  paths: string[];
}

export interface AiPlaylistsResult {
  generatedAt: string | null;
  playlists: AiPlaylist[];
  note?: string;
}

// The exact mixes requested. Add/remove entries here to change what gets
// generated — the model is told to skip any mix it can't fill.
const TARGET_MIXES = [
  { name: "Haryanvi Mix", emoji: "🎧", hint: "Haryanvi-language songs, Haryanvi folk/pop, Haryanvi artists" },
  { name: "Love Mix", emoji: "❤️", hint: "romantic / love songs, any language" },
  { name: "Hindi Mix", emoji: "🎶", hint: "Hindi-language Bollywood/pop songs" },
  { name: "Punjabi Mix", emoji: "🥁", hint: "Punjabi-language songs, Punjabi pop/folk" },
];

const MIN_TRACKS_PER_MIX = 2;
const GEMINI_MODEL = "gemini-3.6-flash";

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function emojiFor(name: string): string {
  return TARGET_MIXES.find((m) => m.name.toLowerCase() === name.toLowerCase())?.emoji || "🎵";
}

function buildPrompt(library: HFTrackDescriptor[]): string {
  const listing = library.map((t, i) => `${i}: ${t.title} - ${t.artist}`).join("\n");
  return `You are curating themed playlists for a music streaming app, using ONLY the exact song library below.

Build EXACTLY these playlists, selecting only the indexes of songs that genuinely fit each theme:
${TARGET_MIXES.map((m) => `- "${m.name}": ${m.hint}`).join("\n")}

Rules:
- Only include a song index if it truly fits the theme, based on its title/artist (language, mood, or genre cues).
- If a mix has fewer than ${MIN_TRACKS_PER_MIX} genuinely matching songs, omit that mix entirely from the output.
- Never invent songs — only use indexes that appear in the list below.
- Write a short, punchy 1-sentence description (under 12 words) per playlist.
- A song may appear in more than one playlist if it genuinely fits both.

Library (index: title - artist):
${listing}`;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    playlists: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          trackIndexes: { type: "array", items: { type: "integer" } },
        },
        required: ["name", "trackIndexes"],
      },
    },
  },
  required: ["playlists"],
};

export async function generateAiPlaylists(apiKey: string | undefined): Promise<AiPlaylistsResult> {
  if (!apiKey) {
    return {
      generatedAt: null,
      playlists: [],
      note: "AI playlists are disabled — GEMINI_API_KEY is not configured on the server.",
    };
  }

  const library = await fetchLibrary();
  if (library.length === 0) {
    return { generatedAt: new Date().toISOString(), playlists: [] };
  }

  // Google renames/deprecates Gemini model IDs fairly often. Try the
  // current model first, and fall back to older-but-still-live ones if it
  // 404s, instead of the whole feature silently going dark.
  const modelCandidates = [GEMINI_MODEL, "gemini-3.5-flash", "gemini-2.5-flash"];
  let geminiRes: Response | null = null;
  let lastErrText = "";

  for (const model of modelCandidates) {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
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
    if (geminiRes.status !== 404) break; // only retry on "model not found"
    lastErrText = await geminiRes.text().catch(() => "");
  }

  if (!geminiRes || !geminiRes.ok) {
    const errText = geminiRes ? await geminiRes.text().catch(() => lastErrText) : lastErrText;
    console.error("Gemini API error:", geminiRes?.status, errText);
    return {
      generatedAt: new Date().toISOString(),
      playlists: [],
      note: "AI playlist generation failed upstream.",
    };
  }

  const geminiData = await geminiRes.json();
  const rawText: string | undefined = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

  let parsed: { playlists: { name: string; description?: string; trackIndexes: number[] }[] };
  try {
    parsed = JSON.parse(rawText || "");
  } catch {
    return {
      generatedAt: new Date().toISOString(),
      playlists: [],
      note: "AI response wasn't valid JSON.",
    };
  }

  const playlists: AiPlaylist[] = (parsed.playlists || [])
    .map((p) => {
      const uniqueIndexes = Array.from(new Set(p.trackIndexes || []));
      const paths = uniqueIndexes
        .map((i) => library[i]?.path)
        .filter((x): x is string => Boolean(x));
      return {
        id: slugify(p.name),
        name: p.name,
        emoji: emojiFor(p.name),
        description: p.description || "",
        paths,
      };
    })
    .filter((p) => p.paths.length >= MIN_TRACKS_PER_MIX);

  return { generatedAt: new Date().toISOString(), playlists };
}
