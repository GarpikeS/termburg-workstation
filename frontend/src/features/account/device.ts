const DEVICE_KEY = 'termliny-device-id';

export function getDeviceId(): string {
  const saved = localStorage.getItem(DEVICE_KEY);
  if (saved) return saved;
  const next = globalThis.crypto?.randomUUID?.()
    ?? `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  localStorage.setItem(DEVICE_KEY, next);
  return next;
}
