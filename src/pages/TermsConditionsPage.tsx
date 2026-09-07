import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Scale, 
  ChevronRight, 
  UserCheck, 
  ShoppingBag, 
  CreditCard, 
  Truck, 
  RotateCcw, 
  ShieldCheck, 
  AlertTriangle, 
  Lock, 
  Gavel, 
  Globe, 
  HelpCircle, 
  Building2, 
  Mail, 
  CheckCircle2,
  Ban
} from 'lucide-react';
import { useSEO } from '../hooks/useSEO';

export const TermsConditionsPage: React.FC = () => {
  useSEO({
    title: 'Terms & Conditions | Sa and Sha',
    description: 'Read the official Terms & Conditions of Sa and Sha. Information on customer accounts, order processing, Razorpay payments, GST billing, shipping, 7-day returns, intellectual property, and governing law in India.',
    canonical: 'https://saandsha.com/terms-and-conditions',
    noindex: false,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'Home',
          'item': 'https://saandsha.com'
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': 'Terms & Conditions',
          'item': 'https://saandsha.com/terms-and-conditions'
        }
      ]
    }
  });

  const [activeSection, setActiveSection] = useState<string>('intro');

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-16 space-y-10 text-[#1F1B16]" id="terms-conditions-page">
      
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="text-xs font-sans text-stone-500 flex items-center gap-2">
        <Link to="/" className="hover:text-[#B85C38] transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3 text-stone-400" />
        <span className="text-[#1F1B16] font-medium">Terms & Conditions</span>
      </nav>

      {/* Page Header */}
      <div className="text-center space-y-3 border-b border-[#C9B79C]/30 pb-8">
        <span className="text-xs font-sans font-bold tracking-[0.25em] text-[#B85C38] uppercase flex items-center justify-center gap-1.5">
          <Scale className="w-4 h-4 text-[#B85C38]" /> Legal Framework & Agreement
        </span>
        <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-[#1F1B16]">
          Terms & Conditions
        </h1>
        <p className="font-sans text-xs md:text-sm text-stone-600 max-w-2xl mx-auto leading-relaxed">
          Welcome to Sa and Sha. Please read these Terms & Conditions carefully before browsing our website, registering an account, or placing an order for pure European flax apparel.
        </p>
        <div className="pt-2 text-[11px] font-sans text-stone-500 flex items-center justify-center gap-4">
          <span><strong>Effective Date:</strong> August 5, 2026</span>
          <span>•</span>
          <span><strong>Brand:</strong> Sa and Sha (Rajasthan Exports Overseas Pvt. Ltd.)</span>
        </div>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4" id="terms-highlights-grid">
        <div className="bg-white p-4 rounded-lg border border-[#C9B79C]/30 shadow-sm space-y-1.5">
          <div className="flex items-center gap-2 text-[#B85C38]">
            <ShoppingBag className="w-4 h-4" />
            <span className="text-xs font-sans font-bold uppercase tracking-wider">100% Belgian Flax</span>
          </div>
          <p className="text-[11px] text-stone-600 leading-normal">
            Natural slubs & texture variations are inherent signatures of organic flax weaving, not defects.
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#C9B79C]/30 shadow-sm space-y-1.5">
          <div className="flex items-center gap-2 text-[#5C6B4A]">
            <CreditCard className="w-4 h-4" />
            <span className="text-xs font-sans font-bold uppercase tracking-wider">GST Tax Invoicing</span>
          </div>
          <p className="text-[11px] text-stone-600 leading-normal">
            All prices are in INR ₹ inclusive of taxes. Input Tax Credit (ITC) available for valid business GSTINs.
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#C9B79C]/30 shadow-sm space-y-1.5">
          <div className="flex items-center gap-2 text-[#1F1B16]">
            <RotateCcw className="w-4 h-4" />
            <span className="text-xs font-sans font-bold uppercase tracking-wider">7-Day Doorstep Returns</span>
          </div>
          <p className="text-[11px] text-stone-600 leading-normal">
            Complimentary doorstep reverse pickup for unused, unwashed garments with tags intact across India.
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#C9B79C]/30 shadow-sm space-y-1.5">
          <div className="flex items-center gap-2 text-[#B85C38]">
            <Gavel className="w-4 h-4" />
            <span className="text-xs font-sans font-bold uppercase tracking-wider">Jaipur Jurisdiction</span>
          </div>
          <p className="text-[11px] text-stone-600 leading-normal">
            Governed by the laws of India. Courts in Jaipur, Rajasthan hold exclusive legal jurisdiction.
          </p>
        </div>
      </div>

      {/* Main Content Layout with Sticky Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Table of Contents Sidebar */}
        <div className="lg:col-span-1 hidden lg:block">
          <div className="sticky top-36 bg-white/80 p-4 rounded-lg border border-[#C9B79C]/30 space-y-3">
            <div className="text-xs font-sans font-bold uppercase tracking-wider text-[#1F1B16] border-b border-[#C9B79C]/20 pb-2 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#B85C38]" /> Key Index
            </div>
            <nav className="space-y-1 text-xs font-sans">
              {[
                { id: 'sec-terms-acceptance', label: '1. Agreement & Acceptance' },
                { id: 'sec-terms-eligibility', label: '2. Customer Eligibility' },
                { id: 'sec-terms-accounts', label: '3. Accounts & Auth' },
                { id: 'sec-terms-customer-auth', label: 'Customer Authentication' },
                { id: 'sec-terms-[#products]', label: '4. Products & Sizing' },
                { id: 'sec-terms-pricing', label: '5. Pricing & GST' },
                { id: 'sec-terms-payments', label: '6. Payments & COD' },
                { id: 'sec-terms-shipping', label: '7. Shipping & Delivery' },
                { id: 'sec-terms-returns', label: '8. Returns & Refunds' },
                { id: 'sec-terms-ip', label: '9. Intellectual Property' },
                { id: 'sec-terms-[#prohibited]', label: '10. Prohibited Uses' },
                { id: 'sec-terms-reviews', label: '11. Customer Reviews' },
                { id: 'sec-terms-liability', label: '12. Liability & Warranties' },
                { id: 'sec-terms-[#jurisdiction]', label: '13. Law & Disputes' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id.replace('#', ''))}
                  className="w-full text-left px-2 py-1.5 rounded transition-colors text-stone-600 hover:text-[#B85C38] hover:bg-[#F5F1E8]"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Detailed Terms Sections */}
        <div className="lg:col-span-3 space-y-10 text-xs md:text-sm font-sans leading-relaxed text-stone-800">
          
          {/* SECTION 1 */}
          <section id="sec-terms-acceptance" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <Scale className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                1. Agreement & Acceptance of Terms
              </h2>
            </div>
            <p>
              These Terms & Conditions constitute a legally binding agreement between you ("Customer", "User", "You") and <strong className="text-[#1F1B16]">Rajasthan Exports Overseas Pvt. Ltd.</strong>, operating the ecommerce store and trademark brand <strong className="text-[#1F1B16]">Sa and Sha</strong> ("Company", "We", "Us", "Our"), accessible via <strong className="text-[#1F1B16]">https://saandsha.com</strong>.
            </p>
            <p>
              By accessing, browsing, registering an account, or placing an order on Sa and Sha, you unequivocally agree to be bound by these Terms & Conditions, along with our <Link to="/privacy-policy" className="text-[#B85C38] font-semibold hover:underline">Privacy Policy</Link>, <Link to="/returns-exchanges" className="text-[#B85C38] font-semibold hover:underline">Returns & Exchanges Policy</Link>, and <Link to="/shipping-delivery" className="text-[#B85C38] font-semibold hover:underline">Shipping Policy</Link>.
            </p>
            <p className="text-stone-600 italic">
              If you do not agree with any part of these Terms, you must immediately discontinue using our website and services.
            </p>
          </section>

          {/* SECTION 2 */}
          <section id="sec-terms-eligibility" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <UserCheck className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                2. Customer Eligibility
              </h2>
            </div>
            <p>
              Use of Sa and Sha is available only to persons who can form legally binding contracts under the <strong className="text-[#1F1B16]">Indian Contract Act, 1872</strong>. Persons who are "incompetent to contract" within the meaning of the Indian Contract Act, 1872, including un-discharged insolvents, are not eligible to use the website.
            </p>
            <p>
              You affirm that you are at least 18 years of age. If you are under 18 years of age, you may browse the website or place orders only under the direct supervision and involvement of a parent or legal guardian.
            </p>
          </section>

          {/* SECTION 3 */}
          <section id="sec-terms-accounts" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <Lock className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                3. Customer Accounts, Authentication & Security
              </h2>
            </div>
            <p>
              To access personalized features, order history, store credit rewards, and saved addresses, you may register or log in using:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-stone-700">
              <li><strong>Mobile OTP Authentication:</strong> Verification via a one-time passcode sent to your mobile phone number.</li>
              <li><strong>Google Sign-In:</strong> One-tap authentication using your verified Google Account identity.</li>
            </ul>
            <p>
              <strong className="text-[#1F1B16]">Account Responsibility:</strong> You are responsible for maintaining the confidentiality of your mobile device, login access, and session activity. You agree to accept responsibility for all orders and activities that occur under your account.
            </p>
            <p>
              <strong className="text-[#1F1B16]">Session Control:</strong> You can review active device logins at any time in your Customer Portal (<code className="bg-stone-100 px-1 rounded">/account</code>) and revoke stale or unrecognized device sessions in 1 click.
            </p>
            <p>
              <strong className="text-[#1F1B16]">Account Deletion:</strong> You may request deletion by contacting support at <a href="mailto:support@saandsha.com" className="text-[#B85C38] hover:underline font-semibold">support@saandsha.com</a> or via our <Link to="/contact-support" className="text-[#B85C38] hover:underline font-semibold">Support Portal</Link>.
            </p>
            <p>
              Sa and Sha reserves the right to refuse service, suspend accounts, terminate access, or cancel orders at our sole discretion if fraudulent or abusive activity is detected.
            </p>
          </section>

          {/* DEDICATED SECTION FOR CUSTOMER AUTHENTICATION */}
          <section id="sec-terms-customer-auth" className="space-y-4 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <UserCheck className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                Customer Authentication
              </h2>
            </div>
            <p>
              Customers may securely access their Sa and Sha account using either of the following authentication methods:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-stone-700">
              <li><strong>Mobile OTP (One-Time Password):</strong> Authentication via SMS/WhatsApp code sent to your registered mobile number.</li>
              <li><strong>Google Sign-In:</strong> Secure, one-tap identity verification using your verified Google Account credentials.</li>
            </ul>
            <p>
              Account authentication on Sa and Sha is used strictly for the following customer portal features:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-stone-700">
              <div className="p-2.5 bg-[#F5F1E8]/40 rounded border border-[#C9B79C]/20 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#5C6B4A] shrink-0" />
                <span>Viewing past and current order history</span>
              </div>
              <div className="p-2.5 bg-[#F5F1E8]/40 rounded border border-[#C9B79C]/20 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#5C6B4A] shrink-0" />
                <span>Tracking active shipment dispatches</span>
              </div>
              <div className="p-2.5 bg-[#F5F1E8]/40 rounded border border-[#C9B79C]/20 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#5C6B4A] shrink-0" />
                <span>Downloading statutory GST tax invoices</span>
              </div>
              <div className="p-2.5 bg-[#F5F1E8]/40 rounded border border-[#C9B79C]/20 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#5C6B4A] shrink-0" />
                <span>Managing saved shipping and delivery addresses</span>
              </div>
              <div className="p-2.5 bg-[#F5F1E8]/40 rounded border border-[#C9B79C]/20 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#5C6B4A] shrink-0" />
                <span>Managing doorstep return and size exchange requests</span>
              </div>
              <div className="p-2.5 bg-[#F5F1E8]/40 rounded border border-[#C9B79C]/20 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#5C6B4A] shrink-0" />
                <span>Accessing Kora Rewards loyalty store credits</span>
              </div>
              <div className="p-2.5 bg-[#F5F1E8]/40 rounded border border-[#C9B79C]/20 flex items-center gap-2 sm:col-span-2">
                <CheckCircle2 className="w-4 h-4 text-[#5C6B4A] shrink-0" />
                <span>Ensuring account security, session management, and device auditing</span>
              </div>
            </div>
            <p className="p-3 bg-stone-50 rounded border border-stone-200 text-stone-700">
              <strong className="text-[#1F1B16]">Privacy & Scope Guarantee:</strong> Authenticating via Google Sign-In does <strong>NOT</strong> grant Sa and Sha access to your personal Google services (such as Gmail, Google Drive, Google Photos, Google Calendar, or Google Contacts). Google Sign-In is used solely for secure account sign-in and profile verification.
            </p>
          </section>

          {/* SECTION 4 */}
          <section id="sec-terms-products" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <ShoppingBag className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                4. Products, Sizing & Fabric Characteristics
              </h2>
            </div>
            <p>
              Sa and Sha specializes in luxury menswear crafted from 100% organic European flax, including linen shirts, linen trousers, and premium chinos.
            </p>
            <div className="p-3 bg-[#F5F1E8]/50 rounded border border-[#C9B79C]/20 space-y-2">
              <strong className="text-[#1F1B16] font-bold block text-xs uppercase tracking-wider">
                🌿 Natural Flax Characteristics (Not Defects)
              </strong>
              <p className="text-stone-700 text-xs">
                Pure linen is an organic, living fabric. Slubs, subtle weave variations, and slight texture variations are proof of authentic European flax weaving and are inherent characteristics of luxury linen, not manufacturing defects.
              </p>
            </div>
            <p>
              <strong className="text-[#1F1B16]">Color & Sizing Accuracy:</strong> We make every effort to display garment colors and fit dimensions as accurately as possible. However, actual colors may vary slightly due to device screen settings and studio lighting. Please consult our Garment Size Guide prior to ordering.
            </p>
          </section>

          {/* SECTION 5 */}
          <section id="sec-terms-pricing" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <CreditCard className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                5. Pricing, Taxes & GST Billing
              </h2>
            </div>
            <p>
              All prices listed on Sa and Sha are in <strong className="text-[#1F1B16]">Indian Rupees (INR, ₹)</strong> and are inclusive of applicable Goods and Services Tax (GST) under Indian law.
            </p>
            <div className="space-y-2">
              <div className="p-3 bg-stone-50 rounded border border-stone-200 space-y-1">
                <strong className="text-[#1F1B16] font-bold block">B2B Tax Invoicing (GSTIN):</strong>
                <span className="text-stone-600 text-xs">Business customers can input a valid 15-digit GSTIN and legal entity name during checkout. Upon order completion, an official B2B GST Tax Invoice will be generated, allowing you to claim Input Tax Credit (ITC) under the Central Goods and Services Tax Act, 2017.</span>
              </div>
              <div className="p-3 bg-stone-50 rounded border border-stone-200 space-y-1">
                <strong className="text-[#1F1B16] font-bold block">Price Corrections:</strong>
                <span className="text-stone-600 text-xs">While we strive for 100% pricing accuracy, typographical errors may occur. In the event an item is listed at an incorrect price due to a system error, Sa and Sha reserves the right to cancel orders placed for that item prior to dispatch and issue a full refund.</span>
              </div>
            </div>
          </section>

          {/* SECTION 6 */}
          <section id="sec-terms-payments" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <CreditCard className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                6. Payments & Cash on Delivery (COD)
              </h2>
            </div>
            <p>
              We offer two convenient payment channels:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-stone-700">
              <li>
                <strong>Prepaid Payments via Razorpay:</strong> We accept all major Credit Cards (Visa, MasterCard, Amex), Debit Cards, Netbanking across 50+ Indian banks, Unified Payments Interface (UPI - Google Pay, PhonePe, Paytm, BHIM), and digital wallets. Payments are processed over 256-bit encrypted channels via Razorpay.
              </li>
              <li>
                <strong>Cash on Delivery (COD):</strong> COD is available for eligible delivery PIN codes across India. To prevent fraud, Sa and Sha reserves the right to verify COD orders via automated OTP verification, WhatsApp confirmation, or telephonic confirmation prior to dispatch.
              </li>
            </ul>
            <p>
              <strong className="text-[#1F1B16]">Order Cancellation:</strong> You may cancel an order directly from your Customer Dashboard (<code className="bg-stone-100 px-1 rounded">/account/orders</code>) prior to order dispatch. Once an order is dispatched and assigned a carrier tracking number, it cannot be cancelled in transit but can be returned/exchanged upon arrival.
            </p>
          </section>

          {/* SECTION 7 */}
          <section id="sec-terms-shipping" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <Truck className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                7. Shipping, Delivery & Tracking
              </h2>
            </div>
            <p>
              Detailed shipping terms are published under our <Link to="/shipping-delivery" className="text-[#B85C38] font-semibold hover:underline">Shipping & Delivery Policy</Link>. Key highlights include:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-stone-700">
              <li><strong>Free Delivery:</strong> Free standard shipping on all orders above <strong>₹1,999</strong> across India.</li>
              <li><strong>Standard Shipping Fee:</strong> A flat ₹99 shipping charge applies to orders up to ₹1,999.</li>
              <li><strong>Order Processing:</strong> Orders are inspected and dispatched from our Jaipur hub within 1 to 2 business days.</li>
              <li><strong>Delivery Timeline:</strong> Estimated delivery takes 3 to 7 business days depending on location across India.</li>
              <li><strong>Order Tracking:</strong> Real-time delivery status can be tracked at <Link to="/track-order" className="text-[#B85C38] hover:underline">https://saandsha.com/track-order</Link> using your order ID or phone number.</li>
            </ul>
          </section>

          {/* SECTION 8 */}
          <section id="sec-terms-returns" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <RotateCcw className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                8. Returns, Exchanges & Refunds
              </h2>
            </div>
            <p>
              We provide a hassle-free <strong className="text-[#1F1B16]">7-Day Doorstep Return and Exchange Policy</strong>. To return or exchange a product, the customer must submit a request within 7 days of the date of delivery. After 7 days from delivery, the return and exchange window closes. Full guidelines are governed by our <Link to="/returns-exchanges" className="text-[#B85C38] font-semibold hover:underline">Returns & Exchanges Policy</Link>:
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#5C6B4A] shrink-0 mt-0.5" />
                <span><strong>Eligibility:</strong> Items must be unused, unwashed, unaltered, and returned in original condition with all brand tags and linen care packaging intact.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#5C6B4A] shrink-0 mt-0.5" />
                <span><strong>Complimentary Doorstep Reverse Pickup:</strong> We arrange free doorstep pickup for eligible returns and size exchanges across India.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#5C6B4A] shrink-0 mt-0.5" />
                <span><strong>Refund Modes:</strong> Prepaid orders are refunded directly to the original bank/card account within 5–7 business days after quality inspection at Jaipur hub. COD orders are refunded via instant Kora Store Credit or NEFT/UPI bank transfer.</span>
              </div>
            </div>
          </section>

          {/* SECTION 9 */}
          <section id="sec-terms-ip" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <ShieldCheck className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                9. Intellectual Property Rights
              </h2>
            </div>
            <p>
              The Sa and Sha website, trademark logo, brand design, garment patterns, photography, studio imagery, product descriptions, copy, graphics, page layouts, database structures, software code, and underlying software are the exclusive intellectual property of <strong className="text-[#1F1B16]">Rajasthan Exports Overseas Pvt. Ltd.</strong> and are protected under Indian Copyright and Trademark laws.
            </p>
            <p>
              You are granted a limited, revocable, non-exclusive license to access and make personal, non-commercial use of the website. You are strictly prohibited from reproducing, duplicating, copying, selling, reselling, or exploiting any portion of the website without express written consent from Rajasthan Exports Overseas Pvt. Ltd.
            </p>
          </section>

          {/* SECTION 10 */}
          <section id="sec-terms-prohibited" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <Ban className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                10. Prohibited Activities
              </h2>
            </div>
            <p>
              When using Sa and Sha, you agree NOT to engage in any of the following prohibited activities:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-stone-700">
              <li>Using automated bots, scrapers, or crawlers to extract product catalog data or pricing.</li>
              <li>Attempting to bypass security mechanisms, perform unauthorized API probing, or inject malicious code.</li>
              <li>Initiating false or fraudulent COD orders, credential stuffing, or abusing mobile OTP verification.</li>
              <li>Submitting defamatory, obscene, or fraudulent customer reviews or support communications.</li>
              <li>Impersonating any person or legal entity, or misrepresenting affiliation with Rajasthan Exports Overseas Pvt. Ltd.</li>
            </ul>
          </section>

          {/* SECTION 11 */}
          <section id="sec-terms-reviews" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <FileText className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                11. Customer Reviews & Submissions
              </h2>
            </div>
            <p>
              By submitting product reviews, feedback, or customer photographs to Sa and Sha, you grant Rajasthan Exports Overseas Pvt. Ltd. a perpetual, worldwide, non-exclusive, royalty-free license to publish, display, and reproduce such reviews on our website and official communications.
            </p>
            <p>
              You guarantee that any review or photograph submitted represents your authentic personal experience and does not infringe upon any third-party intellectual property or privacy rights.
            </p>
          </section>

          {/* SECTION 12 */}
          <section id="sec-terms-liability" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <AlertTriangle className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                12. Limitation of Liability, Warranties & Force Majeure
              </h2>
            </div>
            <p>
              <strong className="text-[#1F1B16]">Warranty Disclaimer:</strong> The website and products are provided on an "as is" and "as available" basis without warranties of any kind, whether express or implied, except as explicitly provided in our product descriptions.
            </p>
            <p>
              <strong className="text-[#1F1B16]">Limitation of Liability:</strong> In no event shall Rajasthan Exports Overseas Pvt. Ltd., its directors, officers, employees, or agents be liable for any indirect, incidental, special, or consequential damages arising out of your use of the website. Our total aggregate liability to you for any claim arising out of or related to an order shall not exceed the total amount actually paid by you for that specific order.
            </p>
            <p>
              <strong className="text-[#1F1B16]">Force Majeure:</strong> Sa and Sha shall not be held liable or responsible for any failure or delay in performance caused by events beyond our reasonable control, including acts of God, natural disasters (such as floods, earthquakes, or severe weather), strikes, labor unrest, government restrictions, courier disruptions, transport breakdowns, telecommunication failures, or civil unrest.
            </p>
          </section>

          {/* SECTION 13 */}
          <section id="sec-terms-jurisdiction" className="space-y-4 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <Gavel className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                13. Governing Law, Jurisdiction & Contact Information
              </h2>
            </div>
            <p>
              These Terms & Conditions shall be governed by and construed in accordance with the laws of <strong className="text-[#1F1B16]">India</strong>.
            </p>
            <p>
              Any legal proceedings, disputes, or claims arising out of or in connection with these Terms, the website, or purchases made on Sa and Sha shall be subject to the <strong className="text-[#1F1B16]">exclusive jurisdiction of the competent courts in Jaipur, Rajasthan, India</strong>.
            </p>

            <div className="p-4 bg-[#E4D8C3]/20 rounded-lg border border-[#C9B79C]/30 space-y-3 pt-4">
              <h3 className="font-serif font-bold text-sm text-[#1F1B16] uppercase tracking-wider">
                Corporate Office & Legal Inquiries
              </h3>
              <div className="space-y-1.5 text-xs text-[#1F1B16] font-medium">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#B85C38]" />
                  <span><strong>Company:</strong> Rajasthan Exports Overseas Pvt. Ltd. (Brand: Sa and Sha)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#B85C38]" />
                  <span><strong>Registered Office:</strong> H1-56, First Floor, RIICO Apparel Park, Mahal Road, Jagatpura, Jaipur, Rajasthan - 302020, India</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#B85C38]" />
                  <span><strong>Customer Support Email:</strong> <a href="mailto:support@saandsha.com" className="text-[#B85C38] hover:underline">support@saandsha.com</a></span>
                </div>
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-[#B85C38]" />
                  <span><strong>Support Helpdesk:</strong> <Link to="/contact-support" className="text-[#B85C38] hover:underline">https://saandsha.com/contact-support</Link></span>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>

    </div>
  );
};
