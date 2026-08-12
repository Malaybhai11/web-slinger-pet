#!/usr/bin/env python3
"""
generate-sprites.py — mathematically draws every hero animation frame.

No image assets, no extraction: a forward-kinematics skeleton is posed by
per-state animation math (sin/cos gait cycles, keyframed one-shots), and each
frame is rendered from outlined capsule limbs + mask + wedge eyes at 3x
supersampling for smooth, CPU-friendly results.

Run:  python3 scripts/generate-sprites.py   (or: npm run sprites)

Outputs:
  assets/sprites/frames/<state>/<name>.png  individual sprites, one per frame
  assets/sprites/hero-sheet.png             packed atlas (for the record)
  assets/sprites/hero-sheet.json            frame + animation descriptors
  src/hero/animation/rig-data.ts            EVERY FRAME as draw primitives — the
                                            engine replays this onto an offscreen
                                            canvas at boot, so the runtime needs
                                            zero image assets. Text, so it commits.
"""

import json
import math
import os

from PIL import Image, ImageDraw

CELL = 128          # cell size in the atlas
FPS = 24            # animation fps (smooth, per spec)
COLS = 7
SS = 3              # supersample factor for anti-aliasing

# ---- palette (black suit, red accents, white eyes — matches the walk art) ----
INK = (10, 9, 14)         # outline
RED = (30, 28, 38)        # suit primary — mask / torso / arms (near-black)
DRED = (17, 15, 22)       # suit shadow — far arm, torso side panel
SUIT = (24, 24, 30)       # legs
DSUIT = (15, 15, 20)      # far leg
BOOT = (198, 32, 40)      # red accent — boots, hands, chest emblem
DBOOT = (110, 18, 26)
EYE = (244, 246, 255)


def rgb(c):
    return '#%02x%02x%02x' % c


def dr(a):
    """direction vector: 0° = straight down, +° = forward (screen space, y down)"""
    r = math.radians(a)
    return (math.sin(r), math.cos(r))


def rot(x, y, a):
    """rotate vector (x,y) by a° (positive = lean forward)"""
    r = math.radians(a)
    return (x * math.cos(r) - y * math.sin(r), x * math.sin(r) + y * math.cos(r))


# ---- skeleton proportions (cell units, character ≈ 104px tall standing) ----
SEG = dict(
    torso=44,      # hip -> shoulder
    headR=11,
    headFwd=3, headUp=57,
    upperArm=20, foreArm=18, handR=4.5,
    thigh=26, shin=26, toe=9,
    shoulderW=5, hipW=4,
)


def solve(p):
    """Forward kinematics: pose params -> joint positions (origin at hip center)."""
    hy = p['hipDy']
    tilt = p['tilt']

    hipL = (-SEG['hipW'], hy)
    hipR = (SEG['hipW'], hy)
    sx, sy = rot(0, -SEG['torso'], tilt)
    shoulder = (sx, sy + hy)
    hx, hyy = rot(SEG['headFwd'], -SEG['headUp'], tilt + p.get('headTilt', 0))
    head = (hx, hyy + hy)

    j = dict(hipL=hipL, hipR=hipR, shoulder=shoulder, head=head)

    for side in ('L', 'R'):
        hip = hipL if side == 'L' else hipR
        th, sh, ft = p['thigh' + side], p['shin' + side], p['foot' + side]
        dx, dy = dr(th)
        knee = (hip[0] + dx * SEG['thigh'], hip[1] + dy * SEG['thigh'])
        dx, dy = dr(th + sh)
        foot = (knee[0] + dx * SEG['shin'], knee[1] + dy * SEG['shin'])
        dx, dy = dr(th + sh + ft)
        toe = (foot[0] + dx * SEG['toe'], foot[1] + dy * SEG['toe'])
        j['knee' + side], j['foot' + side], j['toe' + side] = knee, foot, toe

        sh0 = shoulder
        sa, ea = p['arm' + side], p['elbow' + side]
        dx, dy = dr(sa + tilt)
        elbow = (sh0[0] + dx * SEG['upperArm'], sh0[1] + dy * SEG['upperArm'])
        dx, dy = dr(sa + ea + tilt)
        hand = (elbow[0] + dx * SEG['foreArm'], elbow[1] + dy * SEG['foreArm'])
        j['elbow' + side], j['hand' + side] = elbow, hand

    return j


