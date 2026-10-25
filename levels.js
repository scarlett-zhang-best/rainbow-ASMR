// Squishy platform kinds — gel, dough, marshmallow and gummy all behave differently.
// `mound` is how far the squishy mound bulges above its slab (also its standing height).
window.squishyKinds = {
  gel:    { label: 'Jelly Gel',    sink: .62, k: 170, damp: 11, color: [1, .36, .68],  glow: .25, opacity: .85, rough: .08, mound: .2,  sound: 'gel' },
  knead:  { label: 'Knead Dough',  sink: .42, k: 230, damp: 19, color: [.86, .38, .52], glow: 0,   opacity: 1,   rough: .95, mound: .05, sound: 'knead' },
  marsh:  { label: 'Marshmallow',  sink: .28, k: 260, damp: 10, color: [.98, .62, .72], glow: .04, opacity: 1,   rough: 1,   mound: .34, sound: 'marsh' },
  gummy:  { label: 'Gummy Blob',   sink: .5,  k: 300, damp: 9,  color: [.95, .12, .44], glow: .18, opacity: .9, rough: .06, mound: .26, sound: 'gummy' },
};

// The very first outfit is yours from the start; everything else is bought in the shop.
// Prices strictly increase with each outfit in the list.
window.STARTER_OUTFIT = 'lavender';
window.shopPrice = function (index) {
  if (index <= 0) return 0;                          // the starter outfit is free
  return Math.round(5 * Math.pow(1.3, index - 1));    // strictly increasing (~30% per outfit)
};

// One theme per rainbow level. Sky / keycap / deck tints are chosen so the platforms
// stay clearly visible against the background (pastels kept for the squishy feel).
const THEMES = [
  { name: 'Pink Prelude',   color: [1, .45, .72],  sky: [1, .82, .9],    keycap: [1, .46, .7],  deck: [1, .86, .92] },
  { name: 'Cherry Red',     color: [.92, .1, .18], sky: [1, .76, .77],    keycap: [.86, .18, .22], deck: [1, .8, .79] },
  { name: 'Tangerine',      color: [1, .44, .05],  sky: [1, .85, .68],    keycap: [1, .48, .08],  deck: [1, .88, .78] },
  { name: 'Lemon Zest',     color: [1, .8, .05],   sky: [1, .94, .68],    keycap: [1, .72, .1],   deck: [1, .95, .78] },
  { name: 'Matcha Green',   color: [.34, .72, .36],sky: [.78, .98, .88],   keycap: [.38, .72, .3],  deck: [.85, .97, .9] },
  { name: 'Lagoon Blue',    color: [.25, .7, .85], sky: [.7, .92, .98],    keycap: [.3, .72, .86],  deck: [.78, .92, 1] },
  { name: 'Deep Sea',       color: [.06, .2, .68], sky: [.68, .82, .98],   keycap: [.12, .28, .78], deck: [.74, .86, .98] },
  { name: 'Amethyst',       color: [.42, .12, .78],sky: [.86, .78, .98],   keycap: [.42, .16, .8],  deck: [.88, .8, .98] },
  { name: 'Violet Mist',    color: [.58, .18, .92], sky: [.9, .82, .98],    keycap: [.5, .14, .86],  deck: [.92, .84, .98] },
  { name: 'Cocoa Bean',     color: [.44, .22, .1],  sky: [.9, .8, .66],     keycap: [.4, .26, .12],  deck: [.88, .78, .64] },
  { name: 'Midnight',       color: [.12, .1, .2],   sky: [.7, .71, .86],    keycap: [.16, .14, .28], deck: [.74, .75, .9] },
  { name: 'Snowfall',       color: [.95, .95, .97], sky: [.96, .96, .98],   keycap: [.95, .95, .98], deck: [.96, .96, .98] },
];
window.levelThemes = THEMES;

// deterministic per-level randomness so a level always builds the same way
function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a += 0x6D2B79F5; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SQUISHY_ROTATION = ['gel', 'knead', 'marsh', 'gummy'];

