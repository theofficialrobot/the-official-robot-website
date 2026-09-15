import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { FALLBACK_WARRANTY_PLANS, warrantyAmount } from './api';

const KEY = 'or_cart_v1';
const CartContext = createContext(null);

function migrate(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    ...item,
    qty: Math.max(1, Number(item.qty) || 1),
    warrantyId: item.warrantyId || '3yr',
    serviceRequested: item.serviceRequested === true
  };
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.map(migrate).filter(Boolean) : [];
  } catch { return []; }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  }, [items]);

  const value = useMemo(() => {
    const count = items.reduce((n, i) => n + (i.qty || 1), 0);
    const subtotal = items.reduce((n, i) => n + (Number(i.price) || 0) * (i.qty || 1), 0);
    const warrantyTotal = items.reduce(
      (n, i) => n + warrantyAmount(i.price, i.qty, i.warrantyId || '3yr', FALLBACK_WARRANTY_PLANS),
      0
    );
    return {
      items,
      count,
      subtotal,
      warrantyTotal,
      add(robot, { variant = '', qty = 1, warrantyId = '3yr', serviceRequested = false } = {}) {
        const price = (robot.variants || []).find((v) => v.id === variant)?.price ?? robot.price;
        setItems((prev) => {
          const key = robot.id + '::' + (variant || '');
          const found = prev.find((i) => i.key === key);
          if (found) {
            return prev.map((i) => i.key === key ? {
              ...i,
              qty: i.qty + qty,
              serviceRequested: i.serviceRequested || Boolean(serviceRequested)
            } : i);
          }
          return prev.concat([{
            key,
            robotId: robot.id,
            variant,
            qty,
            name: robot.name,
            maker: robot.maker,
            price,
            image: robot.image,
            condition: robot.condition,
            type: robot.type,
            warrantyId: warrantyId || '3yr',
            serviceRequested: Boolean(serviceRequested)
          }]);
        });
      },
      setQty(key, qty) {
        const n = Math.max(0, Number(qty) || 0);
        setItems((prev) => n <= 0 ? prev.filter((i) => i.key !== key) : prev.map((i) => i.key === key ? { ...i, qty: n } : i));
      },
      setWarranty(key, warrantyId) {
        const id = warrantyId || '3yr';
        setItems((prev) => prev.map((i) => i.key === key ? { ...i, warrantyId: id } : i));
      },
      setServiceRequested(key, serviceRequested) {
        setItems((prev) => prev.map((i) => i.key === key ? { ...i, serviceRequested: Boolean(serviceRequested) } : i));
      },
      remove(key) { setItems((prev) => prev.filter((i) => i.key !== key)); },
      clear() { setItems([]); }
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart outside provider');
  return ctx;
}
