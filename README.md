# LAPIS 6171 — GitHub Pages

**LAPIS — Layanan Akses Publik Indikator Strategis**  
BPS Kota Pontianak

Paket ini sudah siap untuk **upload manual** ke repository:

`https://github.com/yoviewibowo/lapis6171`

GitHub Pages URL yang sudah tertanam:

`https://yoviewibowo.github.io/lapis6171/`

Apps Script API yang sudah tertanam:

`https://script.google.com/macros/s/AKfycbx7_Aanic678yO5t0LAkTP2iVv7y9E14lKikx2gI7r2Ey91XNq15WicupAg4l2dKJVqKA/exec`

## Cara upload

Upload **seluruh isi folder ini** ke root branch `main` repository `lapis6171`.

Struktur root setelah upload harus seperti:

```text
lapis6171/
├── index.html
├── 404.html
├── robots.txt
├── sitemap.xml
├── site.webmanifest
├── .nojekyll
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── config.js
│   └── app.js
└── assets/
    ├── favicon.svg
    ├── icon-192.png
    ├── icon-512.png
    └── og-lapis.png
```

Lalu buka **Settings → Pages** dan gunakan:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/(root)`

## Catatan

- Tidak perlu menjalankan `configure.ps1`.
- Tidak perlu mengubah URL Apps Script.
- Data tetap dibaca dari Google Sheets melalui Apps Script.
- Bila angka di spreadsheet berubah, GitHub tidak perlu diupload ulang.
- Backend menggunakan cache singkat; perubahan data dapat memerlukan beberapa menit sebelum tampil.
