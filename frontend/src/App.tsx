import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider } from '@/store/GameContext';
import { BottomNav } from '@/components/ui/BottomNav';
import { SplashScreen } from '@/components/screens/SplashScreen';
import { GameHub } from '@/components/screens/GameHub';
import { BathhouseMap } from '@/components/screens/BathhouseMap';
import { BathhousesScreen } from '@/components/screens/BathhousesScreen';
import { LevelMap } from '@/components/screens/LevelMap';
import { GameScreen } from '@/components/screens/GameScreen';
import { Game2048Screen } from '@/components/screens/Game2048Screen';
import { BubbleShooterScreen } from '@/components/screens/BubbleShooterScreen';
import { TamagotchiScreen } from '@/components/screens/TamagotchiScreen';
import { ShopScreen } from '@/components/screens/ShopScreen';
import { CartScreen } from '@/components/screens/CartScreen';
import { CheckoutScreen } from '@/components/screens/CheckoutScreen';
import { TermlinyCollection } from '@/components/screens/TermlinyCollection';
import { TermlinDetail } from '@/components/screens/TermlinDetail';
import { ProfileScreen } from '@/components/screens/ProfileScreen';

export default function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        {/* Desktop: centered phone frame. Mobile: fullscreen */}
        <div className="h-screen w-screen flex items-center justify-center bg-dark-surface">
          {/* Phone container */}
          <div className="phone-frame bg-dark-surface relative flex flex-col">
            {/* Notch */}
            <div className="phone-notch" />

            {/* Screen content */}
            <div className="flex-1 overflow-hidden relative">
              <Routes>
                <Route path="/" element={<SplashScreen />} />
                <Route path="/games" element={<GameHub />} />
                <Route path="/bathhouses" element={<BathhousesScreen />} />
                <Route path="/games/match3" element={<BathhouseMap />} />
                <Route path="/games/match3/levels/:bathhouseId" element={<LevelMap />} />
                <Route path="/games/match3/play/:id" element={<GameScreen />} />
                <Route path="/games/2048" element={<Game2048Screen />} />
                <Route path="/games/bubbles" element={<BubbleShooterScreen />} />
                <Route path="/games/pet" element={<TamagotchiScreen />} />
                <Route path="/shop" element={<ShopScreen />} />
                <Route path="/shop/cart" element={<CartScreen />} />
                <Route path="/shop/checkout" element={<CheckoutScreen />} />
                <Route path="/collection" element={<TermlinyCollection />} />
                <Route path="/collection/:id" element={<TermlinDetail />} />
                <Route path="/profile" element={<ProfileScreen />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <BottomNav />
            </div>
          </div>
        </div>
      </BrowserRouter>
    </GameProvider>
  );
}
