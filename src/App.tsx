import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ShopProvider } from './context/ShopContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { Toast } from './components/Toast';
import { useSEO } from './hooks/useSEO';

// Pages
import { HomePage } from './pages/HomePage';
import { CollectionPage } from './pages/CollectionPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { WishlistPage } from './pages/WishlistPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { TrackOrderPage } from './pages/TrackOrderPage';
import { ReturnsExchangesPage } from './pages/ReturnsExchangesPage';
import { ContactSupportPage } from './pages/ContactSupportPage';
import { ShippingDeliveryPage } from './pages/ShippingDeliveryPage';
import { AboutPage } from './pages/AboutPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsConditionsPage } from './pages/TermsConditionsPage';
import { AdminPage } from './pages/AdminPage';
import { CustomerDashboardPage } from './pages/CustomerDashboardPage';
import { CustomerOrdersPage } from './pages/CustomerOrdersPage';
import { CustomerOrderDetailsPage } from './pages/CustomerOrderDetailsPage';
import { CustomerRewardsPage } from './pages/CustomerRewardsPage';
import { CustomerProfilePage } from './pages/CustomerProfilePage';
import { CustomerReturnsPage } from './pages/CustomerReturnsPage';
import { CreateAccountPage } from './pages/CreateAccountPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Simple Scroll To Top helper to handle router transits
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

