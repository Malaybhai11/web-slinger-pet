/**
 * animations.ts — Full animation library and elapsed-time-driven animation controller for Spider-Man.
 */

import type { PoseName } from './sprite.js';

export interface AnimationDef {
  frames: PoseName[];
  fps: number;
  loop: boolean;
}

export const ANIMS: Record<string, AnimationDef> = {
  // Idle hero breathing
  idle: {
    frames: ['IDLE_1', 'IDLE_2', 'IDLE_3', 'IDLE_4'],
    fps: 4,
    loop: true,
  },

  // Looking around
  lookUp: {
    frames: ['LOOK_UP_1', 'LOOK_UP_2', 'LOOK_UP_3'],
    fps: 4,
    loop: false,
  },
  lookDown: {
    frames: ['LOOK_DOWN_1', 'LOOK_DOWN_2', 'LOOK_DOWN_3'],
    fps: 4,
    loop: false,
  },

  // Wave & Stretch
  wave: {
    frames: ['WAVE_1', 'WAVE_2', 'WAVE_3', 'WAVE_2'],
    fps: 5,
    loop: true,
  },
  stretch: {
    frames: ['STRETCH_1', 'STRETCH_2', 'STRETCH_3'],
    fps: 4,
    loop: false,
  },

  // Locomotion
  walk: {
    frames: ['WALK_1', 'WALK_2', 'WALK_3', 'WALK_4', 'WALK_5', 'WALK_6'],
    fps: 8,
    loop: true,
  },
  run: {
    frames: ['RUN_1', 'RUN_2', 'RUN_3', 'RUN_4', 'RUN_5', 'RUN_6'],
    fps: 12,
    loop: true,
  },
  crouch: {
    frames: ['CROUCH_1', 'CROUCH_2', 'CROUCH_3'],
    fps: 5,
    loop: false,
  },

  // Acrobatics
  backflip: {
    frames: ['BACKFLIP_1', 'BACKFLIP_2', 'BACKFLIP_3', 'BACKFLIP_4'],
    fps: 10,
    loop: false,
  },
  jump: {
    frames: ['JUMP_1', 'JUMP_2', 'JUMP_3'],
    fps: 6,
    loop: false,
  },
  fall: {
    frames: ['FALL_1', 'FALL_2', 'FALL_3'],
    fps: 6,
    loop: true,
  },
  land: {
    frames: ['LAND_1', 'LAND_2', 'LAND_3', 'LAND_4'],
    fps: 10,
    loop: false,
  },

  // Status effects
  dizzy: {
    frames: ['DIZZY_1', 'DIZZY_2', 'DIZZY_3', 'DIZZY_4'],
    fps: 6,
    loop: true,
  },
  victory: {
    frames: ['VICTORY_1', 'VICTORY_2', 'VICTORY_3'],
    fps: 6,
    loop: false,
  },

  // Web Slinging & Wall Mechanics
  swing: {
    frames: ['SWING_1', 'SWING_2', 'SWING_3', 'SWING_4', 'SWING_5', 'SWING_6', 'SWING_7', 'SWING_8'],
    fps: 10,
    loop: true,
  },
  cling: {
    frames: ['CLING_1', 'CLING_2', 'CLING_3'],
    fps: 4,
    loop: true,
  },
  wallRun: {
    frames: ['WALL_RUN_1', 'WALL_RUN_2', 'WALL_RUN_3', 'WALL_RUN_4'],
    fps: 10,
    loop: true,
  },

  // Web Combat
  webShoot: {
    frames: ['WEB_SHOOT_1', 'WEB_SHOOT_2', 'WEB_SHOOT_3', 'WEB_SHOOT_4'],
    fps: 10,
    loop: false,
  },
  aim: {
    frames: ['WEB_SHOOT_1', 'WEB_SHOOT_2'],
    fps: 8,
    loop: false,
  },
  shoot: {
    frames: ['WEB_SHOOT_3', 'WEB_SHOOT_4'],
    fps: 10,
    loop: false,
  },
  webZip: {
    frames: ['WEB_ZIP_1', 'WEB_ZIP_2', 'WEB_ZIP_3', 'WEB_ZIP_4'],
    fps: 12,
    loop: true,
  },
  zip: {
    frames: ['WEB_ZIP_1', 'WEB_ZIP_2', 'WEB_ZIP_3', 'WEB_ZIP_4'],
    fps: 12,
    loop: true,
  },
  perch: {
    frames: ['PERCH_1', 'PERCH_2', 'PERCH_3'],
    fps: 4,
    loop: true,
  },
  hang: {
    frames: ['PERCH_1', 'PERCH_2', 'PERCH_3'],
    fps: 4,
    loop: true,
  },

  // Combat & Damage
  attack: {
    frames: ['ATTACK_1', 'ATTACK_2', 'ATTACK_3', 'ATTACK_4'],
    fps: 12,
    loop: false,
  },
  roll: {
    frames: ['ROLL_1', 'ROLL_2', 'ROLL_3', 'ROLL_4'],
    fps: 12,
    loop: false,
  },
  takeDamage: {
    frames: ['TAKE_DAMAGE_1', 'TAKE_DAMAGE_2', 'TAKE_DAMAGE_3', 'TAKE_DAMAGE_4'],
    fps: 10,
    loop: false,
  },
  dead: {
    frames: ['DEAD_1', 'DEAD_2', 'DEAD_3'],
    fps: 4,
    loop: false,
  },

  // Legacy fallback aliases
  leap: { frames: ['JUMP_2', 'FALL_2'], fps: 6, loop: false },
  thwip: { frames: ['WAVE_2', 'WAVE_3'], fps: 6, loop: false },
  flinch: { frames: ['TAKE_DAMAGE_2'], fps: 6, loop: false },

  // Surface-aware behavior animations
  sit: {
    frames: ['SIT', 'SIT', 'SIT_IDLE', 'SIT', 'SIT', 'SIT_IDLE'],
    fps: 2,
    loop: true,
  },
  sitFidget: {
    frames: ['SIT_IDLE', 'SIT', 'SIT_IDLE', 'SIT', 'SIT_IDLE'],
    fps: 4,
    loop: false,
  },
  crawlLeft: {
    frames: ['WALK_1', 'WALK_MID', 'WALK_2', 'WALK_MID'],
    fps: 8,
    loop: true,
  },
  crawlRight: {
    frames: ['WALK_3', 'WALK_MID', 'WALK_4', 'WALK_MID'],
    fps: 8,
    loop: true,
  },
  prepare: {
    frames: ['CROUCH_1', 'CROUCH_2', 'CROUCH_3'],
    fps: 8,
    loop: false,
  },
  hanging: {
    frames: ['UPSIDE_DOWN_HANG_1', 'UPSIDE_DOWN_HANG_2', 'HANG_STRAIGHT_DOWN'],
    fps: 6,
    loop: false,
  },
  idleHanging: {
    frames: ['HANG_STRAIGHT_DOWN', 'UPSIDE_DOWN_HANG_3', 'HANG_STRAIGHT_DOWN', 'UPSIDE_DOWN_HANG_2'],
    fps: 4,
    loop: true,
  },
};

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

    const pose = def.frames[this.frameIndex];
    return pose || 'IDLE';
  }

  getCurrentPose(): PoseName {
    const def = ANIMS[this.currentAnim] || ANIMS.idle;
    const pose = def.frames[this.frameIndex];
    return pose || 'IDLE';
  }

  isFinished(): boolean {
    return this.finished;
  }

  getCurrentAnim(): string {
    return this.currentAnim;
  }

  getFrameIndex(): number {
    return this.frameIndex;
  }
}
