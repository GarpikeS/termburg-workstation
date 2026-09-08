import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarClock, ChevronDown, Gift, Gamepad2, ShoppingBag, Users, User, type LucideIcon } from 'lucide-react';
import { TermcoinMark } from '@/components/ui/TermcoinMark';
import {
  FREE_HOUR_PRICE,
  FREE_HOUR_SHOP_PATH,
  activeFreeHourClaim,
  getFreeHourCoinGoal,
} from '@/features/rewards/rewardRules';
import { isBottomNavHidden, isGameplayRoute } from '@/components/ui/bottomNavRoutes';
import { cn } from '@/utils/cn';
import { useGameContext } from '@/store/GameContext';
import {
  FOUR_GAME_CHALLENGE_ID,
  FOUR_GAME_CHALLENGE_TARGET,
  getFourGameChallengeCount,
  isFourGameChallengeComplete,
} from '@/features/rewards/fourGameChallenge';

interface BottomNavTab {
  path: string;
  icon: LucideIcon;
  label: string;
  ariaLabel?: string;
  featured?: boolean;
  cartBadge?: boolean;
  wallet?: boolean;
}

const tabs: readonly BottomNavTab[] = [
  { path: '/games', icon: Gamepad2, label: 'Игры' },
  { path: '/bathhouses', icon: CalendarClock, label: 'Расписание', featured: true },
  { path: '/shop', icon: ShoppingBag, label: 'Магазин', cartBadge: true, wallet: true },
  { path: '/collection', icon: Users, label: 'Термлины' },
  { path: '/profile', icon: User, label: 'Профиль' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { progress } = useGameContext();

  if (isBottomNavHidden(location.pathname)) return null;

  const cartCount = progress.cart.reduce((s, c) => s + c.quantity, 0);
  const walletAmount = progress.currency.toLocaleString('ru-RU');
  const showFreeHourGoal = isGameplayRoute(location.pathname);
  const activeReward = activeFreeHourClaim(progress.rewardClaims);
  const campaignClaimed = progress.rewardClaims.some(claim => claim.campaignId === FOUR_GAME_CHALLENGE_ID);
  const challengeCount = getFourGameChallengeCount(progress.fourGameChallenge);
  const challengeComplete = isFourGameChallengeComplete(progress.fourGameChallenge);
  const earningGift = !campaignClaimed && !challengeComplete;
  const giftReady = !campaignClaimed && challengeComplete;
  const giftLevelsRemaining = Math.max(0, FOUR_GAME_CHALLENGE_TARGET - challengeCount);
  const coinGoal = getFreeHourCoinGoal(progress.currency);
  const goalState = activeReward
    ? 'claimed'
    : giftReady
      ? 'ready'
      : earningGift
        ? 'earning'
        : coinGoal.reached
          ? 'ready'
          : 'earning';
  const goalTarget = activeReward
    ? '/profile'
    : giftReady
      ? `/shop/free-hour?campaign=${FOUR_GAME_CHALLENGE_ID}`
      : earningGift
        ? '/games'
        : FREE_HOUR_SHOP_PATH;
  const goalAction = activeReward
    ? 'В профиль'
    : giftReady
      ? 'Получить'
      : earningGift
        ? 'К играм'
        : 'В магазин';
  const goalAria = activeReward
    ? 'Бесплатный час уже получен. Открыть его в профиле.'
    : giftReady
      ? 'Подарочный час открыт. Получить код без списания термокоинов.'
      : earningGift
        ? `До подарочного часа осталось пройти ${giftLevelsRemaining} из четырёх уровней. Термокоины не нужны.`
        : coinGoal.reached
          ? `Разовый подарок уже использован. Баланс ${walletAmount} термокоинов. Монет хватает на новый час за ${FREE_HOUR_PRICE} термокоинов. Проверить награду в магазине.`
          : `Разовый подарок уже использован. До нового часа осталось заработать ${coinGoal.remaining} термокоинов. Перейти в магазин.`;

  return (
    <nav aria-label="Нижняя навигация" className="bottom-nav bottom-nav--enter absolute bottom-0 left-0 right-0 bg-dark-surface border-t border-dark-border z-40">
      {showFreeHourGoal && (
        <button
          type="button"
          className={cn('bottom-nav__goal', `bottom-nav__goal--${goalState}`)}
          onClick={() => navigate(goalTarget)}
          aria-label={goalAria}
          title={goalAria}
          data-free-hour-goal
          data-free-hour-goal-state={goalState}
          data-free-hour-goal-kind={activeReward ? 'claimed' : giftReady ? 'gift-ready' : earningGift ? 'gift-progress' : 'repeat'}
          data-free-hour-goal-price={earningGift || giftReady ? 0 : FREE_HOUR_PRICE}
          data-free-hour-goal-remaining={earningGift ? giftLevelsRemaining : coinGoal.remaining}
        >
          <span className="bottom-nav__goal-copy">
            {activeReward ? (
              <strong>Бесплатный час уже получен</strong>
            ) : giftReady ? (
              <>
                <span className="bottom-nav__goal-text">Подарочный час открыт</span>
                <span className="bottom-nav__goal-coins">
                  <Gift size={15} aria-hidden="true" />
                  <strong>без монет</strong>
                </span>
              </>
            ) : earningGift ? (
              <>
                <span className="bottom-nav__goal-text bottom-nav__goal-text--wide">До подарочного часа осталось</span>
                <span className="bottom-nav__goal-text bottom-nav__goal-text--compact">До подарка осталось</span>
                <span className="bottom-nav__goal-coins">
                  <Gift size={15} aria-hidden="true" />
                  <strong>{giftLevelsRemaining} ур.</strong>
                </span>
              </>
            ) : (
              <>
                <span className="bottom-nav__goal-text bottom-nav__goal-text--wide">
                  {coinGoal.reached ? 'Монет хватает на бесплатный час' : 'До покупки бесплатного часа осталось'}
                </span>
                <span className="bottom-nav__goal-text bottom-nav__goal-text--compact">
                  {coinGoal.reached ? 'Бесплатный час доступен' : 'До бесплатного часа осталось'}
                </span>
                <span className="bottom-nav__goal-coins">
                  <TermcoinMark className="termcoin-mark--compact" />
                  <strong>{coinGoal.reached ? FREE_HOUR_PRICE : coinGoal.remaining}</strong>
                </span>
              </>
            )}
          </span>
          <span className="bottom-nav__goal-action">
            {goalAction}
            <ChevronDown size={13} strokeWidth={2.5} aria-hidden="true" />
          </span>
        </button>
      )}
      <div className="bottom-nav__items grid grid-cols-5 items-start">
        {tabs.map(tab => {
          const active = location.pathname === tab.path ||
            (tab.path === '/games' && location.pathname.startsWith('/games')) ||
            (tab.path === '/bathhouses' && location.pathname.startsWith('/bathhouses')) ||
            (tab.path === '/shop' && location.pathname.startsWith('/shop')) ||
            (tab.path === '/collection' && location.pathname.startsWith('/collection')) ||
            (tab.path === '/profile' && location.pathname.startsWith('/profile'));
          return (
            <button
              type="button"
              key={tab.path}
              onClick={() => navigate(tab.path === '/shop' && showFreeHourGoal ? FREE_HOUR_SHOP_PATH : tab.path)}
              aria-label={tab.wallet
                ? `${tab.ariaLabel ?? tab.label}. Баланс: ${walletAmount} термокоинов`
                : (tab.ariaLabel ?? tab.label)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'bottom-nav__item min-w-0 min-h-12 flex flex-col items-center justify-center gap-1 px-1 py-1 rounded-lg transition-colors relative',
                tab.featured && 'bottom-nav__item--featured',
                active ? 'text-primary' : tab.featured ? 'text-white/60 hover:text-primary' : 'text-white/50 hover:text-white/80',
              )}
            >
              <span className={cn('bottom-nav__icon relative flex items-center justify-center', tab.featured && 'bottom-nav__schedule-icon')}>
                <tab.icon size={20} strokeWidth={tab.featured ? 2.2 : 2} aria-hidden="true" />
                {tab.wallet && (
                  <span
                    className={cn(
                      'absolute -top-0.5 left-[calc(50%+2px)] max-w-[2.8rem] truncate rounded-full border px-1.5 py-0.5 text-[8px] font-extrabold leading-none tabular-nums shadow-sm',
                      progress.currency >= 50
                        ? 'border-emerald-300/50 bg-emerald-900/95 text-emerald-200'
                        : 'border-primary/45 bg-[#292235]/95 text-primary',
                    )}
                    data-global-wallet
                    title={`${walletAmount} термокоинов`}
                    aria-hidden="true"
                  >
                    {walletAmount}
                  </span>
                )}
                {tab.cartBadge && cartCount > 0 && (
                  <span className="absolute top-0 -left-2.5 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </span>
              <span className="whitespace-nowrap text-[10px] font-medium" data-bottom-nav-label>{tab.label}</span>
              {active && (
                <div className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full" data-bottom-nav-active-indicator />
              )}
            </button>
          );
        })}
      </div>
      <div className="gold-separator" />
    </nav>
  );
}
