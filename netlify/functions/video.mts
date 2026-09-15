import { getStore, getDeployStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";

function store(name: string) {
  const deployContext = (globalThis as any).Netlify?.context?.deploy?.context;
  return deployContext === "production" ? getStore(name) : getDeployStore(name);
}

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });

  const posts = store("crewroom-posts");
  const videos = store("crewroom-videos");
  const post: any = await posts.get(`post-${id}`, { type: "json" });
  if (!post || post.status === "hidden") return new Response("Not found", { status: 404 });
  const blob = await videos.get(id, { type: "blob" });
  if (!blob) return new Response("Not found", { status: 404 });
  return new Response(blob, {
    headers: {
      "content-type": post.mimeType || "video/mp4",
      "cache-control": "public, max-age=300",
    },
  });
};

export const config: Config = { path: "/api/video" };
