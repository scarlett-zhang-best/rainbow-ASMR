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
- Coins (one per platform), spinning goal pad, level-complete overlay that unlocks the level outfit.
- Bonus playground after the goal: a bridge to the old Cannon.js rainbow block tower to smash.
- `localStorage` save: coins, unlocked levels, unlocked outfits (restored into the wardrobe on load).

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
  JUMP_BUFFER, EDGE_GRACE, SNAP_DROP, DEATH_Y`.


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
- **Coins** — one collectible currency, dropped along each level's path, magnet/radius pickup.
- **Outfit unlock** — finishing a level unlocks exactly one new outfit, added to the wardrobe.
- **Death** — falling respawns at the level start (or last checkpoint); costs no coins.

## Shop
- Reachable by **teleport** from anywhere (dedicated key / HUD button), no walking back.
- Buys: outfits (cosmetics) and powerups.
- Powerups to design:
  - **Rainbow carpet** — fly/glide (hold jump to rise, glide down).
  - **Level skip** — teleport straight to the next level (single use or consumable).
  - (open) extra jumps, coin magnet, slow-fall.

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
