import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLevelConfig } from '@/data/levels';
import { getBathhouseForLevel } from '@/data/bathhouses';
import { useGame } from '@/hooks/useGame';
import { useGameContext } from '@/store/GameContext';
import { getStars, getReward } from '@/engine/scorer';
import { GameBoard } from '@/components/game/GameBoard';
import { GameHUD } from '@/components/game/GameHUD';
import { ComboText } from '@/components/game/ComboText';
import { WinPopup } from '@/popups/WinPopup';
import { LosePopup } from '@/popups/LosePopup';
import { PausePopup } from '@/popups/PausePopup';
import { LevelStartPopup } from '@/popups/LevelStartPopup';

export function GameScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { completeLevelAction } = useGameContext();
  const levelId = Number(id) || 1;
  const config = getLevelConfig(levelId);
  const bathhouse = getBathhouseForLevel(levelId);

  const [showStart, setShowStart] = useState(true);
  const [showPause, setShowPause] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  const safeConfig = config ?? getLevelConfig(1)!;
  const game = useGame(safeConfig);
  const { state, animData, handleCellClick, handleSwipe, advanceAnimation, resetGame } = game;

  useEffect(() => {
    if (state.isWon && !hasCompleted) {
      setHasCompleted(true);
      const stars = getStars(state.score, state.levelConfig.starThresholds);
      const reward = getReward(stars, state.levelConfig.reward);
      completeLevelAction(levelId, stars, state.score, reward);
    }
  }, [state.isWon, hasCompleted, state.score, state.levelConfig, levelId, completeLevelAction]);

  const handleRestart = useCallback(() => {
    setShowPause(false);
    setHasCompleted(false);
    resetGame(safeConfig);
  }, [safeConfig, resetGame]);

  const handleNext = useCallback(() => {
    const nextConfig = getLevelConfig(levelId + 1);
    if (nextConfig) {
      navigate(`/game/${levelId + 1}`);
      setHasCompleted(false);
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

      <LevelStartPopup
        open={showStart}
        config={safeConfig}
        onStart={handleStartPlay}
        onBack={() => navigate(bathhouse ? `/levels/${bathhouse.id}` : '/map')}
      />

      <WinPopup
        open={state.isWon}
        score={state.score}
        levelConfig={state.levelConfig}
        onNext={handleNext}
        onMap={() => navigate(bathhouse ? `/levels/${bathhouse.id}` : '/map')}
      />

      <LosePopup
        open={state.isLost}
        onRetry={handleRestart}
        onMap={() => navigate(bathhouse ? `/levels/${bathhouse.id}` : '/map')}
      />

      <PausePopup
        open={showPause}
        onResume={() => setShowPause(false)}
        onRestart={handleRestart}
        onQuit={() => navigate(bathhouse ? `/levels/${bathhouse.id}` : '/map')}
      />
    </div>
  );
}
