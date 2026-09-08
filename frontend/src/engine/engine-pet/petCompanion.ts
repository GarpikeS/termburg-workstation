import { GAME_LEVEL_TOTAL } from '../../data/gameProgression.ts';
import { GAME_NAMES } from '../../data/gameNames.ts';
import type { PetState } from '../../types/game.ts';
import {
  PET_COMPANION_REWARD_LEDGER_LIMIT,
  getDepletedPetStat,
  normalizePetCompanionRewardSessionIds,
  syncPetState,
} from './petEngine.ts';

export type PetCompanionGame = 'match3' | 'game2048' | 'bubbles';

export interface PetCompanionSession {
  id: string;
  adoptionId: string;
  game: PetCompanionGame;
  startedAt: number;
}

export interface PetCompanionRouteState {
  petCompanionSession: PetCompanionSession;
}

export interface PetCompanionRewardResult {
  awarded: boolean;
  pet: PetState | null;
  experience: number;
  bond: number;
  gameLabel: string;
}

export const PET_COMPANION_EXPERIENCE = 12;
export const PET_COMPANION_BOND = 2;
export const PET_COMPANION_HAPPINESS = 8;
export const PET_COMPANION_SESSION_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const MAX_SESSION_ID_LENGTH = 72;
const MAX_ADOPTION_ID_LENGTH = 100;
const DIARY_MARKER_PREFIX = 'pet-companion:';

const COMPANION_GAMES = new Set<PetCompanionGame>(['match3', 'game2048', 'bubbles']);

export const PET_COMPANION_GAME_LABELS: Record<PetCompanionGame, string> = {
  match3: GAME_NAMES.match3,
  game2048: GAME_NAMES.game2048,
  bubbles: GAME_NAMES.bubbles,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCompanionGame(value: unknown): value is PetCompanionGame {
  return typeof value === 'string' && COMPANION_GAMES.has(value as PetCompanionGame);
}

function readBoundedId(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

function hasValidSessionTime(startedAt: number, now: number): boolean {
  return Number.isFinite(now)
    && Number.isFinite(startedAt)
    && startedAt > 0
    && startedAt <= now
    && now - startedAt <= PET_COMPANION_SESSION_MAX_AGE_MS;
}

function createSessionId(now: number): string {
  const randomPart = globalThis.crypto?.randomUUID?.()
    ?? Math.random().toString(36).slice(2, 14);
  return `pet-play-${now.toString(36)}-${randomPart}`.slice(0, MAX_SESSION_ID_LENGTH);
}

export function createPetCompanionSession(
  adoptionId: string,
  game: PetCompanionGame,
  now = Date.now(),
): PetCompanionSession {
  const cleanAdoptionId = readBoundedId(adoptionId, MAX_ADOPTION_ID_LENGTH);
  if (!cleanAdoptionId) throw new Error('Для совместной игры нужен действующий питомец.');
  if (!isCompanionGame(game)) throw new Error('Игра для питомца не поддерживается.');
  if (!Number.isFinite(now) || now <= 0) throw new Error('Некорректное время начала игры.');

  return {
    id: createSessionId(now),
    adoptionId: cleanAdoptionId,
    game,
    startedAt: now,
  };
}

export function createPetCompanionRouteState(
  session: PetCompanionSession,
): PetCompanionRouteState {
  return { petCompanionSession: session };
}

export function parsePetCompanionSession(
  value: unknown,
  requestedGame: PetCompanionGame,
  now = Date.now(),
): PetCompanionSession | null {
  if (!isPlainObject(value) || !isCompanionGame(requestedGame)) return null;

  const id = readBoundedId(value.id, MAX_SESSION_ID_LENGTH);
  const adoptionId = readBoundedId(value.adoptionId, MAX_ADOPTION_ID_LENGTH);
  const game = value.game;
  const startedAt = value.startedAt;

  if (!id || !adoptionId || !isCompanionGame(game) || game !== requestedGame) return null;
  if (typeof startedAt !== 'number' || !hasValidSessionTime(startedAt, now)) return null;

  return { id, adoptionId, game, startedAt };
}

export function readPetCompanionSession(
  routeState: unknown,
  requestedGame: PetCompanionGame,
  now = Date.now(),
): PetCompanionSession | null {
  if (!isPlainObject(routeState)) return null;
  return parsePetCompanionSession(routeState.petCompanionSession, requestedGame, now);
}

export function getPetCompanionGameRoute(
  game: PetCompanionGame,
  match3Level = 1,
): string {
  if (game === 'game2048') return '/games/2048';
  if (game === 'bubbles') return '/games/bubbles';
  const level = Math.max(1, Math.min(GAME_LEVEL_TOTAL, Math.floor(match3Level)));
  return `/games/match3/play/${Number.isFinite(level) ? level : 1}`;
}

function getRewardDiaryId(sessionId: string): string {
  return `${DIARY_MARKER_PREFIX}${sessionId}`;
}

export function applyPetCompanionWin(
  pet: PetState | null,
  session: PetCompanionSession,
  now = Date.now(),
): PetCompanionRewardResult {
  const gameLabel = isCompanionGame(session?.game) ? PET_COMPANION_GAME_LABELS[session.game] : '';
  const cleanSession = parsePetCompanionSession(session, session?.game, now);

  if (!pet || !cleanSession || pet.adoptionId !== cleanSession.adoptionId) {
    return { awarded: false, pet, experience: 0, bond: 0, gameLabel };
  }

  const consumedSessionIds = normalizePetCompanionRewardSessionIds(pet.companionRewardSessionIds);
  if (consumedSessionIds.includes(cleanSession.id)) {
    return { awarded: false, pet, experience: 0, bond: 0, gameLabel };
  }

  const normalized = syncPetState(pet, now);
  if (getDepletedPetStat(normalized)) {
    return { awarded: false, pet, experience: 0, bond: 0, gameLabel };
  }
  const diaryId = getRewardDiaryId(cleanSession.id);
  const awardedBond = Math.min(PET_COMPANION_BOND, 100 - normalized.bond);
  const rewarded: PetState = {
    ...normalized,
    experience: normalized.experience + PET_COMPANION_EXPERIENCE,
    companionExperience: (normalized.companionExperience ?? 0) + PET_COMPANION_EXPERIENCE,
    companionRewardSessionIds: [
      ...normalizePetCompanionRewardSessionIds(normalized.companionRewardSessionIds),
      cleanSession.id,
    ].slice(-PET_COMPANION_REWARD_LEDGER_LIMIT),
    bond: normalized.bond + awardedBond,
    happiness: Math.min(100, normalized.happiness + PET_COMPANION_HAPPINESS),
    lastUpdated: now,
    diary: [{
      id: diaryId,
      createdAt: now,
      title: `Играли вместе: ${gameLabel}`,
      detail: `Победа в «${gameLabel}»: +${PET_COMPANION_EXPERIENCE} опыта и +${awardedBond} к привязанности.`,
      kind: 'reward' as const,
    }, ...normalized.diary].slice(0, 20),
  };

  return {
    awarded: true,
    pet: syncPetState(rewarded, now),
    experience: PET_COMPANION_EXPERIENCE,
    bond: awardedBond,
    gameLabel,
  };
}
