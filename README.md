# ChartLab UI (prototipe)

Tiruan tampilan chart editor ala Friday Night Funkin', dipecah jadi file
terpisah (bukan satu file HTML raksasa) supaya gampang dirawat.

## Struktur

```
index.html          struktur halaman
css/
  variables.css      warna, font, ukuran (ubah di sini kalau mau ganti tema)
  layout.css         kerangka halaman (menubar / workspace / playbar)
  menubar.css        toolbar atas
  grid.css           tampilan lane & note
  playbar.css        bar transport bawah
js/
  config.js          semua angka & label yang boleh diutak-atik
  state.js           status chart yang dipakai bareng semua modul
  chartData.js        data chart (dari file .fnfc "ChartLab Demo")
  grid.js            bikin kotak-kotak lane + gambar note + klik-taruh-note
  waveform.js        gambar kolom waveform di kiri (masih placeholder, lihat catatan di bawah)
  playback.js        tombol transport & garis playhead merah
  app.js             nyalain semuanya & sinkronin scroll
assets/
  icons/             ikon karakter asli (icon-darnell.png, icon-pico.png, dll)
  ui/                aset chrome chart-editor asli (close/minimize/maximize/playbar-head)
  cursor/            kursor asli dari asset pack
data/
  manifest.json, chartlab-demo-metadata.json, chartlab-demo-chart.json
  → salinan asli file .fnfc yang kamu kirim, disimpan sebagai referensi.
    Isi datanya juga sudah ditulis ulang di js/chartData.js supaya UI
    tetap jalan walau dibuka langsung tanpa server (lihat komentar di
    file itu kenapa).
```

## Cara pakai

Tinggal buka `index.html` di browser (dobel klik juga bisa, tidak wajib
pakai server).

## Yang masih placeholder / perlu kamu isi

1. **Panah note** — sprite asli (`NOTE_assets`, `StrumlineNotes`, dst) di
   `assets.zip` formatnya `.astc` (tekstur terkompresi khusus mesin game),
   browser tidak bisa baca file itu. Jadi panah di grid sekarang digambar
   pakai SVG (warna sudah sesuai standar FNF: ungu/biru/hijau/merah).
   Begitu kamu punya versi PNG dari sprite note itu, tinggal ganti fungsi
   `Grid.arrowSVG()` di `js/grid.js` dengan tag `<img>` ke file PNG-nya.
2. **Waveform** — chart demo yang kamu kirim tidak menyertakan file audio,
   jadi garis waveform di kolom kiri itu digambar prosedural (bukan dari
   audio asli). Lihat komentar di `js/waveform.js` untuk cara menyambungkan
   ke file audio asli lewat Web Audio API.
3. **Jalur Darnell (opponent)** kosong karena chart demo yang kamu kirim
   cuma berisi satu strumline (semua note masuk ke jalur Pico/player).
   Kamu tetap bisa klik langsung di jalur Darnell untuk menaruh note baru.
