import { useEffect, useState } from 'react';
import { Building2, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import '@/features/schedule/schedule.css';
import { ScheduleLoading, ScheduleWaves, TermburgScheduleMark } from '@/features/schedule/SchedulePrimitives';
import {
  loadScheduleAuthStatus,
  loginScheduleEditor,
  logoutScheduleEditor,
  setupScheduleAccess,
} from '@/features/schedule/scheduleRepository';
import type { ScheduleAuthStatus, ScheduleEditorUser } from '@/features/schedule/types';
import { ScheduleAdminScreen } from './ScheduleAdminScreen';

const ACCOUNT_LABELS: Record<ScheduleEditorUser['username'], string> = {
  moscow: 'Термбург Москва',
  zelenogorsk: 'Термбург Зеленогорск',
};

export function ScheduleAdminAccessScreen() {
  const [status, setStatus] = useState<ScheduleAuthStatus | null>(null);
  const [username, setUsername] = useState<ScheduleEditorUser['username']>('moscow');
  const [password, setPassword] = useState('');
  const [moscowPassword, setMoscowPassword] = useState('');
  const [moscowConfirm, setMoscowConfirm] = useState('');
  const [zelenogorskPassword, setZelenogorskPassword] = useState('');
  const [zelenogorskConfirm, setZelenogorskConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void loadScheduleAuthStatus()
      .then(setStatus)
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Не удалось проверить доступ.'));
    return () => controller.abort();
  }, []);

  if (!status && !error) return <ScheduleLoading />;

  if (status?.authenticated && status.user) {
    return <ScheduleAdminScreen
      session={status.user}
      onLogout={async () => {
        await logoutScheduleEditor();
        setPassword('');
        setStatus(current => current ? { ...current, authenticated: false, user: null } : current);
      }}
    />;
  }

  if (status?.disabled) {
    return <ScheduleAdminScreen session={{ username: 'moscow', locationId: '1' }} onLogout={() => undefined} />;
  }

  const setup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (moscowPassword !== moscowConfirm || zelenogorskPassword !== zelenogorskConfirm) {
      setError('Пароли и подтверждения должны совпадать.');
      return;
    }
    setBusy(true);
    try {
      await setupScheduleAccess({ moscowPassword, zelenogorskPassword });
      setMoscowPassword('');
      setMoscowConfirm('');
      setZelenogorskPassword('');
      setZelenogorskConfirm('');
      setStatus({ configured: true, authenticated: false, user: null });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось настроить доступ.');
    } finally {
      setBusy(false);
    }
  };

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await loginScheduleEditor({ username, password });
      setPassword('');
      setStatus({ configured: true, authenticated: true, user: result.user });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось войти.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="schedule-access">
      <section className="schedule-access__brand" aria-label="Термбург — редактор расписания">
        <TermburgScheduleMark />
        <div>
          <span>Управление расписанием</span>
          <h1>{status?.configured ? 'Вход в редактор' : 'Настройка доступа'}</h1>
          <p>{status?.configured
            ? 'Войдите под своим комплексом. Вы сможете менять только его расписание.'
            : 'Задайте отдельный пароль для Москвы и Зеленогорска. Логины уже созданы.'}</p>
        </div>
        <ScheduleWaves />
      </section>

      <section className="schedule-access__card">
        <div className="schedule-access__card-heading">
          <span><ShieldCheck size={24} /></span>
          <div>
            <small>{status?.configured ? 'Защищённый вход' : 'Первый запуск'}</small>
            <h2>{status?.configured ? 'Выберите комплекс' : 'Создайте два пароля'}</h2>
          </div>
        </div>

        {status?.configured ? (
          <form onSubmit={login} className="schedule-access__form">
            <fieldset className="schedule-access__accounts">
              <legend>Логин</legend>
              {(Object.keys(ACCOUNT_LABELS) as ScheduleEditorUser['username'][]).map(account => (
                <label key={account} className={username === account ? 'is-selected' : ''}>
                  <input type="radio" name="schedule-username" value={account} checked={username === account} onChange={() => setUsername(account)} />
                  <Building2 size={20} />
                  <span><strong>{ACCOUNT_LABELS[account]}</strong><small>Логин: {account}</small></span>
                </label>
              ))}
            </fieldset>
            <label className="schedule-access__field">
              <span>Пароль</span>
              <div><LockKeyhole size={19} /><input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required autoFocus /></div>
            </label>
            {error && <p className="schedule-access__error" role="alert">{error}</p>}
            <button type="submit" className="schedule-access__submit" disabled={busy || !password}><KeyRound size={19} />{busy ? 'Проверяем…' : 'Войти в редактор'}</button>
          </form>
        ) : (
          <form onSubmit={setup} className="schedule-access__form schedule-access__form--setup">
            <PasswordPair
              title="Термбург Москва"
              username="moscow"
              password={moscowPassword}
              confirmation={moscowConfirm}
              onPassword={setMoscowPassword}
              onConfirmation={setMoscowConfirm}
            />
            <PasswordPair
              title="Термбург Зеленогорск"
              username="zelenogorsk"
              password={zelenogorskPassword}
              confirmation={zelenogorskConfirm}
              onPassword={setZelenogorskPassword}
              onConfirmation={setZelenogorskConfirm}
            />
            <p className="schedule-access__hint">Не меньше 10 символов. Пароли хранятся только в защищённом виде и не показываются в программе.</p>
            {error && <p className="schedule-access__error" role="alert">{error}</p>}
            <button type="submit" className="schedule-access__submit" disabled={busy}><ShieldCheck size={19} />{busy ? 'Сохраняем…' : 'Сохранить доступ'}</button>
          </form>
        )}
      </section>
    </main>
  );
}

function PasswordPair({ title, username, password, confirmation, onPassword, onConfirmation }: {
  title: string;
  username: ScheduleEditorUser['username'];
  password: string;
  confirmation: string;
  onPassword: (value: string) => void;
  onConfirmation: (value: string) => void;
}) {
  return (
    <fieldset className="schedule-access__password-pair">
      <legend><Building2 size={18} /><span><strong>{title}</strong><small>Логин: {username}</small></span></legend>
      <label className="schedule-access__field"><span>Новый пароль</span><div><LockKeyhole size={18} /><input type="password" minLength={10} maxLength={128} value={password} onChange={event => onPassword(event.target.value)} autoComplete="new-password" required /></div></label>
      <label className="schedule-access__field"><span>Повторите пароль</span><div><LockKeyhole size={18} /><input type="password" minLength={10} maxLength={128} value={confirmation} onChange={event => onConfirmation(event.target.value)} autoComplete="new-password" required /></div></label>
    </fieldset>
  );
}
