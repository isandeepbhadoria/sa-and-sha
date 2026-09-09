import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { COLOR_SWATCHES } from '../data';
import { useShop } from '../context/ShopContext';
import { Star, Heart, ShoppingBag, Plus, Minus, MapPin, Truck, HelpCircle, ChevronRight, Check, X } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { motion, AnimatePresence } from 'motion/react';
import { useSEO } from '../hooks/useSEO';
import { RETURNS_CONFIG } from '../config/returnsConfig';
import { NotFoundPage } from './NotFoundPage';

export const ProductDetailPage: React.FC = () => {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const { products, allProducts, isProductsLoaded, addToCart, toggleWishlist, isInWishlist, addToRecentlyViewed, recentlyViewed } = useShop();

  const productIdentifier = slug || id;
  const product = products.find(p => p.slug === productIdentifier) ||
                  products.find(p => p.id === productIdentifier) ||
                  products.find(p => Array.isArray(p.previousSlugs) && p.previousSlugs.includes(productIdentifier!)) ||
                  allProducts.find(p => p.slug === productIdentifier) ||
                  allProducts.find(p => p.id === productIdentifier);

  const canonicalProductSlug = product?.slug || product?.id;

  const productStructuredData = product ? [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": product.name,
      "image": product.images || [],
      "description": product.description,
      "sku": product.sku || product.id,
      "brand": {
        "@type": "Brand",
        "name": "Sa and Sha"
      },
      "offers": {
        "@type": "Offer",
        "price": product.price,
        "priceCurrency": "INR",
        "availability": "https://schema.org/InStock",
        "itemCondition": "https://schema.org/NewCondition",
        "url": `https://www.sa-and-sha.com/product/${canonicalProductSlug}`,
        "hasMerchantReturnPolicy": {
          "@type": "MerchantReturnPolicy",
          "applicableCountry": "IN",
          "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
          "merchantReturnDays": RETURNS_CONFIG.RETURN_EXCHANGE_WINDOW_DAYS,
          "returnMethod": "https://schema.org/ReturnByMail",
          "returnFees": "https://schema.org/ReturnFeesCustomerPaying",
          "returnShippingFeesAmount": {
            "@type": "MonetaryAmount",
            "value": RETURNS_CONFIG.RETURN_SHIPPING_FEE,
            "currency": "INR"
          }
        }
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://www.sa-and-sha.com"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": product.category ? product.category.charAt(0).toUpperCase() + product.category.slice(1) : "Shop",
          "item": `https://www.sa-and-sha.com/shop/${product.category || "all"}`
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": product.name,
          "item": `https://www.sa-and-sha.com/product/${canonicalProductSlug}`
        }
      ]
    }
  ] : undefined;

  useSEO({
    title: product ? `${product.name} | Sa and Sha` : 'Sa and Sha | Ladies Apparel',
    description: product ? `${product.name} - ${product.fabric}. ${product.description}.` : 'Shop dresses, tops, co-ord sets, and more at Sa and Sha.',
    ogImage: product?.images?.[0],
    structuredData: productStructuredData
  });

  // Track recently viewed and scroll to top for valid products
  useEffect(() => {
    if (product) {
      addToRecentlyViewed(product);
      window.scrollTo(0, 0);
    }
  }, [product]);

  if (!product) {
    if (!isProductsLoaded) {
      return (
        <div className="bg-[#FBF6EE] text-[#2A211C] min-h-screen flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#2A211C] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-sans text-xs uppercase tracking-widest text-stone-600">Loading product details...</p>
          </div>
        </div>
      );
    }
    return <NotFoundPage />;
  }

  // PDP States
  const [activeImage, setActiveImage] = useState(product.images?.[0] || '');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (product?.images?.[0]) {
      setActiveImage(product.images[0]);
    }
  }, [product]);
  const [pincode, setPincode] = useState('');
  const [pincodeMessage, setPincodeMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [isStickyVisible, setIsStickyVisible] = useState(false);

  // Accordion Toggles
  const [expandedSection, setExpandedSection] = useState<string | null>('details');

  const mainCtaRef = useRef<HTMLButtonElement>(null);

  // Track scrolling for mobile sticky buy-bar
  useEffect(() => {
    const handleScroll = () => {
      if (!mainCtaRef.current) return;
      const rect = mainCtaRef.current.getBoundingClientRect();
      // If the top of the Add-to-Bag button is out of the screen (scrolled past), show sticky bar
      setIsStickyVisible(rect.top < 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Sync active image if product changes
  useEffect(() => {
    setActiveImage(product.images[0]);
    setSelectedSize('');
    setQuantity(1);
    setPincode('');
    setPincodeMessage(null);
  }, [product]);

  const hasDiscount = product.compareAtPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0;

  const isWished = isInWishlist(product.id);
  const isArchivedOrDecommissioned = product.status === 'archived' || !!product.isDecommissioned;

  // Related products from same subCategory (excluding current product and archived)
  const relatedProducts = products
    .filter(p => p.subCategory === product.subCategory && p.id !== product.id && p.status !== 'archived' && !p.isDecommissioned)
    .slice(0, 4);

  const handleAddToCart = () => {
    if (isArchivedOrDecommissioned) {
      showToast('This garment has been discontinued and cannot be purchased.');
      return;
    }
    if (!selectedSize) {
      showToast('Please select a size to add to your bag.');
      return;
    }
    addToCart(product, selectedSize, quantity);
  };

  const { showToast } = useShop();

  const handlePincodeCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pincode.trim() || pincode.length < 6) {
      setPincodeMessage({ text: 'Please enter a valid 6-digit pincode.', success: false });
      return;
    }

    // Custom deliveries check
    if (pincode.startsWith('560')) {
      setPincodeMessage({
        text: '⚡ Express premium delivery available in major cities! (Order within 3 hrs)',
        success: true
      });
    } else if (pincode.startsWith('110') || pincode.startsWith('400') || pincode.startsWith('600')) {
      setPincodeMessage({
        text: '🚀 Standard express delivery available: Delivers in 2-3 business days.',
        success: true
      });
    } else {
      setPincodeMessage({
        text: '📦 Standard delivery available: Delivers in 4-6 business days.',
        success: true
      });
    }
  };

  const toggleAccordionSection = (section: string) => {
    setExpandedSection(prev => (prev === section ? null : section));
  };

  return (
    <div id="pdp-container" className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-12 relative">
      {/* 1. Breadcrumbs */}
      <nav className="text-xs font-sans text-[#2A211C]/50 tracking-wider uppercase flex items-center gap-1.5" id="pdp-breadcrumb">
        <Link to="/" className="hover:text-[#B08D57] transition-colors">Home</Link>
        <span>/</span>
        <Link to={`/shop/${product.category}`} className="hover:text-[#B08D57] transition-colors uppercase">{product.category}</Link>
        <span>/</span>
        <Link to={`/shop/${product.subCategory}`} className="hover:text-[#B08D57] transition-colors uppercase">{product.subCategory.replace(/-/g, ' ')}</Link>
        <span>/</span>
        <span className="text-[#2A211C] font-semibold">{product.name}</span>
      </nav>

      {/* 2. Main Product Info Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Left: Image Gallery (5 cols) */}
        <div className="lg:col-span-7 flex flex-col md:flex-row-reverse gap-4">
          
          {/* Main Large Image */}
          <div className="flex-1 aspect-[3/4] bg-[#F4E6D7]/20 rounded-lg overflow-hidden border border-[#E5D2BC]/20 relative group">
            <img
              src={activeImage}
              alt={`${product.name} - ${product.color} - ${product.category} | Sa and Sha`}
              className="w-full h-full object-cover group-hover:scale-125 transition-transform duration-500 cursor-zoom-in"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-3 left-3 bg-[#2A211C]/80 text-[#FBF6EE] px-2.5 py-1 text-[9px] font-sans rounded tracking-wider uppercase backdrop-blur-sm pointer-events-none">
              Hover to Zoom
            </div>
          </div>

          {/* Thumbnail strip */}
          <div className="flex md:flex-col gap-3 shrink-0 overflow-x-auto md:overflow-y-auto max-h-[500px] py-1">
            {product.images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImage(img)}
                onMouseEnter={() => setActiveImage(img)}
                className={`w-16 h-20 md:w-20 md:h-26 rounded overflow-hidden bg-[#F4E6D7]/30 border-2 transition-all shrink-0 ${
                  activeImage === img ? 'border-[#B08D57] shadow-md scale-95' : 'border-[#E5D2BC]/20 opacity-70 hover:opacity-100'
                }`}
                id={`thumb-btn-${idx}`}
                aria-label={`View image thumbnail ${idx + 1}`}
              >
                <img
                  src={img}
                  alt={`${product.name} - ${product.color} - ${product.category} Image ${idx + 1} | Sa and Sha`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </button>
            ))}
          </div>

        </div>

        {/* Right: Technical Meta Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Tag & Title */}
          <div>
            <span className="text-[10px] text-[#E5D2BC] uppercase font-sans tracking-[0.25em] font-bold block mb-1">
              {product.fabric} • {product.fit} Fit
            </span>
            <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#2A211C] tracking-tight leading-tight">
              {product.name}
            </h1>
            
            {/* Reviews summary */}
            {product.reviewCount > 0 ? (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < Math.floor(product.rating) ? 'fill-current' : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-sans font-bold text-[#2A211C]">{product.rating.toFixed(1)}</span>
                <span className="text-xs font-sans text-[#2A211C]/50">({product.reviewCount} Patron Reviews)</span>
              </div>
            ) : (
              <div className="mt-2">
                <span className="text-xs font-sans font-bold text-[#B08D57] uppercase tracking-wide">New Arrival — Be the first to review</span>
              </div>
            )}
          </div>

          {/* Price blocks */}
          <div className="p-4 rounded-lg bg-[#F4E6D7]/15 border border-[#E5D2BC]/30 space-y-2">
            <div className="flex items-baseline gap-3">
              <span className="font-sans text-2xl font-bold text-[#2A211C]">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              {hasDiscount && (
                <>
                  <span className="font-sans text-sm text-[#2A211C]/40 line-through">
                    ₹{product.compareAtPrice.toLocaleString('en-IN')}
                  </span>
                  <span className="bg-[#B08D57] text-white px-2 py-0.5 rounded text-[10px] font-sans font-bold uppercase tracking-wider">
                    Save {discountPercent}%
                  </span>
                </>
              )}
            </div>
            
            <p className="text-xs font-sans text-[#C98A82] leading-relaxed font-semibold">
              🎉 Flat 10% Extra Off with code <strong className="underline">SANDSHA10</strong> (Best Price: ₹{Math.round(product.price * 0.9).toLocaleString('en-IN')})
            </p>
            <p className="text-[10px] text-[#2A211C]/50 leading-none">Price inclusive of all luxury taxes.</p>
          </div>

          {/* Description */}
          <p className="font-sans text-xs md:text-sm text-[#2A211C]/70 leading-relaxed font-medium">
            {product.description}
          </p>

          {/* Color display */}
          <div className="space-y-2">
            <span className="text-[11px] font-sans font-bold uppercase tracking-widest text-[#2A211C]/60">
              Color: <strong className="text-[#2A211C]">{product.color}</strong>
            </span>
            <div className="flex gap-2">
              <button
                className="w-8 h-8 rounded-full border-2 border-[#2A211C] p-0.5 flex items-center justify-center cursor-default bg-white"
                aria-label={product.color}
              >
                <span className="w-full h-full rounded-full border border-black/10" style={{ backgroundColor: product.colorHex }} />
              </button>
            </div>
          </div>

          {/* Size selection & Actions or Discontinued Notice */}
          {isArchivedOrDecommissioned ? (
            <div className="p-6 bg-[#F4E6D7]/20 rounded-lg border border-[#E5D2BC]/40 space-y-3">
              <div className="flex items-center gap-2">
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                  Discontinued
                </span>
                <span className="font-serif font-bold text-sm text-[#2A211C]">Garment Archived</span>
              </div>
              <p className="font-sans text-xs text-[#2A211C]/70 leading-relaxed">
                This garment is permanently retired from the Sa and Sha active assortment. It remains preserved for historical order records, invoices, and customer reference, but can no longer be ordered.
              </p>
              <div className="pt-2">
                <Link
                  to="/shop"
                  className="inline-flex items-center gap-2 bg-[#2A211C] text-[#FBF6EE] px-5 py-2.5 rounded font-sans font-bold text-xs uppercase tracking-widest hover:bg-[#B08D57] transition-colors"
                >
                  <span>Explore Available Collections</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Size selection */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-baseline text-[11px] font-sans font-bold uppercase tracking-widest text-[#2A211C]/60">
                  <span>Select Size:</span>
                  <button
                    onClick={() => setIsSizeGuideOpen(true)}
                    className="text-[#B08D57] hover:underline"
                    id="size-guide-trigger"
                  >
                    Size Guide
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map(size => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`w-11 h-11 text-xs font-sans font-bold rounded-md border flex items-center justify-center transition-all ${
                        selectedSize === size
                          ? 'bg-[#2A211C] text-[#FBF6EE] border-[#2A211C] font-extrabold shadow'
                          : 'bg-white text-[#2A211C] border-[#E5D2BC]/30 hover:border-[#2A211C]'
                      }`}
                      id={`size-btn-${size}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity & CTA triggers */}
              <div className="space-y-4 pt-2">
                <div className="flex gap-4">
                  
                  {/* Qty Stepper */}
                  <div className="flex items-center border border-[#E5D2BC]/40 rounded bg-white">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="p-3 hover:bg-[#F4E6D7]/30 text-[#2A211C] transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="px-4 text-sm font-sans font-bold text-[#2A211C] min-w-[32px] text-center">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(q => q + 1)}
                      className="p-3 hover:bg-[#F4E6D7]/30 text-[#2A211C] transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Add to bag button */}
                  <button
                    ref={mainCtaRef}
                    onClick={handleAddToCart}
                    className="flex-1 bg-[#2A211C] text-[#FBF6EE] hover:bg-[#B08D57] py-3 px-6 rounded font-sans font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-lg active:scale-95"
                    id="add-to-bag-pdp"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Add To Bag</span>
                  </button>

                  {/* Wishlist toggle */}
                  <button
                    onClick={() => toggleWishlist(product)}
                    className={`p-3.5 rounded border transition-colors active:scale-95 ${
                      isWished
                        ? 'bg-[#2A211C] text-[#B08D57] border-[#2A211C]'
                        : 'bg-white text-[#2A211C] border-[#E5D2BC]/40 hover:bg-[#F4E6D7]/15'
                    }`}
                    id="toggle-wishlist-pdp"
                    aria-label="Wishlist toggle button"
                  >
                    <Heart className={`w-4 h-4 ${isWished ? 'fill-current' : ''}`} />
                  </button>

                </div>
              </div>
            </>
          )}

          {/* Pincode Estimator */}
          <div className="border border-[#E5D2BC]/30 p-4 rounded bg-white space-y-3">
            <div className="flex items-center gap-2 text-[#2A211C] font-sans font-semibold text-xs uppercase tracking-wider">
              <MapPin className="w-4 h-4 text-[#B08D57]" />
              <span>Verify Delivery Speed</span>
            </div>
            <form onSubmit={handlePincodeCheck} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter 6-digit Pincode"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                className="flex-1 py-2 px-3 border border-[#E5D2BC]/40 rounded text-xs font-sans focus:outline-none focus:border-[#2A211C] bg-[#FBF6EE]/50"
                id="pincode-input"
              />
              <button
                type="submit"
                className="bg-[#2A211C] hover:bg-[#B08D57] text-white px-4 py-2 rounded text-xs font-sans font-bold transition-colors uppercase"
                id="check-pincode-btn"
              >
                Check
              </button>
            </form>
            {pincodeMessage && (
              <p className={`text-[11px] font-sans font-medium pl-1 leading-normal ${pincodeMessage.success ? 'text-[#C98A82]' : 'text-red-600'}`}>
                {pincodeMessage.text}
              </p>
            )}
          </div>

          {/* Details Accordion Menu */}
          <div className="border-t border-[#E5D2BC]/20 pt-4 divide-y divide-[#E5D2BC]/10 text-[#2A211C]">
            
            {/* Section 1: Product Details */}
            <div className="py-3">
              <button
                onClick={() => toggleAccordionSection('details')}
                className="w-full flex justify-between items-center text-left font-sans text-xs font-bold uppercase tracking-widest"
              >
                <span>Product Details</span>
                {expandedSection === 'details' ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              </button>
              <AnimatePresence>
                {expandedSection === 'details' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <ul className="list-disc pl-4 py-2 text-xs font-sans text-[#2A211C]/70 leading-relaxed space-y-1.5 font-medium">
                      {product.details.map((detail, idx) => (
                        <li key={idx}>{detail}</li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Section 2: Fabric & Care */}
            <div className="py-3">
              <button
                onClick={() => toggleAccordionSection('fabric')}
                className="w-full flex justify-between items-center text-left font-sans text-xs font-bold uppercase tracking-widest"
              >
                <span>Fabric & Care</span>
                {expandedSection === 'fabric' ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              </button>
              <AnimatePresence>
                {expandedSection === 'fabric' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <ul className="list-disc pl-4 py-2 text-xs font-sans text-[#2A211C]/70 leading-relaxed space-y-1.5 font-medium">
                      {product.careInstructions.map((inst, idx) => (
                        <li key={idx}>{inst}</li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Section 3: Shipping & Returns */}
            <div className="py-3">
              <button
                onClick={() => toggleAccordionSection('shipping')}
                className="w-full flex justify-between items-center text-left font-sans text-xs font-bold uppercase tracking-widest"
              >
                <span>Shipping & Returns</span>
                {expandedSection === 'shipping' ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              </button>
              <AnimatePresence>
                {expandedSection === 'shipping' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden text-xs font-sans text-[#2A211C]/70 leading-relaxed py-2 space-y-1.5 font-medium"
                  >
                    <p>📦 <strong>Free Shipping:</strong> On all orders above ₹1,999. Standard delivery takes 3-5 days.</p>
                    <p>🔄 <strong>Easy 7-Day Returns & Exchanges:</strong> Submit your request within 7 days of delivery. After 7 days, the return window closes. Free reverse pickup included.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>

        </div>

      </div>

      {/* 3. "YOU MAY ALSO LIKE" Related products carousel */}
      {relatedProducts.length > 0 && (
        <section className="border-t border-[#E5D2BC]/20 pt-10 mt-12 space-y-6">
          <div>
            <span className="text-xs font-sans font-bold tracking-[0.25em] text-[#B08D57] uppercase block">Patron Picks</span>
            <h2 className="font-serif text-xl md:text-2xl font-bold text-[#2A211C] mt-0.5">You May Also Like</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {relatedProducts.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* 4. "RECENTLY VIEWED" Legwear lists */}
      {recentlyViewed.length > 1 && (
        <section className="border-t border-[#E5D2BC]/20 pt-10 mt-12 space-y-6 bg-[#F4E6D7]/10 p-6 rounded-lg">
          <div>
            <span className="text-xs font-sans font-bold tracking-[0.25em] text-[#2A211C]/50 uppercase block">Your Browsing Drawer</span>
            <h2 className="font-serif text-lg md:text-xl font-bold text-[#2A211C]">Recently Viewed</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {recentlyViewed.filter(rv => rv.id !== product.id).slice(0, 6).map(rv => (
              <Link
                key={rv.id}
                to={`/product/${rv.slug || rv.id}`}
                className="group flex flex-col space-y-1.5 p-2 bg-white rounded border border-[#E5D2BC]/20 hover:shadow-md transition-all text-left"
              >
                <div className="aspect-[3/4] rounded overflow-hidden bg-stone-100">
                  <img
                    src={rv.images[0]}
                    alt={`${rv.name} - ${rv.color} - ${rv.category} | Sa and Sha`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h4 className="font-serif text-xs font-bold text-[#2A211C] truncate group-hover:text-[#B08D57]">{rv.name}</h4>
                <span className="font-sans text-[10px] text-[#2A211C]/60 font-semibold">₹{rv.price.toLocaleString('en-IN')}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 5. Size Guide Modal Overlay */}
      <AnimatePresence>
        {isSizeGuideOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSizeGuideOpen(false)}
              className="fixed inset-0 bg-black z-50 cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:max-w-md md:mx-auto bg-[#FBF6EE] z-50 p-6 rounded-lg shadow-2xl border border-[#E5D2BC] space-y-4 text-xs font-sans"
              id="size-guide-modal"
            >
              <div className="flex justify-between items-center border-b border-[#E5D2BC]/20 pb-3">
                <h3 className="font-serif text-lg font-bold text-[#2A211C] uppercase tracking-wide">Size Chart</h3>
                <button
                  onClick={() => setIsSizeGuideOpen(false)}
                  className="p-1 hover:bg-[#F4E6D7] rounded-full"
                  id="close-size-guide-modal-btn"
                >
                  <X className="w-5 h-5 text-[#2A211C]" />
                </button>
              </div>

              {product.category === 'shirts' ? (
                <div className="space-y-3">
                  <p className="text-[11px] text-[#2A211C]/60 leading-normal">
                    Measurements are in inches. Our shirts have built-in ease around shoulders and armholes for continuous summer breathing.
                  </p>
                  <table className="w-full text-center border-collapse">
                    <thead>
                      <tr className="bg-[#2A211C] text-[#FBF6EE] font-bold text-[10px]">
                        <th className="p-2 border border-[#E5D2BC]/30">Size</th>
                        <th className="p-2 border border-[#E5D2BC]/30">Chest</th>
                        <th className="p-2 border border-[#E5D2BC]/30">Sleeve</th>
                        <th className="p-2 border border-[#E5D2BC]/30">Length</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5D2BC]/10 bg-white text-[11px] text-[#2A211C]">
                      <tr>
                        <td className="p-2 font-bold border border-[#E5D2BC]/20">S</td>
                        <td className="p-2 border border-[#E5D2BC]/20">38</td>
                        <td className="p-2 border border-[#E5D2BC]/20">24.5</td>
                        <td className="p-2 border border-[#E5D2BC]/20">28</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold border border-[#E5D2BC]/20">M</td>
                        <td className="p-2 border border-[#E5D2BC]/20">40</td>
                        <td className="p-2 border border-[#E5D2BC]/20">25.0</td>
                        <td className="p-2 border border-[#E5D2BC]/20">29</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold border border-[#E5D2BC]/20">L</td>
                        <td className="p-2 border border-[#E5D2BC]/20">42</td>
                        <td className="p-2 border border-[#E5D2BC]/20">25.5</td>
                        <td className="p-2 border border-[#E5D2BC]/20">30</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold border border-[#E5D2BC]/20">XL</td>
                        <td className="p-2 border border-[#E5D2BC]/20">44</td>
                        <td className="p-2 border border-[#E5D2BC]/20">26.0</td>
                        <td className="p-2 border border-[#E5D2BC]/20">31</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold border border-[#E5D2BC]/20">XXL</td>
                        <td className="p-2 border border-[#E5D2BC]/20">46</td>
                        <td className="p-2 border border-[#E5D2BC]/20">26.5</td>
                        <td className="p-2 border border-[#E5D2BC]/20">31.5</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[11px] text-[#2A211C]/60 leading-normal">
                    Measurements are in inches. Legwear stretches slightly at the seat lining for ease of sitting.
                  </p>
                  <table className="w-full text-center border-collapse">
                    <thead>
                      <tr className="bg-[#2A211C] text-[#FBF6EE] font-bold text-[10px]">
                        <th className="p-2 border border-[#E5D2BC]/30">Waist Size</th>
                        <th className="p-2 border border-[#E5D2BC]/30">Seat/Hip</th>
                        <th className="p-2 border border-[#E5D2BC]/30">Inseam Length</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5D2BC]/10 bg-white text-[11px] text-[#2A211C]">
                      <tr>
                        <td className="p-2 font-bold border border-[#E5D2BC]/20">30</td>
                        <td className="p-2 border border-[#E5D2BC]/20">38</td>
                        <td className="p-2 border border-[#E5D2BC]/20">32</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold border border-[#E5D2BC]/20">32</td>
                        <td className="p-2 border border-[#E5D2BC]/20">40</td>
                        <td className="p-2 border border-[#E5D2BC]/20">32</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold border border-[#E5D2BC]/20">34</td>
                        <td className="p-2 border border-[#E5D2BC]/20">42</td>
                        <td className="p-2 border border-[#E5D2BC]/20">33</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold border border-[#E5D2BC]/20">36</td>
                        <td className="p-2 border border-[#E5D2BC]/20">44</td>
                        <td className="p-2 border border-[#E5D2BC]/20">33</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold border border-[#E5D2BC]/20">38</td>
                        <td className="p-2 border border-[#E5D2BC]/20">46</td>
                        <td className="p-2 border border-[#E5D2BC]/20">34</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <div className="bg-[#C98A82]/10 p-3 rounded text-[11px] text-[#C98A82] font-semibold border border-[#C98A82]/25">
                📏 Tips: If you are between sizes, we recommend picking the larger size for a more comfortable, relaxed fit.
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 6. Mobile Sticky Add-to-Bag panel */}
      <AnimatePresence>
        {isStickyVisible && !isArchivedOrDecommissioned && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 bg-[#2A211C] text-[#FBF6EE] p-3.5 z-40 border-t border-[#E5D2BC]/20 flex justify-between items-center md:hidden"
            id="mobile-sticky-pdp-buybar"
          >
            <div className="flex items-center gap-3">
              <img
                src={product.images[0]}
                alt={`${product.name} - ${product.color} - ${product.category} | Sa and Sha`}
                className="w-10 h-12 object-cover rounded"
                referrerPolicy="no-referrer"
              />
              <div>
                <h4 className="font-serif text-xs font-bold leading-tight">{product.name}</h4>
                <p className="font-sans text-[11px] text-[#E5D2BC]/90 font-bold mt-0.5">
                  ₹{product.price.toLocaleString('en-IN')}{' '}
                  {selectedSize && (
                    <span className="text-white text-[10px] uppercase font-bold border-l border-white/20 pl-1.5 ml-1.5">Size {selectedSize}</span>
                  )}
                </p>
              </div>
            </div>

            {selectedSize ? (
              <button
                onClick={handleAddToCart}
                className="bg-[#B08D57] hover:bg-[#B08D57]/90 text-white font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2.5 rounded shadow active:scale-95 transition-all"
                id="sticky-buybar-add-btn"
              >
                Add to Bag
              </button>
            ) : (
              <div className="flex gap-1">
                {product.sizes.slice(0, 3).map(size => (
                  <button
                    key={size}
                    onClick={() => {
                      setSelectedSize(size);
                      addToCart(product, size, 1);
                    }}
                    className="w-8 h-8 rounded bg-white/10 hover:bg-white text-white hover:text-stone-900 border border-white/20 text-[10px] font-sans font-bold flex items-center justify-center transition-colors active:scale-95"
                    id={`sticky-buybar-size-${size}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