def base_pose():
    return dict(
        hipDy=0.0, tilt=0.0, headTilt=0.0,
        thighL=4, shinL=6, footL=90 - 10,   # foot angle relative to leg; ~flat
        thighR=-2, shinR=4, footR=90 - 6,
        armL=-12, elbowL=12, armR=14, elbowR=-10,
        anchor='feet',
    )


# ---- per-state pose math ----
# angles in degrees: 0 = straight down, +forward, −backward, ±180 = straight up

def pose_idle(i, n):
    t = i / n
    p = base_pose()
    breathe = math.sin(2 * math.pi * t)
    p['hipDy'] = 0.8 * breathe
    p['tilt'] = 1.5 + 0.8 * breathe
    p['headTilt'] = 3.0 * math.sin(2 * math.pi * t + 1)
    p['armL'] = -12 - 2 * breathe
    p['armR'] = 14 + 2 * breathe
    return p


def pose_walk(i, n):
    t = i / n
    phi = 2 * math.pi * t
    p = base_pose()
    p['tilt'] = 5
    p['thighL'] = 26 * math.sin(phi)
    p['thighR'] = 26 * math.sin(phi + math.pi)
    p['shinL'] = -6 - 30 * max(0.0, -math.cos(phi))
    p['shinR'] = -6 - 30 * max(0.0, math.cos(phi))
    p['footL'] = 80 + 18 * math.sin(phi + math.pi / 2)
    p['footR'] = 80 + 18 * math.sin(phi - math.pi / 2)
    p['armL'] = -20 * math.sin(phi)          # arms counter same-side leg
    p['armR'] = -20 * math.sin(phi + math.pi)
    p['elbowL'] = 14
    p['elbowR'] = 14
    p['hipDy'] = -1.6 * abs(math.sin(phi))
    return p


def pose_run(i, n):
    t = i / n
    phi = 2 * math.pi * t
    p = base_pose()
    p['tilt'] = 16
    p['thighL'] = 44 * math.sin(phi)
    p['thighR'] = 44 * math.sin(phi + math.pi)
    p['shinL'] = -14 - 52 * max(0.0, -math.cos(phi))
    p['shinR'] = -14 - 52 * max(0.0, math.cos(phi))
    p['footL'] = 95 + 22 * math.sin(phi + math.pi / 2)
    p['footR'] = 95 + 22 * math.sin(phi - math.pi / 2)
    p['armL'] = -34 * math.sin(phi)
    p['armR'] = -34 * math.sin(phi + math.pi)
    p['elbowL'] = 72   # elbows pumped
    p['elbowR'] = 72
    p['hipDy'] = -3.0 * abs(math.sin(phi))
    return p


def lerp_keys(keys, i, n, fields):
    """piecewise-linear keyframe interpolation for one-shot states"""
    t = i / max(1, n - 1)
    segs = len(keys) - 1
    f = min(segs - 1e-9, t * segs)
    k = int(f)
    u = f - k
    a, b = keys[k], keys[k + 1]
    return {f2: a[f2] + (b[f2] - a[f2]) * u for f2 in fields}


FIELDS = ['hipDy', 'tilt', 'headTilt',
          'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR',
          'armL', 'elbowL', 'armR', 'elbowR']


