import { useRef, useCallback, useEffect, useState } from 'react';

export const SOUND_STORAGE_KEY = 'termliny-sound-enabled';
export const DEFAULT_SOUND_ENABLED = false;

function loadSoundPreference(): boolean {
  try {
    const saved = localStorage.getItem(SOUND_STORAGE_KEY);
    return saved === null ? DEFAULT_SOUND_ENABLED : saved === 'true';
  } catch {
    return DEFAULT_SOUND_ENABLED;
  }
}

const SOUNDS = {
  swap: '/sounds/swap.mp3',
  match: '/sounds/match.mp3',
  cascade: '/sounds/cascade.mp3',
  win: '/sounds/win.mp3',
} as const;

type SoundName = keyof typeof SOUNDS | 'tap';

export function useSound() {
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContext = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(loadSoundPreference);

  const playTap = useCallback(() => {
    const context = audioContext.current ?? new AudioContext();
    audioContext.current = context;
    if (context.state === 'suspended') void context.resume();

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(820, now);
    oscillator.frequency.exponentialRampToValueAtTime(460, now + 0.045);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.075, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.052);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.055);
  }, []);

  const play = useCallback((name: SoundName) => {
    if (!enabled) return;

    if (name === 'tap') {
      playTap();
      return;
    }

    const src = SOUNDS[name];
    let audio = audioCache.current.get(src);

    if (!audio) {
      audio = new Audio(src);
      audio.preload = 'auto';
      audioCache.current.set(src, audio);
    }

    audio.volume = name === 'swap' ? 0.82 : 0.96;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, [enabled, playTap]);

  useEffect(() => () => {
    for (const audio of audioCache.current.values()) audio.pause();
    if (audioContext.current) void audioContext.current.close();
  }, []);

  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, String(next));
    } catch {
      // Storage may be blocked; the preference still works for this session.
    }
    return next;
  }, [enabled]);

  return { play, toggle, enabled };
}
