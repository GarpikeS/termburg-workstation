const HIDDEN_PREFIXES = ['/shop/free-hour', '/schedule', '/account', '/legal'];

export function isBottomNavHidden(pathname: string) {
  return pathname === '/' || HIDDEN_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

export function isGameplayRoute(pathname: string) {
  return pathname.startsWith('/games/match3/play/') ||
    pathname === '/games/2048' ||
    pathname === '/games/bubbles' ||
    pathname === '/games/pet';
}
