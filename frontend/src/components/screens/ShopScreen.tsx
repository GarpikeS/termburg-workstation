import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, CalendarClock, ShoppingBag, ShoppingCart, Sparkles, Ticket } from 'lucide-react';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { TermcoinMark } from '@/components/ui/TermcoinMark';
import { Button } from '@/components/ui/Button';
import { useGameContext } from '@/store/GameContext';
import { getProductById, getProductsByCategory, type Product } from '@/data/shopData';
import { activeFreeHourClaim, formatRewardDate, isRewardClaimRedeemed } from '@/features/rewards/rewardRules';
import { getFreeHourStatus } from '@/features/rewards/rewardApi';
import { cn } from '@/utils/cn';
import { GAME_NAMES } from '@/data/gameNames';

const tabs = [
  { key: 'tickets' as const, label: 'Билеты', icon: Ticket },
  { key: 'merch' as const, label: 'Мерч', icon: ShoppingBag },
  { key: 'boosters' as const, label: GAME_NAMES.match3, icon: Sparkles },
];

function CoinPrice({ price }: { price: number }) {
  const formattedPrice = price.toLocaleString('ru-RU');
  return (
    <span className="shop-coin-price" aria-label={`${formattedPrice} термокоинов`} data-termcoin-price={price}>
      <TermcoinMark className="termcoin-mark--compact" />
      <span>{formattedPrice} термокоинов</span>
    </span>
  );
}

