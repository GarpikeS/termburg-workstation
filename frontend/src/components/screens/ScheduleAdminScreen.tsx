import { useEffect, useMemo, useState } from 'react';
import '@/features/schedule/schedule.css';
import { Building2, CalendarPlus, CalendarX2, Check, Copy, Download, ExternalLink, FileText, LogOut, MonitorUp, Pencil, Plus, RefreshCcw, Save, Send, Settings2, ShieldCheck, Sparkles, Trash2, Wifi, WifiOff, X } from 'lucide-react';
import { ScheduleError, ScheduleLoading, TermburgScheduleMark } from '@/features/schedule/SchedulePrimitives';
import { MonthlyPosterStudio } from '@/features/schedule/MonthlyPosterStudio';
import { DAY_LABELS, DAY_LABELS_SHORT, timeToMinutes } from '@/features/schedule/scheduleTime';
import { useSchedule } from '@/features/schedule/useSchedule';
import { loadSiteSyncSettings, publishScheduleToSite, saveSiteSyncSettings } from '@/features/schedule/scheduleRepository';
import type { ScheduleData, ScheduleEditorUser, ScheduleEvent, ScheduleException, SchedulePriceKind, SiteSyncSettings } from '@/features/schedule/types';

type EditorTab = 'weekly' | 'exceptions' | 'poster';

interface EditorForm {
  id: string;
  time: string;
  endTime: string;
  title: string;
  venue: string;
  details: string;
  priceKind: SchedulePriceKind;
  price: string;
  published: boolean;
  daysOfWeek: number[];
  date: string;
  highlight: boolean;
  sanitaryDay: boolean;
}

interface ScheduleServerInfo {
  port: number;
  baseUrls: string[];
  writeMode: 'local-only' | 'lan' | 'token' | 'login';
}

const emptyForm: EditorForm = {
  id: '',
  time: '12:00',
  endTime: '12:30',
  title: '',
  venue: '',
  details: '',
  priceKind: 'free',
  price: '',
  published: true,
  daysOfWeek: [1],
  date: new Date().toISOString().slice(0, 10),
  highlight: false,
  sanitaryDay: false,
};

