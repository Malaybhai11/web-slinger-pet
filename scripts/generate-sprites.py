#!/usr/bin/env python3
"""
generate-sprites.py — builds the hero sprite atlas.

Outputs:
  assets/sprites/hero-sheet.png   64x64 frames, TexturePacker-style grid atlas
  assets/sprites/hero-sheet.json  frame + animation descriptors
  src/hero/animation/sprite-data.ts  base64 atlas + frame map (what the runtime loads,
                                     so no binary assets are needed in git)

Frames are derived from hand-authored 16x14 pixel grids, rendered at 4x into
64x64 cells (nearest-neighbor, crisp pixels). Run:  python3 scripts/generate-sprites.py
"""

import base64
import io
import json
import os

from PIL import Image

W, H = 16, 14
SCALE = 4
CELL = 64
FPS = 11

PALETTE = {
    'o': (21, 14, 31, 255),    # outline
    'r': (230, 58, 62, 255),   # suit red
    'd': (169, 31, 46, 255),   # dark red
    'b': (47, 95, 179, 255),   # suit blue
    'n': (31, 62, 122, 255),   # dark blue
    'w': (242, 246, 255, 255), # eye white
    'p': (244, 240, 230, 255), # glove
    's': (212, 38, 44, 255),   # boots
}

CROUCH = [
    '......oooo......',
    '.....orrrro.....',
    '....orrrrrro....',
    '...orwwrrwwro...',
    '...orwwwrwwwro..',
    '....orrrrrro....',
    '....ordrrdro....',
    '.....orrrro.....',
    '...d.orrrro.d...',
    '..pp..orrro..pp.',
    '..bboobbbboobb..',
    '.bb..obbbbo..bb.',
    '.b...ob..bo...b.',
    'ss...ss..ss...ss',
]

SHOOT = [
    '......oooo......',
    '.....orrrro.....',
    '....orrrrrro....',
    '...orwwrrwwro...',
    '...orwwwrwwwro..',
    '....orrrrrro....',
    '....ordrrdro....',
    '.....orrrro.....',
    '...drrrrrrrrppo.',
    '..pp..orrro.....',
    '..bboobbbboobb..',
    '.bb..obbbbo..bb.',
    '.b...ob..bo...b.',
    'ss...ss..ss...ss',
]

FALL = [
    '......oooo......',
    '.....orrrro.....',
    '....orrrrrro....',
    '...orwwrrwwro...',
    '...orwwwrwwwro..',
    '....orrrrrro....',
    '.pp.ordrrdro.pp.',
    'ppp..orrrro..ppp',
    '.....orrrro.....',
    '....oobbboo.....',
    '....obbbbo......',
    '.....b..b.......',
    '....ss...ss.....',
    '................',
]

SWING = [
    '.........ppo....',
    '........opo.....',
    '......oooo......',
    '.....orrrro.....',
    '....orrrrrro....',
    '...orwwrrwwro...',
    '...orwwwrwwwro..',
    '....orrrrrro....',
    '....ordrrdro....',
    '...dorrrro.d....',
    '..pp.orrrro.....',
    '...oobbboo......',
    '..oobbbbo.......',
    '..ss..ss........',
]


def rows_of(grid):
    out = []
    for row in grid:
        assert len(row) == W, f'bad row len {len(row)}: {row!r}'
        out.append(row)
    return out


