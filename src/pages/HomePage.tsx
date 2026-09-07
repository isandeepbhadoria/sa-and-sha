import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { products, mockReviews } from '../data';
import { 
  Wind, 
  Droplets, 
  Leaf, 
  Shield, 
  Star, 
  ArrowRight, 
  Instagram,
  Package,
  Truck,
  FileText,
  MapPin,
  RotateCcw,
  Award,
  History,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SaAndShaLogo } from '../components/SaAndShaLogo';
import { useSEO } from '../hooks/useSEO';
import { HeroSlider } from '../components/homepage/HeroSlider';
import { BestOfInstagram } from '../components/homepage/BestOfInstagram';
import { InstaReels } from '../components/homepage/InstaReels';
import { ProductCarouselShelf } from '../components/homepage/ProductCarouselShelf';

const collectionTiles = [
  {
    name: 'Pure Linen',
    subtitle: '100% European Flax',
    badge: '20 Styles',
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80',
    link: '/shop/collection/pure-linen',
    isComingSoon: false,
  },
  {
    name: 'Linen-Cotton Blend',
    subtitle: 'Supple Drape & Breathability',
    badge: '20 Styles',
    image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&q=80',
    link: '/shop/collection/linen-cotton-blend',
    isComingSoon: false,
  },
  {
    name: 'Pure Cotton',
    subtitle: 'Long-Staple Craftsmanship',
    badge: 'Coming Soon',
    image: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=600&q=80',
    link: '/shop/collection/pure-cotton',
    isComingSoon: true,
  },
  {
    name: 'Chinos',
    subtitle: 'Structured Twill Weave',
    badge: '10 Styles',
    image: 'https://images.unsplash.com/photo-1618886614638-80e3c103d31a?w=600&q=80',
    link: '/shop/collection/chinos',
    isComingSoon: false,
  }
];

const productTiles = [
  {
    name: 'Shirts',
    subtitle: 'Full & Half Sleeve',
    link: '/shop/product/shirts',
    isComingSoon: false,
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&q=80',
  },
  {
    name: 'Trousers',
    subtitle: 'Tailored & Relaxed',
    link: '/shop/product/trousers',
    isComingSoon: false,
    image: 'https://images.unsplash.com/photo-1505022610485-0249ba5b3675?w=400&q=80',
  },
  {
    name: 'Chinos',
    subtitle: 'Tailored Twill Fits',
    link: '/shop/product/chinos',
    isComingSoon: false,
    image: 'https://images.unsplash.com/photo-1618886614638-80e3c103d31a?w=400&q=80',
  },
  {
    name: 'Shorts',
    subtitle: 'Warm-Weather Cuts',
    link: '/shop/product/shorts',
    isComingSoon: true,
  },
  {
    name: 'Pyjamas',
    subtitle: 'Lounge Comfort',
    link: '/shop/product/pyjamas',
    isComingSoon: true,
  },
  {
    name: 'Kurtas',
    subtitle: 'Short & Long Line',
    link: '/shop/product/kurtas',
    isComingSoon: true,
  },
  {
    name: 'Co-Ord Sets',
    subtitle: 'Resort Duos',
    link: '/shop/product/co-ord-sets',
    isComingSoon: true,
  },
];