def pose_jump(i, n):
    p = base_pose()
    keys = [
        # 0 deep crouch, loading
        dict(hipDy=14, tilt=18, headTilt=-4, thighL=52, shinL=-50, footL=92,
             thighR=46, shinR=-46, footR=92, armL=-30, elbowL=20, armR=-34, elbowR=18),
        # 1 explosive extension, arms sweep up
        dict(hipDy=-4, tilt=-6, headTilt=4, thighL=-6, shinL=-4, footL=104,
             thighR=-2, shinR=-2, footR=104, armL=-148, elbowL=-10, armR=-156, elbowR=-12),
        # 2 air tuck
        dict(hipDy=-2, tilt=10, headTilt=2, thighL=66, shinL=-72, footL=100,
             thighR=76, shinR=-80, footR=100, armL=-60, elbowL=20, armR=-70, elbowR=24),
        # 3 peak tuck, arms high
        dict(hipDy=-3, tilt=4, headTilt=-2, thighL=72, shinL=-78, footL=98,
             thighR=80, shinR=-84, footR=98, armL=-120, elbowL=10, armR=-128, elbowR=12),
        # 4 opening for landing
        dict(hipDy=2, tilt=10, headTilt=0, thighL=34, shinL=-30, footL=96,
             thighR=42, shinR=-36, footR=96, armL=-40, elbowL=24, armR=-48, elbowR=28),
    ]
    p.update(lerp_keys(keys, i, n, FIELDS))
    return p


def pose_land(i, n):
    """superhero landing: deep crouch, one hand slapped to the ground"""
    p = base_pose()
    keys = [
        # 0 full impact
        dict(hipDy=18, tilt=26, headTilt=-6, thighL=58, shinL=-56, footL=94,
             thighR=64, shinR=-60, footR=94, armL=-44, elbowL=16, armR=56, elbowR=6),
        # 1 hold
        dict(hipDy=16, tilt=24, headTilt=-4, thighL=56, shinL=-54, footL=94,
             thighR=60, shinR=-56, footR=94, armL=-42, elbowL=16, armR=52, elbowR=8),
        # 2 recovering
        dict(hipDy=9, tilt=14, headTilt=0, thighL=38, shinL=-34, footL=90,
             thighR=40, shinR=-36, footR=90, armL=-24, elbowL=14, armR=30, elbowR=-6),
        # 3 nearly up
        dict(hipDy=3, tilt=6, headTilt=0, thighL=14, shinL=-12, footL=86,
             thighR=10, shinR=-10, footR=86, armL=-14, elbowL=12, armR=16, elbowR=-8),
    ]
    p.update(lerp_keys(keys, i, n, FIELDS))
    return p


def pose_swing(i, n):
    """hanging from the raised web hand; legs trail, body sways with the arc.
    (the engine rotates the whole sprite onto the arc tangent at render time)"""
    t = i / n
    phi = 2 * math.pi * t
    p = base_pose()
    p['anchor'] = 'handR'                      # sprite hangs from the web hand
    p['tilt'] = -4 + 10 * math.sin(phi)        # sway along the swing
    p['armR'] = 152 + 4 * math.sin(phi)        # web hand: up & forward
    p['elbowR'] = -6
    p['armL'] = -38 - 10 * math.sin(phi)       # free arm trails back
    p['elbowL'] = 18
    p['thighL'] = -52 - 8 * math.sin(phi)      # legs trail behind, knees bent
    p['thighR'] = -66 - 8 * math.sin(phi + 0.6)
    p['shinL'] = 58
    p['shinR'] = 66
    p['footL'] = 130
    p['footR'] = 130
    p['headTilt'] = -8
    return p


def pose_fall(i, n):
    """spread-eagle freefall, second frame opens even wider"""
    p = base_pose()
    wide = i / max(1, n - 1)
    p['tilt'] = -2
    p['armL'] = -118 - 14 * wide
    p['armR'] = 118 + 14 * wide
    p['elbowL'] = -12
    p['elbowR'] = 12
    p['thighL'] = -34 - 6 * wide
    p['thighR'] = 36 + 6 * wide
    p['shinL'] = 22
    p['shinR'] = -22
    p['footL'] = 100
    p['footR'] = 100
    p['headTilt'] = -6
    return p


