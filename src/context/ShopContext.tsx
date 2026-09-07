import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, CartItem } from '../types';
import { db, collection, getDocs, handleFirestoreError, OperationType } from '../lib/firebase';
import { products as staticProducts } from '../data';

interface ShopContextType {
  products: Product[];
  allProducts: Product[];
  isProductsLoaded: boolean;
  refreshProducts: () => Promise<void>;
  cart: CartItem[];
  wishlist: Product[];
  recentlyViewed: Product[];
  addToCart: (product: Product, size: string, quantity?: number) => void;
  updateCartQuantity: (productId: string, size: string, qty: number) => void;
  removeFromCart: (productId: string, size: string) => void;
  toggleWishlist: (product: Product) => void;
  isInWishlist: (productId: string) => boolean;
  addToRecentlyViewed: (product: Product) => void;
  cartCount: number;
  wishlistCount: number;
  cartSubtotal: number;
  couponCode: string;
  discountAmount: number;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }> | { success: boolean; message: string };
  removeCoupon: () => void;
  clearCart: () => void;
  toast: { message: string; visible: boolean } | null;
  showToast: (message: string) => void;
  hideToast: () => void;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allProducts, setAllProducts] = useState<Product[]>(staticProducts);
  const [products, setProducts] = useState<Product[]>(() => staticProducts.filter(p => p.status !== 'draft' && p.status !== 'archived' && !p.isDecommissioned));
  const [isProductsLoaded, setIsProductsLoaded] = useState(false);

  const refreshProducts = async () => {
    try {
      let fetched: Product[] = [];
      try {
        const querySnapshot = await getDocs(collection(db, 'products'));
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          fetched.push({
            id: docSnap.id,
            ...data
          } as Product);
        });
      } catch (fbErr) {
        console.warn('Failed to fetch products from Firebase (expected if offline or using static data):', fbErr);
      }

      // 1. Load locally created/modified custom products
      const localCustom = localStorage.getItem('kora_custom_products');
      const customProducts: Product[] = localCustom ? JSON.parse(localCustom) : [];

      // 2. Load locally deleted product IDs
      const localDeleted = localStorage.getItem('kora_deleted_products');
      const deletedIds: string[] = localDeleted ? JSON.parse(localDeleted) : [];

      // 3. Merge products preferring: localCustom > fetched > static
      const merged = [
        ...staticProducts.filter(p => 
          !fetched.some(f => f.id === p.id) && 
          !customProducts.some(c => c.id === p.id) &&
          !deletedIds.includes(p.id)
        ),
        ...fetched.filter(f => 
          !customProducts.some(c => c.id === f.id) &&
          !deletedIds.includes(f.id)
        ),
        ...customProducts.filter(c => !deletedIds.includes(c.id))
      ];

      staticProducts.length = 0;
      staticProducts.push(...merged);

      setAllProducts(merged);
      setProducts(merged.filter(p => p.status !== 'draft' && p.status !== 'archived' && !p.isDecommissioned));
    } catch (error) {
      console.error('Error loading products from Firebase:', error);
      handleFirestoreError(error, OperationType.GET, 'products');
    } finally {
      setIsProductsLoaded(true);
    }
  };

  useEffect(() => {
    refreshProducts();
  }, []);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('kora_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('kora_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('kora_recent');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [couponCode, setCouponCode] = useState<string>(() => {
    return localStorage.getItem('kora_coupon') || '';
  });

  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('kora_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('kora_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem('kora_recent', JSON.stringify(recentlyViewed));
  }, [recentlyViewed]);

  useEffect(() => {
    if (couponCode) {
      localStorage.setItem('kora_coupon', couponCode);
    } else {
      localStorage.removeItem('kora_coupon');
    }
  }, [couponCode]);

  // Toast controls
  const showToast = (message: string) => {
    setToast({ message, visible: true });
  };

  const hideToast = () => {
    setToast(prev => prev ? { ...prev, visible: false } : null);
  };

  useEffect(() => {
    if (toast?.visible) {
      const timer = setTimeout(() => {
        hideToast();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Cart operations
  const addToCart = (product: Product, size: string, quantity = 1) => {
    if (product.status === 'archived' || product.isDecommissioned) {
      showToast(`"${product.name}" has been discontinued and is no longer available.`);
      return;
    }
    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(
        item => item.product.id === product.id && item.selectedSize === size
      );

      if (existingIndex > -1) {
        const updated = [...prevCart];
        updated[existingIndex].quantity += quantity;
        return updated;
      } else {
        return [...prevCart, { product, selectedSize: size, quantity }];
      }
    });
    showToast(`"${product.name}" (${size}) added to your bag.`);
  };

  const updateCartQuantity = (productId: string, size: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId, size);
      return;
    }
    setCart(prevCart =>
      prevCart.map(item =>
        item.product.id === productId && item.selectedSize === size
          ? { ...item, quantity: qty }
          : item
      )
    );
  };

  const removeFromCart = (productId: string, size: string) => {
    const item = cart.find(i => i.product.id === productId && i.selectedSize === size);
    setCart(prevCart =>
      prevCart.filter(item => !(item.product.id === productId && item.selectedSize === size))
    );
    if (item) {
      showToast(`Removed "${item.product.name}" from your bag.`);
    }
  };

  const clearCart = () => {
    setCart([]);
    setCouponCode('');
  };

  // Wishlist operations
  const toggleWishlist = (product: Product) => {
    let message = '';
    setWishlist(prev => {
      const isExist = prev.some(item => item.id === product.id);
      if (isExist) {
        message = `Removed "${product.name}" from wishlist.`;
        return prev.filter(item => item.id !== product.id);
      } else {
        message = `Added "${product.name}" to wishlist.`;
        return [...prev, product];
      }
    });
    setTimeout(() => showToast(message), 50);
  };

  const isInWishlist = (productId: string) => {
    return wishlist.some(item => item.id === productId);
  };

  // Recently viewed
  const addToRecentlyViewed = (product: Product) => {
    setRecentlyViewed(prev => {
      const filtered = prev.filter(item => item.id !== product.id);
      return [product, ...filtered].slice(0, 6); // Keep last 6 items
    });
  };

  // Calculations
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const wishlistCount = wishlist.length;
  const cartSubtotal = cart.reduce((total, item) => total + item.product.price * item.quantity, 0);

  // Coupons
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);

  useEffect(() => {
    if (!couponCode) {
      setAppliedDiscount(0);
      return;
    }

    let isMounted = true;
    const itemsPayload = cart.map(item => ({
      product_id: item.product.id,
      id: item.product.id,
      price: item.product.price,
      quantity: item.quantity,
      category: item.product.category,
      subCategory: item.product.subCategory
    }));

    fetch('/api/promotions/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promo_code: couponCode,
        items: itemsPayload
      })
    })
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data.valid && typeof data.discount_amount === 'number') {
          setAppliedDiscount(data.discount_amount);
        } else {
          setCouponCode('');
          setAppliedDiscount(0);
          showToast(data.message || 'Promo code removed: no longer applicable to your cart.');
        }
      })
      .catch(() => {
        if (!isMounted) return;
        let fallbackDisc = 0;
        const upper = couponCode.toUpperCase();
        if (upper === 'KORA10') fallbackDisc = Math.round(cartSubtotal * 0.10);
        else if (upper === 'FRESH15') fallbackDisc = Math.round(cartSubtotal * 0.15);
        else if (upper === 'LINENLOVE') fallbackDisc = Math.round(cartSubtotal * 0.20);
        setAppliedDiscount(fallbackDisc);
      });

    return () => { isMounted = false; };
  }, [couponCode, cartSubtotal, cart.length]);

  const discountAmount = appliedDiscount;

  const applyCoupon = async (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, message: 'Please enter a promo code.' };
    }

    const itemsPayload = cart.map(item => ({
      product_id: item.product.id,
      id: item.product.id,
      price: item.product.price,
      quantity: item.quantity,
      category: item.product.category,
      subCategory: item.product.subCategory
    }));

    try {
      const res = await fetch('/api/promotions/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promo_code: cleanCode,
          items: itemsPayload
        })
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        setCouponCode(cleanCode);
        setAppliedDiscount(data.discount_amount || 0);
        return { success: true, message: data.message || `Promo code "${cleanCode}" applied successfully!` };
      } else {
        return { success: false, message: data.message || 'Invalid promo code.' };
      }
    } catch (err) {
      console.warn('Promo validation endpoint error. Falling back to local check:', err);
      let fallbackMsg = '';
      let fallbackDisc = 0;
      if (cleanCode === 'KORA10') {
        fallbackDisc = Math.round(cartSubtotal * 0.10);
        fallbackMsg = 'Coupon "KORA10" applied successfully!';
      } else if (cleanCode === 'FRESH15') {
        fallbackDisc = Math.round(cartSubtotal * 0.15);
        fallbackMsg = 'Coupon "FRESH15" applied successfully!';
      } else if (cleanCode === 'LINENLOVE') {
        fallbackDisc = Math.round(cartSubtotal * 0.20);
        fallbackMsg = 'Coupon "LINENLOVE" applied successfully!';
      } else {
        return { success: false, message: 'Invalid promo code.' };
      }

      setCouponCode(cleanCode);
      setAppliedDiscount(fallbackDisc);
      return { success: true, message: fallbackMsg };
    }
  };

  const removeCoupon = () => {
    setCouponCode('');
    setAppliedDiscount(0);
  };

  return (
    <ShopContext.Provider
      value={{
        products,
        allProducts,
        isProductsLoaded,
        refreshProducts,
        cart,
        wishlist,
        recentlyViewed,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        toggleWishlist,
        isInWishlist,
        addToRecentlyViewed,
        cartCount,
        wishlistCount,
        cartSubtotal,
        couponCode,
        discountAmount,
        applyCoupon,
        removeCoupon,
        clearCart,
        toast,
        showToast,
        hideToast
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const context = useContext(ShopContext);
  if (context === undefined) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
};
