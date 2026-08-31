/**
 * quips.ts — what he says, and when he shuts up.
 *
 * Lines are chosen from the actual page: he reads the element he is standing
 * on, so a button labelled "Sign up" gets a line about that button rather than
 * a generic one. A pet that comments on your page is charming; a pet that says
 * eight random things a minute is a browser extension you uninstall — so the
 * rate limiter here matters at least as much as the writing.
 */

export type Trigger =
  | 'greet' | 'land-button' | 'land-heading' | 'land-link' | 'land-input'
  | 'perch' | 'idle-long' | 'bored' | 'fast-scroll' | 'miss' | 'big-fall'
  | 'swing-start' | 'stuck' | 'clicked-near' | 'press' | 'flip';

export interface QuipContext {
  /** trimmed text of the element he's involved with, if any */
  label?: string;
  tag?: string;
}

/** `{label}` is replaced with the element's text; lines without it always work. */
const POOLS: Record<Trigger, string[]> = {
  greet: [
    'friendly neighbourhood freeloader',
    'nice DOM you got here',
    "i live here now",
    'do not adjust your screen',
  ],
  'land-button': [
    '"{label}"? bold claim',
    'nobody is clicking "{label}", chief',
    'this button holds my weight. ship it',
    '"{label}" needs a bigger tap target',
    'standing on "{label}" until someone clicks it',
  ],
  'land-heading': [
    '"{label}" — did you A/B test that?',
    'great h1. terrible rooftop',
    'i can see the whole fold from here',
    'nice title. slightly slippery',
  ],
  'land-link': [
    'where does "{label}" even go?',
    'this link is load-bearing now',
    'underlined? in this economy?',
  ],
  'land-input': [
    'i would not put my email in this',
    'no placeholder? brave',
    'is this thing validated',
  ],
  perch: [
    'good view of the conversion funnel',
    'just gonna sit here and judge the kerning',
    'the fold is a lie',
    'i have opinions about this layout',
  ],
  'idle-long': [
    'still here',
    'take your time',
    'is anyone driving',
    'i could be swinging right now',
    'my legs are asleep and i have four frames',
  ],
  bored: [
    'nothing to swing from. tragic',
    'this page needs more buttons',
    'walking it off',
  ],
  'fast-scroll': [
    'WHOA. easy',
    'slow down, i have no seatbelt',
    'that is a lot of viewport',
  ],
  miss: [
    'nothing to stick to',
    'that was a wall. metaphorically',
    'web fluid wasted on empty space',
  ],
  'big-fall': [
    'i meant to do that',
    'the floor is also load-bearing',
    'gravity: still undefeated',
    'ow. in a canvas kind of way',
  ],
  'swing-start': [
    'thwip',
    'out of the way',
    'this is the fun part',
  ],
  stuck: [
    'i think i am stuck in your grid',
    'z-index problems',
    'this element rejected me',
  ],
  'clicked-near': [
    'hey! watch the cursor',
    'that was close',
    'i am pointer-events none, not feelings none',
  ],
  press: [
    'someone had to press it',
    'pressing "{label}" for science',
    'nothing happened. classic',
  ],
  flip: [
    'stuck the landing',
    'ten out of ten',
    'do not try that on a real page',
  ],
};

/** Minimum gap between any two quips, seconds. */
const MIN_GAP = 6;
/** How many recent lines to refuse to repeat. */
const MEMORY = 8;

export class Quipper {
  private last = -Infinity;
  private recent: string[] = [];
  private now = 0;

  step(dt: number): void {
    this.now += dt;
  }

  /** Force the next quip to be allowed — used for deliberate one-offs. */
  reset(): void {
    this.last = -Infinity;
  }

  /**
   * Pick a line for `trigger`, or null if he should stay quiet.
   * `chance` lets ambient triggers fire only sometimes without the caller
   * having to roll its own dice.
   */
  pick(trigger: Trigger, ctx: QuipContext = {}, chance = 1): string | null {
    if (this.now - this.last < MIN_GAP) return null;
    if (chance < 1 && Math.random() > chance) return null;

    const pool = POOLS[trigger];
    if (!pool?.length) return null;

    const label = clean(ctx.label);
    // lines that need a label are only usable when we actually have one
    const usable = pool.filter((l) => (l.includes('{label}') ? !!label : true));
    const fresh = usable.filter((l) => !this.recent.includes(l));
    const from = fresh.length ? fresh : usable;
    if (!from.length) return null;

    const line = from[Math.floor(Math.random() * from.length)];
    this.recent.push(line);
    if (this.recent.length > MEMORY) this.recent.shift();
    this.last = this.now;

    return label ? line.replace('{label}', label) : line;
  }
}

/** Element text, tidied into something that fits in a bubble. */
function clean(text: string | undefined): string {
  if (!text) return '';
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t || t.length > 24) return t ? t.slice(0, 21).trimEnd() + '...' : '';
  return t;
}

/** Best-effort label for a surface element. */
export function labelOf(el: Element | null | undefined): string {
  if (!el) return '';
  const aria = el.getAttribute?.('aria-label');
  if (aria) return aria;
  if (el instanceof HTMLInputElement) return el.placeholder || el.value || el.type;
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Which land-* trigger suits the element he just landed on. */
export function landTrigger(tag: string): Trigger {
  switch (tag) {
    case 'BUTTON': return 'land-button';
    case 'A': return 'land-link';
    case 'INPUT':
    case 'TEXTAREA':
    case 'SELECT': return 'land-input';
    case 'H1': case 'H2': case 'H3': case 'H4': return 'land-heading';
    default: return 'perch';
  }
}
