import { Cloud, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/account/AuthContext';

export function PlayerStatusButton() {
  const navigate = useNavigate();
  const { status, session, syncState } = useAuth();
  const authenticated = status === 'authenticated' && Boolean(session);
  const label = authenticated ? session?.account.name.split(/\s+/)[0] : status === 'loading' ? 'Проверяем' : 'Вход';

  return (
    <button
      type="button"
      className="game-hub__profile flex min-h-11 items-center gap-2 rounded-2xl border border-primary/30 bg-black/55 py-1.5 pl-1.5 pr-3 text-left shadow-lg backdrop-blur-sm"
      onClick={() => navigate(authenticated ? '/profile' : '/account')}
      aria-label={authenticated ? `Открыть профиль ${session?.account.name}` : 'Вход в личный кабинет или регистрация'}
      data-player-status
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <UserRound size={18} aria-hidden="true" />
      </span>
      <span className="max-w-[76px] truncate text-[11px] font-bold text-white/90">{label}</span>
      {authenticated && (
        <Cloud
          size={13}
          aria-hidden="true"
          className={syncState === 'error' ? 'text-red-300' : syncState === 'saving' ? 'animate-pulse text-primary' : 'text-green-400'}
        />
      )}
    </button>
  );
}
