/**
 * config.js
 * Semua angka/patokan yang boleh diutak-atik dikumpulkan di sini,
 * supaya file lain (grid.js, playback.js, dst) tidak perlu diubah
 * kalau cuma mau ganti warna, snap, atau ikon karakter.
 */
const CONFIG = {

  // 4 arah per strumline, urutan baku Friday Night Funkin'
  directions: ["left", "down", "up", "right"],

  noteColorVar: {
    left:  "--note-left",
    down:  "--note-down",
    up:    "--note-up",
    right: "--note-right",
  },

  // berapa step (kotak grid) per beat. 1/16 = 4 step per beat (seperti
  // ditampilkan di playbar referensi: "1/16")
  stepsPerBeat: 4,

  // tinggi tiap baris grid dalam px (samakan dengan --cell-h di CSS)
  cellHeight: 58,

  // berapa beat dianggap satu "bar" untuk garis pemisah tebal
  beatsPerBar: 4,

  // Label & ikon panel karakter. Ganti path ini kalau mau pakai ikon lain
  // dari assets.zip (mis. assets/icons/icon-bf.png / icon-dad.png).
  characters: {
    opponent: { name: "Darnell", icon: "assets/icons/icon-darnell.png" },
    player:   { name: "Pico (Playable)", icon: "assets/icons/icon-pico.png" },
  },

  // seberapa banyak baris kosong ekstra dirender setelah note terakhir,
  // supaya user masih bisa scroll & menambah note baru di akhir lagu
  trailingBars: 8,
};
