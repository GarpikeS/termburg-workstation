import type { ScheduleAuthStatus, ScheduleData, ScheduleEditorUser, ScheduleSaveResult, SiteSyncPublishResult, SiteSyncSettings } from './types';
import { loadOfficialSchedule } from './officialSchedule';

const STORAGE_KEY = 'termburg:schedule:v1';
const SEED_URL = '/data/default-schedule.json';
const DEFAULT_API_URL = '/api/schedule';

function isScheduleData(value: unknown): value is ScheduleData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ScheduleData>;
  return candidate.schemaVersion === 1
    && Array.isArray(candidate.locations)
    && Array.isArray(candidate.weeklyEvents)
    && Array.isArray(candidate.exceptions);
}

function normalizeScheduleData(value: ScheduleData): ScheduleData {
  return {
    ...value,
    monthlyPosters: Array.isArray(value.monthlyPosters) ? value.monthlyPosters : [],
  };
}

function parseSchedule(raw: string | null) {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isScheduleData(value) ? normalizeScheduleData(value) : null;
  } catch {
    return null;
  }
}

function getApiUrl() {
  const configured = import.meta.env.VITE_SCHEDULE_API_URL?.trim();
  return configured || DEFAULT_API_URL;
}

function hasScheduleApi() {
  return Boolean(import.meta.env.VITE_SCHEDULE_API_URL?.trim()) || window.location.port === '4174';
}

export function getScheduleStreamUrl() {
  return `${getApiUrl().replace(/\/+$/, '')}/stream`;
}

async function fetchJson(url: string, timeoutMs = 2500) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      return null;
    }
    const value: unknown = await response.json();
    return isScheduleData(value) ? normalizeScheduleData(value) : null;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function readLocalSchedule() {
  return parseSchedule(window.localStorage.getItem(STORAGE_KEY));
}

export function writeLocalSchedule(data: ScheduleData) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent('termburg:schedule-updated', { detail: data }));
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel('termburg-schedule');
    channel.postMessage(data);
    channel.close();
  }
}

export type ScheduleSource = 'server' | 'official' | 'local' | 'seed';

export async function loadSchedule(): Promise<{ data: ScheduleData; source: ScheduleSource }> {
  if (hasScheduleApi()) {
    try {
      const remote = await fetchJson(getApiUrl());
      if (remote) {
        writeLocalSchedule(remote);
        return { data: remote, source: 'server' };
      }
    } catch {
      // Network sync is optional. Continue with the last locally cached version.
    }
  }

  const official = await loadOfficialSchedule();
  if (official) {
    writeLocalSchedule(official);
    return { data: official, source: 'official' };
  }

  const local = readLocalSchedule();
  if (local) return { data: local, source: 'local' };

  const seed = await fetchJson(SEED_URL, 4000);
  if (!seed) throw new Error('Не удалось загрузить даже демо-расписание.');
  writeLocalSchedule(seed);
  return { data: seed, source: 'seed' };
}

export async function saveSchedule(data: ScheduleData, adminToken?: string): Promise<ScheduleSaveResult> {
  const next: ScheduleData = {
    ...data,
    revision: data.revision + 1,
    updatedAt: new Date().toISOString(),
  };
  writeLocalSchedule(next);

  if (!hasScheduleApi()) {
    return {
      data: next,
      synced: false,
      message: 'Сохранено на этом устройстве. Для общей синхронизации запустите сервер расписания.',
    };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(getApiUrl(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      },
      body: JSON.stringify(next),
      signal: controller.signal,
      credentials: 'same-origin',
    });
    if (!response.ok) {
      const errorText = await response.text();
      let message = errorText || `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(errorText) as { error?: unknown };
        if (typeof parsed.error === 'string') message = parsed.error;
      } catch {
        // The plain server response is already useful.
      }
      const error = new Error(message) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    const saved: unknown = await response.json();
    const confirmed = isScheduleData(saved) ? normalizeScheduleData(saved) : next;
    writeLocalSchedule(confirmed);
    return {
      data: confirmed,
      synced: true,
      message: 'Сохранено и обновлено на всех экранах.',
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && (error.status === 401 || error.status === 403)) {
      throw error;
    }
    return {
      data: next,
      synced: false,
      message: 'Сохранено на этом устройстве. Сетевой сервер пока недоступен.',
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

async function apiJson<T>(url: string, options: RequestInit = {}, timeoutMs = 25000): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...options.headers,
      },
      cache: 'no-store',
      signal: controller.signal,
      credentials: 'same-origin',
    });
    const responseText = await response.text();
    let value: unknown = null;
    if (responseText) {
      try {
        value = JSON.parse(responseText);
      } catch {
        value = responseText;
      }
    }
    if (!response.ok) {
      const message = value && typeof value === 'object' && 'error' in value && typeof value.error === 'string'
        ? value.error
        : `Ошибка HTTP ${response.status}`;
      throw new Error(message);
    }
    return value as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Операция заняла слишком много времени. Проверьте интернет и повторите.', { cause: error });
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function loadScheduleAuthStatus() {
  return apiJson<ScheduleAuthStatus>('/api/auth/status', {}, 5000);
}

export function setupScheduleAccess(input: { moscowPassword: string; zelenogorskPassword: string }) {
  return apiJson<{ configured: true }>('/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(input),
  }, 15000);
}

export function loginScheduleEditor(input: { username: ScheduleEditorUser['username']; password: string }) {
  return apiJson<{ authenticated: true; user: ScheduleEditorUser }>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(input),
  }, 15000);
}

export function logoutScheduleEditor() {
  return apiJson<{ authenticated: false }>('/api/auth/logout', { method: 'POST' }, 5000);
}

export function loadSiteSyncSettings(locationId: string) {
  return apiJson<SiteSyncSettings>(`/api/site-sync/settings?locationId=${encodeURIComponent(locationId)}`);
}

export function saveSiteSyncSettings(
  settings: Pick<SiteSyncSettings, 'locationId' | 'endpoint' | 'authMode' | 'complexCode'> & { token?: string },
  adminToken?: string,
) {
  return apiJson<SiteSyncSettings>('/api/site-sync/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
    },
    body: JSON.stringify(settings),
  });
}

export function publishScheduleToSite(locationId: string, adminToken?: string) {
  return apiJson<SiteSyncPublishResult>('/api/site-sync/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
    },
    body: JSON.stringify({ locationId }),
  }, 30000);
}

export function subscribeToLocalSchedule(onChange: (data: ScheduleData) => void) {
  const handleCustom = (event: Event) => {
    const data = (event as CustomEvent<ScheduleData>).detail;
    if (isScheduleData(data)) onChange(normalizeScheduleData(data));
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    const data = parseSchedule(event.newValue);
    if (data) onChange(data);
  };
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('termburg-schedule') : null;
  if (channel) {
    channel.onmessage = event => {
      if (isScheduleData(event.data)) onChange(normalizeScheduleData(event.data));
    };
  }

  window.addEventListener('termburg:schedule-updated', handleCustom);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener('termburg:schedule-updated', handleCustom);
    window.removeEventListener('storage', handleStorage);
    channel?.close();
  };
}
