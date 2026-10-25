# Rainbow ASMR Obby — Design Spec

Status: **Level 1 (Pink Prelude) implemented.** Levels 2-12, shop, and powerups still to build.

### Built so far (Level 1)
- `levels.js` — level data (platforms, coins, spawn, reward) + `squishyKinds` table.
- Squishy kinds, each with its own physics, look and ASMR voice:
  | kind | feel | max sink | sound |
  |------|------|-----------|-------|
  | `gel` | translucent, wobbly, sinks deepest | 62% | wet sticky blorp |
  | `knead` | matte dough with finger dents, slow | 42% | thick doughy squelch |
  | `marsh` | pale marshmallow mound, floats back | 28% | airy rising squeak |
  | `gummy` | glossy bubbles, springiest | 50% | rubbery boing |
- Stepping on one: squish sound + progressive sink (deeper the longer you stand), a quiet sticky
  "kneading" layer every ~0.3 s, and a sticky release pop when you step off.
- Keycap platforms are rigid and click instead.
- Coins (one large coin per squishy), spinning goal pad, level-complete overlay that pays coins.
- Bonus playground after the goal: a bridge to the old Cannon.js rainbow block tower to smash.
- `localStorage` save: coins, unlocked levels, unlocked outfits (restored into the wardrobe on load).

### Level layout shape (all levels follow this)
1. **Big launch platform** at the bottom — also the level's **home area** (`def.home`), where the
   teleport menu sends you.
2. **Staircase into the sky** — squishies and keycaps alternating, each step ~0.8 higher and ~3.2
   apart, so the level climbs rather than runs flat.
3. **Starter test platform** — a wide deck at the top holding the rainbow block tower and the goal
   pad. Reaching it completes the level.

### Teleport menu (🗺️, top-right next to the wardrobe)
- **🏠 Home area** — drops you on the big launch platform of the current level.
- **Every unlocked level** — teleports to that level's start (rebuilds the level). Locked levels are
  shown greyed out; a level unlocks when you finish the one before it (`save.maxLevel`).
- **🛒 Shop** — placeholder that toasts "coming next"; the real shop is the next build step.
- The menu and the wardrobe are mutually exclusive, and each hides the other when opened.

### Hitbox accuracy
- Platform collision uses `hitW`/`hitD` = the platform size **minus twice its corner radius**, i.e.
  the visible flat top face, plus a small `LAND_PAD` (0.32) for the body's centre. Because the meshes
  are rounded, a full bounding-box hitbox let you stand on air past the edge.
- Coins are placed relative to `platformTop()`, so they hover at the real walking height.
- **Nothing has a sharp edge.** Every platform is built with a custom `roundedBox(w, h, d, r)`
  generator (subdivided cube projected onto a rounded-box SDF, with true smooth normals), so
  keycaps, squishies, the goal pad and the tower deck all have soft round corners.
- **Translucent + reflective.** Platforms use `MeshPhysicalMaterial` with slight transparency
  (opacity 0.85–0.95) and a clearcoat highlight; gel/gummy get full clearcoat, dough stays matte.
- **Environment map.** A tiny painted equirect gradient is run through `PMREMGenerator` and set as
  `scene.environment`, so every squishy surface picks up real reflections and specular highlights.
- **Clouds are white and out of the way.** Cloud material is white with a low emissive
  (`emissiveIntensity .3`, opacity .5) so the hemisphere light can never grey them out, and they are
  placed well below and to the sides of the course (y −16…−4, 16–50 units off-axis) so they never
  block the camera's view of the platforms. The hemisphere light itself is now white-over-lilac.
- The visible surface and the collision surface stay the same number (`topExtra`), so rounding the
  geometry never puts a platform edge above the line your feet stand on.

### Collision system (rewritten after fall-through complaints)
- Movement is integrated in **4 substeps per frame**, so a fast fall can never skip over a slab.
- **Swept landing test**: if the feet crossed a platform's top surface during this substep, we land
  on it even if the body is already slightly below the top.