def pose_cling(i, n):
    """flat on a wall to his right, hands and feet pressed, fingers crawling"""
    t = i / n
    phi = 2 * math.pi * t
    p = base_pose()
    p['tilt'] = 24
    crawl = math.sin(phi)
    p['armL'] = 78 + 4 * crawl                 # both hands on the wall
    p['armR'] = 86 - 4 * crawl
    p['elbowL'] = 8
    p['elbowR'] = -6
    p['thighL'] = 62 - 5 * crawl               # knees up, feet on the wall
    p['thighR'] = 74 + 5 * crawl
    p['shinL'] = -84
    p['shinR'] = -88
    p['footL'] = 20
    p['footR'] = 20
    p['headTilt'] = -10
    return p


def pose_crouch(i, n):
    t = i / n
    p = base_pose()
    dip = math.sin(2 * math.pi * t)
    p['hipDy'] = 10 + 1.5 * dip
    p['tilt'] = 14
    p['thighL'] = 42
    p['shinL'] = -40
    p['footL'] = 90
    p['thighR'] = 38
    p['shinR'] = -36
    p['footR'] = 90
    p['armL'] = 26
    p['elbowL'] = -22
    p['armR'] = 32
    p['elbowR'] = -26
    return p


STATES = [
    ('idle',   pose_idle,   5),
    ('walk',   pose_walk,   8),
    ('run',    pose_run,    6),
    ('jump',   pose_jump,   5),
    ('land',   pose_land,   4),
    ('swing',  pose_swing,  6),
    ('fall',   pose_fall,   2),
    ('cling',  pose_cling,  4),
    ('crouch', pose_crouch, 2),
]


# ---- pose -> draw primitives ----

def build_prims(p, j):
    """joints -> ordered primitive list (far side first; fills only —
    renderers add the INK outline pass themselves, which halves the data)"""
    prims = []

    def cap(a, b, w, c):
        # fill only — renderers add the INK outline pass themselves (halves the data)
        prims.append({'t': 'cap', 'x1': round(a[0], 1), 'y1': round(a[1], 1),
                      'x2': round(b[0], 1), 'y2': round(b[1], 1),
                      'w': round(w, 1), 'c': rgb(c)})

    def circle(pt, r, c):
        prims.append({'t': 'c', 'x': round(pt[0], 1), 'y': round(pt[1], 1),
                      'r': round(r, 1), 'c': rgb(c)})

    def poly(pts, c):
        prims.append({'t': 'p', 'pts': [[round(x, 1), round(y, 1)] for x, y in pts],
                      'c': rgb(c)})

    def limb(hip, knee, foot, toe, wth, wsh, cth, csh, cboot):
        cap(hip, knee, wth, cth)
        cap(knee, foot, wsh, csh)
        cap(foot, toe, 6, cboot)

    def arm(sh, el, ha, cmain, chand):
        cap(sh, el, 8, cmain)
        cap(el, ha, 7, cmain)
        circle(ha, SEG['handR'], chand)

    # far limbs first (darker)
    limb(j['hipL'], j['kneeL'], j['footL'], j['toeL'], 8.5, 7.5, DSUIT, DSUIT, DBOOT)
    arm(j['shoulder'], j['elbowL'], j['handL'], DRED, DRED)

    # torso: dark back panel then red front
    cap((0, p['hipDy']), j['shoulder'], 17, INK)
    cap((-2.5, p['hipDy']), (j['shoulder'][0] - 2.5, j['shoulder'][1]), 15, SUIT)
    cap((1.5, p['hipDy']), (j['shoulder'][0] + 1.5, j['shoulder'][1]), 13, RED)

    # chest mark: red spider emblem on the black torso
    mx, my = (j['shoulder'][0] * 0.5, j['shoulder'][1] * 0.55)
    circle((mx + 2, my), 2.6, BOOT)

    # near leg + near arm (red glove on the near hand)
    limb(j['hipR'], j['kneeR'], j['footR'], j['toeR'], 9, 8, SUIT, SUIT, BOOT)
    arm(j['shoulder'], j['elbowR'], j['handR'], RED, BOOT)

    # head: red mask, two fierce wedge eyes
    h = j['head']
    circle(h, SEG['headR'], RED)
    tilt = math.radians(p['tilt'] + p.get('headTilt', 0))

    def eye(off_x, off_y, sc):
        base = [(1.5, -4.5), (9.5, -6.5), (8, 0.5), (1, 1.5)]
        pts = []
        for ex, ey in base:
            ex *= sc
            ey *= sc
            rx, ry = rot(ex, ey, math.degrees(tilt))
            pts.append((h[0] + off_x + rx, h[1] + off_y + ry))
        return pts

    poly(eye(1.5, -1, 1.0), EYE)     # near eye
    poly(eye(-5.2, -1.5, 0.62), EYE) # far eye

    return prims


