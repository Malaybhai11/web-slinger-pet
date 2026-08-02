# webslinger.pet 🕸️

A pocket-sized pixel-art web-slinging pet that lives on your landing page.
Hover a button and it can't help itself — it shoots a web at it. Leave it
alone too long and it starts swinging across the ceiling out of boredom.

Everything is **2D, zero-dependency TypeScript** — the hero is drawn pixel by
pixel from hand-authored 16×14 grids at runtime. No image assets, no
frameworks, no build-time magic beyond `tsc`.

## run it

```bash
npm install     # just typescript
npm run dev     # compiles src/ -> public/js/ and serves on :3000
```

Open http://localhost:3000 and hover the **Get started** button.

## use it on your own page

1. Compile and copy `public/js/` onto your site (it's plain ES modules).
2. Add the stylesheet's `#web-slinger-canvas` rule (fixed, full-screen,
   `pointer-events: none`, high z-index).
3. Mark anything clickable with `data-web-target`:

```html
<button data-web-target>Get started</button>
<script type="module" src="/js/main.js"></script>
```

The pet will walk the bottom of the viewport, track your cursor with its
eyes, aim at hovered targets, and *thwip* them. A `.webbed` class is toggled
on the element while the web is attached — style it however you like.

## how it works

| file | job |
| --- | --- |
| `src/sprite.ts` | procedural 16×14 pixel sprites (poses: crouch, shoot, wave, fall, swing), blinking + cursor-tracking pupils |
| `src/rope.ts`   | verlet-integrated web rope for pendulum physics |
| `src/spidey.ts` | the brain: idle / walk / aim / shoot / leap / swing state machine |
| `src/main.ts`   | boot — one canvas, one pet |

## qa

```bash
npm run dev &   # serve first
npm run qa      # playwright screenshots + console error check -> qa/out/
```

## notes

- This is an original pixel character inspired by classic web-slinging
  heroes — all sprites are drawn from scratch for this project.
- Respects `prefers-reduced-motion`? Not yet — PR welcome.
