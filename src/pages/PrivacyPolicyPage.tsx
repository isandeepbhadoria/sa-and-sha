import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Lock, 
  FileText, 
  ChevronRight, 
  Database, 
  UserCheck, 
  Eye, 
  CreditCard, 
  Truck, 
  Bell, 
  HelpCircle, 
  AlertTriangle, 
  Key, 
  Smartphone, 
  Server,
  Globe,
  Mail,
  MapPin,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';
import { useSEO } from '../hooks/useSEO';

export const PrivacyPolicyPage: React.FC = () => {
  useSEO({
    title: 'Privacy Policy | Sa and Sha',
    description: 'Read the official Privacy Policy of Sa and Sha. Learn how we protect your personal data, customer account info, orders, payment processing, and security events in full compliance with Indian privacy laws.',
    canonical: 'https://saandsha.com/privacy-policy',
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
          'name': 'Privacy Policy',
          'item': 'https://saandsha.com/privacy-policy'
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
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-16 space-y-10 text-[#1F1B16]" id="privacy-policy-page">
      
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="text-xs font-sans text-stone-500 flex items-center gap-2">
        <Link to="/" className="hover:text-[#B85C38] transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3 text-stone-400" />
        <span className="text-[#1F1B16] font-medium">Privacy Policy</span>
      </nav>

      {/* Page Header */}
      <div className="text-center space-y-3 border-b border-[#C9B79C]/30 pb-8">
        <span className="text-xs font-sans font-bold tracking-[0.25em] text-[#B85C38] uppercase flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#B85C38]" /> Legal Compliance & Transparency
        </span>
        <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-[#1F1B16]">
          Privacy Policy
        </h1>
        <p className="font-sans text-xs md:text-sm text-stone-600 max-w-2xl mx-auto leading-relaxed">
          Sa and Sha is committed to protecting your personal information, safeguarding your account security, and maintaining complete transparency in how your data is collected, stored, and processed.
        </p>
        <div className="pt-2 text-[11px] font-sans text-stone-500 flex items-center justify-center gap-4">
          <span><strong>Effective Date:</strong> August 5, 2026</span>
          <span>•</span>
          <span><strong>Entity:</strong> Rajasthan Exports Overseas Pvt. Ltd.</span>
        </div>
      </div>

      {/* Quick Summary Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4" id="privacy-highlights-grid">
        <div className="bg-white p-4 rounded-lg border border-[#C9B79C]/30 shadow-sm space-y-1.5">
          <div className="flex items-center gap-2 text-[#B85C38]">
            <Lock className="w-4 h-4" />
            <span className="text-xs font-sans font-bold uppercase tracking-wider">Zero Raw Secrets</span>
          </div>
          <p className="text-[11px] text-stone-600 leading-normal">
            Session tokens and passwords are never stored in raw text. All auth tokens are SHA-256 hashed.
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#C9B79C]/30 shadow-sm space-y-1.5">
          <div className="flex items-center gap-2 text-[#5C6B4A]">
            <CreditCard className="w-4 h-4" />
            <span className="text-xs font-sans font-bold uppercase tracking-wider">PCI-DSS Payments</span>
          </div>
          <p className="text-[11px] text-stone-600 leading-normal">
            All card numbers, UPI PINs & Netbanking logins are handled securely by Razorpay. Zero storage on our servers.
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#C9B79C]/30 shadow-sm space-y-1.5">
          <div className="flex items-center gap-2 text-[#1F1B16]">
            <Eye className="w-4 h-4" />
            <span className="text-xs font-sans font-bold uppercase tracking-wider">IP Masking</span>
          </div>
          <p className="text-[11px] text-stone-600 leading-normal">
            IP addresses in security audit logs are strictly masked (IPv4: 203.0.113.xxx) to protect end-user privacy.
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#C9B79C]/30 shadow-sm space-y-1.5">
          <div className="flex items-center gap-2 text-[#B85C38]">
            <UserCheck className="w-4 h-4" />
            <span className="text-xs font-sans font-bold uppercase tracking-wider">Account Deletion</span>
          </div>
          <p className="text-[11px] text-stone-600 leading-normal">
            You may request deletion by contacting support at support@saandsha.com.
          </p>
        </div>
      </div>

      {/* Main Content Layout with Sticky Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Table of Contents Sidebar */}
        <div className="lg:col-span-1 hidden lg:block">
          <div className="sticky top-36 bg-white/80 p-4 rounded-lg border border-[#C9B79C]/30 space-y-3">
            <div className="text-xs font-sans font-bold uppercase tracking-wider text-[#1F1B16] border-b border-[#C9B79C]/20 pb-2 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#B85C38]" /> Table of Contents
            </div>
            <nav className="space-y-1 text-xs font-sans">
              {[
                { id: 'sec-intro', label: '1. Scope & Framework' },
                { id: 'sec-collect', label: '2. Information We Collect' },
                { id: 'sec-google-signin', label: 'Google Sign-In' },
                { id: 'sec-use', label: '3. How We Use Data' },
                { id: 'sec-sharing', label: '4. Third-Party Sharing' },
                { id: 'sec-security', label: '5. Security & Sessions' },
                { id: 'sec-retention', label: '6. Storage & Retention' },
                { id: 'sec-rights', label: '7. Customer Rights' },
                { id: 'sec-cookies', label: '8. Cookies & Storage' },
                { id: 'sec-children', label: '9. Children’s Privacy' },
                { id: 'sec-[#contact]', label: '10. Contact & Grievance' },
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

        {/* Detailed Policy Text Column */}
        <div className="lg:col-span-3 space-y-10 text-xs md:text-sm font-sans leading-relaxed text-stone-800">
          
          {/* SECTION 1 */}
          <section id="sec-intro" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <ShieldCheck className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                1. Scope & Legal Framework
              </h2>
            </div>
            <p>
              This Privacy Policy applies to the website <strong className="text-[#1F1B16]">https://saandsha.com</strong>, the Customer Portal, mobile web interfaces, checkout systems, and related digital services operated under the trademark brand <strong className="text-[#1F1B16]">Sa and Sha</strong>, owned and managed by <strong className="text-[#1F1B16]">Rajasthan Exports Overseas Pvt. Ltd.</strong>, headquartered in Jaipur, Rajasthan, India.
            </p>
            <p>
              We adhere strictly to statutory data protection requirements under Indian law, including:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-stone-700">
              <li>The Information Technology Act, 2000 and amendments.</li>
              <li>The Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011.</li>
              <li>The Consumer Protection (E-Commerce) Rules, 2020.</li>
              <li>The Digital Personal Data Protection (DPDP) Act, 2023 of India.</li>
            </ul>
            <p className="text-stone-600 italic">
              By accessing Sa and Sha, registering a customer account, making a purchase, or using our services, you acknowledge that you have read and understood this Privacy Policy.
            </p>
          </section>

          {/* SECTION 2 */}
          <section id="sec-collect" className="space-y-4 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <Database className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                2. Information We Collect
              </h2>
            </div>
            <p>
              To provide luxury linen apparel, process orders, manage deliveries, and secure your account, we collect specific categories of personal, transaction, and technical data:
            </p>

            <div className="space-y-3 pt-2">
              <div className="p-3 bg-[#F5F1E8]/50 rounded border border-[#C9B79C]/20 space-y-1">
                <h3 className="font-bold text-[#1F1B16] flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <UserCheck className="w-4 h-4 text-[#B85C38]" /> A. Account & Profile Data
                </h3>
                <p className="text-stone-700">
                  Full name, mobile phone number, email address, date of birth (optional), gender (optional), linked Google profile identifiers (Google ID, avatar URL, verified email), and customer account registration timestamps.
                </p>
              </div>

              <div className="p-3 bg-[#F5F1E8]/50 rounded border border-[#C9B79C]/20 space-y-1">
                <h3 className="font-bold text-[#1F1B16] flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Key className="w-4 h-4 text-[#B85C38]" /> B. Authentication & Google Sign-In
                </h3>
                <p className="text-stone-700">
                  Google Sign-In uses Firebase Authentication strictly for identity verification (verifying your email address, profile name, and avatar URL). Using Google Sign-In does not grant Sa and Sha access to your broader Google account data (such as Google Drive, Gmail, or Contacts), nor does Google share all customer data with us. Mobile OTP validation logs, rate-limiting counters, and SHA-256 hashed token references are retained for security audit. <strong className="text-[#1F1B16]">We never store raw OTPs or unhashed auth tokens.</strong>
                </p>
              </div>

              <div className="p-3 bg-[#F5F1E8]/50 rounded border border-[#C9B79C]/20 space-y-1">
                <h3 className="font-bold text-[#1F1B16] flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Truck className="w-4 h-4 text-[#B85C38]" /> C. Order, Shipping & GST Information
                </h3>
                <p className="text-stone-700">
                  Purchased items (shirts, trousers, chinos), sizing selections, subtotal and tax amounts, store credit/rewards redemption history, shipping address (recipient name, house/flat number, street, city, state, pin code, landmark), delivery telephone number, tracking tokens, and optional GSTIN (Goods and Services Tax Identification Number) and legal company name for B2B tax invoicing.
                </p>
              </div>

              <div className="p-3 bg-[#F5F1E8]/50 rounded border border-[#C9B79C]/20 space-y-1">
                <h3 className="font-bold text-[#1F1B16] flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <CreditCard className="w-4 h-4 text-[#B85C38]" /> D. Billing & Payment Records
                </h3>
                <p className="text-stone-700">
                  Billing address, Razorpay transaction IDs, payment method category (e.g. UPI, Credit Card, Netbanking, COD), payment status, and refund history. <strong className="text-[#1F1B16]">Sa and Sha NEVER stores your credit card numbers, CVVs, UPI PINs, or netbanking passwords.</strong> All sensitive payment credentials are handled exclusively by PCI-DSS compliant payment gateways.
                </p>
              </div>

              <div className="p-3 bg-[#F5F1E8]/50 rounded border border-[#C9B79C]/20 space-y-1">
                <h3 className="font-bold text-[#1F1B16] flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Server className="w-4 h-4 text-[#B85C38]" /> E. Device, Environment & Security Logs
                </h3>
                <p className="text-stone-700">
                  User Agent details, browser type, operating system, device class (mobile/desktop/tablet), masked IP addresses (e.g., <code className="bg-stone-200 px-1 py-0.5 rounded text-[11px]">203.0.113.xxx</code>), hashed IP signatures for rate limiting, security event audit logs (login success/fail, session creation, session revocation, token rotation), and risk assessment flags (such as <code className="bg-stone-200 px-1 py-0.5 rounded text-[11px]">NEW_DEVICE</code> or <code className="bg-stone-200 px-1 py-0.5 rounded text-[11px]">IP_CHANGE</code>).
                </p>
              </div>

              <div className="p-3 bg-[#F5F1E8]/50 rounded border border-[#C9B79C]/20 space-y-1">
                <h3 className="font-bold text-[#1F1B16] flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Bell className="w-4 h-4 text-[#B85C38]" /> F. Communication Preferences
                </h3>
                <p className="text-stone-700">
                  Email update opt-in state, WhatsApp shipping tracking preferences, SMS notification consent, support ticket correspondence, and customer review submissions.
                </p>
              </div>
            </div>
          </section>

          {/* DEDICATED SECTION FOR GOOGLE SIGN-IN */}
          <section id="sec-google-signin" className="space-y-4 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <Lock className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                Google Sign-In
              </h2>
            </div>
            <p>
              Google Sign-In is an optional authentication method offered to Sa and Sha customers for fast, one-tap account access. Customers may alternatively choose to sign in using Mobile OTP (One-Time Password) verification.
            </p>
            <p>
              When you choose to sign in with Google, Sa and Sha receives only the basic profile information that you explicitly authorize Google to share with us during authentication.
            </p>
            <div className="p-4 bg-[#F5F1E8]/50 rounded-lg border border-[#C9B79C]/25 space-y-3">
              <h3 className="font-bold text-[#1F1B16] text-xs uppercase tracking-wider">
                Information We Receive via Google Sign-In:
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-stone-700">
                <li><strong>Full Name:</strong> Used to personalize your customer profile and delivery orders.</li>
                <li><strong>Email Address:</strong> Used for account identity, order status notifications, and GST invoices.</li>
                <li><strong>Profile Picture:</strong> Used strictly for display in your personal customer portal header (if available).</li>
              </ul>
            </div>
            <div className="p-4 bg-stone-50 rounded-lg border border-stone-200 space-y-2">
              <h3 className="font-bold text-[#1F1B16] text-xs uppercase tracking-wider">
                Services & Data We Do NOT Access:
              </h3>
              <p className="text-stone-700">
                Sa and Sha does <strong>NOT</strong> request access to, view, read, modify, or store any data from your private Google account services. Specifically, we do NOT access:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-stone-700 font-medium pt-1">
                <span className="bg-white px-2.5 py-1 rounded border border-stone-200 flex items-center gap-1 text-xs">❌ Gmail</span>
                <span className="bg-white px-2.5 py-1 rounded border border-stone-200 flex items-center gap-1 text-xs">❌ Google Drive</span>
                <span className="bg-white px-2.5 py-1 rounded border border-stone-200 flex items-center gap-1 text-xs">❌ Google Photos</span>
                <span className="bg-white px-2.5 py-1 rounded border border-stone-200 flex items-center gap-1 text-xs">❌ Google Calendar</span>
                <span className="bg-white px-2.5 py-1 rounded border border-stone-200 flex items-center gap-1 text-xs">❌ Google Contacts</span>
                <span className="bg-white px-2.5 py-1 rounded border border-stone-200 flex items-center gap-1 text-xs">❌ YouTube</span>
                <span className="bg-white px-2.5 py-1 rounded border border-stone-200 flex items-center gap-1 text-xs">❌ Google Files</span>
                <span className="bg-white px-2.5 py-1 rounded border border-stone-200 flex items-center gap-1 text-xs">❌ Any Other Google Data</span>
              </div>
            </div>
            <p>
              Google Sign-In is used exclusively for customer authentication and account access. Google authentication on Sa and Sha is securely implemented using <strong>Firebase Authentication</strong> (a Google Cloud platform service) following industry-standard OAuth 2.0 security protocols.
            </p>
          </section>

          {/* SECTION 3 */}
          <section id="sec-use" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <CheckCircle2 className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                3. How We Use Your Information
              </h2>
            </div>
            <p>
              We process your personal information strictly for legitimate commercial, operational, and legal purposes:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-stone-50 rounded border border-stone-200 space-y-1">
                <strong className="text-[#1F1B16] block font-bold">1. Order Processing & Fulfillment</strong>
                <span className="text-stone-600 text-xs block">Manufacturing, packaging, dispatching, and delivering garments, generating statutory GST tax invoices, and processing exchanges or refunds.</span>
              </div>
              <div className="p-3 bg-stone-50 rounded border border-stone-200 space-y-1">
                <strong className="text-[#1F1B16] block font-bold">2. Customer Account & Authentication</strong>
                <span className="text-stone-600 text-xs block">Verifying mobile OTPs, enabling seamless Google Sign-In, maintaining your saved addresses, and managing Kora Rewards store credit.</span>
              </div>
              <div className="p-3 bg-stone-50 rounded border border-stone-200 space-y-1">
                <strong className="text-[#1F1B16] block font-bold">3. Multi-Channel Notifications</strong>
                <span className="text-stone-600 text-xs block">Sending real-time order status updates, shipment tracking links, and delivery confirmations via Email, WhatsApp, and SMS.</span>
              </div>
              <div className="p-3 bg-stone-50 rounded border border-stone-200 space-y-1">
                <strong className="text-[#1F1B16] block font-bold">4. Security & Fraud Prevention</strong>
                <span className="text-stone-600 text-xs block">Detecting credential stuffing, account takeover attempts, rate-limiting OTP requests, analyzing suspicious login patterns, and enforcing session revocations.</span>
              </div>
              <div className="p-3 bg-stone-50 rounded border border-stone-200 space-y-1">
                <strong className="text-[#1F1B16] block font-bold">5. Customer Support & CRM</strong>
                <span className="text-stone-600 text-xs block">Responding to support tickets, resolving delivery inquiries, and providing personalized care regarding fit, care, or exchanges.</span>
              </div>
              <div className="p-3 bg-stone-50 rounded border border-stone-200 space-y-1">
                <strong className="text-[#1F1B16] block font-bold">6. Legal & Tax Compliance</strong>
                <span className="text-stone-600 text-xs block">Maintaining mandatory accounting registers under the Central Goods and Services Tax (CGST) Act, 2017 and consumer protection regulations.</span>
              </div>
            </div>
          </section>

          {/* SECTION 4 */}
          <section id="sec-sharing" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <Globe className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                4. Data Sharing & Third-Party Service Providers
              </h2>
            </div>
            <p>
              <strong className="text-[#1F1B16]">Sa and Sha does NOT sell, rent, or trade your personal data to third-party advertisers.</strong> We share necessary data strictly with trusted service partners required to operate our platform:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-stone-700">
              <li>
                <strong>Payment Partners:</strong> Razorpay Software Private Limited handles payment processing. Transaction data is transmitted via secure 256-bit SSL encryption under PCI-DSS Level 1 compliance.
              </li>
              <li>
                <strong>Logistics & Courier Partners:</strong> Verified shipping networks (such as Delhivery, BlueDart, Xpressbees, India Post) receive recipient names, delivery addresses, pin codes, and contact numbers to complete order delivery and doorstep return pickups.
              </li>
              <li>
                <strong>Cloud Infrastructure & Identity Authentication:</strong> Google Cloud Platform hosts our secure database (Firestore) in regional Indian data centers. Google Sign-In uses Firebase Authentication strictly for identity verification. Google Sign-In does not mean Google shares all customer data with Sa and Sha, nor do we access your private Google account files or emails.
              </li>
              <li>
                <strong>Communication Services:</strong> Email dispatch is handled via secure SMTP/Resend providers. Order tracking updates on WhatsApp and SMS are transmitted through official meta-approved business API gateways.
              </li>
              <li>
                <strong>Legal & Regulatory Authorities:</strong> We may disclose information if required by Indian law, search warrant, court subpoena, or statutory tax audit by Indian government authorities.
              </li>
            </ul>
          </section>

          {/* SECTION 5 */}
          <section id="sec-security" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <ShieldAlert className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                5. Device Security, Session Management & IP Privacy
              </h2>
            </div>
            <p>
              We enforce enterprise-grade security protocols across every customer session:
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#5C6B4A] shrink-0 mt-0.5" />
                <span><strong>Session Hashing & Zero Token Exposure:</strong> All session tokens are stored as cryptographic SHA-256 hashes. Neither database administrators nor third parties can read raw session tokens.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#5C6B4A] shrink-0 mt-0.5" />
                <span><strong>IP Address Masking:</strong> IP addresses logged in security audit events are masked prior to storage (e.g. IPv4 <code className="bg-stone-100 px-1 rounded">203.0.113.xxx</code> or IPv6 <code className="bg-stone-100 px-1 rounded">2001:db8:****</code>), preserving location privacy while enabling security checks.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#5C6B4A] shrink-0 mt-0.5" />
                <span><strong>Customer Session Control:</strong> You can view all currently active device logins under <strong className="text-[#1F1B16]">Customer Dashboard &gt; Security & Sessions</strong>, view device names and last active times, and click <em>"Revoke Session"</em> or <em>"Sign Out Other Devices"</em> to terminate unauthorized access instantly.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#5C6B4A] shrink-0 mt-0.5" />
                <span><strong>Suspicious Login Detection Engine:</strong> Our automated risk engine evaluates login attempts for anomalous signals (e.g. <code className="bg-stone-100 px-1 rounded">NEW_DEVICE</code>, <code className="bg-stone-100 px-1 rounded">IP_CHANGE</code>, <code className="bg-stone-100 px-1 rounded">RAPID_LOGIN_ATTEMPTS</code>) and logs risk levels to protect your profile.</span>
              </div>
            </div>
          </section>

          {/* SECTION 6 */}
          <section id="sec-retention" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <Database className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                6. Data Storage & Retention Schedules
              </h2>
            </div>
            <p>
              Your data is stored securely in India within Google Cloud Firestore database instances guarded by firestore security rules:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-stone-700">
              <li><strong>Active Account Data:</strong> Retained for as long as your account remains active or until you request account deletion.</li>
              <li><strong>Order, Invoice & GST Records:</strong> Statutory financial records, GST invoices, and purchase histories are retained for a minimum of <strong>8 years</strong> to comply with Section 36 of the Central Goods and Services Tax (CGST) Act, 2017.</li>
              <li><strong>Security Audit Logs:</strong> Security event records and session activity logs are retained for up to 180 days for audit and fraud monitoring before automatic archiving or purging.</li>
            </ul>
          </section>

          {/* SECTION 7 */}
          <section id="sec-rights" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <UserCheck className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                7. Your Privacy Rights & Choices
              </h2>
            </div>
            <p>
              Under the Digital Personal Data Protection Act, 2023, you hold full rights over your personal data:
            </p>
            <div className="space-y-2">
              <div className="p-3 bg-stone-50 rounded border border-stone-200">
                <strong className="text-[#1F1B16] font-bold block">• Right to Access & Review:</strong>
                <span>You can log into your Customer Portal (`/account`) at any time to inspect your profile details, order history, store credit balances, saved addresses, and active device sessions.</span>
              </div>
              <div className="p-3 bg-stone-50 rounded border border-stone-200">
                <strong className="text-[#1F1B16] font-bold block">• Right to Correction & Updating:</strong>
                <span>You can edit your profile name, email, addresses, and communication preferences directly in your dashboard.</span>
              </div>
              <div className="p-3 bg-stone-50 rounded border border-stone-200">
                <strong className="text-[#1F1B16] font-bold block">• Right to Revoke Consent & Delete Account:</strong>
                <span>You may request deletion by contacting support at <a href="mailto:support@saandsha.com" className="text-[#B85C38] hover:underline font-semibold">support@saandsha.com</a> or via our <Link to="/contact-support" className="text-[#B85C38] hover:underline font-semibold">Support Portal</Link>. Upon receiving your request, non-statutory personal data will be processed for erasure within 30 days. Statutory GST and accounting records will be retained as required by Indian tax laws.</span>
              </div>
              <div className="p-3 bg-stone-50 rounded border border-stone-200">
                <strong className="text-[#1F1B16] font-bold block">• Marketing Opt-Out:</strong>
                <span>Every marketing email contains an instant 1-click unsubscribe link. You may also adjust WhatsApp and SMS notification preferences from your portal.</span>
              </div>
            </div>
          </section>

          {/* SECTION 8 */}
          <section id="sec-cookies" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <Eye className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                8. Cookies & Local Storage Usage
              </h2>
            </div>
            <p>
              Sa and Sha uses essential cookies and browser Local Storage exclusively for core operational performance:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-stone-700">
              <li><strong>Essential Session Cookies:</strong> To keep you authenticated securely across pages during your browsing session.</li>
              <li><strong>Local Storage (Cart & Preferences):</strong> To maintain your shopping bag items, recently viewed garments, and UI preferences.</li>
              <li><strong>Security & Anti-Bot Tokens:</strong> To protect forms against CSRF attacks and rate-limit automated bots.</li>
            </ul>
            <p className="text-stone-600">
              We do NOT deploy intrusive third-party cross-site tracking spyware or sell pixel data to external brokers.
            </p>
          </section>

          {/* SECTION 9 */}
          <section id="sec-children" className="space-y-3 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <AlertTriangle className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                9. Children's Privacy
              </h2>
            </div>
            <p>
              Our website and products are designed for adults aged 18 and above. Sa and Sha does not knowingly request or collect personal information from individuals under the age of 18. If a parent or legal guardian discovers that a minor has created an account without consent, please contact us immediately at <strong className="text-[#1F1B16]">support@saandsha.com</strong> to have the profile removed.
            </p>
          </section>

          {/* SECTION 10 */}
          <section id="sec-contact" className="space-y-4 bg-white p-6 rounded-lg border border-[#C9B79C]/30 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#C9B79C]/20 pb-3">
              <Mail className="w-5 h-5 text-[#B85C38]" />
              <h2 className="font-serif text-lg md:text-xl font-bold text-[#1F1B16]">
                10. Policy Updates & Grievance Contact Information
              </h2>
            </div>
            <p>
              We reserve the right to update this Privacy Policy periodically to reflect architectural enhancements or legal updates. Material updates will be published on this page with an updated effective date.
            </p>
            
            <div className="p-4 bg-[#E4D8C3]/20 rounded-lg border border-[#C9B79C]/30 space-y-3">
              <h3 className="font-serif font-bold text-sm text-[#1F1B16] uppercase tracking-wider">
                Grievance Officer & Legal Contact
              </h3>
              <p className="text-xs text-stone-700">
                In accordance with the Information Technology Act, 2000 and the Consumer Protection (E-Commerce) Rules, 2020, the name and contact details of our Grievance Redressal Officer are provided below:
              </p>
              <div className="space-y-1.5 text-xs text-[#1F1B16] font-medium">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#B85C38]" />
                  <span><strong>Grievance Officer:</strong> Legal & Compliance Desk</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#B85C38]" />
                  <span><strong>Entity:</strong> Rajasthan Exports Overseas Pvt. Ltd. (Brand: Sa and Sha)</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#B85C38]" />
                  <span><strong>Address:</strong> H1-56, First Floor, RIICO Apparel Park, Mahal Road, Jagatpura, Jaipur, Rajasthan - 302020, India</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#B85C38]" />
                  <span><strong>Email:</strong> <a href="mailto:support@saandsha.com" className="text-[#B85C38] hover:underline">support@saandsha.com</a></span>
                </div>
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-[#B85C38]" />
                  <span><strong>Support Portal:</strong> <Link to="/contact-support" className="text-[#B85C38] hover:underline">https://saandsha.com/contact-support</Link></span>
                </div>
              </div>
              <p className="text-[11px] text-stone-500 pt-1 border-t border-[#C9B79C]/20">
                Grievances are formally acknowledged within 48 hours and resolved within 15 business days.
              </p>
            </div>
          </section>

        </div>
      </div>

    </div>
  );
};
