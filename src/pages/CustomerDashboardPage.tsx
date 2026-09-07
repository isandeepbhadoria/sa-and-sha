import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  User, Package, Sparkles, Wallet, MapPin, Truck, ShoppingBag, 
  Bell, Clock, ChevronRight, ChevronDown, Loader2, CheckCircle2, AlertCircle, LogOut, 
  RefreshCw, ShieldCheck, ArrowRight, ExternalLink, HelpCircle,
  X, Tag, Eye, MessageSquare, Mail, Award, RotateCcw, Zap, UserPlus, FileText
} from 'lucide-react';

const IndiaFlagIcon = () => (
  <svg className="w-5 h-3.5 rounded-[2px] shrink-0 overflow-hidden border border-stone-200" viewBox="0 0 300 200" aria-label="India flag">
    <rect width="300" height="66.7" fill="#FF9933" />
    <rect y="66.7" width="300" height="66.7" fill="#FFFFFF" />
    <rect y="133.3" width="300" height="66.7" fill="#128807" />
    <circle cx="150" cy="100" r="20" fill="none" stroke="#000080" strokeWidth="3" />
    <circle cx="150" cy="100" r="3" fill="#000080" />
    {Array.from({ length: 24 }).map((_, i) => (
      <line
        key={i}
        x1="150"
        y1="100"
        x2={150 + 20 * Math.cos((i * 15 * Math.PI) / 180)}
        y2={100 + 20 * Math.sin((i * 15 * Math.PI) / 180)}
        stroke="#000080"
        strokeWidth="1.2"
      />
    ))}
  </svg>
);
import { CustomerAddressBookModal } from '../components/CustomerAddressBookModal';
import { Msg91OtpVerification } from '../components/Msg91OtpVerification';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { CustomerSecuritySessionsCard } from '../components/CustomerSecuritySessionsCard';

interface DashboardData {
  success: boolean;
  profile: {
    profile_id: string;
    customer_id: string;
    first_name: string;
    full_name: string;
    email: string;
    phone: string;
    created_at: string;
    member_since: string;
    customer_tier: string;
  };
  commerce_summary: {
    total_orders: number;
    completed_orders: number;
    active_orders: number;
    cancelled_orders: number;
    returned_orders: number;
    lifetime_spend: number;
    average_order_value: number;
  };
  loyalty_summary: {
    tier: string;
    available_points: number;
    pending_points: number;
    lifetime_earned_points: number;
    lifetime_redeemed_points: number;
    rolling_12m_spend_rupees: number;
    tier_progress: {
      current_tier: string;
      next_tier: string | null;
      spend_to_next_tier: number;
      progress_percent: number;
    };
  };
  store_credit_summary: {
    current_balance: number;
    last_activity: {
      type: string;
      amount: number;
      description: string;
      date: string;
    } | null;
  };
  address_summary: {
    total_addresses: number;
    default_address: any | null;
    all_addresses: any[];
  };
  recent_orders: Array<{
    id: string;
    order_number: string;
    order_status: string;
    status_label: string;
    total_amount: number;
    items_count: number;
    created_at: string;
    items: Array<{
      product_id: string;
      name: string;
      quantity: number;
      price: number;
      image: string;
      size?: string;
      color?: string;
    }>;
    tracking_number?: string | null;
    courier_name?: string | null;
  }>;
  notification_summary: {
    recent_notifications: Array<{
      id: string;
      channel: string;
      event_type: string;
      recipient: string;
      status: 'DELIVERED' | 'PENDING' | 'FAILED';
      title: string;
      queued_at: string;
    }>;
  };
  timeline_preview: Array<{
    id: string;
    event_type: string;
    category: string;
    title: string;
    description: string;
    occurred_at: string;
  }>;
  quick_stats: {
    active_orders_count: number;
    completed_orders_count: number;
    available_loyalty_points: number;
    store_credit_balance: number;
    saved_addresses_count: number;
  };
}

