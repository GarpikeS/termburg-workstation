import { useEffect, useState } from 'react';

type VisualViewportSize = {
  width: number;
  height: number;
};

function readViewportSize(): VisualViewportSize {
  const viewport = window.visualViewport;

  return {
    width: Math.round(viewport?.width ?? window.innerWidth),
    height: Math.round(viewport?.height ?? window.innerHeight),
  };
}

export function useVisualViewportSize() {
  const [size, setSize] = useState<VisualViewportSize>(readViewportSize);

  useEffect(() => {
    let frame = 0;
    const viewport = window.visualViewport;

    const syncSize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = readViewportSize();
        setSize(current => (
          current.width === next.width && current.height === next.height ? current : next
        ));
      });
    };

    window.addEventListener('resize', syncSize);
    viewport?.addEventListener('resize', syncSize);
    viewport?.addEventListener('scroll', syncSize);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', syncSize);
      viewport?.removeEventListener('resize', syncSize);
      viewport?.removeEventListener('scroll', syncSize);
    };
  }, []);

  return size;
}
