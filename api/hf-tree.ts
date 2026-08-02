import { fetchFullTree, HF_USER, HF_REPO } from "./_lib/hf";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req: any, res: any) {
  const user = (req.query.user as string) || HF_USER;
  const repo = (req.query.repo as string) || HF_REPO;

  try {
    const data = await fetchFullTree(user, repo);
    // Short-lived edge cache only — a handful of seconds to absorb burst
    // traffic (many users loading the app at once), not a "check back in
    // 5 minutes" cache. This keeps the library close to real-time instead
    // of serving a stale list while new/changed files wait to appear.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=15, stale-while-revalidate=30");
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
