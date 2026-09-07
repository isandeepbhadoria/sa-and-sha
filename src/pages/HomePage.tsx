import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { products } from '../data';
import {
  ArrowRight,
  Package,
  Truck,
  FileText,
  MapPin,
  RotateCcw,
  Award,
  History,
  Smartphone
} from 'lucide-react';
import { SaAndShaLogo } from '../components/SaAndShaLogo';
import { useSEO } from '../hooks/useSEO';
import { HeroSlider } from '../components/homepage/HeroSlider';
import { BestOfInstagram } from '../components/homepage/BestOfInstagram';
import { InstaReels } from '../components/homepage/InstaReels';
import { ProductCarouselShelf } from '../components/homepage/ProductCarouselShelf';

const categoryTiles = [
  {
    name: 'Dresses',
    subtitle: 'Day to Evening',
    link: '/shop/product/dresses',
    productTypeId: 'dresses',
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&q=80',
  },
  {
    name: 'Top & Shirts',
    subtitle: 'Everyday Essentials',
    link: '/shop/product/tops-shirts',
    productTypeId: 'tops-shirts',
    image: 'https://images.unsplash.com/photo-1551803091-e20673f15770?w=600&q=80',
  },
  {
    name: 'Shorts & Skirts',
    subtitle: 'Warm-Weather Silhouettes',
    link: '/shop/product/shorts-skirts',
    productTypeId: 'shorts-skirts',
    image: 'https://images.unsplash.com/photo-1583496661160-fb5886a13d77?w=600&q=80',
  },
  {
    name: 'Co-Ord Sets',
    subtitle: 'Matching Duos',
    link: '/shop/product/co-ord-sets',
    productTypeId: 'co-ord-sets',
    image: 'https://images.unsplash.com/photo-1614251056216-f748f76cd228?w=600&q=80',
  },
  {
    name: 'Trousers',
    subtitle: 'Tailored & Relaxed',
    link: '/shop/product/trousers',
    productTypeId: 'trousers',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&q=80',
  },
  {
    name: 'Jackets',
    subtitle: 'Layers for Every Season',
    link: '/shop/product/jackets',
    productTypeId: 'jackets',
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&q=80',
  },
  {
    name: 'Bags & Pouches',
    subtitle: 'Finishing Touches',
    link: '/shop/product/bags-pouches',
    productTypeId: 'bags-pouches',
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80',
  },
];