# ---- anchoring & translation into the cell ----

def place(prims, p, j):
    """translate all primitives so the anchor lands correctly in the cell:
    feet-anchored poses rest on y=124; hand-anchored (swing) hangs from (64,18)"""
    if p['anchor'] == 'handR':
        ax, ay = j['handR']
        tx, ty = 64 - ax, 18 - ay
    else:
        low = max(j['toeL'][1], j['toeR'][1], j['footL'][1], j['footR'][1])
        hipx = 0
        tx, ty = 64 - hipx, 124 - low

    def mv(x, y):
        return (round(x + tx, 1), round(y + ty, 1))

    out = []
    for pr in prims:
        q = dict(pr)
        if pr['t'] == 'cap':
            q['x1'], q['y1'] = mv(pr['x1'], pr['y1'])
            q['x2'], q['y2'] = mv(pr['x2'], pr['y2'])
        elif pr['t'] == 'c':
            q['x'], q['y'] = mv(pr['x'], pr['y'])
        elif pr['t'] == 'p':
            q['pts'] = [list(mv(x, y)) for x, y in pr['pts']]
        out.append(q)
    return out


# ---- PIL rendering (for the PNG artifacts) ----

INK_S = '#%02x%02x%02x' % INK


def render_frame(prims):
    """Render one cell: every cap/circle gets an INK outline pass first, so the
    PNGs and the in-engine procedural replayer produce identical art."""
    img = Image.new('RGBA', (CELL * SS, CELL * SS), (0, 0, 0, 0))
    dctx = ImageDraw.Draw(img)

    def cap(pr, widen, color):
        w = (pr['w'] + widen) * SS
        dctx.line([pr['x1'] * SS, pr['y1'] * SS, pr['x2'] * SS, pr['y2'] * SS],
                  fill=color, width=int(w))
        r = w / 2
        for px, py in ((pr['x1'] * SS, pr['y1'] * SS), (pr['x2'] * SS, pr['y2'] * SS)):
            dctx.ellipse([px - r, py - r, px + r, py + r], fill=color)

    def dot(pr, widen, color):
        r = (pr['r'] + widen) * SS
        dctx.ellipse([pr['x'] * SS - r, pr['y'] * SS - r,
                      pr['x'] * SS + r, pr['y'] * SS + r], fill=color)

    for pr in prims:
        if pr['t'] == 'cap':
            cap(pr, 2.5, INK_S)
        elif pr['t'] == 'c':
            dot(pr, 1.8, INK_S)
    for pr in prims:
        if pr['t'] == 'cap':
            cap(pr, 0, pr['c'])
        elif pr['t'] == 'c':
            dot(pr, 0, pr['c'])
        elif pr['t'] == 'p':
            dctx.polygon([(x * SS, y * SS) for x, y in pr['pts']], fill=pr['c'])
    return img.resize((CELL, CELL), Image.LANCZOS)


