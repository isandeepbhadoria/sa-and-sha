import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useShop } from '../context/ShopContext';
import { products } from '../data';
import { Product } from '../types';
import { Menu, Search, Heart, ShoppingBag, X, ChevronDown, ArrowRight, Sparkles, User } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { SaAndShaLogo } from './SaAndShaLogo';

interface HeaderProps {
  onOpenCart: () => void;
}

const promoMessages = [
  'FREE SHIPPING ON ALL ORDERS ABOVE ₹1,999',
  'EXTRA 15% OFF ON FRESH ARRIVALS | CODE: FRESH15',
  '20% OFF ON LUXURY PURE LINEN COLLECTIONS | CODE: LINENLOVE',
  'PRE-SHRUNK & PRE-WASHED EUROPEAN FLAX | LUXURY COMFORT'
];

export const Header: React.FC<HeaderProps> = ({ onOpenCart }) => {
  const { cartCount, wishlistCount } = useShop();
  const navigate = useNavigate();
  const [promoIndex, setPromoIndex] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  
  // Desktop mega-menu state
  const [isDesktopShopOpen, setIsDesktopShopOpen] = useState(false);
  const desktopShopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mobile accordion states
  const [mobileCollectionExpanded, setMobileCollectionExpanded] = useState(true);
  const [mobileProductExpanded, setMobileProductExpanded] = useState(true);
  const [mobileShirtsExpanded, setMobileShirtsExpanded] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-cycle promo bar
  useEffect(() => {
    const interval = setInterval(() => {
      setPromoIndex((prev) => (prev + 1) % promoMessages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Sticky header shadow/background scroll handler
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase().trim();
    const filtered = products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.fabric.toLowerCase().includes(query) ||
        p.color.toLowerCase().includes(query) ||
        p.subCategory.toLowerCase().includes(query)
    ).slice(0, 5); // Limit live suggestions to 5
    setSearchResults(filtered);
  }, [searchQuery]);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleSearchResultClick = (product: { id: string; slug?: string }) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    navigate(`/product/${product.slug || product.id}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearchOpen(false);
    const query = searchQuery;
    setSearchQuery('');
    navigate(`/shop/all?search=${encodeURIComponent(query)}`);
  };

  const handleShopMouseEnter = () => {
    if (desktopShopTimeoutRef.current) {
      clearTimeout(desktopShopTimeoutRef.current);
      desktopShopTimeoutRef.current = null;
    }
    setIsDesktopShopOpen(true);
  };

  const handleShopMouseLeave = () => {
    desktopShopTimeoutRef.current = setTimeout(() => {
      setIsDesktopShopOpen(false);
    }, 150);
  };

  // Close menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDesktopShopOpen(false);
        setIsMobileMenuOpen(false);
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      {/* 1. Rotating Announcement Bar */}
      <div className="bg-[#1F1B16] text-[#F5F1E8] py-2 text-[10px] md:text-[11px] font-sans font-semibold tracking-[0.15em] text-center border-b border-[#C9B79C]/10 z-50 relative overflow-hidden h-9 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={promoIndex}
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -15, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="px-4"
          >
            {promoMessages[promoIndex]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 2. Main Navigation Header */}
      <header
        id="main-app-header"
        className={`sticky top-0 z-40 transition-all duration-300 w-full ${
          isScrolled
            ? 'bg-[#F5F1E8]/95 backdrop-blur-md shadow-md border-b border-[#C9B79C]/20 py-3'
            : 'bg-[#F5F1E8] border-b border-[#C9B79C]/10 py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between relative">
          
          {/* Hamburger Menu (Mobile Only) */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden p-1 text-[#1F1B16] hover:text-[#B85C38] transition-colors"
            id="mobile-hamburger-btn"
            aria-label="Open mobile menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Left: Brand Logo (Centered on mobile, left on desktop) */}
          <Link
            to="/"
            className="hover:opacity-90 transition-opacity md:mr-6 shrink-0"
            id="logo-link"
          >
            <SaAndShaLogo variant="horizontal" size="md" />
          </Link>

          {/* Center: Desktop Navigation Bar */}
          <nav className="hidden md:flex items-center gap-8 lg:gap-10" aria-label="Main Store Navigation">
            {/* Shop with Polished Desktop Mega Menu */}
            <div
              className="relative py-2"
              onMouseEnter={handleShopMouseEnter}
              onMouseLeave={handleShopMouseLeave}
            >
              <NavLink
                to="/shop/all"
                onClick={() => setIsDesktopShopOpen(false)}
                className={({ isActive }) =>
                  `font-sans font-semibold text-[11px] lg:text-xs tracking-[0.2em] uppercase flex items-center gap-1.5 pb-1 transition-colors ${
                    isActive || isDesktopShopOpen
                      ? 'text-[#B85C38] border-b border-[#B85C38]'
                      : 'text-[#1F1B16] hover:text-[#B85C38]'
                  }`
                }
                aria-expanded={isDesktopShopOpen}
                aria-haspopup="true"
                id="desktop-shop-nav-btn"
              >
                <span>Shop</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isDesktopShopOpen ? 'rotate-180 text-[#B85C38]' : ''
                  }`}
                />
              </NavLink>

              {/* Polished Mega Menu Dropdown */}
              <AnimatePresence>
                {isDesktopShopOpen && (
                  <motion.div
                    id="desktop-shop-mega-menu"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="absolute left-1/2 -translate-x-1/3 top-full w-[780px] bg-[#F5F1E8] border border-[#C9B79C]/40 shadow-2xl p-7 rounded-b-xl grid grid-cols-12 gap-7 z-50 text-[#1F1B16]"
                  >
                    {/* Column 1: SHOP BY COLLECTION */}
                    <div className="col-span-4 space-y-4">
                      <div className="border-b border-[#C9B79C]/30 pb-2">
                        <span className="font-serif font-bold text-xs uppercase tracking-[0.16em] text-[#1F1B16] block">
                          Shop by Collection
                        </span>
                      </div>
                      <ul className="space-y-2.5 text-xs font-sans">
                        <li>
                          <Link
                            to="/shop/collection/pure-linen"
                            onClick={() => setIsDesktopShopOpen(false)}
                            className="group flex items-center justify-between text-[#1F1B16]/85 hover:text-[#B85C38] font-medium transition-colors"
                          >
                            <span>Pure Linen</span>
                            <span className="text-[10px] text-[#C9B79C] tracking-wider uppercase group-hover:text-[#B85C38]">100% Flax</span>
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="/shop/collection/linen-cotton-blend"
                            onClick={() => setIsDesktopShopOpen(false)}
                            className="group flex items-center justify-between text-[#1F1B16]/85 hover:text-[#B85C38] font-medium transition-colors"
                          >
                            <span>Linen-Cotton Blend</span>
                            <span className="text-[10px] text-[#C9B79C] tracking-wider uppercase group-hover:text-[#B85C38]">Hybrid Drape</span>
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="/shop/collection/pure-cotton"
                            onClick={() => setIsDesktopShopOpen(false)}
                            className="group flex items-center justify-between text-[#1F1B16]/85 hover:text-[#B85C38] font-medium transition-colors"
                          >
                            <span>Pure Cotton</span>
                            <span className="text-[9px] bg-[#C9B79C]/30 text-[#1F1B16]/75 px-1.5 py-0.5 rounded font-sans tracking-wide">Coming Soon</span>
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="/shop/collection/chinos"
                            onClick={() => setIsDesktopShopOpen(false)}
                            className="group flex items-center justify-between text-[#1F1B16]/85 hover:text-[#B85C38] font-medium transition-colors"
                          >
                            <span>Chinos</span>
                            <span className="text-[10px] text-[#C9B79C] tracking-wider uppercase group-hover:text-[#B85C38]">Tailored Twill</span>
                          </Link>
                        </li>
                      </ul>

                      <div className="pt-2 border-t border-[#C9B79C]/20">
                        <Link
                          to="/shop/all"
                          onClick={() => setIsDesktopShopOpen(false)}
                          className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#B85C38] hover:underline inline-flex items-center gap-1.5"
                        >
                          <span>Explore All Collections</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>

                    {/* Column 2: SHOP BY PRODUCT */}
                    <div className="col-span-4 space-y-4 border-l border-[#C9B79C]/20 pl-6">
                      <div className="border-b border-[#C9B79C]/30 pb-2">
                        <span className="font-serif font-bold text-xs uppercase tracking-[0.16em] text-[#1F1B16] block">
                          Shop by Product
                        </span>
                      </div>
                      <ul className="space-y-2 text-xs font-sans">
                        {/* Shirts with indented Full Sleeve & Half Sleeve children */}
                        <li>
                          <Link
                            to="/shop/product/shirts"
                            onClick={() => setIsDesktopShopOpen(false)}
                            className="font-bold text-[#1F1B16] hover:text-[#B85C38] transition-colors block"
                          >
                            Shirts
                          </Link>
                          <div className="pl-3 mt-1 space-y-1 border-l border-[#C9B79C]/40 ml-1">
                            <Link
                              to="/shop/product/shirts/full-sleeve"
                              onClick={() => setIsDesktopShopOpen(false)}
                              className="block text-[11px] text-[#1F1B16]/75 hover:text-[#B85C38] transition-colors"
                            >
                              Full Sleeve Shirts
                            </Link>
                            <Link
                              to="/shop/product/shirts/half-sleeve"
                              onClick={() => setIsDesktopShopOpen(false)}
                              className="block text-[11px] text-[#1F1B16]/75 hover:text-[#B85C38] transition-colors"
                            >
                              Half Sleeve Shirts
                            </Link>
                          </div>
                        </li>

                        <li>
                          <Link
                            to="/shop/product/trousers"
                            onClick={() => setIsDesktopShopOpen(false)}
                            className="text-[#1F1B16]/85 hover:text-[#B85C38] font-medium transition-colors block"
                          >
                            Trousers
                          </Link>
                        </li>

                        <li>
                          <Link
                            to="/shop/product/chinos"
                            onClick={() => setIsDesktopShopOpen(false)}
                            className="text-[#1F1B16]/85 hover:text-[#B85C38] font-medium transition-colors block"
                          >
                            Chinos
                          </Link>
                        </li>

                        <li>
                          <Link
                            to="/shop/product/shorts"
                            onClick={() => setIsDesktopShopOpen(false)}
                            className="flex items-center justify-between text-[#1F1B16]/85 hover:text-[#B85C38] font-medium transition-colors"
                          >
                            <span>Shorts</span>
                            <span className="text-[9px] bg-[#C9B79C]/30 text-[#1F1B16]/75 px-1.5 py-0.5 rounded font-sans tracking-wide">Coming Soon</span>
                          </Link>
                        </li>

                        <li>
                          <Link
                            to="/shop/product/pyjamas"
                            onClick={() => setIsDesktopShopOpen(false)}
                            className="flex items-center justify-between text-[#1F1B16]/85 hover:text-[#B85C38] font-medium transition-colors"
                          >
                            <span>Pyjamas</span>
                            <span className="text-[9px] bg-[#C9B79C]/30 text-[#1F1B16]/75 px-1.5 py-0.5 rounded font-sans tracking-wide">Coming Soon</span>
                          </Link>
                        </li>

                        <li>
                          <Link
                            to="/shop/product/kurtas"
                            onClick={() => setIsDesktopShopOpen(false)}
                            className="flex items-center justify-between text-[#1F1B16]/85 hover:text-[#B85C38] font-medium transition-colors"
                          >
                            <span>Kurtas</span>
                            <span className="text-[9px] bg-[#C9B79C]/30 text-[#1F1B16]/75 px-1.5 py-0.5 rounded font-sans tracking-wide">Coming Soon</span>
                          </Link>
                        </li>

                        <li>
                          <Link
                            to="/shop/product/co-ord-sets"
                            onClick={() => setIsDesktopShopOpen(false)}
                            className="flex items-center justify-between text-[#1F1B16]/85 hover:text-[#B85C38] font-medium transition-colors"
                          >
                            <span>Co-Ord Sets</span>
                            <span className="text-[9px] bg-[#C9B79C]/30 text-[#1F1B16]/75 px-1.5 py-0.5 rounded font-sans tracking-wide">Coming Soon</span>
                          </Link>
                        </li>
                      </ul>
                    </div>

                    {/* Column 3: Featured Story Highlight */}
                    <div className="col-span-4 border-l border-[#C9B79C]/20 pl-6 flex flex-col justify-between">
                      <div>
                        <div className="rounded-lg overflow-hidden bg-[#E4D8C3] relative h-36 border border-[#C9B79C]/30 shadow-inner group/card">
                          <img
                            src="https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500&q=80"
                            alt="European Flax Linen"
                            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-700"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-3.5 flex flex-col justify-end text-white">
                            <span className="text-[9px] font-sans tracking-[0.2em] font-bold uppercase text-[#C9B79C]">European Flax</span>
                            <h4 className="font-serif font-bold text-sm leading-tight text-[#F5F1E8]">Artisanal Pure Linen</h4>
                          </div>
                        </div>
                        <p className="font-sans text-[11px] text-[#1F1B16]/70 mt-3 leading-relaxed">
                          Certified Belgian flax woven with patient craftsmanship for airy tropical cooling.
                        </p>
                      </div>
                      <div className="pt-3">
                        <Link
                          to="/shop/collection/pure-linen"
                          onClick={() => setIsDesktopShopOpen(false)}
                          className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#B85C38] hover:underline inline-flex items-center gap-1.5"
                        >
                          <span>Explore Pure Linen</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bestsellers link */}
            <NavLink
              to="/shop/bestsellers"
              className={({ isActive }) =>
                `font-sans font-semibold text-[11px] lg:text-xs tracking-[0.2em] uppercase pb-1 border-b transition-colors flex items-center gap-1 ${
                  isActive ? 'text-[#B85C38] border-[#B85C38]' : 'text-[#1F1B16] hover:text-[#B85C38] border-transparent'
                }`
              }
            >
              <span>Bestsellers</span>
              <span className="bg-[#B85C38] text-white px-1.5 py-0.5 rounded-[3px] text-[8px] font-sans font-bold leading-none tracking-normal">HOT</span>
            </NavLink>

            {/* Fresh Arrivals link */}
            <NavLink
              to="/shop/new-arrivals"
              className={({ isActive }) =>
                `font-sans font-semibold text-[11px] lg:text-xs tracking-[0.2em] uppercase pb-1 border-b transition-colors flex items-center gap-1 ${
                  isActive ? 'text-[#B85C38] border-[#B85C38]' : 'text-[#1F1B16] hover:text-[#B85C38] border-transparent'
                }`
              }
            >
              <span>Fresh Arrivals</span>
              <span className="bg-[#5C6B4A] text-white px-1.5 py-0.5 rounded-[3px] text-[8px] font-sans font-bold leading-none tracking-normal">NEW</span>
            </NavLink>
          </nav>

          {/* Right Area: Search, Wishlist, Cart Icons */}
          <div className="flex items-center gap-3.5 md:gap-4 lg:gap-5 shrink-0">
            {/* Inline Search Bar Trigger */}
            <div className="relative">
              {isSearchOpen ? (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-[#F5F1E8] border border-[#C9B79C] rounded-full px-3 py-1.5 w-[200px] md:w-[280px] shadow-lg z-50">
                  <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center">
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search Sa and Sha..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent text-xs font-sans text-[#1F1B16] focus:outline-none focus:ring-0"
                      id="header-search-input"
                    />
                  </form>
                  <button
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="p-0.5 hover:bg-black/5 rounded-full"
                    id="close-search-btn"
                  >
                    <X className="w-3.5 h-3.5 text-[#1F1B16]/60" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="p-1.5 hover:text-[#B85C38] transition-colors text-[#1F1B16]"
                  id="open-search-btn"
                  aria-label="Open search panel"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}

              {/* Live search recommendations suggestions dropdown */}
              <AnimatePresence>
                {isSearchOpen && searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 top-[120%] bg-white border border-[#C9B79C]/30 rounded-lg shadow-2xl w-[260px] md:w-[320px] overflow-hidden z-50"
                  >
                    <div className="p-2 border-b border-[#C9B79C]/10 bg-[#E4D8C3]/20">
                      <p className="text-[10px] uppercase font-sans font-bold text-[#1F1B16]/50 tracking-wider">Product Matches</p>
                    </div>
                    <div className="divide-y divide-[#C9B79C]/10">
                      {searchResults.map((product) => (
                        <div
                          key={product.id}
                          onClick={() => handleSearchResultClick(product)}
                          className="p-3 flex items-center gap-3 hover:bg-[#E4D8C3]/30 cursor-pointer transition-colors"
                        >
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-10 h-12 object-cover rounded bg-[#E4D8C3]/30"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-1">
                            <h5 className="text-[11px] font-semibold text-[#1F1B16] line-clamp-1">{product.name}</h5>
                            <p className="text-[9px] text-[#C9B79C] uppercase font-sans tracking-widest">{product.fabric}</p>
                            <span className="text-[10px] font-bold text-[#1F1B16]">₹{product.price.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Customer Account Link */}
            <Link
              to="/account"
              className="p-1.5 hover:text-[#B85C38] transition-colors text-[#1F1B16] relative"
              id="customer-portal-icon"
              aria-label="Customer Account Portal"
              title="Customer Account Portal"
            >
              <User className="w-5 h-5" />
            </Link>

            {/* Wishlist Link Icon with Badge */}
            <Link
              to="/wishlist"
              className="p-1.5 hover:text-[#B85C38] transition-colors text-[#1F1B16] relative"
              id="wishlist-link-icon"
              aria-label="Wishlist page"
            >
              <Heart className="w-5 h-5" />
              {wishlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#B85C38] text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-sans font-bold leading-none shadow shadow-[#B85C38]/40">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Cart/Bag trigger Button with Badge */}
            <button
              onClick={onOpenCart}
              className="p-1.5 hover:text-[#B85C38] transition-colors text-[#1F1B16] relative active:scale-95 transition-transform"
              id="cart-trigger-btn"
              aria-label="Open cart bag"
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#1F1B16] text-[#F5F1E8] rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-sans font-bold leading-none shadow shadow-[#1F1B16]/30">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 3. Mobile Navigation Accordion Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black z-50 cursor-pointer md:hidden"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed left-0 top-0 bottom-0 w-full max-w-sm bg-[#F5F1E8] z-50 shadow-2xl flex flex-col md:hidden border-r border-[#C9B79C]/30"
              id="mobile-nav-drawer"
            >
              {/* Header */}
              <div className="p-5 border-b border-[#C9B79C]/30 flex justify-between items-center bg-[#1F1B16] text-[#F5F1E8]">
                <span className="font-serif font-bold uppercase tracking-[0.2em] text-sm text-[#C9B79C]">Menu</span>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-full text-white"
                  id="close-mobile-menu-btn"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items Tree Accordion */}
              <div className="flex-1 overflow-y-auto py-4 px-5 space-y-4 font-sans text-sm font-semibold tracking-wider uppercase text-[#1F1B16]">
                
                {/* Home link */}
                <Link
                  to="/"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block py-2.5 border-b border-[#C9B79C]/20 hover:text-[#B85C38]"
                >
                  Home
                </Link>

                {/* Shop by Collection Accordion */}
                <div>
                  <button
                    type="button"
                    onClick={() => setMobileCollectionExpanded(!mobileCollectionExpanded)}
                    aria-expanded={mobileCollectionExpanded}
                    aria-controls="mobile-collection-panel"
                    className="w-full flex justify-between items-center py-2.5 min-h-[44px] border-b border-[#C9B79C]/20 text-left hover:text-[#B85C38] transition-colors"
                    id="mobile-nav-collections-toggle"
                  >
                    <span className="text-xs tracking-[0.14em]">Shop by Collection</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        mobileCollectionExpanded ? 'rotate-180 text-[#B85C38]' : ''
                      }`}
                    />
                  </button>
                  <AnimatePresence>
                    {mobileCollectionExpanded && (
                      <motion.div
                        id="mobile-collection-panel"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden pl-3 mt-1 space-y-2 font-normal text-xs uppercase text-[#1F1B16]/80 tracking-wider border-l-2 border-[#C9B79C]/40 ml-2 py-1.5"
                      >
                        <Link
                          to="/shop/collection/pure-linen"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center justify-between py-1.5 min-h-[38px] hover:text-[#B85C38]"
                        >
                          <span>Pure Linen</span>
                          <span className="text-[10px] text-[#C9B79C] tracking-widest lowercase font-sans">100% flax</span>
                        </Link>
                        <Link
                          to="/shop/collection/linen-cotton-blend"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center justify-between py-1.5 min-h-[38px] hover:text-[#B85C38]"
                        >
                          <span>Linen-Cotton Blend</span>
                          <span className="text-[10px] text-[#C9B79C] tracking-widest lowercase font-sans">hybrid</span>
                        </Link>
                        <Link
                          to="/shop/collection/pure-cotton"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center justify-between py-1.5 min-h-[38px] hover:text-[#B85C38]"
                        >
                          <span>Pure Cotton</span>
                          <span className="text-[9px] bg-[#C9B79C]/30 text-[#1F1B16]/75 px-1.5 py-0.5 rounded normal-case tracking-normal">Coming Soon</span>
                        </Link>
                        <Link
                          to="/shop/collection/chinos"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center justify-between py-1.5 min-h-[38px] hover:text-[#B85C38]"
                        >
                          <span>Chinos</span>
                          <span className="text-[10px] text-[#C9B79C] tracking-widest lowercase font-sans">twill</span>
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Shop by Product Accordion */}
                <div>
                  <button
                    type="button"
                    onClick={() => setMobileProductExpanded(!mobileProductExpanded)}
                    aria-expanded={mobileProductExpanded}
                    aria-controls="mobile-product-panel"
                    className="w-full flex justify-between items-center py-2.5 min-h-[44px] border-b border-[#C9B79C]/20 text-left hover:text-[#B85C38] transition-colors"
                    id="mobile-nav-products-toggle"
                  >
                    <span className="text-xs tracking-[0.14em]">Shop by Product</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        mobileProductExpanded ? 'rotate-180 text-[#B85C38]' : ''
                      }`}
                    />
                  </button>
                  <AnimatePresence>
                    {mobileProductExpanded && (
                      <motion.div
                        id="mobile-product-panel"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden pl-3 mt-1 space-y-1.5 font-normal text-xs uppercase text-[#1F1B16]/80 tracking-wider border-l-2 border-[#C9B79C]/40 ml-2 py-1.5"
                      >
                        {/* Shirts with sub-navigation */}
                        <div className="py-1">
                          <div className="flex items-center justify-between min-h-[38px]">
                            <Link
                              to="/shop/product/shirts"
                              onClick={() => setIsMobileMenuOpen(false)}
                              className="hover:text-[#B85C38] font-bold text-[#1F1B16]"
                            >
                              Shirts
                            </Link>
                            <button
                              type="button"
                              onClick={() => setMobileShirtsExpanded(!mobileShirtsExpanded)}
                              aria-expanded={mobileShirtsExpanded}
                              aria-label="Toggle Shirt sleeve options"
                              className="p-2 text-[#1F1B16]/60 hover:text-[#B85C38]"
                            >
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                  mobileShirtsExpanded ? 'rotate-180 text-[#B85C38]' : ''
                                }`}
                              />
                            </button>
                          </div>
                          <AnimatePresence>
                            {mobileShirtsExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="pl-3 py-1 space-y-1 border-l border-[#C9B79C]/30 ml-1 text-[11px] normal-case"
                              >
                                <Link
                                  to="/shop/product/shirts/full-sleeve"
                                  onClick={() => setIsMobileMenuOpen(false)}
                                  className="block py-1 min-h-[32px] hover:text-[#B85C38]"
                                >
                                  Full Sleeve Shirts
                                </Link>
                                <Link
                                  to="/shop/product/shirts/half-sleeve"
                                  onClick={() => setIsMobileMenuOpen(false)}
                                  className="block py-1 min-h-[32px] hover:text-[#B85C38]"
                                >
                                  Half Sleeve Shirts
                                </Link>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <Link
                          to="/shop/product/trousers"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1.5 min-h-[38px] hover:text-[#B85C38]"
                        >
                          Trousers
                        </Link>

                        <Link
                          to="/shop/product/shorts"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center justify-between py-1.5 min-h-[38px] hover:text-[#B85C38]"
                        >
                          <span>Shorts</span>
                          <span className="text-[9px] bg-[#C9B79C]/30 text-[#1F1B16]/75 px-1.5 py-0.5 rounded normal-case tracking-normal">Coming Soon</span>
                        </Link>

                        <Link
                          to="/shop/product/pyjamas"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center justify-between py-1.5 min-h-[38px] hover:text-[#B85C38]"
                        >
                          <span>Pyjamas</span>
                          <span className="text-[9px] bg-[#C9B79C]/30 text-[#1F1B16]/75 px-1.5 py-0.5 rounded normal-case tracking-normal">Coming Soon</span>
                        </Link>

                        <Link
                          to="/shop/product/kurtas"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center justify-between py-1.5 min-h-[38px] hover:text-[#B85C38]"
                        >
                          <span>Kurtas</span>
                          <span className="text-[9px] bg-[#C9B79C]/30 text-[#1F1B16]/75 px-1.5 py-0.5 rounded normal-case tracking-normal">Coming Soon</span>
                        </Link>

                        <Link
                          to="/shop/product/co-ord-sets"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center justify-between py-1.5 min-h-[38px] hover:text-[#B85C38]"
                        >
                          <span>Co-Ord Sets</span>
                          <span className="text-[9px] bg-[#C9B79C]/30 text-[#1F1B16]/75 px-1.5 py-0.5 rounded normal-case tracking-normal">Coming Soon</span>
                        </Link>

                        <Link
                          to="/shop/product/chinos"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1.5 min-h-[38px] hover:text-[#B85C38]"
                        >
                          Chinos
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Bestsellers */}
                <Link
                  to="/shop/bestsellers"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between py-2.5 border-b border-[#C9B79C]/20 hover:text-[#B85C38]"
                >
                  <span>Bestsellers</span>
                  <span className="bg-[#B85C38] text-white px-2 py-0.5 rounded text-[9px] font-sans font-bold leading-none tracking-normal">HOT</span>
                </Link>

                {/* Fresh Arrivals */}
                <Link
                  to="/shop/new-arrivals"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between py-2.5 border-b border-[#C9B79C]/20 hover:text-[#B85C38]"
                >
                  <span>Fresh Arrivals</span>
                  <span className="bg-[#5C6B4A] text-white px-2 py-0.5 rounded text-[9px] font-sans font-bold leading-none tracking-normal">NEW</span>
                </Link>

                {/* Wishlist */}
                <Link
                  to="/wishlist"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block py-2.5 border-b border-[#C9B79C]/20 hover:text-[#B85C38]"
                >
                  My Wishlist ({wishlistCount})
                </Link>

                {/* Track Order */}
                <Link
                  to="/track-order"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block py-2.5 border-b border-[#C9B79C]/20 hover:text-[#B85C38]"
                >
                  Track Order
                </Link>

                {/* Returns & Exchanges */}
                <Link
                  to="/returns-exchanges"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block py-2.5 border-b border-[#C9B79C]/20 hover:text-[#B85C38]"
                >
                  Returns & Exchanges
                </Link>
              </div>

              {/* Sidebar footer banner */}
              <div className="p-5 border-t border-[#C9B79C]/30 bg-[#E4D8C3]/20 space-y-3">
                <div className="flex items-center gap-2 text-xs font-sans text-[#1F1B16] font-semibold">
                  <Sparkles className="w-4 h-4 text-[#B85C38]" />
                  <span>100% Pure Italian Flax certified.</span>
                </div>
                <p className="text-[11px] text-[#1F1B16]/60 leading-normal">
                  Sa and Sha represents luxury linen craftsmanship. Pre-washed for incredible softness and ultimate ventilation.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
