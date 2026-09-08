import { ChevronUp, Gift, Trophy, Wallet, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import type { GameRewardSource } from '@/types/game';
import { FREE_HOUR_PRICE, getFreeHourCoinGoal } from '@/features/rewards/rewardRules';

interface ChallengeGoal {
  source: GameRewardSource;
  title: string;
  path: string;
}

const CHALLENGE_GOALS: readonly ChallengeGoal[] = [
  {
    source: 'game2048',
    title: 'Славич',
    path: '/games/2048',
  },
  {
    source: 'bubbles',
    title: 'Бирюльки',
    path: '/games/bubbles',
  },
  {
    source: 'pet',
    title: 'Пестун',
    path: '/games/pet',
  },
  {
    source: 'match3',
    title: 'Хоровод',
    path: '/games/match3',
  },
];

function normalizeContribution(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(4, Math.floor(numeric))) : 0;
}

function formatLevelContribution(value: number): string {
  if (value === 1) return '1 уровень';
  if (value >= 2 && value <= 4) return `${value} уровня`;
  return '0 уровней';
}

interface FourGamesChallengeCardProps {
  stageCounts: Readonly<Record<GameRewardSource, number>>;
  count: number;
  currency: number;
  complete: boolean;
  expanded: boolean;
  attention?: boolean;
  onExpand: () => void;
  onDismiss: () => void;
  onAction: (path: string) => void;
}

export function FourGamesChallengeCard({
  stageCounts,
  count,
  currency,
  complete,
  expanded,
  attention = false,
  onExpand,
  onDismiss,
  onAction,
}: FourGamesChallengeCardProps) {
  const compactRef = useRef<HTMLButtonElement>(null);
  const expandedRef = useRef<HTMLElement>(null);
  const wasExpandedRef = useRef(expanded);
  const safeCount = normalizeContribution(count);
  const coinGoal = getFreeHourCoinGoal(currency);
  const goalsWithContribution = CHALLENGE_GOALS.map(goal => ({
    ...goal,
    contribution: normalizeContribution(stageCounts[goal.source]),
  }));
  const preferredGoal = goalsWithContribution.reduce((preferred, goal) => (
    goal.contribution > preferred.contribution ? goal : preferred
  ));

  useEffect(() => {
    if (expanded) {
      expandedRef.current?.focus();
    } else if (wasExpandedRef.current) {
      compactRef.current?.focus();
    }
    wasExpandedRef.current = expanded;
  }, [expanded]);

  if (!expanded) {
    return (
      <button
        ref={compactRef}
        type="button"
        className="four-game-challenge four-game-challenge--compact"
        data-four-game-challenge
        data-four-game-challenge-state="compact"
        onClick={onExpand}
        aria-label={`${complete ? 'Открыть подарок' : 'Открыть задание на подарочный час'}. Пройдено ${safeCount} из 4 новых уровней`}
      >
        <Gift size={20} aria-hidden="true" />
        <span>Подарочный час</span>
        <strong data-four-game-progress>{safeCount}/4</strong>
        <ChevronUp size={18} aria-hidden="true" />
      </button>
    );
  }

  const title = complete ? 'Подарочный час открыт' : '1 час посещения — за 4 уровня';
  const description = complete
    ? '4 из 4 новых уровней пройдено. Термокоины не спишутся.'
    : 'Пройди любые 4 новых уровня: все четыре в любимой игре, по одному в каждой или в любой комбинации. Термокоины за подарок не списываются.';
  const actionPath = complete ? '/shop/free-hour?campaign=four-games-v1' : preferredGoal.path;
  const actionLabel = complete
    ? 'Получить подарочный час'
    : safeCount === 0
      ? 'Начать со Славича'
      : `Продолжить: ${preferredGoal.title}`;

  return (
    <aside
      ref={expandedRef}
      tabIndex={-1}
      className={`four-game-challenge four-game-challenge--expanded${attention ? ' four-game-challenge--attention' : ''}${complete ? ' four-game-challenge--complete' : ''}`}
      data-four-game-challenge
      data-four-game-challenge-state={complete ? 'complete' : 'intro'}
      aria-labelledby="four-game-challenge-title"
      aria-describedby="four-game-challenge-description"
    >
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {complete
          ? 'Задание выполнено. Подарочный час открыт.'
          : `Новое задание на подарочный час. Пройдено ${safeCount} из 4 новых уровней. Уровни можно проходить в одной игре или в разных.`}
      </p>

      <header className="four-game-challenge__header">
        <span className="four-game-challenge__hero-icon" aria-hidden="true">
          {complete ? <Trophy size={25} /> : <Gift size={25} />}
        </span>
        <div>
          <span className="four-game-challenge__eyebrow">Первый час — разовый подарок</span>
          <h2 id="four-game-challenge-title">{title}</h2>
        </div>
        <button
          type="button"
          className="four-game-challenge__dismiss"
          data-four-game-dismiss
          onClick={onDismiss}
          aria-label="Свернуть задание"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <p id="four-game-challenge-description" className="four-game-challenge__description">
        {description}
      </p>

      <div className="four-game-challenge__progress-copy">
        <span>Пройдено новых уровней</span>
        <strong data-four-game-progress>{safeCount} из 4</strong>
      </div>
      <div
        className="four-game-challenge__progress-track"
        role="progressbar"
        aria-label="Прогресс подарка: пройдено новых уровней"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={safeCount}
      >
        <span style={{ width: `${safeCount * 25}%` }} />
      </div>

      <ul className="four-game-challenge__goals" aria-label="Вклад игр в четыре уровня">
        {goalsWithContribution.map(goal => (
          <li
            key={goal.source}
            className={goal.contribution > 0 ? 'has-progress' : undefined}
            data-four-game-source={goal.source}
            data-four-game-source-count={goal.contribution}
          >
            <span className="four-game-challenge__goal-copy">
              <strong>{goal.title}</strong>
            </span>
            <span className="four-game-challenge__goal-contribution">
              {formatLevelContribution(goal.contribution)}
            </span>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        className="four-game-challenge__action w-full"
        data-four-game-start
        onClick={() => onAction(actionPath)}
      >
        {actionLabel}
      </Button>

      <div
        className="four-game-challenge__repeat-note"
        data-wallet-goal
        aria-label={`Термокоины к текущему подарку не относятся. После подарка новые часы можно получать по ${FREE_HOUR_PRICE} термокоинов, не чаще одного раза в 7 дней. Баланс ${coinGoal.currency} термокоинов. ${coinGoal.reached ? 'Нужная сумма уже накоплена.' : `Осталось накопить ${coinGoal.remaining} термокоинов.`}`}
      >
        <Wallet size={18} aria-hidden="true" />
        <span>
          <strong>После подарка</strong>
          <small>К этому подарку монеты не относятся. Новые часы — по {FREE_HOUR_PRICE} термокоинов, не чаще раза в 7 дней.</small>
          <span className="four-game-challenge__repeat-balance">
            Баланс: {coinGoal.currency.toLocaleString('ru-RU')} · {coinGoal.reached
              ? 'суммы уже хватает'
              : `осталось накопить: ${coinGoal.remaining.toLocaleString('ru-RU')}`}
          </span>
        </span>
      </div>
    </aside>
  );
}
