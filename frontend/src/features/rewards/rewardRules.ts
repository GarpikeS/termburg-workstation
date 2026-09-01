import type { RewardClaim } from '@/types/game';

export const FREE_HOUR_PRICE = 50;
export const FREE_HOUR_VALID_DAYS = 7;

export function activeFreeHourClaim(claims: readonly RewardClaim[], now = Date.now()): RewardClaim | null {
  return [...claims]
    .reverse()
    .find(claim => claim.rewardId === 'ticket-free' && claim.nextPurchaseAt > now) ?? null;
}

export function isRewardClaimRedeemed(claim: RewardClaim): boolean {
  return claim.status === 'redeemed' || Number.isFinite(claim.redeemedAt);
}

export function formatRewardDate(timestamp: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  }).format(new Date(timestamp));
}
