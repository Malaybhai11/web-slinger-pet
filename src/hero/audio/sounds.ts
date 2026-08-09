/**
 * sounds.ts — Web Audio synth pool (PRD §10). No audio assets: every sound
 * is synthesized (noise bursts + oscillator envelopes) so the package stays
 * tiny and offline-friendly. Unlocks on the first user gesture.
 */

export class Sounds {
  private ctx: AudioContext | null = null;

  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      } catch {
        /* no audio support — silent hero */
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private osc(type: OscillatorType, f0: number, f1: number, dur: number, gain0: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(gain0, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, freq: number, gain0: number, sweepTo = 0): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, t);
    if (sweepTo > 0) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain0, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.ctx.destination);
    src.start(t);
  }

  thwip(): void { this.noise(0.15, 1900, 0.22, 480); }
  whiff(): void { this.noise(0.25, 1100, 0.12, 280); }
  thud(impact: number): void { this.osc('sine', 110, 45, 0.13, Math.min(0.35, 0.07 + impact / 3200)); }
  boing(): void { this.osc('triangle', 280, 560, 0.12, 0.16); }
  step(alt: boolean): void { this.osc('square', alt ? 190 : 160, alt ? 150 : 128, 0.045, 0.045); }
  pop(): void { this.osc('square', 720, 920, 0.06, 0.1); }
}