export const HomePage: React.FC = () => {
  useSEO({
    title: 'Sa and Sha | Premium Linen Clothing for Men',
    description: "Discover Sa and Sha — premium men's linen clothing designed for effortless comfort, breathable style and timeless everyday dressing.",
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Sa and Sha",
        "url": "https://www.saandsha.com",
        "potentialAction": {
          "@type": "SearchAction",
          "target": "https://www.saandsha.com/shop/all?search={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Sa and Sha",
        "url": "https://www.saandsha.com",
        "logo": "https://www.saandsha.com/logo.png",
        "sameAs": [
          "https://instagram.com",
          "https://facebook.com",
          "https://twitter.com",
          "https://pinterest.com"
        ],
        "brand": {
          "@type": "Brand",
          "name": "Sa and Sha"
        }
      }
    ]
  });

  const navigate = useNavigate();
  const [reviewIndex, setReviewIndex] = useState(0);
  const bestsellers = products.filter(p => p.bestseller).slice(0, 12);
  const newArrivals = products.filter(p => p.newArrival).slice(0, 12);

  const orgSchema = {
    "@context": "https://schema.org/",
    "@type": "Organization",
    "name": "Sa and Sha",
    "url": "https://www.saandsha.com",
    "logo": "https://www.saandsha.com/logo.png"
  };

  return (
    <div id="homepage-root" className="space-y-16 pb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />
      
      {/* 1. HERO CAROUSEL (CMS Controlled with Canonical 2400 × 1000 Proportion) */}
      <HeroSlider />


      {/* 2. WHY LINEN BRAND STORY (Scientific characteristics) */}
      <section className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-sans font-bold tracking-[0.25em] text-[#B85C38] uppercase">Core Fiber</span>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#1F1B16] mt-2 mb-4">Why Kora Pure Linen?</h2>
          <p className="font-sans text-xs md:text-sm text-[#1F1B16]/60 leading-relaxed font-medium">
            Linen is not just another fabric. Derived from the resilient flax plant, it is one of the world’s oldest, most sustainable, and naturally therapeutic fibers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-[#E4D8C3]/20 p-6 rounded-lg border border-[#C9B79C]/20 flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#E4D8C3] flex items-center justify-center text-[#B85C38]">
              <Wind className="w-5 h-5" />
            </div>
            <h3 className="font-serif font-bold text-sm text-[#1F1B16] uppercase tracking-wide">Extreme Breathability</h3>
            <p className="font-sans text-[11px] text-[#1F1B16]/70 leading-relaxed font-medium">
              Flax fibers are hollow, allowing continuous fresh air flow and heat conduction away from the skin instantly.
            </p>
          </div>

          <div className="bg-[#E4D8C3]/20 p-6 rounded-lg border border-[#C9B79C]/20 flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#E4D8C3] flex items-center justify-center text-[#B85C38]">
              <Droplets className="w-5 h-5" />
            </div>
            <h3 className="font-serif font-bold text-sm text-[#1F1B16] uppercase tracking-wide">Moisture Absorption</h3>
            <p className="font-sans text-[11px] text-[#1F1B16]/70 leading-relaxed font-medium">
              Can absorb up to 20% of its weight in moisture before feeling damp, keeping the skin dry and fresh.
            </p>
          </div>

          <div className="bg-[#E4D8C3]/20 p-6 rounded-lg border border-[#C9B79C]/20 flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#E4D8C3] flex items-center justify-center text-[#B85C38]">
              <Leaf className="w-5 h-5" />
            </div>
            <h3 className="font-serif font-bold text-sm text-[#1F1B16] uppercase tracking-wide">Highly Sustainable</h3>
            <p className="font-sans text-[11px] text-[#1F1B16]/70 leading-relaxed font-medium">
              Flax thrives with simple rainwater, zero synthetic fertilizers, and represents a completely biodegradable cycle.
            </p>
          </div>

          <div className="bg-[#E4D8C3]/20 p-6 rounded-lg border border-[#C9B79C]/20 flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#E4D8C3] flex items-center justify-center text-[#B85C38]">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-serif font-bold text-sm text-[#1F1B16] uppercase tracking-wide">Artisanal Finish</h3>
            <p className="font-sans text-[11px] text-[#1F1B16]/70 leading-relaxed font-medium">
              Pre-washed and garment-shrunk by skilled tailors in India to secure a buttery slub feel that softens with age.
            </p>
          </div>
        </div>
      </section>


      {/* 3. SHOP BY COLLECTION & SHOP BY PRODUCT */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 space-y-16">
        
        {/* Sub-section A: Shop by Collection */}
        <div>
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-sans font-bold tracking-[0.25em] text-[#5C6B4A] uppercase">Curated Fabrications</span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#1F1B16] mt-2">Shop by Collection</h2>
            <p className="font-sans text-xs md:text-sm text-[#1F1B16]/65 mt-2">
              Explore our core material stories — from certified European flax to structured hybrid twills.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {collectionTiles.map((tile) => (
              <div
                key={tile.name}
                onClick={() => navigate(tile.link)}
                className="group cursor-pointer rounded-lg overflow-hidden border border-[#C9B79C]/25 shadow-sm relative h-96 bg-stone-100 flex flex-col justify-end"
                id={`col-tile-${tile.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
              >
                {/* Image & overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10 group-hover:from-black/85 transition-colors duration-500 z-10" />
                <img
                  src={tile.image}
                  alt={tile.name}
                  className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />

                {/* Top Badge */}
                <div className="absolute top-4 right-4 z-20">
                  <span className={`text-[10px] font-sans font-semibold tracking-wider px-2.5 py-1 rounded ${
                    tile.isComingSoon 
                      ? 'bg-[#C9B79C] text-[#1F1B16] uppercase' 
                      : 'bg-white/20 backdrop-blur-sm text-white'
                  }`}>
                    {tile.badge}
                  </span>
                </div>

                {/* Text Meta Content */}
                <div className="relative z-20 p-6 flex flex-col text-[#F5F1E8]">
                  <span className="text-[10px] font-sans tracking-[0.2em] uppercase text-[#C9B79C] font-semibold">
                    {tile.subtitle}
                  </span>
                  <h3 className="font-serif text-2xl font-bold mt-1 tracking-wide">
                    {tile.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs font-sans font-bold tracking-widest mt-3 uppercase opacity-90 group-hover:opacity-100 transition-opacity duration-300 text-[#F5F1E8]">
                    <span>{tile.isComingSoon ? 'Preview Collection' : 'Explore Collection'}</span>
                    <ArrowRight className="w-4 h-4 text-[#B85C38] group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sub-section B: Shop by Product */}
        <div className="pt-4 border-t border-[#C9B79C]/20">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-sans font-bold tracking-[0.25em] text-[#B85C38] uppercase">Garment Architecture</span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#1F1B16] mt-2">Shop by Product</h2>
            <p className="font-sans text-xs md:text-sm text-[#1F1B16]/65 mt-2">
              Every category tailored for tropical breathability, clean drape, and enduring shape.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {productTiles.map((tile) => (
              <div
                key={tile.name}
                onClick={() => navigate(tile.link)}
                className={`group cursor-pointer rounded-lg border transition-all p-5 flex flex-col justify-between min-h-[170px] relative overflow-hidden ${
                  tile.isComingSoon
                    ? 'bg-[#F5F1E8]/40 border-[#C9B79C]/30 hover:border-[#C9B79C]'
                    : 'bg-white border-[#C9B79C]/25 hover:border-[#B85C38]/40 hover:shadow-md'
                }`}
                id={`prod-tile-${tile.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
              >
                {/* Background image preview if available */}
                {tile.image && (
                  <div className="absolute right-0 bottom-0 w-24 h-24 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none overflow-hidden">
                    <img src={tile.image} alt="" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="space-y-1 relative z-10">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-lg sm:text-xl font-bold text-[#1F1B16] group-hover:text-[#B85C38] transition-colors">
                      {tile.name}
                    </h3>
                    {tile.isComingSoon && (
                      <span className="text-[9px] font-sans font-semibold uppercase tracking-wider bg-[#C9B79C]/30 text-[#1F1B16]/80 px-2 py-0.5 rounded">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="font-sans text-xs text-[#1F1B16]/60">
                    {tile.subtitle}
                  </p>
                </div>

                <div className="pt-4 flex items-center justify-between relative z-10 border-t border-[#C9B79C]/15 mt-3">
                  <span className="text-[11px] font-sans font-bold tracking-wider uppercase text-[#1F1B16]/75 group-hover:text-[#B85C38] transition-colors">
                    {tile.isComingSoon ? 'Explore Preview' : 'Browse Products'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#B85C38] group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>

      </section>

      {/* BEST OF INSTAGRAM (CMS Controlled - Immediately following Shop by Product) */}
      <BestOfInstagram />

      {/* INSTA REELS (CMS Controlled - Immediately following Best of Instagram) */}
      <InstaReels />


      {/* 4. BESTSELLERS (Auto-Scroll Horizontal Shelf) */}
      <ProductCarouselShelf
        idPrefix="bestsellers"
        eyebrow="Highly Coveted"
        eyebrowColorClass="text-[#B85C38]"
        title="Our Bestsellers"
        subtitle="Our most sought-after silhouettes, crafted with uncompromising precision from certified flax."
        viewAllLink="/shop/bestsellers"
        viewAllId="all-bestsellers-link"
        leftScrollId="best-scroll-left"
        rightScrollId="best-scroll-right"
        products={bestsellers}
        autoScrollIntervalMs={4500}
        bgClassName="bg-[#E4D8C3]/15 py-16"
        showBorderY={true}
      />

      {/* 5. FRESH ARRIVALS (Auto-Scroll Horizontal Shelf) */}
      <ProductCarouselShelf
        idPrefix="fresh-arrivals"
        eyebrow="Newly Woven"
        eyebrowColorClass="text-[#5C6B4A]"
        title="Fresh Arrivals"
        subtitle="Just off the loom — contemporary silhouettes woven with authentic European flax."
        viewAllLink="/shop/new-arrivals"
        viewAllId="all-new-arrivals-link"
        leftScrollId="fresh-scroll-left"
        rightScrollId="fresh-scroll-right"
        products={newArrivals}
        autoScrollIntervalMs={4500}
        bgClassName="py-12"
        showBorderY={false}
      />


      {/* 6. EDITORIAL STORY BANNER */}
      <section className="w-full bg-[#1F1B16] py-20 px-4 md:px-12 flex items-center justify-center text-center relative border-y border-[#C9B79C]/20">
        <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800')] bg-cover bg-center" />
        <div className="max-w-3xl space-y-6 text-[#F5F1E8] relative z-10 flex flex-col items-center">
          <SaAndShaLogo light className="h-14 w-auto mx-auto" />
          <span className="text-xs font-sans font-bold tracking-[0.3em] text-[#C9B79C] uppercase">Sustainable Luxury</span>
          <h2 className="font-serif text-3xl md:text-4xl font-semibold leading-tight">Woven with Purpose. Tailored with Patience.</h2>
          <p className="font-sans text-xs md:text-sm text-[#F5F1E8]/70 leading-relaxed font-medium">
            At Sa and Sha, our garments represent ancient fiber craftsmanship optimized for the modern luxury drawer. Every single shirt and trouser originates from organic certified flax fields in Belgium, hand-spun by master weavers, and pre-washed so that your very first wear delivers the softness of a thousand washes.
          </p>
          <div className="pt-4">
            <Link
              to="/about"
              className="bg-[#B85C38] hover:bg-[#B85C38]/90 text-white font-sans font-bold text-xs uppercase tracking-widest py-4 px-8 rounded transition-all active:scale-95 inline-block"
            >
              Learn Our Story
            </Link>
          </div>
        </div>
      </section>


      {/* 7. CUSTOMERS TESTIMONIALS */}
      <section className="max-w-4xl mx-auto px-4 text-center">
        <span className="text-xs font-sans font-bold tracking-[0.25em] text-[#C9B79C] uppercase">Sartorial Feedback</span>
        <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#1F1B16] mt-1 mb-8">What They Say</h2>

        <div className="bg-[#E4D8C3]/25 p-8 md:p-12 rounded-xl border border-[#C9B79C]/20 relative">
          <div className="flex justify-center text-amber-500 mb-4 gap-0.5">
            {[...Array(mockReviews[reviewIndex].rating)].map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-current" />
            ))}
          </div>

          <p className="font-serif text-base md:text-lg text-[#1F1B16] leading-relaxed italic mb-6">
            "{mockReviews[reviewIndex].comment}"
          </p>

          <div className="font-sans text-xs font-bold uppercase tracking-widest text-[#1F1B16]">
            {mockReviews[reviewIndex].userName} <span className="text-[#5C6B4A] text-[10px] font-semibold tracking-normal lowercase ml-1.5">• Verified Patron</span>
          </div>

          {/* Dots Navigation */}
          <div className="flex justify-center gap-2 mt-6">
            {mockReviews.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setReviewIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  reviewIndex === idx ? 'bg-[#B85C38] w-5' : 'bg-[#1F1B16]/20 hover:bg-[#1F1B16]'
                }`}
                id={`review-dot-${idx}`}
                aria-label={`Go to review ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </section>


      {/* 9. CUSTOMER ACCOUNT & SECURE SIGN-IN */}
      <section className="max-w-7xl mx-auto px-4 md:px-6" id="sec-account-signin-info">
        <div className="bg-[#E4D8C3]/15 rounded-xl border border-[#C9B79C]/30 p-8 md:p-12 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-sans font-bold tracking-[0.25em] text-[#B85C38] uppercase">Customer Portal</span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#1F1B16]">
              Customer Account & Secure Sign-In
            </h2>
            <p className="font-sans text-xs md:text-sm text-[#1F1B16]/70 leading-relaxed font-medium">
              Sign in securely using Google or Mobile OTP to manage your Sa and Sha customer account.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-[#C9B79C]/25 shadow-sm flex items-start gap-3">
              <Package className="w-5 h-5 text-[#B85C38] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#1F1B16]">View Order History</h3>
                <p className="font-sans text-[11px] text-stone-600 mt-0.5">Access past and current order details instantly.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#C9B79C]/25 shadow-sm flex items-start gap-3">
              <Truck className="w-5 h-5 text-[#B85C38] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#1F1B16]">Track Orders</h3>
                <p className="font-sans text-[11px] text-stone-600 mt-0.5">Real-time live courier tracking and status updates.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#C9B79C]/25 shadow-sm flex items-start gap-3">
              <FileText className="w-5 h-5 text-[#B85C38] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#1F1B16]">Download Tax Invoices</h3>
                <p className="font-sans text-[11px] text-stone-600 mt-0.5">Instant PDF GST tax invoices for B2C and B2B purchases.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#C9B79C]/25 shadow-sm flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#B85C38] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#1F1B16]">Save Delivery Addresses</h3>
                <p className="font-sans text-[11px] text-stone-600 mt-0.5">Manage home, work, and saved shipping addresses.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#C9B79C]/25 shadow-sm flex items-start gap-3">
              <RotateCcw className="w-5 h-5 text-[#B85C38] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#1F1B16]">Manage Returns & Exchanges</h3>
                <p className="font-sans text-[11px] text-stone-600 mt-0.5">Submit 7-day doorstep return and size exchange requests.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#C9B79C]/25 shadow-sm flex items-start gap-3">
              <Award className="w-5 h-5 text-[#B85C38] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#1F1B16]">Access Loyalty Benefits</h3>
                <p className="font-sans text-[11px] text-stone-600 mt-0.5">Earn and redeem Kora Rewards store credit on orders.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#C9B79C]/25 shadow-sm flex items-start gap-3">
              <History className="w-5 h-5 text-[#B85C38] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#1F1B16]">View Login History</h3>
                <p className="font-sans text-[11px] text-stone-600 mt-0.5">Audit account login timestamps and authentication events.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#C9B79C]/25 shadow-sm flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-[#B85C38] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#1F1B16]">Manage Active Devices & Sessions</h3>
                <p className="font-sans text-[11px] text-stone-600 mt-0.5">Monitor and revoke active logins across devices securely.</p>
              </div>
            </div>
          </div>

          <div className="text-center space-y-3 pt-4 border-t border-[#C9B79C]/20">
            <p className="font-sans text-xs text-[#1F1B16]/80 max-w-2xl mx-auto leading-relaxed font-medium">
              Google Sign-In is optional and is used only to securely authenticate customers and provide access to their Sa and Sha account. Customers may also sign in using Mobile OTP.
            </p>
            <div>
              <Link
                to="/privacy-policy"
                className="inline-flex items-center gap-1 text-xs font-sans font-bold text-[#B85C38] hover:underline"
              >
                <span>Learn more in our Privacy Policy</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
