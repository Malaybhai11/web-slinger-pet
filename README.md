# webslinger.pet 🕸️

A DOM-aware pixel hero that lives **on** your page — not over it. He stands on
real buttons, walks across your headings, swings from your navbar, and if
there's nothing beneath him… he falls. Every ground contact is a real DOM
element. That's the golden rule.

Zero dependencies. Pure TypeScript + Canvas 2D — **no WebGL, no WebGPU**, runs
smoothly on any CPU, including older Chrome, mobile Safari, and mid-range
Android.

## run it

```bash
npm install     # just typescript
npm run dev     # compiles src/ -> public/js/ and serves on :3000
```

Open http://localhost:3000 — he spawns standing on the big title.

## controls

| input | action |
| --- | --- |
| `A` / `D` or `←` / `→` | walk (hold `Shift` to run) |
| `Space` / `W` / `↑` | jump |
| `S` / `↓` | crouch / let go of a wall |
| click any element | web it and swing |
| click again | release — he keeps the swing's velocity |
| touch: left / right 30% of screen | move |
| touch: center tap | web the tapped element (or jump) |

## how it works (PRD map)

The whole system is built around one rule: **never stand on empty space.**

- `src/hero/engine.ts` — fixed-timestep loop (1/60s accumulator, semi-implicit Euler)
- `src/hero/physics/` — forces & constants (§4.2), constrained pendulum swing (§4.3),
  swept collision + ground queries (§5.2), `elementFromPoint` web targeting (§4.5)
- `src/hero/world/surfaces.ts` — the surface map: scans the DOM, classifies elements
  (buttons bounce, headings are ledges, cards lift…), rejects invisible / tiny /
  `pointer-events:none` elements, occlusion check, fixed-position aware (§5)
- `src/hero/world/dom-scanner.ts` — MutationObserver (200ms debounce) +
  IntersectionObserver + 1s interval keep the map in sync (§8)
- `src/hero/world/interactions.ts` — the page reacts: land glow, heading bounce,
  card lift, link underline, form focus (§8.3); styles in `public/hero.css`
- `src/hero/character/` — the brain: state machine (idle / walk / run / jump / fall /
  swing / land / cling / crouch), platform chaining with step-up & step-down (§5.6),
  web shoot / attach / release / miss-retract (§4.4)
- `src/hero/camera/` — lerped scroll-follow with dead zone (§7.1) + impact shake (§7.2)
- `src/hero/animation/` — dual-mode sprite system (below) + fps animator over the
  60fps render loop
- `src/hero/render/` — one fixed canvas (`pointer-events:none`, `aria-hidden`),
  web line with catenary sag + wind (§4.3), ground shadow, aim dots, particles
- `src/hero/audio/` — Web Audio synthesized thwip / thud / boing / steps (§10),
  zero audio assets
- `src/hero/input/` — keyboard, mouse, touch zones (§6.2, §11)

Accessibility: `prefers-reduced-motion` → the hero stays home; the canvas is
`aria-hidden`; particles/shadow/shake auto-disable if fps drops (§12).

## sprites — two pipelines, one interface

**Real art (default).** `npm run sprites` runs `scripts/extract-sprites.py`,
which cuts frames from the reference sheets in `assets/src-sheets/`, removes
the background, normalizes every frame into a 128×128 cell (feet anchored),
and packs `public/assets/hero-sheet.png` + JSON descriptor + metadata module.
Animations play at **24fps** with 60fps position interpolation.

**Pixel fallback (offline / fresh clone).** If `/assets/hero-sheet.png` is
missing, the loader falls back to an embedded base64 pixel atlas
(`src/hero/animation/sprite-data.ts`, 11fps) — so a bare git clone still runs.
Regenerate the fallback with `npm run sprites:pixel`.

The atlas PNG is binary, so it ships in the release zip rather than in git
history; `npm run sprites` reproduces it byte-for-byte from the source sheets.

## qa

```bash
npm run dev &     # serve first
npm run qa        # playwright: spawn/walk/jump/swing/land/miss checks + screenshots
```

The QA suite verifies the golden rule — every grounded frame has a real DOM
element under his feet. In the console, `__hero.debug()` shows state, ground
tag, surface count, fps and which sprite mode loaded; `__hero.testCast(x, y)`
dry-runs a web shot.

## use it on your own page

```html
<link rel="stylesheet" href="/hero.css" />
<script type="module" src="/js/hero/index.js"></script>
```

No attributes, no config. Every visible element is already his playground —
he spawns on your first heading and takes it from there.

## notes & deviations from the PRD

- Character art comes from user-provided reference sheets, cut by
  `scripts/extract-sprites.py` (OpenCV segmentation, hole-fill for eyes,
  merged-strip rejection). The pixel fallback is an original character drawn
  from scratch.
- Audio is synthesized with Web Audio oscillators/noise instead of mp3 assets
- The "camera" is the page scroll itself (lerped `scrollTo` with a dead zone)
- DEAD/hazard state intentionally omitted — a landing page has no lava
