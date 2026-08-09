import os
from PIL import Image

def process():
    img = Image.open('public/7cb5c40b-75d0-47a8-8f4d-dc927c5fae4d.jpg').convert('RGBA')
    w, h = img.size
    pixels = img.load()

    clean_img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    clean_pixels = clean_img.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r > 215 and g > 215 and b > 215:
                clean_pixels[x, y] = (0, 0, 0, 0)
            elif r > 195 and g > 195 and b > 195:
                clean_pixels[x, y] = (0, 0, 0, 0)
            else:
                if r > 200 and g > 200 and b > 200:
                    clean_pixels[x, y] = (255, 255, 255, 255)
                elif r < 50 and g < 50 and b < 50:
                    clean_pixels[x, y] = (10, 10, 16, 255)
                elif r > 130 and g < 70 and b < 70:
                    clean_pixels[x, y] = (229, 37, 33, 255)
                elif r < 60 and g < 60 and b > 65:
                    clean_pixels[x, y] = (27, 30, 43, 255)
                else:
                    clean_pixels[x, y] = (r, g, b, 255)

    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if clean_pixels[x, y][3] > 0:
                neighbors = 0
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if dx == 0 and dy == 0: continue
                        if clean_pixels[x + dx, y + dy][3] > 0:
                            neighbors += 1
                if neighbors == 0:
                    clean_pixels[x, y] = (0, 0, 0, 0)

    sections = [
        {'name': 'IDLE',            'rect': (10, 35, 310, 140)},
        {'name': 'WALK',            'rect': (310, 35, 770, 140)},
        {'name': 'RUN',             'rect': (770, 35, 1140, 140)},
        {'name': 'APPROACH_WALL',   'rect': (1140, 35, 1530, 140)},

        {'name': 'GROUND_TO_WALL',  'rect': (10, 175, 1530, 260)},

        {'name': 'WALL_LEFT',       'rect': (10, 290, 580, 410)},
        {'name': 'WALL_RIGHT',      'rect': (580, 290, 1130, 410)},
        {'name': 'CLIMB_UP',        'rect': (1130, 290, 1530, 410)},

        {'name': 'CLIMB_DOWN',      'rect': (10, 435, 520, 555)},
        {'name': 'WALL_TO_CEILING', 'rect': (520, 435, 1530, 555)},

        {'name': 'CEILING_LEFT',    'rect': (10, 580, 780, 665)},
        {'name': 'CEILING_RIGHT',   'rect': (780, 580, 1530, 665)},

        {'name': 'CEILING_TO_WALL', 'rect': (10, 700, 640, 790)},
        {'name': 'WALL_TO_GROUND',  'rect': (640, 700, 1530, 790)},

        {'name': 'SWING',           'rect': (10, 830, 710, 1000)},
        {'name': 'HANG',            'rect': (710, 830, 1530, 1000)},
    ]

    all_poses = {}

    for sec in sections:
        sec_name = sec['name']
        rx0, ry0, rx1, ry1 = sec['rect']

        proj = [0] * (rx1 - rx0)
        for x in range(rx0, rx1):
            for y in range(ry0, ry1):
                if clean_pixels[x, y][3] > 0:
                    proj[x - rx0] += 1

        intervals = []
        in_fig = False
        start_x = 0
        for x in range(len(proj)):
            val = proj[x]
            if val > 1 and not in_fig:
                in_fig = True
                start_x = x
            elif val <= 1 and in_fig:
                in_fig = False
                end_x = x
                if (end_x - start_x) >= 10:
                    intervals.append((start_x + rx0, end_x + rx0))
        if in_fig:
            end_x = len(proj)
            if (end_x - start_x) >= 10:
                intervals.append((start_x + rx0, end_x + rx0))

        merged_intervals = []
        for inter in intervals:
            if not merged_intervals:
                merged_intervals.append(list(inter))
            else:
                prev = merged_intervals[-1]
                if inter[0] - prev[1] < 6:
                    prev[1] = inter[1]
                else:
                    merged_intervals.append(list(inter))

        group_poses = []
        for i, (fx0, fx1) in enumerate(merged_intervals):
            fy0 = ry1
            fy1 = ry0
            for y in range(ry0, ry1):
                for x in range(fx0, fx1):
                    if clean_pixels[x, y][3] > 0:
                        if y < fy0: fy0 = y
                        if y > fy1: fy1 = y

            if fy0 > fy1: continue

            bw = fx1 - fx0
            bh = fy1 - fy0 + 1
            frame_name = f"{sec_name}_{i+1}"

            anchor_y = 1.0
            if 'CEILING' in sec_name or 'HANG' in sec_name:
                anchor_y = 0.0
            elif 'WALL' in sec_name and 'GROUND' not in sec_name:
                anchor_y = 0.5

            group_poses.append({
                'name': frame_name,
                'box': (fx0, fy0, bw, bh),
                'anchorX': 0.5,
                'anchorY': anchor_y,
            })

        print(f"Group '{sec_name}': {len(group_poses)} frames extracted.")
        all_poses[sec_name] = group_poses

    CELL_W = 128
    CELL_H = 140
    COLS = 12
    total_frames = sum(len(frames) for frames in all_poses.values())
    ROWS = (total_frames + COLS - 1) // COLS

    grid_img = Image.new('RGBA', (CELL_W * COLS, CELL_H * ROWS), (0, 0, 0, 0))

    poses_ts_lines = [
        "/**",
        " * sprite-poses.ts -- Frame coordinates map for all 16 Spider-Man animation groups.",
        " */",
        "",
        "export interface FramePose {",
        "  x: number;",
        "  y: number;",
        "  w: number;",
        "  h: number;",
        "  anchorX: number;",
        "  anchorY: number;",
        "  handX: number;",
        "  handY: number;",
        "  grip?: boolean;",
        "}",
        "",
        "export const POSES: Record<string, FramePose> = {",
    ]

    anims_ts_lines = [
        "/**",
        " * animations.ts -- Full animation definitions for all 16 Spider-Man animation groups.",
        " */",
        "",
        "import type { PoseName } from './sprite.js';",
        "",
        "export interface AnimationDef {",
        "  frames: PoseName[];",
        "  fps: number;",
        "  loop: boolean;",
        "}",
        "",
        "export const ANIMS: Record<string, AnimationDef> = {",
    ]

    current_idx = 0

    for sec_name, frames in all_poses.items():
        frame_names = []
        for item in frames:
            fname = item['name']
            box_x, box_y, bw, bh = item['box']

            col = current_idx % COLS
            row = current_idx // COLS
            cell_x = col * CELL_W
            cell_y = row * CELL_H

            crop = clean_img.crop((box_x, box_y, box_x + bw, box_y + bh))
            place_x = cell_x + (CELL_W - bw) // 2
            place_y = cell_y + (CELL_H - bh) // 2

            grid_img.paste(crop, (place_x, place_y), crop)

            anchor_y = item['anchorY']
            grip_str = ", grip: true" if 'SWING' in fname or 'HANG' in fname else ""
            poses_ts_lines.append(
                f"  {fname}: {{ x: {place_x}, y: {place_y}, w: {bw}, h: {bh}, anchorX: 0.5, anchorY: {anchor_y}, handX: 10, handY: -50{grip_str} }},"
            )
            frame_names.append(fname)
            current_idx += 1

        fps = 10
        if sec_name == 'IDLE': fps = 4
        elif sec_name == 'WALK': fps = 8
        elif sec_name == 'RUN': fps = 12
        elif 'TRANSITION' in sec_name or 'TO' in sec_name: fps = 10

        loop = 'TRANSITION' not in sec_name and 'TO' not in sec_name and 'APPROACH' not in sec_name
        loop_str = "true" if loop else "false"
        frames_arr_str = ", ".join(f"'{fn}'" for fn in frame_names)

        anims_ts_lines.append(
            f"  {sec_name.lower()}: {{ frames: [{frames_arr_str}], fps: {fps}, loop: {loop_str} }},"
        )
        anims_ts_lines.append(
            f"  {sec_name}: {{ frames: [{frames_arr_str}], fps: {fps}, loop: {loop_str} }},"
        )

    poses_ts_lines.append("};")
    anims_ts_lines.append("};")

    # Add legacy frame pose aliases AFTER POSES declaration
    for sec_name, frames in all_poses.items():
        if frames:
            first_frame = frames[0]['name']
            poses_ts_lines.append(f"POSES['{sec_name}'] = POSES['{first_frame}'];")

    # Add legacy animation aliases AFTER ANIMS declaration
    legacy_aliases = {
        'sit': 'idle',
        'crouch': 'ground_to_wall',
        'backflip': 'swing',
        'jump': 'approach_wall',
        'fall': 'wall_to_ground',
        'land': 'wall_to_ground',
        'dizzy': 'hang',
        'victory': 'idle',
        'webShoot': 'swing',
        'webZip': 'swing',
        'wave': 'idle',
        'stretch': 'idle',
        'prepare': 'approach_wall',
        'hanging': 'hang',
        'idleHanging': 'hang',
        'crawlLeft': 'wall_left',
        'crawlRight': 'wall_right',
        'sitFidget': 'idle',
        'lookUp': 'idle',
        'lookDown': 'idle',
        'aim': 'approach_wall',
        'shoot': 'swing',
        'zip': 'swing',
        'perch': 'hang',
        'attack': 'swing',
        'roll': 'ground_to_wall',
        'takeDamage': 'wall_to_ground',
        'dead': 'hang',
        'leap': 'approach_wall',
        'thwip': 'swing',
        'flinch': 'wall_to_ground',
    }

    for alias, target in legacy_aliases.items():
        anims_ts_lines.append(f"ANIMS['{alias}'] = ANIMS['{target}'] || ANIMS.idle;")

    anims_ts_lines.append("")
    anims_ts_lines.append("export class AnimationPlayer {")
    anims_ts_lines.append("  private currentAnim: string = 'idle';")
    anims_ts_lines.append("  private frameIndex = 0;")
    anims_ts_lines.append("  private frameTimer = 0;")
    anims_ts_lines.append("  private finished = false;")
    anims_ts_lines.append("")
    anims_ts_lines.append("  play(animName: string): void {")
    anims_ts_lines.append("    if (animName === this.currentAnim && !this.finished) return;")
    anims_ts_lines.append("    this.currentAnim = ANIMS[animName] ? animName : 'idle';")
    anims_ts_lines.append("    this.frameIndex = 0;")
    anims_ts_lines.append("    this.frameTimer = 0;")
    anims_ts_lines.append("    this.finished = false;")
    anims_ts_lines.append("  }")
    anims_ts_lines.append("")
    anims_ts_lines.append("  update(dtMs: number): PoseName {")
    anims_ts_lines.append("    const def = ANIMS[this.currentAnim] || ANIMS.idle;")
    anims_ts_lines.append("    const frameDuration = 1000 / (def.fps || 4);")
    anims_ts_lines.append("    this.frameTimer += dtMs;")
    anims_ts_lines.append("    while (this.frameTimer >= frameDuration) {")
    anims_ts_lines.append("      this.frameTimer -= frameDuration;")
    anims_ts_lines.append("      if (this.frameIndex + 1 < def.frames.length) {")
    anims_ts_lines.append("        this.frameIndex++;")
    anims_ts_lines.append("      } else if (def.loop) {")
    anims_ts_lines.append("        this.frameIndex = 0;")
    anims_ts_lines.append("      } else {")
    anims_ts_lines.append("        this.finished = true;")
    anims_ts_lines.append("        break;")
    anims_ts_lines.append("      }")
    anims_ts_lines.append("    }")
    anims_ts_lines.append("    return def.frames[this.frameIndex] || 'IDLE_1';")
    anims_ts_lines.append("  }")
    anims_ts_lines.append("")
    anims_ts_lines.append("  getCurrentPose(): PoseName {")
    anims_ts_lines.append("    const def = ANIMS[this.currentAnim] || ANIMS.idle;")
    anims_ts_lines.append("    return def.frames[this.frameIndex] || 'IDLE_1';")
    anims_ts_lines.append("  }")
    anims_ts_lines.append("  isFinished(): boolean { return this.finished; }")
    anims_ts_lines.append("  getCurrentAnim(): string { return this.currentAnim; }")
    anims_ts_lines.append("  getFrameIndex(): number { return this.frameIndex; }")
    anims_ts_lines.append("}")

    grid_img.save('public/spidey-spritesheet.png')
    print("Saved public/spidey-spritesheet.png")

    with open('src/sprite-poses.ts', 'w', encoding='utf-8') as f:
        f.write("\n".join(poses_ts_lines) + "\n")
    print("Saved src/sprite-poses.ts")

    with open('src/animations.ts', 'w', encoding='utf-8') as f:
        f.write("\n".join(anims_ts_lines) + "\n")
    print("Saved src/animations.ts")

if __name__ == '__main__':
    process()
