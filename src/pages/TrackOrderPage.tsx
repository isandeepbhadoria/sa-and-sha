import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import { useShop } from '../context/ShopContext';
import { 
  Search, 
  Package, 
  Truck, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  ExternalLink, 
  Copy, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  HelpCircle, 
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Download,
  Lock,
  ChevronRight,
  X,
  PhoneCall,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TimelineStep {
  id: string;
  label: string;
  description: string;
  isCompleted: boolean;
  isCurrent: boolean;
  timestamp?: string | null;
}

interface ShipmentEvent {
  code: string;
  label: string;
  location: string | null;
  occurred_at: string;
  description: string;
  source: string;
}

interface ProviderNeutralShipment {
  provider: 'bluedart' | 'other' | null;
  awb_number: string | null;
  current_status: string | null;
  status_code: string | null;
  estimated_delivery: string | null;
  tracking_url: string | null;
  last_synced_at: string | null;
  events: ShipmentEvent[];
}

interface PublicTrackingData {
  tracking_token: string;
  order_number: string;
  order_number_raw?: string | null;
  order_status: string;
  created_at: string | null;
  estimated_delivery: string;
  courier_name: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  city: string;
  state: string;
  pincode_masked: string;
  total_items: number;
  items_summary: Array<{
    title: string;
    image_url: string;
    quantity: number;
    color?: string | null;
    size?: string | null;
  }>;
  timeline: TimelineStep[];
  shipment: ProviderNeutralShipment;
  is_verified: boolean;
  return_eligibility?: {
    eligible: boolean;
    reason: string;
    daysRemaining: number;
  };
}

interface VerifiedDetailsData {
  tracking_token: string;
  order_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  full_address: string;
  city: string;
  state: string;
  pincode: string;
  items: Array<{
    title?: string;
    product_name?: string;
    price?: number;
    quantity?: number;
    color?: string;
    size?: string;
    image_url?: string;
    image?: string;
  }>;
  grand_total: number;
  subtotal: number;
  shipping_cost: number;
  discount: number;
  payment_method: string;
  payment_id: string;
  order_status: string;
  can_download_invoice: boolean;
  timeline: TimelineStep[];
  shipment: ProviderNeutralShipment;
}

export const TrackOrderPage: React.FC = () => {
  const { trackingToken: urlToken } = useParams<{ trackingToken?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useShop();

  // Active query string or URL token
  const initialToken = urlToken || searchParams.get('token') || searchParams.get('orderId') || '';

  // Search input state
  const [searchInput, setSearchInput] = useState(initialToken);
  
  // Data States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<PublicTrackingData | null>(null);
  const [verifiedDetails, setVerifiedDetails] = useState<VerifiedDetailsData | null>(null);

  // Verification Modal State
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [otpStep, setOtpStep] = useState<'request' | 'verify'>('request');
  const [otpChannel, setOtpChannel] = useState<'mobile' | 'email'>('mobile');
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [maskedDestination, setMaskedDestination] = useState<string | null>(null);

  // UI helpers
  const [copiedAwb, setCopiedAwb] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Set noindex SEO header
  useSEO({
    title: 'Track Your Order | Sa and Sha',
    description: 'Track your Sa and Sha order status, shipment timeline, and delivery estimated date in real time.',
    canonical: 'https://www.sa-and-sha.com/track-order'
  });

  // Ensure noindex meta tag dynamically
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');
  }, []);

  // Auto fetch if URL contains token
  useEffect(() => {
    if (initialToken) {
      fetchTracking(initialToken);
    }
  }, [initialToken]);

  const fetchTracking = async (token: string) => {
    const cleanToken = token.trim();
    if (!cleanToken) return;

    setIsLoading(true);
    setErrorMsg(null);
    setTrackingData(null);
    setVerifiedDetails(null);

    try {
      const response = await fetch(`/api/tracking/public/${encodeURIComponent(cleanToken)}`);
      const data = await response.json();

      if (response.ok && data.success && data.tracking) {
        setTrackingData(data.tracking);
        // Check for existing active verification token in sessionStorage
        const savedVTok = sessionStorage.getItem(`vtok_${data.tracking.tracking_token}`);
        if (savedVTok) {
          fetchVerifiedDetails(data.tracking.tracking_token, savedVTok);
        }
      } else {
        setErrorMsg(data.error || "We couldn't find this order. Please check your tracking link.");
      }
    } catch (err) {
      console.error('Error fetching public tracking:', err);
      setErrorMsg('Shipment updates are temporarily unavailable. Your order information remains safe.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVerifiedDetails = async (token: string, vtok: string) => {
    try {
      const response = await fetch(`/api/tracking/public/${encodeURIComponent(token)}/verified-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tracking-verification-token': vtok
        }
      });
      const data = await response.json();
      if (response.ok && data.success && data.verified_details) {
        setVerifiedDetails(data.verified_details);
      } else {
        sessionStorage.removeItem(`vtok_${token}`);
      }
    } catch (err) {
      console.error('Error fetching verified details:', err);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!verifiedDetails) return;
    const token = localStorage.getItem("kora_customer_auth_token") || localStorage.getItem("verification_token") || (trackingData ? sessionStorage.getItem(`vtok_${trackingData.tracking_token}`) : "") || "";
    try {
      const res = await fetch(`/api/customer/orders/${verifiedDetails.order_id}/invoice?format=pdf`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-verification-token": token
        }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Tax invoice is not available yet." }));
        alert(err.error || "Tax invoice is not available yet.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Sa-and-Sha-Tax-Invoice-${verifiedDetails.order_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading invoice:", err);
      alert("Failed to download tax invoice.");
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchInput.trim();
    if (!clean) {
      setErrorMsg('Please enter a valid secure tracking link token.');
      return;
    }
    if (clean.startsWith('trk_')) {
      navigate(`/track-order/${encodeURIComponent(clean)}`);
      fetchTracking(clean);
    } else {
      setErrorMsg('For security, order tracking requires a secure tracking token link. Please check your order confirmation WhatsApp or Email for your tracking link.');
      setTrackingData(null);
      setVerifiedDetails(null);
    }
  };

  const handleSendOtp = async (channelOverride?: 'mobile' | 'email') => {
    const tokenToVerify = trackingData?.tracking_token || searchInput.trim() || initialToken;
    if (!tokenToVerify) return;

    const channelToUse = channelOverride || otpChannel;
    setIsSendingOtp(true);
    setVerifyError(null);

    try {
      const response = await fetch(`/api/tracking/public/${encodeURIComponent(tokenToVerify)}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: channelToUse })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMaskedDestination(data.destination_masked || null);
        setOtpStep('verify');
        showToast(`Verification code sent to your ${data.channel}.`);
      } else {
        setVerifyError(data.error || 'Failed to send verification code.');
      }
    } catch (err) {
      console.error('Send OTP error:', err);
      setVerifyError('Failed to send verification code due to a network issue.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const tokenToVerify = trackingData?.tracking_token || searchInput.trim() || initialToken;
    if (!tokenToVerify) return;

    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setVerifyError('Please enter the 6-digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);
    setVerifyError(null);

    try {
      const response = await fetch(`/api/tracking/public/${encodeURIComponent(tokenToVerify)}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: otpCode.trim(), channel: otpChannel })
      });

      const data = await response.json();

      if (response.ok && data.success && data.verification_token) {
        sessionStorage.setItem(`vtok_${tokenToVerify}`, data.verification_token);
        await fetchVerifiedDetails(tokenToVerify, data.verification_token);
        setShowVerifyModal(false);
        setOtpCode('');
        setOtpStep('request');
        showToast('Identity verified! Full order details unlocked.');
      } else {
        setVerifyError(data.error || 'Invalid verification code. Please check and try again.');
      }
    } catch (err) {
      console.error('Verify OTP error:', err);
      setVerifyError('Verification failed due to a server error. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleCopyAwb = (awb: string) => {
    navigator.clipboard.writeText(awb);
    setCopiedAwb(true);
    showToast('AWB copied to clipboard!');
    setTimeout(() => setCopiedAwb(false), 2000);
  };

  const handleCopyLink = () => {
    const link = trackingData?.tracking_token 
      ? `${window.location.origin}/track-order/${trackingData.tracking_token}`
      : window.location.href;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    showToast('Secure tracking link copied!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Status helper mapping
  const getStatusBadgeClass = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'delivered') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (s === 'shipped' || s === 'out_for_delivery') return 'bg-amber-50 text-amber-800 border-amber-200';
    if (s === 'cancelled') return 'bg-rose-50 text-rose-800 border-rose-200';
    return 'bg-stone-100 text-stone-800 border-stone-200';
  };

  const formatStatusDisplay = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'placed') return 'Order Placed';
    if (s === 'confirmed') return 'Order Confirmed';
    if (s === 'processing') return 'Processing & Crafting';
    if (s === 'packed') return 'Packed for Shipment';
    if (s === 'shipped') return 'Dispatched';
    if (s === 'out_for_delivery') return 'Out for Delivery';
    if (s === 'delivered') return 'Delivered';
    if (s === 'cancelled') return 'Cancelled';
    return s.replace(/_/g, ' ').toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2A211C] font-sans pt-6 pb-20 px-4 md:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* 1. HERO HEADER */}
        <div className="text-center space-y-3 pt-4 pb-2">
          <span className="inline-block text-[11px] font-bold tracking-[0.2em] uppercase text-[#8C6D53] bg-[#F5EFE6] px-3 font-mono py-1 rounded-full border border-[#E8DFD3]">
            Sa and Sha Artisanal Logistics
          </span>
          <h1 className="font-serif text-3xl md:text-5xl font-bold text-[#2A211C] tracking-tight">
            Track Your Order
          </h1>
          <p className="font-sans text-sm md:text-base text-[#2A211C]/70 max-w-lg mx-auto leading-relaxed">
            Follow your Sa and Sha order from fabric crafting to your doorstep.
          </p>
        </div>

        {/* 2. SEARCH INPUT FORM (When no tracking result or searching new token) */}
        <div className="bg-white border border-[#E8DFD3] rounded-2xl p-5 md:p-8 shadow-xs space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8C6D53]" />
              <input
                type="text"
                placeholder="Enter Tracking Token or Order ID (e.g. trk_... or ORD-10928)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-[#FDFBF7] border border-[#E8DFD3] rounded-xl text-sm font-sans focus:outline-none focus:border-[#8C6D53] focus:bg-white transition-all text-[#2A211C] placeholder:text-stone-400"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3.5 bg-[#2A211C] text-[#FDFBF7] font-sans font-medium text-sm rounded-xl hover:bg-[#38322B] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <span>Track Order</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {errorMsg && (
            <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{errorMsg}</p>
                <p className="text-xs text-rose-700 mt-1">
                  Need assistance? Contact our Customer Care team at <a href="mailto:support@sa-and-sha.com" className="underline font-medium">support@sa-and-sha.com</a>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 3. TRACKING RESULT DISPLAY */}
        {trackingData && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* ORDER SUMMARY CARD */}
            <div className="bg-white border border-[#E8DFD3] rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F0E8DD] pb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-[#8C6D53] uppercase tracking-wider">Order Reference</span>
                    {verifiedDetails && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        <ShieldCheck className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-[#2A211C]">
                    {verifiedDetails ? verifiedDetails.order_id : trackingData.order_number}
                  </h2>
                  <p className="text-xs text-stone-500 font-sans">
                    Placed on {trackingData.created_at ? new Date(trackingData.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full border text-xs font-semibold font-sans uppercase tracking-wider ${getStatusBadgeClass(trackingData.order_status)}`}>
                    {formatStatusDisplay(trackingData.order_status)}
                  </span>
                  
                  <button
                    onClick={handleCopyLink}
                    className="p-2 border border-[#E8DFD3] hover:bg-[#FDFBF7] text-stone-600 rounded-lg transition-all text-xs font-medium flex items-center gap-1.5"
                    title="Copy Secure Tracking Link"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span className="hidden sm:inline">{copiedLink ? 'Copied' : 'Share Link'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-1">
                <div className="space-y-1">
                  <span className="text-xs text-stone-500 font-sans block">Estimated Delivery</span>
                  <span className="font-medium text-[#2A211C] font-sans flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#8C6D53]" />
                    {trackingData.estimated_delivery}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-stone-500 font-sans block">Destination</span>
                  <span className="font-medium text-[#2A211C] font-sans flex items-center gap-1.5 truncate">
                    <MapPin className="w-4 h-4 text-[#8C6D53] shrink-0" />
                    {trackingData.city && trackingData.state 
                      ? `${trackingData.city}, ${trackingData.state}` 
                      : 'Delivery Address'}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-stone-500 font-sans block">Total Items</span>
                  <span className="font-medium text-[#2A211C] font-sans flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-[#8C6D53]" />
                    {trackingData.total_items} {trackingData.total_items === 1 ? 'item' : 'items'}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-stone-500 font-sans block">Courier Partner</span>
                  <span className="font-medium text-[#2A211C] font-sans flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-[#8C6D53]" />
                    {trackingData.courier_name || 'Preparing Dispatch'}
                  </span>
                </div>
              </div>

              {/* RETURN ELIGIBILITY BANNER IF DELIVERED */}
              {trackingData.order_status === 'delivered' && trackingData.return_eligibility && (
                <div className={`p-4 rounded-xl border text-xs font-sans flex items-center justify-between gap-3 ${
                  trackingData.return_eligibility.eligible 
                    ? 'bg-amber-50/70 border-amber-200 text-amber-900' 
                    : 'bg-stone-50 border-stone-200 text-stone-600'
                }`}>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-[#8C6D53]" />
                    <span>{trackingData.return_eligibility.reason}</span>
                  </div>
                  {trackingData.return_eligibility.eligible && (
                    <Link
                      to={`/returns-exchanges?orderId=${encodeURIComponent(trackingData.order_number_raw || trackingData.order_number)}`}
                      className="text-xs font-bold underline hover:text-amber-950 shrink-0"
                    >
                      Request Return/Exchange
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* PRE-SHIPMENT VS POST-SHIPMENT CARD */}
            {!trackingData.tracking_number ? (
              /* PRE-SHIPMENT BOX */
              <div className="bg-amber-50/40 border border-amber-200/80 rounded-2xl p-6 md:p-8 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-100 rounded-xl text-[#8C6D53]">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-lg text-[#2A211C]">Your order is being prepared</h3>
                    <p className="text-xs md:text-sm text-stone-600 font-sans">
                      We’ll add courier and live tracking details as soon as your order is dispatched.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* POST-SHIPMENT COURIER CARD */
              <div className="bg-white border border-[#E8DFD3] rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F0E8DD] pb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-[#FDFBF7] border border-[#E8DFD3] rounded-xl text-[#8C6D53]">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-mono text-stone-500 uppercase tracking-wider block">Shipment Partner</span>
                      <h3 className="font-serif font-bold text-xl text-[#2A211C]">{trackingData.courier_name || 'Logistics Partner'}</h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-left sm:text-right">
                      <span className="text-xs text-stone-500 font-sans block">AWB / Tracking Number</span>
                      <span className="font-mono font-bold text-sm text-[#2A211C]">{trackingData.tracking_number}</span>
                    </div>
                    <button
                      onClick={() => handleCopyAwb(trackingData.tracking_number!)}
                      className="p-2 text-stone-600 hover:text-[#2A211C] border border-[#E8DFD3] hover:bg-[#FDFBF7] rounded-lg transition-all"
                      title="Copy AWB Number"
                    >
                      {copiedAwb ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {trackingData.tracking_url && (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-stone-500 font-sans">
                      Need direct courier updates? Track directly on carrier portal.
                    </p>
                    <a
                      href={trackingData.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2A211C] text-[#FDFBF7] hover:bg-[#38322B] rounded-xl text-xs font-medium font-sans transition-all shrink-0"
                    >
                      <span>View on Courier Website</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* ORDER STATUS TIMELINE */}
            <div className="bg-white border border-[#E8DFD3] rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
              <h3 className="font-serif font-bold text-xl text-[#2A211C]">Shipment Progress</h3>

              <div className="relative pl-6 md:pl-8 space-y-8 before:absolute before:left-2.5 md:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#E8DFD3]">
                {trackingData.timeline.map((step) => (
                  <div key={step.id} className="relative flex items-start gap-4 group">
                    {/* Circle Icon */}
                    <div className={`absolute -left-6 md:-left-8 top-0.5 w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-xs transition-all ${
                      step.isCompleted 
                        ? 'bg-[#2A211C] text-[#FDFBF7] ring-4 ring-stone-100' 
                        : 'bg-white border-2 border-[#E8DFD3] text-stone-400'
                    }`}>
                      {step.isCompleted ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-stone-300" />
                      )}
                    </div>

                    <div className="space-y-1 flex-grow">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className={`font-sans font-semibold text-sm ${step.isCompleted ? 'text-[#2A211C]' : 'text-stone-400'}`}>
                          {step.label}
                        </h4>
                        {step.timestamp && (
                          <span className="text-[11px] font-mono text-stone-500">
                            {new Date(step.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs ${step.isCompleted ? 'text-stone-600' : 'text-stone-400'}`}>
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PURCHASED ITEMS SUMMARY */}
            <div className="bg-white border border-[#E8DFD3] rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-[#F0E8DD] pb-4">
                <h3 className="font-serif font-bold text-xl text-[#2A211C]">Items in this Order</h3>
                <span className="text-xs text-stone-500 font-sans">{trackingData.total_items} items</span>
              </div>

              <div className="divide-y divide-[#F0E8DD]">
                {trackingData.items_summary.map((item, idx) => (
                  <div key={idx} className="py-4 first:pt-0 last:pb-0 flex items-center gap-4">
                    <img 
                      src={item.image_url || '/logo.svg'} 
                      alt={item.title}
                      className="w-16 h-20 object-cover rounded-xl border border-[#E8DFD3] bg-[#FDFBF7] shrink-0" 
                    />
                    <div className="flex-grow space-y-1">
                      <h4 className="font-serif font-bold text-base text-[#2A211C]">{item.title}</h4>
                      <div className="flex flex-wrap gap-2 text-xs text-stone-500 font-sans">
                        {item.size && <span>Size: {item.size}</span>}
                        {item.size && item.color && <span>•</span>}
                        {item.color && <span>Colour: {item.color}</span>}
                      </div>
                      <p className="text-xs font-mono text-stone-600 font-medium">Quantity: {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DESTINATION SUMMARY & VERIFICATION */}
            <div className="bg-white border border-[#E8DFD3] rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-mono text-[#8C6D53] uppercase tracking-wider block">Shipping Destination</span>
                  <p className="font-sans font-semibold text-base text-[#2A211C]">
                    {verifiedDetails 
                      ? verifiedDetails.full_address 
                      : `Delivering to: ${trackingData.city}, ${trackingData.state} (${trackingData.pincode_masked})`}
                  </p>
                  {!verifiedDetails && (
                    <p className="text-xs text-stone-500">
                      Full street address and contact details are protected for guest security.
                    </p>
                  )}
                </div>

                {!verifiedDetails ? (
                  <button
                    onClick={() => setShowVerifyModal(true)}
                    className="px-5 py-2.5 bg-[#F5EFE6] hover:bg-[#E8DFD3] border border-[#E8DFD3] text-[#2A211C] font-sans text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0"
                  >
                    <Lock className="w-3.5 h-3.5 text-[#8C6D53]" />
                    <span>Verify to View Full Address & Invoice</span>
                  </button>
                ) : (
                  <button
                    onClick={handleDownloadInvoice}
                    className="px-5 py-2.5 bg-[#2A211C] text-[#FDFBF7] hover:bg-[#38322B] font-sans text-xs font-medium rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Official Invoice</span>
                  </button>
                )}
              </div>
            </div>

            {/* ACTIONS & SUPPORT */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
              <Link
                to={`/contact-support?token=${encodeURIComponent(trackingData.tracking_token)}`}
                className="w-full sm:w-auto px-6 py-3.5 border border-[#E8DFD3] bg-white hover:bg-[#FDFBF7] text-[#2A211C] font-sans text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <HelpCircle className="w-4 h-4 text-[#8C6D53]" />
                <span>Need Help with this Order?</span>
              </Link>

              <Link
                to="/shop"
                className="w-full sm:w-auto px-6 py-3.5 bg-[#2A211C] text-[#FDFBF7] hover:bg-[#38322B] font-sans text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Continue Shopping Sa and Sha</span>
              </Link>
            </div>
          </motion.div>
        )}

        {/* 4. VERIFICATION MODAL */}
        <AnimatePresence>
          {showVerifyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-[#E8DFD3] rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl relative"
              >
                <button
                  onClick={() => setShowVerifyModal(false)}
                  className="absolute right-4 top-4 text-stone-400 hover:text-stone-700 p-1"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-[#F5EFE6] flex items-center justify-center text-[#8C6D53]">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="font-serif text-xl font-bold text-[#2A211C]">Verify Customer Identity</h3>
                  <p className="text-xs text-stone-600 font-sans leading-relaxed">
                    To protect your privacy, full address, prices, invoice, and order details require a quick 1-time verification code (OTP).
                  </p>
                </div>

                {otpStep === 'request' ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-stone-700 block">
                        Select Verification Method
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setOtpChannel('mobile')}
                          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                            otpChannel === 'mobile'
                              ? 'bg-[#2A211C] text-[#FDFBF7] border-[#2A211C]'
                              : 'bg-[#FDFBF7] text-stone-700 border-[#E8DFD3] hover:border-[#8C6D53]'
                          }`}
                        >
                          <PhoneCall className="w-4 h-4" />
                          <span>Mobile OTP</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setOtpChannel('email')}
                          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                            otpChannel === 'email'
                              ? 'bg-[#2A211C] text-[#FDFBF7] border-[#2A211C]'
                              : 'bg-[#FDFBF7] text-stone-700 border-[#E8DFD3] hover:border-[#8C6D53]'
                          }`}
                        >
                          <Mail className="w-4 h-4" />
                          <span>Email OTP</span>
                        </button>
                      </div>
                    </div>

                    {verifyError && (
                      <p className="text-xs text-rose-600 font-medium bg-rose-50 p-3 rounded-lg border border-rose-200">
                        {verifyError}
                      </p>
                    )}

                    <div className="pt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowVerifyModal(false)}
                        className="flex-1 py-2.5 border border-[#E8DFD3] hover:bg-[#FDFBF7] rounded-xl text-xs font-semibold text-stone-700 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendOtp()}
                        disabled={isSendingOtp}
                        className="flex-1 py-2.5 bg-[#2A211C] text-[#FDFBF7] hover:bg-[#38322B] rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isSendingOtp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Send OTP Code</span>}
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-stone-700 block">
                        Enter 6-Digit OTP Code
                      </label>
                      <p className="text-xs text-stone-500">
                        Code sent to {maskedDestination || `your registered ${otpChannel}`}.
                      </p>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="e.g. 123456"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full text-center tracking-widest px-4 py-3 bg-[#FDFBF7] border border-[#E8DFD3] rounded-xl text-lg font-mono font-bold text-[#2A211C] focus:outline-none focus:border-[#8C6D53]"
                        autoFocus
                      />
                    </div>

                    {verifyError && (
                      <p className="text-xs text-rose-600 font-medium bg-rose-50 p-3 rounded-lg border border-rose-200">
                        {verifyError}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
                      <button
                        type="button"
                        onClick={() => setOtpStep('request')}
                        className="text-[#8C6D53] hover:underline font-medium"
                      >
                        Change Channel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendOtp()}
                        disabled={isSendingOtp}
                        className="text-[#8C6D53] hover:underline font-medium disabled:opacity-50"
                      >
                        Resend Code
                      </button>
                    </div>

                    <div className="pt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowVerifyModal(false)}
                        className="flex-1 py-2.5 border border-[#E8DFD3] hover:bg-[#FDFBF7] rounded-xl text-xs font-semibold text-stone-700 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isVerifyingOtp}
                        className="flex-1 py-2.5 bg-[#2A211C] text-[#FDFBF7] hover:bg-[#38322B] rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isVerifyingOtp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Verify & Unlock</span>}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};