- **Deep-penetration rescue**: a body found inside a slab is pushed up to its surface instead of
  being treated as a side hit.
- **Forgiving edges**: the landing footprint is `EDGE_GRACE` (0.3) wider than the side-collision box,
  so grazing a platform corner still counts as a landing.
- **Side collision only when clearly inside** (feet 0.3 below the top) — no more getting shoved off
  a platform by brushing its rim.
- **Snap-down** (0.5) when walking toward a slightly lower platform.
- **Coyote time** (0.11 s) and **jump buffering** (0.13 s) for responsive jumping.
- Tuning constants live together at the top of `script.js`: `GRAVITY, JUMP_POWER, COYOTE,
  JUMP_BUFFER, EDGE_GRACE, SNAP_DROP, LAND_GRACE, LAND_BAND, STICK, DEATH_Y`.
- **LAND_BAND** is deliberately small (0.25): a small "step height" means you rarely have to jump
  *up into* a platform edge, which is what caused clipping between squishies.
- **Sticky ground** (STICK 0.3): while still over the platform you were standing on, your feet stay
  glued to it as you shuffle forward, so stepping onto a neighbouring squishy can't drop you.
- **Depenetration pass** (`resolvePenetration`, runs every substep): if the body is ever found
  embedded inside a slab it is pushed straight up out of the surface — never sideways, never through.
- **Feet pinning** (`pinFeetToSurface`): feet are clamped to the exact top of the current surface
  every frame, so no sinking while standing and no hovering.

### Bonus playground (end of Pink Prelude)
The level now ends at the **rainbow block tower** rather than a "bonus" side area.
- The tower deck is a **rigid `solid` platform** (white slab, pink stripes) — deliberately *not* a
  squishy, so the Cannon.js boxes have a permanent floor.
- Anti-tunnelling for boxes: the static cannon base is 6 units thick, contacts are stiffer
  (`contactEquationStiffness 1e8`), damping raised, and `updateBlocks()` clamps any block that ends
  a step below the deck back onto it with its downward velocity zeroed.
- Low walls keep smashed blocks on the deck.

## Look & feel (brightness fix)
- **Linear vs sRGB**: Three.js r128 treats material colours as *linear*-light, so pastel values like
  `[1, .87, .93]` rendered washed out / near-white. All platform + character materials now run through
  `convertSRGBToLinear()` via the shared `srgb()` helper, so the rainbow reads rich instead of hot.
- **Tuned lights**: hemisphere 0.8, sun 1.05 (was 0.95 / 1.4) — stops the day-sunny wash-out.
- **Darker theme tints**: marshmallow squishy was near-white `[1, .87, .93]` (invisible on bright sky);
  now pinkish `[.98, .62, .72]`. All keycaps/skins slightly deepened; skies and deck tints softened.

## Reference
**Rainbow Obby** (emolingo games) — https://poki.com/en/g/rainbow-obby — the benchmark for this
project: 3D obby with WASD walk + Space jump, multiple worlds, forgiving platforming, coins,
skins, powerups, desktop + mobile. We keep its control scheme and "never fight the player"
platforming feel, and swap the theme for ASMR squishies.

## Vision
A calm, tactile obby (obby = obstacle course) built around rainbow levels. Every platform is a
squishy or a keycap, so running, landing and jumping produce soft ASMR sounds. Progress through
rainbow-ordered levels, each unlocking a new outfit, collect coins, and spend them in a shop.

## Level order (rainbow progression) — 12 levels, each color once
| # | Color | Notes |
|---|-------|-------|
| 1 | Pink | tutorial / gentle |
| 2 | Red | |
| 3 | Orange | |
| 4 | Yellow | |
| 5 | Green | |
| 6 | Light blue | |
| 7 | Dark blue | |
| 8 | Purple | |
| 9 | Violet | |
| 10 | Brown | |
| 11 | Black | |
| 12 | White | final level |

Each rainbow color appears exactly once, in rainbow order. Resolved: no pink reprise.

