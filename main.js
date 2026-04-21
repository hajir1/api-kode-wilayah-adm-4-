const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// ✅ define path
const filePath = path.join(__dirname, "wilayah.json");

// load sekali (cold start)
let wilayah = [];

try {
  wilayah = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  console.log("Data loaded:", wilayah.length);
} catch (err) {
  console.error("Gagal load JSON:", err);
}

// root
app.get("/", (req, res) => {
  res.json({
    message:
      "gunakan /desa?desa=nama_desa&kecamatan=nama_kecamatan",
  });
});

// endpoint utama
app.get("/desa", (req, res) => {
  try {
    const { desa: namaDesa, kecamatan: namaKecamatan } = req.query;

    // ✅ validasi di awal
    if (!namaDesa || !namaKecamatan) {
      return res.status(400).json({ error: "query tidak lengkap" });
    }

    if (!wilayah.length) {
      return res.status(500).json({ error: "data tidak tersedia" });
    }

    const kecamatanList = wilayah.filter(
      (w) => w.nama?.toLowerCase() === namaKecamatan.toLowerCase()
    );

    const result = wilayah.filter((desa) => {
      if (desa.nama?.toLowerCase() !== namaDesa.toLowerCase()) return false;
      if (!desa.kode || desa.kode.length !== 13) return false;

      return kecamatanList.some(
        (kec) => kec.kode === desa.kode_kecamatan
      );
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});