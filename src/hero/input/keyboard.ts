/**
 * keyboard.ts — desktop controls (PRD §6.2):
 * A/D or ←/→ move · W/↑/Space jump · S/↓ crouch · Shift run
 */

import type { InputState } from '../character/state.js';

export class Keyboard {
  input: InputState = { left: false, right: false, crouch: false, run: false };
  private jumpCount = 0;

  attach(onFirstKey: () => void): void {
    window.addEventListener('keydown', (e) => this.handle(e, true, onFirstKey));
    window.addEventListener('keyup', (e) => this.handle(e, false, onFirstKey));
  }

  private handle(e: KeyboardEvent, down: boolean, onFirstKey: () => void): void {
    onFirstKey();
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.input.left = down;
        e.preventDefault();
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.input.right = down;
        e.preventDefault();
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.input.crouch = down;
        e.preventDefault();
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.input.run = down;
        break;
      case 'Space':
      case 'ArrowUp':
      case 'KeyW':
        if (down && !e.repeat) this.jumpCount++;
        e.preventDefault();
        break;
    }
  }

  takeJump(): boolean {
    if (this.jumpCount > 0) {
      this.jumpCount--;
      return true;
    }
    return false;
  }
}
