/**
 * LAPIS 6171 — konfigurasi production GitHub Pages.
 * Layanan Akses Publik Indikator Strategis
 * BPS Kota Pontianak
 *
 * File ini sudah dikonfigurasi untuk:
 * GitHub Pages : https://yoviewibowo.github.io/lapis6171/
 * Apps Script  : https://script.google.com/macros/s/AKfycbx7_Aanic678yO5t0LAkTP2iVv7y9E14lKikx2gI7r2Ey91XNq15WicupAg4l2dKJVqKA/exec
 */
window.LAPIS_CONFIG = Object.freeze({
  API_URL: 'https://script.google.com/macros/s/AKfycbx7_Aanic678yO5t0LAkTP2iVv7y9E14lKikx2gI7r2Ey91XNq15WicupAg4l2dKJVqKA/exec',
  SITE_URL: 'https://yoviewibowo.github.io/lapis6171/',

  SITE_NAME: 'LAPIS — Layanan Akses Publik Indikator Strategis',
  SHORT_NAME: 'LAPIS',
  SOURCE_URL: 'https://docs.google.com/spreadsheets/d/1PsDsUFESTEQ7D7KxI4Fibm-TcUlNsoj606gDZ0TSHgI/edit',
  BPS_URL: 'https://pontianakkota.bps.go.id/',

  CONTACT: Object.freeze({
    email: 'bps6171@bps.go.id',
    phone: '(0561) 8189880',
    phoneHref: '+625618189880',
    address: 'Jalan Letjen Sutoyo No. 17, Kel. Parit Tokaya, Kec. Pontianak Selatan, Kota Pontianak, Kalimantan Barat 78121'
  }),

  // Opsional: isi Measurement ID Google Analytics jika nanti diperlukan.
  ANALYTICS_MEASUREMENT_ID: '',

  PAGES: Object.freeze({
    home: {
      title: 'LAPIS — Data Strategis Kota Pontianak',
      description: 'LAPIS menyajikan indikator strategis Kota Pontianak untuk pemerintah, akademisi, peneliti, dan pengguna data.'
    },
    inflasi: {
      title: 'Inflasi Kota Pontianak | LAPIS',
      description: 'Pantau perkembangan inflasi month-to-month, year-on-year, dan tahun kalender Kota Pontianak.'
    },
    kemiskinan: {
      title: 'Kemiskinan Kota Pontianak | LAPIS',
      description: 'Data jumlah penduduk miskin, persentase kemiskinan, garis kemiskinan, P1, dan P2 Kota Pontianak.'
    },
    ketenagakerjaan: {
      title: 'Ketenagakerjaan Kota Pontianak | LAPIS',
      description: 'Data TPT, TPAK, angkatan kerja, dan indikator ketenagakerjaan Kota Pontianak.'
    },
    ekonomi: {
      title: 'Ekonomi Kota Pontianak | LAPIS',
      description: 'Pertumbuhan ekonomi, PDRB ADHB, PDRB ADHK, dan struktur ekonomi Kota Pontianak menurut lapangan usaha.'
    },
    ipm: {
      title: 'Indeks Pembangunan Manusia Kota Pontianak | LAPIS',
      description: 'Tren IPM dan komponen pembentuk Indeks Pembangunan Manusia Kota Pontianak.'
    },
    kependudukan: {
      title: 'Kependudukan Kota Pontianak | LAPIS',
      description: 'Jumlah penduduk, pertumbuhan, kepadatan, rasio jenis kelamin, gini ratio, dan piramida penduduk Kota Pontianak.'
    },
    tentang: {
      title: 'Tentang LAPIS | BPS Kota Pontianak',
      description: 'Tentang LAPIS, sumber data, cara penggunaan, dan kontak BPS Kota Pontianak.'
    },
    privasi: {
      title: 'Kebijakan Privasi | LAPIS',
      description: 'Kebijakan privasi dan penggunaan penyimpanan lokal pada portal LAPIS.'
    },
    ketentuan: {
      title: 'Ketentuan Penggunaan | LAPIS',
      description: 'Ketentuan penggunaan data dan layanan pada portal LAPIS.'
    },
    404: {
      title: 'Halaman Tidak Ditemukan | LAPIS',
      description: 'Halaman yang Anda cari tidak tersedia di LAPIS.'
    }
  })
});
