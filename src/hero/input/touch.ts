/**
 * touch.ts — mobile controls (PRD §6.2, §11):
 * left 30% of the screen = move left, right 30% = move right,
 * center tap = web-shoot at the tapped element (auto-aim), or jump if
 * nothing web-able was tapped.
 */

import type { InputState } from '../character/state.js';

export class Touch {
  input: InputState = { left: false, right: false, crouch: false, run: false };
  private activeId: number | null = null;

  attach(onTap: (x: number, y: number) => void, onFirst: () => void): void {
    window.addEventListener(
      'touchstart',
      (e) => {
        onFirst();
        const t = e.changedTouches[0];
        if (!t) return;
        const w = window.innerWidth;
        if (t.clientX < w * 0.3) {
          this.input.left = true;
          this.activeId = t.identifier;
        } else if (t.clientX > w * 0.7) {
          this.input.right = true;
          this.activeId = t.identifier;
        } else {
          onTap(t.clientX + window.scrollX, t.clientY + window.scrollY);
        }
      },
      { passive: true },
    );
    const clear = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.activeId) {
          this.input.left = false;
          this.input.right = false;
          this.activeId = null;
        }
      }
    };
    window.addEventListener('touchend', clear, { passive: true });
    window.addEventListener('touchcancel', clear, { passive: true });
  }
}
