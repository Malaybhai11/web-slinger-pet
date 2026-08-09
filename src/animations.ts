/**
 * animations.ts -- Full animation definitions for all 16 Spider-Man animation groups.
 */

import type { PoseName } from './sprite.js';

export interface AnimationDef {
  frames: PoseName[];
  fps: number;
  loop: boolean;
}

export const ANIMS: Record<string, AnimationDef> = {
  idle: { frames: ['IDLE_1', 'IDLE_2', 'IDLE_3', 'IDLE_4', 'IDLE_5'], fps: 4, loop: true },
  IDLE: { frames: ['IDLE_1', 'IDLE_2', 'IDLE_3', 'IDLE_4', 'IDLE_5'], fps: 4, loop: true },
  walk: { frames: ['WALK_1', 'WALK_2', 'WALK_3', 'WALK_4', 'WALK_5', 'WALK_6', 'WALK_7'], fps: 8, loop: true },
  WALK: { frames: ['WALK_1', 'WALK_2', 'WALK_3', 'WALK_4', 'WALK_5', 'WALK_6', 'WALK_7'], fps: 8, loop: true },
  run: { frames: ['RUN_1', 'RUN_2', 'RUN_3', 'RUN_4'], fps: 12, loop: true },
  RUN: { frames: ['RUN_1', 'RUN_2', 'RUN_3', 'RUN_4'], fps: 12, loop: true },
  approach_wall: { frames: ['APPROACH_WALL_1', 'APPROACH_WALL_2', 'APPROACH_WALL_3', 'APPROACH_WALL_4', 'APPROACH_WALL_5', 'APPROACH_WALL_6'], fps: 10, loop: false },
  APPROACH_WALL: { frames: ['APPROACH_WALL_1', 'APPROACH_WALL_2', 'APPROACH_WALL_3', 'APPROACH_WALL_4', 'APPROACH_WALL_5', 'APPROACH_WALL_6'], fps: 10, loop: false },
  ground_to_wall: { frames: ['GROUND_TO_WALL_1', 'GROUND_TO_WALL_2', 'GROUND_TO_WALL_3', 'GROUND_TO_WALL_4', 'GROUND_TO_WALL_5', 'GROUND_TO_WALL_6', 'GROUND_TO_WALL_7', 'GROUND_TO_WALL_8', 'GROUND_TO_WALL_9', 'GROUND_TO_WALL_10', 'GROUND_TO_WALL_11', 'GROUND_TO_WALL_12', 'GROUND_TO_WALL_13', 'GROUND_TO_WALL_14'], fps: 10, loop: false },
  GROUND_TO_WALL: { frames: ['GROUND_TO_WALL_1', 'GROUND_TO_WALL_2', 'GROUND_TO_WALL_3', 'GROUND_TO_WALL_4', 'GROUND_TO_WALL_5', 'GROUND_TO_WALL_6', 'GROUND_TO_WALL_7', 'GROUND_TO_WALL_8', 'GROUND_TO_WALL_9', 'GROUND_TO_WALL_10', 'GROUND_TO_WALL_11', 'GROUND_TO_WALL_12', 'GROUND_TO_WALL_13', 'GROUND_TO_WALL_14'], fps: 10, loop: false },
  wall_left: { frames: ['WALL_LEFT_1', 'WALL_LEFT_2', 'WALL_LEFT_3'], fps: 10, loop: true },
  WALL_LEFT: { frames: ['WALL_LEFT_1', 'WALL_LEFT_2', 'WALL_LEFT_3'], fps: 10, loop: true },
  wall_right: { frames: ['WALL_RIGHT_1', 'WALL_RIGHT_2', 'WALL_RIGHT_3'], fps: 10, loop: true },
  WALL_RIGHT: { frames: ['WALL_RIGHT_1', 'WALL_RIGHT_2', 'WALL_RIGHT_3'], fps: 10, loop: true },
  climb_up: { frames: ['CLIMB_UP_1', 'CLIMB_UP_2', 'CLIMB_UP_3', 'CLIMB_UP_4', 'CLIMB_UP_5'], fps: 10, loop: true },
  CLIMB_UP: { frames: ['CLIMB_UP_1', 'CLIMB_UP_2', 'CLIMB_UP_3', 'CLIMB_UP_4', 'CLIMB_UP_5'], fps: 10, loop: true },
  climb_down: { frames: ['CLIMB_DOWN_1', 'CLIMB_DOWN_2', 'CLIMB_DOWN_3', 'CLIMB_DOWN_4'], fps: 10, loop: true },
  CLIMB_DOWN: { frames: ['CLIMB_DOWN_1', 'CLIMB_DOWN_2', 'CLIMB_DOWN_3', 'CLIMB_DOWN_4'], fps: 10, loop: true },
  wall_to_ceiling: { frames: ['WALL_TO_CEILING_1', 'WALL_TO_CEILING_2', 'WALL_TO_CEILING_3', 'WALL_TO_CEILING_4', 'WALL_TO_CEILING_5', 'WALL_TO_CEILING_6', 'WALL_TO_CEILING_7'], fps: 10, loop: false },
  WALL_TO_CEILING: { frames: ['WALL_TO_CEILING_1', 'WALL_TO_CEILING_2', 'WALL_TO_CEILING_3', 'WALL_TO_CEILING_4', 'WALL_TO_CEILING_5', 'WALL_TO_CEILING_6', 'WALL_TO_CEILING_7'], fps: 10, loop: false },
  ceiling_left: { frames: ['CEILING_LEFT_1', 'CEILING_LEFT_2', 'CEILING_LEFT_3', 'CEILING_LEFT_4', 'CEILING_LEFT_5', 'CEILING_LEFT_6', 'CEILING_LEFT_7', 'CEILING_LEFT_8', 'CEILING_LEFT_9', 'CEILING_LEFT_10', 'CEILING_LEFT_11', 'CEILING_LEFT_12'], fps: 10, loop: true },
  CEILING_LEFT: { frames: ['CEILING_LEFT_1', 'CEILING_LEFT_2', 'CEILING_LEFT_3', 'CEILING_LEFT_4', 'CEILING_LEFT_5', 'CEILING_LEFT_6', 'CEILING_LEFT_7', 'CEILING_LEFT_8', 'CEILING_LEFT_9', 'CEILING_LEFT_10', 'CEILING_LEFT_11', 'CEILING_LEFT_12'], fps: 10, loop: true },
  ceiling_right: { frames: ['CEILING_RIGHT_1', 'CEILING_RIGHT_2', 'CEILING_RIGHT_3', 'CEILING_RIGHT_4', 'CEILING_RIGHT_5', 'CEILING_RIGHT_6', 'CEILING_RIGHT_7', 'CEILING_RIGHT_8', 'CEILING_RIGHT_9', 'CEILING_RIGHT_10', 'CEILING_RIGHT_11'], fps: 10, loop: true },
  CEILING_RIGHT: { frames: ['CEILING_RIGHT_1', 'CEILING_RIGHT_2', 'CEILING_RIGHT_3', 'CEILING_RIGHT_4', 'CEILING_RIGHT_5', 'CEILING_RIGHT_6', 'CEILING_RIGHT_7', 'CEILING_RIGHT_8', 'CEILING_RIGHT_9', 'CEILING_RIGHT_10', 'CEILING_RIGHT_11'], fps: 10, loop: true },
  ceiling_to_wall: { frames: ['CEILING_TO_WALL_1', 'CEILING_TO_WALL_2', 'CEILING_TO_WALL_3', 'CEILING_TO_WALL_4', 'CEILING_TO_WALL_5', 'CEILING_TO_WALL_6', 'CEILING_TO_WALL_7', 'CEILING_TO_WALL_8', 'CEILING_TO_WALL_9', 'CEILING_TO_WALL_10'], fps: 10, loop: false },
  CEILING_TO_WALL: { frames: ['CEILING_TO_WALL_1', 'CEILING_TO_WALL_2', 'CEILING_TO_WALL_3', 'CEILING_TO_WALL_4', 'CEILING_TO_WALL_5', 'CEILING_TO_WALL_6', 'CEILING_TO_WALL_7', 'CEILING_TO_WALL_8', 'CEILING_TO_WALL_9', 'CEILING_TO_WALL_10'], fps: 10, loop: false },
  wall_to_ground: { frames: ['WALL_TO_GROUND_1', 'WALL_TO_GROUND_2', 'WALL_TO_GROUND_3', 'WALL_TO_GROUND_4', 'WALL_TO_GROUND_5', 'WALL_TO_GROUND_6', 'WALL_TO_GROUND_7', 'WALL_TO_GROUND_8', 'WALL_TO_GROUND_9', 'WALL_TO_GROUND_10', 'WALL_TO_GROUND_11'], fps: 10, loop: false },
  WALL_TO_GROUND: { frames: ['WALL_TO_GROUND_1', 'WALL_TO_GROUND_2', 'WALL_TO_GROUND_3', 'WALL_TO_GROUND_4', 'WALL_TO_GROUND_5', 'WALL_TO_GROUND_6', 'WALL_TO_GROUND_7', 'WALL_TO_GROUND_8', 'WALL_TO_GROUND_9', 'WALL_TO_GROUND_10', 'WALL_TO_GROUND_11'], fps: 10, loop: false },
  swing: { frames: ['SWING_1', 'SWING_2', 'SWING_3', 'SWING_4', 'SWING_5'], fps: 10, loop: true },
  SWING: { frames: ['SWING_1', 'SWING_2', 'SWING_3', 'SWING_4', 'SWING_5'], fps: 10, loop: true },
  hang: { frames: ['HANG_1', 'HANG_2', 'HANG_3', 'HANG_4', 'HANG_5', 'HANG_6', 'HANG_7', 'HANG_8', 'HANG_9'], fps: 10, loop: true },
  HANG: { frames: ['HANG_1', 'HANG_2', 'HANG_3', 'HANG_4', 'HANG_5', 'HANG_6', 'HANG_7', 'HANG_8', 'HANG_9'], fps: 10, loop: true },
};
ANIMS['sit'] = ANIMS['idle'] || ANIMS.idle;
ANIMS['crouch'] = ANIMS['ground_to_wall'] || ANIMS.idle;
ANIMS['backflip'] = ANIMS['swing'] || ANIMS.idle;
ANIMS['jump'] = ANIMS['approach_wall'] || ANIMS.idle;
ANIMS['fall'] = ANIMS['wall_to_ground'] || ANIMS.idle;
ANIMS['land'] = ANIMS['wall_to_ground'] || ANIMS.idle;
ANIMS['dizzy'] = ANIMS['hang'] || ANIMS.idle;
ANIMS['victory'] = ANIMS['idle'] || ANIMS.idle;
ANIMS['webShoot'] = ANIMS['swing'] || ANIMS.idle;
ANIMS['webZip'] = ANIMS['swing'] || ANIMS.idle;
ANIMS['wave'] = ANIMS['idle'] || ANIMS.idle;
ANIMS['stretch'] = ANIMS['idle'] || ANIMS.idle;
ANIMS['prepare'] = ANIMS['approach_wall'] || ANIMS.idle;
ANIMS['hanging'] = ANIMS['hang'] || ANIMS.idle;
ANIMS['idleHanging'] = ANIMS['hang'] || ANIMS.idle;
ANIMS['crawlLeft'] = ANIMS['wall_left'] || ANIMS.idle;
ANIMS['crawlRight'] = ANIMS['wall_right'] || ANIMS.idle;
ANIMS['sitFidget'] = ANIMS['idle'] || ANIMS.idle;
ANIMS['lookUp'] = ANIMS['idle'] || ANIMS.idle;
ANIMS['lookDown'] = ANIMS['idle'] || ANIMS.idle;
ANIMS['aim'] = ANIMS['approach_wall'] || ANIMS.idle;
ANIMS['shoot'] = ANIMS['swing'] || ANIMS.idle;
ANIMS['zip'] = ANIMS['swing'] || ANIMS.idle;
ANIMS['perch'] = ANIMS['hang'] || ANIMS.idle;
ANIMS['attack'] = ANIMS['swing'] || ANIMS.idle;
ANIMS['roll'] = ANIMS['ground_to_wall'] || ANIMS.idle;
ANIMS['takeDamage'] = ANIMS['wall_to_ground'] || ANIMS.idle;
ANIMS['dead'] = ANIMS['hang'] || ANIMS.idle;
ANIMS['leap'] = ANIMS['approach_wall'] || ANIMS.idle;
ANIMS['thwip'] = ANIMS['swing'] || ANIMS.idle;
ANIMS['flinch'] = ANIMS['wall_to_ground'] || ANIMS.idle;

export class AnimationPlayer {
  private currentAnim: string = 'idle';
  private frameIndex = 0;
  private frameTimer = 0;
  private finished = false;

  play(animName: string): void {
    if (animName === this.currentAnim && !this.finished) return;
    this.currentAnim = ANIMS[animName] ? animName : 'idle';
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.finished = false;
  }

  update(dtMs: number): PoseName {
    const def = ANIMS[this.currentAnim] || ANIMS.idle;
    const frameDuration = 1000 / (def.fps || 4);
    this.frameTimer += dtMs;
    while (this.frameTimer >= frameDuration) {
      this.frameTimer -= frameDuration;
      if (this.frameIndex + 1 < def.frames.length) {
        this.frameIndex++;
      } else if (def.loop) {
        this.frameIndex = 0;
      } else {
        this.finished = true;
        break;
      }
    }
    return def.frames[this.frameIndex] || 'IDLE_1';
  }

  getCurrentPose(): PoseName {
    const def = ANIMS[this.currentAnim] || ANIMS.idle;
    return def.frames[this.frameIndex] || 'IDLE_1';
  }
  isFinished(): boolean { return this.finished; }
  getCurrentAnim(): string { return this.currentAnim; }
  getFrameIndex(): number { return this.frameIndex; }
}