def render(grid, sx=1.0, sy=1.0, dy=0):
    """Render a 16x14 grid into a 64x64 cell, feet anchored to the cell bottom."""
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows_of(grid)):
        for x, ch in enumerate(row):
            if ch != '.':
                px[x, y] = PALETTE[ch]
    img = img.resize((W * SCALE, H * SCALE), Image.NEAREST)
    nw, nh = int(W * SCALE * sx), int(H * SCALE * sy)
    img = img.resize((nw, nh), Image.NEAREST)
    cell = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    cell.paste(img, ((CELL - nw) // 2, CELL - nh + dy * SCALE), img)
    return cell


def blinked(grid):
    return [row.replace('w', 'o') for row in grid]


def walk_grid(phase):
    """4-stance stride: legs + counter-swinging arms built from column offsets."""
    lo = [0, 1, 0, -1][phase]      # left leg offset (grid px)
    ro = -lo                        # right leg counter-phase
    rows = list(CROUCH[:9])

    # arms row: hands counter-swing to same-side leg
    a = ['.'] * W
    for i, ch in enumerate('......orrro.....'):
        if ch != '.':
            a[i] = ch
    lh, rh = 2 + ro, 11 + lo
    for hx in (lh, lh + 1, rh, rh + 1):
        if 0 <= hx < W:
            a[hx] = 'p'
    rows.append(''.join(a))

    lx, rx = 4 + lo, 9 + ro
    rows.append('..bboobbbboobb..')  # hips
    for _ in range(2):              # shin rows
        r = ['.'] * W
        for cx in (lx, lx + 1, rx, rx + 1):
            if 0 <= cx < W:
                r[cx] = 'b'
        rows.append(''.join(r))
    f = ['.'] * W                   # feet
    for cx in (lx, lx + 1, rx, rx + 1):
        if 0 <= cx < W:
            f[cx] = 's'
    rows.append(''.join(f))
    return rows


def arms_up(grid):
    g = list(grid)
    g[5] = '.pp.orrrrrro.pp.'
    g[6] = 'pp..ordrrdro..pp'
    g[7] = '.....orrrro.....'
    return g


def legs_mirror(grid):
    g = list(grid)
    g[12] = '.....ss..ss.....'
    return g


def main():
    frames = []  # (name, cell image)

    # idle: breathing bob + a blink frame
    frames.append(('idle0', render(CROUCH, dy=0)))
    frames.append(('idle1', render(CROUCH, dy=1)))
    frames.append(('idle2', render(CROUCH, dy=0)))
    frames.append(('idle3', render(blinked(CROUCH), dy=0)))

    # walk: 4 stances x bob = 8 frames
    for p in range(4):
        frames.append((f'walk{p*2}', render(walk_grid(p), dy=0)))
        frames.append((f'walk{p*2+1}', render(walk_grid(p), dy=1)))

    # jump: crouch -> stretch -> air -> tuck
    frames.append(('jump0', render(CROUCH, sx=1.15, sy=0.80)))
    frames.append(('jump1', render(FALL, sx=0.92, sy=1.12)))
    frames.append(('jump2', render(FALL)))
    fall_tuck = list(FALL)
    fall_tuck[11] = '....obbbbo......'
    fall_tuck[12] = '....ss..ss......'
    frames.append(('jump3', render(fall_tuck)))

    # land: impact squash -> settle -> recover
    frames.append(('land0', render(CROUCH, sx=1.30, sy=0.70)))
    frames.append(('land1', render(CROUCH, sx=1.15, sy=0.85)))
    frames.append(('land2', render(CROUCH)))

    # swing: shoot -> hang -> legs trail -> shoot low
    frames.append(('swing0', render(SHOOT)))
    frames.append(('swing1', render(SWING)))
    frames.append(('swing2', render(legs_mirror(SWING))))
    frames.append(('swing3', render(SHOOT, dy=1)))

    # fall: arms out / arms up (wind)
    frames.append(('fall0', render(FALL)))
    frames.append(('fall1', render(arms_up(FALL))))

    # cling: flat against the wall (shoot pose reads as hand-on-wall)
    frames.append(('cling0', render(SHOOT)))

    # crouch
    frames.append(('crouch0', render(CROUCH, sx=1.10, sy=0.85)))

    # ---- atlas ----
    cols = 7
    rows_n = (len(frames) + cols - 1) // cols
    atlas = Image.new('RGBA', (cols * CELL, rows_n * CELL), (0, 0, 0, 0))
    descriptor = {'frames': {}, 'animations': {}, 'meta': {'fps': FPS, 'cell': CELL}}
    for i, (name, cell_img) in enumerate(frames):
        cx, cy = (i % cols) * CELL, (i // cols) * CELL
        atlas.paste(cell_img, (cx, cy), cell_img)
        descriptor['frames'][name] = {'frame': {'x': cx, 'y': cy, 'w': CELL, 'h': CELL}}

    anims = {
        'idle':   ['idle0', 'idle1', 'idle2', 'idle1', 'idle0', 'idle1', 'idle2', 'idle1', 'idle0', 'idle1', 'idle2', 'idle3'],
        'walk':   [f'walk{i}' for i in range(8)],
        'jump':   ['jump0', 'jump1', 'jump2', 'jump3'],
        'land':   ['land0', 'land1', 'land2'],
        'swing':  ['swing0', 'swing1', 'swing2', 'swing1'],
        'fall':   ['fall0', 'fall1'],
        'cling':  ['cling0'],
        'crouch': ['crouch0'],
    }
    descriptor['animations'] = anims

    os.makedirs('assets/sprites', exist_ok=True)
    os.makedirs('src/hero/animation', exist_ok=True)
    atlas.save('assets/sprites/hero-sheet.png')
    with open('assets/sprites/hero-sheet.json', 'w') as f:
        json.dump(descriptor, f, indent=1)

    buf = io.BytesIO()
    atlas.save(buf, format='PNG')
    b64 = base64.b64encode(buf.getvalue()).decode()

    ts = [
        '/** GENERATED by scripts/generate-sprites.py — do not edit by hand. */',
        f'export const ATLAS_B64 =\n  \'{b64}\';',
        '',
        'export const CELL = %d;' % CELL,
        'export const ANIM_FPS = %d;' % FPS,
        '',
        'export const FRAMES: Record<string, { x: number; y: number }> = {',
    ]
    for name, meta in descriptor['frames'].items():
        fr = meta['frame']
        ts.append(f"  {name}: {{ x: {fr['x']}, y: {fr['y']} }},")
    ts.append('};')
    ts.append('')
    ts.append('export const ANIMS: Record<string, string[]> = {')
    for name, seq in anims.items():
        ts.append(f'  {name}: {json.dumps(seq)},')
    ts.append('};')
    ts.append('')
    with open('src/hero/animation/sprite-data.ts', 'w') as f:
        f.write('\n'.join(ts))

    print(f'{len(frames)} frames -> atlas {atlas.size[0]}x{atlas.size[1]}, '
          f'png {os.path.getsize("assets/sprites/hero-sheet.png")} bytes, b64 {len(b64)} chars')


if __name__ == '__main__':
    main()
