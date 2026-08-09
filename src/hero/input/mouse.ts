/**
 * mouse.ts — cursor tracking (for aim) + click-to-shoot (PRD §6.2).
 * All coordinates are stored in PAGE space (PRD §5.7).
 */

export class Mouse {
  x = -9999;   // page coords
  y = -9999;
  present = false;

  attach(onClick: (x: number, y: number) => void, onFirst: () => void): void {
    window.addEventListener('mousemove', (e) => {
      this.x = e.clientX + window.scrollX;
      this.y = e.clientY + window.scrollY;
      this.present = true;
    });
    window.addEventListener('mouseleave', () => {
      this.present = false;
    });
    // the canvas has pointer-events:none, so clicks land on the real DOM —
    // page functionality is unaffected (PRD §15)
    window.addEventListener('click', (e) => {
      onFirst();
      onClick(e.clientX + window.scrollX, e.clientY + window.scrollY);
    });
  }
}
