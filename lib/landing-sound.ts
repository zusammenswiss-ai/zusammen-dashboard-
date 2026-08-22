"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "zusammen-landing-sound";

// A single shared AudioContext, created lazily on first real playback (never
// at import/mount time) — browsers refuse to start an AudioContext outside
// a user gesture, and the calls into this module only ever happen from
// inside a tap/drag handler anyway, so this naturally satisfies that.
let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext })
    .webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx) {
    try {
      sharedCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (sharedCtx.state === "suspended") void sharedCtx.resume();
  return sharedCtx;
}

// Every "card sound" here is synthesized on the fly with the Web Audio API
// — filtered white noise with a fast decay — rather than an external audio
// file. That keeps the whole thing dependency-free and licensing-free; it
// reads as a soft paper/felt tap rather than a literal recording. Swap this
// for real recorded clips later by replacing playNoiseBurst's body with an
// <audio>/AudioBufferSourceNode fed from a fetched file, if desired.
function playNoiseBurst(ctx: AudioContext, { duration, freq, gain }: { duration: number; freq: number; gain: number }) {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const decay = 1 - i / bufferSize;
    data[i] = (Math.random() * 2 - 1) * decay * decay;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = freq;
  bandpass.Q.value = 0.9;

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(gain, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  source.connect(bandpass);
  bandpass.connect(gainNode);
  gainNode.connect(ctx.destination);
  source.start();
  source.stop(ctx.currentTime + duration);
}

/**
 * Sound for the /landing card interactions (hero card + demo deck). Off by
 * default — the visitor has to opt in via the toggle — and every playback
 * call is a no-op unless `enabled` is true, so nothing ever plays without
 * both an explicit opt-in *and* a direct interaction (drag/flip) to trigger
 * it. Preference persists per-browser via localStorage.
 */
export function useLandingSound() {
  const [enabled, setEnabled] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      hydrated.current = window.localStorage.getItem(STORAGE_KEY) === "on";
    } catch {
      hydrated.current = false;
    }
    setEnabled(hydrated.current);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
      } catch {
        // ignore — sound preference just won't persist this session
      }
      return next;
    });
  }, []);

  // A light "pickup" tick — played when a card interaction starts (grabbed
  // to drag, or first touched).
  const playTap = useCallback(() => {
    if (!enabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    playNoiseBurst(ctx, { duration: 0.08, freq: 2600, gain: 0.035 });
  }, [enabled]);

  // A softer, longer "page turn" — played when a card actually flips.
  const playFlip = useCallback(() => {
    if (!enabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    playNoiseBurst(ctx, { duration: 0.2, freq: 1300, gain: 0.05 });
  }, [enabled]);

  return { enabled, toggle, playTap, playFlip };
}
