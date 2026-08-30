# webslinger.pet 🕸️

A pixel Spider-Man who lives **on** your page — not over it. He patrols your
nav, hops button to button, web-swings to a distant card, perches on a heading
to stretch, and turns to face you to say something unkind about your copy. If
there's nothing beneath him… he falls. Every ground contact is a real DOM
element. That's the golden rule.

He runs himself. Keyboard control is still there and takes over the instant you
touch it, but left alone he has his own reasons for what he does.

Zero runtime dependencies. Pure TypeScript + Canvas 2D — **no WebGL, no
WebGPU** — at a locked 60fps.

## run it

```bash
npm install
npm run dev      # builds the atlas, compiles src/ -> public/js/, serves :3000
```

Open http://localhost:3000. He spawns standing on the big title.

- http://localhost:3000/sprites.html — every baked frame and every clip,
  looping side by side. This is the page to look at when judging the art.

## controls

He does not need you. But if you want the wheel:

| input | action |
| --- | --- |
| `A` / `D` or `←` / `→` | walk (hold `Shift` to run) |
| `Space` / `W` / `↑` | jump |
| `S` / `↓` | crouch / let go of a wall |
| click any element | web it and swing |
| click again | release — he keeps the swing's velocity |
| touch: left / right 30% | move · centre tap: web the tapped element |

Any input hands him to you for 4 seconds; then the director takes back over.

## the art

