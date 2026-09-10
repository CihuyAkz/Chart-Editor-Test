# V-Slice Chart Editor — FNF Root Layout

Browser-based V-Slice/Base Game chart editor reconstruction with the UI/system split preserved.

## Project root

```text
V-Slice-Chart-Editor/
├── index.html
├── styles/
│   └── editor.css
├── system/
│   ├── editor.js
│   ├── paths.js
│   ├── model.js
│   ├── fnfc.js
│   ├── commands.js
│   ├── audio.js
│   └── toolboxes.js
└── assets/
    ├── data/
    │   ├── characters/
    │   ├── dialogue/
    │   ├── levels/
    │   ├── notestyles/
    │   ├── players/
    │   ├── songs/
    │   ├── stages/
    │   └── ...
    ├── images/
    ├── music/
    ├── scripts/
    ├── shared/
    └── sounds/
```

The `assets/` directory in this package is taken directly from the uploaded `assets.zip`; it is not wrapped inside another `assets/` directory.

The editor exposes canonical paths through `window.FNF_PATHS`, including `songs`, `notestyles`, `stages`, `sharedImages`, `chartEditorImages`, and `chartingSounds`.

Open `index.html` in a modern browser. JSZip is currently loaded from jsDelivr for FNFC/ZIP handling.
