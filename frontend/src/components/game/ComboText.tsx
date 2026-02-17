import { useEffect, useState } from 'react';

interface ComboTextProps {
  combo: number;
  score: number;
}

interface FloatingText {
  id: number;
  text: string;
  key: number;
}

let floatId = 0;

export function ComboText({ combo, score }: ComboTextProps) {
  const [floats, setFloats] = useState<FloatingText[]>([]);

  useEffect(() => {
    if (combo > 0 && score > 0) {
      const id = ++floatId;
      const text = combo > 1 ? `+${score} x${combo}!` : `+${score}`;
      setFloats(prev => [...prev, { id, text, key: id }]);

      const timer = setTimeout(() => {
        setFloats(prev => prev.filter(f => f.id !== id));
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [combo, score]);

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {floats.map(f => (
        <div
          key={f.key}
          className="absolute text-primary font-heading text-2xl font-bold animate-float-up"
        >
          {f.text}
        </div>
      ))}
    </div>
  );
}