## Core mechanics
- **Squishy platforms** — soft bodies you step on; they depress and rebound, playing a squish SFX
  (pitch/volume varies by material: plush, gel, foam).
- **Keycap platforms** — hard plastic click; land = click sound, step = tick, small bounce.
  (Consistent with the rainbow ASMR theme: the original project is literally called
  "Super Rainbow **Money** Adventure" → money/keycap aesthetic.)
- **Coins** — exactly **one large coin per squishy**, floating 1.35 above its walking surface
  (radius 0.48, spinning). Coins are the shop currency.
- **Outfit unlock** — finishing a level unlocks exactly one new outfit, added to the wardrobe.
- **Death** — falling respawns at the level start (or last checkpoint); costs no coins.

## Shop (built)
- Reachable from the teleport menu (🛒) — a purple room with a row of **glass display tubes**, each
  holding a **mannequin wearing the outfit** (built with the same rig as the player, so the tube
  shows exactly what you get).
- **Stand on the pad in front of a tube** and press **E** (or the on-screen **USE** button).
  - Not owned → buys it for the price (pad glows gold when affordable, grey when not)
  - Owned → wears it (pad glows green)
- Prices are **strictly increasing**: `price(i) = round(5 × 1.3^(i-1))`, so 5, 7, 8, 11, 14, 19 …
- The **starter outfit (Lavender) is free and owned from the start**; every other outfit must be
  bought. 20 outfits total (4 girl + 4 boy + 12 rainbow).
- Signs above each tube are canvas textures that re-draw when you buy something.
- 🚪 Leave pad by the entrance returns you to the world.

## Progression changes
- Finishing a level now pays **coins** (`rewardCoins`, 15 → 78) and unlocks the next level.
- Outfits are **no longer granted free by level completion** — they are bought in the shop, per the
  latest instruction. If you want level rewards to hand out an outfit again, that is a small change.
- Completing the **final level (Snowfall)** shows a golden **congratulations screen** with levels
  beaten, outfits owned and total coins, plus a burst of coin chimes.

## Progression / saving
- localStorage: unlocked levels, owned outfits, equipped outfit, coin balance, owned powerups,
  best times per level.
- Currency persists on death; only spendable in the shop.

## Audio direction (established so far)
- All sounds are **synthesized at runtime with the Web Audio API** (no audio files):
  `three`-side code owns a small synth layer (`sfx`) with a compressor bus and a soft-room
  convolution reverb for the ASMR layer.
- Jump + footsteps: layered ASMR (cloth brush, muffled tap, crinkle bursts, breathy tail).
- Landings/impacts: squishy (band-passed noise sweeping down + low body thump).
- Blocks: Cannon.js collision events → panned squishy thuds.
- Convention: soft attacks (~30–60 ms), low gains, reverb send for the ASMR layer only.

## Technical plan (on top of the current build)
Current stack: `three.min.js` (r128) + `cannon.min.js` (0.6.2), both vendored locally, loaded as
plain scripts so `index.html` works from `file://`.

1. Level data format: array of level descriptors (color theme, platform list, coin list,
   spawn, checkpoint, unlock reward) — generator-driven so new levels are cheap.
2. Platform types: `squishy` (springy, deform on contact) and `keycap` (rigid, clicky) sharing a
   common interface; Cannon bodies with material-specific friction/restitution.
3. World streaming: build/dispose level geometry on level load to keep the frame rate up.
4. Hub + shop scene, teleport on entry/exit.
5. HUD: level name/color, coins, outfit preview, shop button, progress.
6. Persistence layer + settings (audio on/off, volume).

## Open questions
1. ~~Pink at level 1 and 10~~ — resolved: pink appears once, 12 levels total.
2. Should squishy platforms be destructible/temporary, or just bouncy?
3. Coin value: one coin per pickup, or denominations (silver/gold/rainbow)?
4. Powerups: consumable (bought per use) or permanent unlocks?
5. Level select: linear unlock only, or free travel to unlocked levels?
