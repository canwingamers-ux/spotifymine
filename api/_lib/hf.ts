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
    return { title: title || "Untitled Track", artist: artist || "SpotifyMine" };
  }
  if (cleanStr.includes("-")) {
    const parts = cleanStr.split("-");
    const title = formatWords(parts[0].trim());
    const artist = formatWords(parts.slice(1).join("-").trim());
    return { title: title || "Untitled Track", artist: artist || "SpotifyMine" };
  }
  return { title: formatWords(cleanStr) || "Untitled Track", artist: "SpotifyMine" };
}

/**
 * Fetches EVERY entry in the dataset tree, following Hugging Face's
 * pagination (Link header, rel="next") until exhausted. The previous
 * single-fetch version silently truncated at the API's per-page cap,
 * which is why songs past that point never showed up anywhere in the
 * app (home, search, AI playlists — all consumed the same truncated list).
 *
 * Hardened against the actual cause of the "Internal Server Error":
 * a malformed/relative next-page URL, or a slow/hanging request, used to
 * throw an uncaught error and take the whole request down. Now:
 *  - the "next" URL is resolved safely (handles a relative path instead of
 *    crashing on fetch() with an invalid absolute URL)
 *  - each page fetch has a timeout, so a hung request can't hang the whole
 *    function
 *  - there's a hard cap on total pages as a safety net against any future
 *    pagination-loop bug
 *  - once at least one page has been collected, any failure just stops
 *    pagination and returns what's already been gathered, instead of
 *    throwing and losing everything
 */
const PAGE_TIMEOUT_MS = 8_000;
const MAX_PAGES = 200;
// Vercel's free Hobby plan enforces a hard 10-second function timeout
// regardless of the `maxDuration` set in vercel.json, unless Fluid Compute
// is explicitly enabled on the project. If pagination runs past that wall,
// Vercel kills the function from OUTSIDE our code — our try/catch never
// even runs — which is exactly what shows up as a bare, unhelpful
// "Internal Server Error" with no JSON body. Stopping pagination safely
// before that wall and returning whatever's been collected so far avoids
// that entirely; the short 15s edge cache on this endpoint (see
// api/hf-tree.ts) means a follow-up request picks up quickly anyway.
const OVERALL_BUDGET_MS = 8_000;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Resolves a "next" URL from a Link header against a known-good base,
 * so a relative or otherwise malformed value can't crash fetch(). Returns
 * null (stopping pagination) instead of throwing if it's unusable. */
function resolveNextUrl(nextUrl: string, base: string): string | null {
  try {
    return new URL(nextUrl, base).toString();
  } catch {
    return null;
  }
}

export async function fetchFullTree(
  user: string = HF_USER,
  repo: string = HF_REPO
): Promise<any[]> {
  let url: string | null =
    `https://huggingface.co/api/datasets/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/tree/main?recursive=true`;
  let all: any[] = [];
  let triedSimpleFallback = false;
  let pageCount = 0;
  const startedAt = Date.now();

  while (url && pageCount < MAX_PAGES) {
    if (Date.now() - startedAt > OVERALL_BUDGET_MS) {
      // Out of time budget — stop and return what we have rather than
      // risk the platform killing the whole function mid-request.
      break;
    }
    pageCount++;
    const currentUrl: string = url;
    let response: Response;

    try {
      response = await fetchWithTimeout(currentUrl, PAGE_TIMEOUT_MS);
    } catch (err) {
      // Network error, timeout, or abort — stop here and return whatever
      // we already have rather than losing the whole library.
      if (all.length > 0) break;
      throw new Error(
        `Hugging Face request failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!response.ok && all.length === 0 && !triedSimpleFallback) {
      triedSimpleFallback = true;
      const fallbackUrl = `https://huggingface.co/api/datasets/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/tree/main`;
      try {
        response = await fetchWithTimeout(fallbackUrl, PAGE_TIMEOUT_MS);
        url = fallbackUrl;
      } catch (err) {
        throw new Error(
          `Hugging Face request failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    if (!response.ok) {
      if (all.length > 0) break; // keep whatever pages we already fetched
      throw new Error(`Hugging Face API returned status ${response.status}`);
    }

    let page: unknown;
    try {
      page = await response.json();
    } catch {
      // Malformed/non-JSON response body — stop here rather than crashing.
      if (all.length > 0) break;
      throw new Error("Hugging Face API returned an unreadable response");
    }

    if (Array.isArray(page)) all = all.concat(page);

    const linkHeader = response.headers.get("link") || response.headers.get("Link");
    const nextMatch = linkHeader ? /<([^>]+)>\s*;\s*rel="next"/.exec(linkHeader) : null;
    url = nextMatch ? resolveNextUrl(nextMatch[1], currentUrl) : null;
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
