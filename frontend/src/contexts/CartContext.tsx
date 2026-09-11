import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { useStore } from './StoreContext';
import { trackStoreAddToCart } from '../utils/storePixelTracking';
import toast from 'react-hot-toast';

export interface CartItem {
  productId: number;
  productName: string;
  sku: string;
  imageUrl: string | null;
  variantName?: string | null;
  variantOptionId?: string | null;
  quantity: number;
  unitPriceMad: number;
  totalPriceMad: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'totalPriceMad'>, openDrawer?: boolean) => void;
  removeItem: (productId: number, variantOptionId?: string | null) => void;
  updateQuantity: (productId: number, variantOptionId: string | null | undefined, quantity: number) => void;
  clearCart: () => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  itemsCount: number;
  /**
   * True once the cart has been read back for the *resolved* store.
   *
   * `store` arrives from a fetch, so the first renders run with storeId 0 and
   * an empty cart under the wrong storage key. Anything that reacts to "the
   * cart is empty" — the checkout page redirects on it — has to wait for this,
   * or it fires against a cart that simply has not loaded yet.
   */
  hydrated: boolean;
  subtotalMad: number;
  shippingFeeMad: number;
  totalAmountMad: number;
  freeShippingRemainingMad: number | null;
}

const CartContext = createContext<CartContextType>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  isDrawerOpen: false,
  setIsDrawerOpen: () => {},
  itemsCount: 0,
  hydrated: false,
  subtotalMad: 0,
  shippingFeeMad: 0,
  totalAmountMad: 0,
  freeShippingRemainingMad: null,
});

export const useCart = () => useContext(CartContext);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { store, pixels } = useStore();
  const storeId = store?.id || 0;

  const storageKey = useMemo(() => `store_cart_${storeId}`, [storeId]);

  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Sync with storage on store switch
  useEffect(() => {
    if (!storeId) return;
    try {
      const saved = localStorage.getItem(storageKey);
      setItems(saved ? JSON.parse(saved) : []);
    } catch {
      setItems([]);
    }
    setHydrated(true);
  }, [storageKey, storeId]);

  // Persist items
  useEffect(() => {
    if (!storeId) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to persist cart:', e);
    }
  }, [items, storageKey, storeId]);

  const addItem = (newItem: Omit<CartItem, 'totalPriceMad'>, openDrawer = true) => {
    setItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) => it.productId === newItem.productId && it.variantOptionId === (newItem.variantOptionId || null)
      );

      if (existingIdx > -1) {
        const updated = [...prev];
        const current = updated[existingIdx];
        const newQty = Math.min(99, current.quantity + (newItem.quantity || 1));
        updated[existingIdx] = {
          ...current,
          quantity: newQty,
          totalPriceMad: newQty * current.unitPriceMad,
        };
        return updated;
      }

      const qty = Math.max(1, Math.min(99, newItem.quantity || 1));
      const entry: CartItem = {
        ...newItem,
        variantOptionId: newItem.variantOptionId || null,
        variantName: newItem.variantName || null,
        quantity: qty,
        totalPriceMad: qty * newItem.unitPriceMad,
      };
      return [...prev, entry];
    });

    toast.success('Produit ajouté au panier !');

    trackStoreAddToCart(pixels, {
      productId: newItem.productId,
      title: newItem.productName,
      price: newItem.unitPriceMad,
      quantity: newItem.quantity || 1,
      currency: store?.currency || 'MAD',
    });

    if (openDrawer) {
      setIsDrawerOpen(true);
    }
  };

  const removeItem = (productId: number, variantOptionId?: string | null) => {
    setItems((prev) =>
      prev.filter((it) => !(it.productId === productId && it.variantOptionId === (variantOptionId || null)))
    );
  };

  const updateQuantity = (productId: number, variantOptionId: string | null | undefined, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, variantOptionId);
      return;
    }

    const safeQty = Math.min(99, quantity);
    setItems((prev) =>
      prev.map((it) => {
        if (it.productId === productId && it.variantOptionId === (variantOptionId || null)) {
          return {
            ...it,
            quantity: safeQty,
            totalPriceMad: safeQty * it.unitPriceMad,
          };
        }
        return it;
      })
    );
  };

  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  };

  const itemsCount = useMemo(() => items.reduce((acc, it) => acc + it.quantity, 0), [items]);

  const subtotalMad = useMemo(() => items.reduce((acc, it) => acc + it.totalPriceMad, 0), [items]);

  const shippingFeeMad = useMemo(() => {
    if (!store) return 0;
    if (store.freeShippingThreshold !== null && subtotalMad >= store.freeShippingThreshold) {
      return 0;
    }
    return store.standardShippingFee || 0;
  }, [store, subtotalMad]);

  const totalAmountMad = subtotalMad + shippingFeeMad;

  const freeShippingRemainingMad = useMemo(() => {
    if (!store || store.freeShippingThreshold === null) return null;
    const remaining = store.freeShippingThreshold - subtotalMad;
    return remaining > 0 ? remaining : 0;
  }, [store, subtotalMad]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        isDrawerOpen,
        setIsDrawerOpen,
        itemsCount,
        hydrated,
        subtotalMad,
        shippingFeeMad,
        totalAmountMad,
        freeShippingRemainingMad,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
