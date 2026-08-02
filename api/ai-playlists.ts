import { generateAiPlaylists } from "./_lib/aiPlaylists";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req: any, res: any) {
  try {
    const result = await generateAiPlaylists(process.env.GEMINI_API_KEY);

    // This is what makes it "once a day, same for every visitor": Vercel's
    // edge network caches this exact response for 24h. The first request
    // after the cache expires triggers a fresh Gemini call (and a fresh
    // day's worth of mixes); every request in between — from any user —
    // is served the identical cached JSON, at zero extra Gemini cost.
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=21600");
    res.status(200).json(result);
  } catch (err: any) {
    console.error("AI playlists error:", err);
    res.status(200).json({
      generatedAt: new Date().toISOString(),
      playlists: [],
      note: err?.message || "Failed to generate AI playlists.",
    });
  }
}
