const express =require("express");
const fs = require("fs");

const app = express();
const PORT = 3000;

// load data
const wilayah = JSON.parse(fs.readFileSync("./wilayah.json", "utf-8"));

app.get("/", (req, res) => {
    res.json({"message":"hanya ada 1 endpoint yaitu /desa?desa=nama_desa&kecamatan=nama_kecamatan , contoh: /desa?desa=sawahan&kecamatan=turen"});
})
// endpoint
app.get("/desa", (req, res) => {
  const { desa: namaDesa, kecamatan: namaKecamatan } = req.query;

  // ambil kecamatan dulu
  const kecamatanList = wilayah.filter(w =>
    w.nama.toLowerCase() === namaKecamatan?.toLowerCase()
  );

  // join + filter desa
  const result = wilayah.filter(desa => {
    // filter nama desa
    if (desa.nama.toLowerCase() !== namaDesa?.toLowerCase()) return false;

    // filter panjang kode (desa = 13 karakter)
    if (desa.kode.length !== 13) return false;

    // join ke kecamatan
    return kecamatanList.some(kec => kec.kode === desa.kode_kecamatan);
  });

  res.json(result);
});

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});