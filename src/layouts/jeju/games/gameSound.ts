/**
 * The games' sound effects.
 *
 * ── Why this is synthesised and not a folder of mp3s ──────────────────
 * The kiosk ships no audio system at all — there is no player, no asset
 * pipeline for sound, and no volume policy. Rather than invent all three for
 * eight blips, every cue here is built from WebAudio oscillators at call time:
 * nothing to download, nothing to decode, nothing to preload, and no new bytes
 * in the installer. If a real audio system ever lands, replace the bodies below
 * and the games do not change — they only ever call sfx.catch() and friends.
 *
 * ── The rules this file exists to keep ────────────────────────────────
 *  1. Sound is decoration. Every game is fully playable and fully legible with
 *     the speakers dead or muted, which on a public kiosk is the normal case.
 *     Nothing here is ever awaited and nothing here can block a frame.
 *  2. It can never throw. A kiosk with no output device, a browser that refuses
 *     an AudioContext, a machine whose audio driver died at 3am — all of them
 *     take the same path as "sound is off". Hence the blanket try/catch and the
 *     null short-circuit; a game must not crash because of a beep.
 *  3. It must not leak. The kiosk runs for days. One shared context, and every
 *     node is short-lived, started and stopped in the same call, and disposed by
 *     the browser once it has finished — no node is ever retained here.
 *
 * ── Autoplay ──────────────────────────────────────────────────────────
 * Chromium starts an AudioContext 'suspended' until a user gesture. Every cue
 * calls resume() first, so the first sound after a tap works and any cue that
 * arrives before one is simply silent. The context is created lazily for the
 * same reason — building it at import time would just make a suspended one.
 */

/** Shared context. Null until first use. */
let ctx: AudioContext | null = null;
/** Latched once we know audio can never work, so we stop retrying per frame. */
let unavailable = false;
/** Master gain — one place to duck everything, and what silence() moves. */
let master: GainNode | null = null;
let muted = false;

/** Kiosk speakers are loud and the room is public; these are deliberately quiet. */
const MASTER_LEVEL = 0.22;

function audio(): AudioContext | null {
  if (unavailable) return null;
  if (ctx) return ctx;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      unavailable = true;
      return null;
    }
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_LEVEL;
    master.connect(ctx.destination);
    return ctx;
  } catch {
    // No output device, or the per-page context limit was hit. Sound is off for
    // good; do not retry on every catch, which would stall the game loop.
    unavailable = true;
    return null;
  }
}

/**
 * One enveloped oscillator. `delay` staggers the notes of a chord or arpeggio
 * without a timer — the scheduling is the audio clock's job, not JS's, so a
 * busy main thread cannot smear the arpeggio.
 */
function tone(opts: {
  freq: number;
  /** Slide to this frequency across the note. Omit for a flat tone. */
  toFreq?: number;
  duration: number;
  delay?: number;
  type?: OscillatorType;
  /** Peak of the envelope, relative to master. */
  gain?: number;
}): void {
  const c = audio();
  if (!c || !master) return;
  try {
    const t0 = c.currentTime + (opts.delay ?? 0);
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.toFreq !== undefined) {
      // Exponential, not linear: pitch is perceived logarithmically, so a linear
      // ramp reads as a lurch rather than a slide.
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.toFreq), t0 + opts.duration);
    }
    const peak = opts.gain ?? 0.5;
    // 8ms attack — long enough to kill the click of an instant start, short
    // enough that a catch still feels immediate.
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
    osc.connect(env);
    env.connect(master);
    osc.start(t0);
    osc.stop(t0 + opts.duration + 0.02);
  } catch {
    /* A cue that cannot play is not an error worth surfacing. */
  }
}