// Help & FAQ Care Guide page
const FAQPage: React.FC = () => {
  useSEO({
    title: 'Fabric Care Guide & FAQs | Sa and Sha',
    description: 'Learn how to wash, iron, and care for your Sa and Sha apparel. Frequently asked questions about sizing, fabric, and returns.'
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-8 text-stone-800">
      <div className="text-center space-y-2 border-b border-[#E5D2BC]/20 pb-6">
        <span className="text-xs font-sans font-bold tracking-[0.25em] text-[#B08D57] uppercase">Care Guide</span>
        <h1 className="font-serif text-3xl md:text-4xl font-bold">Fabric Care & FAQs</h1>
        <p className="font-sans text-xs md:text-sm text-stone-500 max-w-lg mx-auto">
          A little care goes a long way. Here's how to wash, press, and look after your Sa and Sha pieces so they last.
        </p>
      </div>

      <div className="space-y-6 font-sans text-xs md:text-sm leading-relaxed">

        <div className="bg-[#F4E6D7]/20 p-6 rounded-lg border border-[#E5D2BC]/20 space-y-3">
          <h2 className="font-serif text-base font-bold text-[#2A211C] uppercase tracking-wider">🌿 Wash and Care Guide</h2>
          <ul className="list-decimal pl-4 space-y-2 text-[#2A211C]/80 font-medium">
            <li><strong>Machine Wash:</strong> Wash on a gentle, cool cycle (maximum 30°C) with similar colors using a mild liquid detergent.</li>
            <li><strong>No Bleach:</strong> Never use bleach. Avoid fabric softeners on delicate or embellished pieces.</li>
            <li><strong>Drying:</strong> Hang-dry in shade where possible. Avoid direct, high-intensity sunlight, which can fade colors. Avoid high-heat tumble drying.</li>
            <li><strong>Pressing:</strong> Check the care label for the right iron setting for each fabric, and always press delicate prints or embellishments from the reverse side.</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h2 className="font-serif text-lg font-bold text-[#2A211C] uppercase tracking-wider border-b border-[#E5D2BC]/10 pb-2">📦 Frequently Asked Questions</h2>

          <div className="space-y-2">
            <h3 className="font-serif font-bold text-sm text-[#2A211C]">Q: Will my order shrink after washing?</h3>
            <p className="text-stone-600">A: Our garments are pre-washed where applicable to minimize shrinkage, but we still recommend following the care label for best results.</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-serif font-bold text-sm text-[#2A211C]">Q: Why does my fabric have slight texture variations?</h3>
            <p className="text-stone-600">A: Depending on the fabric, minor texture variations are a natural characteristic of the material, not a defect.</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-serif font-bold text-sm text-[#2A211C]">Q: Do you offer exchanges and what is the cost?</h3>
            <p className="text-stone-600">A: We provide complete 100% free exchanges within 7 days of delivery! Simply submit a request within 7 days of receiving your order and we will coordinate a reverse-pickup at your doorstep for zero shipping charge.</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-serif font-bold text-sm text-[#2A211C]">Q: How do I choose the right size?</h3>
            <p className="text-stone-600">A: Check the size guide on each product page. If you're between sizes, we generally recommend sizing up for a more comfortable fit.</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default function App() {
  const [isCartOpen, setIsCartOpen] = useState(false);

  return (
    <ShopProvider>
      <BrowserRouter>
        <ScrollToTop />
        <div className="min-h-screen flex flex-col justify-between bg-[#FBF6EE] text-[#2A211C] antialiased font-sans">
          
          {/* Header element */}
          <Header onOpenCart={() => setIsCartOpen(true)} />

          {/* Overlays */}
          <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
          <Toast />

          {/* Core dynamic body routes */}
          <main className="flex-grow pb-16">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/shop" element={<CollectionPage />} />
              <Route path="/shop/all" element={<CollectionPage />} />
              <Route path="/shop/bestsellers" element={<CollectionPage />} />
              <Route path="/shop/new-arrivals" element={<CollectionPage />} />

              {/* Canonical Collection Routes */}
              <Route path="/shop/collection/:collectionId" element={<CollectionPage />} />
              <Route path="/shop/collection/:collectionId/:productTypeId" element={<CollectionPage />} />

              {/* Canonical Product Type & Subtype Routes */}
              <Route path="/shop/product/:productTypeId" element={<CollectionPage />} />
              <Route path="/shop/product/:productTypeId/:subTypeSlug" element={<CollectionPage />} />

              {/* Convenience aliases to canonical product routes */}
              <Route path="/shop/tops-shirts" element={<Navigate to="/shop/product/tops-shirts" replace />} />
              <Route path="/shop/shorts-skirts" element={<Navigate to="/shop/product/shorts-skirts" replace />} />
              <Route path="/shop/trousers" element={<Navigate to="/shop/product/trousers" replace />} />
              <Route path="/shop/jackets" element={<Navigate to="/shop/product/jackets" replace />} />
              <Route path="/shop/bags-pouches" element={<Navigate to="/shop/product/bags-pouches" replace />} />

              {/* Fallback category route */}
              <Route path="/shop/:categorySlug" element={<CollectionPage />} />
              <Route path="/product/:slug" element={<ProductDetailPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/track-order" element={<TrackOrderPage />} />
              <Route path="/track-order/:trackingToken" element={<TrackOrderPage />} />
              <Route path="/track" element={<TrackOrderPage />} />
              <Route path="/returns-exchanges" element={<ReturnsExchangesPage />} />
              <Route path="/returns" element={<ReturnsExchangesPage />} />
              <Route path="/contact-support" element={<ContactSupportPage />} />
              <Route path="/contact" element={<ContactSupportPage />} />
              <Route path="/shipping-delivery" element={<ShippingDeliveryPage />} />
              <Route path="/shipping" element={<Navigate to="/shipping-delivery" replace />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms-and-conditions" element={<TermsConditionsPage />} />
              <Route path="/terms" element={<TermsConditionsPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/account" element={<CustomerDashboardPage />} />
              <Route path="/create-account" element={<CreateAccountPage />} />
              <Route path="/register" element={<Navigate to="/create-account" replace />} />
              <Route path="/account/orders" element={<CustomerOrdersPage />} />
              <Route path="/account/orders/:orderId" element={<CustomerOrderDetailsPage />} />
              <Route path="/account/orders/:orderId/track" element={<CustomerOrderDetailsPage />} />
              <Route path="/account/orders/:orderId/return" element={<CustomerOrderDetailsPage />} />
              <Route path="/account/rewards" element={<CustomerRewardsPage />} />
              <Route path="/account/profile" element={<CustomerProfilePage />} />
              <Route path="/account/returns" element={<CustomerReturnsPage />} />
              <Route path="/account/returns/:id" element={<CustomerReturnsPage />} />
              <Route path="/profile" element={<CustomerProfilePage />} />
              <Route path="/rewards" element={<CustomerRewardsPage />} />
              <Route path="/portal" element={<CustomerDashboardPage />} />
              <Route path="/dashboard" element={<CustomerDashboardPage />} />
              <Route path="/admin" element={<AdminPage />} />
              {/* Fallback to custom 404 page */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>

          {/* Footer element */}
          <Footer />

        </div>
      </BrowserRouter>
    </ShopProvider>
  );
}
