import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const frontendRoot = join(repoRoot, 'frontend', 'src');

function readSource(relativePath) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function collectSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(absolutePath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
  });
}

const tamagotchiSource = readSource('frontend/src/components/screens/TamagotchiScreen.tsx');
const hookSource = readSource('frontend/src/hooks/usePetCompanion.ts');
const contextSource = readSource('frontend/src/store/GameContext.tsx');
const winPopupSource = readSource('frontend/src/popups/WinPopup.tsx');
const win2048PopupSource = readSource('frontend/src/popups/Win2048Popup.tsx');

const gameScreens = [
  {
    game: 'match3',
    path: 'frontend/src/components/screens/GameScreen.tsx',
    resultPattern: /<WinPopup\b[\s\S]*?open=\{state\.isWon\}[\s\S]*?companionReward=\{petCompanion\.reward\}/,
    resultComponentSource: winPopupSource,
  },
  {
    game: 'game2048',
    path: 'frontend/src/components/screens/Game2048Screen.tsx',
    resultPattern: /<Win2048Popup\b[\s\S]*?open=\{state\.isWon\}[\s\S]*?companionReward=\{petCompanion\.reward\}/,
    resultComponentSource: win2048PopupSource,
  },
  {
    game: 'bubbles',
    path: 'frontend/src/components/screens/BubbleShooterScreen.tsx',
    resultPattern: /<Modal\b[^>]*\bopen=\{state\.isWon\}[^>]*>[\s\S]*?<PetCompanionRewardSummary\b[\s\S]*?reward=\{petCompanion\.reward\}/,
  },
].map((entry) => ({ ...entry, source: readSource(entry.path) }));

test('Пестун предлагает ровно три сторонние игры и передаёт сессию в route state', () => {
  const companionGamesBlock = tamagotchiSource.match(
    /const\s+companionGames\s*:[\s\S]*?=\s*\[([\s\S]*?)\n\];/,
  );
  assert.ok(companionGamesBlock, 'не найден список companionGames');

  const gameIds = [...companionGamesBlock[1].matchAll(/\bid\s*:\s*['"]([^'"]+)['"]/g)]
    .map((match) => match[1]);

  assert.equal(gameIds.length, 3, 'в выборе должно быть ровно три игры');
  assert.deepEqual([...gameIds].sort(), ['bubbles', 'game2048', 'match3']);
  assert.equal(gameIds.includes('pet'), false, 'Пестун не должен запускаться из самого себя');

  assert.match(tamagotchiSource, /createPetCompanionSession\(pet\.adoptionId,\s*game\)/);
  assert.match(
    tamagotchiSource,
    /navigate\(getPetCompanionGameRoute\(game,\s*progress\.currentLevel\),\s*\{[\s\S]*?state:\s*createPetCompanionRouteState\(session\)/,
  );
});

test('каждая игра подключает спутника к своей победе', () => {
  for (const { game, path, source } of gameScreens) {
    assert.match(
      source,
      new RegExp(`usePetCompanion\\(\\s*['"]${game}['"]\\s*,\\s*state\\.isWon\\s*\\)`),
      `${path} должен передавать state.isWon в usePetCompanion`,
    );
  }
});

test('экраны не начисляют награду напрямую, а хук запускает её только по isWon', () => {
  assert.match(
    contextSource,
    /const\s+rewardPetCompanionWin\s*=\s*useCallback\([\s\S]*?applyPetCompanionWin\(prev\.pet,\s*session,\s*now\)/,
  );
  assert.match(hookSource, /if\s*\(\s*!isWon[\s\S]*?\)\s*return;[\s\S]*?rewardPetCompanionWin\(session\)/);
  assert.match(hookSource, /\[isWon,\s*pet,\s*rewardPetCompanionWin,\s*session\]/);

  for (const { path, source } of gameScreens) {
    assert.doesNotMatch(source, /\brewardPetCompanionWin\b/, `${path} не должен начислять награду сам`);
  }

  const actionOwners = collectSourceFiles(frontendRoot)
    .filter((file) => /const\s+rewardPetCompanionWin\s*=\s*useCallback/.test(readFileSync(file, 'utf8')))
    .map((file) => relative(frontendRoot, file).replaceAll('\\', '/'));
  assert.deepEqual(actionOwners, ['store/GameContext.tsx']);

  const actionCallers = collectSourceFiles(frontendRoot)
    .filter((file) => /\brewardPetCompanionWin\(session\)/.test(readFileSync(file, 'utf8')))
    .map((file) => relative(frontendRoot, file).replaceAll('\\', '/'));
  assert.deepEqual(actionCallers, ['hooks/usePetCompanion.ts']);
});

test('все три экрана победы показывают сводку награды спутника', () => {
  for (const { path, source, resultPattern, resultComponentSource } of gameScreens) {
    assert.match(source, resultPattern, `${path} не передаёт награду в результат победы`);
    if (resultComponentSource) {
      assert.match(resultComponentSource, /<PetCompanionRewardSummary\b/);
    }
  }
});

test('из каждой совместной игры можно вернуться к питомцу', () => {
  assert.match(hookSource, /exitPath:\s*pet\s*\?\s*['"]\/games\/pet['"]\s*:\s*null/);
  for (const { path, source } of gameScreens) {
    assert.match(source, /petCompanion\.exitPath/, `${path} должен уважать путь возврата к питомцу`);
  }
});
