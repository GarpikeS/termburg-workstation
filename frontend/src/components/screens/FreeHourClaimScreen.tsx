import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, CalendarClock, CheckCircle2, ShieldCheck, Ticket } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { useGameContext } from '@/store/GameContext';
import {
  RewardApiError,
  claimFreeHour,
  getFreeHourStatus,
} from '@/features/rewards/rewardApi';
import {
  FREE_HOUR_PRICE,
  FREE_HOUR_VALID_DAYS,
  activeFreeHourClaim,
  formatRewardDate,
  isRewardClaimRedeemed,
} from '@/features/rewards/rewardRules';
import type { RewardClaim } from '@/types/game';
import { getEntrySource } from '@/features/rewards/acquisition';

type City = 'Москва' | 'Зеленогорск';
type FieldName = 'name' | 'phone' | 'age' | 'city' | 'consent';

const fieldClass = 'reward-form__input';

export function FreeHourClaimScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { progress, completeRewardClaim, restoreRewardClaim } = useGameContext();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [city, setCity] = useState<City>('Москва');
  const [consent, setConsent] = useState(false);
  const [serverClaim, setServerClaim] = useState<RewardClaim | null>(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [fieldError, setFieldError] = useState<FieldName | null>(null);
  const localClaim = useMemo(() => activeFreeHourClaim(progress.rewardClaims), [progress.rewardClaims]);
  const claim = serverClaim ?? localClaim;
  const source = new URLSearchParams(location.search).get('source') || getEntrySource();

  useEffect(() => {
    const controller = new AbortController();
    getFreeHourStatus(controller.signal)
      .then(status => {
        if (status.claim) {
          setServerClaim(status.claim);
          restoreRewardClaim(status.claim);
        }
      })
      .catch(error => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setMessage(error instanceof Error ? error.message : 'Не удалось проверить награду.');
        }
      })
      .finally(() => setChecking(false));
    return () => controller.abort();
  }, [restoreRewardClaim]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setMessage('');
    setFieldError(null);

    if (progress.currency < FREE_HOUR_PRICE) {
      setMessage(`Не хватает ${FREE_HOUR_PRICE - progress.currency} термокоинов. Их можно заработать в играх.`);
      return;
    }
    if (!consent) {
      setFieldError('consent');
      setMessage('Отметьте отдельное согласие на обработку данных.');
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    setSubmitting(true);
    try {
      const nextClaim = await claimFreeHour({
        name,
        phone,
        age: Number(age),
        city,
        consent: true,
        balance: progress.currency,
        source,
      }, controller.signal);
      completeRewardClaim(nextClaim, FREE_HOUR_PRICE);
      setServerClaim(nextClaim);
      setMessage('Бесплатный час готов. Покажите код на кассе.');
    } catch (error) {
      if (error instanceof RewardApiError) {
        if (error.claim) {
          restoreRewardClaim(error.claim);
          setServerClaim(error.claim);
        }
        setFieldError((error.field as FieldName | undefined) ?? null);
        setMessage(error.message);
      } else {
        setMessage('Не удалось получить награду. Термокоины не списаны.');
      }
    } finally {
      window.clearTimeout(timeout);
      setSubmitting(false);
    }
  }

  return (
    <div className="reward-screen">
      <header className="screen-safe-header reward-screen__header">
        <button type="button" aria-label="Назад в магазин" onClick={() => navigate('/shop')} className="reward-screen__back">
          <ArrowLeft size={22} />
        </button>
        <div>
          <span>Награда Термбурга</span>
          <h1>Бесплатный час</h1>
        </div>
        <CurrencyDisplay amount={progress.currency} />
      </header>

      <main className="reward-screen__content phone-scroll">
        <section className="reward-rule-card" aria-labelledby="reward-rule-title">
          <CalendarClock size={28} aria-hidden="true" />
          <div>
            <h2 id="reward-rule-title">Обратите внимание</h2>
            <p>Час действует только <strong>{FREE_HOUR_VALID_DAYS} дней с момента получения</strong>.</p>
            <p>Новый бесплатный час можно получить только через неделю.</p>
          </div>
        </section>

        {checking ? (
          <div className="reward-status-card" role="status">Проверяем, доступна ли награда…</div>
        ) : claim ? (
          <section className="reward-success" aria-labelledby="reward-success-title">
            <CheckCircle2 size={42} aria-hidden="true" />
            <span>Награда в профиле</span>
            <h2 id="reward-success-title">{isRewardClaimRedeemed(claim) ? 'Код использован' : 'Ваш код'}</h2>
            <strong className="reward-success__code">{claim.code}</strong>
            {isRewardClaimRedeemed(claim) && claim.redeemedAt
              ? <p>Погашен <strong>{formatRewardDate(claim.redeemedAt)}</strong>.</p>
              : <p>Покажите его на кассе до <strong>{formatRewardDate(claim.expiresAt)}</strong>.</p>}
            <p>Следующий час будет доступен {formatRewardDate(claim.nextPurchaseAt)}.</p>
            <Button type="button" className="w-full" onClick={() => navigate('/profile')}>Открыть профиль</Button>
          </section>
        ) : (
          <form className="reward-form" onSubmit={handleSubmit} noValidate>
            <div className="reward-price-row">
              <Ticket size={30} aria-hidden="true" />
              <div>
                <span>Стоимость</span>
                <strong>{FREE_HOUR_PRICE} термокоинов</strong>
              </div>
            </div>

            <p className="reward-form__intro">Заполните анкету — по ней касса найдёт вашу награду. Анкету заполняет совершеннолетний гость.</p>

            <label className="reward-form__field">
              <span>Имя</span>
              <input className={fieldClass} name="name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} required minLength={2} aria-invalid={fieldError === 'name'} />
            </label>

            <label className="reward-form__field">
              <span>Телефон</span>
              <input className={fieldClass} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 999 000-00-00" value={phone} onChange={event => setPhone(event.target.value)} required aria-invalid={fieldError === 'phone'} />
            </label>

            <div className="reward-form__row">
              <label className="reward-form__field">
                <span>Возраст</span>
                <input className={fieldClass} name="age" type="number" inputMode="numeric" min={18} max={100} value={age} onChange={event => setAge(event.target.value)} required aria-invalid={fieldError === 'age'} />
              </label>
              <label className="reward-form__field">
                <span>Город</span>
                <select className={fieldClass} name="city" value={city} onChange={event => setCity(event.target.value as City)} aria-invalid={fieldError === 'city'}>
                  <option>Москва</option>
                  <option>Зеленогорск</option>
                </select>
              </label>
            </div>

            <label className={`reward-consent ${fieldError === 'consent' ? 'reward-consent--error' : ''}`}>
              <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} aria-invalid={fieldError === 'consent'} />
              <span>
                Я отдельно соглашаюсь на обработку имени, телефона, возраста и города для выдачи награды.{' '}
                <a href="https://termburg.ru/soglasie-na-obrabotku-personalnyh-dannyh" target="_blank" rel="noreferrer">Текст согласия</a>
                {' · '}
                <a href="https://termburg.ru/privacy/" target="_blank" rel="noreferrer">Политика</a>
              </span>
            </label>

            {message && <p className="reward-form__message" role="alert">{message}</p>}

            <Button type="submit" size="lg" className="w-full" aria-disabled={submitting} onClick={event => { if (submitting) event.preventDefault(); }}>
              {submitting ? 'Оформляем…' : `Получить за ${FREE_HOUR_PRICE}`}
            </Button>
            <p className="reward-form__privacy"><ShieldCheck size={15} aria-hidden="true" /> Код и срок сразу появятся в профиле.</p>
          </form>
        )}

        {message && claim && <p className="reward-screen__message" role="status">{message}</p>}
      </main>
    </div>
  );
}