// Every level shares the same skeleton, themed differently:
//   big launch platform (home) -> staircase into the sky -> test deck with the goal pad
function generateLevel(i) {
  const th = THEMES[i];
  const rnd = seeded(i * 9173 + 41);
  const steps = 7 + Math.min(5, i);
  const spacing = 3.1 + rnd() * .5;
  const rise = .72 + Math.min(.28, i * .03);
  const platforms = [];
  const zEnd = -steps * spacing;
  // launch platform stretches underneath the entire level
  platforms.push({ t: 'solid', x: 0, y: 0, z: zEnd / 2 + 5, w: 20, h: 1.4, d: Math.abs(zEnd) + 20, c: th.deck });
  // staircase
  for (let s = 0; s < steps; s++) {
    const side = s % 2 ? 1 : -1;
    const x = s === 0 ? 0 : side * (1.3 + rnd() * .6);
    const y = 1.2 + s * rise;
    const z = -7.6 - s * spacing;
    const isSquishy = s % 3 !== 1;
    if (isSquishy) {
      platforms.push({ t: SQUISHY_ROTATION[(s + i) % 4], x, y, z, w: 3.2, h: .7, d: 3 });
    } else {
      platforms.push({ t: 'keycap', x, y, z, w: 3, h: .7, d: 3, c: th.keycap });
    }
  }
  // test deck + goal
  const deckY = 1.2 + steps * rise + .35;
  const deckZ = zEnd - 7.5;
  platforms.push({ t: 'solid', x: 0, y: deckY, z: deckZ, w: 14, h: 1.4, d: 10, c: th.deck });
  platforms.push({ t: 'goal', x: -4.6, y: deckY + .3, z: deckZ + 3, w: 4, h: .8, d: 4 });
  return {
    id: THEME_IDS[i], name: th.name, color: th.color, sky: th.sky,
    rewardCoins: 12 + i * 6,
    spawn: { x: 0, y: 2.4, z: 6 },
    home: { x: 0, y: 1.8, z: 5 },
    platforms,
  };
}
const THEME_IDS = ['pink', 'cherry', 'tangerine', 'lemon', 'matcha', 'lagoon', 'abyss', 'amethyst', 'violetta', 'cocoa', 'midnight', 'snowfall'];
window.levels = THEMES.map((_, i) => generateLevel(i));

// ---- Level 1 is hand-authored: the pink playground with the rainbow block tower ----
window.levels[0] = {
  id: 'pink', name: 'Pink Prelude', color: THEMES[0].color, sky: THEMES[0].sky,
  rewardCoins: 15,
  spawn: { x: 0, y: 2.4, z: 6 },
  home: { x: 0, y: 1.8, z: 5 },
  platforms: [
    // big launch pad / home area, stretching under the whole level
    { t: 'solid',  x: 0,    y: 0,    z: -16,   w: 20, h: 1.4, d: 56, c: THEMES[0].deck },
    // the staircase into the sky
    { t: 'gel',    x: 0,    y: 1.2,  z: -7.6,  w: 3.2, h: .7, d: 3 },
    { t: 'keycap', x: -1.6, y: 2.0,  z: -10.8, w: 3,   h: .7, d: 3, c: [1, .46, .7] },
    { t: 'knead',  x: 1.6,  y: 2.8,  z: -14,   w: 3.2, h: .7, d: 3.2 },
    { t: 'marsh',  x: -1.6, y: 3.6,  z: -17.2, w: 3,   h: .8, d: 3 },
    { t: 'gummy',  x: 1.6,  y: 4.4,  z: -20.4, w: 3,   h: .7, d: 3 },
    { t: 'keycap', x: -1.6, y: 5.2,  z: -23.6, w: 3,   h: .7, d: 3, c: [1, .38, .62] },
    { t: 'knead',  x: 1.6,  y: 6.0,  z: -26.8, w: 3.2, h: .7, d: 3.2 },
    { t: 'gel',    x: -1.6, y: 6.8,  z: -30,   w: 3.2, h: .7, d: 3 },
    // wide solid starter-test deck holding the whole rainbow block tower
    { t: 'solid',  x: 0,    y: 8.25, z: -38,   w: 16, h: 1.4, d: 11, c: THEMES[0].deck },
    { t: 'goal',   x: -5.4, y: 8.65, z: -34.5, w: 4,   h: .8, d: 4 },
  ],
  tower: { x: 0, y: 8.95, z: -39.5, w: 11, d: 6 },
};