export const CustomerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [verificationToken, setVerificationToken] = useState<string>(() => {
    return localStorage.getItem('kora_customer_token') || '';
  });
  const [mobilePhone, setMobilePhone] = useState<string>(() => {
    return localStorage.getItem('kora_customer_phone') || '';
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  // Active view / tabs & modals
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'loyalty' | 'addresses' | 'notifications' | 'timeline'>('overview');
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);

  // Cancellation Modal state
  const [cancelTargetOrder, setCancelTargetOrder] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Changed my mind');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTargetOrder) return;
    setIsCancelling(true);
    try {
      const token = localStorage.getItem("kora_customer_token") || localStorage.getItem("kora_customer_auth_token") || localStorage.getItem("verification_token") || "";
      const orderNum = cancelTargetOrder.order_number || cancelTargetOrder.id;
      const res = await fetch(`/api/customer/orders/${orderNum}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-verification-token": token,
          "x-customer-token": token,
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ reason: cancelReason })
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        alert(resData.error || "Failed to process cancellation request.");
        return;
      }
      alert(resData.message || "Cancellation requested successfully.");
      setCancelTargetOrder(null);
      setSelectedOrderDetails(null);
      fetchDashboard();
    } catch (err) {
      alert("Error processing cancellation request.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleBuyAgain = (items: any[]) => {
    if (!items || items.length === 0) return;
    try {
      const existingCart = JSON.parse(localStorage.getItem('cart') || '[]');
      items.forEach(it => {
        existingCart.push({
          id: it.product_id || it.id || `p_${Date.now()}`,
          name: it.name,
          price: it.price,
          quantity: it.quantity || 1,
          size: it.size || 'M',
          color: it.color || '',
          image: it.image
        });
      });
      localStorage.setItem('cart', JSON.stringify(existingCart));
      window.dispatchEvent(new Event('cartUpdated'));
      navigate('/cart');
    } catch (e) {
      navigate('/shop');
    }
  };

  const handleDownloadDashboardCreditNote = async (order: any) => {
    const token = localStorage.getItem("kora_customer_auth_token") || localStorage.getItem("verification_token") || "";
    const identifier = order.credit_note_id || order.credit_note_number || order.order_number || order.id;
    try {
      const res = await fetch(`/api/customer/orders/${encodeURIComponent(order.order_number || order.id)}/credit-note/pdf`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-verification-token": token
        }
      });
      if (!res.ok) {
        alert("GST Credit Note is not available for this order.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Kora-Linen-Credit-Note-${order.order_number || identifier}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading credit note:", err);
      alert("Failed to download GST Credit Note.");
    }
  };

  // OTP Login step if unauthenticated
  const [loginMobileInput, setLoginMobileInput] = useState('');
  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [activeAuthTarget, setActiveAuthTarget] = useState('');
  const [authMode, setAuthMode] = useState<'mobile' | 'email' | null>(null);
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loginChallenge, setLoginChallenge] = useState<string | null>(null);

  // New Account Registration state (Phase 10: Completely separate Account Creation to /create-account)
  const [authView, setAuthView] = useState<'login' | 'account_setup_required' | 'account_not_found'>('login');
  const [accountSetupTarget, setAccountSetupTarget] = useState<{ channel: 'mobile' | 'email'; identifier: string }>({ channel: 'mobile', identifier: '' });

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    setLoginMobileInput(digitsOnly);
    if (formError) setFormError(null);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginEmailInput(e.target.value);
    if (formError) setFormError(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const mobile = loginMobileInput.trim();
    const email = loginEmailInput.trim().toLowerCase();

    // Rule 1: Both empty
    if (!mobile && !email) {
      setFormError('Enter your mobile number or email address.');
      return;
    }

    // Rule 2: Both filled
    if (mobile && email) {
      setFormError('Please use either your mobile number or email address.');
      return;
    }

    let channel: 'mobile' | 'email' = 'mobile';
    let target = '';

    // Rule 3: Mobile entered
    if (mobile) {
      if (!/^[6-9]\d{9}$/.test(mobile)) {
        setFormError('Please enter a valid 10-digit Indian mobile number.');
        return;
      }
      channel = 'mobile';
      target = mobile;
    } else if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setFormError('Please enter a valid email address.');
        return;
      }
      channel = 'email';
      target = email;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/customer/auth/login-eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, identifier: target })
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error || 'Too many attempts. Please wait a moment and try again.');
        return;
      }

      if (!res.ok) {
        setFormError('We couldn’t check your account right now. Please try again.');
        return;
      }

      const data = await res.json();

      if (data.success && data.eligible && data.loginChallenge) {
        setAuthMode(channel);
        setActiveAuthTarget(channel === 'mobile' ? `+91${target}` : target);
        setLoginChallenge(data.loginChallenge);
        setShowOtpScreen(true);
      } else if (data.eligible === false || data.code === 'ACCOUNT_NOT_FOUND' || data.code === 'ACCOUNT_SETUP_REQUIRED') {
        setAccountSetupTarget({ channel, identifier: target });
        setAuthView('account_not_found');
      } else {
        setFormError('We couldn’t check your account right now. Please try again.');
      }
    } catch (err: any) {
      setFormError('We couldn’t check your account right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (verificationToken) {
      fetchDashboard();
    }
  }, [verificationToken]);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/customer/dashboard', {
        headers: {
          'x-mobile-verification-token': verificationToken,
          'x-verification-token': verificationToken,
          'Authorization': `Bearer ${verificationToken}`
        }
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        if (res.status === 401) {
          // Token expired or invalid
          setVerificationToken('');
          localStorage.removeItem('kora_customer_token');
          setError('Session expired. Please log in with your phone or email to view your customer dashboard.');
        } else {
          setError(resData.error || 'Failed to load dashboard.');
        }
        setData(null);
      } else {
        setData(resData);
      }
    } catch (err: any) {
      setError('Connection error. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('kora_customer_token');
    localStorage.removeItem('kora_customer_phone');
    setVerificationToken('');
    setMobilePhone('');
    setData(null);
  };

  const handleOtpVerified = (verifiedData: { token: string; phone: string }) => {
    const token = verifiedData.token;
    const phone = verifiedData.phone;
    localStorage.setItem('kora_customer_token', token);
    localStorage.setItem('kora_customer_phone', phone);
    setVerificationToken(token);
    setMobilePhone(phone);
    setShowOtpScreen(false);
  };

  // Helper formatting functions
  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amt);
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'N/A';
    try {
      return new Date(isoString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return isoString;
    }
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return 'N/A';
    try {
      return new Date(isoString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const getTierColor = (tier: string) => {
    const t = (tier || '').toLowerCase();
    if (t.includes('gold')) return 'bg-amber-100 text-amber-900 border-amber-300';
    if (t.includes('silver')) return 'bg-slate-200 text-slate-800 border-slate-300';
    if (t.includes('platinum')) return 'bg-sky-100 text-sky-900 border-sky-300';
    if (t.includes('vip')) return 'bg-purple-100 text-purple-900 border-purple-300';
    return 'bg-stone-100 text-stone-800 border-stone-300';
  };

  const getOrderStatusBadge = (status: string, cancellationRequested?: boolean, refundStatus?: string | null) => {
    const s = (status || '').toLowerCase();
    if (cancellationRequested) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-800 border border-amber-200/60">
          <Clock className="w-3.5 h-3.5" /> Cancellation Requested
        </span>
      );
    }
    if (['delivered', 'completed'].includes(s)) {
      return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60"><CheckCircle2 className="w-3.5 h-3.5" /> Delivered</span>;
    }
    if (['cancelled'].includes(s)) {
      return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-rose-50 text-rose-800 border border-rose-200/60"><AlertCircle className="w-3.5 h-3.5" /> Cancelled</span>;
    }
    if (['returned', 'refunded'].includes(s)) {
      return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-800 border border-amber-200/60"><RefreshCw className="w-3.5 h-3.5" /> Refunded</span>;
    }
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-stone-100 text-stone-800 border border-stone-200"><Truck className="w-3.5 h-3.5" /> Active Order</span>;
  };

  // Render Login Card if no token and in login view
  if (!verificationToken && authView === 'login') {
    return (
      <div className="min-h-screen bg-stone-50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-stone-200 p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-stone-100 text-stone-800 mb-3">
              <User className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-serif text-stone-900 tracking-tight">Sa and Sha Customer Portal</h1>
            <p className="mt-2 text-sm text-stone-600 leading-relaxed">
              Access your orders, loyalty rewards, store credit, and delivery addresses in one secure dashboard.
            </p>
          </div>

          {!showOtpScreen ? (
            <form onSubmit={handleFormSubmit} className="space-y-5" noValidate>
              {/* GOOGLE SIGN-IN BUTTON */}
              <GoogleSignInButton
                onSuccess={(res) => {
                  if (res.sessionToken) {
                    localStorage.setItem('kora_customer_token', res.sessionToken);
                    if (res.profile?.email) {
                      localStorage.setItem('kora_customer_email', res.profile.email);
                    }
                    setVerificationToken(res.sessionToken);
                    setShowOtpScreen(false);
                  }
                }}
                onAccountNotFound={(res) => {
                  navigate('/create-account', {
                    state: {
                      source: 'google',
                      email: res.verified_email || '',
                      firstName: res.suggested_first_name || '',
                      lastName: res.suggested_last_name || '',
                      registrationToken: res.registration_token || ''
                    }
                  });
                }}
                onError={(err) => setFormError(err)}
              />

              <div className="relative flex py-1 items-center" aria-hidden="true">
                <div className="flex-grow border-t border-stone-200"></div>
                <span className="shrink mx-3 text-xs font-medium text-stone-400 uppercase tracking-wider">
                  OR MOBILE / EMAIL OTP
                </span>
                <div className="flex-grow border-t border-stone-200"></div>
              </div>

              {/* 1. MOBILE NUMBER FIELD */}
              <div>
                <label 
                  htmlFor="customer-mobile" 
                  className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5"
                >
                  MOBILE NUMBER
                </label>
                <div 
                  className={`flex items-center rounded-xl border bg-white transition-all ${
                    formError && loginMobileInput && !/^[6-9]\d{9}$/.test(loginMobileInput)
                      ? 'border-rose-400 ring-1 ring-rose-400' 
                      : 'border-stone-300 focus-within:border-stone-900 focus-within:ring-2 focus-within:ring-stone-900'
                  }`}
                >
                  {/* Fixed India prefix section */}
                  <div className="flex items-center gap-1.5 px-3 py-3 bg-stone-50/80 border-r border-stone-200 rounded-l-xl text-stone-800 select-none shrink-0">
                    <IndiaFlagIcon />
                    <span className="text-xs font-bold text-stone-900">+91</span>
                    <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
                  </div>

                  {/* Editable mobile input */}
                  <input
                    id="customer-mobile"
                    type="tel"
                    autoComplete="tel"
                    placeholder="Enter your mobile number"
                    value={loginMobileInput}
                    onChange={handleMobileChange}
                    maxLength={10}
                    aria-invalid={!!(formError && loginMobileInput && !/^[6-9]\d{9}$/.test(loginMobileInput))}
                    aria-describedby={formError ? "portal-error-msg" : undefined}
                    className="w-full px-3.5 py-3 rounded-r-xl text-stone-900 text-sm placeholder-stone-400 focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* 2. SEPARATOR */}
              <div className="relative flex py-1 items-center" aria-hidden="true">
                <div className="flex-grow border-t border-stone-200"></div>
                <span className="shrink mx-3 text-xs font-medium text-stone-400 uppercase tracking-wider">
                  OR
                </span>
                <div className="flex-grow border-t border-stone-200"></div>
              </div>

              {/* 3. EMAIL FIELD */}
              <div>
                <label 
                  htmlFor="customer-email" 
                  className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5"
                >
                  EMAIL ID
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 pointer-events-none" />
                  <input
                    id="customer-email"
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your email address"
                    value={loginEmailInput}
                    onChange={handleEmailChange}
                    aria-invalid={!!(formError && loginEmailInput && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmailInput))}
                    aria-describedby={formError ? "portal-error-msg" : undefined}
                    className={`w-full pl-10 pr-4 py-3 rounded-xl border text-stone-900 text-sm placeholder-stone-400 focus:outline-none transition-all ${
                      formError && loginEmailInput && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmailInput)
                        ? 'border-rose-400 ring-1 ring-rose-400' 
                        : 'border-stone-300 focus:ring-2 focus:ring-stone-900'
                    }`}
                  />
                </div>
              </div>

              {/* INLINE ERROR DISPLAY */}
              {formError && (
                <div 
                  id="portal-error-msg"
                  role="alert" 
                  className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span className="font-medium leading-tight">{formError}</span>
                </div>
              )}

              {/* 5. SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 bg-stone-900 text-white rounded-xl font-medium text-sm hover:bg-stone-800 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Verification Code...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Enter Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* 6. SECURITY FOOTER */}
              <div className="pt-2 text-center">
                <p className="text-[11px] text-stone-500 flex items-center justify-center gap-1.5 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                  <span>Protected by Sa and Sha OTP Security</span>
                  <span className="text-stone-300">•</span>
                  <Zap className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                  <span>Instant Access</span>
                </p>
              </div>
            </form>
          ) : authMode === 'mobile' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowOtpScreen(false);
                    setFormError(null);
                  }}
                  className="text-xs text-stone-600 hover:text-stone-900 transition-colors flex items-center gap-1 font-medium cursor-pointer"
                >
                  ← Change Mobile Number
                </button>
              </div>
              <Msg91OtpVerification
                phone={loginMobileInput}
                country="India"
                isVerified={false}
                autoSend={true}
                loginChallenge={loginChallenge || undefined}
                purpose="login"
                onVerified={(verifiedPhone, sessionToken) => {
                  if (sessionToken) {
                    localStorage.setItem('kora_customer_token', sessionToken);
                    localStorage.setItem('kora_customer_phone', verifiedPhone);
                    setMobilePhone(verifiedPhone);
                    setVerificationToken(sessionToken);
                    setShowOtpScreen(false);
                  }
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowOtpScreen(false);
                    setFormError(null);
                  }}
                  className="text-xs text-stone-600 hover:text-stone-900 transition-colors flex items-center gap-1 font-medium cursor-pointer"
                >
                  ← Change Email Address
                </button>
              </div>
              <Msg91OtpVerification
                email={loginEmailInput}
                isVerified={false}
                autoSend={true}
                loginChallenge={loginChallenge || undefined}
                purpose="login"
                onVerified={(verifiedEmail, sessionToken) => {
                  if (sessionToken) {
                    localStorage.setItem('kora_customer_token', sessionToken);
                    localStorage.setItem('kora_customer_email', verifiedEmail);
                    setVerificationToken(sessionToken);
                    setShowOtpScreen(false);
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Account Not Found (Phase 10: Account Creation separated to /create-account)
  if (!verificationToken && (authView === 'account_setup_required' || authView === 'account_not_found')) {
    return (
      <div className="min-h-screen bg-stone-50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 shadow-sm p-6 sm:p-8 space-y-6 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto">
            <UserPlus className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-serif text-stone-900 font-medium">Account not found</h2>
            <p className="text-sm text-stone-600 leading-relaxed">
              We couldn’t find a Sa and Sha customer account for these details. You can create a new account or check the information entered.
            </p>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-700 font-medium font-mono">
            {accountSetupTarget.channel === 'mobile' ? `+91 ${accountSetupTarget.identifier}` : accountSetupTarget.identifier}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setAuthView('login');
                setShowOtpScreen(false);
                setFormError(null);
              }}
              className="flex-1 py-3 px-4 rounded-xl border border-stone-300 text-stone-700 text-sm font-medium hover:bg-stone-50 transition-colors cursor-pointer"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => {
                navigate('/create-account', {
                  state: {
                    source: accountSetupTarget.channel,
                    mobile: accountSetupTarget.channel === 'mobile' ? accountSetupTarget.identifier : '',
                    email: accountSetupTarget.channel === 'email' ? accountSetupTarget.identifier : ''
                  }
                });
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Skeleton / Loading state
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-stone-50 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
          <div className="h-28 bg-white rounded-2xl border border-stone-200 p-6 flex justify-between items-center">
            <div className="space-y-2">
              <div className="h-6 w-48 bg-stone-200 rounded"></div>
              <div className="h-4 w-32 bg-stone-100 rounded"></div>
            </div>
            <div className="h-10 w-24 bg-stone-200 rounded-xl"></div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
                <div className="h-4 w-20 bg-stone-100 rounded"></div>
                <div className="h-6 w-28 bg-stone-200 rounded"></div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-64 bg-white rounded-2xl border border-stone-200 p-6"></div>
              <div className="h-48 bg-white rounded-2xl border border-stone-200 p-6"></div>
            </div>
            <div className="space-y-6">
              <div className="h-48 bg-white rounded-2xl border border-stone-200 p-6"></div>
              <div className="h-48 bg-white rounded-2xl border border-stone-200 p-6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-stone-50 py-12 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-xl font-serif text-stone-900">Unable to load dashboard</h2>
          <p className="text-sm text-stone-600">{error}</p>
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={fetchDashboard}
              className="px-4 py-2.5 bg-stone-900 text-white text-xs font-medium rounded-xl hover:bg-stone-800 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2.5 bg-stone-100 text-stone-700 text-xs font-medium rounded-xl hover:bg-stone-200 transition-colors"
            >
              Log In Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const {
    profile,
    commerce_summary,
    loyalty_summary,
    store_credit_summary,
    address_summary,
    recent_orders,
    notification_summary,
    timeline_preview,
    quick_stats
  } = data;

  return (
    <div className="min-h-screen bg-stone-50/60 pb-16">
      {/* SECTION 1 — DASHBOARD HEADER */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-serif text-stone-900 tracking-tight">
                  Hello, {profile.first_name} 👋
                </h1>
                <span className={`px-3 py-0.5 text-xs font-semibold rounded-full border ${getTierColor(profile.customer_tier)} uppercase tracking-wider`}>
                  {profile.customer_tier} Tier
                </span>
                <span className="px-2.5 py-0.5 text-xs font-mono bg-stone-100 text-stone-700 border border-stone-200 rounded-md">
                  ID: {profile.customer_id}
                </span>
              </div>
              <p className="text-xs text-stone-500 flex items-center gap-2">
                <span>{profile.email || profile.phone}</span>
                <span>•</span>
                <span>{profile.member_since}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchDashboard}
                disabled={loading}
                title="Refresh Dashboard"
                className="p-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <Link
                to="/account/returns"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-stone-200 text-stone-700 bg-white text-xs font-semibold hover:bg-stone-50 transition-colors shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Returns & Exchanges</span>
              </Link>
              <Link
                to="/account/profile"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors shadow-xs"
              >
                <User className="w-3.5 h-3.5" />
                <span>Profile & Security</span>
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* SECTION 2 — SUMMARY CARDS (4-col Desktop / 2-col Mobile) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Orders */}
          <div 
            onClick={() => setActiveTab('orders')}
            className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium tracking-wide text-stone-500 uppercase">Orders</span>
              <div className="p-2 rounded-xl bg-stone-100 text-stone-800 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-serif text-stone-900">
              {quick_stats.active_orders_count > 0 ? (
                <span className="text-amber-800 font-semibold">{quick_stats.active_orders_count} Active</span>
              ) : (
                <span>{quick_stats.completed_orders_count} Completed</span>
              )}
            </div>
            <p className="mt-1 text-xs text-stone-500">
              Total orders: {commerce_summary.total_orders}
            </p>
          </div>

          {/* Card 2: Loyalty Points */}
          <div 
            onClick={() => setActiveTab('loyalty')}
            className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium tracking-wide text-stone-500 uppercase">Kora Rewards</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-serif text-stone-900">
              {loyalty_summary.available_points} <span className="text-xs font-sans text-stone-500">pts</span>
            </div>
            <p className="mt-1 text-xs text-amber-700 font-medium">
              ≈ {formatCurrency(loyalty_summary.available_points)} credit value
            </p>
          </div>

          {/* Card 3: Store Credit */}
          <div 
            onClick={() => setActiveTab('loyalty')}
            className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium tracking-wide text-stone-500 uppercase">Store Credit</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-serif text-stone-900">
              {formatCurrency(store_credit_summary.current_balance)}
            </div>
            <p className="mt-1 text-xs text-stone-500">
              Ready to apply at checkout
            </p>
          </div>

          {/* Card 4: Saved Addresses */}
          <div 
            onClick={() => setIsAddressModalOpen(true)}
            className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium tracking-wide text-stone-500 uppercase">Addresses</span>
              <div className="p-2 rounded-xl bg-sky-50 text-sky-700 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                <MapPin className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-serif text-stone-900">
              {address_summary.total_addresses} <span className="text-xs font-sans text-stone-500">saved</span>
            </div>
            <p className="mt-1 text-xs text-stone-500">
              {address_summary.default_address ? `Default: ${address_summary.default_address.city}` : 'No default set'}
            </p>
          </div>
        </div>

        {/* SECTION 3 — QUICK ACTIONS */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-4 sm:p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
            Quick Actions
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <a
              href="/track-order"
              className="flex items-center gap-2 p-3 rounded-xl border border-stone-100 bg-stone-50/80 text-stone-800 text-xs font-medium hover:bg-stone-900 hover:text-white transition-colors"
            >
              <Truck className="w-4 h-4 shrink-0 text-stone-500" />
              <span>Track Order</span>
            </a>
            <a
              href="/shop"
              className="flex items-center gap-2 p-3 rounded-xl border border-stone-100 bg-stone-50/80 text-stone-800 text-xs font-medium hover:bg-stone-900 hover:text-white transition-colors"
            >
              <ShoppingBag className="w-4 h-4 shrink-0 text-stone-500" />
              <span>Shop Linen</span>
            </a>
            <Link
              to="/account/rewards"
              className="flex items-center gap-2 p-3 rounded-xl border border-stone-100 bg-stone-50/80 text-stone-800 text-xs font-medium hover:bg-stone-900 hover:text-white transition-colors text-left"
            >
              <Sparkles className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Membership Center</span>
            </Link>
            <button
              onClick={() => setIsAddressModalOpen(true)}
              className="flex items-center gap-2 p-3 rounded-xl border border-stone-100 bg-stone-50/80 text-stone-800 text-xs font-medium hover:bg-stone-900 hover:text-white transition-colors text-left"
            >
              <MapPin className="w-4 h-4 shrink-0 text-sky-600" />
              <span>Address Book</span>
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className="flex items-center gap-2 p-3 rounded-xl border border-stone-100 bg-stone-50/80 text-stone-800 text-xs font-medium hover:bg-stone-900 hover:text-white transition-colors text-left"
            >
              <Bell className="w-4 h-4 shrink-0 text-purple-600" />
              <span>Notifications</span>
            </button>
            <a
              href="/contact-support"
              className="flex items-center gap-2 p-3 rounded-xl border border-stone-100 bg-stone-50/80 text-stone-800 text-xs font-medium hover:bg-stone-900 hover:text-white transition-colors"
            >
              <HelpCircle className="w-4 h-4 shrink-0 text-stone-500" />
              <span>Support</span>
            </a>
          </div>
        </div>

        {/* MAIN DASHBOARD CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT / MAIN COLUMN (2 cols on Desktop) */}
          <div className="lg:col-span-2 space-y-8">
            {/* SECTION 4 — RECENT ORDERS */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-5 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-stone-700" />
                  <h2 className="text-lg font-serif text-stone-900">Recent Orders</h2>
                </div>
                <Link to="/account/orders" className="text-xs font-semibold text-amber-900 hover:text-amber-950 underline">
                  View All Orders →
                </Link>
              </div>

              {recent_orders.length === 0 ? (
                <div className="py-12 text-center space-y-3 bg-stone-50/50 rounded-xl border border-dashed border-stone-200">
                  <ShoppingBag className="w-10 h-10 text-stone-400 mx-auto" />
                  <h3 className="text-base font-serif text-stone-800">Your first order starts here</h3>
                  <p className="text-xs text-stone-500 max-w-sm mx-auto">
                    Explore our hand-crafted pure linen collection and begin your timeless wardrobe journey.
                  </p>
                  <a
                    href="/shop"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white text-xs font-medium rounded-xl hover:bg-stone-800 transition-colors shadow-2xs mt-2"
                  >
                    <span>Shop Collection</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <div className="space-y-4">
                  {recent_orders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-4 sm:p-5 rounded-xl border border-stone-200/80 bg-stone-50/40 hover:bg-white hover:border-stone-300 transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-stone-900">#{ord.order_number}</span>
                            {getOrderStatusBadge(ord.order_status, ord.cancellation_requested, ord.refund_status)}
                          </div>
                          <p className="text-xs text-stone-500">{formatDate(ord.created_at)} • {ord.items_count} item(s)</p>
                        </div>
                        <div className="text-right sm:text-right">
                          <span className="text-base font-serif text-stone-900 font-semibold">{formatCurrency(ord.total_amount)}</span>
                        </div>
                      </div>

                      {/* Items Preview */}
                      {ord.items && ord.items.length > 0 && (
                        <div className="flex items-center gap-3 overflow-x-auto py-1">
                          {ord.items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 shrink-0 bg-white p-2 rounded-lg border border-stone-100">
                              {item.image ? (
                                <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded-md" />
                              ) : (
                                <div className="w-10 h-10 bg-stone-100 rounded-md flex items-center justify-center text-stone-400">
                                  <Package className="w-5 h-5" />
                                </div>
                              )}
                              <div className="text-xs">
                                <p className="font-medium text-stone-800 truncate max-w-[140px]">{item.name}</p>
                                <p className="text-stone-500">Qty: {item.quantity} {item.size ? `• ${item.size}` : ''}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                        {ord.can_cancel && (
                          <button
                            onClick={() => setCancelTargetOrder(ord)}
                            className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-medium transition-colors flex items-center gap-1.5"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Cancel Order</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedOrderDetails(ord)}
                          className="px-3 py-1.5 rounded-lg border border-stone-200 text-stone-700 text-xs font-medium hover:bg-stone-100 transition-colors flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </button>
                        <a
                          href={`/track-order?orderId=${ord.order_number}`}
                          className="px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 transition-colors flex items-center gap-1.5"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Track</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 7 — DEFAULT ADDRESS BOOK */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-sky-700" />
                  <h2 className="text-lg font-serif text-stone-900">Delivery Addresses</h2>
                </div>
                <button
                  onClick={() => setIsAddressModalOpen(true)}
                  className="text-xs font-medium text-stone-900 hover:underline flex items-center gap-1"
                >
                  <span>Manage Address Book</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {address_summary.default_address ? (
                <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-stone-900 text-white">
                      {address_summary.default_address.label || 'Home'} (Default)
                    </span>
                    <span className="text-xs text-stone-500">{address_summary.default_address.phone}</span>
                  </div>
                  <p className="text-sm font-semibold text-stone-900">{address_summary.default_address.recipient_name}</p>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    {address_summary.default_address.address_line_1}
                    {address_summary.default_address.address_line_2 && `, ${address_summary.default_address.address_line_2}`}
                    {address_summary.default_address.landmark && ` (Near ${address_summary.default_address.landmark})`}
                    <br />
                    {address_summary.default_address.city}, {address_summary.default_address.state} - {address_summary.default_address.postal_code}, {address_summary.default_address.country}
                  </p>
                </div>
              ) : (
                <div className="p-6 text-center border border-dashed border-stone-200 rounded-xl space-y-3">
                  <p className="text-xs text-stone-500">No saved default delivery address.</p>
                  <button
                    onClick={() => setIsAddressModalOpen(true)}
                    className="px-4 py-2 bg-stone-900 text-white text-xs font-medium rounded-xl hover:bg-stone-800 transition-colors"
                  >
                    Add Delivery Address
                  </button>
                </div>
              )}
            </div>

            {/* SECTION 8 — NOTIFICATION PREVIEW */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-purple-700" />
                  <h2 className="text-lg font-serif text-stone-900">Recent Notifications</h2>
                </div>
                <span className="text-xs text-stone-500">Email & WhatsApp</span>
              </div>

              {notification_summary.recent_notifications.length === 0 ? (
                <p className="text-xs text-stone-500 py-4 text-center">No recent notification history.</p>
              ) : (
                <div className="divide-y divide-stone-100">
                  {notification_summary.recent_notifications.map((n) => (
                    <div key={n.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg mt-0.5 ${n.channel === 'WHATSAPP' ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700'}`}>
                          {n.channel === 'WHATSAPP' ? <MessageSquare className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-stone-800">{n.title}</p>
                          <p className="text-[11px] text-stone-500">{n.recipient} • {formatDateTime(n.queued_at)}</p>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                        n.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                        n.status === 'PENDING' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                        'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        {n.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 10 — CUSTOMER SECURITY & SESSIONS */}
            <CustomerSecuritySessionsCard 
              token={verificationToken} 
              onLogout={handleLogout} 
            />
          </div>

          {/* RIGHT / SECONDARY COLUMN (1 col on Desktop) */}
          <div className="space-y-8">
            {/* SECTION 5 — LOYALTY PREVIEW */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-700" />
                  <h2 className="text-lg font-serif text-stone-900">Loyalty Status</h2>
                </div>
                <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${getTierColor(loyalty_summary.tier)}`}>
                  {loyalty_summary.tier}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100 space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-stone-600">Available Points</span>
                  <span className="text-2xl font-serif text-stone-900 font-bold">{loyalty_summary.available_points}</span>
                </div>
                {loyalty_summary.pending_points > 0 && (
                  <p className="text-xs text-amber-800">
                    + {loyalty_summary.pending_points} pending delivery hold
                  </p>
                )}
              </div>

              {/* Progress Bar */}
              {loyalty_summary.tier_progress.next_tier ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-stone-600">
                    <span>Progress to {loyalty_summary.tier_progress.next_tier}</span>
                    <span className="font-medium text-stone-900">{formatCurrency(loyalty_summary.tier_progress.spend_to_next_tier)} needed</span>
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-stone-900 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(5, loyalty_summary.tier_progress.progress_percent))}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-purple-50 text-purple-900 text-xs rounded-xl border border-purple-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 text-purple-600" />
                  <span>Maximum Tier Reached! You enjoy top VIP perks.</span>
                </div>
              )}
            </div>

            {/* SECTION 6 — STORE CREDIT PREVIEW */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-700" />
                  <h2 className="text-lg font-serif text-stone-900">Store Credit Wallet</h2>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-1">
                <span className="text-xs text-stone-600">Current Balance</span>
                <div className="text-2xl font-serif text-stone-900 font-bold">
                  {formatCurrency(store_credit_summary.current_balance)}
                </div>
              </div>

              {store_credit_summary.last_activity ? (
                <div className="text-xs text-stone-600 space-y-1 p-3 bg-stone-50 rounded-xl">
                  <span className="font-semibold text-stone-800">Last Activity:</span>
                  <p>{store_credit_summary.last_activity.description}</p>
                  <p className="text-[10px] text-stone-400">{formatDateTime(store_credit_summary.last_activity.date)}</p>
                </div>
              ) : (
                <p className="text-xs text-stone-500">No store credit adjustments.</p>
              )}
            </div>

            {/* SECTION 9 — CUSTOMER TIMELINE PREVIEW */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-stone-700" />
                  <h2 className="text-lg font-serif text-stone-900">Activity Timeline</h2>
                </div>
              </div>

              {timeline_preview.length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-4">No recent activity logged.</p>
              ) : (
                <div className="relative pl-4 space-y-4 border-l-2 border-stone-200">
                  {timeline_preview.map((evt) => (
                    <div key={evt.id} className="relative space-y-0.5">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-stone-900 border-2 border-white ring-2 ring-stone-100" />
                      <p className="text-xs font-semibold text-stone-900">{evt.title}</p>
                      {evt.description && <p className="text-[11px] text-stone-600">{evt.description}</p>}
                      <p className="text-[10px] text-stone-400">{formatDate(evt.occurred_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ADDRESS BOOK MODAL */}
      <CustomerAddressBookModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        verificationToken={verificationToken}
        mobile={profile.phone || mobilePhone}
        addresses={address_summary.all_addresses || []}
        onSelectAddress={() => {}}
        onAddressesUpdated={() => fetchDashboard()}
      />

      {/* ORDER DETAILS MODAL */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-lg font-serif text-stone-900">Order #{selectedOrderDetails.order_number}</h3>
                <p className="text-xs text-stone-500">Placed on {formatDate(selectedOrderDetails.created_at)}</p>
              </div>
              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-stone-500">Status:</span>
                <span className="font-semibold">{selectedOrderDetails.status_label}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-stone-500">Total Amount:</span>
                <span className="font-serif font-bold text-stone-900">{formatCurrency(selectedOrderDetails.total_amount)}</span>
              </div>

              <div className="pt-3 border-t border-stone-100 space-y-2">
                <p className="text-xs font-semibold text-stone-800">Order Items ({selectedOrderDetails.items_count})</p>
                {selectedOrderDetails.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between gap-3 p-2.5 bg-stone-50 rounded-xl text-xs">
                    <div className="flex items-center gap-3">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded-md" />
                      ) : (
                        <div className="w-10 h-10 bg-stone-200 rounded-md flex items-center justify-center text-stone-500">
                          <Package className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-stone-900">{item.name}</p>
                        <p className="text-stone-500">Qty: {item.quantity} {item.size ? `• Size ${item.size}` : ''}</p>
                      </div>
                    </div>
                    <span className="font-semibold text-stone-900">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-stone-200 flex flex-wrap justify-end items-center gap-2">
              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="px-3.5 py-2 bg-stone-100 text-stone-700 text-xs font-medium rounded-xl hover:bg-stone-200 transition-colors"
              >
                Close
              </button>

              {selectedOrderDetails.can_cancel && (
                <button
                  onClick={() => setCancelTargetOrder(selectedOrderDetails)}
                  className="px-3.5 py-2 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-medium rounded-xl hover:bg-rose-100 transition-colors flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel Order</span>
                </button>
              )}

              {(selectedOrderDetails.tax_invoice_finalized || selectedOrderDetails.invoice_url) && (
                <a
                  href={selectedOrderDetails.invoice_url || `/api/customer/orders/${selectedOrderDetails.order_number}/invoice`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-stone-100 text-stone-800 border border-stone-300 text-xs font-medium rounded-xl hover:bg-stone-200 transition-colors flex items-center gap-1.5"
                >
                  <span>Tax Invoice</span>
                </a>
              )}

              {(selectedOrderDetails.has_credit_note || selectedOrderDetails.credit_note_number || selectedOrderDetails.credit_notes?.length > 0) && (
                <button
                  onClick={() => handleDownloadDashboardCreditNote(selectedOrderDetails)}
                  className="px-3.5 py-2 bg-emerald-50 text-emerald-900 border border-emerald-300 text-xs font-medium rounded-xl hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-700" />
                  <span>GST Credit Note</span>
                </button>
              )}

              <button
                onClick={() => handleBuyAgain(selectedOrderDetails.items)}
                className="px-3.5 py-2 bg-amber-50 text-amber-900 border border-amber-300 text-xs font-medium rounded-xl hover:bg-amber-100 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Buy Again</span>
              </button>

              {(selectedOrderDetails.can_return || selectedOrderDetails.eligible) ? (
                <Link
                  to={`/returns-exchanges?orderNumber=${selectedOrderDetails.order_number}`}
                  className="px-3.5 py-2 bg-stone-800 text-white text-xs font-medium rounded-xl hover:bg-stone-700 transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Return / Exchange</span>
                </Link>
              ) : selectedOrderDetails.is_delivered && selectedOrderDetails.is_expired ? (
                <span className="px-3 py-1.5 bg-stone-100 text-stone-500 text-xs font-medium rounded-xl border border-stone-200">
                  Return Window Closed
                </span>
              ) : null}

              <a
                href={`/track-order?orderId=${selectedOrderDetails.order_number}`}
                className="px-3.5 py-2 bg-stone-900 text-white text-xs font-medium rounded-xl hover:bg-stone-800 transition-colors inline-flex items-center gap-1.5"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Track Live Status</span>
              </a>

              <a
                href="/contact-support"
                className="px-3.5 py-2 text-stone-600 hover:text-stone-900 text-xs font-medium transition-colors flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Need Help?</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL ORDER REASON MODAL */}
      {cancelTargetOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-base font-serif text-stone-900 font-semibold">
                Cancel Order #{cancelTargetOrder.order_number}
              </h3>
              <button
                onClick={() => setCancelTargetOrder(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <p className="text-xs text-stone-600">
                Please select or enter the reason for cancelling your order. If prepaid, your refund will be processed upon admin approval.
              </p>

              <div className="space-y-2">
                <label className="text-xs font-medium text-stone-700">Reason for Cancellation</label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-stone-900 bg-white"
                >
                  <option value="Changed my mind">Changed my mind</option>
                  <option value="Ordered by mistake">Ordered by mistake</option>
                  <option value="Delivery time too long">Delivery time too long</option>
                  <option value="Found a better price">Found a better price</option>
                  <option value="Incorrect shipping address or size">Incorrect shipping address or size</option>
                  <option value="Other">Other reason</option>
                </select>
              </div>

              <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancelTargetOrder(null)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 text-xs font-medium rounded-xl hover:bg-stone-200 transition-colors"
                >
                  Keep Order
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="px-4 py-2 bg-rose-600 text-white text-xs font-medium rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Confirm Cancellation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
