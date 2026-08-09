"""
process_new_spritesheet.py -- Process and retouch the new Spider-Man sprite sheet,
converting white background to transparent alpha and generating a uniform 128x140 grid asset.
"""

from PIL import Image

def process():
    raw_img = Image.open('public/spidey-spritesheet.png').convert('RGBA')
    pixels = raw_img.load()
    w, h = raw_img.size

    # Convert solid white background (RGB > 240) to transparent alpha
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r > 240 and g > 240 and b > 240:
                pixels[x, y] = (0, 0, 0, 0)
            else:
                # Color Palette Crispness & Outline Enhancement
                if r > 220 and g > 220 and b > 220:
                    pixels[x, y] = (255, 255, 255, 255) # Sharp white eyes
                elif r < 45 and g < 45 and b < 50:
                    pixels[x, y] = (10, 10, 16, 255)   # Crisp dark outline
                elif r > 140 and g < 70 and b < 70:
                    pixels[x, y] = (229, 37, 33, 255)  # Vibrant Red
                elif r < 60 and g < 60 and b > 70:
                    pixels[x, y] = (27, 30, 43, 255)   # Crisp Navy Blue

    # Despeckle isolated noise pixels
    clean_img = raw_img.copy()
    clean_pixels = clean_img.load()
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if pixels[x, y][3] > 0:
                neighbors = 0
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if dx == 0 and dy == 0: continue
                        if pixels[x + dx, y + dy][3] > 0:
                            neighbors += 1
                if neighbors == 0:
                    clean_pixels[x, y] = (0, 0, 0, 0)

    # Sprite bounding box coordinates from analysis
    sprite_defs = [
        # Row 1: Standing & Walking & Crouching
        {"name": "IDLE_1",     "box": (35, 18, 84, 137),    "ground": True,  "anchorY": 1.0, "handX": 10, "handY": -60},
        {"name": "IDLE_2",     "box": (164, 18, 211, 137),  "ground": True,  "anchorY": 1.0, "handX": 10, "handY": -60},
        {"name": "IDLE_3",     "box": (291, 18, 339, 137),  "ground": True,  "anchorY": 1.0, "handX": 10, "handY": -60},
        {"name": "IDLE_4",     "box": (420, 18, 467, 137),  "ground": True,  "anchorY": 1.0, "handX": 10, "handY": -60},
        {"name": "WALK_1",     "box": (543, 30, 612, 137),  "ground": True,  "anchorY": 1.0, "handX": 10, "handY": -55},
        {"name": "WALK_2",     "box": (673, 29, 739, 137),  "ground": True,  "anchorY": 1.0, "handX": 10, "handY": -55},
        {"name": "CROUCH_1",   "box": (792, 49, 854, 139),  "ground": True,  "anchorY": 1.0, "handX": 10, "handY": -45},
        {"name": "PREPARE",    "box": (920, 32, 995, 137),  "ground": True,  "anchorY": 1.0, "handX": 15, "handY": -50},

        # Row 2: Idle variants, Crouch, Web Aim, Swing 1-4
        {"name": "IDLE_VAR_1", "box": (35, 162, 86, 279),   "ground": True,  "anchorY": 1.0, "handX": 10, "handY": -60},
        {"name": "IDLE_VAR_2", "box": (162, 162, 213, 279), "ground": True,  "anchorY": 1.0, "handX": 10, "handY": -60},
        {"name": "CROUCH_2",   "box": (281, 179, 347, 279), "ground": True,  "anchorY": 1.0, "handX": 10, "handY": -45},
        {"name": "WEB_SHOOT_1","box": (410, 175, 486, 280), "ground": False, "anchorY": 0.5, "handX": 25, "handY": -90},
        {"name": "SWING_1",    "box": (543, 143, 640, 282), "ground": False, "anchorY": 0.5, "handX": 35, "handY": -100, "grip": True},
        {"name": "SWING_2",    "box": (662, 143, 773, 282), "ground": False, "anchorY": 0.5, "handX": 40, "handY": -100, "grip": True},
        {"name": "SWING_3",    "box": (782, 143, 892, 282), "ground": False, "anchorY": 0.5, "handX": 40, "handY": -100, "grip": True},
        {"name": "SWING_4",    "box": (905, 143, 1023, 277),"ground": False, "anchorY": 0.5, "handX": 45, "handY": -90,  "grip": True},

        # Row 3: Locomotion, Swings, Air Flip
        {"name": "WALK_3",     "box": (28, 307, 91, 417),   "ground": True,  "anchorY": 1.0, "handX": 10, "handY": -55},
        {"name": "WALK_4",     "box": (150, 307, 224, 417), "ground": True,  "anchorY": 1.0, "handX": 10, "handY": -55},
        {"name": "RUN_1",      "box": (272, 308, 349, 410), "ground": True,  "anchorY": 1.0, "handX": 10, "handY": -55},
        {"name": "SWING_5",    "box": (403, 281, 520, 413), "ground": False, "anchorY": 0.5, "handX": 50, "handY": -70,  "grip": True},
        {"name": "FLIP_MID",   "box": (525, 312, 635, 393), "ground": False, "anchorY": 0.5, "handX": 20, "handY": -40},
        {"name": "SWING_6",    "box": (665, 290, 783, 401), "ground": False, "anchorY": 0.5, "handX": 40, "handY": -90,  "grip": True},
        {"name": "SWING_7",    "box": (810, 282, 889, 402), "ground": False, "anchorY": 0.5, "handX": 30, "handY": -90,  "grip": True},
        {"name": "SWING_8",    "box": (897, 281, 1007, 407),"ground": False, "anchorY": 0.5, "handX": 45, "handY": -80,  "grip": True},

        # Row 4: Swings, Landing Squash, and Dedicated Upside-Down Hanging Poses
        {"name": "SWING_9",            "box": (10, 420, 133, 538),  "ground": False, "anchorY": 0.5, "handX": 50, "handY": -80, "grip": True},
        {"name": "SWING_10",           "box": (142, 420, 253, 535), "ground": False, "anchorY": 0.5, "handX": 45, "handY": -80, "grip": True},
        {"name": "LAND_SQUASH",        "box": (274, 449, 367, 546), "ground": True,  "anchorY": 1.0, "handX": 10, "handY": -40},
        {"name": "SWING_11",           "box": (396, 420, 506, 543), "ground": False, "anchorY": 0.5, "handX": 45, "handY": -80, "grip": True},
        {"name": "UPSIDE_DOWN_HANG_1", "box": (549, 420, 608, 538), "ground": False, "anchorY": 0.0, "handX": 0,  "handY": 20,  "grip": True},
        {"name": "UPSIDE_DOWN_HANG_2", "box": (679, 420, 741, 537), "ground": False, "anchorY": 0.0, "handX": 0,  "handY": 20,  "grip": True},
        {"name": "UPSIDE_DOWN_HANG_3", "box": (800, 419, 865, 542), "ground": False, "anchorY": 0.0, "handX": 0,  "handY": 20,  "grip": True},
        {"name": "HANG_STRAIGHT_DOWN", "box": (938, 425, 978, 548), "ground": False, "anchorY": 0.0, "handX": 0,  "handY": 20,  "grip": True},
    ]

    CELL_W = 128
    CELL_H = 140
    COLS   = 8
    ROWS   = (len(sprite_defs) + COLS - 1) // COLS

    grid_img = Image.new('RGBA', (CELL_W * COLS, CELL_H * ROWS), (0, 0, 0, 0))

    poses_ts_lines = [
        "/**",
        " * sprite-poses.ts -- Uniform grid layout for the new high-resolution Spider-Man sprite sheet.",
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

    pose_dict = {}

    for idx, item in enumerate(sprite_defs):
        col = idx % COLS
        row = idx // COLS
        cell_x = col * CELL_W
        cell_y = row * CELL_H

        box = item["box"]
        crop = clean_img.crop(box)

        crop_w, crop_h = crop.size
        place_x = cell_x + (CELL_W - crop_w) // 2
        place_y = cell_y + (CELL_H - crop_h - 4) if item["ground"] else cell_y + (CELL_H - crop_h) // 2
        anchor_y = item["anchorY"]

        grid_img.paste(crop, (place_x, place_y), crop)

        entry = {
            "x": place_x,
            "y": place_y,
            "w": crop_w,
            "h": crop_h,
            "anchorX": 0.5,
            "anchorY": anchor_y,
            "handX": item["handX"],
            "handY": item["handY"],
            "grip": item.get("grip", False),
        }

        pose_dict[item["name"]] = entry
        grip_str = ", grip: true" if item.get("grip") else ""
        poses_ts_lines.append(
            f'  {item["name"]}: {{ x: {place_x}, y: {place_y}, w: {crop_w}, h: {crop_h}, anchorX: 0.5, anchorY: {anchor_y}, handX: {item["handX"]}, handY: {item["handY"]}{grip_str} }},'
        )

    # Pose Aliases for seamless state machine playback
    aliases = {
        "IDLE": "IDLE_1",
        "SIT": "CROUCH_1",
        "SIT_IDLE": "CROUCH_2",
        "PERCH": "CROUCH_1",
        "PERCH_1": "CROUCH_1",
        "PERCH_2": "CROUCH_2",
        "PERCH_3": "CROUCH_2",
        "CROUCH_3": "CROUCH_2",
        "AIM": "WEB_SHOOT_1",
        "SHOOT": "WEB_SHOOT_1",
        "WEB_SHOOT_2": "WEB_SHOOT_1",
        "WEB_SHOOT_3": "WEB_SHOOT_1",
        "WEB_SHOOT_4": "WEB_SHOOT_1",
        "WEB_ZIP_1": "SWING_7",
        "WEB_ZIP_2": "SWING_7",
        "WEB_ZIP_3": "SWING_7",
        "WEB_ZIP_4": "SWING_7",
        "JUMP": "PREPARE",
        "JUMP_1": "PREPARE",
        "JUMP_2": "FLIP_MID",
        "JUMP_3": "SWING_8",
        "BACKFLIP_1": "PREPARE",
        "BACKFLIP_2": "FLIP_MID",
        "BACKFLIP_3": "SWING_8",
        "BACKFLIP_4": "SWING_8",
        "FLIP_1": "FLIP_MID",
        "FLIP_2": "FLIP_MID",
        "SWING_A": "SWING_1",
        "SWING_B": "SWING_2",
        "SWING_C": "SWING_3",
        "WALK_L": "WALK_1",
        "WALK_MID": "WALK_2",
        "WALK_R": "WALK_3",
        "WALK_5": "WALK_2",
        "WALK_6": "WALK_1",
        "RUN_L": "RUN_1",
        "RUN_MID": "RUN_1",
        "RUN_R": "RUN_1",
        "RUN_2": "RUN_1",
        "RUN_3": "RUN_1",
        "RUN_4": "RUN_1",
        "RUN_5": "RUN_1",
        "RUN_6": "RUN_1",
        "FALL": "SWING_8",
        "FALL_1": "PREPARE",
        "FALL_2": "FLIP_MID",
        "FALL_3": "SWING_8",
        "LAND": "LAND_SQUASH",
        "LAND_1": "LAND_SQUASH",
        "LAND_2": "LAND_SQUASH",
        "LAND_3": "CROUCH_1",
        "LAND_4": "IDLE_1",
        "CLING": "SWING_7",
        "CLING_1": "SWING_7",
        "CLING_2": "SWING_7",
        "CLING_3": "SWING_7",
        "HANG": "HANG_STRAIGHT_DOWN",
        "HANGING_UPSIDE_DOWN": "HANG_STRAIGHT_DOWN",
        "WALL_RUN_1": "RUN_1",
        "WALL_RUN_2": "RUN_1",
        "WALL_RUN_3": "RUN_1",
        "WALL_RUN_4": "RUN_1",
        "WAVE": "IDLE_1",
        "WAVE_1": "IDLE_1",
        "WAVE_2": "IDLE_2",
        "WAVE_3": "IDLE_3",
        "VICTORY": "IDLE_1",
        "VICTORY_1": "IDLE_1",
        "VICTORY_2": "IDLE_2",
        "VICTORY_3": "IDLE_3",
        "THWIP": "WEB_SHOOT_1",
        "LOOK_UP_1": "IDLE_1",
        "LOOK_UP_2": "IDLE_2",
        "LOOK_UP_3": "IDLE_3",
        "LOOK_DOWN_1": "IDLE_2",
        "LOOK_DOWN_2": "IDLE_3",
        "LOOK_DOWN_3": "IDLE_4",
        "STRETCH_1": "IDLE_4",
        "STRETCH_2": "IDLE_4",
        "STRETCH_3": "IDLE_4",
        "ATTACK_1": "FLIP_MID",
        "ATTACK_2": "FLIP_MID",
        "ATTACK_3": "FLIP_MID",
        "ATTACK_4": "FLIP_MID",
        "ROLL_1": "FLIP_MID",
        "ROLL_2": "FLIP_MID",
        "ROLL_3": "FLIP_MID",
        "ROLL_4": "FLIP_MID",
        "DIZZY_1": "CROUCH_2",
        "DIZZY_2": "CROUCH_2",
        "DIZZY_3": "CROUCH_2",
        "DIZZY_4": "CROUCH_2",
        "TAKE_DAMAGE_1": "CROUCH_1",
        "TAKE_DAMAGE_2": "CROUCH_1",
        "TAKE_DAMAGE_3": "CROUCH_2",
        "TAKE_DAMAGE_4": "CROUCH_2",
        "DEAD_1": "CROUCH_2",
        "DEAD_2": "CROUCH_2",
        "DEAD_3": "CROUCH_2",
    }

    for alias, target in aliases.items():
        if target in pose_dict:
            t = pose_dict[target]
            grip_str = ", grip: true" if t["grip"] else ""
            poses_ts_lines.append(
                f'  {alias}: {{ x: {t["x"]}, y: {t["y"]}, w: {t["w"]}, h: {t["h"]}, anchorX: {t["anchorX"]}, anchorY: {t["anchorY"]}, handX: {t["handX"]}, handY: {t["handY"]}{grip_str} }},'
            )

    poses_ts_lines.append("};")
    poses_ts_lines.append("")

    grid_img.save('public/spidey-spritesheet.png')
    print("New PNG retouched & saved to public/spidey-spritesheet.png")

    with open('src/sprite-poses.ts', 'w', encoding='utf-8') as f:
        f.write("\n".join(poses_ts_lines))
    print("New TypeScript poses map written to src/sprite-poses.ts")

if __name__ == '__main__':
    process()
