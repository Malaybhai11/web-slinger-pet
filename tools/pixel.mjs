/**
 * pixel.mjs — the pixel operations the sprite build needs, on plain RGBA
 * buffers. No dependencies; pairs with png.mjs.
 *
 * Everything here treats alpha as binary. PixelLab returns clean sprites, but
 * quantisation and any later rotation can leave 1-2 stray semi-transparent
 * pixels on the silhouette, and those are exactly what make pixel art look
 * mushy once it is scaled up on a page.
 */

export const ALPHA_CUTOFF = 128;

export function makeImage(width, height) {
  return { width, height, data: Buffer.alloc(width * height * 4) };
}

export const at = (img, x, y) => (y * img.width + x) * 4;

export function getA(img, x, y) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return 0;
  return img.data[at(img, x, y) + 3];
}

/** Force alpha to 0 or 255 so the silhouette has hard edges. */
export function hardenAlpha(img, cutoff = ALPHA_CUTOFF) {
  for (let i = 3; i < img.data.length; i += 4) {
    img.data[i] = img.data[i] >= cutoff ? 255 : 0;
  }
  return img;
}

/** Tight bounding box of opaque pixels, or null for a fully empty frame. */
export function bbox(img, cutoff = ALPHA_CUTOFF) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[at(img, x, y) + 3] >= cutoff) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Where the character's feet are. The bottom of the silhouette gives y; x is
 * the horizontal centroid of the lowest few opaque rows rather than the centre
 * of the whole bbox, so an outstretched arm doesn't drag the anchor sideways
 * and make him slide while he animates.
 */
export function feetAnchor(img, cutoff = ALPHA_CUTOFF) {
  const b = bbox(img, cutoff);
  if (!b) return null;
  const bottom = b.y + b.h - 1;
  const rows = Math.max(1, Math.min(4, b.h));
  let sum = 0, n = 0;
  for (let y = bottom; y > bottom - rows; y--) {
    for (let x = b.x; x < b.x + b.w; x++) {
      if (img.data[at(img, x, y) + 3] >= cutoff) { sum += x; n++; }
    }
  }
  return { x: n ? Math.round(sum / n) : Math.round(b.x + b.w / 2), y: bottom + 1, bbox: b };
}

/** Copy src into dst with its top-left at (dx, dy). Skips transparent pixels. */
export function blit(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const tx = dx + x;
      if (tx < 0 || tx >= dst.width) continue;
      const s = at(src, x, y);
      if (src.data[s + 3] < ALPHA_CUTOFF) continue;
      const d = at(dst, tx, ty);
      src.data.copy(dst.data, d, s, s + 4);
    }
  }
  return dst;
}

/**
 * Re-centre a frame into a cell so its feet land on a fixed anchor point.
 * This is what stops the character bobbing between frames of a cycle, and it
 * is why every clip can share one draw call in the engine.
 */
export function normalize(img, cell, anchorX, anchorY) {
  const a = feetAnchor(img);
  const out = makeImage(cell, cell);
  if (!a) return { img: out, anchor: { x: anchorX, y: anchorY }, empty: true };
  blit(out, img, anchorX - a.x, anchorY - a.y);
  return { img: out, anchor: { x: anchorX, y: anchorY }, empty: false };
}

/** Distinct fully-opaque colours — a sanity check that quantisation held. */
export function countColors(img) {
  const s = new Set();
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] >= ALPHA_CUTOFF) {
      s.add((img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]);
    }
  }
  return s.size;
}

/**
 * Build one palette for the whole character from a set of frames.
 *
 * Each animation comes back from the API quantised independently, so the suit
 * red drifts a few values between clips and the character subtly changes colour
 * when he switches from idle to walk. Picking the most frequent colours across
 * every frame and snapping everything to them fixes that, and drops the sheet
 * from a few hundred colours to a real pixel-art palette.
 */
export function buildPalette(images, max = 48) {
  const hist = new Map();
  for (const img of images) {
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3] < ALPHA_CUTOFF) continue;
      const k = (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2];
      hist.set(k, (hist.get(k) || 0) + 1);
    }
  }
  return [...hist.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => [(k >> 16) & 255, (k >> 8) & 255, k & 255]);
}

/** Snap every opaque pixel to its nearest palette entry, in place. */
export function snapToPalette(img, palette) {
  const cache = new Map();
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < ALPHA_CUTOFF) continue;
    const key = (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2];
    let hit = cache.get(key);
    if (hit === undefined) {
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
      let best = 0, bestD = Infinity;
      for (let p = 0; p < palette.length; p++) {
        const [pr, pg, pb] = palette[p];
        // weighted to human luma sensitivity so greens don't win ties
        const d = 2 * (r - pr) ** 2 + 4 * (g - pg) ** 2 + 3 * (b - pb) ** 2;
        if (d < bestD) { bestD = d; best = p; }
      }
      hit = best;
      cache.set(key, hit);
    }
    const [r, g, b] = palette[hit];
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b;
  }
  return img;
}

/** Horizontal mirror. The engine mirrors at draw time; this is for previews. */
export function mirror(img) {
  const out = makeImage(img.width, img.height);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const s = at(img, x, y);
      const d = at(out, img.width - 1 - x, y);
      img.data.copy(out.data, d, s, s + 4);
    }
  }
  return out;
}

/**
 * Remove single orphaned pixels — an opaque pixel with no opaque 4-neighbour.
 * Quantisation occasionally leaves these floating beside the silhouette and
 * they read as dirt once the sprite is scaled 2x.
 */
export function despeckle(img) {
  const doomed = [];
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (getA(img, x, y) < ALPHA_CUTOFF) continue;
      const n = (getA(img, x - 1, y) >= ALPHA_CUTOFF) + (getA(img, x + 1, y) >= ALPHA_CUTOFF) +
                (getA(img, x, y - 1) >= ALPHA_CUTOFF) + (getA(img, x, y + 1) >= ALPHA_CUTOFF);
      if (n === 0) doomed.push([x, y]);
    }
  }
  for (const [x, y] of doomed) img.data[at(img, x, y) + 3] = 0;
  return doomed.length;
}
