import type { Preferences } from './config';
import cleanPlate from './assets/campfire-clean-plate.png';
import campfireArt from './assets/campfire-web-stars.png';

// Coordinates refer to the approved artwork, never to an independently redrawn camp.
export const ART = { width: 1672, height: 941, fireX: 1309, fireY: 706 };
export interface SceneLayout {
  width: number; height: number; scale: number; x: number; y: number;
  artWidth: number; artHeight: number; fireX: number; fireY: number;
  tier: 'wide' | 'narrow' | 'small'; short: boolean;
}
export function layoutScene(width: number, height: number): SceneLayout {
  const w = Math.max(1, width), h = Math.max(1, height);
  // Preserve the accepted wide composition; keep the camp readable in portrait.
  const artWidth = Math.min(Math.max(w, Math.min(720, h * 1.3)), h * ART.width / ART.height, w / .48);
  const scale = artWidth / ART.width, artHeight = ART.height * scale;
  const x = w - artWidth, y = h - artHeight;
  return { width: w, height: h, scale, x, y, artWidth, artHeight,
    fireX: x + ART.fireX * scale, fireY: y + ART.fireY * scale,
    tier: w >= 900 ? 'wide' : w >= 580 ? 'narrow' : 'small', short: h < 430 };
}

function random(seed: number): () => number {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}
/** The extended sky matches the accepted faint pinpoints, without halos. */
export function starsMarkup(width: number, height: number, stars: Preferences['stars']): string {
  const rng = random(22);
  const count = Math.min(2400, Math.max(30, Math.round(width * height / 850 * ({ few: .55, standard: 1, many: 1.35 }[stars]))));
  const colors = ['#bac2c8', '#b0c3c8', '#c7c3b6'];
  let markup = '';
  for (let i = 0; i < count; i++) {
    const x = rng() * width, y = rng() * height;
    // Subpixel coverage already dims these tiny dots. Do not dim them twice.
    const radius = .5 + rng() * .12, opacity = .65 + rng() * .17;
    const color = colors[Math.floor(rng() * colors.length)];
    markup += `<circle class="cf-star" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(2)}" fill="${color}" opacity="${opacity.toFixed(2)}"/>`;
  }
  return markup;
}

/** A static background image fills space beyond the artwork without adding
 * hundreds of live DOM nodes or per-star compositing/animation work. */
function staticSkyUrl(width: number, height: number, stars: Preferences['stars']): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${starsMarkup(width, height, stars)}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function sceneStyle(layout: SceneLayout): string {
  return `--cf-art-width:${layout.artWidth}px;--cf-art-height:${layout.artHeight}px;--cf-fire-x:${layout.fireX}px;--cf-fire-y:${layout.fireY}px;--cf-glow-size:${Math.max(12, 52 * layout.scale)}px`;
}

// Only this feathered corridor uses the clean plate. The rest is the approved image.
// All coordinates stay in the source artwork's space, so motion scales with the camp.
function animatedCamp(art: string): string {
  const smoke = 'M1090 449 1107 426 1123 433 1135 466 1165 482 1175 495 1185 528 1208 540 1218 555 1223 582 1243 600 1253 627 1270 646 1280 655 1288 676 1303 693 1295 692 1274 675 1258 663 1254 648 1238 640 1227 611 1201 598 1194 583 1185 566 1163 553 1154 539 1143 517 1119 507 1110 490 1092 476Z';
  const flame = 'M1295 712 1290 682 1303 696 1305 678 1312 695 1316 690 1322 699 1319 711 1310 716Z';
  return `<svg class="cf-living-camp" viewBox="0 0 1672 941" aria-hidden="true">
    <defs>
      <filter id="cf-patch-feather" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
      <mask id="cf-clean-corridor" maskUnits="userSpaceOnUse" x="0" y="0" width="1672" height="941"><path d="${smoke}" fill="white" stroke="white" stroke-width="20" filter="url(#cf-patch-feather)"/><path d="${flame}" fill="white" stroke="white" stroke-width="9" filter="url(#cf-patch-feather)"/></mask>
      <clipPath id="cf-smoke-cut"><path d="${smoke}"/></clipPath>
      <clipPath id="cf-flame-cut"><path d="${flame}"/></clipPath>
      <image id="cf-source-art" href="${art}" width="1672" height="941"/>
    </defs>
    <image href="${cleanPlate}" width="1672" height="941" mask="url(#cf-clean-corridor)"/>
    <g class="cf-smoke-sway"><use href="#cf-source-art" clip-path="url(#cf-smoke-cut)"/></g>
    <g class="cf-smoke-wisp cf-wisp-one"><path d="M1284 679 1291 668 1301 674 1304 685 1296 691 1286 687Z" fill="#a8866033"/></g>
    <g class="cf-smoke-wisp cf-wisp-two"><path d="M1284 679 1291 668 1301 674 1304 685 1296 691 1286 687Z" fill="#76969522"/></g>
    <g class="cf-flame-dance"><use href="#cf-source-art" clip-path="url(#cf-flame-cut)"/></g>
    <g class="cf-sparks"><circle class="cf-spark cf-spark-one" cx="1308" cy="692" r="1.2" fill="#ffd185"/><circle class="cf-spark cf-spark-two" cx="1315" cy="696" r=".9" fill="#f1aa59"/><circle class="cf-spark cf-spark-three" cx="1303" cy="695" r="1" fill="#ffd185"/></g>
  </svg>`;
}
export function sceneMarkup(width: number, height: number, prefs: Preferences): string {
  const l = layoutScene(width, height);
  const sky = `<div class="cf-sky" style="background-image:url('${staticSkyUrl(l.width, l.height, prefs.stars)}')" aria-hidden="true"></div>`;
  return `<div class="cf-composition" style="${sceneStyle(l)}">
    ${sky}
    <div class="cf-camp-layer"><div class="cf-art" style="background-image:url('${campfireArt}')">${animatedCamp(campfireArt)}</div>
    <span class="cf-firelight"></span></div>
  </div>`;
}

/** Resize the static sky only when geometry or density changes, keeping the artwork. */
export function resizeScene(root: HTMLElement, width: number, height: number, prefs: Preferences): void {
  const l = layoutScene(width, height);
  root.querySelector<HTMLElement>('.cf-composition')?.setAttribute('style', sceneStyle(l));
  const sky = root.querySelector<HTMLElement>('.cf-sky');
  if (sky) sky.style.backgroundImage = `url("${staticSkyUrl(l.width, l.height, prefs.stars)}")`;
}
