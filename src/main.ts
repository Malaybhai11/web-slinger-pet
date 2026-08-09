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
    });
  });

  // ── Legacy swing-trigger buttons ──────────────────────────────
  document.querySelectorAll('[data-swing-trigger]').forEach((el) => {
    el.addEventListener('click', () => pet.performAction('swing'));
  });

  // ── Global capture-phase listener for surface-swing targeting ──
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest?.(
      'button, a, [data-web-target], [data-spidey-target], [data-spidey-surface], .btn, .card, .action-card',
    ) as HTMLElement | null;

    if (!el) return;
    if (el.id === 'web-slinger-canvas') return;

    if (el.getAttribute('data-action')) return;
    if (el.hasAttribute('data-swing-trigger')) return;

    pet.reactToInteraction(el);
  }, true /* capture phase */);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