def main():
    frames = []          # (name, prims)
    anims = {}
    for state, fn, count in STATES:
        seq = []
        for i in range(count):
            p = fn(i, count)
            j = solve(p)
            prims = place(build_prims(p, j), p, j)
            name = f'{state}{i}'
            frames.append((name, prims))
            seq.append(name)
        anims[state] = seq

    # ---- individual sprite PNGs, one per frame ----
    for state, _, _ in STATES:
        os.makedirs(f'assets/sprites/frames/{state}', exist_ok=True)
    cell_imgs = []
    for name, prims in frames:
        img = render_frame(prims)
        cell_imgs.append((name, img))
        state = ''.join(ch for ch in name if not ch.isdigit())
        img.save(f'assets/sprites/frames/{state}/{name}.png')

    # ---- packed atlas ----
    rows = (len(frames) + COLS - 1) // COLS
    atlas = Image.new('RGBA', (COLS * CELL, rows * CELL), (0, 0, 0, 0))
    frames_meta = {}
    for i, (name, img) in enumerate(cell_imgs):
        cx, cy = (i % COLS) * CELL, (i // COLS) * CELL
        atlas.paste(img, (cx, cy), img)
        frames_meta[name] = {'x': cx, 'y': cy}
    os.makedirs('assets/sprites', exist_ok=True)
    atlas.save('assets/sprites/hero-sheet.png', optimize=True)
    with open('assets/sprites/hero-sheet.json', 'w') as f:
        json.dump({'frames': frames_meta, 'animations': anims,
                   'meta': {'fps': FPS, 'cell': CELL}}, f, indent=1)

    # ---- rig-data.ts: every frame as draw primitives (the engine replays this) ----
    os.makedirs('src/hero/animation', exist_ok=True)
    ts = [
        '/** GENERATED by scripts/generate-sprites.py — every frame as math.',
        '    The engine replays these primitives onto an offscreen canvas at boot;',
        '    `npm run sprites` regenerates this file + individual PNGs. */',
        f'export const RIG_CELL = {CELL};',
        f'export const RIG_FPS = {FPS};',
        f'export const RIG_COLS = {COLS};',
        '',
        'export type Prim =',
        "  | { t: 'cap'; x1: number; y1: number; x2: number; y2: number; w: number; c: string }",
        "  | { t: 'c'; x: number; y: number; r: number; c: string }",
        "  | { t: 'p'; pts: number[][]; c: string };",
        '',
        'export const RIG: Record<string, Prim[]> = {',
    ]
    for name, prims in frames:
        ts.append(f'  {name}: {json.dumps(prims, separators=(",", ":"))},')
    ts.append('};')
    ts.append('')
    ts.append('export const RIG_FRAMES: Record<string, { x: number; y: number }> = {')
    for name, meta in frames_meta.items():
        ts.append(f"  {name}: {{ x: {meta['x']}, y: {meta['y']} }},")
    ts.append('};')
    ts.append('')
    ts.append('export const RIG_ANIMS: Record<string, string[]> = {')
    for name, seq in anims.items():
        ts.append(f'  {name}: {json.dumps(seq)},')
    ts.append('};')
    ts.append('')
    with open('src/hero/animation/rig-data.ts', 'w') as f:
        f.write('\n'.join(ts))

    size_kb = os.path.getsize('assets/sprites/hero-sheet.png') // 1024
    rig_kb = os.path.getsize('src/hero/animation/rig-data.ts') // 1024
    print(f'{len(frames)} frames across {len(STATES)} states -> '
          f'atlas {atlas.size[0]}x{atlas.size[1]} ({size_kb} KB), rig-data.ts {rig_kb} KB')


if __name__ == '__main__':
    main()
