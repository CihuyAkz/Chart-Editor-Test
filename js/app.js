/**
 * app.js
 * Titik masuk. Urutan penting: State harus di-init dulu (butuh data chart)
 * sebelum Grid & Waveform dibangun (keduanya butuh State.totalSteps).
 */
(function bootstrap() {
  const bundle = getChartBundle();
  State.init(bundle);

  // label & ikon panel karakter diambil dari config.js, biar gampang diganti
  document.getElementById("name-opponent").textContent = CONFIG.characters.opponent.name;
  document.getElementById("name-player").textContent = CONFIG.characters.player.name;
  document.querySelector("#icon-opponent img").src = CONFIG.characters.opponent.icon;
  document.querySelector("#icon-player img").src = CONFIG.characters.player.icon;

  Grid.init();
  Waveform.init();
  Playback.init();

  // dua panel (waveform di kiri, grid di kanan) mewakili timeline yang
  // sama, jadi scroll-nya harus selalu senada
  const waveformPanel = document.getElementById("waveform-panel");
  const gridScroll = document.getElementById("grid-scroll");
  let syncing = false;

  gridScroll.addEventListener("scroll", () => {
    if (syncing) return;
    syncing = true;
    waveformPanel.scrollTop = gridScroll.scrollTop;
    syncing = false;
  });

  waveformPanel.addEventListener("scroll", () => {
    if (syncing) return;
    syncing = true;
    gridScroll.scrollTop = waveformPanel.scrollTop;
    syncing = false;
  });
})();
