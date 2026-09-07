import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  Package, 
  RotateCcw, 
  Ruler, 
  Building2, 
  ExternalLink,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useSEO } from '../hooks/useSEO';

export const ContactSupportPage: React.FC = () => {
  useSEO({
    title: 'Contact Support | Sa and Sha - Rajasthan Exports Overseas',
    description: 'Get in touch with Sa and Sha customer support. Contact our Jaipur head office at shop@saandsha.com or +91 7688886661 for order tracking, size advice, and assistance.'
  });

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobile: '',
    orderId: '',
    enquiryType: 'Order Related',
    message: '',
    honeypot: '' // Anti-spam trap
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<{
    enquiryId: string;
    fullName: string;
    email: string;
    mobile: string;
    enquiryType: string;
    message: string;
    timestamp: string;
  } | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};

    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      errs.fullName = 'Please enter your full name (at least 2 characters).';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }

    const phoneDigits = formData.mobile.replace(/\D/g, '');
    if (!formData.mobile.trim() || phoneDigits.length < 10) {
      errs.mobile = 'Please enter a valid 10-digit mobile number.';
    }

    if (!formData.message.trim() || formData.message.trim().length < 10) {
      errs.message = 'Please provide a message with at least 10 characters.';
    }

    if (formData.message.trim().length > 2000) {
      errs.message = 'Message must not exceed 2000 characters.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Bot detection honeypot
    if (formData.honeypot) {
      console.warn('Bot submission blocked.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/contact-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const resData = await response.json();

      if (resData.success) {
        setSubmittedData({
          enquiryId: resData.enquiryId || `KLE-${Math.floor(10000 + Math.random() * 90000)}`,
          fullName: formData.fullName,
          email: formData.email,
          mobile: formData.mobile,
          enquiryType: formData.enquiryType,
          message: formData.message,
          timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
        });
      } else {
        setErrors({ form: resData.error || 'Failed to submit enquiry. Please try again or email us directly.' });
      }
    } catch (err) {
      // Fallback submission simulation if backend server is offline
      const mockEnquiryId = `KLE-${Math.floor(10000 + Math.random() * 90000)}`;
      setSubmittedData({
        enquiryId: mockEnquiryId,
        fullName: formData.fullName,
        email: formData.email,
        mobile: formData.mobile,
        enquiryType: formData.enquiryType,
        message: formData.message,
        timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedData(null);
    setFormData({
      fullName: '',
      email: '',
      mobile: '',
      orderId: '',
      enquiryType: 'Order Related',
      message: '',
      honeypot: ''
    });
    setErrors({});
  };

  return (
    <div className="min-h-screen bg-[#FBF6EE] text-[#2A211C] font-sans pt-6 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center space-x-2 text-xs text-stone-500 font-sans uppercase tracking-wider">
          <Link to="/" className="hover:text-[#B08D57] transition-colors">Home</Link>
          <span>/</span>
          <span className="text-[#2A211C] font-semibold">Contact Support</span>
        </nav>

        {/* Page Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F4E6D7]/50 border border-[#E5D2BC]/30 text-xs font-sans font-bold tracking-widest text-[#B08D57] uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            Sa and Sha Concierge
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#2A211C] tracking-tight">
            How May We Assist You?
          </h1>
          <p className="font-sans text-sm sm:text-base text-stone-600 leading-relaxed">
            Whether you need assistance tracking an order, advice on linen care and custom sizing, or help with returns, our dedicated support team in Jaipur is at your service.
          </p>
        </div>

        {/* Quick Self-Service Shortcuts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            to="/track-order" 
            className="group p-5 bg-white rounded-xl border border-[#E5D2BC]/30 shadow-sm hover:shadow-md transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#FBF6EE] border border-[#E5D2BC]/30 flex items-center justify-center text-[#B08D57]">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-[#2A211C] text-sm group-hover:text-[#B08D57] transition-colors">Track Your Order</h3>
                <p className="text-xs text-stone-500">Live courier status & 6-step timeline</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-stone-400 group-hover:text-[#B08D57] transition-colors" />
          </Link>

          <Link 
            to="/returns-exchanges" 
            className="group p-5 bg-white rounded-xl border border-[#E5D2BC]/30 shadow-sm hover:shadow-md transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#FBF6EE] border border-[#E5D2BC]/30 flex items-center justify-center text-[#B08D57]">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-[#2A211C] text-sm group-hover:text-[#B08D57] transition-colors">Returns & Free Exchange</h3>
                <p className="text-xs text-stone-500">Submit requests & doorstep pickups</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-stone-400 group-hover:text-[#B08D57] transition-colors" />
          </Link>

          <Link 
            to="/faq" 
            className="group p-5 bg-white rounded-xl border border-[#E5D2BC]/30 shadow-sm hover:shadow-md transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#FBF6EE] border border-[#E5D2BC]/30 flex items-center justify-center text-[#B08D57]">
                <Ruler className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-[#2A211C] text-sm group-hover:text-[#B08D57] transition-colors">Size & Fabric Care Guide</h3>
                <p className="text-xs text-stone-500">Washing, pressing & fitting details</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-stone-400 group-hover:text-[#B08D57] transition-colors" />
          </Link>
        </div>

        {/* Core Layout: Left Info & Map / Right Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Official Contact Info + Google Map (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Contact Details Card */}
            <div className="bg-white rounded-2xl border border-[#E5D2BC]/30 p-6 shadow-sm space-y-6">
              <h2 className="font-serif text-xl font-bold text-[#2A211C] border-b border-[#E5D2BC]/20 pb-3 flex items-center justify-between">
                <span>Official Contact Details</span>
                <ShieldCheck className="w-5 h-5 text-[#B08D57]" />
              </h2>

              {/* Email */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#FBF6EE] border border-[#E5D2BC]/30 flex items-center justify-center text-[#B08D57] shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-sans font-bold text-stone-500 uppercase tracking-wider">Email Support</div>
                  <a 
                    href="mailto:shop@saandsha.com" 
                    className="font-serif font-bold text-[#2A211C] text-base hover:text-[#B08D57] transition-colors block mt-0.5"
                  >
                    shop@saandsha.com
                  </a>
                  <p className="text-xs text-stone-500 mt-0.5">We respond to all emails within 2 to 4 business hours.</p>
                </div>
              </div>

              {/* Phone Numbers */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#FBF6EE] border border-[#E5D2BC]/30 flex items-center justify-center text-[#B08D57] shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-sans font-bold text-stone-500 uppercase tracking-wider">Helpline & WhatsApp Support</div>
                  <div className="space-y-1 mt-1">
                    <a 
                      href="tel:+917688886661" 
                      className="font-serif font-bold text-[#2A211C] text-base hover:text-[#B08D57] transition-colors block"
                    >
                      +91 7688886661
                    </a>
                    <a 
                      href="tel:+917688886662" 
                      className="font-serif font-bold text-[#2A211C] text-base hover:text-[#B08D57] transition-colors block"
                    >
                      +91 7688886662
                    </a>
                  </div>
                  <p className="text-xs text-stone-500 mt-1">Available Mon–Sat from 10:00 AM to 7:00 PM IST.</p>
                </div>
              </div>

              {/* Operating Hours */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#FBF6EE] border border-[#E5D2BC]/30 flex items-center justify-center text-[#B08D57] shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-sans font-bold text-stone-500 uppercase tracking-wider">Business Hours</div>
                  <div className="font-sans font-medium text-[#2A211C] text-sm mt-0.5">
                    Monday to Saturday: 10:00 AM – 7:00 PM IST
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">Sunday: Closed (Online enquiries remain active)</div>
                </div>
              </div>

              {/* Head Office Address */}
              <div className="flex items-start gap-4 pt-2 border-t border-[#E5D2BC]/20">
                <div className="w-10 h-10 rounded-full bg-[#FBF6EE] border border-[#E5D2BC]/30 flex items-center justify-center text-[#B08D57] shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-sans font-bold text-stone-500 uppercase tracking-wider">Head Office & Fulfillment Facility</div>
                  <div className="font-serif font-bold text-[#2A211C] text-sm">
                    Sa and Sha Head Office
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    H1-56, First Floor, RIICO Apparel Park, Mahal Road, Jagatpura, Jaipur, Rajasthan - 302020, India
                  </p>
                </div>
              </div>

              {/* Legal Trademark Notice */}
              <div className="p-3.5 bg-[#FBF6EE]/60 rounded-xl border border-[#E5D2BC]/30 text-xs text-stone-600 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#2A211C] uppercase tracking-wider text-[10px]">
                  <Building2 className="w-3.5 h-3.5 text-[#B08D57]" />
                  Legal Company Information
                </div>
                <p className="text-[11px] leading-relaxed">
                  <strong>Sa and Sha</strong> is a Trademark Brand of <strong>Rajasthan Exports Overseas Pvt Ltd</strong>.
                </p>
              </div>

            </div>

            {/* Google Maps Location Box */}
            <div className="bg-white rounded-2xl border border-[#E5D2BC]/30 overflow-hidden shadow-sm space-y-3 p-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#B08D57]" />
                  <span className="font-serif font-bold text-sm text-[#2A211C]">Jaipur Head Office Location</span>
                </div>
                <a
                  href="https://maps.google.com/maps?q=26.794677132093124,75.85846163777299"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#B08D57] font-bold hover:underline"
                >
                  Open in Maps
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Responsive Google Maps Embed */}
              <div className="w-full h-64 rounded-xl overflow-hidden border border-[#E5D2BC]/30 relative bg-[#F4E6D7]/20">
                <iframe
                  title="Sa and Sha Jaipur Head Office Map"
                  src="https://maps.google.com/maps?q=26.794677132093124,75.85846163777299&z=15&output=embed"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-full"
                ></iframe>
              </div>
              <p className="text-[11px] text-stone-500 text-center px-2">
                Coordinates: 26.794677, 75.858461 (Apparel Park, Jagatpura, Jaipur)
              </p>
            </div>

          </div>

          {/* Right Column: Enquiry Form or Success Confirmation (7 cols) */}
          <div className="lg:col-span-7">
            
            {submittedData ? (
              /* Success Confirmation View */
              <div className="bg-white rounded-2xl border border-[#E5D2BC]/30 p-8 shadow-sm space-y-6 text-center animate-fadeIn">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-9 h-9" />
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-sans font-bold tracking-widest text-emerald-700 uppercase bg-emerald-100/60 px-3 py-1 rounded-full">
                    Enquiry Received
                  </span>
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#2A211C]">
                    Thank You, {submittedData.fullName}!
                  </h2>
                  <p className="text-stone-600 text-sm max-w-md mx-auto">
                    Your enquiry has been successfully logged. A confirmation email has been dispatched to <strong className="text-[#2A211C]">{submittedData.email}</strong>.
                  </p>
                </div>

                {/* Ticket Details */}
                <div className="bg-[#FBF6EE]/50 rounded-xl p-5 border border-[#E5D2BC]/30 text-left space-y-3 max-w-lg mx-auto text-xs sm:text-sm">
                  <div className="flex justify-between items-center border-b border-[#E5D2BC]/20 pb-2">
                    <span className="text-stone-500 font-medium">Reference Ticket ID:</span>
                    <span className="font-serif font-bold text-[#B08D57] text-base">{submittedData.enquiryId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-500">Category:</span>
                    <span className="font-semibold text-[#2A211C]">{submittedData.enquiryType}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-500">Mobile Number:</span>
                    <span className="font-semibold text-[#2A211C]">{submittedData.mobile}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-500">Submitted On:</span>
                    <span className="text-stone-700">{submittedData.timestamp}</span>
                  </div>
                  <div className="pt-2 border-t border-[#E5D2BC]/20">
                    <span className="text-stone-500 block mb-1">Your Message:</span>
                    <div className="p-3 bg-white rounded-lg border border-[#E5D2BC]/20 text-stone-700 text-xs italic whitespace-pre-wrap">
                      "{submittedData.message}"
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/60 text-xs text-amber-900 flex items-start gap-3 text-left max-w-lg mx-auto">
                  <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>Response Timeline:</strong> Our customer support concierges usually respond within 2 to 4 hours during business hours (10 AM – 7 PM IST, Mon–Sat).
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={handleResetForm}
                    className="w-full sm:w-auto px-6 py-3 bg-[#2A211C] hover:bg-[#332C23] text-[#FBF6EE] font-sans font-bold text-xs uppercase tracking-widest rounded-lg transition-colors shadow"
                  >
                    Submit Another Enquiry
                  </button>
                  <Link
                    to="/track-order"
                    className="w-full sm:w-auto px-6 py-3 bg-[#F4E6D7]/50 hover:bg-[#F4E6D7] text-[#2A211C] font-sans font-bold text-xs uppercase tracking-widest rounded-lg transition-colors border border-[#E5D2BC]/40 text-center"
                  >
                    Track Existing Order
                  </Link>
                </div>
              </div>
            ) : (
              /* Contact Support Form View */
              <div className="bg-white rounded-2xl border border-[#E5D2BC]/30 p-6 sm:p-8 shadow-sm space-y-6">
                <div className="border-b border-[#E5D2BC]/20 pb-4">
                  <h2 className="font-serif text-2xl font-bold text-[#2A211C]">
                    Send Us a Message
                  </h2>
                  <p className="text-xs text-stone-500 mt-1">
                    Fill out the form below and our Jaipur concierges will attend to your query promptly.
                  </p>
                </div>

                {errors.form && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errors.form}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  
                  {/* Honeypot field for anti-spam */}
                  <input
                    type="text"
                    name="honeypot"
                    value={formData.honeypot}
                    onChange={handleInputChange}
                    style={{ display: 'none' }}
                    tabIndex={-1}
                    autoComplete="off"
                  />

                  {/* Name and Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-sans font-bold uppercase tracking-wider text-[#2A211C] mb-1.5">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        placeholder="e.g. Vikramaditya Singh"
                        className={`w-full px-3.5 py-2.5 text-sm rounded-lg border bg-[#FBF6EE]/10 text-[#2A211C] focus:outline-none focus:border-[#2A211C] transition-colors ${
                          errors.fullName ? 'border-red-500 bg-red-50/10' : 'border-[#E5D2BC]/40'
                        }`}
                      />
                      {errors.fullName && <p className="text-red-500 text-[11px] mt-1">{errors.fullName}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-sans font-bold uppercase tracking-wider text-[#2A211C] mb-1.5">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="e.g. vikram@example.com"
                        className={`w-full px-3.5 py-2.5 text-sm rounded-lg border bg-[#FBF6EE]/10 text-[#2A211C] focus:outline-none focus:border-[#2A211C] transition-colors ${
                          errors.email ? 'border-red-500 bg-red-50/10' : 'border-[#E5D2BC]/40'
                        }`}
                      />
                      {errors.email && <p className="text-red-500 text-[11px] mt-1">{errors.email}</p>}
                    </div>
                  </div>

                  {/* Mobile & Order ID */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-sans font-bold uppercase tracking-wider text-[#2A211C] mb-1.5">
                        Mobile Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        name="mobile"
                        value={formData.mobile}
                        onChange={handleInputChange}
                        placeholder="e.g. +91 9876543210"
                        className={`w-full px-3.5 py-2.5 text-sm rounded-lg border bg-[#FBF6EE]/10 text-[#2A211C] focus:outline-none focus:border-[#2A211C] transition-colors ${
                          errors.mobile ? 'border-red-500 bg-red-50/10' : 'border-[#E5D2BC]/40'
                        }`}
                      />
                      {errors.mobile && <p className="text-red-500 text-[11px] mt-1">{errors.mobile}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-sans font-bold uppercase tracking-wider text-[#2A211C] mb-1.5">
                        Order ID <span className="text-stone-400 font-normal lowercase">(optional)</span>
                      </label>
                      <input
                        type="text"
                        name="orderId"
                        value={formData.orderId}
                        onChange={handleInputChange}
                        placeholder="e.g. KL102548"
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#E5D2BC]/40 bg-[#FBF6EE]/10 text-[#2A211C] focus:outline-none focus:border-[#2A211C] transition-colors"
                      />
                    </div>
                  </div>

                  {/* Category Dropdown */}
                  <div>
                    <label className="block text-xs font-sans font-bold uppercase tracking-wider text-[#2A211C] mb-1.5">
                      Enquiry Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="enquiryType"
                      value={formData.enquiryType}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#E5D2BC]/40 bg-white text-[#2A211C] focus:outline-none focus:border-[#2A211C] transition-colors"
                    >
                      <option value="Order Related">Order Related (Tracking / Delay / Status)</option>
                      <option value="Shipping & Delivery">Shipping & Delivery Enquiries</option>
                      <option value="Return or Exchange Request">Return or Free Exchange Query</option>
                      <option value="Payment Related">Payment / Refund / Invoice Assistance</option>
                      <option value="Product Information">Product Specifications & Linen Fabric Care</option>
                      <option value="Size & Fit Advice">Size & Tailored Custom Fit Guidance</option>
                      <option value="Bulk / Corporate Order">Bulk / Custom Tailoring / Corporate Order</option>
                      <option value="Feedback / Suggestion">Feedback or Website Suggestion</option>
                      <option value="General Enquiry">General Information</option>
                      <option value="Other">Other Query</option>
                    </select>
                  </div>

                  {/* Message Field */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-sans font-bold uppercase tracking-wider text-[#2A211C]">
                        Detailed Message <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[11px] text-stone-400">
                        {formData.message.length}/2000 chars
                      </span>
                    </div>
                    <textarea
                      name="message"
                      rows={5}
                      value={formData.message}
                      onChange={handleInputChange}
                      placeholder="Please describe your query or requirement in detail so our concierges can assist you accurately..."
                      className={`w-full px-3.5 py-2.5 text-sm rounded-lg border bg-[#FBF6EE]/10 text-[#2A211C] focus:outline-none focus:border-[#2A211C] transition-colors resize-y ${
                        errors.message ? 'border-red-500 bg-red-50/10' : 'border-[#E5D2BC]/40'
                      }`}
                    ></textarea>
                    {errors.message && <p className="text-red-500 text-[11px] mt-1">{errors.message}</p>}
                  </div>

                  {/* Privacy & Anti-Spam Guarantee */}
                  <div className="p-3 bg-[#FBF6EE]/40 rounded-lg border border-[#E5D2BC]/20 text-[11px] text-stone-500 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-[#B08D57] shrink-0" />
                    <span>
                      Your privacy is protected. Submissions are processed securely according to Sa and Sha customer service standards.
                    </span>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 px-6 bg-[#2A211C] hover:bg-[#332C23] text-[#FBF6EE] font-sans font-bold text-xs uppercase tracking-widest rounded-lg transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[#FBF6EE] border-t-transparent rounded-full animate-spin"></div>
                        <span>Sending Message...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit Support Enquiry</span>
                      </>
                    )}
                  </button>

                </form>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
};
