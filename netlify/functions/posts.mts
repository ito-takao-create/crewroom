import { getStore, getDeployStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";

function store(name: string) {
  const deployContext = (globalThis as any).Netlify?.context?.deploy?.context;
  return deployContext === "production"
    ? getStore(name, { consistency: "strong" })
    : getDeployStore(name);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default async (req: Request, _context: Context) => {
  const posts = store("crewroom-posts");
  const videos = store("crewroom-videos");

  if (req.method === "GET") {
    const { blobs } = await posts.list({ prefix: "post-" });
    const rows = await Promise.all(blobs.map(async ({ key }) => posts.get(key, { type: "json" })));
    return json(rows.filter(Boolean).filter((p: any) => p.status !== "hidden").sort((a: any, b: any) => b.createdAt - a.createdAt));
  }

  if (req.method === "POST") {
    const form = await req.formData();
    const title = String(form.get("title") || "").trim();
    const desc = String(form.get("desc") || "").trim();
    const by = String(form.get("by") || "").trim();
    const type = String(form.get("type") || "無料").trim();
    const file = form.get("video");

    if (!title || !by || !(file instanceof File)) return json({ error: "必須項目が不足しています。" }, 400);
    if (!file.type.startsWith("video/")) return json({ error: "動画ファイルを選択してください。" }, 400);
    if (file.size > 4 * 1024 * 1024) return json({ error: "共有テスト版は1本4MBまでです。" }, 413);

    const id = crypto.randomUUID();
    await videos.set(id, file);
    const post = {
      id, title, desc, by, type, status: "public",
      videoName: file.name, mimeType: file.type || "video/mp4",
      videoUrl: `/api/video?id=${encodeURIComponent(id)}`,
      createdAt: Date.now(),
    };
    await posts.setJSON(`post-${id}`, post);
    return json(post, 201);
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config: Config = { path: "/api/posts" };
