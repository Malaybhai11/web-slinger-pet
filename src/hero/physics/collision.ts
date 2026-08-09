/**
 * collision.ts — ground & wall queries against the surface map (PRD §5.2).
 * Thin semantic layer over SurfaceMap so physics code reads like physics code.
 */

import type { Surface, SurfaceMap } from '../world/surfaces.js';

/** what's beneath the hero's feet right now? (the 60fps ground query) */
export function findGround(map: SurfaceMap, x: number, feetY: number): Surface | null {
  return map.groundAt(x, feetY);
}

/** swept test while falling — catch every surface top crossed this step */
export function sweepLanding(
  map: SurfaceMap,
  x: number,
  prevFeet: number,
  newFeet: number,
): Surface | null {
  return map.sweepLand(x, prevFeet, newFeet);
}

/** is there a wall face the hero can cling to? */
export function wallForCling(
  map: SurfaceMap,
  x: number,
  dir: 1 | -1,
  feetY: number,
  height: number,
): Surface | null {
  return map.wallAhead(x, dir, feetY, height);
}
