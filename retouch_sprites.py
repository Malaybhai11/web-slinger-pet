"""
retouch_sprites.py — Professional Retouch, Artifact Removal, Edge Sharpening,
and Uniform Grid Generator for Spider-Man Sprite Sheet.
"""

from PIL import Image

def process_sprite_sheet():
    img = Image.open('public/spidey-spritesheet.png').convert('RGBA')
    pixels = img.load()
    width, height = img.size

    # Sample background color
    bg_r, bg_g, bg_b, _ = pixels[5, 5]

    # 1. Background Artifact & Noise Removal
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            diff = abs(r - bg_r) + abs(g - bg_g) + abs(b - bg_b)
            if diff < 50:
                pixels[x, y] = (0, 0, 0, 0)
            else:
                # Color Palette Enhancement & Edge Sharpening
                if r > 210 and g > 210 and b > 210:
                    pixels[x, y] = (255, 255, 255, 255) # Sharp white eyes
                elif r < 45 and g < 45 and b < 50:
                    pixels[x, y] = (10, 10, 16, 255)   # Crisp dark outline
                elif r > 140 and g < 70 and b < 70:
                    pixels[x, y] = (229, 37, 33, 255)  # Vibrant Red
                elif r < 60 and g < 60 and b > 70:
                    pixels[x, y] = (27, 30, 43, 255)   # Crisp Navy Blue

    # 2. Despeckle — remove isolated stray artifact pixels
    clean_img = img.copy()
    clean_pixels = clean_img.load()

    for y in range(1, height - 1):
        for x in range(1, width - 1):
            if pixels[x, y][3] > 0:
                neighbors = 0
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if dx == 0 and dy == 0: continue
                        if pixels[x + dx, y + dy][3] > 0:
                            neighbors += 1
                if neighbors == 0:
                    clean_pixels[x, y] = (0, 0, 0, 0)

    # 3. Sprite Bounding Box Extraction & Frame Definition
    raw_boxes = [
        # Row 1 (Idle, Crouches, Acrobatics)
        {"name": "IDLE_1",     "box": (42, 21, 91, 139),   "ground": True,  "handX": 10, "handY": -60},
        {"name": "SIT",        "box": (160, 53, 224, 137),  "ground": True,  "handX": 10, "handY": -40},
        {"name": "CROUCH_1",   "box": (280, 43, 353, 137),  "ground": True,  "handX": 10, "handY": -45},
        {"name": "CROUCH_2",   "box": (396, 40, 504, 136),  "ground": True,  "handX": 10, "handY": -45},
        {"name": "JUMP_1",      "box": (540, 25, 628, 139),  "ground": False, "handX": 20, "handY": -80},
        {"name": "JUMP_2",      "box": (664, 13, 741, 122),  "ground": False, "handX": 20, "handY": -60},
        {"name": "JUMP_3",      "box": (788, 40, 870, 138),  "ground": False, "handX": 20, "handY": -50},
        {"name": "BACKFLIP_4", "box": (904, 32, 1008, 139), "ground": False, "handX": 30, "handY": -50},

        # Row 2 (Web Shooting & Zip)
        {"name": "WEB_SHOOT_1", "box": (37, 145, 104, 276),  "ground": True,  "handX": 20, "handY": -110},
        {"name": "WEB_SHOOT_2", "box": (152, 168, 223, 276), "ground": True,  "handX": 20, "handY": -90},
        {"name": "WEB_SHOOT_3", "box": (275, 176, 370, 275), "ground": True,  "handX": 40, "handY": -70},
        {"name": "WEB_SHOOT_4", "box": (407, 145, 510, 276), "ground": True,  "handX": 40, "handY": -110},
        {"name": "WEB_ZIP_1",   "box": (556, 166, 608, 272), "ground": False, "handX": 15, "handY": -90, "grip": True},
        {"name": "WEB_ZIP_2",   "box": (786, 187, 865, 248), "ground": False, "handX": 30, "handY": -40, "grip": True},

        # Row 3 (Web Swinging Pendulum)
        {"name": "SWING_1", "box": (32, 288, 128, 413),   "ground": False, "handX": 30, "handY": -90,  "grip": True},
        {"name": "SWING_2", "box": (146, 281, 256, 414),  "ground": False, "handX": 35, "handY": -100, "grip": True},
        {"name": "SWING_3", "box": (278, 280, 384, 414),  "ground": False, "handX": 35, "handY": -100, "grip": True},
        {"name": "SWING_4", "box": (387, 280, 511, 383),  "ground": False, "handX": 50, "handY": -70,  "grip": True},
        {"name": "SWING_5", "box": (659, 288, 760, 406),  "ground": False, "handX": 35, "handY": -90,  "grip": True},
        {"name": "SWING_6", "box": (778, 288, 888, 407),  "ground": False, "handX": 40, "handY": -90,  "grip": True},
        {"name": "SWING_7", "box": (895, 281, 1011, 381), "ground": False, "handX": 45, "handY": -70,  "grip": True},
        {"name": "SWING_8", "box": (270, 408, 361, 539),  "ground": False, "handX": 25, "handY": -100, "grip": True},

        # Row 4 (Idle variants, Walk loop)
        {"name": "IDLE_2",  "box": (43, 432, 95, 547),   "ground": True,  "handX": 10, "handY": -60},
        {"name": "IDLE_3",  "box": (161, 430, 213, 547), "ground": True,  "handX": 10, "handY": -60},
        {"name": "IDLE_4",  "box": (417, 424, 467, 544), "ground": True,  "handX": 10, "handY": -60},
        {"name": "WALK_1",  "box": (529, 432, 612, 541), "ground": True,  "handX": 10, "handY": -55},
        {"name": "WALK_2",  "box": (670, 432, 743, 544), "ground": True,  "handX": 10, "handY": -55},
        {"name": "WALK_3",  "box": (803, 428, 855, 544), "ground": True,  "handX": 10, "handY": -55},
        {"name": "WALK_4",  "box": (920, 427, 981, 544), "ground": True,  "handX": 10, "handY": -55},
    ]

    CELL_W = 128
    CELL_H = 140
    COLS   = 8
    ROWS   = (len(raw_boxes) + COLS - 1) // COLS

    grid_img = Image.new('RGBA', (CELL_W * COLS, CELL_H * ROWS), (0, 0, 0, 0))

    poses_ts_lines = [
        "/**",
        " * sprite-poses.ts — Professional uniform grid layout for retouched Spider-Man sprite sheet.",
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

    for idx, item in enumerate(raw_boxes):
        col = idx % COLS
        row = idx // COLS
        cell_x = col * CELL_W
        cell_y = row * CELL_H

        box = item["box"]
        crop = clean_img.crop(box)

        crop_w, crop_h = crop.size
        place_x = cell_x + (CELL_W - crop_w) // 2
        place_y = cell_y + (CELL_H - crop_h - 4) if item["ground"] else cell_y + (CELL_H - crop_h) // 2
        anchor_y = 1.0 if item["ground"] else 0.5

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

    # Aliases to map all animation frames seamlessly
    aliases = {
        "IDLE": "IDLE_1",
        "SIT_IDLE": "CROUCH_1",
        "PERCH": "SIT",
        "PERCH_1": "SIT",
        "PERCH_2": "CROUCH_1",
        "PERCH_3": "CROUCH_2",
        "CROUCH_3": "CROUCH_2",
        "AIM": "WEB_SHOOT_1",
        "SHOOT": "WEB_SHOOT_3",
        "WEB_ZIP_3": "WEB_ZIP_1",
        "WEB_ZIP_4": "WEB_ZIP_2",
        "JUMP": "JUMP_1",
        "BACKFLIP_1": "JUMP_1",
        "BACKFLIP_2": "JUMP_2",
        "BACKFLIP_3": "JUMP_3",
        "FLIP_1": "JUMP_2",
        "FLIP_2": "JUMP_3",
        "SWING_A": "SWING_1",
        "SWING_B": "SWING_2",
        "SWING_C": "SWING_3",
        "WALK_L": "WALK_1",
        "WALK_MID": "WALK_2",
        "WALK_R": "WALK_3",
        "WALK_5": "WALK_2",
        "WALK_6": "WALK_1",
        "RUN_L": "WALK_1",
        "RUN_MID": "WALK_2",
        "RUN_R": "WALK_3",
        "RUN_1": "WALK_1",
        "RUN_2": "WALK_2",
        "RUN_3": "WALK_3",
        "RUN_4": "WALK_4",
        "RUN_5": "WALK_2",
        "RUN_6": "WALK_1",
        "FALL": "JUMP_2",
        "FALL_1": "JUMP_1",
        "FALL_2": "JUMP_2",
        "FALL_3": "JUMP_3",
        "LAND": "CROUCH_1",
        "LAND_1": "CROUCH_1",
        "LAND_2": "CROUCH_2",
        "LAND_3": "SIT",
        "LAND_4": "IDLE_1",
        "CLING": "WEB_ZIP_1",
        "CLING_1": "WEB_ZIP_1",
        "CLING_2": "WEB_ZIP_1",
        "CLING_3": "WEB_ZIP_1",
        "HANG": "WEB_ZIP_1",
        "WALL_RUN_1": "WALK_1",
        "WALL_RUN_2": "WALK_2",
        "WALL_RUN_3": "WALK_3",
        "WALL_RUN_4": "WALK_4",
        "WAVE": "WALK_4",
        "WAVE_1": "WALK_4",
        "WAVE_2": "WALK_4",
        "WAVE_3": "WALK_4",
        "VICTORY": "WALK_4",
        "VICTORY_1": "WALK_4",
        "VICTORY_2": "WALK_4",
        "VICTORY_3": "WALK_4",
        "THWIP": "WALK_4",
        "LOOK_UP_1": "IDLE_1",
        "LOOK_UP_2": "IDLE_1",
        "LOOK_UP_3": "IDLE_2",
        "LOOK_DOWN_1": "IDLE_2",
        "LOOK_DOWN_2": "IDLE_2",
        "LOOK_DOWN_3": "IDLE_3",
        "STRETCH_1": "IDLE_4",
        "STRETCH_2": "IDLE_4",
        "STRETCH_3": "IDLE_4",
        "ATTACK_1": "BACKFLIP_4",
        "ATTACK_2": "BACKFLIP_4",
        "ATTACK_3": "BACKFLIP_4",
        "ATTACK_4": "BACKFLIP_4",
        "ROLL_1": "JUMP_2",
        "ROLL_2": "JUMP_2",
        "ROLL_3": "JUMP_3",
        "ROLL_4": "JUMP_3",
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

    # Save PNG
    grid_img.save('public/spidey-spritesheet.png')
    print("PNG retouched & saved to public/spidey-spritesheet.png")

    # Save TS
    with open('src/sprite-poses.ts', 'w', encoding='utf-8') as f:
        f.write("\n".join(poses_ts_lines))
    print("TypeScript poses map written to src/sprite-poses.ts")

if __name__ == '__main__':
    process_sprite_sheet()
