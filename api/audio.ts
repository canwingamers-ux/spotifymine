export const config = {
  runtime: "nodejs",
};

export default async function handler(req: any, res: any) {
  const user = (req.query.user as string) || "CoolJaat";
  const repo = (req.query.repo as string) || "my-music-library";
  const file = req.query.file as string;

  if (!file) {
    res.status(400).send("Missing file parameter");
    return;
  }

  try {
    const url = `https://huggingface.co/datasets/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/resolve/main/${encodeURIComponent(file)}`;

    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {},
      redirect: "follow",
    };

    if (req.headers.range) {
      (fetchOptions.headers as any).range = req.headers.range;
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      res.status(response.status).send(`Error fetching audio: ${response.statusText}`);
      return;
    }

    const headers = new Headers(response.headers);
    headers.delete("content-encoding");
    headers.set("access-control-allow-origin", "*");
    headers.set("access-control-allow-methods", "GET, HEAD, OPTIONS");
    headers.set("access-control-allow-headers", "Content-Type, Range");
    headers.set("access-control-expose-headers", "Accept-Ranges, Content-Encoding, Content-Length, Content-Range");
    headers.set("cross-origin-resource-policy", "cross-origin");

    res.status(response.status);
    headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (response.body) {
      const reader = response.body.getReader();
      // Stream chunks directly to the Node response
      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(Buffer.from(value));
        return pump();
      };
      await pump();
    } else {
      res.end();
    }
  } catch (err: any) {
    console.error("Proxy audio error:", err);
    res.status(500).send("Internal Server Error");
  }
}
