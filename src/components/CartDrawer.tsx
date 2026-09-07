import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useShop } from '../context/ShopContext';
import { X, Minus, Plus, ShoppingBag, ArrowRight, Tag, Percent } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const {
    cart,
    updateCartQuantity,
    removeFromCart,
    cartSubtotal,
    couponCode,
    discountAmount,
    applyCoupon,
    removeCoupon
  } = useShop();

  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const navigate = useNavigate();

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');
    setCouponSuccess('');
    if (!couponInput.trim()) return;

    const res = applyCoupon(couponInput);
    if (res.success) {
      setCouponSuccess(res.message);
      setCouponInput('');
    } else {
      setCouponError(res.message);
    }
  };

  const shippingThreshold = 1999;
  const isFreeShipping = cartSubtotal >= shippingThreshold;
  const shippingCost = cartSubtotal > 0 && !isFreeShipping ? 99 : 0;
  const finalTotal = cartSubtotal - discountAmount + shippingCost;
  const hasUnavailableItems = cart.some(item => item.product.status === 'archived' || item.product.isDecommissioned);

  const handleCheckout = () => {
    if (hasUnavailableItems) return;
    onClose();
    navigate('/checkout');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            id="cart-backdrop"
            className="fixed inset-0 bg-black z-50 cursor-pointer"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.35, ease: 'easeInOut' }}
            id="cart-drawer-panel"
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#FBF6EE] z-50 shadow-2xl flex flex-col border-l border-[#E5D2BC]/30"
          >
            {/* Header */}
            <div className="p-5 border-b border-[#E5D2BC]/30 flex justify-between items-center bg-[#2A211C] text-[#FBF6EE]">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#E5D2BC]" />
                <h2 className="font-sans font-medium tracking-widest text-sm uppercase">Shopping Bag ({cart.length})</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-[#FBF6EE]"
                id="close-cart-btn"
                aria-label="Close cart"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-center p-8">
                  <div className="w-16 h-16 rounded-full bg-[#F4E6D7] flex items-center justify-center mb-4 text-[#2A211C]">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <h3 className="font-serif text-lg text-[#2A211C] mb-1">Your bag is empty</h3>
                  <p className="font-sans text-xs text-[#2A211C]/60 max-w-xs mb-6">
                    Our premium organic linen menswear is waiting. Explore our shirts, trousers, and chinos to fill your closet with comfort.
                  </p>
                  <button
                    onClick={onClose}
                    className="w-full bg-[#2A211C] text-[#FBF6EE] py-3 px-6 rounded font-sans font-medium text-xs uppercase tracking-widest hover:bg-[#B08D57] transition-colors"
                    id="cart-continue-shopping-btn"
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                cart.map((item, index) => {
                  const isItemArchived = item.product.status === 'archived' || item.product.isDecommissioned;
                  return (
                  <div
                    key={`${item.product.id}-${item.selectedSize}`}
                    id={`cart-item-${index}`}
                    className={`flex gap-4 pb-4 border-b border-[#E5D2BC]/20 ${isItemArchived ? 'opacity-90' : ''}`}
                  >
                    {/* Thumbnail */}
                    <div className="w-20 h-24 bg-[#F4E6D7] rounded overflow-hidden shrink-0 border border-[#E5D2BC]/10 relative">
                      <img
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      {isItemArchived && (
                        <div className="absolute inset-0 bg-stone-900/60 flex items-center justify-center p-1">
                          <span className="text-[8px] font-sans font-bold uppercase tracking-wider text-amber-200 text-center leading-tight">
                            Discontinued
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-serif text-sm text-[#2A211C] font-semibold line-clamp-1 pr-2">
                            {item.product.name}
                          </h4>
                          <button
                            onClick={() => removeFromCart(item.product.id, item.selectedSize)}
                            className="text-[#2A211C]/40 hover:text-[#B08D57] p-0.5 transition-colors"
                            id={`remove-item-${item.product.id}`}
                            aria-label="Remove item"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {isItemArchived ? (
                          <div className="mt-1">
                            <span className="inline-block px-1.5 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-sans font-bold uppercase tracking-wider rounded">
                              Discontinued — Please remove
                            </span>
                          </div>
                        ) : (
                          <p className="font-sans text-xs text-[#2A211C]/60 mt-0.5">
                            Size: <span className="font-semibold text-[#2A211C]">{item.selectedSize}</span> | {item.product.fabric}
                          </p>
                        )}
                      </div>

                      <div className="flex justify-between items-center mt-2">
                        {/* Stepper */}
                        {isItemArchived ? (
                          <span className="text-[10px] text-stone-500 italic">Unavailable for purchase</span>
                        ) : (
                          <div className="flex items-center border border-[#E5D2BC]/40 rounded bg-white">
                            <button
                              onClick={() => updateCartQuantity(item.product.id, item.selectedSize, item.quantity - 1)}
                              className="p-1 hover:bg-[#F4E6D7]/30 text-[#2A211C] transition-colors"
                              id={`decrease-qty-${item.product.id}`}
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-3 text-xs font-sans font-semibold text-[#2A211C] min-w-[24px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateCartQuantity(item.product.id, item.selectedSize, item.quantity + 1)}
                              className="p-1 hover:bg-[#F4E6D7]/30 text-[#2A211C] transition-colors"
                              id={`increase-qty-${item.product.id}`}
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Price */}
                        <div className="text-right">
                          <span className="font-sans text-xs font-bold text-[#2A211C]">
                            ₹{(item.product.price * item.quantity).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            {/* Footer Summary (Sticky at bottom) */}
            {cart.length > 0 && (
              <div className="border-t border-[#E5D2BC]/30 bg-white p-5 space-y-4">
                {/* Free Shipping Alert Bar */}
                <div className="bg-[#F4E6D7]/20 p-2.5 rounded text-center text-[11px] font-sans text-[#2A211C] border border-[#F4E6D7]/40">
                  {isFreeShipping ? (
                    <span className="text-[#C98A82] font-semibold">🎉 Congratulations! You qualify for Free Shipping.</span>
                  ) : (
                    <span>
                      Add <strong className="text-[#B08D57]">₹{(shippingThreshold - cartSubtotal).toLocaleString('en-IN')}</strong> more for Free Shipping!
                    </span>
                  )}
                </div>

                {/* Coupon Code Entry */}
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-2.5 top-2.5 w-4 h-4 text-[#2A211C]/40" />
                    <input
                      type="text"
                      placeholder="Promo Code (KORA10, FRESH15)"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-[#E5D2BC]/40 rounded text-xs font-sans focus:outline-none focus:border-[#2A211C] bg-[#FBF6EE]/50 uppercase"
                      id="coupon-input-field"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-[#2A211C] hover:bg-[#B08D57] text-white px-4 py-2 rounded text-xs font-sans font-semibold tracking-wider transition-colors uppercase"
                    id="apply-coupon-btn"
                  >
                    Apply
                  </button>
                </form>

                {couponError && <p className="text-[11px] text-red-600 font-medium pl-1">{couponError}</p>}
                {couponSuccess && <p className="text-[11px] text-[#C98A82] font-medium pl-1">{couponSuccess}</p>}

                {couponCode && (
                  <div className="flex items-center justify-between bg-[#C98A82]/10 px-3 py-1.5 rounded border border-[#C98A82]/20">
                    <div className="flex items-center gap-1 text-[#C98A82] text-xs font-semibold">
                      <Percent className="w-3.5 h-3.5" />
                      <span>Applied: {couponCode}</span>
                    </div>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="text-xs text-red-600 font-semibold hover:underline"
                      id="remove-coupon-btn"
                    >
                      Remove
                    </button>
                  </div>
                )}

                {/* Subtotals */}
                <div className="space-y-1.5 text-xs font-sans">
                  <div className="flex justify-between text-[#2A211C]/70">
                    <span>Bag Subtotal</span>
                    <span>₹{cartSubtotal.toLocaleString('en-IN')}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-[#C98A82] font-semibold">
                      <span>Discount</span>
                      <span>-₹{discountAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-[#2A211C]/70">
                    <span>Shipping</span>
                    <span>{shippingCost === 0 ? 'FREE' : `₹${shippingCost}`}</span>
                  </div>

                  <div className="flex justify-between text-sm font-bold text-[#2A211C] border-t border-[#E5D2BC]/10 pt-2">
                    <span className="uppercase tracking-wide">Estimated Total</span>
                    <span>₹{finalTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Checkout CTA */}
                {hasUnavailableItems && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-center text-xs text-amber-800 font-sans font-medium">
                    Please remove discontinued items from your bag to proceed to checkout.
                  </div>
                )}
                <button
                  onClick={handleCheckout}
                  disabled={hasUnavailableItems}
                  className={`w-full py-3.5 rounded font-sans font-medium text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${
                    hasUnavailableItems
                      ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                      : 'bg-[#2A211C] text-[#FBF6EE] hover:bg-[#B08D57]'
                  }`}
                  id="checkout-proceed-btn"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
