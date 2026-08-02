// Shared by api/ai-playlists.ts (Vercel) and server.ts (local dev).
// Files under an underscore-prefixed folder are never turned into their own
// Vercel routes, so this is safe to import without becoming /api/_lib/hf.

export const HF_USER = "CoolJaat";
export const HF_REPO = "my-music-library";

const AUDIO_EXTS = [".mp3", ".wav", ".m4a", ".ogg", ".flac"];

export interface HFTrackDescriptor {
  path: string;
  title: string;
  artist: string;
}

function formatWords(str: string): string {
  if (!str) return "";
  return str
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (/^[0-9]+$/.test(word) || (word.toUpperCase() === word && word.length <= 3)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/** Minimal mirror of src/utils/audioUtils.ts's parseTrackMetadata, just the
 * title/artist parsing (server-side code can't import from src/ safely). */
export function parseBasic(path: string): { title: string; artist: string } {
  const filename = path.split("/").pop() || path;
  const basename = filename.replace(/\.(mp3|wav|m4a|ogg|flac)$/i, "");
  const cleanStr = basename.replace(/_/g, " ").replace(/\s+/g, " ").trim();

  if (cleanStr.includes(" - ")) {
    const parts = cleanStr.split(" - ");
    const title = formatWords(parts[0].trim());
    const artist = formatWords(parts.slice(1).join(" - ").trim());
    return { title: title || "Untitled Track", artist: artist || "CoolJaat" };
  }
  if (cleanStr.includes("-")) {
    const parts = cleanStr.split("-");
    const title = formatWords(parts[0].trim());
    const artist = formatWords(parts.slice(1).join("-").trim());
    return { title: title || "Untitled Track", artist: artist || "CoolJaat" };
  }
  return { title: formatWords(cleanStr) || "Untitled Track", artist: "CoolJaat" };
}

async function fetchWithTimeout(url: string, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches EVERY entry in the dataset tree, following Hugging Face's
 * pagination (Link header, rel="next") until exhausted. The previous
 * single-fetch version silently truncated at the API's per-page cap,
 * which is why songs past that point never showed up anywhere in the
 * app (home, search, AI playlists — all consumed the same truncated list).
 *
 * This is written to NEVER throw once it has collected at least one page —
 * any failure mid-pagination (bad/relative next-page URL, malformed page,
 * slow response, unexpected shape) just stops the loop and returns
 * whatever was already gathered, instead of taking down the whole
 * /api/hf-tree response with an uncaught error.
 */
export async function fetchFullTree(
  user: string = HF_USER,
  repo: string = HF_REPO
): Promise<any[]> {
  const buildUrl = (query: string) =>
    `https://huggingface.co/api/datasets/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/tree/main${query}`;

  let url: string | null = buildUrl("?recursive=true");
  let all: any[] = [];
  let triedSimpleFallback = false;
  let pageCount = 0;
  const MAX_PAGES = 200; // safety cap — well beyond any realistic library size

  while (url && pageCount < MAX_PAGES) {
    pageCount++;

    let response: Response;
    try {
      response = await fetchWithTimeout(url);
    } catch (networkErr) {
      console.error("HF tree fetch failed mid-pagination:", networkErr);
      break; // keep whatever we already collected
    }

    if (!response.ok && all.length === 0 && !triedSimpleFallback) {
      triedSimpleFallback = true;
      url = buildUrl("");
      try {
        response = await fetchWithTimeout(url);
      } catch (networkErr) {
        console.error("HF tree simple-fallback fetch failed:", networkErr);
        break;
      }
    }

    if (!response.ok) {
      if (all.length > 0) break;
      throw new Error(`Hugging Face API returned status ${response.status}`);
    }

    let page: any;
    try {
      page = await response.json();
    } catch (parseErr) {
      console.error("HF tree page wasn't valid JSON:", parseErr);
      break;
    }

    if (!Array.isArray(page)) break; // unexpected shape — stop, keep what we have
    all = all.concat(page);

    let nextUrl: string | null = null;
    const linkHeader = response.headers.get("link") || response.headers.get("Link");
    if (linkHeader) {
      const nextMatch = /<([^>]+)>\s*;\s*rel="next"/.exec(linkHeader);
      if (nextMatch) {
        try {
          // Resolve defensively in case the header gives a relative path
          // instead of a full URL — this was the likely crash cause.
          nextUrl = new URL(nextMatch[1], "https://huggingface.co").toString();
        } catch {
          nextUrl = null;
        }
      }
    }
    url = nextUrl;
  }

  return all;
}

export async function fetchLibrary(
  user: string = HF_USER,
  repo: string = HF_REPO
): Promise<HFTrackDescriptor[]> {
  const data = await fetchFullTree(user, repo);
  if (!Array.isArray(data)) return [];

  return data
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
