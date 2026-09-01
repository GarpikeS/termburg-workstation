import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

const COOKIE_NAME = 'termburg_schedule_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 128;
const KEY_LENGTH = 64;
const DEFAULT_SCRYPT_OPTIONS = {
  N: 2 ** 17,
  r: 8,
  p: 1,
  maxmem: 192 * 1024 * 1024,
};

const ACCOUNT_DEFINITIONS = [
  { username: 'moscow', locationId: '1' },
  { username: 'zelenogorsk', locationId: '2' },
];

function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function passwordError(value) {
  if (typeof value !== 'string' || value.length < PASSWORD_MIN_LENGTH) {
    return `Пароль должен содержать не меньше ${PASSWORD_MIN_LENGTH} символов.`;
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return `Пароль должен содержать не больше ${PASSWORD_MAX_LENGTH} символов.`;
  }
  return '';
}

function parseCookies(header = '') {
  const cookies = new Map();
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies.set(name, value);
  }
  return cookies;
}

function tokenKey(value) {
  return createHash('sha256').update(value).digest('hex');
}

function publicUser(account) {
  return {
    username: account.username,
    locationId: account.locationId,
  };
}

function authError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

export function createScheduleAuth({
  authFile,
  sessionTtlMs = SESSION_TTL_MS,
  scryptOptions = DEFAULT_SCRYPT_OPTIONS,
  now = () => Date.now(),
} = {}) {
  if (!authFile) throw new Error('authFile is required');

  const resolvedAuthFile = path.resolve(authFile);
  const sessions = new Map();
  const failedLogins = new Map();
  const fakeAccount = {
    username: 'unknown',
    locationId: '',
    salt: randomBytes(16).toString('base64'),
    hash: randomBytes(KEY_LENGTH).toString('base64'),
    scrypt: { ...scryptOptions, keyLength: KEY_LENGTH },
  };
  let cachedStore = null;

  async function readStore() {
    if (cachedStore) return cachedStore;
    try {
      const parsed = JSON.parse(await fs.readFile(resolvedAuthFile, 'utf8'));
      cachedStore = parsed && parsed.schemaVersion === 1 && parsed.accounts && typeof parsed.accounts === 'object'
        ? parsed
        : { schemaVersion: 1, accounts: {} };
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      cachedStore = { schemaVersion: 1, accounts: {} };
    }
    return cachedStore;
  }

  async function writeStore(store) {
    await fs.mkdir(path.dirname(resolvedAuthFile), { recursive: true });
    const tempFile = `${resolvedAuthFile}.${process.pid}.tmp`;
    await fs.writeFile(tempFile, `${JSON.stringify(store, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(tempFile, resolvedAuthFile);
    cachedStore = store;
  }

  function storeIsConfigured(store) {
    return ACCOUNT_DEFINITIONS.every(({ username }) => Boolean(store.accounts[username]?.hash && store.accounts[username]?.salt));
  }

  async function derivePassword(password, salt, options) {
    const derived = await scrypt(password, Buffer.from(salt, 'base64'), options.keyLength || KEY_LENGTH, {
      N: options.N,
      r: options.r,
      p: options.p,
      maxmem: options.maxmem,
    });
    return Buffer.from(derived);
  }

  async function createAccount(username, locationId, password) {
    const salt = randomBytes(16).toString('base64');
    const params = { ...scryptOptions, keyLength: KEY_LENGTH };
    const hash = await derivePassword(password, salt, params);
    return {
      username,
      locationId,
      salt,
      hash: hash.toString('base64'),
      scrypt: params,
    };
  }

  async function verifyPassword(account, password) {
    const expected = Buffer.from(account.hash, 'base64');
    const actual = await derivePassword(password, account.salt, account.scrypt);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  function getSession(request) {
    const rawToken = parseCookies(request.headers.cookie).get(COOKIE_NAME);
    if (!rawToken) return null;
    const key = tokenKey(rawToken);
    const session = sessions.get(key);
    if (!session) return null;
    if (session.expiresAt <= now()) {
      sessions.delete(key);
      return null;
    }
    session.expiresAt = now() + sessionTtlMs;
    return session;
  }

  function issueSession(account) {
    const rawToken = randomBytes(32).toString('base64url');
    sessions.set(tokenKey(rawToken), {
      user: publicUser(account),
      expiresAt: now() + sessionTtlMs,
    });
    return {
      user: publicUser(account),
      cookie: `${COOKIE_NAME}=${rawToken}; Path=/; HttpOnly; SameSite=Strict`,
    };
  }

  function revokeSession(request) {
    const rawToken = parseCookies(request.headers.cookie).get(COOKIE_NAME);
    if (rawToken) sessions.delete(tokenKey(rawToken));
    return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
  }

  function failureKey(remoteAddress, username) {
    return `${remoteAddress || 'unknown'}:${username || 'unknown'}`;
  }

  function assertLoginAllowed(key) {
    const failure = failedLogins.get(key);
    if (!failure) return;
    if (failure.lockedUntil > now()) {
      throw authError('AUTH_RATE_LIMITED', 'Слишком много попыток. Повторите вход через 15 минут.', 429);
    }
    if (now() - failure.firstAt > LOGIN_WINDOW_MS) failedLogins.delete(key);
  }

  function recordFailure(key) {
    const previous = failedLogins.get(key);
    const active = previous && now() - previous.firstAt <= LOGIN_WINDOW_MS
      ? previous
      : { count: 0, firstAt: now(), lockedUntil: 0 };
    active.count += 1;
    if (active.count >= LOGIN_MAX_FAILURES) active.lockedUntil = now() + LOGIN_LOCK_MS;
    failedLogins.set(key, active);
  }

  async function status(request) {
    const store = await readStore();
    const session = getSession(request);
    return {
      configured: storeIsConfigured(store),
      authenticated: Boolean(session),
      user: session?.user ?? null,
    };
  }

  async function setup(input) {
    const store = await readStore();
    if (storeIsConfigured(store)) throw authError('AUTH_ALREADY_CONFIGURED', 'Доступ уже настроен.', 409);

    const passwords = {
      moscow: input?.moscowPassword,
      zelenogorsk: input?.zelenogorskPassword,
    };
    for (const definition of ACCOUNT_DEFINITIONS) {
      const message = passwordError(passwords[definition.username]);
      if (message) throw authError('AUTH_WEAK_PASSWORD', `${definition.username}: ${message}`);
    }

    const accounts = {};
    for (const definition of ACCOUNT_DEFINITIONS) {
      accounts[definition.username] = await createAccount(
        definition.username,
        definition.locationId,
        passwords[definition.username],
      );
    }
    await writeStore({
      schemaVersion: 1,
      updatedAt: new Date(now()).toISOString(),
      accounts,
    });
    return { configured: true };
  }

  async function login(input, remoteAddress) {
    const username = normalizeUsername(input?.username);
    const password = typeof input?.password === 'string' ? input.password : '';
    const key = failureKey(remoteAddress, username);
    assertLoginAllowed(key);

    const store = await readStore();
    if (!storeIsConfigured(store)) throw authError('AUTH_NOT_CONFIGURED', 'Сначала настройте доступ.', 409);
    const account = store.accounts[username] || fakeAccount;
    const valid = password.length <= PASSWORD_MAX_LENGTH && await verifyPassword(account, password);
    if (!store.accounts[username] || !valid) {
      recordFailure(key);
      throw authError('AUTH_INVALID_CREDENTIALS', 'Неверный логин или пароль.', 401);
    }

    failedLogins.delete(key);
    return issueSession(account);
  }

  function authorize(request, locationId = '') {
    const session = getSession(request);
    if (!session) return { allowed: false, status: 401, error: 'Войдите в редактор.' };
    if (locationId && session.user.locationId !== locationId) {
      return { allowed: false, status: 403, error: 'Этот логин не имеет доступа к выбранному комплексу.' };
    }
    return { allowed: true, user: session.user };
  }

  return {
    authorize,
    login,
    logout: revokeSession,
    setup,
    status,
    cookieName: COOKIE_NAME,
    paths: { authFile: resolvedAuthFile },
  };
}
