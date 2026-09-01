import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bug,
  CheckCircle2,
  Heart,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  Palette,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  FeedbackApiError,
  submitFeedback,
  type FeedbackCategory,
} from '@/features/feedback/feedbackApi';
import { cn } from '@/utils/cn';

const categories = [
  { value: 'bug', label: 'Ошибка', hint: 'Что-то не работает', icon: Bug },
  { value: 'idea', label: 'Идея', hint: 'Что можно добавить', icon: Lightbulb },
  { value: 'visual', label: 'Внешний вид', hint: 'Графика или текст', icon: Palette },
  { value: 'other', label: 'Другое', hint: 'Любой вопрос', icon: MessageCircle },
] satisfies Array<{
  value: FeedbackCategory;
  label: string;
  hint: string;
  icon: typeof Bug;
}>;

type FieldErrors = Partial<Record<'category' | 'message', string>>;

export function FeedbackScreen() {
  const navigate = useNavigate();
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const categoryRef = useRef<HTMLFieldSetElement>(null);
  const [category, setCategory] = useState<FeedbackCategory | ''>('');
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  function resetForm() {
    setCategory('');
    setRating(null);
    setMessage('');
    setContact('');
    setWebsite('');
    setErrors({});
    setStatus('idle');
    setStatusMessage('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;

    const nextErrors: FieldErrors = {};
    if (!category) nextErrors.category = 'Выберите тип обращения.';
    if (message.trim().length < 10) nextErrors.message = 'Напишите хотя бы 10 символов.';
    setErrors(nextErrors);
    setStatusMessage('');

    if (Object.keys(nextErrors).length > 0) {
      setStatus('error');
      if (nextErrors.category) {
        categoryRef.current?.focus();
      } else {
        messageRef.current?.focus();
      }
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    setStatus('sending');

    try {
      await submitFeedback({
        category: category as FeedbackCategory,
        rating,
        message: message.trim(),
        contact: contact.trim(),
        website,
        page: window.location.pathname,
      }, controller.signal);
      setStatus('success');
      setStatusMessage('Спасибо! Сообщение отправлено.');
    } catch (error) {
      const apiError = error instanceof FeedbackApiError
        ? error
        : new FeedbackApiError('Не удалось отправить сообщение. Попробуйте ещё раз.');
      setStatus('error');
      setStatusMessage(apiError.message);
      if (apiError.field === 'category') {
        setErrors({ category: apiError.message });
        categoryRef.current?.focus();
      } else if (apiError.field === 'message') {
        setErrors({ message: apiError.message });
        messageRef.current?.focus();
      }
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return (
    <div className="h-full flex flex-col bg-dark-surface">
      <header className="screen-safe-header pb-4 px-4">
        <div className="grid grid-cols-[44px_1fr_44px] items-center">
          <button
            type="button"
            aria-label="Вернуться в профиль"
            onClick={() => navigate('/profile')}
            className="min-w-11 min-h-11 flex items-center justify-center text-white/65 hover:text-primary transition-colors"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="font-heading text-sm font-bold text-primary tracking-wider uppercase text-center">
            Обратная связь
          </h1>
          <div aria-hidden="true" />
        </div>
      </header>
      <div className="gold-separator" />

      <div className="flex-1 overflow-y-auto phone-scroll px-5 pt-5 pb-7">
        {status === 'success' ? (
          <section
            className="min-h-full flex flex-col items-center justify-center text-center py-8"
            aria-live="polite"
            data-feedback-success
          >
            <div className="w-20 h-20 rounded-full bg-[#5DB879]/15 border border-[#5DB879]/35 flex items-center justify-center shadow-[0_0_30px_rgba(93,184,121,0.12)]">
              <CheckCircle2 size={38} className="text-[#76D494]" />
            </div>
            <h2 className="font-heading text-xl text-white mt-5">Спасибо!</h2>
            <p className="text-white/65 text-sm leading-relaxed mt-2 max-w-[280px]">
              Сообщение отправлено. Мы прочитаем его и учтём в следующих обновлениях.
            </p>
            <div className="w-full space-y-3 mt-8">
              <Button type="button" className="w-full" onClick={() => navigate('/profile')}>
                Вернуться в профиль
              </Button>
              <Button type="button" variant="secondary" className="w-full" onClick={resetForm}>
                Отправить ещё
              </Button>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-white/[0.03] p-4 mb-5">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 shrink-0 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Heart size={21} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-heading text-base text-white">Помогите улучшить Термбург</h2>
                  <p className="text-white/55 text-xs leading-relaxed mt-1">
                    Расскажите об ошибке или предложите идею. Чем подробнее описание, тем быстрее мы разберёмся.
                  </p>
                </div>
              </div>
            </section>

            <form onSubmit={handleSubmit} noValidate data-feedback-form>
              <fieldset
                ref={categoryRef}
                tabIndex={-1}
                aria-describedby={errors.category ? 'feedback-category-error' : undefined}
                className="mb-5 focus:outline-none"
              >
                <legend className="text-sm font-semibold text-white mb-2">
                  Тема <span className="text-[#E87C7C]" aria-hidden="true">*</span>
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map(item => {
                    const selected = category === item.value;
                    return (
                      <label
                        key={item.value}
                        className={cn(
                          'min-h-[72px] rounded-xl border px-3 py-2.5 flex items-center gap-2.5 cursor-pointer transition-colors',
                          selected
                            ? 'border-primary bg-primary/15 text-primary'
                            : 'border-white/10 bg-white/[0.04] text-white/75 hover:border-white/20',
                        )}
                      >
                        <input
                          type="radio"
                          name="feedback-category"
                          value={item.value}
                          checked={selected}
                          onChange={() => {
                            setCategory(item.value);
                            setErrors(current => ({ ...current, category: undefined }));
                          }}
                          className="sr-only"
                        />
                        <item.icon size={20} className="shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold leading-tight">{item.label}</span>
                          <span className="block text-[10px] text-white/40 mt-0.5 leading-tight">{item.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {errors.category && (
                  <p id="feedback-category-error" role="alert" className="text-[#F29A9A] text-xs mt-2">
                    {errors.category}
                  </p>
                )}
              </fieldset>

              <fieldset className="mb-5">
                <legend className="text-sm font-semibold text-white mb-2">
                  Оценка <span className="text-white/35 font-normal">— необязательно</span>
                </legend>
                <div className="grid grid-cols-5 gap-2" aria-label="Оценка от 1 до 5">
                  {[1, 2, 3, 4, 5].map(value => (
                    <label
                      key={value}
                      className={cn(
                        'min-h-11 rounded-xl border flex items-center justify-center cursor-pointer transition-colors',
                        rating !== null && value <= rating
                          ? 'border-[#E87CA0]/50 bg-[#E87CA0]/15 text-[#F29BB8]'
                          : 'border-white/10 bg-white/[0.04] text-white/30',
                      )}
                    >
                      <input
                        type="radio"
                        name="feedback-rating"
                        value={value}
                        checked={rating === value}
                        onChange={() => setRating(value)}
                        className="sr-only"
                      />
                      <Heart size={19} fill={rating !== null && value <= rating ? 'currentColor' : 'none'} />
                      <span className="sr-only">{value} из 5</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label htmlFor="feedback-message" className="block text-sm font-semibold text-white mb-2">
                Сообщение <span className="text-[#E87C7C]" aria-hidden="true">*</span>
              </label>
              <textarea
                ref={messageRef}
                id="feedback-message"
                value={message}
                onChange={event => {
                  setMessage(event.target.value);
                  if (event.target.value.trim().length >= 10) {
                    setErrors(current => ({ ...current, message: undefined }));
                  }
                }}
                maxLength={1500}
                rows={6}
                placeholder="Например: на третьем уровне после комбо фишка исчезает без анимации…"
                aria-invalid={Boolean(errors.message)}
                aria-describedby="feedback-message-help feedback-message-count"
                className={cn(
                  'w-full resize-none rounded-xl border bg-white/[0.04] px-3.5 py-3 text-base text-white placeholder:text-white/25 focus:outline-none focus:border-primary/70',
                  errors.message ? 'border-[#E87C7C]/70' : 'border-white/10',
                )}
              />
              <div className="flex justify-between gap-3 mt-1.5 mb-5">
                <p id="feedback-message-help" className={cn('text-xs', errors.message ? 'text-[#F29A9A]' : 'text-white/35')} role={errors.message ? 'alert' : undefined}>
                  {errors.message || 'Минимум 10 символов'}
                </p>
                <span id="feedback-message-count" className="text-white/30 text-xs tabular-nums">
                  {message.length}/1500
                </span>
              </div>

              <label htmlFor="feedback-contact" className="block text-sm font-semibold text-white mb-2">
                Контакт <span className="text-white/35 font-normal">— необязательно</span>
              </label>
              <input
                id="feedback-contact"
                type="text"
                value={contact}
                onChange={event => setContact(event.target.value)}
                maxLength={120}
                autoComplete="email"
                placeholder="Телефон, почта или Telegram"
                className="w-full min-h-12 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-base text-white placeholder:text-white/25 focus:outline-none focus:border-primary/70 mb-5"
              />

              <div className="absolute -left-[9999px] top-auto w-px h-px overflow-hidden" aria-hidden="true">
                <label htmlFor="feedback-website">Сайт</label>
                <input
                  id="feedback-website"
                  type="text"
                  value={website}
                  onChange={event => setWebsite(event.target.value)}
                  autoComplete="off"
                  tabIndex={-1}
                />
              </div>

              {statusMessage && status === 'error' && (
                <div className="rounded-xl border border-[#E87C7C]/30 bg-[#E87C7C]/10 px-3.5 py-3 text-sm text-[#F5B0B0] mb-4" role="alert" data-feedback-error>
                  {statusMessage}
                </div>
              )}

              <Button type="submit" className="w-full gap-2" disabled={status === 'sending'} data-feedback-submit>
                {status === 'sending' ? (
                  <><LoaderCircle size={19} className="animate-spin" />Отправляем…</>
                ) : (
                  <><Send size={18} />Отправить сообщение</>
                )}
              </Button>
              <p className="text-white/30 text-[11px] leading-relaxed text-center mt-3 px-3">
                Отправляя форму, вы соглашаетесь на обработку указанного вами контакта для ответа на обращение.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
