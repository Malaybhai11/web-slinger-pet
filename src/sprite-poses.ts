/**
 * sprite-poses.ts -- Frame coordinates map for all 16 Spider-Man animation groups.
 */

export interface FramePose {
  x: number;
  y: number;
  w: number;
  h: number;
  anchorX: number;
  anchorY: number;
  handX: number;
  handY: number;
  grip?: boolean;
}

export const POSES: Record<string, FramePose> = {
  IDLE_1: { x: 47, y: 25, w: 34, h: 89, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  IDLE_2: { x: 175, y: 25, w: 34, h: 89, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  IDLE_3: { x: 302, y: 26, w: 35, h: 88, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  IDLE_4: { x: 430, y: 26, w: 35, h: 88, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  IDLE_5: { x: 558, y: 26, w: 35, h: 88, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  WALK_1: { x: 682, y: 26, w: 43, h: 87, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  WALK_2: { x: 812, y: 27, w: 40, h: 86, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  WALK_3: { x: 940, y: 27, w: 40, h: 86, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  WALK_4: { x: 1066, y: 27, w: 44, h: 86, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  WALK_5: { x: 1195, y: 27, w: 41, h: 86, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  WALK_6: { x: 1324, y: 27, w: 39, h: 86, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  WALK_7: { x: 1446, y: 26, w: 52, h: 87, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  RUN_1: { x: 34, y: 168, w: 59, h: 83, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  RUN_2: { x: 128, y: 168, w: 127, h: 84, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  RUN_3: { x: 294, y: 169, w: 51, h: 81, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  RUN_4: { x: 417, y: 171, w: 61, h: 77, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  APPROACH_WALL_1: { x: 570, y: 203, w: 11, h: 14, anchorX: 0.5, anchorY: 0.5, handX: 10, handY: -50 },
  APPROACH_WALL_2: { x: 676, y: 171, w: 55, h: 78, anchorX: 0.5, anchorY: 0.5, handX: 10, handY: -50 },
  APPROACH_WALL_3: { x: 803, y: 172, w: 57, h: 76, anchorX: 0.5, anchorY: 0.5, handX: 10, handY: -50 },
  APPROACH_WALL_4: { x: 930, y: 170, w: 60, h: 80, anchorX: 0.5, anchorY: 0.5, handX: 10, handY: -50 },
  APPROACH_WALL_5: { x: 1055, y: 167, w: 65, h: 85, anchorX: 0.5, anchorY: 0.5, handX: 10, handY: -50 },
  APPROACH_WALL_6: { x: 1184, y: 165, w: 64, h: 89, anchorX: 0.5, anchorY: 0.5, handX: 10, handY: -50 },
  GROUND_TO_WALL_1: { x: 1324, y: 185, w: 40, h: 49, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  GROUND_TO_WALL_2: { x: 1446, y: 186, w: 51, h: 47, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  GROUND_TO_WALL_3: { x: -196, y: 313, w: 519, h: 74, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  GROUND_TO_WALL_4: { x: 137, y: 313, w: 110, h: 73, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  GROUND_TO_WALL_5: { x: 295, y: 314, w: 49, h: 72, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  GROUND_TO_WALL_6: { x: 422, y: 314, w: 52, h: 72, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  GROUND_TO_WALL_7: { x: 548, y: 313, w: 56, h: 73, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  GROUND_TO_WALL_8: { x: 674, y: 314, w: 60, h: 72, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  GROUND_TO_WALL_9: { x: 800, y: 314, w: 64, h: 72, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  GROUND_TO_WALL_10: { x: 933, y: 315, w: 53, h: 70, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  GROUND_TO_WALL_11: { x: 1066, y: 315, w: 44, h: 69, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  GROUND_TO_WALL_12: { x: 1195, y: 316, w: 41, h: 67, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  GROUND_TO_WALL_13: { x: 1327, y: 315, w: 34, h: 70, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  GROUND_TO_WALL_14: { x: 1453, y: 311, w: 37, h: 78, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  WALL_LEFT_1: { x: -22, y: 430, w: 171, h: 120, anchorX: 0.5, anchorY: 0.5, handX: 10, handY: -50 },
  WALL_LEFT_2: { x: 165, y: 457, w: 54, h: 65, anchorX: 0.5, anchorY: 0.5, handX: 10, handY: -50 },
  WALL_LEFT_3: { x: 172, y: 436, w: 295, h: 108, anchorX: 0.5, anchorY: 0.5, handX: 10, handY: -50 },
  WALL_RIGHT_1: { x: 241, y: 430, w: 414, h: 120, anchorX: 0.5, anchorY: 0.5, handX: 10, handY: -50 },
  WALL_RIGHT_2: { x: 557, y: 442, w: 38, h: 95, anchorX: 0.5, anchorY: 0.5, handX: 10, handY: -50 },
  WALL_RIGHT_3: { x: 687, y: 441, w: 33, h: 97, anchorX: 0.5, anchorY: 0.5, handX: 10, handY: -50 },
  CLIMB_UP_1: { x: 776, y: 435, w: 112, h: 109, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  CLIMB_UP_2: { x: 936, y: 443, w: 48, h: 93, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  CLIMB_UP_3: { x: 1064, y: 437, w: 47, h: 105, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  CLIMB_UP_4: { x: 1194, y: 435, w: 44, h: 109, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  CLIMB_UP_5: { x: 1324, y: 435, w: 39, h: 109, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  CLIMB_DOWN_1: { x: 1450, y: 432, w: 44, h: 116, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  CLIMB_DOWN_2: { x: -84, y: 570, w: 296, h: 120, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  CLIMB_DOWN_3: { x: 166, y: 579, w: 51, h: 101, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  CLIMB_DOWN_4: { x: 294, y: 579, w: 51, h: 101, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  WALL_TO_CEILING_1: { x: 432, y: 581, w: 32, h: 97, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  WALL_TO_CEILING_2: { x: 558, y: 580, w: 35, h: 99, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  WALL_TO_CEILING_3: { x: 681, y: 580, w: 46, h: 100, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  WALL_TO_CEILING_4: { x: 806, y: 580, w: 52, h: 100, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  WALL_TO_CEILING_5: { x: 664, y: 570, w: 591, h: 120, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  WALL_TO_CEILING_6: { x: 1064, y: 580, w: 47, h: 100, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  WALL_TO_CEILING_7: { x: 1194, y: 580, w: 44, h: 99, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_LEFT_1: { x: 1324, y: 603, w: 39, h: 53, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_LEFT_2: { x: 1452, y: 604, w: 40, h: 52, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_LEFT_3: { x: 43, y: 743, w: 42, h: 53, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_LEFT_4: { x: 170, y: 741, w: 43, h: 57, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_LEFT_5: { x: 296, y: 740, w: 47, h: 60, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_LEFT_6: { x: 421, y: 738, w: 53, h: 63, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_LEFT_7: { x: 549, y: 738, w: 53, h: 63, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_LEFT_8: { x: 678, y: 739, w: 52, h: 61, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_LEFT_9: { x: 804, y: 739, w: 56, h: 61, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_LEFT_10: { x: 932, y: 739, w: 56, h: 62, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_LEFT_11: { x: 1061, y: 738, w: 53, h: 64, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_LEFT_12: { x: 1191, y: 737, w: 50, h: 66, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_RIGHT_1: { x: 1323, y: 736, w: 42, h: 67, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_RIGHT_2: { x: 1449, y: 737, w: 46, h: 66, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_RIGHT_3: { x: 37, y: 877, w: 53, h: 65, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_RIGHT_4: { x: 167, y: 877, w: 50, h: 65, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_RIGHT_5: { x: 294, y: 878, w: 52, h: 64, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_RIGHT_6: { x: 423, y: 878, w: 49, h: 64, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_RIGHT_7: { x: 549, y: 878, w: 53, h: 64, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_RIGHT_8: { x: 678, y: 878, w: 52, h: 64, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_RIGHT_9: { x: 812, y: 878, w: 39, h: 64, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_RIGHT_10: { x: 942, y: 878, w: 35, h: 64, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_RIGHT_11: { x: 1071, y: 877, w: 33, h: 65, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_TO_WALL_1: { x: 1194, y: 883, w: 43, h: 54, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_TO_WALL_2: { x: 1323, y: 886, w: 41, h: 47, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_TO_WALL_3: { x: 1450, y: 879, w: 43, h: 62, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_TO_WALL_4: { x: 42, y: 1011, w: 44, h: 78, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_TO_WALL_5: { x: 166, y: 1011, w: 51, h: 78, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_TO_WALL_6: { x: 292, y: 1013, w: 56, h: 73, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_TO_WALL_7: { x: 419, y: 1017, w: 57, h: 66, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_TO_WALL_8: { x: 547, y: 1014, w: 57, h: 71, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_TO_WALL_9: { x: 675, y: 1012, w: 57, h: 75, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  CEILING_TO_WALL_10: { x: 805, y: 1008, w: 53, h: 83, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50 },
  WALL_TO_GROUND_1: { x: 940, y: 1010, w: 39, h: 80, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  WALL_TO_GROUND_2: { x: 1067, y: 1010, w: 41, h: 80, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  WALL_TO_GROUND_3: { x: 1119, y: 1019, w: 193, h: 62, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  WALL_TO_GROUND_4: { x: 1321, y: 1020, w: 45, h: 59, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  WALL_TO_GROUND_5: { x: 1450, y: 1019, w: 44, h: 61, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  WALL_TO_GROUND_6: { x: 43, y: 1156, w: 42, h: 68, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  WALL_TO_GROUND_7: { x: 170, y: 1152, w: 43, h: 75, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  WALL_TO_GROUND_8: { x: 299, y: 1150, w: 42, h: 80, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  WALL_TO_GROUND_9: { x: 429, y: 1149, w: 37, h: 82, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  WALL_TO_GROUND_10: { x: 557, y: 1149, w: 37, h: 81, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  WALL_TO_GROUND_11: { x: 685, y: 1149, w: 37, h: 81, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50 },
  SWING_1: { x: 812, y: 1139, w: 39, h: 101, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50, grip: true },
  SWING_2: { x: 887, y: 1132, w: 146, h: 116, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50, grip: true },
  SWING_3: { x: 1013, y: 1130, w: 150, h: 120, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50, grip: true },
  SWING_4: { x: 1148, y: 1130, w: 136, h: 120, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50, grip: true },
  SWING_5: { x: 1305, y: 1141, w: 78, h: 98, anchorX: 0.5, anchorY: 1.0, handX: 10, handY: -50, grip: true },
  HANG_1: { x: 1458, y: 1126, w: 28, h: 128, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50, grip: true },
  HANG_2: { x: 39, y: 1270, w: 49, h: 120, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50, grip: true },
  HANG_3: { x: 169, y: 1272, w: 46, h: 115, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50, grip: true },
  HANG_4: { x: 298, y: 1266, w: 43, h: 127, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50, grip: true },
  HANG_5: { x: 423, y: 1269, w: 49, h: 121, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50, grip: true },
  HANG_6: { x: 533, y: 1268, w: 86, h: 123, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50, grip: true },
  HANG_7: { x: 679, y: 1268, w: 50, h: 124, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50, grip: true },
  HANG_8: { x: 810, y: 1266, w: 44, h: 127, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50, grip: true },
  HANG_9: { x: 933, y: 1269, w: 54, h: 121, anchorX: 0.5, anchorY: 0.0, handX: 10, handY: -50, grip: true },
};
POSES['IDLE'] = POSES['IDLE_1'];
POSES['WALK'] = POSES['WALK_1'];
POSES['RUN'] = POSES['RUN_1'];
POSES['APPROACH_WALL'] = POSES['APPROACH_WALL_1'];
POSES['GROUND_TO_WALL'] = POSES['GROUND_TO_WALL_1'];
POSES['WALL_LEFT'] = POSES['WALL_LEFT_1'];
POSES['WALL_RIGHT'] = POSES['WALL_RIGHT_1'];
POSES['CLIMB_UP'] = POSES['CLIMB_UP_1'];
POSES['CLIMB_DOWN'] = POSES['CLIMB_DOWN_1'];
POSES['WALL_TO_CEILING'] = POSES['WALL_TO_CEILING_1'];
POSES['CEILING_LEFT'] = POSES['CEILING_LEFT_1'];
POSES['CEILING_RIGHT'] = POSES['CEILING_RIGHT_1'];
POSES['CEILING_TO_WALL'] = POSES['CEILING_TO_WALL_1'];
POSES['WALL_TO_GROUND'] = POSES['WALL_TO_GROUND_1'];
POSES['SWING'] = POSES['SWING_1'];
POSES['HANG'] = POSES['HANG_1'];
