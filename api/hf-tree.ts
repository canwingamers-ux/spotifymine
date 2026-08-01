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
