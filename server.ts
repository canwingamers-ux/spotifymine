import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Readable } from "stream";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Hugging Face Proxy API Endpoint
  app.get("/api/hf-tree", async (req, res) => {
    const user = (req.query.user as string) || "CoolJaat";
    const repo = (req.query.repo as string) || "my-music-library";

    try {
      // Try recursive tree first
      const recursiveUrl = `https://huggingface.co/api/datasets/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/tree/main?recursive=true`;
      let response = await fetch(recursiveUrl);
      
      if (!response.ok) {
        // Fallback to simple tree
        const simpleUrl = `https://huggingface.co/api/datasets/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/tree/main`;
        response = await fetch(simpleUrl);
      }

      if (!response.ok) {
        return res.status(response.status).json({
          error: `Hugging Face API returned status ${response.status}`,
          user,
          repo,
        });
      }

      const data = await response.json();
      return res.json(data);
    } catch (err: any) {
      console.error("HF fetch error:", err);
      return res.status(500).json({
        error: err.message || "Failed to fetch from Hugging Face",
        user,
        repo,
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
