import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider } from '@/store/GameContext';
import { SplashScreen } from '@/components/screens/SplashScreen';
import { MainMenu } from '@/components/screens/MainMenu';
import { LevelMap } from '@/components/screens/LevelMap';
import { GameScreen } from '@/components/screens/GameScreen';
import { ShopScreen } from '@/components/screens/ShopScreen';

export default function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <div className="h-screen w-screen overflow-hidden bg-game-bg">
          <Routes>
            <Route path="/" element={<SplashScreen />} />
            <Route path="/menu" element={<MainMenu />} />
            <Route path="/map" element={<LevelMap />} />
            <Route path="/game/:id" element={<GameScreen />} />
            <Route path="/shop" element={<ShopScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </GameProvider>
  );
}