export const HomePage: React.FC = () => {
  useSEO({
    title: 'Sa and Sha | Ladies Apparel',
    description: "Discover Sa and Sha — dresses, tops & shirts, co-ord sets, and more, designed for everyday elegance.",
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
  const bestsellers = products.filter(p => p.bestseller).slice(0, 12);
  const categoryTilesWithStatus = useMemo(() => {
    return categoryTiles.map(tile => ({
      ...tile,
      isComingSoon: !products.some(
        p => p.productType === tile.productTypeId && p.status !== 'archived' && p.status !== 'draft' && !p.isDecommissioned
      )
    }));
  }, []);
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


      {/* 2. SHOP BY CATEGORY */}
      <section className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-sans font-bold tracking-[0.25em] text-[#C98A82] uppercase">Explore</span>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#2A211C] mt-2">Shop by Category</h2>
          <p className="font-sans text-xs md:text-sm text-[#2A211C]/65 mt-2">
            From everyday essentials to occasion pieces, find your next favorite.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
          {categoryTilesWithStatus.map((tile) => (
            <div
              key={tile.name}
              onClick={() => navigate(tile.link)}
              className="group cursor-pointer rounded-lg overflow-hidden border border-[#E5D2BC]/25 shadow-sm relative h-72 sm:h-80 bg-stone-100 flex flex-col justify-end"
              id={`cat-tile-${tile.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/5 group-hover:from-black/85 transition-colors duration-500 z-10" />
              <img
                src={tile.image}
                alt={tile.name}
                className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />

              {tile.isComingSoon && (
                <div className="absolute top-4 right-4 z-20">
                  <span className="text-[10px] font-sans font-semibold tracking-wider px-2.5 py-1 rounded bg-[#E5D2BC] text-[#2A211C] uppercase">
                    Coming Soon
                  </span>
                </div>
              )}

              <div className="relative z-20 p-5 flex flex-col text-[#FBF6EE]">
                <span className="text-[10px] font-sans tracking-[0.2em] uppercase text-[#E5D2BC] font-semibold">
                  {tile.subtitle}
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-bold mt-1 tracking-wide">
                  {tile.name}
                </h3>
                <div className="flex items-center gap-1.5 text-xs font-sans font-bold tracking-widest mt-3 uppercase opacity-90 group-hover:opacity-100 transition-opacity duration-300 text-[#FBF6EE]">
                  <span>Explore</span>
                  <ArrowRight className="w-4 h-4 text-[#B08D57] group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))}
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
        eyebrowColorClass="text-[#B08D57]"
        title="Our Bestsellers"
        subtitle="Our most-loved silhouettes, crafted with uncompromising attention to detail."
        viewAllLink="/shop/bestsellers"
        viewAllId="all-bestsellers-link"
        leftScrollId="best-scroll-left"
        rightScrollId="best-scroll-right"
        products={bestsellers}
        autoScrollIntervalMs={4500}
        bgClassName="bg-[#F4E6D7]/15 py-16"
        showBorderY={true}
      />

      {/* 5. FRESH ARRIVALS (Auto-Scroll Horizontal Shelf) */}
      <ProductCarouselShelf
        idPrefix="fresh-arrivals"
        eyebrow="Just In"
        eyebrowColorClass="text-[#C98A82]"
        title="Fresh Arrivals"
        subtitle="Fresh styles, added weekly, for every occasion."
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
      <section className="w-full bg-[#2A211C] py-20 px-4 md:px-12 flex items-center justify-center text-center relative border-y border-[#E5D2BC]/20">
        <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800')] bg-cover bg-center" />
        <div className="max-w-3xl space-y-6 text-[#FBF6EE] relative z-10 flex flex-col items-center">
          <SaAndShaLogo light className="h-14 w-auto mx-auto" />
          <span className="text-xs font-sans font-bold tracking-[0.3em] text-[#E5D2BC] uppercase">Our Story</span>
          <h2 className="font-serif text-3xl md:text-4xl font-semibold leading-tight">Effortless Elegance, Everyday.</h2>
          <p className="font-sans text-xs md:text-sm text-[#FBF6EE]/70 leading-relaxed font-medium">
            Sa and Sha designs for the woman who wants to feel put-together without trying too hard —
            considered silhouettes, quality fabrics, and details that hold up to real life.
          </p>
          <div className="pt-4">
            <Link
              to="/about"
              className="bg-[#B08D57] hover:bg-[#B08D57]/90 text-white font-sans font-bold text-xs uppercase tracking-widest py-4 px-8 rounded transition-all active:scale-95 inline-block"
            >
              Learn Our Story
            </Link>
          </div>
        </div>
      </section>


      {/* 9. CUSTOMER ACCOUNT & SECURE SIGN-IN */}
      <section className="max-w-7xl mx-auto px-4 md:px-6" id="sec-account-signin-info">
        <div className="bg-[#F4E6D7]/15 rounded-xl border border-[#E5D2BC]/30 p-8 md:p-12 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-sans font-bold tracking-[0.25em] text-[#B08D57] uppercase">Customer Portal</span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#2A211C]">
              Customer Account & Secure Sign-In
            </h2>
            <p className="font-sans text-xs md:text-sm text-[#2A211C]/70 leading-relaxed font-medium">
              Sign in securely using Google or Mobile OTP to manage your Sa and Sha customer account.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-[#E5D2BC]/25 shadow-sm flex items-start gap-3">
              <Package className="w-5 h-5 text-[#B08D57] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#2A211C]">View Order History</h3>
                <p className="font-sans text-[11px] text-stone-600 mt-0.5">Access past and current order details instantly.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#E5D2BC]/25 shadow-sm flex items-start gap-3">
              <Truck className="w-5 h-5 text-[#B08D57] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#2A211C]">Track Orders</h3>
                <p className="font-sans text-[11px] text-stone-600 mt-0.5">Real-time live courier tracking and status updates.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#E5D2BC]/25 shadow-sm flex items-start gap-3">
              <FileText className="w-5 h-5 text-[#B08D57] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#2A211C]">Download Tax Invoices</h3>
                <p className="font-sans text-[11px] text-stone-600 mt-0.5">Instant PDF GST tax invoices for B2C and B2B purchases.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#E5D2BC]/25 shadow-sm flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#B08D57] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#2A211C]">Save Delivery Addresses</h3>
                <p className="font-sans text-[11px] text-stone-600 mt-0.5">Manage home, work, and saved shipping addresses.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#E5D2BC]/25 shadow-sm flex items-start gap-3">
              <RotateCcw className="w-5 h-5 text-[#B08D57] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#2A211C]">Manage Returns & Exchanges</h3>
                <p className="font-sans text-[11px] text-stone-600 mt-0.5">Submit 7-day doorstep return and size exchange requests.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#E5D2BC]/25 shadow-sm flex items-start gap-3">
              <Award className="w-5 h-5 text-[#B08D57] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#2A211C]">Access Loyalty Benefits</h3>
                <p className="font-sans text-[11px] text-stone-600 mt-0.5">Earn and redeem Sa and Sha Rewards store credit on orders.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#E5D2BC]/25 shadow-sm flex items-start gap-3">
              <History className="w-5 h-5 text-[#B08D57] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#2A211C]">View Login History</h3>
                <p className="font-sans text-[11px] text-stone-600 mt-0.5">Audit account login timestamps and authentication events.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-[#E5D2BC]/25 shadow-sm flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-[#B08D57] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#2A211C]">Manage Active Devices & Sessions</h3>
                <p className="font-sans text-[11px] text-stone-600 mt-0.5">Monitor and revoke active logins across devices securely.</p>
              </div>
            </div>
          </div>

          <div className="text-center space-y-3 pt-4 border-t border-[#E5D2BC]/20">
            <p className="font-sans text-xs text-[#2A211C]/80 max-w-2xl mx-auto leading-relaxed font-medium">
              Google Sign-In is optional and is used only to securely authenticate customers and provide access to their Sa and Sha account. Customers may also sign in using Mobile OTP.
            </p>
            <div>
              <Link
                to="/privacy-policy"
                className="inline-flex items-center gap-1 text-xs font-sans font-bold text-[#B08D57] hover:underline"
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
