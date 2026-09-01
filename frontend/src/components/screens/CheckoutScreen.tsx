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
  const [submittedRemotely, setSubmittedRemotely] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cartItems = progress.cart
    .map(c => ({ ...c, product: getProductById(c.productId) }))
    .filter(c => c.product);

  const total = cartItems.reduce((s, c) => s + (c.product!.price * c.quantity), 0);

  const canSubmit = cartItems.length > 0 && name.trim().length >= 2 && phone.trim().length >= 7;

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    const orderData = {
      items: progress.cart,
      total,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
    };

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const orderApiUrl = import.meta.env.VITE_ORDER_API_URL;
      if (orderApiUrl) {
        const response = await fetch(orderApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData),
        });
        if (!response.ok) throw new Error(`Order API returned ${response.status}`);
        setSubmittedRemotely(true);
      }

      setOrderId(placeOrder(orderData));
    } catch {
      setSubmitError('Не удалось отправить заказ. Проверьте соединение и попробуйте ещё раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderId) {
    return (
      <div className="h-full flex flex-col bg-dark-surface">
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
          <p className="text-white/40 text-xs mt-3 text-center">
            {submittedRemotely
              ? 'Заявка отправлена менеджеру для подтверждения'
              : 'Заявка сохранена на этом устройстве. Отправка менеджеру пока не настроена'}
          </p>
          <Button className="mt-6" onClick={() => navigate('/shop')}>
            В магазин
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-surface">
      {/* Header */}
      <div className="screen-safe-header pb-4 px-5">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Назад в корзину" onClick={() => navigate('/shop/cart')} className="min-w-11 min-h-11 flex items-center justify-center text-white/50 hover:text-primary transition-colors">
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
            <label htmlFor="checkout-name" className="text-white/50 text-xs block mb-1.5">Имя *</label>
            <input
              id="checkout-name"
              name="name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ваше имя"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/30"
            />
          </div>
          <div>
            <label htmlFor="checkout-phone" className="text-white/50 text-xs block mb-1.5">Телефон *</label>
            <input
              id="checkout-phone"
              name="phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+7 (999) 123-45-67"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/30"
            />
          </div>
          <div>
            <label htmlFor="checkout-email" className="text-white/50 text-xs block mb-1.5">Email (необязательно)</label>
            <input
              id="checkout-email"
              name="email"
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

        {submitError && (
          <p className="text-sm text-red-400" role="alert">{submitError}</p>
        )}

        <Button className="w-full" onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? 'Отправляем…' : 'Подтвердить заказ'}
        </Button>
      </div>
    </div>
  );
}
