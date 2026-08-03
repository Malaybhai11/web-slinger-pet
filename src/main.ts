/**
 * main.ts — boot the pet. One import, one canvas, instant companion.
 */

import { WebSlingerPet } from './spidey.js';

function boot(): void {
  // don't stack pets on hot reloads / double inits
  if (document.getElementById('web-slinger-canvas')) return;
  const pet = new WebSlingerPet();
  // expose for console tinkering & QA hooks
  (window as any).__pet = pet;

  // optional demo trigger: <button data-swing-trigger> makes it swing on click
  document.querySelectorAll('[data-swing-trigger]').forEach((el) => {
    el.addEventListener('click', () => pet.swing());
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
