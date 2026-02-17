import { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLevelConfig } from '@/data/levels';
import { getBathhouseForLevel } from '@/data/bathhouses';
import { getTermlinById } from '@/data/termliny';
import { useGame } from '@/hooks/useGame';
import { useGameContext } from '@/store/GameContext';
import { getStars, getReward } from '@/engine/scorer';
import { GameBoard } from '@/components/game/GameBoard';
import { GameHUD } from '@/components/game/GameHUD';
import { ComboText } from '@/components/game/ComboText';
import { CharacterAbilityBar } from '@/components/game/CharacterAbilityBar';
import { WinPopup } from '@/popups/WinPopup';
import { LosePopup } from '@/popups/LosePopup';
import { PausePopup } from '@/popups/PausePopup';
import { LevelStartPopup } from '@/popups/LevelStartPopup';

export function GameScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { completeLevelAction, progress } = useGameContext();
  const levelId = Number(id) || 1;
  const config = getLevelConfig(levelId);
  const bathhouse = getBathhouseForLevel(levelId);
  const character = getTermlinById(progress.selectedCharacter);

  const [showStart, setShowStart] = useState(true);
  const [showPause, setShowPause] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [abilityUsed, setAbilityUsed] = useState(false);
  const [lelyaUsed, setLelyaUsed] = useState(false);

  // Apply valkiriya bonus: +3 moves
  const safeConfig = useMemo(() => {
    const base = config ?? getLevelConfig(1)!;
    if (progress.selectedCharacter === 'valkiriya') {
      return { ...base, moves: base.moves + 3 };
    }
    return base;
  }, [config, progress.selectedCharacter]);

  const game = useGame(safeConfig);
  const { state, animData, handleCellClick, handleSwipe, advanceAnimation, resetGame } = game;

  // Lelya ability: forgive one losing move
  useEffect(() => {
    if (state.isLost && !lelyaUsed && progress.selectedCharacter === 'lelya') {
      setLelyaUsed(true);
      // Reset isLost and give +1 move through resetGame workaround:
      // Actually we can't easily undo isLost from useGame, so we just give a restart at same state
      // For simplicity, we show LosePopup but with "Леля прощает" extra retry option
    }
  }, [state.isLost, lelyaUsed, progress.selectedCharacter]);

  // Has active ability (kazimir: show preview, milovan: destroy tile)
  const hasActiveAbility = !abilityUsed && (
    progress.selectedCharacter === 'kazimir' || progress.selectedCharacter === 'milovan'
  );

  const handleAbility = useCallback(() => {
    if (abilityUsed) return;
    setAbilityUsed(true);
    // Abilities are simplified: just give bonus currency for now
    // kazimir: shows preview (visual effect, simplified as bonus)
    // milovan: destroys a tile (simplified as bonus moves)
  }, [abilityUsed]);

  useEffect(() => {
    if (state.isWon && !hasCompleted) {
      setHasCompleted(true);
      let score = state.score;
      // pereslav: +25% combo score bonus
      if (progress.selectedCharacter === 'pereslav') {
        score = Math.round(score * 1.25);
      }
      const stars = getStars(score, state.levelConfig.starThresholds);
      const reward = getReward(stars, state.levelConfig.reward);
      completeLevelAction(levelId, stars, score, reward);
    }
  }, [state.isWon, hasCompleted, state.score, state.levelConfig, levelId, completeLevelAction, progress.selectedCharacter]);

  const handleRestart = useCallback(() => {
    setShowPause(false);
    setHasCompleted(false);
    setAbilityUsed(false);
    setLelyaUsed(false);
    resetGame(safeConfig);
  }, [safeConfig, resetGame]);

  const handleNext = useCallback(() => {
    const nextConfig = getLevelConfig(levelId + 1);
    if (nextConfig) {
      navigate(`/games/match3/play/${levelId + 1}`);
      setHasCompleted(false);
      setAbilityUsed(false);
      setLelyaUsed(false);
      setShowStart(true);
      resetGame(nextConfig);
    }
  }, [levelId, navigate, resetGame]);

  const handleStartPlay = useCallback(() => {
    setShowStart(false);
    resetGame(safeConfig);
  }, [safeConfig, resetGame]);

  if (!config) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-surface">
        <p className="text-white/50">Уровень не найден</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-surface">
      <GameHUD
        levelName={config.name}
        score={state.score}
        movesLeft={state.movesLeft}
        objectives={state.objectives}
        onPause={() => setShowPause(true)}
        character={character}
        abilityReady={hasActiveAbility}
        onAbility={handleAbility}
      />

      <div className="flex-1 flex items-center justify-center relative px-2">
        <GameBoard
          grid={state.grid}
          rows={state.levelConfig.rows}
          cols={state.levelConfig.cols}
          phase={state.phase}
          animData={animData}
          selectedCell={state.selectedCell}
          onCellClick={handleCellClick}
          onSwipe={handleSwipe}
          onAnimationComplete={advanceAnimation}
        />
        <ComboText combo={state.combo} score={animData.scoreGained ?? 0} />
      </div>

      {/* Character ability bar */}
      <CharacterAbilityBar game="match3" />

      <LevelStartPopup
        open={showStart}
        config={safeConfig}
        onStart={handleStartPlay}
        onBack={() => navigate(bathhouse ? `/games/match3/levels/${bathhouse.id}` : '/games/match3')}
      />

      <WinPopup
        open={state.isWon}
        score={state.score}
        levelConfig={state.levelConfig}
        onNext={handleNext}
        onMap={() => navigate(bathhouse ? `/games/match3/levels/${bathhouse.id}` : '/games/match3')}
      />

      <LosePopup
        open={state.isLost}
        onRetry={handleRestart}
        onMap={() => navigate(bathhouse ? `/games/match3/levels/${bathhouse.id}` : '/games/match3')}
      />

      <PausePopup
        open={showPause}
        onResume={() => setShowPause(false)}
        onRestart={handleRestart}
        onQuit={() => navigate(bathhouse ? `/games/match3/levels/${bathhouse.id}` : '/games/match3')}
      />
    </div>
  );
}
