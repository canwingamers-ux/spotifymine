import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Readable } from "stream";
import { fetchFullTree, HF_USER, HF_REPO } from "./api/_lib/hf";
import { generateAiPlaylists } from "./api/_lib/aiPlaylists";
import type { AiPlaylistsResult } from "./api/_lib/aiPlaylists";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Hugging Face Proxy API Endpoint
  app.get("/api/hf-tree", async (req, res) => {
    const user = (req.query.user as string) || HF_USER;
    const repo = (req.query.repo as string) || HF_REPO;

    try {
      const data = await fetchFullTree(user, repo);
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=15, stale-while-revalidate=30");
      return res.json(data);
    } catch (err: any) {
      console.error("HF fetch error:", err);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        error: err.message || "Failed to fetch from Hugging Face",
        user,
        repo,
        tracks: [],
      });
    }
  });

  // AI-Generated Themed Playlists (Punjabi Mix, Haryanvi Mix, Hindi Mix,
  // Love Mix) — regenerated once per day, cached in memory here so every
  // request during the day sees the same result, mirroring the 24h edge
  // cache used on Vercel. Accepts the Gemini key from the browser (entered
  // in-app, sent as a header) or falls back to a server env var.
  let aiPlaylistsCache: { result: AiPlaylistsResult; expiresAt: number } | null = null;
  app.get("/api/ai-playlists", async (req, res) => {
    // Prefer the server-configured key so behavior matches Vercel exactly.
    const headerKey = (req.headers["x-gemini-key"] as string) || "";
    const apiKey = process.env.GEMINI_API_KEY || headerKey || "";

    if (!apiKey) {
      return res.json({ generatedAt: new Date().toISOString(), playlists: [], note: "No Gemini API key configured yet." });
    }

    try {
      if (aiPlaylistsCache && aiPlaylistsCache.expiresAt > Date.now()) {
        return res.json(aiPlaylistsCache.result);
      }
      const result = await generateAiPlaylists(apiKey);
      aiPlaylistsCache = { result, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
      return res.json(result);
    } catch (err: any) {
      console.error("AI playlists error:", err);
      return res.status(200).json({
        generatedAt: new Date().toISOString(),
        playlists: [],
        note: err?.message || "Failed to generate AI playlists.",
      });
    }
  });

  // Hugging Face Audio Streaming Proxy
  app.get("/api/audio", async (req, res) => {
    const user = (req.query.user as string) || "CoolJaat";
    const repo = (req.query.repo as string) || "my-music-library";
    const file = (req.query.file as string);

    if (!file) {
      return res.status(400).send("Missing file parameter");
    }

    try {
      const url = `https://huggingface.co/datasets/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/resolve/main/${encodeURIComponent(file)}`;
      
      const fetchOptions: RequestInit = {
        method: req.method,
        headers: {},
        redirect: 'follow',
      };
      
      if (req.headers.range) {
        (fetchOptions.headers as any).range = req.headers.range;
      }
      
      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        return res.status(response.status).send(`Error fetching audio: ${response.statusText}`);
      }

      const headers = new Headers(response.headers);
      headers.delete('content-encoding');
      headers.set('access-control-allow-origin', '*');
      headers.set('access-control-allow-methods', 'GET, HEAD, OPTIONS');
      headers.set('access-control-allow-headers', 'Content-Type, Range');
      headers.set('access-control-expose-headers', 'Accept-Ranges, Content-Encoding, Content-Length, Content-Range');
      headers.set('cross-origin-resource-policy', 'cross-origin');

      res.status(response.status);
      headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      if (response.body) {
        Readable.fromWeb(response.body as any).pipe(res);
      } else {
        res.end();
      }

    } catch (err: any) {
      console.error("Proxy audio error:", err);
      res.status(500).send("Internal Server Error");
    }
  });

  // Admin: delete a song from the Hugging Face dataset repo (write API key
  // is supplied per-request by the client, never stored on this server).
  app.post("/api/admin-delete", async (req, res) => {
    try {
      const { user, repo, path: filePath, apiKey } = req.body || {};

      if (!user || !repo || !filePath) {
        return res.status(400).json({ error: "Missing user, repo, or path" });
      }
      if (!apiKey) {
        return res.status(400).json({ error: "Missing Hugging Face API key" });
      }

      const commitUrl = `https://huggingface.co/api/datasets/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/commit/main`;
      const basename = filePath.replace(/\.[^./]+$/, "");
      const ops = [
        { key: "header", value: { summary: `Delete ${filePath} via AYUSHFLIX admin panel` } },
        { key: "deletedFile", value: { path: filePath } },
        { key: "deletedFile", value: { path: `${basename}.jpg` } },
      ];
      const ndjson = ops.map((op) => JSON.stringify(op)).join("\n");

      const response = await fetch(commitUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/x-ndjson",
        },
        body: ndjson,
      });

      const text = await response.text();

      if (!response.ok) {
        return res.status(response.status).json({
          error: `Hugging Face rejected the delete (${response.status}): ${text.slice(0, 300)}`,
        });
      }

      return res.json({ ok: true });
    } catch (err: any) {
      console.error("Admin delete error:", err);
      return res.status(500).json({ error: err?.message || "Internal Server Error" });
    }
  });

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", hf_config: { user: "CoolJaat", repo: "my-music-library" } });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
