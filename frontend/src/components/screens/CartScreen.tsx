import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useGameContext } from '@/store/GameContext';
import { getProductById } from '@/data/shopData';

export function CartScreen() {
  const navigate = useNavigate();
  const { progress, updateCartQty, removeFromCart } = useGameContext();

  const cartItems = progress.cart
    .map(c => ({ ...c, product: getProductById(c.productId) }))
    .filter(c => c.product);

  const total = cartItems.reduce((s, c) => s + (c.product!.price * c.quantity), 0);

  if (cartItems.length === 0) {
    return (
      <div className="h-full flex flex-col bg-dark-surface pb-20">
        <div className="pt-10 pb-4 px-5">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/shop')} className="text-white/50 hover:text-primary transition-colors">
              <ArrowLeft size={20} />
            </button>
            <h2 className="font-heading text-sm font-bold text-primary tracking-wider uppercase">Корзина</h2>
            <div className="w-5" />
          </div>
        </div>
        <div className="gold-separator" />
        <div className="flex-1 flex flex-col items-center justify-center">
          <ShoppingBag size={48} className="text-white/20 mb-4" />
          <p className="text-white/40 text-sm">Корзина пуста</p>
          <button onClick={() => navigate('/shop')} className="text-primary text-sm mt-3 underline">
            Перейти в магазин
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-surface pb-20">
      {/* Header */}
      <div className="pt-10 pb-4 px-5">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/shop')} className="text-white/50 hover:text-primary transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-heading text-sm font-bold text-primary tracking-wider uppercase">Корзина</h2>
          <div className="w-5" />
        </div>
      </div>
      <div className="gold-separator" />

      {/* Items */}
      <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-3">
        {cartItems.map(({ productId, quantity, product }) => (
          <div key={productId} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-white/90">{product!.name}</p>
                <p className="text-primary text-xs mt-1">{product!.price} ₽</p>
              </div>
              <button onClick={() => removeFromCart(productId)} className="text-white/30 hover:text-red-400 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateCartQty(productId, quantity - 1)}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60"
                >
                  <Minus size={14} />
                </button>
                <span className="text-white font-bold text-sm w-6 text-center">{quantity}</span>
                <button
                  onClick={() => updateCartQty(productId, quantity + 1)}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60"
                >
                  <Plus size={14} />
                </button>
              </div>
              <p className="text-white/60 text-sm font-medium">{product!.price * quantity} ₽</p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 pb-4">
        <div className="gold-separator mb-4" />
        <div className="flex items-center justify-between mb-3">
          <span className="text-white/50 text-sm">Итого:</span>
          <span className="text-primary font-bold text-lg">{total} ₽</span>
        </div>
        <Button className="w-full" onClick={() => navigate('/shop/checkout')}>
          Оформить заказ
        </Button>
      </div>
    </div>
  );
}
