import { useRef, useCallback } from 'react';

const SOUNDS = {
  swap: '/sounds/swap.mp3',
  match: '/sounds/match.mp3',
  cascade: '/sounds/cascade.mp3',
  win: '/sounds/win.mp3',
} as const;

type SoundName = keyof typeof SOUNDS;

export function useSound() {
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const enabled = useRef(true);

  const play = useCallback((name: SoundName) => {
    if (!enabled.current) return;

    const src = SOUNDS[name];
    let audio = audioCache.current.get(src);

    if (!audio) {
      audio = new Audio(src);
      audioCache.current.set(src, audio);
    }

    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    enabled.current = !enabled.current;
    return enabled.current;
  }, []);

  return { play, toggle, isEnabled: () => enabled.current };
}
