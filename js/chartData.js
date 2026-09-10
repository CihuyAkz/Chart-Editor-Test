/**
 * chartData.js
 * Ini adalah salinan isi dari data/manifest.json, data/chartlab-demo-metadata.json,
 * dan data/chartlab-demo-chart.json (format .fnfc dari ChartLab), ditulis sebagai
 * objek JS langsung.
 *
 * Kenapa tidak pakai fetch() ke folder data/? Karena kalau file ini dibuka
 * langsung dengan dobel-klik (protokol file://), banyak browser memblokir
 * fetch/XHR ke file lokal lain (CORS). Dengan menaruh datanya di sini,
 * seluruh UI tetap jalan tanpa perlu menyalakan web server dulu.
 *
 * Kalau kamu mengedit data/*.json, salin ulang isinya ke bawah ini juga
 * (atau ganti loader di app.js untuk pakai fetch() kalau kamu memang selalu
 * menjalankan proyek ini lewat server / Live Server).
 */

const CHART_MANIFEST = {
  "version": "1.0.0",
  "songId": "chartlab-demo"
};

const CHART_METADATA = {
  "version": "2.2.2",
  "songName": "ChartLab Demo",
  "artist": "ChartLab",
  "timeFormat": "ms",
  "timeChanges": [{ "t": 0, "bpm": 120 }],
  "playData": {
    "album": "chartlab",
    "previewStart": 0,
    "previewEnd": 15000,
    "ratings": { "easy": 1, "normal": 3, "hard": 5 },
    "songVariations": [],
    "difficulties": ["easy", "normal", "hard"],
    "characters": { "player": "bf", "girlfriend": "gf", "opponent": "dad" },
    "stage": "mainStage",
    "noteStyle": "funkin"
  },
  "generatedBy": "Funkin ChartLab (browser)"
};

const CHART_DATA = {
  "version": "2.0.0",
  "scrollSpeed": { "normal": 1 },
  "events": [],
  "notes": {
    "normal": [
      { "t": 1125, "d": 0, "l": 0 },
      { "t": 2250, "d": 3, "l": 0 },
      { "t": 4250, "d": 3, "l": 0 },
      { "t": 5625, "d": 3, "l": 0 },
      { "t": 5750, "d": 3, "l": 0 },
      { "t": 5875, "d": 3, "l": 0 },
      { "t": 6875, "d": 3, "l": 0 },
      { "t": 7000, "d": 3, "l": 0 },
      { "t": 8125, "d": 3, "l": 0 },
      { "t": 9125, "d": 3, "l": 0 },
      { "t": 10625, "d": 3, "l": 0 },
      { "t": 11000, "d": 3, "l": 0 },
      { "t": 11625, "d": 3, "l": 0 },
      { "t": 12125, "d": 3, "l": 0 },
      { "t": 12250, "d": 3, "l": 0 },
      { "t": 12375, "d": 3, "l": 0 },
      { "t": 12500, "d": 3, "l": 0 },
      { "t": 12625, "d": 3, "l": 0 },
      { "t": 13000, "d": 3, "l": 0 },
      { "t": 14875, "d": 0, "l": 0 },
      { "t": 16875, "d": 0, "l": 0 },
      { "t": 18750, "d": 0, "l": 0 },
      { "t": 20750, "d": 0, "l": 0 },
      { "t": 22625, "d": 0, "l": 0 },
      { "t": 24500, "d": 0, "l": 0 },
      { "t": 26375, "d": 0, "l": 0 },
      { "t": 27875, "d": 1, "l": 0 },
      { "t": 29750, "d": 0, "l": 0 },
      { "t": 31375, "d": 2, "l": 0 },
      { "t": 33000, "d": 0, "l": 0 },
      { "t": 34375, "d": 3, "l": 0 },
      { "t": 36000, "d": 1, "l": 0 },
      { "t": 37625, "d": 3, "l": 0 }
    ]
  },
  "generatedBy": "Funkin ChartLab (browser)"
};

/**
 * Catatan format: setiap note = { t: waktu dalam ms, d: arah (0=left,
 * 1=down, 2=up, 3=right), l: panjang hold-note dalam ms (0 = note biasa) }.
 *
 * File demo ini cuma berisi satu strumline (tidak ada penanda opponent/
 * player per note seperti pada format chart FNF lama). Supaya jujur pada
 * data aslinya, semua note ini dirender di jalur milik PLAYER (Pico),
 * sedangkan jalur Darnell (opponent) dikosongkan dan siap kamu isi manual
 * lewat klik di grid, atau lewat data chart kamu sendiri nanti.
 */
function getChartBundle() {
  const bpm = CHART_METADATA.timeChanges[0].bpm;
  const stepMs = (60000 / bpm) / CONFIG.stepsPerBeat;

  const notes = CHART_DATA.notes.normal.map((n) => ({
    step: Math.round(n.t / stepMs),
    direction: CONFIG.directions[n.d],
    lengthMs: n.l || 0,
    lane: "player",
  }));

  return {
    manifest: CHART_MANIFEST,
    metadata: CHART_METADATA,
    bpm,
    stepMs,
    notes,
  };
}
