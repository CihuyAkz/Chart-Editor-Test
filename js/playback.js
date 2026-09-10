/**
 * playback.js
 * Tombol transport (|<, <<, >, >>, >|), penghitung waktu, dan penggerak
 * garis playhead merah. Play/pause di sini adalah simulasi waktu murni
 * (belum memutar audio asli) karena chart demo tidak menyertakan file
 * lagu — begitu ada file audio, panggil audioEl.currentTime di sinkronkan
 * ke State.currentTimeMs pada fungsi tick() di bawah.
 */
const Playback = {

  lastFrameAt: 0,

  els: {},

  init() {
    this.els = {
      time: document.getElementById("time-display"),
      beat: document.getElementById("beat-display"),
      step: document.getElementById("step-display"),
      bpm: document.getElementById("bpm-display"),
      play: document.getElementById("btn-play"),
    };

    document.getElementById("btn-first").addEventListener("click", () => this.seekTo(0));
    document.getElementById("btn-last").addEventListener("click", () => this.seekTo(State.totalDurationMs()));
    document.getElementById("btn-back").addEventListener("click", () => this.nudge(-1));
    document.getElementById("btn-fwd").addEventListener("click", () => this.nudge(1));
    document.getElementById("btn-play").addEventListener("click", () => this.togglePlay());

    this.els.bpm.textContent = `BPM: ${State.bpm}`;
    this.refreshReadout();

    requestAnimationFrame((t) => this.tick(t));
  },

  nudge(beats) {
    const beatMs = State.stepMs * CONFIG.stepsPerBeat;
    this.seekTo(State.currentTimeMs + beats * beatMs);
  },

  seekTo(ms) {
    State.currentTimeMs = Math.max(0, Math.min(ms, State.totalDurationMs()));
    this.refreshReadout();
    Grid.updatePlayhead();
    this.scrollToPlayhead();
  },

  togglePlay() {
    State.isPlaying = !State.isPlaying;
    this.els.play.textContent = State.isPlaying ? "❚❚" : ">";
  },

  tick(now) {
    if (!this.lastFrameAt) this.lastFrameAt = now;
    const dt = now - this.lastFrameAt;
    this.lastFrameAt = now;

    if (State.isPlaying) {
      State.currentTimeMs += dt;
      if (State.currentTimeMs >= State.totalDurationMs()) {
        State.currentTimeMs = 0; // loop sederhana di akhir chart
      }
      this.refreshReadout();
      Grid.updatePlayhead();
      this.scrollToPlayhead();
    }

    requestAnimationFrame((t) => this.tick(t));
  },

  scrollToPlayhead() {
    const y = State.currentStep() * CONFIG.cellHeight;
    const scroller = document.getElementById("grid-scroll");
    const viewTop = scroller.scrollTop;
    const viewBottom = viewTop + scroller.clientHeight;

    // hanya auto-scroll kalau playhead keluar dari area yang terlihat,
    // supaya user masih bebas scroll manual saat sedang tidak play
    if (y < viewTop + 40 || y > viewBottom - 80) {
      scroller.scrollTop = Math.max(0, y - scroller.clientHeight * 0.3);
    }
  },

  refreshReadout() {
    const totalSec = State.currentTimeMs / 1000;
    const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const ss = (totalSec % 60).toFixed(2).padStart(5, "0");
    this.els.time.textContent = `${mm}:${ss}`;

    const beat = State.currentTimeMs / (State.stepMs * CONFIG.stepsPerBeat);
    this.els.beat.textContent = `Beat: ${beat.toFixed(2)}`;
    this.els.step.textContent = `Step: ${Math.floor(State.currentStep())}`;
  },
};