/** Short filtered noise — the cup shuffle's scrape, and the miss thud. */
function noise(opts: { duration: number; gain?: number; freq?: number }): void {
  const c = audio();
  if (!c || !master) return;
  try {
    const frames = Math.max(1, Math.floor(c.sampleRate * opts.duration));
    const buffer = c.createBuffer(1, frames, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      // Decay inside the buffer, so the tail is already shaped before the gain
      // envelope touches it — a raw burst reads as a click.
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = opts.freq ?? 1200;
    band.Q.value = 0.8;
    const env = c.createGain();
    env.gain.value = opts.gain ?? 0.25;
    src.connect(band);
    band.connect(env);
    env.connect(master);
    src.start();
  } catch {
    /* as above */
  }
}

/** Nudge the context awake. Safe on every cue; a no-op when already running. */
function wake(): void {
  const c = audio();
  if (!c || c.state !== 'suspended') return;
  void c.resume().catch(() => {
    /* Still no gesture, or the device is gone. Stay silent. */
  });
}

export const sfx = {
  /** Any large button. Deliberately the driest cue here. */
  tap(): void {
    wake();
    tone({ freq: 520, toFreq: 660, duration: 0.07, type: 'triangle', gain: 0.35 });
  },

  /** A normal tangerine lands in the basket. */
  catch(): void {
    wake();
    tone({ freq: 660, toFreq: 990, duration: 0.11, type: 'triangle', gain: 0.4 });
  },

  /** The golden one — a rising arpeggio on top of the catch, so it reads as "more". */
  golden(): void {
    wake();
    tone({ freq: 784, duration: 0.1, type: 'triangle', gain: 0.45 });
    tone({ freq: 1046, duration: 0.12, delay: 0.07, type: 'triangle', gain: 0.45 });
    tone({ freq: 1568, duration: 0.22, delay: 0.14, type: 'sine', gain: 0.35 });
  },

  /** A rock, a wrong tap, a missed cup. Low and short — never a buzzer. */
  miss(): void {
    wake();
    tone({ freq: 200, toFreq: 120, duration: 0.16, type: 'sine', gain: 0.32 });
    noise({ duration: 0.08, gain: 0.1, freq: 400 });
  },

  /** One tick of the 3·2·1. `final` is the "go". */
  countdown(final = false): void {
    wake();
    tone({
      freq: final ? 880 : 520,
      duration: final ? 0.26 : 0.1,
      type: 'triangle',
      gain: final ? 0.45 : 0.3,
    });
  },

  /** One cup passing another. Called per swap, so it must stay cheap. */
  shuffle(): void {
    wake();
    noise({ duration: 0.13, gain: 0.14, freq: 900 });
  },

  /** Right cup, or any "you did it" beat. */
  win(): void {
    wake();
    [523, 659, 784, 1046].forEach((freq, i) => {
      tone({ freq, duration: 0.3, delay: i * 0.09, type: 'triangle', gain: 0.4 });
    });
  },

  /** Wrong cup, time up. Falls, but lands major — "almost", not "no". */
  lose(): void {
    wake();
    tone({ freq: 440, duration: 0.2, type: 'sine', gain: 0.32 });
    tone({ freq: 349, duration: 0.32, delay: 0.13, type: 'sine', gain: 0.3 });
  },

  /** End of a run, on the way to the score card. */
  finish(): void {
    wake();
    [659, 784, 1046].forEach((freq, i) => {
      tone({ freq, duration: 0.34, delay: i * 0.11, type: 'triangle', gain: 0.38 });
    });
  },

  /**
   * Silence everything without tearing the context down.
   *
   * The host calls this on unmount: a cue scheduled a moment before the visitor
   * left would otherwise play over the photo result. Ducking the master is the
   * whole job — the nodes already stop themselves.
   */
  silence(): void {
    muted = true;
    if (master) master.gain.value = 0;
  },

  /** Undo {@link sfx.silence}. The host calls this when the game screen mounts. */
  unsilence(): void {
    muted = false;
    if (master) master.gain.value = MASTER_LEVEL;
  },
};