The character is a real [PixelLab](https://www.pixellab.ai) sprite —
96×96, eight directions, generated from the prompt *"spiderman with some witty
character and behaviour"* and kept in `assets/spiderman_with_some_witty_character.zip`.

Two things about that art shaped the whole design:

- Its **front and three-quarter views are excellent** (28×47 and 23×48 — red
  mask, white eyes, blue legs, arms cleanly separated from the torso).
- Its **side profile is not** (15×47 — a cramped red column with the limbs
  fused and no blue left in the palette).

So this is a **three-quarter-view mascot**, not a side-scroller. Walking right
is `south-east`, standing still is `south`, and the thin `east` profile is used
deliberately and only where the body is a rotating arc more than a character —
the web-swing, and perching to look off an edge. Every westward direction is
the eastward frame drawn mirrored, so no direction is paid for twice.

### buying frames

`tools/pixellab.mjs` buys animations from the PixelLab API and banks the PNGs in
`assets/pixellab/`, so the build never needs the API again.

```bash
node tools/pixellab.mjs                              # dry run: ledger + cost
PIXELLAB_TOKEN=... node tools/pixellab.mjs --wave 1 --commit
PIXELLAB_TOKEN=... node tools/pixellab.mjs --pull-existing --commit   # free
```

It is deliberately hard to overspend with: dry-run by default, a hard
`--max-gen` cap checked against `GET /v2/balance`, explicit `directions` on
every request (template mode otherwise animates all eight — eight generations
instead of one), and an idempotent `assets/pixellab/ledger.json` so a re-run
buys nothing. The token is read from the environment and never written to disk.

Templates are filtered by the character's body type. This one is `mannequin`,
whose catalogue has **no** hang, climb, sit, sleep, yawn or wave — so several
clips are repurposes, and they're better than they sound:

| we call it | template | why |
| --- | --- | --- |
| `thwip` | `throw-object` | the throwing motion is the web-shot |
| `hang` | `pull-heavy-object` | hauling on a line — the swing pose |
| `land` | `crouching` | impact absorption |
| `skid` | `running-slide` | stopping at the edge of a button |
| `faceplant` | `falling-back-death` | a landing that went badly |
| `stretch` | `pull-heavy-object` (front) | the closest thing to a stretch |
| `press` | `pushing` | he presses your buttons, literally |

### building the sheet

```bash
npm run sprites      # node tools/build-atlas.mjs
```

Reads everything under `assets/pixellab/` and writes
`public/assets/hero-atlas.png` + `.json`,
`src/hero/animation/atlas-data.ts` and the contact sheet. It:

- re-anchors every frame on the character's **feet** — the source animations
  each sit at their own offset in the 96×96 cell, and without this he visibly
  bobs and slides between frames of one cycle;
- snaps the whole sheet to **one 48-colour palette** built from the canonical
  rotations, because each animation is quantised independently by the API and
  the suit red otherwise drifts between clips;
- hardens alpha to binary and despeckles orphan pixels.

The tooling is plain Node with **no dependencies** — `tools/png.mjs` is a small
8-bit RGBA PNG codec on `node:zlib`, since the project ships nothing and the box
has no Pillow or ImageMagick.

## how it works

- `src/hero/engine.ts` — fixed 1/60s accumulator; hands the renderer an `alpha`
  so position **interpolates between physics steps** (without it a 120Hz display
  stutters on a perfectly regular simulation)
- `src/hero/ai/` — the pet. `needs.ts` (energy / boredom / curiosity /
  sociability), `director.ts` (utility scoring + softmax + cooldowns, driving
  the *same* `InputState` the keyboard produces, so autonomous and manual
  movement cannot diverge), `quips.ts` (what he says, and the rate limiter that
  matters more than the writing)
- `src/hero/animation/` — `direction.ts` (8 directions from 5 images + mirror),
  `clips.ts` (state → clip with fallback chains, so a partial atlas still runs),
  `animator.ts` (per-clip frame rates, held frames for snap), `pose.ts`
  (squash on impact, stretch in the air, tilt to the swing arc — volume
  conserved)
- `src/hero/render/` — one fixed canvas (`pointer-events:none`, `aria-hidden`),
  web line with catenary sag, and `bubble.ts` + `font.ts`: a 5×7 bitmap font and
  a speech bubble drawn **on the canvas**, never the DOM, so it can't reflow or
  restyle the host page
- `src/hero/world/surfaces.ts` — scans the DOM, classifies elements (buttons
  bounce, headings are ledges, cards lift), rejects invisible / tiny /
  `pointer-events:none` elements, occlusion-checks, fixed-position aware
- `src/hero/physics/` — forces, constrained pendulum swing, swept collision,
  `elementFromPoint` web targeting
- `src/hero/camera/` — the camera is the page scroll: lerped `scrollTo` with a
  dead zone, plus impact shake

Pixel crispness comes from three rules, all of which the previous renderer
broke: `imageSmoothingEnabled = false` everywhere, integer-only scaling, and
destinations snapped to whole **device** pixels (on a dpr-2 screen a half-CSS-
pixel offset is a real blurred edge).

Accessibility: `prefers-reduced-motion` → he stays home; the canvas is
`aria-hidden`; particles / shadow / shake auto-disable if the frame time slips.

## qa

```bash
npm run dev &
npm run qa       # engine correctness + the golden rule
npm run poses    # every pose photographed, then 30s of autonomy + frame timing
```

`qa/shoot.mjs` checks spawn, walk, jump, swing, release, land, out-of-range
miss and page interaction classes, and asserts `sprites: "atlas"` — with the
procedural fallback gone, anything else is a build failure, not a degraded mode.

`qa/poses.mjs` forces all 17 states, crops a 2× shot of each, then watches him
for 30s with no input and asserts he reaches several distinct goals, states and
clips. It samples frame time **separately** from screenshots on purpose:
`page.screenshot()` stalls the compositor, and an earlier version of that file
reported a 48fps "regression" that was entirely its own screenshots.

In the console: `__hero.debug()` (state, clip, direction, frame, fps, current
goal and the needs vector), `__hero.force(state)` to pin a pose,
`__hero.force(null)` to release, `__hero.setAuto(false)` to switch the director
off, `__hero.reset()` to put him back on the spawn surface, `__hero.talk(text)`,
and `__hero.testCast(x, y)` to dry-run a web shot.

## use it on your own page

```html
<link rel="stylesheet" href="/hero.css" />
<script type="module" src="/js/hero/index.js"></script>
```

Serve `public/assets/hero-atlas.png` alongside it. No attributes, no config —
every visible element is already his playground.

## notes

- Audio is synthesized with Web Audio oscillators and noise; there are no audio
  assets.
- Spider-Man is Marvel/Disney IP. Fine for a personal project; worth knowing
  before publishing anything under that name.