export function ShopScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { progress, addToCart, buyWithCoins, restoreRewardClaim } = useGameContext();
  const requestedProduct = getProductById(searchParams.get('focus') ?? '');
  const focusedProductId = requestedProduct?.id;
  const focusedCategory = requestedProduct?.category;
  const [activeTab, setActiveTab] = useState<Product['category']>(() => focusedCategory ?? 'tickets');
  const [notice, setNotice] = useState('');
  const [serverRewardBlock, setServerRewardBlock] = useState<{ blocked: boolean; until: number | null }>({
    blocked: false,
    until: null,
  });

  const items = getProductsByCategory(activeTab);
  const cartCount = progress.cart.reduce((sum, item) => sum + item.quantity, 0);
  const activeReward = activeFreeHourClaim(
    progress.rewardClaims.filter(claim => claim.campaignId === undefined),
  );
  const activeCampaignCooldown = activeFreeHourClaim(
    progress.rewardClaims.filter(claim => claim.campaignId !== undefined),
  );
  const rewardBlocked = Boolean(activeCampaignCooldown) || serverRewardBlock.blocked;
  const rewardCooldownUntil = activeCampaignCooldown?.nextPurchaseAt ?? serverRewardBlock.until;

  useEffect(() => {
    const controller = new AbortController();
    getFreeHourStatus(controller.signal)
      .then(status => {
        if (status.claim) restoreRewardClaim(status.claim);
        setServerRewardBlock({
          blocked: !status.available && !status.claim,
          until: !status.available && !status.claim ? (status.nextPurchaseAt ?? null) : null,
        });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [restoreRewardClaim]);

  useEffect(() => {
    if (!focusedProductId || activeTab !== focusedCategory) return;

    const animationFrame = window.requestAnimationFrame(() => {
      const card = document.getElementById(`shop-product-${focusedProductId}`);
      if (!card) return;

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      card.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
      const action = card.querySelector<HTMLElement>('[data-shop-action]');
      (action ?? card).focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeTab, focusedCategory, focusedProductId]);

  const handleBuy = (product: Product) => {
    setNotice('');
    if (product.action === 'weekly-reward') {
      navigate('/shop/free-hour');
      return;
    }
    if (product.currency === 'coins') {
      if (progress.currency < product.price) {
        setNotice(`Не хватает ${product.price - progress.currency} термокоинов`);
        return;
      }
      buyWithCoins(product.id, product.price);
      setNotice(`Товар «${product.name}» добавлен в инвентарь`);
      return;
    }
    addToCart(product.id);
    setNotice(`${product.name} добавлена в корзину`);
  };

  return (
    <div className="h-full flex flex-col bg-dark-surface">
      <header className="screen-safe-header pb-4 px-5">
        <div className="flex items-center justify-between gap-2">
          <button type="button" aria-label="Назад к играм" onClick={() => navigate('/games')} className="min-w-11 min-h-11 flex items-center justify-center text-white/60 hover:text-primary transition-colors">
            <ArrowLeft size={21} />
          </button>
          <h1 className="font-heading text-base font-bold text-primary tracking-wider uppercase">Магазин</h1>
          <div className="flex items-center gap-1">
            <CurrencyDisplay amount={progress.currency} />
            <button type="button" aria-label={`Корзина, товаров: ${cartCount}`} onClick={() => navigate('/shop/cart')} className="relative min-w-11 min-h-11 flex items-center justify-center text-white/60 hover:text-primary transition-colors">
              <ShoppingCart size={21} />
              {cartCount > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>
      <div className="gold-separator" />

      <div className="min-h-8 px-5 pt-2" role="status" aria-live="polite">
        {notice && <p className="text-center text-sm text-primary leading-snug">{notice}</p>}
      </div>

      <nav className="px-5 py-3" aria-label="Разделы магазина">
        <div className="grid grid-cols-3 gap-2">
          {tabs.map(tab => (
            <button
              type="button"
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              aria-current={activeTab === tab.key ? 'page' : undefined}
              className={cn(
                'min-h-12 flex items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors',
                activeTab === tab.key
                  ? 'bg-primary/20 text-primary border border-primary/35'
                  : 'bg-white/5 text-white/60 border border-white/10',
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto phone-scroll px-5 py-2">
        {activeTab === 'boosters' && (
          <div className="mb-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
            <p className="font-heading text-sm font-bold text-primary">Бустеры для игры «{GAME_NAMES.match3}»</p>
            <p className="mt-1 text-xs leading-relaxed text-white/60">Это бустеры для игры «3 в ряд». После покупки они появятся под игровым полем.</p>
          </div>
        )}
        {activeTab === 'merch' ? (
          <div className="space-y-3">
            {items.map((item, index) => (
              <motion.article key={item.id} className="shop-merch-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
                <div className="shop-merch-card__image"><img src={item.image} alt={item.name} /></div>
                <div>
                  <h2>{item.name}</h2>
                  <p>{item.description}</p>
                  <strong><CoinPrice price={item.price} /></strong>
                  <Button size="sm" className="w-full mt-3" onClick={() => handleBuy(item)}>Купить</Button>
                  {(progress.inventory[item.id] ?? 0) > 0 && (
                    <p className="mt-2 text-xs text-success">В инвентаре: {progress.inventory[item.id]}</p>
                  )}
                </div>
              </motion.article>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              const isWeeklyReward = item.action === 'weekly-reward';
              const isFocused = item.id === focusedProductId;
              return (
                <motion.article
                  key={item.id}
                  id={`shop-product-${item.id}`}
                  className={cn(
                    'shop-product-card',
                    isWeeklyReward && 'shop-product-card--featured',
                    isFocused && 'shop-product-card--focused',
                  )}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  tabIndex={isFocused ? -1 : undefined}
                  data-shop-product={item.id}
                  data-shop-product-focused={isFocused ? 'true' : 'false'}
                >
                  <div className="shop-product-card__top">
                    <div className="shop-product-card__image"><img src={item.image} alt="" aria-hidden="true" /></div>
                    <div className="shop-product-card__copy">
                      <div className="shop-product-card__title-row">
                        <h2>{item.name}</h2>
                        {(item.gameLabel || item.badge) && <span>{item.gameLabel || item.badge}</span>}
                      </div>
                      <p>{item.description}</p>
                    </div>
                  </div>

                  {isWeeklyReward && (
                    <div className="shop-product-card__warning">
                      <CalendarClock size={20} aria-hidden="true" />
                      <p><strong>Сгорит через 7 дней.</strong> Следующий час можно получить только после этой недели.</p>
                    </div>
                  )}

                  {isWeeklyReward && activeReward ? (
                    <button type="button" className="shop-reward-active" onClick={() => navigate('/shop/free-hour')} data-shop-action={item.id}>
                      <span>Код {activeReward.code}</span>
                      <strong>{isRewardClaimRedeemed(activeReward)
                        ? `Использован · новый час после ${formatRewardDate(activeReward.nextPurchaseAt)}`
                        : `Действует до ${formatRewardDate(activeReward.expiresAt)}`}</strong>
                    </button>
                  ) : isWeeklyReward && rewardBlocked ? (
                    <button
                      type="button"
                      className="shop-reward-active"
                      onClick={() => navigate(activeCampaignCooldown ? '/profile' : '/shop/free-hour')}
                      data-shop-action={item.id}
                    >
                      <span>{activeCampaignCooldown ? 'Бесплатный час уже получен' : 'Бесплатный час пока недоступен'}</span>
                      <strong>
                        {activeCampaignCooldown ? 'Код находится в профиле' : 'Повторная выдача временно закрыта'}
                        {rewardCooldownUntil ? ` · новый час после ${formatRewardDate(rewardCooldownUntil)}` : ''}
                      </strong>
                    </button>
                  ) : (
                    <div className="shop-product-card__action">
                      <strong>{item.currency === 'rub' ? `${item.price} ₽` : <CoinPrice price={item.price} />}</strong>
                      <Button
                        size="sm"
                        onClick={() => handleBuy(item)}
                        aria-label={`${isWeeklyReward ? 'Получить' : 'Купить'} «${item.name}» за ${item.price.toLocaleString('ru-RU')} ${item.currency === 'rub' ? 'рублей' : 'термокоинов'}`}
                        data-shop-action={item.id}
                      >
                        {isWeeklyReward ? 'Получить' : 'Купить'}
                      </Button>
                    </div>
                  )}

                  {!isWeeklyReward && (progress.inventory[item.id] ?? 0) > 0 && (
                    <p className="mt-2 text-xs text-success">В инвентаре: {progress.inventory[item.id]}</p>
                  )}
                </motion.article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
