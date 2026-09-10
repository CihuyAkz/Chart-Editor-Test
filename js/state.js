/**
 * state.js
 * Satu tempat penyimpanan status yang dipakai bareng oleh grid.js,
 * playback.js, dan app.js. Modul lain baca/tulis lewat objek ini
 * supaya tidak saling rebutan variabel global sendiri-sendiri.
 */
const State = {
  bpm: 120,
  stepMs: 125,
  totalSteps: 128,

  // { player: Set<stepIndex-direction>, opponent: Set<...> } sebenarnya
  // disimpan sebagai array of {step, direction, lane, lengthMs}
  notes: [],

  currentTimeMs: 0,
  isPlaying: false,

  init(bundle) {
    this.bpm = bundle.bpm;
    this.stepMs = bundle.stepMs;
    this.notes = bundle.notes.slice();

    const lastStep = this.notes.reduce((m, n) => Math.max(m, n.step), 0);
    const barSteps = CONFIG.stepsPerBeat * CONFIG.beatsPerBar;
    const trailing = CONFIG.trailingBars * barSteps;
    this.totalSteps = lastStep + trailing;
  },

  totalDurationMs() {
    return this.totalSteps * this.stepMs;
  },

  currentStep() {
    return this.currentTimeMs / this.stepMs;
  },

  toggleNote(step, direction, lane) {
    const idx = this.notes.findIndex(
      (n) => n.step === step && n.direction === direction && n.lane === lane
    );
    if (idx >= 0) {
      this.notes.splice(idx, 1);
      return false;
    }
    this.notes.push({ step, direction, lane, lengthMs: 0 });
    return true;
  },
};
