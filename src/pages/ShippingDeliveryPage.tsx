import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Truck, 
  PackageCheck, 
  Clock, 
  MapPin, 
  AlertCircle, 
  ChevronRight, 
  ShieldCheck, 
  RotateCcw,
  Headphones,
  Box
} from 'lucide-react';
import { useSEO } from '../hooks/useSEO';

export const ShippingDeliveryPage: React.FC = () => {
  useSEO({
    title: 'Shipping & Delivery | Sa and Sha',
    description: 'Learn about Sa and Sha shipping charges, order processing and delivery timelines across India. Free shipping on orders above ₹1,999.',
    canonical: 'https://www.saandsha.com/shipping-delivery',
    noindex: false,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'Home',
          'item': 'https://www.saandsha.com'
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': 'Shipping & Delivery',
          'item': 'https://www.saandsha.com/shipping-delivery'
        }
      ]
    }
  });

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-16 space-y-10 text-[#2A211C]" id="shipping-delivery-page">
      
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="text-xs font-sans text-stone-500 flex items-center gap-2">
        <Link to="/" className="hover:text-[#B08D57] transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3 text-stone-400" />
        <span className="text-[#2A211C] font-medium">Shipping & Delivery</span>
      </nav>

      {/* Hero / Page Header */}
      <div className="text-center space-y-3 border-b border-[#E5D2BC]/30 pb-8">
        <span className="text-xs font-sans font-bold tracking-[0.25em] text-[#B08D57] uppercase flex items-center justify-center gap-1.5">
          <Truck className="w-4 h-4 text-[#B08D57]" /> Customer Service
        </span>
        <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-[#2A211C]">
          Shipping & Delivery
        </h1>
        <p className="font-sans text-xs md:text-sm text-stone-600 max-w-2xl mx-auto leading-relaxed">
          At Sa and Sha, we aim to make your shopping experience simple and reliable from the moment you place your order until it reaches your doorstep. Please review the information below regarding order processing, shipping charges, delivery timelines and other important delivery information.
        </p>
      </div>

      {/* Quick Shipping Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="shipping-summary-grid">
        <div className="bg-white/80 p-5 rounded-lg border border-[#E5D2BC]/30 shadow-sm space-y-2 text-center sm:text-left">
          <div className="w-10 h-10 rounded-full bg-[#F4E6D7]/30 flex items-center justify-center mx-auto sm:mx-0 text-[#B08D57]">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-sans font-bold uppercase tracking-wider text-[#B08D57]">Free Shipping</div>
            <div className="text-sm font-serif font-bold text-[#2A211C]">Orders Above ₹1,999</div>
            <div className="text-[11px] font-sans text-stone-500 mt-1">Complimentary domestic delivery across India</div>
          </div>
        </div>

        <div className="bg-white/80 p-5 rounded-lg border border-[#E5D2BC]/30 shadow-sm space-y-2 text-center sm:text-left">
          <div className="w-10 h-10 rounded-full bg-[#F4E6D7]/30 flex items-center justify-center mx-auto sm:mx-0 text-[#2A211C]">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-sans font-bold uppercase tracking-wider text-[#2A211C]/60">Standard Shipping</div>
            <div className="text-sm font-serif font-bold text-[#2A211C]">₹99 Flat Fee</div>
            <div className="text-[11px] font-sans text-stone-500 mt-1">Applicable on orders up to ₹1,999</div>
          </div>
        </div>

        <div className="bg-white/80 p-5 rounded-lg border border-[#E5D2BC]/30 shadow-sm space-y-2 text-center sm:text-left">
          <div className="w-10 h-10 rounded-full bg-[#F4E6D7]/30 flex items-center justify-center mx-auto sm:mx-0 text-[#C98A82]">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-sans font-bold uppercase tracking-wider text-[#C98A82]">Order Processing</div>
            <div className="text-sm font-serif font-bold text-[#2A211C]">1–2 Business Days</div>
            <div className="text-[11px] font-sans text-stone-500 mt-1">Quality inspection & dispatch preparation</div>
          </div>
        </div>

        <div className="bg-white/80 p-5 rounded-lg border border-[#E5D2BC]/30 shadow-sm space-y-2 text-center sm:text-left">
          <div className="w-10 h-10 rounded-full bg-[#F4E6D7]/30 flex items-center justify-center mx-auto sm:mx-0 text-[#2A211C]">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-sans font-bold uppercase tracking-wider text-[#2A211C]/60">Estimated Delivery</div>
            <div className="text-sm font-serif font-bold text-[#2A211C]">3–5 Business Days</div>
            <div className="text-[11px] font-sans text-stone-500 mt-1">Standard transit time across India</div>
          </div>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="space-y-8 font-sans text-xs md:text-sm leading-relaxed" id="shipping-policy-details">

        {/* Section 1: Shipping Coverage */}
        <section className="bg-white/60 p-6 md:p-8 rounded-xl border border-[#E5D2BC]/30 space-y-3">
          <div className="flex items-center gap-2.5 border-b border-[#E5D2BC]/20 pb-3">
            <MapPin className="w-5 h-5 text-[#B08D57]" />
            <h2 className="font-serif text-lg font-bold text-[#2A211C] tracking-wide">Shipping Coverage</h2>
          </div>
          <p className="text-stone-700">
            Sa and Sha currently ships orders within <strong>India only</strong>.
          </p>
          <p className="text-stone-600">
            We do not currently offer international shipping.
          </p>
        </section>

        {/* Section 2: Order Processing */}
        <section className="bg-white/60 p-6 md:p-8 rounded-xl border border-[#E5D2BC]/30 space-y-3">
          <div className="flex items-center gap-2.5 border-b border-[#E5D2BC]/20 pb-3">
            <Clock className="w-5 h-5 text-[#C98A82]" />
            <h2 className="font-serif text-lg font-bold text-[#2A211C] tracking-wide">Order Processing</h2>
          </div>
          <p className="text-stone-700">
            Orders are generally processed and prepared for dispatch within <strong>1–2 business days</strong> after order confirmation.
          </p>
          <p className="text-stone-600">
            Orders placed on Sundays, public holidays or during high-volume periods may require additional processing time.
          </p>
          <p className="text-stone-600">
            Once your order has been dispatched, tracking information will be made available through the applicable order or shipment communication.
          </p>
        </section>

        {/* Section 3: Shipping Charges */}
        <section className="bg-white/60 p-6 md:p-8 rounded-xl border border-[#E5D2BC]/30 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[#E5D2BC]/20 pb-3">
            <ShieldCheck className="w-5 h-5 text-[#B08D57]" />
            <h2 className="font-serif text-lg font-bold text-[#2A211C] tracking-wide">Shipping Charges</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-2">
            <div className="bg-[#F4E6D7]/20 p-4 rounded-lg border border-[#E5D2BC]/30 space-y-1">
              <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#B08D57]">Orders Above ₹1,999</span>
              <div className="text-base font-serif font-bold text-[#2A211C]">FREE SHIPPING</div>
            </div>
            <div className="bg-stone-50 p-4 rounded-lg border border-stone-200 space-y-1">
              <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-stone-500">Orders up to & including ₹1,999</span>
              <div className="text-base font-serif font-bold text-[#2A211C]">₹99 Shipping Charge</div>
            </div>
          </div>
          <p className="text-stone-600 text-xs">
            Any applicable shipping charge will be clearly displayed during checkout before you complete your purchase.
          </p>
        </section>

        {/* Section 4: Estimated Delivery */}
        <section className="bg-white/60 p-6 md:p-8 rounded-xl border border-[#E5D2BC]/30 space-y-3">
          <div className="flex items-center gap-2.5 border-b border-[#E5D2BC]/20 pb-3">
            <PackageCheck className="w-5 h-5 text-[#2A211C]" />
            <h2 className="font-serif text-lg font-bold text-[#2A211C] tracking-wide">Estimated Delivery</h2>
          </div>
          <p className="text-stone-700">
            Orders are generally delivered within approximately <strong>3–5 business days</strong>.
          </p>
          <p className="text-stone-600">
            Delivery times may vary depending on the destination, serviceability and courier operations. Remote locations or certain PIN codes may require additional delivery time.
          </p>
          <p className="text-stone-600">
            Delivery timelines are estimates and may occasionally be affected by circumstances outside our reasonable control, including courier delays, weather conditions, public holidays, regional restrictions or logistical disruptions.
          </p>
        </section>

        {/* Section 5: Track Your Order */}
        <section className="bg-white/60 p-6 md:p-8 rounded-xl border border-[#E5D2BC]/30 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[#E5D2BC]/20 pb-3">
            <Truck className="w-5 h-5 text-[#B08D57]" />
            <h2 className="font-serif text-lg font-bold text-[#2A211C] tracking-wide">Track Your Order</h2>
          </div>
          <p className="text-stone-700">
            Once tracking information becomes available, you can monitor the delivery status of your shipment.
          </p>
          <p className="text-stone-600">
            You can also use the Sa and Sha Track Order page to check the latest available status of your order.
          </p>
          <div className="pt-2">
            <Link 
              to="/track-order" 
              className="inline-flex items-center gap-2 bg-[#2A211C] hover:bg-[#B08D57] text-white font-sans font-bold text-xs uppercase tracking-widest px-5 py-3 rounded transition-colors"
            >
              <span>Track Your Order</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Section 6: Delivery Address */}
        <section className="bg-white/60 p-6 md:p-8 rounded-xl border border-[#E5D2BC]/30 space-y-3">
          <div className="flex items-center gap-2.5 border-b border-[#E5D2BC]/20 pb-3">
            <MapPin className="w-5 h-5 text-[#C98A82]" />
            <h2 className="font-serif text-lg font-bold text-[#2A211C] tracking-wide">Delivery Address</h2>
          </div>
          <p className="text-stone-700">
            Please ensure that you provide a complete and accurate shipping address, PIN code and contact number when placing your order.
          </p>
          <p className="text-stone-600">
            Once an order has been dispatched, changing the delivery address may not be possible.
          </p>
          <p className="text-stone-600">
            If you notice an error in your shipping information, please{' '}
            <Link to="/contact-support" className="text-[#B08D57] font-semibold underline underline-offset-2 hover:text-[#2A211C] transition-colors">
              contact Sa and Sha
            </Link>{' '}
            as soon as possible before dispatch.
          </p>
        </section>

        {/* Section 7: Delivery Attempts */}
        <section className="bg-white/60 p-6 md:p-8 rounded-xl border border-[#E5D2BC]/30 space-y-3">
          <div className="flex items-center gap-2.5 border-b border-[#E5D2BC]/20 pb-3">
            <AlertCircle className="w-5 h-5 text-amber-700" />
            <h2 className="font-serif text-lg font-bold text-[#2A211C] tracking-wide">Delivery Attempts</h2>
          </div>
          <p className="text-stone-700">
            Our delivery partner may contact you if assistance is required to complete the delivery.
          </p>
          <p className="text-stone-600">
            If delivery cannot be completed because of an incorrect or incomplete address, recipient unavailability, unsuccessful delivery attempts or another delivery-related issue, the shipment may be returned to Sa and Sha.
          </p>
          <p className="text-stone-600">
            If your order is returned to us, please contact our support team for assistance regarding the available next steps.
          </p>
        </section>

        {/* Section 8: Delayed Orders */}
        <section className="bg-white/60 p-6 md:p-8 rounded-xl border border-[#E5D2BC]/30 space-y-3">
          <div className="flex items-center gap-2.5 border-b border-[#E5D2BC]/20 pb-3">
            <Clock className="w-5 h-5 text-amber-800" />
            <h2 className="font-serif text-lg font-bold text-[#2A211C] tracking-wide">Delayed Orders</h2>
          </div>
          <p className="text-stone-700">
            While we work to ensure timely delivery, occasional delays may occur.
          </p>
          <p className="text-stone-600">
            If your order has exceeded the estimated delivery period, please first check the available{' '}
            <Link to="/track-order" className="text-[#B08D57] font-semibold underline underline-offset-2 hover:text-[#2A211C] transition-colors">
              tracking information
            </Link>.
          </p>
          <p className="text-stone-600">
            If you still require assistance, please{' '}
            <Link to="/contact-support" className="text-[#B08D57] font-semibold underline underline-offset-2 hover:text-[#2A211C] transition-colors">
              contact Sa and Sha
            </Link>{' '}
            with your Order ID so our support team can assist you.
          </p>
        </section>

        {/* Section 9: Damaged or Incorrect Shipment */}
        <section className="bg-white/60 p-6 md:p-8 rounded-xl border border-[#E5D2BC]/30 space-y-3">
          <div className="flex items-center gap-2.5 border-b border-[#E5D2BC]/20 pb-3">
            <RotateCcw className="w-5 h-5 text-[#B08D57]" />
            <h2 className="font-serif text-lg font-bold text-[#2A211C] tracking-wide">Damaged or Incorrect Shipment</h2>
          </div>
          <p className="text-stone-700">
            If your order arrives damaged or you receive an incorrect item, please contact Sa and Sha promptly.
          </p>
          <p className="text-stone-600">
            Please retain the product, original packaging, product tags and any relevant photographs, where applicable, as these may be required to help us review the issue.
          </p>
          <p className="text-stone-600">
            Please note that all return and exchange requests must be submitted within 7 days of the date of delivery. After 7 days, the return and exchange window closes. Eligible cases will be handled according to the applicable{' '}
            <Link to="/returns-exchanges" className="text-[#B08D57] font-semibold underline underline-offset-2 hover:text-[#2A211C] transition-colors">
              Sa and Sha Returns & Exchanges Policy
            </Link>.
          </p>
        </section>

        {/* Section 10: Split Shipments */}
        <section className="bg-white/60 p-6 md:p-8 rounded-xl border border-[#E5D2BC]/30 space-y-3">
          <div className="flex items-center gap-2.5 border-b border-[#E5D2BC]/20 pb-3">
            <Box className="w-5 h-5 text-[#C98A82]" />
            <h2 className="font-serif text-lg font-bold text-[#2A211C] tracking-wide">Split Shipments</h2>
          </div>
          <p className="text-stone-700">
            In some circumstances, items from the same order may be dispatched separately.
          </p>
          <p className="text-stone-600">
            If this happens, you may receive more than one shipment or tracking update.
          </p>
          <p className="text-stone-600">
            You will not be charged an additional shipping fee solely because Sa and Sha chooses to split your order into multiple shipments.
          </p>
        </section>

      </div>

      {/* Need Help Section */}
      <div className="bg-[#2A211C] text-[#FBF6EE] p-8 md:p-10 rounded-xl space-y-6 text-center border border-[#E5D2BC]/20 mt-12" id="shipping-help-cta">
        <div className="max-w-xl mx-auto space-y-2">
          <Headphones className="w-8 h-8 text-[#B08D57] mx-auto mb-2" />
          <h2 className="font-serif text-2xl font-bold tracking-tight">Need Help With Your Delivery?</h2>
          <p className="font-sans text-xs md:text-sm text-[#FBF6EE]/70 leading-relaxed">
            If you need assistance with an existing shipment, our support team is here to help. Please keep your Order ID available when contacting us so we can assist you efficiently.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link 
            to="/track-order" 
            className="w-full sm:w-auto bg-[#B08D57] hover:bg-[#B08D57]/90 text-white font-sans font-bold text-xs uppercase tracking-widest px-6 py-3 rounded transition-colors inline-flex items-center justify-center gap-2"
          >
            <span>Track Order</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
          <Link 
            to="/contact-support" 
            className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-[#FBF6EE] border border-[#E5D2BC]/30 font-sans font-bold text-xs uppercase tracking-widest px-6 py-3 rounded transition-colors inline-flex items-center justify-center gap-2"
          >
            <span>Contact Support</span>
          </Link>
          <Link 
            to="/returns-exchanges" 
            className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-[#FBF6EE] border border-[#E5D2BC]/30 font-sans font-bold text-xs uppercase tracking-widest px-6 py-3 rounded transition-colors inline-flex items-center justify-center gap-2"
          >
            <span>Returns & Exchanges</span>
          </Link>
        </div>
      </div>

    </div>
  );
};
