import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider } from '@/store/GameContext';
import { BottomNav } from '@/components/ui/BottomNav';
import { SplashScreen } from '@/components/screens/SplashScreen';
import { MainMenu } from '@/components/screens/MainMenu';
import { BathhouseMap } from '@/components/screens/BathhouseMap';
import { LevelMap } from '@/components/screens/LevelMap';
import { GameScreen } from '@/components/screens/GameScreen';
import { ShopScreen } from '@/components/screens/ShopScreen';
import { ProfileScreen } from '@/components/screens/ProfileScreen';

export default function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <div className="h-screen w-screen overflow-hidden bg-background max-w-md mx-auto relative">
          <Routes>
            <Route path="/" element={<SplashScreen />} />
            <Route path="/menu" element={<MainMenu />} />
            <Route path="/map" element={<BathhouseMap />} />
            <Route path="/levels/:bathhouseId" element={<LevelMap />} />
            <Route path="/game/:id" element={<GameScreen />} />
            <Route path="/shop" element={<ShopScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <BottomNav />
        </div>
      </BrowserRouter>
    </GameProvider>
  );
}
