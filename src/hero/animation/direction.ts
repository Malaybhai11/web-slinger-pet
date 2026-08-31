/**
 * direction.ts — which way the hero is drawn.
 *
 * The source art is a PixelLab 8-direction character, and its strongest frames
 * are the ones facing the viewer: `south` (front, 28px wide, blue legs, white
 * eyes) and `south-east` (three-quarter). The pure `east` profile is only 15px
 * wide and loses most of the costume, so it is used deliberately and sparingly
 * — for the swing, where the body is a rotating arc more than a character.
 *
 * We only ever own the eastward half of the art. Everything facing west is the
 * same frame drawn mirrored, so a west-facing walk costs nothing.
 */

import { CLIPS } from './atlas-data.js';

export type Dir8 =
  | 'south' | 'south-east' | 'east' | 'north-east'
  | 'north' | 'north-west' | 'west' | 'south-west';

/** west-facing directions and the eastward frame they mirror */
const MIRROR: Partial<Record<Dir8, Dir8>> = {
  'south-west': 'south-east',
  west: 'east',
  'north-west': 'north-east',
};

/**
 * If a clip wasn't bought in the direction we want, fall back along this chain.
 * Ordered by how little the substitution shows: a three-quarter frame stands in
 * for almost anything, the front view is the next safest, and the thin profile
 * is the last resort.
 */
const FALLBACK: Dir8[] = ['south-east', 'south', 'east', 'north-east', 'north'];

export interface Resolved {
  /** the direction key actually present in the atlas */
  dir: string;
  /** draw mirrored horizontally */
  flip: boolean;
}

/** Pick the source direction and mirror flag for a clip facing `want`. */
export function resolveDir(clip: string, want: Dir8): Resolved {
  const c = CLIPS[clip];
  if (!c) return { dir: 'south', flip: false };

  if (c.dirs[want]) return { dir: want, flip: false };

  const mirrored = MIRROR[want];
  if (mirrored && c.dirs[mirrored]) return { dir: mirrored, flip: true };

  // want is eastward but we only have the westward art (or vice versa)
  for (const [west, east] of Object.entries(MIRROR) as [Dir8, Dir8][]) {
    if (want === east && c.dirs[west]) return { dir: west, flip: true };
  }

  for (const f of FALLBACK) {
    if (c.dirs[f]) return { dir: f, flip: needsFlip(want) };
  }

  const first = Object.keys(c.dirs)[0];
  return { dir: first ?? 'south', flip: needsFlip(want) };
}

const WESTWARD = new Set<Dir8>(['west', 'south-west', 'north-west']);
const needsFlip = (d: Dir8): boolean => WESTWARD.has(d);

/**
 * Map motion to a facing. Horizontal travel reads best in three-quarter view,
 * so walking right is `south-east` rather than the thin `east` profile; only
 * an explicit profile request (the swing) gets `east`.
 */
export function dirFromMotion(vx: number, vy: number, opts: { profile?: boolean; climbing?: boolean } = {}): Dir8 {
  const right = vx >= 0;
  if (opts.climbing) return right ? 'north-east' : 'north-west';
  if (opts.profile) return right ? 'east' : 'west';
  if (Math.abs(vx) < 1 && Math.abs(vy) < 1) return 'south';
  return right ? 'south-east' : 'south-west';
}

/** Horizontal facing only, for states that just need left/right. */
export function dirFromFacing(facing: 1 | -1, profile = false): Dir8 {
  if (profile) return facing > 0 ? 'east' : 'west';
  return facing > 0 ? 'south-east' : 'south-west';
}
