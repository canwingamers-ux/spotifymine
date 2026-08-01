export const config = {
  runtime: "nodejs",
};

export default async function handler(req: any, res: any) {
  const user = (req.query.user as string) || "CoolJaat";
  const repo = (req.query.repo as string) || "my-music-library";

  try {
    const recursiveUrl = `https://huggingface.co/api/datasets/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/tree/main?recursive=true`;
    let response = await fetch(recursiveUrl);

    if (!response.ok) {
      const simpleUrl = `https://huggingface.co/api/datasets/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/tree/main`;
      response = await fetch(simpleUrl);
    }

    if (!response.ok) {
      res.status(response.status).json({
        error: `Hugging Face API returned status ${response.status}`,
        user,
        repo,
      });
      return;
    }

    const data = await response.json();
    // Cache at the edge for 5 min, serve stale for up to 1hr while revalidating
    // in the background. The library rarely changes second-to-second, so this
    // saves a full HF API round-trip (and its payload) on almost every load.
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    res.status(200).json(data);
  } catch (err: any) {
    console.error("HF fetch error:", err);
    res.status(500).json({
      error: err.message || "Failed to fetch from Hugging Face",
      user,
      repo,
    });
  }
}
