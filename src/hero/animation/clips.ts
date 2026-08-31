/**
 * clips.ts — hero state to sprite clip, with graceful degradation.
 *
 * The art is bought one animation at a time from a fixed budget, so the atlas
 * on disk may not contain every clip this file names. Each state therefore
 * declares a preference chain and `pickClip` walks it, which means the engine
 * runs correctly against a partial atlas and simply looks better as more art
 * lands. Nothing here should ever hard-fail on a missing clip.
 */

import { CLIPS } from './atlas-data.js';
import type { HeroState } from '../character/state.js';

/** First clip in the list that actually exists in the atlas. */
export function pickClip(...prefs: string[]): string {
  for (const p of prefs) if (CLIPS[p]) return p;
  return CLIPS.idle ? 'idle' : Object.keys(CLIPS)[0] ?? '';
}

export interface ClipChoice {
  clip: string;
  /** draw in the thin east/west profile rather than three-quarter */
  profile: boolean;
}

/**
 * There is no `falling`, `climbing` or `hanging` template for this character's
 * body type, so a few states borrow: the airborne pose is the tail of the jump,
 * clinging reuses the web-pull hang, and a hard landing reuses the crouch.
 */
export function clipFor(state: HeroState): ClipChoice {
  switch (state) {
    case 'idle':        return { clip: pickClip('idle', 'idle-front', 'pose'), profile: false };
    case 'sipping':     return { clip: pickClip('sip', 'grab', 'idle-front'), profile: false };
    case 'walking':     return { clip: pickClip('walk', 'walk-front'), profile: false };
    case 'running':     return { clip: pickClip('run', 'run-front', 'walk'), profile: false };
    case 'jumping':     return { clip: pickClip('jump', 'leap'), profile: false };
    case 'falling':     return { clip: pickClip('jump', 'faceplant'), profile: false };
    case 'landing':     return { clip: pickClip('land', 'crouch'), profile: false };
    case 'crouching':   return { clip: pickClip('land', 'crawl'), profile: false };
    case 'swinging':    return { clip: pickClip('hang', 'thwip-side', 'jump'), profile: true };
    case 'clinging':    return { clip: pickClip('hang', 'crawl', 'idle'), profile: true };
    case 'stretching':  return { clip: pickClip('stretch', 'idle-front', 'idle'), profile: false };
    // no sit template exists for this body type — perching reads as a
    // profile idle looking off the edge, which is closer than a crouch
    case 'sitting':     return { clip: pickClip('idle-side', 'land', 'idle'), profile: true };
    case 'taunting':    return { clip: pickClip('taunt', 'flip', 'idle-front'), profile: false };
    case 'pressing':    return { clip: pickClip('press', 'grab', 'thwip'), profile: false };
    case 'faceplanting':return { clip: pickClip('faceplant', 'ouch', 'land'), profile: false };
    case 'recovering':  return { clip: pickClip('recover', 'idle'), profile: false };
    case 'skidding':    return { clip: pickClip('skid', 'land'), profile: false };
    case 'alerting':    return { clip: pickClip('alert', 'idle'), profile: false };
    // no punch-combo art exists — the fight-stance loop already reads as a
    // boxer's guard on its own, so shadow-boxing reuses it as a distinct
    // performance (its own duration and quips) rather than buying new art
    case 'boxing':      return { clip: pickClip('alert', 'idle-front'), profile: false };
    // the web-throw motion, played standalone with no real web line — this is
    // what "mimicking a web-shot" actually is
    case 'mimicking':   return { clip: pickClip('thwip', 'idle-front'), profile: false };
    default:            return { clip: pickClip('idle'), profile: false };
  }
}

/** Clips used for one-off flourishes the director triggers by name. */
export const FLOURISH = {
  thwip: () => pickClip('thwip', 'grab', 'idle'),
  thwipSide: () => pickClip('thwip-side', 'thwip', 'idle'),
  flip: () => pickClip('flip', 'taunt', 'jump'),
  bored: () => pickClip('bored', 'walk'),
  creep: () => pickClip('creep', 'crawl', 'walk'),
};
