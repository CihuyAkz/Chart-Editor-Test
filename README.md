# FNF Web Chart Editor

A browser-based chart editor for Friday Night Funkin', built directly against the
real **Base Game / V-Slice** chart data schema and using the actual game's chart-editor
UI assets, note sprites, and charting sound effects (from the files you uploaded).

No install, no server, no build step. Open `index.html` in a modern desktop browser
(Chrome, Edge, or Firefox — needs the Web Audio API and File API).

## What it does

- **Real chart format, not a re-invented one.** Notes are stored as `{ t, d, l, k, p }`
  and events as `{ t, e, v }`, matching `SongNoteDataRaw` / `SongEventDataRaw` from the
  game's own `SongData.hx`. Metadata matches `SongMetadata` (`songName`, `artist`,
  `timeChanges`, `playData.characters`, `playData.difficulties`, etc). `d` follows the
  documented rule: `d % 4` is the lane (0=Left, 1=Down, 2=Up, 3=Right) and
  `floor(d / 4)` picks the strumline (0 = player, 1 = opponent).
- **.fnfc import/export.** A `.fnfc` is a zip containing `manifest.json`
  (`ChartManifestData`), one `{songId}-metadata[-variation].json` and
  `{songId}-chart[-variation].json` per variation, matching
  `ChartManifestData.hx`'s naming convention — plus `Inst.ogg` / `Voices-*.ogg` if you've
  loaded audio. Files exported here should read back into this editor (and follow the
  same shape the real engine writes), and `.fnfc` files produced by the real engine
  should import here too, provided their JSON uses this same schema version.
- **Loose chart JSON import**, with a best-effort adapter for the older single-file
  `{ song: { notes, player1, player2, bpm, speed, ... } }` shape (like the bundled
  `assets/data/songs/test/test.json` sample) alongside the modern
  `{ scrollSpeed, events, notes }` shape.
- **Event system**, importable and exportable as part of the chart JSON's `events`
  array — add markers on the event lane, pick a kind (`FocusCamera`, `PlayAnimation`,
  `BPMChange`, the `sserafim*` stage events, or a custom kind), and edit the raw JSON
  value payload per event.
- **Base Game / V-Slice toggle** in the toolbox — both write the identical schema
  described above (V-Slice *is* that schema); the toggle is there because you asked
  for both entry points, but there's only one underlying format to keep charts portable.
- **Difficulties and variations**, add/switch from the toolbox, each with their own
  note lists (difficulties) and their own metadata/chart file pair on export
  (variations) — mirroring `playData.difficulties` / `playData.songVariations`.
- **Real assets, original root paths.** The `assets/` folder in this project mirrors
  the actual game's asset paths byte-for-byte (`assets/shared/images/notes.png` +
  `.xml`, `assets/shared/images/ui/chart-editor/...`, `assets/sounds/chartingSounds/...`,
  `assets/images/cursor/...`). The editor's note icons are cropped straight from the
  real `notes.png` / `noteStrumline.png` sprite atlases (see `editor-sprites/`, which is
  a derived-only folder kept separate from the authentic `assets/` tree so the original
  root stays untouched). UI chrome (`minimize.png`, `maximize.png`, `playbar-head.png`)
  and event icons are the real files. Placing/erasing notes plays the real
  `noteLay.ogg` / `noteErase.ogg` / `undo.ogg` charting SFX.
- No emoji anywhere in the UI — window controls, tools, and menu items use the actual
  game icons or plain text/SVG, the same way the real editor's chrome does.

## Using it

1. Open `index.html`.
2. **File → Import Instrumental…** / **Import Vocals…** to load audio (optional — you
   can chart against the metronome tick alone via **View → Toggle Metronome Tick**).
3. Pick a **Tool** (Select/Place, Eraser, Event) and a **Snap** division in the left
   toolbox.
4. Click a lane on the grid to drop a note at the snapped time; drag downward right
   after placing (or drag an existing note) to set a sustain length.
5. Switch to the **Event** tool and click the Events column to drop a marker; edit its
   kind and JSON value in the right-hand Event panel.
6. Fill in song info in the right-hand **Song** panel (name, artist, BPM, characters,
   stage, note style) and hit **Apply**.
7. **File → Export Chart (.fnfc)** for the full portable package (with audio if
   loaded), or **Export Chart Data (.json)** for just the current variation's chart
   file.

## Keyboard shortcuts

`Space` play/pause · `Q` select/place tool · `E` eraser · `V` event tool ·
`Delete` remove selection · `Ctrl+Z` / `Ctrl+Y` undo/redo · `Ctrl+S` export `.fnfc`.

## Known limitations

- Multi-note box-select/drag-move isn't wired up — notes are placed, dragged for
  sustain length, and deleted one at a time.
- The legacy `{ song: ... }` importer is best-effort: real legacy-chart migration
  (see the game's own `SongDataMigrator.hx`) handles many more historical edge cases
  than are practical to replicate here.
- Event kinds are edited as raw JSON values rather than through per-event-type
  generated forms, since the full per-event field schema lives in game script data
  this project doesn't have access to.
