import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useShop } from '../context/ShopContext';
import { Heart, ShoppingBag, Trash2, ArrowRight, Grid3X3, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSEO } from '../hooks/useSEO';

export const WishlistPage: React.FC = () => {
  useSEO({
    title: 'My Wishlist | Sa and Sha',
    description: 'View your handpicked selection of premium pure linen shirts, pants, and kurtas. Complete your purchase at Sa and Sha.',
    noindex: true
  });

  const { wishlist, removeFromWishlist, addToCart, showToast } = useShop();

  // Keep track of sizes selected for each wishlist item in local component state
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});

  const handleSizeChange = (productId: string, size: string) => {
    setSelectedSizes(prev => ({ ...prev, [productId]: size }));
  };

  const handleMoveToBag = (product: any) => {
    const size = selectedSizes[product.id];
    if (!size) {
      showToast(`Please choose a size for "${product.name}" before moving to bag.`);
      return;
    }
    // Add to cart
    addToCart(product, size, 1);
    // Remove from wishlist
    removeFromWishlist(product.id);
  };

  return (
    <div id="wishlist-page-root" className="max-w-7xl mx-auto px-4 md:px-6 py-12 space-y-8 min-h-[600px]">
      
      {/* Page Title Header */}
      <div className="border-b border-[#E5D2BC]/20 pb-4">
        <span className="text-xs font-sans font-bold tracking-[0.25em] text-[#B08D57] uppercase block">Saved Styles</span>
        <h1 className="font-serif text-2xl md:text-4xl font-bold text-[#2A211C] tracking-tight mt-1">
          My Curated Wishlist ({wishlist.length})
        </h1>
      </div>

      {wishlist.length === 0 ? (
        /* Empty State Panel */
        <div className="text-center py-20 px-4 max-w-xl mx-auto bg-[#F4E6D7]/20 rounded-xl border border-[#E5D2BC]/20 shadow-sm space-y-6">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto text-[#E5D2BC] shadow-sm">
            <Heart className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h3 className="font-serif text-lg font-bold text-[#2A211C]">Your Drawer is Empty</h3>
            <p className="font-sans text-xs md:text-sm text-[#2A211C]/60 leading-relaxed font-medium">
              You haven’t curated any linen styles yet. Browse our European flax shirts, trousers, and knit polos and tap the heart icon to save them here.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/shop/all"
              className="bg-[#2A211C] hover:bg-[#B08D57] text-white py-3 px-8 rounded font-sans font-bold text-xs uppercase tracking-widest transition-colors inline-flex items-center gap-2 active:scale-95"
              id="wishlist-shop-all-btn"
            >
              <span>Explore Collection</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        /* Wishlist Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6" id="wishlist-products-grid">
          <AnimatePresence>
            {wishlist.map((product) => {
              const selectedSize = selectedSizes[product.id] || '';
              return (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="group bg-white rounded-lg overflow-hidden border border-[#E5D2BC]/20 shadow-sm flex flex-col justify-between"
                  id={`wishlist-card-${product.id}`}
                >
                  
                  {/* Photo & Delete overlay */}
                  <div className="relative aspect-[3/4] bg-stone-100 overflow-hidden">
                    
                    {/* Delete Trigger Button */}
                    <button
                      onClick={() => removeFromWishlist(product.id)}
                      className="absolute top-2.5 right-2.5 bg-white/80 hover:bg-red-600 hover:text-white p-2 rounded-full text-[#2A211C] transition-colors shadow-sm z-20 cursor-pointer"
                      id={`wishlist-remove-${product.id}`}
                      aria-label="Remove item from wishlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <Link to={`/product/${product.slug || product.id}`} className="absolute inset-0">
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    </Link>
                  </div>

                  {/* Body Info */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <span className="text-[10px] text-[#E5D2BC] uppercase font-sans tracking-widest font-bold">
                        {product.fabric}
                      </span>
                      <h3 className="font-serif text-sm font-bold text-[#2A211C] mt-0.5 truncate hover:text-[#B08D57]">
                        <Link to={`/product/${product.slug || product.id}`}>{product.name}</Link>
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-sans text-xs font-bold text-[#2A211C]">
                          ₹{product.price.toLocaleString('en-IN')}
                        </span>
                        {product.compareAtPrice > product.price && (
                          <span className="font-sans text-[10px] text-stone-400 line-through">
                            ₹{product.compareAtPrice.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Size Selector and Add-to-bag */}
                    <div className="space-y-2 pt-2 border-t border-[#E5D2BC]/10">
                      
                      {/* Select size dropdown */}
                      <div>
                        <label htmlFor={`wish-size-${product.id}`} className="sr-only">Choose Size</label>
                        <select
                          id={`wish-size-${product.id}`}
                          value={selectedSize}
                          onChange={(e) => handleSizeChange(product.id, e.target.value)}
                          className="w-full text-[11px] font-sans text-[#2A211C]/80 px-2 py-1.5 rounded border border-[#E5D2BC]/40 bg-[#FBF6EE]/50 focus:outline-none focus:border-[#2A211C] font-semibold"
                        >
                          <option value="">Select Size</option>
                          {product.sizes.map(sz => (
                            <option key={sz} value={sz}>Size: {sz}</option>
                          ))}
                        </select>
                      </div>

                      {/* Move to bag button */}
                      <button
                        onClick={() => handleMoveToBag(product)}
                        className="w-full bg-[#2A211C] hover:bg-[#B08D57] text-white py-2 px-3 rounded text-[11px] font-sans font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer active:scale-95"
                        id={`wishlist-movetobag-${product.id}`}
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Move To Bag</span>
                      </button>

                    </div>
                  </div>

                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

    </div>
  );
};
