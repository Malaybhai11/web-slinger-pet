#!/usr/bin/env python3
"""
extract-sprites.py — cuts real animation frames from the reference sheets
(assets/src-sheets/*.jpg), removes the light background, normalizes each frame
into a 128x128 cell (feet anchored at the bottom), and packs a
TexturePacker-style atlas.

Outputs:
  public/assets/hero-sheet.png        real-art atlas (served at /assets/hero-sheet.png)
  assets/sprites/hero-sheet.png       copy for the record
  assets/sprites/hero-sheet.json      frame + animation descriptors
  src/hero/animation/sprite-data-art.ts  frame/anim metadata (text — safe for git;
                                         the PNG ships in the zip / regenerate with
                                         `npm run sprites`)

Run:  python3 scripts/extract-sprites.py
"""

import json
import os

import cv2
import numpy as np
from PIL import Image

CELL = 128
FPS = 24
CHAR_H = 110   # character height inside a cell
FEET_Y = 126   # feet line inside a cell
COLS = 7
TITLE = 27     # title strip height inside a section box (sheets are 1536x1024)

SHEETS = {
    'a': 'assets/src-sheets/sheet-a.jpg',
    'b': 'assets/src-sheets/sheet-b.jpg',
}

# (anim, sheet, (x0, y0, x1, y1), take) — coords are for 1536x1024 sheets
SECTIONS = [
    ('idle',   'b', (3, 3, 337, 180),      5),
    ('walk',   'b', (337, 3, 672, 180),    5),   # frame 6 in the strip is a cut artifact
    ('run',    'b', (672, 3, 1002, 180),   8),
    ('cling',  'b', (3, 363, 585, 495),    6),   # wall-crawl strip = vertical clinging poses
    ('swing',  'b', (3, 870, 720, 1020),   8),
    ('crouch', 'a', (3, 120, 465, 258),    2),
    ('jump',   'a', (465, 120, 960, 258),  9),
    ('land',   'a', (960, 120, 1533, 258), 4),
]
FALL_FROM_JUMP = [4, 5]  # mid-air poses sliced from the jump strip


def merge_nearby(boxes, gap=8):
    merged = True
    while merged:
        merged = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                if a[0] <= b[2] + gap and b[0] <= a[2] + gap and a[1] <= b[3] + gap and b[1] <= a[3] + gap:
                    boxes[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]
                    del boxes[j]
                    merged = True
                    break
            if merged:
                break
    return boxes


def extract_frame(crop_bgr, mask, b):
    """Cut one character, fill enclosed holes (eyes), feather the edge, return RGBA."""
    x0, y0, x1, y1 = b
    pad = 3
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(crop_bgr.shape[1], x1 + pad)
    y1 = min(crop_bgr.shape[0], y1 + pad)
    cimg = crop_bgr[y0:y1, x0:x1]
    cmask = mask[y0:y1, x0:x1]

    # flood-fill from the corner on the inverse mask: anything unreachable is an
    # enclosed hole (e.g. white eyes inside the red head) -> keep those pixels
    inv = np.where(cmask > 0, 0, 255).astype(np.uint8)
    ff_mask = np.zeros((inv.shape[0] + 2, inv.shape[1] + 2), np.uint8)
    cv2.floodFill(inv, ff_mask, (0, 0), 128)
    holes = inv == 255
    alpha = np.where((cmask > 0) | holes, 255, 0).astype(np.uint8)
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0)  # soften jpeg edge artifacts

    rgb = cv2.cvtColor(cimg, cv2.COLOR_BGR2RGB)
    return np.dstack([rgb, alpha])


def to_cell(rgba):
    """Scale into a 128x128 cell, feet anchored at FEET_Y, horizontally centered.
    Returns None for merged multi-character strips (width-capped so hard the
    character would render tiny)."""
    h, w = rgba.shape[:2]
    scale = min(CHAR_H / h, 120 / w)
    if (120 / w) < (CHAR_H / h) and h * scale < 55:
        return None  # several characters merged into one blob — not a frame
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    interp = cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC
    resized = cv2.resize(rgba, (nw, nh), interpolation=interp)
    cell = np.zeros((CELL, CELL, 4), np.uint8)
    x = (CELL - nw) // 2
    y = FEET_Y - nh
    cell[y:y + nh, x:x + nw] = resized
    return cell


