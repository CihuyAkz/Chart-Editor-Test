/* =====================================================================
   FNF WEB CHART EDITOR
   Implements the Funkin' "Base Game / V-Slice" chart format:
     SongMetadata  -> {songId}-metadata[-variation].json
     SongChartData -> {songId}-chart[-variation].json
   packaged together with a manifest.json inside a .fnfc (zip) container.
   Note format   : { t: ms, d: 0-7 (lane, //4 = strumline), l: sustainMs, k: kind, p: params[] }
   Event format  : { t: ms, e: eventKind, v: value }
   ===================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------- *
   *  CONSTANTS
   * ---------------------------------------------------------------- */
  const LANE_NAMES = ["Left", "Down", "Up", "Right"];
  const DEFAULT_VARIATION = "default";
  const CHART_MANIFEST_VERSION = "1.0.0";
  const METADATA_VERSION = "2.2.1";
  const BASE_PX_PER_MS = 0.16;      // pixels per millisecond at 100% zoom
  const LANE_COL_WIDTH = 100;       // px, matches CSS .lane-headers width
  const LANE_WIDTH = LANE_COL_WIDTH / 4;
  const EVENT_COL_X = 65;           // matches CSS .event-marker left offset baseline
  const SND_BASE = "assets/sounds/chartingSounds/";

  const EVENT_ICONS = {
    Default: "assets/shared/images/ui/chart-editor/events/Default.png",
    FocusCamera: "assets/shared/images/ui/chart-editor/events/FocusCamera.png",
    PlayAnimation: "assets/shared/images/ui/chart-editor/events/PlayAnimation.png",
    BPMChange: "assets/shared/images/ui/chart-editor/events/BPMChange.png",
    sserafimShow: "assets/shared/images/ui/chart-editor/events/sserafimShow.png",
    sserafimSing: "assets/shared/images/ui/chart-editor/events/sserafimSing.png",
    sserafimDark: "assets/shared/images/ui/chart-editor/events/sserafimDark.png",
    sserafimLights: "assets/shared/images/ui/chart-editor/events/sserafimLights.png",
    sserafimPulseLights: "assets/shared/images/ui/chart-editor/events/sserafimPulseLights.png",
    sserafimKick: "assets/shared/images/ui/chart-editor/events/sserafimKick.png"
  };

  const NOTE_SPRITES = [
    "editor-sprites/noteLeft0001.png",
    "editor-sprites/noteDown0001.png",
    "editor-sprites/noteUp0001.png",
    "editor-sprites/noteRight0001.png"
  ];
  const LANE_COLORS = ["var(--lane-left)", "var(--lane-down)", "var(--lane-up)", "var(--lane-right)"];

  /* ---------------------------------------------------------------- *
   *  STATE
   * ---------------------------------------------------------------- */
  function freshMetadata() {
    return {
      version: METADATA_VERSION,
      songName: "Unknown",
      artist: "Unknown",
      charter: "",
      divisions: 96,
      looped: false,
      offsets: { instrumental: 0, altInstrumentals: {}, vocals: {} },
      playData: {
        songVariations: [],
        difficulties: ["normal"],
        characters: {
          player: "bf", girlfriend: "gf", opponent: "dad",
          instrumental: "", altInstrumentals: [],
          opponentVocals: ["dad"], playerVocals: ["bf"]
        },
        stage: "stage",
        noteStyle: "funkin",
        ratings: { normal: 2 },
        album: null
      },
      generatedBy: "FNF Web Chart Editor",
      timeFormat: "ms",
      timeChanges: [{ timeStamp: 0, beatTime: 0, bpm: 100, timeSignatureNum: 4, timeSignatureDen: 4 }],
      variation: DEFAULT_VARIATION
    };
  }

  function freshChart() {
    return { default: { scrollSpeed: { normal: 1.0 }, events: [], notes: { normal: [] } } };
  }

  const app = {
    engine: "base",              // 'base' | 'vslice' (cosmetic — same underlying schema)
    metadata: freshMetadata(),
    chart: freshChart(),         // keyed by variation
    variation: DEFAULT_VARIATION,
    difficulty: "normal",
    tool: "place",
    snap: 16,
    zoom: 1,
    selectedNote: null,          // reference into notes array
    selectedEvent: null,
    dirty: false,
    songId: "untitled",
    audio: {
      ctx: null,
      instBuffer: null, instRaw: null,
      voicesBuffer: null, voicesRaw: null,
      gainNode: null,
      sources: [],
      isPlaying: false,
      startCtxTime: 0,
      startOffsetMs: 0,
      durationMs: 60000,
      volume: 0.8
    },
    history: [],
    metronomeOn: false,
    _lastBeatTick: -1
  };
  window.APP = app;

  /* ---------------------------------------------------------------- *
   *  HELPERS
   * ---------------------------------------------------------------- */
  function currentChart() {
    if (!app.chart[app.variation]) app.chart[app.variation] = { scrollSpeed: { [app.difficulty]: 1.0 }, events: [], notes: {} };
    return app.chart[app.variation];
  }
  function currentNotes() {
    const c = currentChart();
    if (!c.notes[app.difficulty]) c.notes[app.difficulty] = [];
    return c.notes[app.difficulty];
  }
  function currentEvents() {
    return currentChart().events;
  }
  function sanitizeSongId(name) {
    const invalid = /[\/\\:*?"<>|]/g;
    let id = (name || "untitled").trim().replace(invalid, "");
    id = id.replace(/\s+/g, "-");
    return id.length ? id : "untitled";
  }
  function markDirty() {
    app.dirty = true;
    document.getElementById("dirty-dot").classList.remove("hidden");
  }
  function clearDirty() {
    app.dirty = false;
    document.getElementById("dirty-dot").classList.add("hidden");
  }
  function toast(msg, kind) {
    const stack = document.getElementById("toast-stack");
    const el = document.createElement("div");
    el.className = "toast" + (kind ? " " + kind : "");
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 3600);
    document.getElementById("status-text").textContent = msg;
  }
  function playSfx(name, vol) {
    try {
      const a = new Audio(SND_BASE + name);
      a.volume = vol == null ? 0.5 : vol;
      a.play().catch(() => {});
    } catch (e) { /* ignore */ }
  }

  /* ---- BPM / timeChanges lookup ---- */
  function timeChangeAt(ms) {
    const tcs = app.metadata.timeChanges;
    let seg = tcs[0];
    for (const tc of tcs) {
      if (tc.timeStamp <= ms) seg = tc; else break;
    }
    return seg;
  }
  function stepMsAt(ms, snapValue) {
    const tc = timeChangeAt(ms);
    const beatMs = 60000 / tc.bpm;
    const stepsPerBeat = snapValue / 4;
    return beatMs / stepsPerBeat;
  }
  function snapMs(ms) {
    ms = Math.max(0, ms);
    const tc = timeChangeAt(ms);
    const step = stepMsAt(ms, app.snap);
    const rel = ms - tc.timeStamp;
    const snappedRel = Math.round(rel / step) * step;
    return Math.round((tc.timeStamp + snappedRel) * 1000) / 1000;
  }

  function pxPerMs() { return BASE_PX_PER_MS * app.zoom; }
  function msToY(ms) { return ms * pxPerMs(); }
  function yToMs(y) { return y / pxPerMs(); }

  function contentDurationMs() {
    let maxT = app.audio.durationMs || 0;
    const notes = currentNotes();
    for (const n of notes) maxT = Math.max(maxT, n.t + (n.l || 0));
    for (const e of currentEvents()) maxT = Math.max(maxT, e.t);
    return Math.max(maxT + 8000, 60000);
  }

  function fmtTime(ms) {
    if (!isFinite(ms) || ms < 0) ms = 0;
    const totalSec = ms / 1000;
    const m = Math.floor(totalSec / 60);
    const s = totalSec - m * 60;
    return String(m).padStart(2, "0") + ":" + s.toFixed(2).padStart(5, "0");
  }

  /* ---------------------------------------------------------------- *
   *  HISTORY (undo/redo)
   * ---------------------------------------------------------------- */
  function snapshot() {
    app.history.push({
      chart: JSON.parse(JSON.stringify(app.chart)),
      metadata: JSON.parse(JSON.stringify(app.metadata))
    });
    if (app.history.length > 60) app.history.shift();
    app.future = [];
  }
  function undo() {
    if (!app.history.length) { toast("Nothing to undo."); return; }
    app.future = app.future || [];
    app.future.push({ chart: JSON.parse(JSON.stringify(app.chart)), metadata: JSON.parse(JSON.stringify(app.metadata)) });
    const prev = app.history.pop();
    app.chart = prev.chart;
    app.metadata = prev.metadata;
    app.selectedNote = null; app.selectedEvent = null;
    markDirty();
    playSfx("undo.ogg", 0.4);
    refreshAll();
  }
  function redo() {
    if (!app.future || !app.future.length) { toast("Nothing to redo."); return; }
    app.history.push({ chart: JSON.parse(JSON.stringify(app.chart)), metadata: JSON.parse(JSON.stringify(app.metadata)) });
    const next = app.future.pop();
    app.chart = next.chart;
    app.metadata = next.metadata;
    refreshAll();
  }

  /* ---------------------------------------------------------------- *
   *  IMPORT / EXPORT
   * ---------------------------------------------------------------- */

  // Best-effort import of loose chart JSON (modern SongChartData, combined, or legacy "song" wrapper).
  function importLooseJson(obj) {
    if (obj && obj.song && obj.song.notes) {
      // Legacy engine format: song.notes.<difficulty> = [{sectionNotes:[[t,d,l?],...], mustHitSection}, ...]
      const song = obj.song;
      const notesOut = {};
      for (const diffKey of Object.keys(song.notes)) {
        const sections = song.notes[diffKey];
        const list = [];
        for (const sec of sections) {
          for (const raw of (sec.sectionNotes || [])) {
            const [t, d, l] = raw;
            // sectionNotes already encode the full 0-7 strumline index in this format.
            list.push({ t: t, d: d, l: l || 0, k: null, p: [] });
          }
        }
        list.sort((a, b) => a.t - b.t);
        notesOut[diffKey] = list;
      }
      app.metadata.songName = song.song || app.metadata.songName;
      app.metadata.playData.characters.player = song.player1 || app.metadata.playData.characters.player;
      app.metadata.playData.characters.opponent = song.player2 || app.metadata.playData.characters.opponent;
      app.metadata.playData.characters.girlfriend = song.player3 || app.metadata.playData.characters.girlfriend;
      app.metadata.playData.difficulties = Object.keys(notesOut);
      if (song.bpm) app.metadata.timeChanges = [{ timeStamp: 0, beatTime: 0, bpm: song.bpm, timeSignatureNum: 4, timeSignatureDen: 4 }];
      let scrollSpeed;
      if (song.speed && typeof song.speed === "object") scrollSpeed = song.speed;
      else { scrollSpeed = {}; for (const d of Object.keys(notesOut)) scrollSpeed[d] = song.speed || 1.0; }
      app.chart[DEFAULT_VARIATION] = { scrollSpeed: scrollSpeed, events: [], notes: notesOut };
      app.variation = DEFAULT_VARIATION;
      app.difficulty = Object.keys(notesOut)[0] || "normal";
      return true;
    }
    if (obj && obj.notes && !Array.isArray(obj.notes)) {
      // Modern SongChartData shape.
      app.chart[app.variation] = {
        scrollSpeed: obj.scrollSpeed || { [app.difficulty]: 1.0 },
        events: obj.events || [],
        notes: obj.notes
      };
      app.metadata.playData.difficulties = Object.keys(obj.notes);
      app.difficulty = app.metadata.playData.difficulties[0] || "normal";
      return true;
    }
    return false;
  }

  async function openJsonFile(file) {
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      snapshot();
      if (!importLooseJson(obj)) { toast("Unrecognized chart JSON structure.", "error"); return; }
      app.songId = sanitizeSongId(app.metadata.songName);
      clearDirty();
      refreshAll();
      toast('Imported chart data from "' + file.name + '".', "success");
    } catch (err) {
      console.error(err);
      toast("Failed to parse JSON: " + err.message, "error");
    }
  }

  async function openFnfcFile(file) {
    try {
      const buf = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      let manifest = null;
      const manifestFile = zip.file("manifest.json");
      if (manifestFile) manifest = JSON.parse(await manifestFile.async("string"));

      const names = Object.keys(zip.files);
      const metaFiles = names.filter(n => /-metadata(-.+)?\.json$/i.test(n));
      const chartFiles = names.filter(n => /-chart(-.+)?\.json$/i.test(n));
      if (!metaFiles.length || !chartFiles.length) {
        toast("This .fnfc has no recognizable metadata/chart files.", "error");
        return;
      }

      snapshot();
      app.chart = {};

      let songId = manifest ? manifest.songId : metaFiles[0].split("-metadata")[0];
      app.songId = songId;

      for (const mf of metaFiles) {
        const m = JSON.parse(await zip.file(mf).async("string"));
        const variation = m.variation || DEFAULT_VARIATION;
        if (variation === DEFAULT_VARIATION || !app.metadata || app.metadata === freshMetadata()) {
          app.metadata = m;
        }
        if (variation === DEFAULT_VARIATION) app.metadata = m;
      }
      // Ensure base metadata loaded even if only a variation manifest existed
      if (!app.metadata.playData) app.metadata = JSON.parse(await zip.file(metaFiles[0]).async("string"));

      for (const cf of chartFiles) {
        const base = cf.split("-chart")[0];
        const rest = cf.slice(base.length + "-chart".length).replace(/\.json$/i, "");
        const variation = rest.startsWith("-") ? rest.slice(1) : DEFAULT_VARIATION;
        const c = JSON.parse(await zip.file(cf).async("string"));
        app.chart[variation] = c;
      }

      app.variation = app.chart[DEFAULT_VARIATION] ? DEFAULT_VARIATION : Object.keys(app.chart)[0];
      app.difficulty = (app.metadata.playData.difficulties && app.metadata.playData.difficulties[0]) || "normal";

      // Load bundled audio if present.
      const instFile = names.find(n => /(^|\/)Inst(-.+)?\.(ogg|mp3|wav)$/i.test(n));
      if (instFile) {
        const raw = await zip.file(instFile).async("arraybuffer");
        await window.__fnfEditor.loadInstFromArrayBuffer(raw.slice(0));
      }
      const voicesFile = names.find(n => /(^|\/)Voices-.+\.(ogg|mp3|wav)$/i.test(n));
      if (voicesFile) {
        const raw = await zip.file(voicesFile).async("arraybuffer");
        await window.__fnfEditor.loadVoicesFromArrayBuffer(raw.slice(0));
      }

      clearDirty();
      refreshAll();
      toast('Loaded chart "' + app.metadata.songName + '" from .fnfc.', "success");
    } catch (err) {
      console.error(err);
      toast("Failed to load .fnfc: " + err.message, "error");
    }
  }

  function buildManifest() {
    return { version: CHART_MANIFEST_VERSION, songId: app.songId };
  }

  function exportChartJson() {
    const c = currentChart();
    return JSON.stringify(c, null, 2);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function saveJson() {
    app.songId = sanitizeSongId(app.metadata.songName);
    const blob = new Blob([exportChartJson()], { type: "application/json" });
    downloadBlob(blob, app.songId + "-chart" + (app.variation === DEFAULT_VARIATION ? "" : "-" + app.variation) + ".json");
    toast("Exported chart data JSON.", "success");
  }

  async function saveFnfc() {
    app.songId = sanitizeSongId(app.metadata.songName);
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify(buildManifest(), null, 2));

    const variations = Object.keys(app.chart).length ? Object.keys(app.chart) : [DEFAULT_VARIATION];
    app.metadata.playData.songVariations = variations.filter(v => v !== DEFAULT_VARIATION);

    for (const variation of variations) {
      const metaClone = JSON.parse(JSON.stringify(app.metadata));
      metaClone.variation = variation;
      const metaSuffix = variation === DEFAULT_VARIATION ? "" : "-" + variation;
      zip.file(app.songId + "-metadata" + metaSuffix + ".json", JSON.stringify(metaClone, null, 2));
      zip.file(app.songId + "-chart" + metaSuffix + ".json", JSON.stringify(app.chart[variation], null, 2));
    }

    if (app.audio.instRaw) zip.file("Inst.ogg", app.audio.instRaw);
    if (app.audio.voicesRaw) zip.file("Voices-" + (app.metadata.playData.characters.player || "player") + ".ogg", app.audio.voicesRaw);

    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, app.songId + ".fnfc");
    toast("Exported " + app.songId + ".fnfc", "success");
  }

  /* =================================================================
   *  AUDIO ENGINE
   * ================================================================= */
  function ensureCtx() {
    if (!app.audio.ctx) {
      app.audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
      app.audio.gainNode = app.audio.ctx.createGain();
      app.audio.gainNode.gain.value = app.audio.volume;
      app.audio.gainNode.connect(app.audio.ctx.destination);
    }
    return app.audio.ctx;
  }

  async function loadInstFromArrayBuffer(raw) {
    const ctx = ensureCtx();
    app.audio.instRaw = raw.slice(0);
    app.audio.instBuffer = await ctx.decodeAudioData(raw);
    app.audio.durationMs = Math.max(app.audio.durationMs, app.audio.instBuffer.duration * 1000);
    updateDurationUi();
  }
  async function loadVoicesFromArrayBuffer(raw) {
    const ctx = ensureCtx();
    app.audio.voicesRaw = raw.slice(0);
    app.audio.voicesBuffer = await ctx.decodeAudioData(raw);
    app.audio.durationMs = Math.max(app.audio.durationMs, app.audio.voicesBuffer.duration * 1000);
    updateDurationUi();
  }

  function stopSources() {
    for (const s of app.audio.sources) { try { s.stop(); } catch (e) {} }
    app.audio.sources = [];
  }

  function playFrom(offsetMs) {
    const ctx = ensureCtx();
    if (ctx.state === "suspended") ctx.resume();
    stopSources();
    app.audio.startOffsetMs = offsetMs;
    app.audio.startCtxTime = ctx.currentTime;
    app.audio.isPlaying = true;

    const offsetSec = Math.max(0, offsetMs / 1000);
    if (app.audio.instBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = app.audio.instBuffer;
      src.connect(app.audio.gainNode);
      if (offsetSec < src.buffer.duration) { src.start(0, offsetSec); app.audio.sources.push(src); }
    }
    if (app.audio.voicesBuffer) {
      const src2 = ctx.createBufferSource();
      src2.buffer = app.audio.voicesBuffer;
      src2.connect(app.audio.gainNode);
      if (offsetSec < src2.buffer.duration) { src2.start(0, offsetSec); app.audio.sources.push(src2); }
    }
    updatePlayIcon(true);
  }

  function pausePlayback() {
    if (!app.audio.isPlaying) return;
    app.audio.startOffsetMs = getCurrentMs();
    stopSources();
    app.audio.isPlaying = false;
    updatePlayIcon(false);
  }

  function stopPlayback() {
    stopSources();
    app.audio.isPlaying = false;
    app.audio.startOffsetMs = 0;
    updatePlayIcon(false);
    updatePlayhead(0);
  }

  function getCurrentMs() {
    if (!app.audio.isPlaying) return app.audio.startOffsetMs;
    const ctx = app.audio.ctx;
    const elapsed = (ctx.currentTime - app.audio.startCtxTime) * 1000;
    return app.audio.startOffsetMs + elapsed;
  }

  function seekTo(ms) {
    ms = Math.max(0, Math.min(ms, contentDurationMs()));
    if (app.audio.isPlaying) { playFrom(ms); } else { app.audio.startOffsetMs = ms; }
    updatePlayhead(ms);
    scrollToPlayhead(ms, false);
  }

  function updatePlayIcon(playing) {
    const svg = document.getElementById("play-icon");
    if (playing) {
      svg.innerHTML = '<rect x="5" y="4" width="5" height="16"></rect><rect x="14" y="4" width="5" height="16"></rect>';
    } else {
      svg.innerHTML = '<polygon points="6,4 20,12 6,20"></polygon>';
    }
  }

  /* =================================================================
   *  RENDERING
   * ================================================================= */
  const dom = {};
  function cacheDom() {
    ["grid-canvas", "notes-layer", "events-layer", "playhead-line", "timeline-scroll",
     "timeline-canvas-wrap", "scrub-fill", "scrub-head", "time-display",
     "difficulty-select", "variation-select", "zoom-val", "event-list",
     "titlebar-song", "titlebar-variation", "titlebar-difficulty"].forEach(id => {
      dom[id] = document.getElementById(id);
    });
  }

  function updateDurationUi() {
    resizeCanvasWrap();
  }

  function resizeCanvasWrap() {
    const totalMs = contentDurationMs();
    const h = Math.ceil(msToY(totalMs));
    dom["timeline-canvas-wrap"].style.height = h + "px";
    dom["grid-canvas"].width = dom["timeline-canvas-wrap"].clientWidth;
    dom["grid-canvas"].height = h;
    drawGrid();
  }

  function laneX(lane) {
    // Per the real schema, floor(data/4): 0 = player strumline, 1 = opponent strumline.
    // Opponent renders on the LEFT block, player on the RIGHT block (matches in-game layout).
    const wrapWidth = dom["timeline-canvas-wrap"].clientWidth;
    const totalLaneWidth = LANE_COL_WIDTH * 2 + 18;
    const startX = (wrapWidth - totalLaneWidth) / 2;
    if (lane >= 4) { // opponent -> left block
      const l = lane - 4;
      return startX + l * LANE_WIDTH + LANE_WIDTH / 2;
    }
    // player -> right block
    return startX + LANE_COL_WIDTH + 18 + lane * LANE_WIDTH + LANE_WIDTH / 2;
  }
  function eventX() {
    const wrapWidth = dom["timeline-canvas-wrap"].clientWidth;
    const totalLaneWidth = LANE_COL_WIDTH * 2 + 18;
    const startX = (wrapWidth - totalLaneWidth) / 2;
    return startX + totalLaneWidth + 30;
  }

  function drawGrid() {
    const canvas = dom["grid-canvas"];
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const wrapWidth = w;
    const totalLaneWidth = LANE_COL_WIDTH * 2 + 18;
    const startX = (wrapWidth - totalLaneWidth) / 2;

    // lane column backgrounds
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    ctx.fillRect(startX, 0, LANE_COL_WIDTH, h);
    ctx.fillRect(startX + LANE_COL_WIDTH + 18, 0, LANE_COL_WIDTH, h);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    for (let i = 0; i <= 4; i++) {
      let x = startX + i * LANE_WIDTH;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      x = startX + LANE_COL_WIDTH + 18 + i * LANE_WIDTH;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    // event column divider
    const evX = eventX();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath(); ctx.moveTo(evX - 20, 0); ctx.lineTo(evX - 20, h); ctx.stroke();

    // beat / measure / step lines, following BPM segments
    const totalMs = yToMs(h);
    const tcs = app.metadata.timeChanges.slice().sort((a, b) => a.timeStamp - b.timeStamp);
    for (let i = 0; i < tcs.length; i++) {
      const seg = tcs[i];
      const segEnd = (i + 1 < tcs.length) ? tcs[i + 1].timeStamp : totalMs;
      const beatMs = 60000 / seg.bpm;
      const stepMs = beatMs / (app.snap / 4);
      let beatIdx = 0;
      for (let t = seg.timeStamp; t <= segEnd; t += stepMs) {
        const y = msToY(t);
        const isMeasure = Math.round((t - seg.timeStamp) / beatMs) % (seg.timeSignatureNum || 4) === 0 &&
                           Math.abs(((t - seg.timeStamp) / beatMs) % 1) < 1e-6;
        const isBeat = Math.abs(((t - seg.timeStamp) / beatMs) % 1) < 1e-6;
        ctx.strokeStyle = isMeasure ? "rgba(255,214,57,0.35)" : (isBeat ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.07)");
        ctx.lineWidth = isMeasure ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(startX - 4, y); ctx.lineTo(startX + totalLaneWidth + 4, y);
        ctx.stroke();
      }
      // bpm label
      ctx.fillStyle = "rgba(51,229,255,0.85)";
      ctx.font = "10px Consolas, monospace";
      ctx.fillText(seg.bpm.toFixed(1) + " BPM", 6, msToY(seg.timeStamp) + 10);
    }
  }

  function renderNotes() {
    const layer = dom["notes-layer"];
    layer.innerHTML = "";
    const notes = currentNotes();
    for (const n of notes) {
      const lane = n.d % 4;
      const x = laneX(n.d);
      const y = msToY(n.t);

      if (n.l && n.l > 0) {
        const sustain = document.createElement("div");
        sustain.className = "sustain-el";
        sustain.style.left = x + "px";
        sustain.style.top = y + "px";
        sustain.style.height = Math.max(2, msToY(n.t + n.l) - y) + "px";
        sustain.style.background = LANE_COLORS[lane];
        layer.appendChild(sustain);
      }

      const el = document.createElement("div");
      el.className = "note-el" + (n === app.selectedNote ? " selected" : "") + (n.d >= 4 ? " opponent" : "");
      el.style.left = x + "px";
      el.style.top = y + "px";
      el.title = LANE_NAMES[lane] + " @ " + Math.round(n.t) + "ms" + (n.k ? (" [" + n.k + "]") : "");
      const img = document.createElement("img");
      img.src = NOTE_SPRITES[lane];
      img.style.filter = "drop-shadow(0 0 0 " + LANE_COLORS[lane] + ")";
      el.appendChild(img);
      el.addEventListener("mousedown", (ev) => onNoteMouseDown(ev, n));
      layer.appendChild(el);
    }
  }

  function renderEvents() {
    const layer = dom["events-layer"];
    layer.innerHTML = "";
    const events = currentEvents().slice().sort((a, b) => a.t - b.t);
    const evX = eventX();
    for (const e of events) {
      const y = msToY(e.t);
      const el = document.createElement("div");
      el.className = "event-marker" + (e === app.selectedEvent ? " selected" : "") + (e.e === "BPMChange" ? " bpm" : "");
      el.style.left = evX + "px";
      el.style.top = y + "px";
      const icon = EVENT_ICONS[e.e] || EVENT_ICONS.Default;
      el.innerHTML = '<img src="' + icon + '" alt=""><span>' + e.e + "</span>";
      el.addEventListener("mousedown", (ev) => { ev.stopPropagation(); selectEvent(e); });
      layer.appendChild(el);
    }
    renderEventList(events);
  }

  function renderEventList(sortedEvents) {
    const list = dom["event-list"];
    list.innerHTML = "";
    for (const e of sortedEvents) {
      const item = document.createElement("div");
      item.className = "event-list-item";
      item.innerHTML = "<span>" + e.e + "</span><span class='t'>" + Math.round(e.t) + "ms</span>";
      item.addEventListener("click", () => selectEvent(e));
      list.appendChild(item);
    }
  }

  function updatePlayhead(ms) {
    dom["playhead-line"].style.top = msToY(ms) + "px";
    const dur = contentDurationMs();
    const pct = Math.max(0, Math.min(1, ms / dur));
    dom["scrub-fill"].style.width = (pct * 100) + "%";
    dom["scrub-head"].style.left = (pct * 100) + "%";
    dom["time-display"].textContent = fmtTime(ms) + " / " + fmtTime(app.audio.durationMs || dur);
  }

  function scrollToPlayhead(ms, smooth) {
    const container = dom["timeline-scroll"];
    const y = msToY(ms);
    const viewTop = container.scrollTop, viewBot = viewTop + container.clientHeight;
    if (y < viewTop + 60 || y > viewBot - 120) {
      container.scrollTo({ top: Math.max(0, y - container.clientHeight * 0.3), behavior: smooth ? "smooth" : "auto" });
    }
  }

  function refreshTitlebar() {
    dom["titlebar-song"].textContent = app.metadata.songName || "Unknown";
    dom["titlebar-variation"].textContent = app.variation;
    dom["titlebar-difficulty"].textContent = app.difficulty;
  }

  function refreshSelectors() {
    const diffSel = dom["difficulty-select"];
    diffSel.innerHTML = "";
    for (const d of app.metadata.playData.difficulties) {
      const opt = document.createElement("option");
      opt.value = d; opt.textContent = d;
      if (d === app.difficulty) opt.selected = true;
      diffSel.appendChild(opt);
    }
    const varSel = dom["variation-select"];
    varSel.innerHTML = "";
    const variations = Object.keys(app.chart).length ? Object.keys(app.chart) : [DEFAULT_VARIATION];
    for (const v of variations) {
      const opt = document.createElement("option");
      opt.value = v; opt.textContent = v;
      if (v === app.variation) opt.selected = true;
      varSel.appendChild(opt);
    }
  }

  function refreshSongPanel() {
    document.getElementById("f-songName").value = app.metadata.songName;
    document.getElementById("f-artist").value = app.metadata.artist;
    document.getElementById("f-charter").value = app.metadata.charter || "";
    const tc = app.metadata.timeChanges[0] || { bpm: 100, timeSignatureNum: 4, timeSignatureDen: 4 };
    document.getElementById("f-bpm").value = tc.bpm;
    document.getElementById("f-tsnum").value = tc.timeSignatureNum || 4;
    document.getElementById("f-tsden").value = tc.timeSignatureDen || 4;
    document.getElementById("f-scrollspeed").value = currentChart().scrollSpeed[app.difficulty] ?? 1.0;
    document.getElementById("f-stage").value = app.metadata.playData.stage || "";
    document.getElementById("f-notestyle").value = app.metadata.playData.noteStyle || "";
    document.getElementById("f-charPlayer").value = app.metadata.playData.characters.player || "";
    document.getElementById("f-charOpponent").value = app.metadata.playData.characters.opponent || "";
    document.getElementById("f-charGf").value = app.metadata.playData.characters.girlfriend || "";
    document.getElementById("f-looped").checked = !!app.metadata.looped;
  }

  function refreshNotePanel() {
    const fields = document.getElementById("note-fields");
    const empty = document.getElementById("note-empty-msg");
    if (!app.selectedNote) { fields.classList.add("hidden"); empty.classList.remove("hidden"); return; }
    fields.classList.remove("hidden"); empty.classList.add("hidden");
    document.getElementById("n-time").value = Math.round(app.selectedNote.t);
    document.getElementById("n-lane").value = app.selectedNote.d;
    document.getElementById("n-length").value = Math.round(app.selectedNote.l || 0);
    document.getElementById("n-kind").value = app.selectedNote.k || "";
  }

  function refreshEventPanel() {
    const fields = document.getElementById("event-fields");
    const empty = document.getElementById("event-empty-msg");
    if (!app.selectedEvent) { fields.classList.add("hidden"); empty.classList.remove("hidden"); return; }
    fields.classList.remove("hidden"); empty.classList.add("hidden");
    document.getElementById("e-time").value = Math.round(app.selectedEvent.t);
    const kindSel = document.getElementById("e-kind");
    const known = Array.from(kindSel.options).some(o => o.value === app.selectedEvent.e);
    const customWrap = document.getElementById("e-custom-wrap");
    if (known) {
      kindSel.value = app.selectedEvent.e;
      customWrap.classList.add("hidden");
    } else {
      kindSel.value = "Custom";
      customWrap.classList.remove("hidden");
      document.getElementById("e-kind-custom").value = app.selectedEvent.e;
    }
    document.getElementById("e-value").value = JSON.stringify(app.selectedEvent.v ?? null, null, 2);
  }

  function refreshAll() {
    resizeCanvasWrap();
    renderNotes();
    renderEvents();
    refreshTitlebar();
    refreshSelectors();
    refreshSongPanel();
    refreshNotePanel();
    refreshEventPanel();
    updatePlayhead(getCurrentMs());
  }

  /* =================================================================
   *  INTERACTION
   * ================================================================= */
  let dragState = null;

  function pickLaneFromX(x) {
    const wrapWidth = dom["timeline-canvas-wrap"].clientWidth;
    const totalLaneWidth = LANE_COL_WIDTH * 2 + 18;
    const startX = (wrapWidth - totalLaneWidth) / 2;
    if (x < startX || x > startX + totalLaneWidth) return null;
    const rel = x - startX;
    if (rel <= LANE_COL_WIDTH) { // left block = opponent (4-7)
      const lane = Math.floor(rel / LANE_WIDTH);
      return 4 + Math.max(0, Math.min(3, lane));
    }
    const rel2 = rel - LANE_COL_WIDTH - 18;
    if (rel2 < 0) return null;
    const lane = Math.floor(rel2 / LANE_WIDTH); // right block = player (0-3)
    if (lane < 0 || lane > 3) return null;
    return lane;
  }

  function onCanvasWrapMouseDown(ev) {
    const rect = dom["timeline-canvas-wrap"].getBoundingClientRect();
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    const ms = snapMs(yToMs(y));

    if (app.tool === "event") {
      const evXPos = eventX();
      if (x >= evXPos - 20) {
        snapshot();
        const newEvent = { t: ms, e: "Default", v: null };
        currentEvents().push(newEvent);
        selectEvent(newEvent);
        markDirty();
        playSfx("noteLay.ogg", 0.35);
        renderEvents();
      }
      return;
    }

    const lane = pickLaneFromX(x);
    if (lane === null) return;

    if (app.tool === "erase") {
      const notes = currentNotes();
      const hit = findNoteNear(lane, ms);
      if (hit) {
        snapshot();
        const idx = notes.indexOf(hit);
        notes.splice(idx, 1);
        if (app.selectedNote === hit) app.selectedNote = null;
        markDirty(); playSfx("noteErase.ogg", 0.4);
        renderNotes(); refreshNotePanel();
      }
      return;
    }

    if (app.tool === "place") {
      const existing = findNoteNear(lane, ms);
      if (existing) {
        selectNote(existing);
        return;
      }
      snapshot();
      const note = { t: ms, d: lane, l: 0, k: null, p: [] };
      currentNotes().push(note);
      currentNotes().sort((a, b) => a.t - b.t);
      selectNote(note);
      markDirty(); playSfx("noteLay.ogg", 0.4);
      renderNotes();
      dragState = { type: "sustain", note, startY: y };
    }
  }

  function findNoteNear(lane, ms) {
    const notes = currentNotes();
    const tolMs = stepMsAt(ms, app.snap) * 0.5;
    let best = null, bestDist = Infinity;
    for (const n of notes) {
      if (n.d !== lane) continue;
      const d = Math.abs(n.t - ms);
      if (d < tolMs && d < bestDist) { best = n; bestDist = d; }
    }
    return best;
  }

  function onNoteMouseDown(ev, note) {
    ev.stopPropagation();
    if (app.tool === "erase") {
      snapshot();
      const notes = currentNotes();
      notes.splice(notes.indexOf(note), 1);
      if (app.selectedNote === note) app.selectedNote = null;
      markDirty(); playSfx("noteErase.ogg", 0.4);
      renderNotes(); refreshNotePanel();
      return;
    }
    selectNote(note);
    dragState = { type: "sustain-edit", note, startY: ev.clientY };
  }

  function onDocMouseMove(ev) {
    if (!dragState) return;
    const rect = dom["timeline-canvas-wrap"].getBoundingClientRect();
    const y = ev.clientY - rect.top;
    const ms = snapMs(yToMs(y));
    const len = Math.max(0, ms - dragState.note.t);
    dragState.note.l = len;
    renderNotes();
  }
  function onDocMouseUp() {
    if (dragState) { markDirty(); dragState = null; }
  }

  function selectNote(n) {
    app.selectedNote = n; app.selectedEvent = null;
    switchInspectorTab("note");
    renderNotes(); renderEvents(); refreshNotePanel(); refreshEventPanel();
  }
  function selectEvent(e) {
    app.selectedEvent = e; app.selectedNote = null;
    switchInspectorTab("event");
    renderNotes(); renderEvents(); refreshNotePanel(); refreshEventPanel();
  }
  function switchInspectorTab(name) {
    document.querySelectorAll(".insp-tab").forEach(t => t.classList.toggle("active", t.dataset.panel === name));
    document.querySelectorAll(".insp-panel").forEach(p => p.classList.toggle("hidden", p.id !== "panel-" + name));
  }

  /* =================================================================
   *  DOM WIRING
   * ================================================================= */
  function bindUi() {
    cacheDom();

    document.querySelectorAll(".insp-tab").forEach(t => t.addEventListener("click", () => switchInspectorTab(t.dataset.panel)));

    document.querySelectorAll(".tool-btn[data-tool]").forEach(b => b.addEventListener("click", () => {
      document.querySelectorAll(".tool-btn[data-tool]").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      app.tool = b.dataset.tool;
    }));
    document.querySelectorAll(".tool-btn[data-engine]").forEach(b => b.addEventListener("click", () => {
      document.querySelectorAll(".tool-btn[data-engine]").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      app.engine = b.dataset.engine;
      toast("Format engine set to " + (app.engine === "base" ? "Base Game" : "V-Slice") + " (schema is shared).");
    }));

    document.getElementById("snap-select").addEventListener("change", (e) => { app.snap = parseInt(e.target.value, 10); drawGrid(); });
    document.getElementById("zoom-in").addEventListener("click", () => setZoom(app.zoom * 1.25));
    document.getElementById("zoom-out").addEventListener("click", () => setZoom(app.zoom / 1.25));

    document.getElementById("difficulty-select").addEventListener("change", (e) => {
      app.difficulty = e.target.value;
      app.selectedNote = null;
      refreshAll();
    });
    document.getElementById("variation-select").addEventListener("change", (e) => {
      app.variation = e.target.value;
      app.selectedNote = null; app.selectedEvent = null;
      refreshAll();
    });

    dom["timeline-canvas-wrap"].addEventListener("mousedown", onCanvasWrapMouseDown);
    document.addEventListener("mousemove", onDocMouseMove);
    document.addEventListener("mouseup", onDocMouseUp);
    window.addEventListener("resize", () => resizeCanvasWrap());

    // Song panel
    document.getElementById("btn-apply-song").addEventListener("click", () => {
      snapshot();
      app.metadata.songName = document.getElementById("f-songName").value || "Unknown";
      app.metadata.artist = document.getElementById("f-artist").value || "Unknown";
      app.metadata.charter = document.getElementById("f-charter").value || "";
      const bpm = parseFloat(document.getElementById("f-bpm").value) || 100;
      const tsnum = parseInt(document.getElementById("f-tsnum").value, 10) || 4;
      const tsden = parseInt(document.getElementById("f-tsden").value, 10) || 4;
      if (!app.metadata.timeChanges.length) app.metadata.timeChanges.push({ timeStamp: 0, beatTime: 0, bpm, timeSignatureNum: tsnum, timeSignatureDen: tsden });
      else { app.metadata.timeChanges[0].bpm = bpm; app.metadata.timeChanges[0].timeSignatureNum = tsnum; app.metadata.timeChanges[0].timeSignatureDen = tsden; }
      currentChart().scrollSpeed[app.difficulty] = parseFloat(document.getElementById("f-scrollspeed").value) || 1.0;
      app.metadata.playData.stage = document.getElementById("f-stage").value;
      app.metadata.playData.noteStyle = document.getElementById("f-notestyle").value;
      app.metadata.playData.characters.player = document.getElementById("f-charPlayer").value;
      app.metadata.playData.characters.opponent = document.getElementById("f-charOpponent").value;
      app.metadata.playData.characters.girlfriend = document.getElementById("f-charGf").value;
      app.metadata.playData.characters.opponentVocals = [app.metadata.playData.characters.opponent];
      app.metadata.playData.characters.playerVocals = [app.metadata.playData.characters.player];
      app.metadata.looped = document.getElementById("f-looped").checked;
      app.songId = sanitizeSongId(app.metadata.songName);
      markDirty();
      refreshAll();
      toast("Song metadata updated.", "success");
    });

    // Note panel
    document.getElementById("n-time").addEventListener("change", (e) => { if (!app.selectedNote) return; snapshot(); app.selectedNote.t = parseFloat(e.target.value) || 0; currentNotes().sort((a,b)=>a.t-b.t); markDirty(); renderNotes(); });
    document.getElementById("n-lane").addEventListener("change", (e) => { if (!app.selectedNote) return; snapshot(); app.selectedNote.d = Math.max(0, Math.min(7, parseInt(e.target.value, 10) || 0)); markDirty(); renderNotes(); });
    document.getElementById("n-length").addEventListener("change", (e) => { if (!app.selectedNote) return; snapshot(); app.selectedNote.l = Math.max(0, parseFloat(e.target.value) || 0); markDirty(); renderNotes(); });
    document.getElementById("n-kind").addEventListener("change", (e) => { if (!app.selectedNote) return; snapshot(); app.selectedNote.k = e.target.value || null; markDirty(); });
    document.getElementById("btn-delete-note").addEventListener("click", () => {
      if (!app.selectedNote) return;
      snapshot();
      const notes = currentNotes();
      notes.splice(notes.indexOf(app.selectedNote), 1);
      app.selectedNote = null;
      markDirty(); playSfx("noteErase.ogg", 0.4);
      renderNotes(); refreshNotePanel();
    });

    // Event panel
    document.getElementById("e-kind").addEventListener("change", (e) => {
      document.getElementById("e-custom-wrap").classList.toggle("hidden", e.target.value !== "Custom");
    });
    document.getElementById("btn-apply-event").addEventListener("click", () => {
      if (!app.selectedEvent) return;
      snapshot();
      app.selectedEvent.t = parseFloat(document.getElementById("e-time").value) || 0;
      const kindSel = document.getElementById("e-kind").value;
      app.selectedEvent.e = kindSel === "Custom" ? (document.getElementById("e-kind-custom").value || "Custom") : kindSel;
      try {
        const raw = document.getElementById("e-value").value.trim();
        app.selectedEvent.v = raw ? JSON.parse(raw) : null;
      } catch (err) { toast("Event value is not valid JSON — kept previous value.", "error"); }
      currentEvents().sort((a, b) => a.t - b.t);
      markDirty(); playSfx("ClickDown.ogg", 0.3);
      renderEvents(); refreshEventPanel();
    });
    document.getElementById("btn-delete-event").addEventListener("click", () => {
      if (!app.selectedEvent) return;
      snapshot();
      const events = currentEvents();
      events.splice(events.indexOf(app.selectedEvent), 1);
      app.selectedEvent = null;
      markDirty(); playSfx("noteErase.ogg", 0.4);
      renderEvents(); refreshEventPanel();
    });

    // Menu actions
    document.querySelectorAll(".menu-item[data-action]").forEach(item => item.addEventListener("click", () => handleMenuAction(item.dataset.action)));

    // File inputs
    document.getElementById("file-open-fnfc").addEventListener("change", (e) => { if (e.target.files[0]) openFnfcFile(e.target.files[0]); e.target.value = ""; });
    document.getElementById("file-open-json").addEventListener("change", (e) => { if (e.target.files[0]) openJsonFile(e.target.files[0]); e.target.value = ""; });
    document.getElementById("file-inst").addEventListener("change", async (e) => {
      if (!e.target.files[0]) return;
      const buf = await e.target.files[0].arrayBuffer();
      await loadInstFromArrayBuffer(buf);
      toast("Instrumental loaded: " + e.target.files[0].name, "success");
      e.target.value = "";
    });
    document.getElementById("file-voices").addEventListener("change", async (e) => {
      if (!e.target.files[0]) return;
      const buf = await e.target.files[0].arrayBuffer();
      await loadVoicesFromArrayBuffer(buf);
      toast("Vocals loaded: " + e.target.files[0].name, "success");
      e.target.value = "";
    });

    // Playback bar
    document.getElementById("btn-play").addEventListener("click", togglePlay);
    document.getElementById("btn-stop").addEventListener("click", stopPlayback);
    document.getElementById("vol-slider").addEventListener("input", (e) => {
      app.audio.volume = parseFloat(e.target.value);
      if (app.audio.gainNode) app.audio.gainNode.gain.value = app.audio.volume;
    });
    const scrubTrack = document.getElementById("scrub-track");
    scrubTrack.addEventListener("mousedown", (e) => {
      const rect = scrubTrack.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seekTo(pct * contentDurationMs());
    });

    // window control buttons (cosmetic, mimic real editor chrome)
    document.getElementById("btn-minimize").addEventListener("click", () => {
      document.getElementById("toolbox").classList.toggle("hidden");
      document.getElementById("inspector").classList.toggle("hidden");
    });
    document.getElementById("btn-maximize").addEventListener("click", () => {
      document.body.requestFullscreen ? document.body.requestFullscreen().catch(() => {}) : null;
    });

    document.addEventListener("keydown", onKeyDown);

    requestAnimationFrame(tick);
  }

  function setZoom(z) {
    app.zoom = Math.max(0.25, Math.min(4, z));
    document.getElementById("zoom-val").textContent = Math.round(app.zoom * 100) + "%";
    resizeCanvasWrap();
    renderNotes();
    renderEvents();
  }

  function togglePlay() {
    if (app.audio.isPlaying) pausePlayback();
    else playFrom(app.audio.startOffsetMs || getCurrentMs());
  }

  function tick() {
    if (app.audio.isPlaying) {
      const ms = getCurrentMs();
      updatePlayhead(ms);
      scrollToPlayhead(ms, false);
      if (app.metronomeOn) {
        const tc = timeChangeAt(ms);
        const beatMs = 60000 / tc.bpm;
        const beatIdx = Math.floor((ms - tc.timeStamp) / beatMs);
        if (beatIdx !== app._lastBeatTick) { app._lastBeatTick = beatIdx; playSfx("metronome1.ogg", 0.25); }
      }
      if (ms >= contentDurationMs()) stopPlayback();
    }
    requestAnimationFrame(tick);
  }

  function onKeyDown(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
    if (e.code === "Space") { e.preventDefault(); togglePlay(); }
    else if (e.key === "q" || e.key === "Q") setTool("place");
    else if (e.key === "e" || e.key === "E") setTool("erase");
    else if (e.key === "v" || e.key === "V") setTool("event");
    else if (e.key === "Delete" || e.key === "Backspace") {
      if (app.selectedNote) document.getElementById("btn-delete-note").click();
      else if (app.selectedEvent) document.getElementById("btn-delete-event").click();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveFnfc(); }
  }
  function setTool(name) {
    app.tool = name;
    document.querySelectorAll(".tool-btn[data-tool]").forEach(x => x.classList.toggle("active", x.dataset.tool === name));
  }

  function handleMenuAction(action) {
    switch (action) {
      case "new":
        if (!app.dirty || confirm("Discard unsaved changes and start a new chart?")) {
          snapshot();
          app.metadata = freshMetadata();
          app.chart = freshChart();
          app.variation = DEFAULT_VARIATION; app.difficulty = "normal";
          app.selectedNote = null; app.selectedEvent = null;
          clearDirty(); refreshAll();
          toast("New chart created.");
        }
        break;
      case "open-fnfc": document.getElementById("file-open-fnfc").click(); break;
      case "open-json": document.getElementById("file-open-json").click(); break;
      case "save-fnfc": saveFnfc(); break;
      case "save-json": saveJson(); break;
      case "load-inst": document.getElementById("file-inst").click(); break;
      case "load-voices": document.getElementById("file-voices").click(); break;
      case "undo": undo(); break;
      case "redo": redo(); break;
      case "select-all": toast("Tip: click notes individually — multi-select isn't wired up yet."); break;
      case "delete-selected":
        if (app.selectedNote) document.getElementById("btn-delete-note").click();
        else if (app.selectedEvent) document.getElementById("btn-delete-event").click();
        break;
      case "add-difficulty": {
        const name = prompt("New difficulty name:", "hard");
        if (name && !app.metadata.playData.difficulties.includes(name)) {
          snapshot();
          app.metadata.playData.difficulties.push(name);
          app.metadata.playData.ratings[name] = 3;
          currentChart().notes[name] = [];
          currentChart().scrollSpeed[name] = 1.0;
          app.difficulty = name;
          markDirty(); refreshAll();
        }
        break;
      }
      case "add-variation": {
        const name = prompt("New variation name (e.g. erect, pico):", "erect");
        if (name && !app.chart[name]) {
          snapshot();
          app.chart[name] = { scrollSpeed: { normal: 1.0 }, events: [], notes: { normal: [] } };
          app.variation = name;
          markDirty(); refreshAll();
        }
        break;
      }
      case "add-bpm-change": {
        const ms = getCurrentMs();
        const bpm = parseFloat(prompt("New BPM at " + Math.round(ms) + "ms:", timeChangeAt(ms).bpm));
        if (bpm > 0) {
          snapshot();
          app.metadata.timeChanges.push({ timeStamp: ms, beatTime: 0, bpm, timeSignatureNum: 4, timeSignatureDen: 4 });
          app.metadata.timeChanges.sort((a, b) => a.timeStamp - b.timeStamp);
          currentEvents().push({ t: ms, e: "BPMChange", v: { bpm } });
          markDirty(); refreshAll();
          toast("BPM change added.");
        }
        break;
      }
      case "toggle-opponent":
        document.getElementById("lane-headers-opponent").classList.toggle("hidden");
        break;
      case "toggle-waveform":
        app.metronomeOn = !app.metronomeOn;
        toast("Metronome tick " + (app.metronomeOn ? "enabled" : "disabled") + ".");
        break;
      case "help-about":
        alert("FNF Web Chart Editor\n\nA browser-based recreation of the Friday Night Funkin' Base Game / V-Slice chart editor.\nSupports the real SongMetadata + SongChartData schema, packaged as .fnfc files.\n\nBuilt with real game UI assets (chart-editor icons, note sprites, charting SFX).");
        break;
    }
  }

  /* Lane header labels */
  function buildLaneHeaders() {
    const opp = document.getElementById("lane-headers-opponent");
    const ply = document.getElementById("lane-headers-player");
    LANE_NAMES.forEach(n => {
      const a = document.createElement("div"); a.textContent = n; a.style.textAlign = "center"; a.style.fontSize = "10px"; a.style.color = "var(--text-dim)"; a.style.lineHeight = "26px";
      opp.appendChild(a);
      const b = document.createElement("div"); b.textContent = n; b.style.textAlign = "center"; b.style.fontSize = "10px"; b.style.color = "var(--text-dim)"; b.style.lineHeight = "26px";
      ply.appendChild(b);
    });
  }

  /* =================================================================
   *  BOOTSTRAP
   * ================================================================= */
  document.addEventListener("DOMContentLoaded", () => {
    buildLaneHeaders();
    bindUi();
    app.songId = sanitizeSongId(app.metadata.songName);
    refreshAll();
    toast("Ready. Open a .fnfc or start charting.");
  });

  /* expose for debugging / cross-module use */
  window.__fnfEditor = {
    app, currentChart, currentNotes, currentEvents,
    sanitizeSongId, markDirty, clearDirty, toast, playSfx,
    timeChangeAt, stepMsAt, snapMs, pxPerMs, msToY, yToMs,
    contentDurationMs, fmtTime, snapshot, undo, redo,
    openJsonFile, openFnfcFile, saveJson, saveFnfc,
    loadInstFromArrayBuffer, loadVoicesFromArrayBuffer,
    refreshAll,
    NOTE_SPRITES, LANE_COLORS, EVENT_ICONS, LANE_NAMES,
    LANE_COL_WIDTH, LANE_WIDTH, EVENT_COL_X, DEFAULT_VARIATION,
    freshMetadata, freshChart
  };
})();
