import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useGameContext } from '@/store/GameContext';
import { getProductById } from '@/data/shopData';

export function CheckoutScreen() {
  const navigate = useNavigate();
  const { progress, placeOrder } = useGameContext();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);

  const cartItems = progress.cart
    .map(c => ({ ...c, product: getProductById(c.productId) }))
    .filter(c => c.product);

  const total = cartItems.reduce((s, c) => s + (c.product!.price * c.quantity), 0);

  const canSubmit = name.trim().length >= 2 && phone.trim().length >= 7;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const id = placeOrder({
      items: progress.cart,
      total,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
    });
    setOrderId(id);
  };

  if (orderId) {
    return (
      <div className="h-full flex flex-col bg-dark-surface pb-20">
        <div className="flex-1 flex flex-col items-center justify-center px-5">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            <CheckCircle size={64} className="text-primary mb-4 mx-auto" />
          </motion.div>
          <h3 className="font-heading text-xl font-bold text-primary">Заказ оформлен!</h3>
          <p className="text-white/50 text-sm mt-2">Номер заказа: {orderId}</p>
          <p className="text-white/40 text-xs mt-3 text-center">Менеджер свяжется с вами для подтверждения</p>
          <Button className="mt-6" onClick={() => navigate('/shop')}>
            В магазин
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-surface pb-20">
      {/* Header */}
      <div className="pt-10 pb-4 px-5">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/shop/cart')} className="text-white/50 hover:text-primary transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-heading text-sm font-bold text-primary tracking-wider uppercase">Оформление</h2>
          <div className="w-5" />
        </div>
      </div>
      <div className="gold-separator" />

      <div className="flex-1 overflow-y-auto phone-scroll px-5 py-4 space-y-4">
        {/* Form */}
        <div className="space-y-3">
          <div>
            <label className="text-white/50 text-xs block mb-1.5">Имя *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ваше имя"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/30"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs block mb-1.5">Телефон *</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+7 (999) 123-45-67"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/30"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs block mb-1.5">Email (необязательно)</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/30"
            />
          </div>
        </div>

        <div className="gold-separator" />

        {/* Order summary */}
        <div>
          <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-primary mb-3">Ваш заказ</h3>
          <div className="space-y-2">
            {cartItems.map(({ productId, quantity, product }) => (
              <div key={productId} className="flex justify-between text-sm">
                <span className="text-white/60">{product!.name} × {quantity}</span>
                <span className="text-white/80">{product!.price * quantity} ₽</span>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 mt-3 pt-3 flex justify-between">
            <span className="text-white/50 font-medium">Итого:</span>
            <span className="text-primary font-bold">{total} ₽</span>
          </div>
        </div>

        <Button className="w-full" onClick={handleSubmit} disabled={!canSubmit}>
          Подтвердить заказ
        </Button>
      </div>
    </div>
  );
}