export function ScheduleAdminScreen({ session, onLogout }: { session: ScheduleEditorUser; onLogout: () => Promise<void> | void }) {
  const { data, source, error, refresh, save } = useSchedule(30000);
  const [draft, setDraft] = useState<ScheduleData | null>(null);
  const [tab, setTab] = useState<EditorTab>('weekly');
  const locationId = session.locationId;
  const isTestSession = session.isTest === true || locationId === 'test';
  const [form, setForm] = useState<EditorForm>(emptyForm);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [serverInfo, setServerInfo] = useState<ScheduleServerInfo | null>(null);
  const [siteSettings, setSiteSettings] = useState<SiteSyncSettings | null>(null);
  const [siteEndpoint, setSiteEndpoint] = useState('');
  const [siteAuthMode, setSiteAuthMode] = useState<'bearer' | 'x-api-key'>('bearer');
  const [siteComplexCode, setSiteComplexCode] = useState('');
  const [siteToken, setSiteToken] = useState('');
  const [siteBusy, setSiteBusy] = useState(false);

  useEffect(() => {
    if (data && !draft) {
      const initialize = window.setTimeout(() => {
        setDraft(structuredClone(data));
      }, 0);
      return () => window.clearTimeout(initialize);
    }
  }, [data, draft]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/info', { signal: controller.signal })
      .then(response => response.ok ? response.json() as Promise<ScheduleServerInfo> : Promise.reject(new Error('Server info unavailable')))
      .then(setServerInfo)
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setServerInfo(null);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (isTestSession) return;
    let cancelled = false;
    void loadSiteSyncSettings(locationId)
      .then(settings => {
        if (cancelled) return;
        setSiteSettings(settings);
        setSiteEndpoint(settings.endpoint);
        setSiteAuthMode(settings.authMode);
        setSiteComplexCode(settings.complexCode);
        setSiteToken('');
      })
      .catch(reason => {
        if (cancelled) return;
        setSiteSettings(null);
        setNotice({ tone: 'error', text: reason instanceof Error ? reason.message : 'Не удалось загрузить настройки сайта.' });
      });
    return () => { cancelled = true; };
  }, [isTestSession, locationId]);

  const visibleWeekly = useMemo(() => (draft?.weeklyEvents ?? [])
    .filter(item => item.locationId === locationId)
    .sort((a, b) => (Math.min(...a.daysOfWeek) - Math.min(...b.daysOfWeek)) || timeToMinutes(a.time) - timeToMinutes(b.time)), [draft, locationId]);
  const visibleExceptions = useMemo(() => (draft?.exceptions ?? [])
    .filter(item => item.locationId === locationId)
    .sort((a, b) => a.date.localeCompare(b.date) || timeToMinutes(a.time) - timeToMinutes(b.time)), [draft, locationId]);
  const tvUrls = useMemo(() => {
    if (isTestSession) return { editor: '', landscape: '', portrait: '' };
    const bases = serverInfo?.baseUrls ?? [];
    const lanBase = bases.find(item => {
      try {
        const host = new URL(item).hostname;
        return host !== 'localhost' && host !== '127.0.0.1';
      } catch {
        return false;
      }
    }) ?? bases[0];
    return {
      editor: lanBase ? `${lanBase}/schedule/admin` : '',
      landscape: lanBase ? `${lanBase}/schedule/screen/${locationId}/landscape` : '',
      portrait: lanBase ? `${lanBase}/schedule/screen/${locationId}/portrait` : '',
    };
  }, [isTestSession, serverInfo, locationId]);

  if (error && !data) return <ScheduleError message={error} />;
  if (!draft) return <ScheduleLoading />;
  const activeLocation = draft.locations.find(item => item.id === locationId) ?? (isTestSession ? {
    id: 'test',
    city: 'Тестовый режим',
    name: 'Тестовое расписание',
    shortName: 'Тест',
    address: 'Не публикуется на сайте',
    timezone: 'Europe/Moscow',
  } : draft.locations[0]);

  const setFormField = <K extends keyof EditorForm>(field: K, value: EditorForm[K]) => setForm(current => ({ ...current, [field]: value }));

  const resetForm = () => setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });

  const submitForm = (event: React.FormEvent) => {
    event.preventDefault();
    if (tab === 'poster') return;
    if (!form.title.trim() || (!form.sanitaryDay && (!form.venue.trim() || !form.time))) {
      setNotice({ tone: 'error', text: 'Заполните время, название и место.' });
      return;
    }
    if (tab === 'weekly' && form.daysOfWeek.length === 0) {
      setNotice({ tone: 'error', text: 'Выберите хотя бы один день недели.' });
      return;
    }
    if (tab === 'exceptions' && !form.date) {
      setNotice({ tone: 'error', text: 'Выберите дату особого события.' });
      return;
    }

    const id = form.id || `${tab}-${crypto.randomUUID()}`;
    const common = {
      id,
      locationId,
      time: form.sanitaryDay ? '' : form.time,
      ...(!form.sanitaryDay && form.endTime ? { endTime: form.endTime } : {}),
      title: form.title.trim(),
      venue: form.sanitaryDay ? '' : form.venue.trim(),
      ...(form.details.trim() || form.sanitaryDay ? { details: form.details.trim() || 'Санитарный день' } : {}),
      priceKind: form.sanitaryDay ? 'free' as const : form.priceKind,
      ...(!form.sanitaryDay && form.priceKind === 'paid' && form.price ? { price: Number(form.price) } : {}),
      published: form.published,
      highlight: form.sanitaryDay ? false : form.highlight,
    };

    setDraft(current => {
      if (!current) return current;
      if (tab === 'weekly') {
        const item: ScheduleEvent = { ...common, daysOfWeek: [...form.daysOfWeek].sort() };
        return { ...current, weeklyEvents: [...current.weeklyEvents.filter(eventItem => eventItem.id !== id), item] };
      }
      const item: ScheduleException = {
        ...common,
        date: form.date,
        ...(form.sanitaryDay ? { closed: true, sanitaryDay: true } : {}),
      };
      return { ...current, exceptions: [...current.exceptions.filter(eventItem => eventItem.id !== id), item] };
    });
    setDirty(true);
    setNotice({ tone: 'success', text: form.id ? 'Событие обновлено в черновике.' : 'Событие добавлено в черновик.' });
    resetForm();
  };

  const editWeekly = (item: ScheduleEvent) => {
    setTab('weekly');
    setForm({
      id: item.id,
      time: item.time,
      endTime: item.endTime ?? '',
      title: item.title,
      venue: item.venue,
      details: item.details ?? '',
      priceKind: item.priceKind,
      price: item.price?.toString() ?? '',
      published: item.published,
      daysOfWeek: [...item.daysOfWeek],
      date: emptyForm.date,
      highlight: Boolean(item.highlight),
      sanitaryDay: false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const editException = (item: ScheduleException) => {
    setTab('exceptions');
    setForm({
      id: item.id,
      time: item.time,
      endTime: item.endTime ?? '',
      title: item.title,
      venue: item.venue,
      details: item.details ?? '',
      priceKind: item.priceKind,
      price: item.price?.toString() ?? '',
      published: item.published,
      daysOfWeek: [1],
      date: item.date,
      highlight: Boolean(item.highlight),
      sanitaryDay: Boolean(item.closed || item.sanitaryDay),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeItem = (kind: Exclude<EditorTab, 'poster'>, id: string) => {
    if (!window.confirm('Удалить это событие из расписания?')) return;
    setDraft(current => current ? {
      ...current,
      weeklyEvents: kind === 'weekly' ? current.weeklyEvents.filter(item => item.id !== id) : current.weeklyEvents,
      exceptions: kind === 'exceptions' ? current.exceptions.filter(item => item.id !== id) : current.exceptions,
    } : current);
    setDirty(true);
    if (form.id === id) resetForm();
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const result = await save(draft);
      setDraft(structuredClone(result.data));
      setDirty(false);
      setNotice({ tone: result.synced ? 'success' : 'warning', text: result.message });
    } catch (reason) {
      setNotice({ tone: 'error', text: reason instanceof Error ? reason.message : 'Не удалось сохранить расписание.' });
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    if (!data) return;
    setDraft(structuredClone(data));
    setDirty(false);
    resetForm();
    setNotice({ tone: 'warning', text: 'Локальные правки отменены.' });
  };

  const downloadBackup = () => {
    const blob = new Blob([`${JSON.stringify(draft, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `termburg-schedule-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyTvUrl = async (url: string, label: string) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setNotice({ tone: 'success', text: `Адрес «${label}» скопирован.` });
    } catch {
      setNotice({ tone: 'error', text: 'Не удалось скопировать адрес. Выделите его вручную.' });
    }
  };

  const persistSiteSettings = async () => {
    setSiteBusy(true);
    try {
      const saved = await saveSiteSyncSettings({
        locationId,
        endpoint: siteEndpoint,
        authMode: siteAuthMode,
        complexCode: siteComplexCode,
        ...(siteToken ? { token: siteToken } : {}),
      });
      setSiteSettings(saved);
      setSiteEndpoint(saved.endpoint);
      setSiteAuthMode(saved.authMode);
      setSiteComplexCode(saved.complexCode);
      setSiteToken('');
      setNotice({ tone: 'success', text: 'Подключение к сайту сохранено на этом компьютере.' });
    } catch (reason) {
      setNotice({ tone: 'error', text: reason instanceof Error ? reason.message : 'Не удалось сохранить подключение.' });
    } finally {
      setSiteBusy(false);
    }
  };

  const publishToSite = async () => {
    if (dirty) {
      setNotice({ tone: 'warning', text: 'Сначала сохраните изменения расписания, затем отправьте их на сайт.' });
      return;
    }
    setSiteBusy(true);
    try {
      if (siteToken || !siteSettings?.hasToken || siteSettings.endpoint !== siteEndpoint || siteSettings.authMode !== siteAuthMode || siteSettings.complexCode !== siteComplexCode) {
        const saved = await saveSiteSyncSettings({
          locationId,
          endpoint: siteEndpoint,
          authMode: siteAuthMode,
          complexCode: siteComplexCode,
          ...(siteToken ? { token: siteToken } : {}),
        });
        setSiteSettings(saved);
        setSiteToken('');
      }
      const result = await publishScheduleToSite(locationId);
      setSiteSettings(current => current ? {
        ...current,
        lastPublishedAt: result.publishedAt,
        lastPublishedCount: result.imported,
      } : current);
      setNotice({ tone: 'success', text: `Сайт обновлён: отправлено ${result.imported} событий.` });
    } catch (reason) {
      setNotice({ tone: 'error', text: reason instanceof Error ? reason.message : 'Не удалось отправить расписание на сайт.' });
    } finally {
      setSiteBusy(false);
    }
  };

  const logout = async () => {
    if (dirty && !window.confirm('Есть несохранённые изменения. Выйти и потерять их?')) return;
    await onLogout();
  };

  return (
    <div className="schedule-admin">
      <header className="schedule-admin__header">
        <div>
          <TermburgScheduleMark compact />
          <span className={`schedule-admin__connection ${source === 'server' || source === 'official' ? 'is-online' : ''}`}>
            {source === 'server' || source === 'official' ? <Wifi size={16} /> : <WifiOff size={16} />}
            {source === 'server' ? 'Сервер подключён' : source === 'official' ? 'Официальное расписание' : 'Офлайн-режим'}
          </span>
          <span className="schedule-admin__session">{session.username}</span>
        </div>
        {!isTestSession && <nav aria-label="Предпросмотр и печать">
          <a href={`/schedule/screen/${locationId}/landscape`} target="_blank" rel="noreferrer"><MonitorUp size={17} />Горизонтальный<ExternalLink size={14} /></a>
          <a href={`/schedule/screen/${locationId}/portrait`} target="_blank" rel="noreferrer"><MonitorUp size={17} />Вертикальный<ExternalLink size={14} /></a>
          <a href={`/schedule/print/${locationId}`} target="_blank" rel="noreferrer"><FileText size={17} />Печать<ExternalLink size={14} /></a>
          <a href={`/schedule/poster/${locationId}`} target="_blank" rel="noreferrer"><CalendarPlus size={17} />Афиша месяца<ExternalLink size={14} /></a>
        </nav>}
      </header>

      <main className="schedule-admin__main">
        <section className="schedule-admin__toolbar">
          <div className="schedule-admin__locked-location">
            <span><Building2 size={20} /></span>
            <div><small>{isTestSession ? 'Изолированный тестовый режим' : 'Вы вошли в комплекс'}</small><strong>{activeLocation?.name ?? (locationId === '1' ? 'Термбург Москва' : 'Термбург Зеленогорск')}</strong></div>
          </div>
          <div className="schedule-admin__toolbar-actions">
            <button type="button" className="schedule-admin-secondary" onClick={downloadBackup}><Download size={17} />JSON-копия</button>
            <button type="button" className="schedule-admin-secondary" onClick={() => void refresh()}><RefreshCcw size={17} />Обновить</button>
            <button type="button" className="schedule-admin-secondary schedule-admin-logout" onClick={() => void logout()}><LogOut size={17} />Выйти</button>
          </div>
        </section>

        {isTestSession && (
          <div className="schedule-admin-notice schedule-admin-notice--warning" role="status">
            <ShieldCheck size={18} />
            <span>Вы вошли как testTB. Здесь можно пробовать редактор: изменения хранятся отдельно и не попадут в расписание Москвы, Зеленогорска или на сайт.</span>
          </div>
        )}

        {!isTestSession && <details className="schedule-site-sync">
          <summary>
            <span className="schedule-site-sync__icon"><Settings2 size={20} /></span>
            <span><strong>Синхронизация с сайтом</strong><small>{siteSettings?.lastPublishedAt ? `Последняя отправка: ${new Date(siteSettings.lastPublishedAt).toLocaleString('ru-RU')} · ${siteSettings.lastPublishedCount ?? 0} событий` : 'Подключите WordPress API и отправляйте полное расписание одной кнопкой'}</small></span>
            <span className={`schedule-site-sync__status ${siteSettings?.hasToken ? 'is-ready' : ''}`}>{siteSettings?.hasToken ? 'Токен сохранён' : 'Нужен токен'}</span>
          </summary>
          <div className="schedule-site-sync__body">
            <label className="schedule-admin-field schedule-site-sync__endpoint"><span>Адрес импорта</span><input type="url" value={siteEndpoint} onChange={event => setSiteEndpoint(event.target.value)} /></label>
            <label className="schedule-admin-field"><span>Передача токена</span><select value={siteAuthMode} onChange={event => setSiteAuthMode(event.target.value as 'bearer' | 'x-api-key')}><option value="bearer">Authorization: Bearer</option><option value="x-api-key">X-API-Key</option></select></label>
            <label className="schedule-admin-field"><span>Код комплекса (необязательно)</span><input type="text" value={siteComplexCode} onChange={event => setSiteComplexCode(event.target.value)} placeholder="Например: moscow" /></label>
            <label className="schedule-admin-field"><span>Токен сайта</span><input type="password" value={siteToken} onChange={event => setSiteToken(event.target.value)} placeholder={siteSettings?.hasToken ? `Сохранён ${siteSettings.tokenHint} · введите только для замены` : 'Вставьте токен от программиста'} autoComplete="new-password" /></label>
            <div className="schedule-site-sync__actions">
              <button type="button" className="schedule-admin-secondary" onClick={() => void persistSiteSettings()} disabled={siteBusy}><Save size={17} />Сохранить подключение</button>
              <button type="button" className="schedule-admin-primary" onClick={() => void publishToSite()} disabled={siteBusy || dirty}><Send size={17} />{siteBusy ? 'Подождите…' : 'Отправить расписание на сайт'}</button>
            </div>
            <p>Передаётся полный массив опубликованных событий выбранного комплекса. Новая отправка заменяет расписание на сайте.</p>
          </div>
        </details>}

        {tvUrls.landscape && (
          <section className="schedule-admin-monitor-links" aria-label="Адреса для телевизоров">
            <article className="schedule-admin-lan schedule-admin-lan--editor">
              <span className="schedule-admin-lan__icon"><ShieldCheck size={21} /></span>
              <div>
                <span>Редактор для сотрудников · вход по логину</span>
                <strong>{tvUrls.editor}</strong>
              </div>
              <button type="button" className="schedule-admin-secondary" onClick={() => void copyTvUrl(tvUrls.editor, 'Редактор для сотрудников')}><Copy size={16} />Копировать</button>
            </article>
            <article className="schedule-admin-lan">
              <span className="schedule-admin-lan__icon"><MonitorUp size={21} /></span>
              <div>
                <span>Горизонтальный монитор · 16:9</span>
                <strong>{tvUrls.landscape}</strong>
              </div>
              <button type="button" className="schedule-admin-secondary" onClick={() => void copyTvUrl(tvUrls.landscape, 'Горизонтальный монитор')}><Copy size={16} />Копировать</button>
            </article>
            <article className="schedule-admin-lan schedule-admin-lan--portrait">
              <span className="schedule-admin-lan__icon"><MonitorUp size={21} /></span>
              <div>
                <span>Вертикальный монитор · 9:16</span>
                <strong>{tvUrls.portrait}</strong>
              </div>
              <button type="button" className="schedule-admin-secondary" onClick={() => void copyTvUrl(tvUrls.portrait, 'Вертикальный монитор')}><Copy size={16} />Копировать</button>
            </article>
          </section>
        )}

        {notice && (
          <div className={`schedule-admin-notice schedule-admin-notice--${notice.tone}`} role="status">
            {notice.tone === 'success' ? <Check size={18} /> : notice.tone === 'error' ? <X size={18} /> : <WifiOff size={18} />}
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Закрыть уведомление"><X size={16} /></button>
          </div>
        )}

        <div className={`schedule-admin__workspace ${tab === 'poster' ? 'schedule-admin__workspace--poster' : ''}`}>
          <section className="schedule-admin-editor">
            <div className="schedule-admin-tabs" role="tablist" aria-label="Разделы расписания">
              <button type="button" role="tab" aria-selected={tab === 'weekly'} className={tab === 'weekly' ? 'is-active' : ''} onClick={() => { setTab('weekly'); resetForm(); }}>Обычная неделя</button>
              <button type="button" role="tab" aria-selected={tab === 'exceptions'} className={tab === 'exceptions' ? 'is-active' : ''} onClick={() => { setTab('exceptions'); resetForm(); }}>Особые даты</button>
              <button type="button" role="tab" aria-selected={tab === 'poster'} className={tab === 'poster' ? 'is-active' : ''} onClick={() => { setTab('poster'); resetForm(); }}>Афиша месяца</button>
            </div>

            {tab === 'poster' ? (
              activeLocation ? <MonthlyPosterStudio
                location={activeLocation}
                posters={draft.monthlyPosters}
                onChange={monthlyPosters => {
                  setDraft(current => current ? { ...current, monthlyPosters } : current);
                  setDirty(true);
                }}
                onNotice={setNotice}
              /> : <ScheduleError message="Комплекс не найден." />
            ) : (
            <form onSubmit={submitForm} className="schedule-admin-form">
              <div className="schedule-admin-form__heading">
                <span className="schedule-admin-form__icon">{form.id ? <Pencil size={20} /> : <CalendarPlus size={20} />}</span>
                <div><span>{form.id ? 'Редактирование' : 'Новая запись'}</span><h2>{tab === 'weekly' ? 'Событие в обычной неделе' : 'Праздник или разовое событие'}</h2></div>
              </div>

              {tab === 'weekly' ? (
                <fieldset className="schedule-admin-days">
                  <legend>Дни недели</legend>
                  <div>{DAY_LABELS_SHORT.map((label, index) => {
                    const day = index + 1;
                    const selected = form.daysOfWeek.includes(day);
                    return <button type="button" key={label} className={selected ? 'is-active' : ''} aria-pressed={selected} onClick={() => setFormField('daysOfWeek', selected ? form.daysOfWeek.filter(item => item !== day) : [...form.daysOfWeek, day])}>{label}</button>;
                  })}</div>
                </fieldset>
              ) : (
                <>
                  <label className="schedule-admin-field"><span>Дата</span><input type="date" value={form.date} onChange={event => setFormField('date', event.target.value)} required /></label>
                  <label className="schedule-admin-toggle schedule-admin-toggle--closed"><input type="checkbox" checked={form.sanitaryDay} onChange={event => setForm(current => ({ ...current, sanitaryDay: event.target.checked, title: event.target.checked && !current.id ? 'Санитарный день' : current.title, details: event.target.checked && !current.id ? 'Санитарный день' : current.details }))} /><span><i /><strong>Санитарный день</strong><small>Скрывает всю обычную программу выбранной даты</small></span></label>
                </>
              )}

              <div className={`schedule-admin-form__grid ${form.sanitaryDay ? 'is-disabled' : ''}`}>
                <label className="schedule-admin-field"><span>Начало</span><input type="time" value={form.time} onChange={event => setFormField('time', event.target.value)} required /></label>
                <label className="schedule-admin-field"><span>Конец</span><input type="time" value={form.endTime} onChange={event => setFormField('endTime', event.target.value)} /></label>
              </div>
              <label className="schedule-admin-field"><span>Название</span><input type="text" value={form.title} onChange={event => setFormField('title', event.target.value)} placeholder="Например: Таёжная мовня" required /></label>
              {!form.sanitaryDay && <label className="schedule-admin-field"><span>Место</span><input type="text" value={form.venue} onChange={event => setFormField('venue', event.target.value)} placeholder="Например: Травяная сауна" required /></label>}
              <label className="schedule-admin-field"><span>Детали</span><textarea value={form.details} onChange={event => setFormField('details', event.target.value)} placeholder="Возраст, этаж, ограничения" rows={3} /></label>
              {!form.sanitaryDay && <fieldset className="schedule-admin-price">
                <legend>Стоимость</legend>
                <div>
                  <label><input type="radio" name="priceKind" checked={form.priceKind === 'free'} onChange={() => setFormField('priceKind', 'free')} /><span>Бесплатно</span></label>
                  <label><input type="radio" name="priceKind" checked={form.priceKind === 'paid'} onChange={() => setFormField('priceKind', 'paid')} /><span>Платно</span></label>
                  {form.priceKind === 'paid' && <label className="schedule-admin-price__amount"><input type="number" min="0" step="10" value={form.price} onChange={event => setFormField('price', event.target.value)} placeholder="390" /><span>₽</span></label>}
                </div>
              </fieldset>}
              {!form.sanitaryDay && <label className="schedule-admin-toggle schedule-admin-toggle--highlight"><input type="checkbox" checked={form.highlight} onChange={event => setFormField('highlight', event.target.checked)} /><span><i /><strong><Sparkles size={14} /> Выделить на сайте</strong><small>Визуальное выделение не зависит от стоимости</small></span></label>}
              <label className="schedule-admin-toggle"><input type="checkbox" checked={form.published} onChange={event => setFormField('published', event.target.checked)} /><span><i /><strong>Опубликовано</strong><small>Видно гостям и на экранах</small></span></label>
              <div className="schedule-admin-form__actions">
                {form.id && <button type="button" className="schedule-admin-secondary" onClick={resetForm}><X size={17} />Отменить</button>}
                <button type="submit" className="schedule-admin-primary"><Plus size={18} />{form.id ? 'Обновить' : 'Добавить'}</button>
              </div>
            </form>
            )}
          </section>

          {tab !== 'poster' && (
          <section className="schedule-admin-list">
            <div className="schedule-admin-list__heading">
              <div><span>{tab === 'weekly' ? 'Обычная неделя' : 'Афиша по датам'}</span><h2>{tab === 'weekly' ? `${visibleWeekly.length} записей` : `${visibleExceptions.length} особых событий`}</h2></div>
              <button type="button" className="schedule-admin-secondary" onClick={discardChanges} disabled={!dirty}><RefreshCcw size={16} />Сбросить</button>
            </div>
            <div className="schedule-admin-list__items">
              {tab === 'weekly' ? visibleWeekly.map(item => (
                <AdminEventCard key={item.id} title={item.title} time={item.time} venue={item.venue} priceKind={item.priceKind} price={item.price} published={item.published} highlighted={item.highlight} meta={item.daysOfWeek.map(day => DAY_LABELS[day - 1]).join(', ')} onEdit={() => editWeekly(item)} onDelete={() => removeItem('weekly', item.id)} />
              )) : visibleExceptions.map(item => (
                <AdminEventCard key={item.id} title={item.title} time={item.time} venue={item.venue} priceKind={item.priceKind} price={item.price} published={item.published} highlighted={item.highlight} sanitaryDay={item.closed || item.sanitaryDay} meta={new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${item.date}T12:00:00Z`))} onEdit={() => editException(item)} onDelete={() => removeItem('exceptions', item.id)} />
              ))}
              {((tab === 'weekly' && visibleWeekly.length === 0) || (tab === 'exceptions' && visibleExceptions.length === 0)) && <div className="schedule-admin-list__empty"><CalendarPlus size={30} /><h3>Пока пусто</h3><p>Добавьте первое событие через форму слева.</p></div>}
            </div>
          </section>
          )}
        </div>
      </main>

      <footer className="schedule-admin-savebar">
        <div className="schedule-admin-savebar__status"><span className={dirty ? 'is-dirty' : ''} /><strong>{dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены'}</strong><small>Версия {draft.revision} · {new Date(draft.updatedAt).toLocaleString('ru-RU')}</small></div>
        <div className="schedule-admin-savebar__actions">
          {!isTestSession && <button type="button" className="schedule-admin-secondary schedule-admin-savebar__publish" onClick={() => void publishToSite()} disabled={siteBusy || dirty}><Send size={19} />{siteBusy ? 'Отправляем…' : 'Отправить на сайт'}</button>}
          <button type="button" className="schedule-admin-primary" onClick={() => void saveChanges()} disabled={!dirty || saving}><Save size={19} />{saving ? 'Сохраняем…' : 'Сохранить и показать всем'}</button>
        </div>
      </footer>
    </div>
  );
}

function AdminEventCard({ title, time, venue, priceKind, price, published, highlighted, sanitaryDay, meta, onEdit, onDelete }: {
  title: string;
  time: string;
  venue: string;
  priceKind: SchedulePriceKind;
  price?: number;
  published: boolean;
  highlighted?: boolean;
  sanitaryDay?: boolean;
  meta: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className={`schedule-admin-event ${published ? '' : 'is-hidden'}`}>
      <time>{sanitaryDay ? <CalendarX2 size={22} /> : time}</time>
      <div>
        <span className="schedule-admin-event__meta">{meta}</span>
        <h3>{title}</h3>
        {venue && <p>{venue}</p>}
        <div>{sanitaryDay ? <span className="is-closed">Санитарный день</span> : <span className={priceKind === 'free' ? 'is-free' : 'is-paid'}>{priceKind === 'free' ? 'Бесплатно' : price ? `+${price} ₽` : 'Платно'}</span>}{highlighted && !sanitaryDay && <span className="is-highlighted">Выделено</span>}{!published && <span>Скрыто</span>}</div>
      </div>
      <div className="schedule-admin-event__actions">
        <button type="button" onClick={onEdit} aria-label={`Изменить: ${title}`}><Pencil size={17} /></button>
        <button type="button" onClick={onDelete} aria-label={`Удалить: ${title}`}><Trash2 size={17} /></button>
      </div>
    </article>
  );
}
