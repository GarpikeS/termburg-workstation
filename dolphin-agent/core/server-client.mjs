import { setTimeout as delay } from 'node:timers/promises';
import {
  DEFAULT_SOURCE_CONFIG_ENDPOINT,
  HTTP_TIMEOUT_MS,
  MAX_HTTP_ATTEMPTS,
} from './constants.mjs';

export class DolphinServerError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'DolphinServerError';
    this.status = options.status || 0;
    this.retryable = options.retryable !== false;
  }
}

async function responseMessage(response) {
  try {
    const body = await response.json();
    return String(body?.error || body?.message || '').slice(0, 300);
  } catch {
    return '';
  }
}

export class DolphinServerClient {
  constructor(options) {
    this.endpoint = options.endpoint;
    this.healthEndpoint = options.healthEndpoint || new URL('health', `${this.endpoint.replace(/\/redemptions\/?$/, '/')}`).toString();
    this.enrollmentEndpoint = options.enrollmentEndpoint || new URL('enroll', `${this.endpoint.replace(/\/redemptions\/?$/, '/')}`).toString();
    this.sourceConfigEndpoint = options.sourceConfigEndpoint
      || (this.endpoint.includes('/api/integrations/dolphin/')
        ? new URL('source-config', `${this.endpoint.replace(/\/redemptions\/?$/, '/')}`).toString()
        : DEFAULT_SOURCE_CONFIG_ENDPOINT);
    this.fetch = options.fetchImpl || globalThis.fetch;
    this.timeoutMs = options.timeoutMs || HTTP_TIMEOUT_MS;
    this.maxAttempts = options.maxAttempts || MAX_HTTP_ATTEMPTS;
  }

  async request(url, options, token, requireToken = true) {
    if (requireToken && !token) throw new DolphinServerError('Компьютер ещё не подключён.', { retryable: false });
    let lastError = null;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const response = await this.fetch(url, {
          ...options,
          headers: {
            ...(options.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (response.ok) return response;
        const message = await responseMessage(response);
        const retryable = response.status === 429 || response.status >= 500;
        throw new DolphinServerError(
          message || `Сервер ответил ${response.status}.`,
          { status: response.status, retryable },
        );
      } catch (error) {
        lastError = error instanceof DolphinServerError
          ? error
          : new DolphinServerError(error?.name === 'TimeoutError' ? 'Сервер не ответил за 10 секунд.' : 'Нет связи с сервером.');
        if (!lastError.retryable || attempt >= this.maxAttempts) break;
        const pause = (attempt === 1 ? 1_000 : 3_000) + Math.floor(Math.random() * 500);
        await delay(pause);
      }
    }
    throw lastError;
  }

  async health(token) {
    const response = await this.request(this.healthEndpoint, { method: 'GET' }, token);
    return response.json();
  }

  async heartbeat(token, value = {}) {
    const response = await this.request(this.healthEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    }, token);
    return response.json();
  }

  async sourceConfig(token) {
    const response = await this.request(this.sourceConfigEndpoint, { method: 'GET' }, token);
    return response.json();
  }

  async enroll(value) {
    const response = await this.request(this.enrollmentEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enrollmentToken: value.enrollmentToken,
        deviceId: value.deviceId,
        deviceToken: value.deviceToken,
      }),
    }, '', false);
    return response.json();
  }

  async send(rows, options) {
    const response = await this.request(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dryRun: options.dryRun === true,
        deviceId: options.deviceId,
        rows,
      }),
    }, options.token);
    return response.json();
  }
}
