import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate('/menu'), 2000);
    return () => clearTimeout(timer);
  }, [navigate]);

  const handleTap = () => navigate('/menu');

  return (
    <div
      className="h-full flex flex-col items-center justify-center bg-game-bg cursor-pointer"
      onClick={handleTap}
    >
      <div className="space-y-4 text-center animate-pulse">
        <h1 className="font-heading text-5xl text-primary tracking-wide">
          Термлины
        </h1>
        <p className="text-white/40 text-sm">Match-3 игра</p>
      </div>
      <p className="absolute bottom-8 text-white/20 text-xs">Нажми для продолжения</p>
    </div>
  );
}
