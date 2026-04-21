const express = require("express");
const fs      = require("fs");
const path    = require("path");

const app  = express();
const PORT = 3000;

// ── Config ───────────────────────────────────────────────
const RATE_LIMIT = 60;
const WINDOW_MS  = 60 * 1000;
const MAX_IPS    = 10_000; // batas entri map agar tidak OOM

// ── Load & index data (cold start) ───────────────────────
let wilayah          = [];
let kecamatanIndex   = new Map(); // kode_kecamatan → kode kecamatan
let desaByKecamatan  = new Map(); // kode_kecamatan → [desa, ...]

try {
  const filePath = path.join(__dirname, "wilayah.json");
  wilayah = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // Build index sekali — O(n) saat startup, bukan per-request
  for (const item of wilayah) {
    if (!item.kode) continue;

    if (item.kode.length === 8) {
      // Kecamatan
      const key = item.nama?.toLowerCase();
      if (key) {
        const list = kecamatanIndex.get(key) ?? [];
        list.push(item.kode);
        kecamatanIndex.set(key, list);
      }
    } else if (item.kode.length === 13) {
      // Desa
      const list = desaByKecamatan.get(item.kode_kecamatan) ?? [];
      list.push(item);
      desaByKecamatan.set(item.kode_kecamatan, list);
    }
  }

  console.log(`Data loaded: ${wilayah.length} entri`);
} catch (err) {
  console.error("Gagal load JSON:", err.message);
}

// ── Rate limiter ─────────────────────────────────────────
const rateLimitMap = new Map();

app.set("trust proxy", 1);

function rateLimiter(req, res, next) {
  // Tolak jika map sudah penuh (cegah OOM dari IP spoofing)
  if (rateLimitMap.size >= MAX_IPS && !rateLimitMap.has(req.ip)) {
    return res.status(503).json({ error: "Server sedang sibuk, coba lagi nanti." });
  }

  const ip  = req.ip;
  const now = Date.now();
  const user = rateLimitMap.get(ip) ?? { count: 0, startTime: now };

  if (now - user.startTime > WINDOW_MS) {
    user.count     = 1;
    user.startTime = now;
  } else {
    user.count += 1;
  }

  rateLimitMap.set(ip, user);

  const remaining = Math.max(0, RATE_LIMIT - user.count);
  const reset     = Math.ceil((user.startTime + WINDOW_MS) / 1000);

  // Beri tahu client sisa kuota (standar RateLimit header)
  res.set({
    "RateLimit-Limit"     : RATE_LIMIT,
    "RateLimit-Remaining" : remaining,
    "RateLimit-Reset"     : reset,
  });

  if (user.count > RATE_LIMIT) {
    res.set("Retry-After", Math.ceil((user.startTime + WINDOW_MS - now) / 1000));
    return res.status(429).json({ error: "Terlalu banyak request, coba lagi dalam 1 menit." });
  }

  next();
}

// Cleanup expired IP — pakai setTimeout rekursif agar tidak overlap
function scheduleCleanup() {
  setTimeout(() => {
    const now = Date.now();
    for (const [ip, data] of rateLimitMap) {
      if (now - data.startTime > WINDOW_MS) rateLimitMap.delete(ip);
    }
    scheduleCleanup();
  }, WINDOW_MS);
}
scheduleCleanup();

app.use(rateLimiter);

// ── Routes ───────────────────────────────────────────────

// GET /
app.get("/", (req, res) => {
  res.json({
    endpoints: {
      desa: "/desa?desa=<nama_desa>&kecamatan=<nama_kecamatan>",
    },
  });
});

// GET /desa?desa=...&kecamatan=...
app.get("/desa", (req, res) => {
  const { desa: namaDesa, kecamatan: namaKecamatan } = req.query;

  if (!namaDesa || !namaKecamatan) {
    return res.status(400).json({ error: "Query 'desa' dan 'kecamatan' wajib diisi." });
  }

  if (!wilayah.length) {
    return res.status(503).json({ error: "Data wilayah tidak tersedia." });
  }

  // O(1) lookup via index — tidak perlu scan seluruh array
  const kecamatanKodes = kecamatanIndex.get(namaKecamatan.toLowerCase());
  if (!kecamatanKodes?.length) {
    return res.json([]);
  }

  const namDesaLower = namaDesa.toLowerCase();
  const result = [];

  for (const kode of kecamatanKodes) {
    const desaList = desaByKecamatan.get(kode) ?? [];
    for (const desa of desaList) {
      if (desa.nama?.toLowerCase() === namDesaLower) {
        result.push(desa);
      }
    }
  }

  res.json(result);
});

// ── Start ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});