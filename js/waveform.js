/**
 * waveform.js
 * Menggambar kolom waveform di sisi kiri, seperti pada referensi gambar
 * (garis putih halus + tanda warna-warni per beat).
 *
 * PENTING: chart demo yang dipakai (ChartLab Demo) tidak menyertakan file
 * audio, jadi bar ini digambar procedural (pseudo-random tapi konsisten,
 * bukan asal acak tiap reload) hanya sebagai penanda visual posisi waktu.
 * Begitu kamu punya file audio asli (inst.ogg / voices.ogg), ganti fungsi
 * drawWaveform() ini dengan hasil decode AudioBuffer (Web Audio API) untuk
 * menampilkan bentuk gelombang yang sebenarnya.
 */
const Waveform = {

  canvas: null,
  ctx: null,

  init() {
    this.canvas = document.getElementById("waveform-main");
    this.ctx = this.canvas.getContext("2d");
    this.resize();
    window.addEventListener("resize", () => this.resize());
  },

  resize() {
    const panel = document.getElementById("waveform-panel");
    this.canvas.width = panel.clientWidth;
    this.canvas.height = State.totalSteps * CONFIG.cellHeight;
    this.canvas.style.width = panel.clientWidth + "px";
    this.canvas.style.height = this.canvas.height + "px";
    this.draw();
  },

  // generator angka semu (deterministik) supaya tampilan waveform stabil
  // antar render, tanpa perlu Math.random() yang berubah tiap kali
  pseudoAmplitude(step) {
    const a = Math.sin(step * 0.37) * 0.5 + Math.sin(step * 1.9) * 0.3;
    const envelope = 0.4 + 0.6 * Math.abs(Math.sin(step * 0.015));
    return Math.abs(a) * envelope;
  },

  draw() {
    const { ctx, canvas } = this;
    const w = canvas.width;
    ctx.clearRect(0, 0, w, canvas.height);

    const midX = w * 0.55;
    const stepH = CONFIG.cellHeight;
    const barsPerBeat = CONFIG.beatsPerBar;

    for (let step = 0; step < State.totalSteps; step++) {
      const y = step * stepH;
      const amp = this.pseudoAmplitude(step);

      // tanda kotak warna-warni tiap step, meniru "beat marker" di referensi
      const isBeat = step % CONFIG.stepsPerBeat === 0;
      const isBar = step % (CONFIG.stepsPerBeat * barsPerBeat) === 0;
      ctx.fillStyle = isBar ? "#ff5da2" : isBeat ? "#28e0c8" : "#6d5f86";
      ctx.fillRect(4, y + 2, 14, stepH - 4);

      // garis waveform putih tipis
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(midX - amp * 22, y + stepH / 2);
      ctx.lineTo(midX + amp * 22, y + stepH / 2);
      ctx.stroke();
    }
  },
};
