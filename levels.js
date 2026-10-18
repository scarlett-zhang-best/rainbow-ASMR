// Squishy platform kinds — gel, dough, marshmallow and gummy all behave differently.
// `mound` is how far the squishy mound bulges above its slab (also its standing height).
window.squishyKinds = {
  gel:    { label: 'Jelly Gel',    sink: .62, k: 170, damp: 11, color: [1, .36, .7],  glow: .3,  opacity: .8,  rough: .06, mound: .2,  sound: 'gel' },
  knead:  { label: 'Knead Dough',  sink: .42, k: 230, damp: 19, color: [.94, .45, .63], glow: 0,   opacity: 1,   rough: .95, mound: .05, sound: 'knead' },
  marsh:  { label: 'Marshmallow',  sink: .28, k: 260, damp: 10, color: [1, .87, .93],  glow: .05, opacity: 1,   rough: 1,   mound: .34, sound: 'marsh' },
  gummy:  { label: 'Gummy Blob',   sink: .5,  k: 300, damp: 9,  color: [.98, .16, .52], glow: .2, opacity: .92, rough: .05, mound: .26, sound: 'gummy' },
};

// Each level = one rainbow colour, one outfit reward, floating obby of keycaps + squishies
window.levels = [
  {
    id: 'pink', name: 'Pink Prelude', color: [1, .45, .72], sky: [1, .88, .94],
    reward: 'bubblegum',
    spawn: { x: 0, y: 2.2, z: 7.6 },
    platforms: [
      { t: 'keycap', x: 0,     y: 0,   z: 7,     w: 4,   h: .8, d: 4,   c: [1, .55, .78] },
      { t: 'gel',    x: 0,     y: 0,   z: 2.8,   w: 3.2, h: .6, d: 3.2 },
      { t: 'keycap', x: -1.6,  y: .4,  z: -1.4,  w: 2.6, h: .8, d: 2.6, c: [1, .72, .86] },
      { t: 'knead',  x: 1.6,   y: .8,  z: -5.6,  w: 3.2, h: .7, d: 3.2 },
      { t: 'marsh',  x: -1.6,  y: 1.2, z: -9.8,  w: 3,   h: .8, d: 3 },
      { t: 'gummy',  x: 1.4,   y: 1.6, z: -14,   w: 2.8, h: .7, d: 2.8 },
      { t: 'keycap', x: -1.4,  y: 2,   z: -18.2, w: 2.4, h: .7, d: 2.4, c: [1, .6, .82] },
      { t: 'knead',  x: 1.4,   y: 2.4, z: -22.4, w: 3,   h: .7, d: 3 },
      { t: 'marsh',  x: -1.4,  y: 2.8, z: -26.6, w: 2.8, h: .8, d: 2.8 },
      { t: 'gel',    x: 1,     y: 3.2, z: -30.8, w: 3,   h: .6, d: 3 },
      { t: 'keycap', x: -1,    y: 3.6, z: -35,   w: 2.4, h: .7, d: 2.4, c: [1, .55, .78] },
      { t: 'knead',  x: 0,     y: 4,   z: -39.2, w: 3.4, h: .7, d: 3.4 },
      { t: 'goal',   x: 0,     y: 4.4, z: -43.4, w: 5,   h: .8, d: 5 },
    ],
    // bonus playground after the goal: a bridge to the smashable rainbow tower
    bonus: [
      { t: 'keycap', x: 0, y: 4.7, z: -47.2, w: 3, h: .7, d: 3, c: [1, .55, .78] },
      { t: 'marsh',  x: -1.6, y: 4.9, z: -50.6, w: 2.6, h: .7, d: 2.6 },
      { t: 'knead',  x: 1.4, y: 5.1, z: -54, w: 2.6, h: .7, d: 2.6 },
    ],
    tower: { x: 0, y: 5.6, z: -60, w: 11, d: 9 },
  },
];
