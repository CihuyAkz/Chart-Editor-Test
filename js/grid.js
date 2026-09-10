/**
 * grid.js
 * Membangun kolom-kolom lane (opponent + player) dan kotak-kotak step,
 * lalu menaruh panah note di posisi yang sesuai dari State.notes.
 * Klik satu kotak kosong = taruh note, klik note yang sudah ada = hapus.
 */
const Grid = {

  gridEl: null,
  rulerEl: null,
  playheadEl: null,
  notesLayer: null,

  init() {
    this.gridEl = document.getElementById("note-grid");
    this.rulerEl = document.getElementById("beat-ruler");
    this.playheadEl = document.getElementById("playhead");

    this.buildLanes();
    this.buildRuler();
    this.renderNotes();
    this.sizeRail();
  },

  sizeRail() {
    const railHeight = State.totalSteps * CONFIG.cellHeight;
    document.getElementById("grid-rail").style.minHeight = railHeight + "px";
    this.gridEl.style.height = railHeight + "px";
    this.rulerEl.style.height = railHeight + "px";
  },

  buildLanes() {
    this.gridEl.innerHTML = "";

    ["opponent", "player"].forEach((lane) => {
      const group = document.createElement("div");
      group.className = "lane-group";
      group.dataset.lane = lane;

      CONFIG.directions.forEach((direction) => {
        const col = document.createElement("div");
        col.className = "lane-column";
        col.dataset.direction = direction;
        col.style.width = "var(--cell-w)";

        for (let step = 0; step < State.totalSteps; step++) {
          const cell = document.createElement("div");
          cell.className = "grid-cell";
          cell.style.top = step * CONFIG.cellHeight + "px";
          cell.style.height = CONFIG.cellHeight + "px";

          const stepsPerBar = CONFIG.stepsPerBeat * CONFIG.beatsPerBar;
          if (step % stepsPerBar === 0) cell.classList.add("bar-start");
          else if (step % CONFIG.stepsPerBeat === 0) cell.classList.add("beat-start");

          cell.addEventListener("click", () => {
            State.toggleNote(step, direction, lane);
            this.renderNotes();
          });

          col.appendChild(cell);
        }

        group.appendChild(col);
      });

      this.gridEl.appendChild(group);
    });

    // lebar tiap lane-group otomatis dari 4 kolom di dalamnya
    this.gridEl.querySelectorAll(".lane-group").forEach((g) => {
      g.style.width = `calc(var(--cell-w) * ${CONFIG.directions.length})`;
    });
  },

  buildRuler() {
    this.rulerEl.innerHTML = "";
    const stepsPerBar = CONFIG.stepsPerBeat * CONFIG.beatsPerBar;

    for (let step = 0; step < State.totalSteps; step += CONFIG.stepsPerBeat) {
      const tick = document.createElement("div");
      tick.className = "ruler-tick";
      tick.style.top = step * CONFIG.cellHeight + "px";
      this.rulerEl.appendChild(tick);

      if (step % stepsPerBar === 0) {
        const label = document.createElement("div");
        label.className = "ruler-mark";
        label.style.top = step * CONFIG.cellHeight + "px";
        label.textContent = String(step / stepsPerBar + 1);
        this.rulerEl.appendChild(label);
      }
    }
  },

  // path panah sederhana, diputar sesuai arah (mirip gaya arrow FNF)
  arrowSVG(direction, colorVar) {
    const rotation = { up: 0, right: 90, down: 180, left: 270 }[direction];
    return `
      <svg viewBox="0 0 100 100" style="transform: rotate(${rotation}deg)">
        <circle cx="50" cy="50" r="46" fill="var(${colorVar})" stroke="#1c1b22" stroke-width="4"/>
        <path d="M50 22 L74 54 L58 54 L58 80 L42 80 L42 54 L26 54 Z" fill="#fff" opacity="0.95"/>
      </svg>`;
  },

  renderNotes() {
    this.gridEl.querySelectorAll(".note").forEach((n) => n.remove());

    State.notes.forEach((note) => {
      const col = this.gridEl.querySelector(
        `.lane-group[data-lane="${note.lane}"] .lane-column[data-direction="${note.direction}"]`
      );
      if (!col) return;

      const el = document.createElement("div");
      el.className = "note";
      el.style.top = note.step * CONFIG.cellHeight + "px";
      el.style.height = CONFIG.cellHeight + "px";
      el.innerHTML = this.arrowSVG(note.direction, CONFIG.noteColorVar[note.direction]);
      col.appendChild(el);
    });
  },

  updatePlayhead() {
    const y = State.currentStep() * CONFIG.cellHeight;
    this.playheadEl.style.top = y + "px";
  },
};
