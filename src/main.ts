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

  // Check URL query param ?debug=1 or ?debug=true
  const params = new URLSearchParams(window.location.search);
  if (params.get('debug') === '1' || params.get('debug') === 'true') {
    (window as any).SPIDEY_DEBUG = true;
  }

  const pet = new WebSlingerPet();
  (window as any).__pet = pet;

  // ── Action-deck buttons (data-action) ─────────────────────────
  document.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', () => {
      const action = (el as HTMLElement).getAttribute('data-action');
      if (!action) return;
      pet.performAction(action);
      // Also target Spider-Man to hang from the action card!
      pet.reactToInteraction(el as HTMLElement);
    });
  });

  // ── Legacy swing-trigger buttons ──────────────────────────────
  document.querySelectorAll('[data-swing-trigger]').forEach((el) => {
    el.addEventListener('click', () => {
      pet.reactToInteraction(el as HTMLElement);
    });
  });

  // ── Global capture-phase listener for surface-swing targeting ──
  const handleInteraction = (e: Event) => {
    const target = e.target as HTMLElement;
    if (!target || !target.closest) return;

    const el = target.closest(
      'button, a, [data-web-target], [data-spidey-target], [data-spidey-surface], .btn, .card, .action-card',
    ) as HTMLElement | null;

    if (!el) return;
    if (el.id === 'web-slinger-canvas') return;

    // Skip action-deck buttons here as they use explicit handler above
    if (el.getAttribute('data-action')) return;

    pet.reactToInteraction(el);
  };

  document.addEventListener('click', handleInteraction, true /* capture phase */);
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') {
      handleInteraction(e);
    }
  }, true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