def cut_frames(img_bgr, box, take):
    """Segment a section box into ordered character frames (left -> right)."""
    x0, y0, x1, y1 = box
    crop = img_bgr[y0 + TITLE:y1, x0:x1]
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    _, s, v = cv2.split(hsv)
    # character = saturated (reds) or dark (suit shadows); white/gray bg &
    # light-gray web lines are excluded
    mask = (((s > 60) & (v < 250)) | (v < 110)).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((4, 4), np.uint8))

    n, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    boxes = []
    box_w = x1 - x0
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < 300 or w < 12 or h < 18:
            continue
        if w > h * 3.5:
            continue  # wide + short = section label bar, not a character
        if h > w * 4.5:
            continue  # tall sliver = a sliced edge fragment
        if w > box_w * 0.75:
            continue  # section-width artifact (divider / label strip)
        boxes.append([x, y, x + w, y + h])
    boxes = merge_nearby(boxes, gap=6)
    boxes.sort(key=lambda b: (b[0] + b[2]) // 2)
    if len(boxes) > take:
        boxes = sorted(boxes, key=lambda b: (b[3] - b[1]) * (b[2] - b[0]), reverse=True)[:take]
        boxes.sort(key=lambda b: (b[0] + b[2]) // 2)
    return [extract_frame(crop, mask, b) for b in boxes[:take]]


def main():
    imgs = {k: cv2.imread(v) for k, v in SHEETS.items()}
    for k, img in imgs.items():
        if img is None:
            raise SystemExit(f'missing sheet: {SHEETS[k]}')
        print(f'sheet {k}: {img.shape[1]}x{img.shape[0]}')

    anim_frames = {}
    for name, sheet, box, take in SECTIONS:
        frames = cut_frames(imgs[sheet], box, take)
        anim_frames[name] = frames
        print(f'{name}: {len(frames)} frames')

    # falling = mid-air poses from the jump strip
    jump = anim_frames.get('jump', [])
    anim_frames['fall'] = [jump[i] for i in FALL_FROM_JUMP if i < len(jump)]
    print(f"fall: {len(anim_frames['fall'])} frames")

    # pack order matches the engine's expectations
    order = ['idle', 'walk', 'run', 'jump', 'land', 'swing', 'fall', 'cling', 'crouch']
    cells = []  # (frame_name, cell_img)
    anims = {}
    dropped = 0
    for anim in order:
        seq = []
        for fr in anim_frames.get(anim, []):
            cell = to_cell(fr)
            if cell is None:
                dropped += 1
                continue
            fname = f'{anim}{len(seq)}'
            cells.append((fname, cell))
            seq.append(fname)
        if seq:
            anims[anim] = seq
    if dropped:
        print(f'dropped {dropped} merged/invalid frames')

    total = len(cells)
    rows = (total + COLS - 1) // COLS
    atlas = Image.new('RGBA', (COLS * CELL, rows * CELL), (0, 0, 0, 0))
    frames_meta = {}
    for i, (fname, cell_img) in enumerate(cells):
        cx, cy = (i % COLS) * CELL, (i // COLS) * CELL
        atlas.paste(Image.fromarray(cell_img), (cx, cy))
        frames_meta[fname] = {'x': cx, 'y': cy}

    os.makedirs('public/assets', exist_ok=True)
    os.makedirs('assets/sprites', exist_ok=True)
    os.makedirs('src/hero/animation', exist_ok=True)

    atlas.save('public/assets/hero-sheet.png', optimize=True)
    atlas.save('assets/sprites/hero-sheet.png', optimize=True)
    with open('assets/sprites/hero-sheet.json', 'w') as f:
        json.dump({'frames': frames_meta, 'animations': anims,
                   'meta': {'fps': FPS, 'cell': CELL}}, f, indent=1)

    ts = [
        '/** GENERATED by scripts/extract-sprites.py — real-art atlas metadata.',
        '    The PNG itself is binary: ships in the zip, regenerated via `npm run sprites`. */',
        "export const ART_URL = '/assets/hero-sheet.png';",
        f'export const ART_CELL = {CELL};',
        f'export const ART_FPS = {FPS};',
        '',
        'export const ART_FRAMES: Record<string, { x: number; y: number }> = {',
    ]
    for name, meta in frames_meta.items():
        ts.append(f"  {name}: {{ x: {meta['x']}, y: {meta['y']} }},")
    ts.append('};')
    ts.append('')
    ts.append('export const ART_ANIMS: Record<string, string[]> = {')
    for name, seq in anims.items():
        ts.append(f'  {name}: {json.dumps(seq)},')
    ts.append('};')
    ts.append('')
    with open('src/hero/animation/sprite-data-art.ts', 'w') as f:
        f.write('\n'.join(ts))

    size_kb = os.path.getsize('public/assets/hero-sheet.png') // 1024
    print(f'atlas: {atlas.size[0]}x{atlas.size[1]}, {total} frames, {size_kb} KB')


if __name__ == '__main__':
    main()
