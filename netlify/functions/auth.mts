import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";

const users = () => getStore("crewroom-users", { consistency: "strong" });
const sessions = () => getStore("crewroom-sessions", { consistency: "strong" });
const enc = new TextEncoder();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(hex: string) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
async function sha256(value: string) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))));
}
async function hashPassword(password: string, saltHex: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations: 120000 }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}
function publicUser(u: any) {
  return { id: u.id, email: u.email, name: u.name, bio: u.bio || "", role: u.role || "user", createdAt: u.createdAt };
}
async function userKey(email: string) { return `user-${await sha256(email.trim().toLowerCase())}`; }
async function createSession(userKeyValue: string, userId: string) {
  const token = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
  const now = Date.now();
  await sessions().setJSON(`session-${token}`, { userKey: userKeyValue, userId, createdAt: now, expiresAt: now + 30 * 24 * 60 * 60 * 1000 });
  return token;
}
async function getSession(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const s: any = await sessions().get(`session-${token}`, { type: "json" });
  if (!s || s.expiresAt < Date.now()) { if (s) await sessions().delete(`session-${token}`); return null; }
  const u: any = await users().get(s.userKey, { type: "json" });
  if (!u) return null;
  return { token, session: s, user: u };
}

export default async (req: Request, _context: Context) => {
  if (req.method === "GET") {
    const current = await getSession(req);
    return current ? json({ user: publicUser(current.user) }) : json({ error: "ログインが必要です。" }, 401);
  }

  if (req.method === "POST") {
    const body: any = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    if (action === "register") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const name = String(body.name || "").trim();
      const bio = String(body.bio || "").trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "正しいメールアドレスを入力してください。" }, 400);
      if (password.length < 8) return json({ error: "パスワードは8文字以上で入力してください。" }, 400);
      if (!name) return json({ error: "表示名を入力してください。" }, 400);
      const key = await userKey(email);
      if (await users().getMetadata(key)) return json({ error: "このメールアドレスはすでに登録されています。" }, 409);
      const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
      const passwordHash = await hashPassword(password, salt);
      const adminEmail = String(process.env.CREWROOM_ADMIN_EMAIL || "").trim().toLowerCase();
      const u = { id: crypto.randomUUID(), email, name, bio: bio || "CREWROOMをはじめました。", role: adminEmail && email === adminEmail ? "admin" : "user", salt, passwordHash, createdAt: Date.now() };
      await users().setJSON(key, u);
      const token = await createSession(key, u.id);
      return json({ token, user: publicUser(u) }, 201);
    }
    if (action === "login") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const key = await userKey(email);
      const u: any = await users().get(key, { type: "json" });
      if (!u) return json({ error: "メールアドレスまたはパスワードが違います。" }, 401);
      const candidate = await hashPassword(password, u.salt);
      if (candidate !== u.passwordHash) return json({ error: "メールアドレスまたはパスワードが違います。" }, 401);
      const token = await createSession(key, u.id);
      return json({ token, user: publicUser(u) });
    }
    if (action === "logout") {
      const current = await getSession(req);
      if (current) await sessions().delete(`session-${current.token}`);
      return json({ ok: true });
    }
    return json({ error: "Invalid action" }, 400);
  }

  if (req.method === "PATCH") {
    const current = await getSession(req);
    if (!current) return json({ error: "ログインが必要です。" }, 401);
    const body: any = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const bio = String(body.bio || "").trim();
    if (!name) return json({ error: "表示名を入力してください。" }, 400);
    const updated = { ...current.user, name, bio };
    await users().setJSON(current.session.userKey, updated);
    return json({ user: publicUser(updated) });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config: Config = { path: "/api/auth" };
