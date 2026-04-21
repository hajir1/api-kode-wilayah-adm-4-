const fs = require("fs");

const sql = fs.readFileSync("./wilayah.sql", "utf-8");

// pecah per baris
const rows = sql
  .trim()
  .split("\n")
  .map(row => row.trim().replace(/^\(|\),?$/g, "")); 
// hapus "(" di awal dan "),"/")" di akhir

const result = rows.map(row => {
  const [kode, nama, kode_kecamatan] = row
    .split(",")
    .map(v => v.trim().replace(/'/g, ""));

  return { kode, nama, kode_kecamatan };
});

fs.writeFileSync("wilayah.json", JSON.stringify(result, null, 2));
console.log("Berhasil convert ke JSON");