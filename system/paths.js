// Canonical FNF asset-root paths.
// This mirrors the uploaded FNF asset root: assets/data, assets/images, assets/music,
// assets/scripts, assets/shared and assets/sounds.
(function () {
  const root = (window.FNF_ASSET_ROOT || './assets/').replace(/\/$/, '');
  window.FNF_PATHS = Object.freeze({
    root,
    data: `${root}/data`,
    songs: `${root}/data/songs`,
    stages: `${root}/data/stages`,
    noteStyles: `${root}/data/notestyles`,
    images: `${root}/images`,
    music: `${root}/music`,
    scripts: `${root}/scripts`,
    shared: `${root}/shared`,
    sharedImages: `${root}/shared/images`,
    chartEditorImages: `${root}/shared/images/ui/chart-editor`,
    sounds: `${root}/sounds`,
    chartingSounds: `${root}/sounds/chartingSounds`,
  });
})();
