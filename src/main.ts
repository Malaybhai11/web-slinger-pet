/**
 * main.ts — Boot the Spider-Man pet and bind interactive controls.
 *
 * IMPORTANT: The capture-phase click listener calls pet.reactToInteraction()
 * but NEVER calls preventDefault() or stopPropagation(), so every button
 * click still performs its normal page action.
 */

import { WebSlingerPet } from './spidey.js';

function boot(): void {
  if (document.getElementById('web-slinger-canvas')) return;

  const pet = new WebSlingerPet();
  (window as any).__pet = pet;

  // ── Action-deck buttons (data-action) ─────────────────────────
  // These call performAction() directly; the capture listener below
  // skips them because they carry a data-action attribute.
  document.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const action = (el as HTMLElement).getAttribute('data-action');
      if (!action) return;
      if (action === 'swing') {
        pet.swing();
      } else {
        pet.performAction(action);
      }
    });
  });

  // ── Legacy swing-trigger buttons ──────────────────────────────
  document.querySelectorAll('[data-swing-trigger]').forEach((el) => {
    el.addEventListener('click', () => pet.swing());
  });

  // ── Global capture-phase listener for surface-swing targeting ──
  // Capture phase fires BEFORE the element's own handlers, but we
  // never block the event, so buttons still work normally.
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest?.(
      'button, a, [data-web-target], [data-spidey-target], .btn, .card, .action-card',
    ) as HTMLElement | null;

    if (!el) return;
    if (el.id === 'web-slinger-canvas') return;

    // Skip action-deck buttons — they use performAction() above
    if (el.getAttribute('data-action')) return;
    // Skip swing-trigger buttons — handled above
    if (el.hasAttribute('data-swing-trigger')) return;

    pet.reactToInteraction(el);
  }, true /* capture phase */);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
