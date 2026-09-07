import React, { useState } from 'react';
import { Product } from '../types';
import { useShop } from '../context/ShopContext';
import { Heart, Star, ShoppingBag, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { toggleWishlist, isInWishlist, addToCart } = useShop();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showSizeSelector, setShowSizeSelector] = useState(false);
  const [selectedSize, setSelectedSize] = useState('');
  const navigate = useNavigate();

  const isWished = isInWishlist(product.id);
  const hasDiscount = product.compareAtPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0;

  // Best Price Offer with SANDSHA10 (10% off coupon)
  const bestOfferPrice = Math.round(product.price * 0.9);

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist(product);
  };

  const handleCardClick = () => {
    navigate(`/product/${product.slug || product.id}`);
  };

  const handleQuickAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSizeSelector(true);
  };

  const handleSizeSelect = (e: React.MouseEvent, size: string) => {
    e.stopPropagation();
    setSelectedSize(size);
    addToCart(product, size, 1);
    setShowSizeSelector(false);
    setSelectedSize('');
  };

  return (
    <div
      onClick={handleCardClick}
      id={`product-card-${product.id}`}
      className="group bg-white rounded-lg overflow-hidden border border-[#E5D2BC]/20 hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer relative"
    >
      {/* Product Image Area */}
      <div
        className="aspect-[3/4] w-full bg-[#F4E6D7]/40 overflow-hidden relative"
        onMouseEnter={() => product.images[1] && setCurrentImageIndex(1)}
        onMouseLeave={() => setCurrentImageIndex(0)}
      >
        <img
          src={product.images[currentImageIndex] || product.images[0]}
          alt={`${product.name} - ${product.color} - ${product.category} | Sa and Sha`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          referrerPolicy="no-referrer"
          loading="lazy"
        />

        {/* Floating Wishlist Heart */}
        <button
          onClick={handleWishlistClick}
          className={`absolute top-3 right-3 p-2 rounded-full shadow-md z-10 transition-transform active:scale-95 ${
            isWished ? 'bg-[#2A211C] text-[#B08D57]' : 'bg-[#FBF6EE] text-[#2A211C] hover:text-[#B08D57]'
          }`}
          id={`wish-btn-${product.id}`}
          aria-label="Add to wishlist"
        >
          <Heart className={`w-4 h-4 ${isWished ? 'fill-current' : ''}`} />
        </button>

        {/* Badges container */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {product.bestseller && (
            <span className="bg-[#B08D57] text-white px-2 py-0.5 rounded text-[9px] font-sans font-bold uppercase tracking-wider shadow">
              Best Seller
            </span>
          )}
          {product.newArrival && (
            <span className="bg-[#C98A82] text-white px-2 py-0.5 rounded text-[9px] font-sans font-bold uppercase tracking-wider shadow">
              New
            </span>
          )}
          {hasDiscount && (
            <span className="bg-[#2A211C] text-[#FBF6EE] px-2 py-0.5 rounded text-[9px] font-sans font-bold uppercase tracking-wider shadow">
              {discountPercent}% OFF
            </span>
          )}
        </div>

        {/* Quick Add To Bag Hover Panel */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 z-10">
          {!showSizeSelector ? (
            <button
              onClick={handleQuickAddClick}
              className="w-full bg-[#FBF6EE] text-[#2A211C] hover:bg-[#B08D57] hover:text-white py-2.5 rounded text-xs font-sans font-bold uppercase tracking-widest transition-all shadow flex items-center justify-center gap-1.5 active:scale-95"
              id={`quick-add-btn-${product.id}`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>+ Quick Add</span>
            </button>
          ) : (
            <div className="bg-[#2A211C] p-2.5 rounded-md border border-[#E5D2BC]/30 flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[10px] text-[#FBF6EE]/70 font-sans tracking-wider uppercase font-semibold">
                <span>Select Size</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSizeSelector(false);
                  }}
                  className="text-white/60 hover:text-white"
                  id={`cancel-size-${product.id}`}
                >
                  Cancel
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={(e) => handleSizeSelect(e, size)}
                    className="w-8 h-8 rounded bg-[#FBF6EE] text-[#2A211C] hover:bg-[#B08D57] hover:text-white text-[10px] font-sans font-bold flex items-center justify-center transition-colors active:scale-95 border border-[#E5D2BC]/30"
                    id={`size-opt-${product.id}-${size}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Meta Content Details */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-1">
        <div>
          {/* Fabric */}
          <span className="text-[10px] text-[#E5D2BC] uppercase font-sans tracking-widest font-semibold block">
            {product.fabric}
          </span>

          {/* Product Name */}
          <h3 className="font-serif text-[#2A211C] text-sm group-hover:text-[#B08D57] transition-colors line-clamp-1 mt-0.5">
            {product.name}
          </h3>

          {/* Rating */}
          <div className="flex items-center gap-1 mt-1 text-[11px] text-[#2A211C]/60 font-sans">
            <div className="flex items-center text-amber-500 shrink-0">
              <Star className="w-3 h-3 fill-current" />
            </div>
            <span className="font-semibold text-[#2A211C]">{product.rating.toFixed(1)}</span>
            <span>({product.reviewCount})</span>
          </div>
        </div>

        {/* Price & Best Price */}
        <div className="pt-2 border-t border-[#E5D2BC]/10 mt-2">
          <div className="flex items-baseline gap-2">
            <span className="font-sans text-sm font-bold text-[#2A211C]">
              ₹{product.price.toLocaleString('en-IN')}
            </span>
            {hasDiscount && (
              <span className="font-sans text-xs text-[#2A211C]/40 line-through">
                ₹{product.compareAtPrice.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          {/* Best Price tag */}
          <p className="text-[10px] text-[#C98A82] font-sans font-medium mt-0.5 bg-[#C98A82]/5 px-1.5 py-0.5 rounded inline-block">
            Best Price <span className="font-bold">₹{bestOfferPrice.toLocaleString('en-IN')}</span> with SANDSHA10
          </p>
        </div>
      </div>
    </div>
  );
};
