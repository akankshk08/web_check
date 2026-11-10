// DEV/TEST ONLY — never deploy. Mimics the Supabase API gateway on :54321:
//   /auth/v1/*    -> real Supabase Auth (GoTrue) container on :9999
//   /storage/v1/* -> a minimal in-process emulation of the Supabase Storage endpoints AgencyOS uses
//                    (signed upload, upload-to-signed-URL, object info, signed download, delete).
// Files are written under .local-storage/. Production uses real Supabase Storage.
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { JWT_SECRET, SERVICE_KEY } from "./keys.mjs";

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const AUTH = process.env.GOTRUE_URL ?? "http://127.0.0.1:9999";
const ROOT = path.resolve(process.env.LOCAL_STORAGE_DIR ?? ".local-storage");
mkdirSync(ROOT, { recursive: true });

const sig = (s) => createHmac("sha256", JWT_SECRET).update(s).digest("base64url");
const makeToken = (kind, objectPath, ttlSec) => {
  const body = Buffer.from(JSON.stringify({ k: kind, p: objectPath, e: Date.now() + ttlSec * 1000 })).toString("base64url");
  return `${body}.${sig(body)}`;
};
const readToken = (token, kind, objectPath) => {
  const [body, s] = String(token ?? "").split(".");
  if (!body || !s) return false;
  const a = Buffer.from(s), b = Buffer.from(sig(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const t = JSON.parse(Buffer.from(body, "base64url").toString());
  return t.k === kind && t.p === objectPath && t.e > Date.now();
};
const isService = (req) => (req.headers.authorization ?? "") === `Bearer ${SERVICE_KEY}`;
const safePath = (p) => {
  const full = path.resolve(ROOT, decodeURIComponent(p));
  if (!full.startsWith(ROOT + path.sep)) throw new Error("bad path");
  return full;
};
const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => resolve(Buffer.concat(c))); });

async function storage(req, res, url) {
  const p = url.pathname.replace(/^\/storage\/v1/, "");
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS" });
    return res.end();
  }
  let m;
  if (req.method === "POST" && (m = p.match(/^\/object\/upload\/sign\/(.+)$/))) {
    if (!isService(req)) return json(res, 403, { error: "forbidden" });
    return json(res, 200, { url: `/object/upload/sign/${m[1]}?token=${makeToken("up", m[1], 7200)}` });
  }
  if (req.method === "PUT" && (m = p.match(/^\/object\/upload\/sign\/(.+)$/))) {
    if (!readToken(url.searchParams.get("token"), "up", m[1])) return json(res, 400, { error: "invalid token" });
    const raw = await readBody(req);
    let bytes = raw;
    if ((req.headers["content-type"] ?? "").startsWith("multipart/form-data")) {
      const form = await new Request("http://x", { method: "POST", headers: { "content-type": req.headers["content-type"] }, body: raw }).formData();
      const file = [...form.values()].find((v) => typeof v !== "string");
      bytes = Buffer.from(await file.arrayBuffer());
    }
    const full = safePath(m[1]);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, bytes);
    return json(res, 200, { Key: m[1] });
  }
  if (req.method === "GET" && (m = p.match(/^\/object\/info\/(.+)$/))) {
    if (!isService(req)) return json(res, 403, { error: "forbidden" });
    try {
      return json(res, 200, { name: m[1], size: statSync(safePath(m[1])).size });
    } catch {
      return json(res, 404, { error: "not_found", message: "Object not found" });
    }
  }
  if (req.method === "POST" && (m = p.match(/^\/object\/sign\/(.+)$/))) {
    if (!isService(req)) return json(res, 403, { error: "forbidden" });
    const { expiresIn = 60 } = JSON.parse((await readBody(req)).toString() || "{}");
    return json(res, 200, { signedURL: `/object/sign/${m[1]}?token=${makeToken("down", m[1], expiresIn)}` });
  }
  if (req.method === "GET" && (m = p.match(/^\/object\/sign\/(.+)$/))) {
    if (!readToken(url.searchParams.get("token"), "down", m[1])) return json(res, 400, { error: "invalid or expired token" });
    try {
      const data = readFileSync(safePath(m[1]));
      const name = url.searchParams.get("download") || path.basename(m[1]);
      res.writeHead(200, { "content-type": "application/octet-stream", "content-disposition": `attachment; filename="${name.replace(/"/g, "")}"` });
      return res.end(data);
    } catch {
      return json(res, 404, { error: "not_found" });
    }
  }
  if (req.method === "DELETE" && (m = p.match(/^\/object\/([^/]+)$/))) {
    if (!isService(req)) return json(res, 403, { error: "forbidden" });
    const { prefixes = [] } = JSON.parse((await readBody(req)).toString() || "{}");
    for (const pre of prefixes) rmSync(safePath(`${m[1]}/${pre}`), { force: true });
    return json(res, 200, prefixes.map((name) => ({ name })));
  }
  return json(res, 404, { error: "not_found", message: `${req.method} ${p} not emulated` });
}

function proxyAuth(req, res, url) {
  const target = new URL(url.pathname.replace(/^\/auth\/v1/, "") + url.search, AUTH);
  const upstream = http.request(target, { method: req.method, headers: { ...req.headers, host: target.host } }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  upstream.on("error", () => json(res, 502, { error: "auth unavailable" }));
  req.pipe(upstream);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    if (url.pathname.startsWith("/auth/v1")) return proxyAuth(req, res, url);
    if (url.pathname.startsWith("/storage/v1")) return storage(req, res, url).catch((e) => json(res, 500, { error: String(e.message) }));
    json(res, 404, { error: "not found" });
  })
  .listen(PORT, () => console.log(`[local-supabase] gateway on http://localhost:${PORT}`));
