import fs from "node:fs/promises";
import formidable from "formidable";

export const config = {
  api: { bodyParser: false }
};

const BASE = "https://cc.fgsi.dpdns.org";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  "Origin": BASE,
  "Referer": BASE + "/"
};

async function cookie(templateId = "") {
  const r = await fetch(templateId ? `${BASE}/create/${templateId}` : `${BASE}/`, {
    headers: HEADERS
  });
  return (r.headers.get("set-cookie") || "").split(";")[0] || "";
}

async function getList() {
  const r = await fetch(`${BASE}/list`, { headers: HEADERS });
  if (!r.ok) throw new Error(`Template API HTTP ${r.status}`);
  const data = await r.json();
  return Object.entries(data).map(([key, val]) => ({
    index: Number(key),
    id: String(val.id),
    title: val.title || "Untitled",
    mediaCount: Number(val.mediaCount || 1),
    resolusi: val.resolusi || "9:16"
  }));
}

async function searchTemplates(q) {
  const c = await cookie();
  const h = { ...HEADERS };
  if (c) h.Cookie = c;
  const r = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}&limit=20&offset=0`, { headers: h });
  if (!r.ok) throw new Error(`Search API HTTP ${r.status}`);
  return await r.json();
}

async function render(templateId, files) {
  const c = await cookie(templateId);
  const form = new FormData();
  form.append("id", String(templateId));

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const buf = await fs.readFile(f.filepath);
    form.append("files", new Blob([buf], { type: f.mimetype || "image/jpeg" }), f.originalFilename || `image_${i+1}.jpg`);
  }

  const h = {
    ...HEADERS,
    Referer: `${BASE}/create/${templateId}`
  };
  if (c) h.Cookie = c;

  const r = await fetch(`${BASE}/jj`, { method: "POST", body: form, headers: h });
  if (!r.ok) throw new Error(`Create task HTTP ${r.status}: ${await r.text()}`);

  const task = await r.json();
  if (!task.task_id) throw new Error(task.error || task.message || "task_id tidak ditemukan");

  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(x => setTimeout(x, 5000));
    const checkHeaders = { ...HEADERS, Referer: `${BASE}/create/${templateId}` };
    if (c) checkHeaders.Cookie = c;

    const cr = await fetch(`${BASE}/task/${task.task_id}`, { headers: checkHeaders });
    if (!cr.ok) continue;

    const data = await cr.json();
    const videoUrl =
      data.video?.videoUrl ||
      (typeof data.video === "string" ? data.video : null) ||
      data.result ||
      data.url ||
      null;

    if (videoUrl) return { taskId: task.task_id, templateId, videoUrl };
    if (data.status === "error") throw new Error(data.error || "Render gagal");
  }

  throw new Error("Render timeout setelah 5 menit");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "GET" && req.url.startsWith("/api/capcut?action=list")) {
      return res.status(200).json(await getList());
    }

    if (req.method === "GET" && req.url.startsWith("/api/capcut?action=search")) {
      const q = new URL(req.url, "http://localhost").searchParams.get("q");
      if (!q) return res.status(400).json({ error: "q wajib diisi" });
      return res.status(200).json(await searchTemplates(q));
    }

    if (req.method === "POST") {
      const form = formidable({ multiples: true, maxFileSize: 20 * 1024 * 1024 });
      const [fields, parsed] = await form.parse(req);
      const templateId = String(Array.isArray(fields.templateId) ? fields.templateId[0] : fields.templateId || "");
      if (!templateId) return res.status(400).json({ error: "templateId wajib diisi" });

      let files = [];
      for (const value of Object.values(parsed)) {
        if (Array.isArray(value)) files.push(...value);
        else if (value) files.push(value);
      }
      files = files.filter(x => x && x.filepath);

      if (!files.length) return res.status(400).json({ error: "Minimal 1 foto" });

      const result = await render(templateId, files);
      return res.status(200).json(result);
    }

    return res.status(404).json({ error: "Not found" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
