import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  RotateCcw, 
  RefreshCw, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  ArrowLeft, 
  Lock, 
  Upload, 
  Image as ImageIcon, 
  Truck, 
  Info, 
  Search, 
  Calendar, 
  HelpCircle,
  FileText,
  X
} from 'lucide-react';
import { useSEO } from '../hooks/useSEO';
import { RETURNS_CONFIG } from '../config/returnsConfig';
import { ReturnActionType } from '../types/returns';

interface OrderItem {
  product_id: string;
  sku?: string;
  name: string;
  size: string;
  color?: string;
  quantity: number;
  price: number;
  image?: string;
  eligible?: boolean;
  ineligibility_reason?: string;
  active_request_id?: string;
  active_request_status?: string;
}

interface OrderRecord {
  order_id: string;
  created_at: string;
  status: string;
  grand_total: number;
  items_count: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address_masked?: any;
  eligible: boolean;
  eligibility_reason?: string;
  window_days: number;
  items: OrderItem[];
}

interface SelectedItemConfig {
  item: OrderItem;
  action: ReturnActionType;
  requested_size?: string;
  reason: string;
  reason_notes: string;
  evidence_images: string[];
}

export const ReturnsExchangesPage: React.FC = () => {
  useSEO({
    title: 'Returns & Exchanges | Sa and Sha',
    description: 'Request a return or size exchange for your Sa and Sha order.',
    noindex: false
  });

  // Step flow state: 'lookup' | 'verify_otp' | 'order_list' | 'order_details' | 'review' | 'success'
  const [currentStep, setCurrentStep] = useState<'lookup' | 'verify_otp' | 'order_list' | 'order_details' | 'review' | 'success'>('lookup');

  // Lookup Form Inputs
  const [orderIdInput, setOrderIdInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // OTP Verification State
  const [otpTarget, setOtpTarget] = useState('');
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [debugOtp, setDebugOtp] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpMessage, setOtpMessage] = useState('');

  // Orders State
  const [ordersList, setOrdersList] = useState<OrderRecord[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

  // Selected Items to Return/Exchange in selected order
  // Key: product_id + '_' + original_size
  const [configuredItems, setConfiguredItems] = useState<Record<string, SelectedItemConfig>>({});

  // Exchange Size Availability State
  // Key: product_id -> array of size objects
  const [sizeOptions, setSizeOptions] = useState<Record<string, Array<{ size: string; inStock: boolean }>>>({});
  const [isLoadingSizes, setIsLoadingSizes] = useState<Record<string, boolean>>({});

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedResponse, setSubmittedResponse] = useState<any | null>(null);

  // 1. Handle Lookup Submit
  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError('');

    const cleanOrderId = orderIdInput.trim();
    const cleanEmail = emailInput.trim();
    const cleanPhone = phoneInput.trim();

    if (!cleanOrderId && !cleanEmail && !cleanPhone) {
      setLookupError('Please enter your Order ID, Email address, or Mobile number.');
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch('/api/returns/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: cleanOrderId,
          email: cleanEmail,
          phone: cleanPhone,
          verificationToken
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setLookupError(data.error || 'No matching order found. Please verify your details.');
        setIsSearching(false);
        return;
      }

      // If server requires security OTP verification before showing history:
      if (data.requiresVerification) {
        setOtpTarget(cleanEmail || cleanPhone);
        // Automatically request OTP
        await triggerSendOtp(cleanEmail || cleanPhone);
        setCurrentStep('verify_otp');
        setIsSearching(false);
        return;
      }

      // Success with orders list
      setOrdersList(data.orders || []);
      if (data.orders && data.orders.length === 1) {
        setSelectedOrder(data.orders[0]);
        setCurrentStep('order_details');
      } else {
        setCurrentStep('order_list');
      }

    } catch (err) {
      setLookupError('Unable to connect to service. Please check your connection and try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Trigger Send OTP
  const triggerSendOtp = async (target: string) => {
    setOtpError('');
    setOtpMessage('');
    try {
      const res = await fetch('/api/returns/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: target.includes('@') ? target : undefined,
          phone: !target.includes('@') ? target : undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        setOtpMessage(data.message);
        if (data.debugOtp) {
          setDebugOtp(data.debugOtp);
        }
      } else {
        setOtpError(data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      setOtpError('Failed to send verification code.');
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    if (!otpCodeInput.trim()) {
      setOtpError('Please enter the 6-digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);

    try {
      const res = await fetch('/api/returns/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: otpTarget,
          otp: otpCodeInput.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setOtpError(data.error || 'Invalid verification code.');
        setIsVerifyingOtp(false);
        return;
      }

      setVerificationToken(data.verificationToken);

      // Re-run lookup with verification token!
      const lookupRes = await fetch('/api/returns/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderIdInput.trim(),
          email: emailInput.trim(),
          phone: phoneInput.trim(),
          verificationToken: data.verificationToken
        })
      });

      const lookupData = await lookupRes.json();
      if (lookupData.success) {
        setOrdersList(lookupData.orders || []);
        if (lookupData.orders && lookupData.orders.length === 1) {
          setSelectedOrder(lookupData.orders[0]);
          setCurrentStep('order_details');
        } else {
          setCurrentStep('order_list');
        }
      } else {
        setLookupError(lookupData.error || 'Could not retrieve orders.');
        setCurrentStep('lookup');
      }

    } catch (err) {
      setOtpError('Verification failed. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Load Sizes for Exchange Item
  const loadAvailableSizes = async (item: OrderItem) => {
    const key = item.product_id;
    if (sizeOptions[key]) return; // already cached

    setIsLoadingSizes(prev => ({ ...prev, [key]: true }));

    try {
      const res = await fetch(`/api/returns/available-sizes?productId=${item.product_id}&currentSize=${item.size}`);
      const data = await res.json();
      if (data.success) {
        setSizeOptions(prev => ({ ...prev, [key]: data.sizes || [] }));
      }
    } catch (err) {
      console.warn('Failed to load size availability:', err);
    } finally {
      setIsLoadingSizes(prev => ({ ...prev, [key]: false }));
    }
  };

  // Toggle Item Selection & Configuration
  const handleToggleItemSelection = (item: OrderItem) => {
    const itemKey = `${item.product_id}_${item.size}`;

    if (configuredItems[itemKey]) {
      // Remove selection
      const next = { ...configuredItems };
      delete next[itemKey];
      setConfiguredItems(next);
    } else {
      // Add default as Exchange
      loadAvailableSizes(item);
      setConfiguredItems(prev => ({
        ...prev,
        [itemKey]: {
          item,
          action: 'exchange',
          requested_size: '',
          reason: RETURNS_CONFIG.EXCHANGE_REASONS[0],
          reason_notes: '',
          evidence_images: []
        }
      }));
    }
  };

  // Update Config for Selected Item
  const updateItemConfig = (itemKey: string, updates: Partial<SelectedItemConfig>) => {
    setConfiguredItems(prev => {
      const existing = prev[itemKey];
      if (!existing) return prev;
      const updated = { ...existing, ...updates };

      // Switch default reason when changing action
      if (updates.action && updates.action !== existing.action) {
        if (updates.action === 'exchange') {
          updated.reason = RETURNS_CONFIG.EXCHANGE_REASONS[0];
          loadAvailableSizes(existing.item);
        } else {
          updated.reason = RETURNS_CONFIG.RETURN_REASONS[0];
        }
      }

      return { ...prev, [itemKey]: updated };
    });
  };

  // Calculate Request Totals
  const selectedConfigList: SelectedItemConfig[] = Object.values(configuredItems);
  const hasReturnItem = selectedConfigList.some((c: SelectedItemConfig) => c.action === 'return');
  const returnShippingFee = hasReturnItem ? RETURNS_CONFIG.RETURN_SHIPPING_FEE : 0;
  const exchangeFee = 0;

  const totalReturnItemValue = selectedConfigList.reduce((acc: number, curr: SelectedItemConfig) => {
    if (curr.action === 'return') {
      return acc + (curr.item.price * curr.item.quantity);
    }
    return acc;
  }, 0);

  const estimatedRefundTotal = Math.max(0, totalReturnItemValue - returnShippingFee);

  // Validate Review Step Before Submit
  const handleProceedToReview = () => {
    if (selectedConfigList.length === 0) {
      alert('Please select at least one item to return or exchange.');
      return;
    }

    // Check exchange sizes chosen
    for (const conf of selectedConfigList) {
      if (conf.action === 'exchange' && !conf.requested_size) {
        alert(`Please select an exchange size for "${conf.item.name}".`);
        return;
      }
    }

    setCurrentStep('review');
  };

  // Handle Final Submit
  const handleSubmitRequest = async () => {
    if (!selectedOrder) return;
    setIsSubmitting(true);

    try {
      const itemsPayload = selectedConfigList.map(c => ({
        product_id: c.item.product_id,
        name: c.item.name,
        original_size: c.item.size,
        requested_size: c.action === 'exchange' ? c.requested_size : undefined,
        color: c.item.color,
        quantity: c.item.quantity,
        price_paid: c.item.price,
        action: c.action,
        reason: c.reason,
        reason_notes: c.reason_notes,
        evidence_images: c.evidence_images
      }));

      const response = await fetch('/api/returns/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.order_id,
          customerEmail: selectedOrder.customer_email,
          customerPhone: selectedOrder.customer_phone,
          customerName: selectedOrder.customer_name,
          items: itemsPayload,
          shippingAddress: selectedOrder.shipping_address_masked
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(data.error || 'We couldn\'t submit your request. Please try again.');
        setIsSubmitting(false);
        return;
      }

      setSubmittedResponse(data);
      setCurrentStep('success');

    } catch (err) {
      alert('Failed to submit request. Please check your network connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2A211C] font-sans pt-6 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">

        {/* BREADCRUMBS */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs font-medium text-stone-500">
          <Link to="/" className="hover:text-[#B08D57] transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3 text-stone-400" />
          <span className="text-stone-900 font-semibold">Returns & Exchanges</span>
        </nav>

        {/* HEADER TITLE */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-[#F2ECE4] rounded-full text-[#B08D57] mb-3">
            <RotateCcw className="w-6 h-6" />
          </div>
          <h1 id="returns-page-title" className="font-serif text-3xl sm:text-4xl font-bold text-[#2A211C] tracking-tight mb-2">
            Returns & Exchanges
          </h1>
          <p className="text-stone-600 text-sm max-w-lg mx-auto">
            {currentStep === 'lookup' && "Enter your order details to find eligible items for return or exchange."}
            {currentStep === 'verify_otp' && "Security Verification: Please verify your identity to view order details."}
            {currentStep === 'order_list' && "Select an order to initiate a size exchange or return."}
            {currentStep === 'order_details' && "Select individual items in your order to request a return or exchange."}
            {currentStep === 'review' && "Review your request details before submitting."}
            {currentStep === 'success' && "Your request has been logged successfully."}
          </p>
        </div>

        {/* STEP 1: LOOKUP FORM */}
        {currentStep === 'lookup' && (
          <div className="bg-white rounded-2xl border border-[#E5D2BC]/25 shadow-sm p-6 sm:p-10 max-w-xl mx-auto animate-fade-in">
            <form onSubmit={handleLookupSubmit} className="space-y-6">
              
              {lookupError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>{lookupError}</div>
                </div>
              )}

              <div className="space-y-4">
                {/* ORDER ID */}
                <div>
                  <label htmlFor="lookup-order-id" className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                    Order ID
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                    <input
                      id="lookup-order-id"
                      type="text"
                      placeholder="e.g. SS102548"
                      value={orderIdInput}
                      onChange={(e) => setOrderIdInput(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 text-sm bg-stone-50 text-[#2A211C] focus:outline-none focus:ring-2 focus:ring-[#B08D57]/20 focus:border-[#B08D57] transition-all font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1">Found in your order confirmation SMS / Email.</p>
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-stone-200"></div>
                  <span className="flex-shrink mx-4 text-stone-400 text-[10px] font-bold uppercase tracking-widest">OR</span>
                  <div className="flex-grow border-t border-stone-200"></div>
                </div>

                {/* EMAIL ADDRESS */}
                <div>
                  <label htmlFor="lookup-email" className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="lookup-email"
                    type="email"
                    placeholder="e.g. customer@gmail.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm bg-stone-50 text-[#2A211C] focus:outline-none focus:ring-2 focus:ring-[#B08D57]/20 focus:border-[#B08D57] transition-all"
                  />
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-stone-200"></div>
                  <span className="flex-shrink mx-4 text-stone-400 text-[10px] font-bold uppercase tracking-widest">OR</span>
                  <div className="flex-grow border-t border-stone-200"></div>
                </div>

                {/* MOBILE NUMBER */}
                <div>
                  <label htmlFor="lookup-phone" className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                    Mobile Number
                  </label>
                  <input
                    id="lookup-phone"
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm bg-stone-50 text-[#2A211C] focus:outline-none focus:ring-2 focus:ring-[#B08D57]/20 focus:border-[#B08D57] transition-all"
                  />
                </div>
              </div>

              {/* SECURITY NOTE */}
              <div className="p-3.5 bg-amber-50/60 border border-amber-200/60 rounded-xl text-amber-900 text-[11px] flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Your order privacy is protected. Verification is required before order records are revealed.</span>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={isSearching}
                className="w-full py-3.5 bg-[#2A211C] hover:bg-[#332c24] text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSearching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Finding your orders...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>FIND MY ORDERS</span>
                  </>
                )}
              </button>

              {/* POLICY SUMMARY BOX */}
              <div className="pt-4 border-t border-stone-100 text-[11px] text-stone-500 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-stone-700">
                  <Info className="w-3.5 h-3.5 text-[#B08D57]" />
                  <span>Sa and Sha Policy Snapshot:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li><strong>Free Size Exchange:</strong> ₹0 exchange fee for a different size of the same item.</li>
                  <li><strong>Returns:</strong> Fixed ₹100 return shipping charge per return pickup request.</li>
                  <li><strong>Window:</strong> Requests accepted within {RETURNS_CONFIG.RETURN_EXCHANGE_WINDOW_DAYS} days of delivery.</li>
                </ul>
              </div>

            </form>
          </div>
        )}

        {/* STEP 2: OTP VERIFICATION CHALLENGE */}
        {currentStep === 'verify_otp' && (
          <div className="bg-white rounded-2xl border border-[#E5D2BC]/25 shadow-sm p-6 sm:p-10 max-w-md mx-auto animate-fade-in text-center space-y-6">
            <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto text-[#B08D57]">
              <Lock className="w-6 h-6" />
            </div>

            <div>
              <h2 className="font-serif text-xl font-bold text-[#2A211C] mb-1">Verify Customer Identity</h2>
              <p className="text-xs text-stone-500">
                To protect privacy, we sent a 6-digit verification code to:
              </p>
              <p className="text-sm font-mono font-bold text-[#2A211C] mt-1">{otpTarget}</p>
            </div>

            {otpError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium">
                {otpError}
              </div>
            )}

            {otpMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium">
                {otpMessage}
              </div>
            )}

            {/* PREVIEW DEMO TEST CODE BANNER */}
            {debugOtp && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs text-left">
                <span className="font-bold block">Preview Test Verification Code:</span>
                <span className="font-mono text-base font-bold tracking-widest text-[#B08D57]">{debugOtp}</span>
                <span className="block text-[10px] text-amber-700 mt-0.5">Enter code above or 123456 to verify.</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="0 0 0 0 0 0"
                  value={otpCodeInput}
                  onChange={(e) => setOtpCodeInput(e.target.value)}
                  className="w-full text-center text-xl font-mono tracking-widest py-3 rounded-xl border border-stone-200 bg-stone-50 text-[#2A211C] focus:outline-none focus:border-[#B08D57]"
                />
              </div>

              <button
                type="submit"
                disabled={isVerifyingOtp}
                className="w-full py-3.5 bg-[#2A211C] hover:bg-[#332c24] text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer disabled:opacity-60"
              >
                {isVerifyingOtp ? 'Verifying...' : 'VERIFY & VIEW ORDERS'}
              </button>

              <div className="flex justify-between items-center text-xs pt-2">
                <button
                  type="button"
                  onClick={() => triggerSendOtp(otpTarget)}
                  className="text-[#B08D57] hover:underline font-semibold cursor-pointer"
                >
                  Resend OTP Code
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('lookup')}
                  className="text-stone-500 hover:text-stone-800 font-medium cursor-pointer"
                >
                  Change Email / Mobile
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 3: ORDER CARDS LIST */}
        {currentStep === 'order_list' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-bold text-[#2A211C]">Your Verified Orders ({ordersList.length})</h2>
              <button
                onClick={() => setCurrentStep('lookup')}
                className="text-xs font-bold text-[#B08D57] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Search Different Order</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {ordersList.map((order) => (
                <div 
                  key={order.order_id} 
                  className="bg-white rounded-2xl border border-[#E5D2BC]/25 p-5 shadow-sm hover:border-[#B08D57]/40 transition-all space-y-4"
                >
                  {/* CARD TOP BAR */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-[#2A211C]">{order.order_id}</span>
                      <span className="text-xs text-stone-500 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        order.eligible 
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {order.eligible ? 'Eligible for Return / Exchange' : 'Not Eligible'}
                      </span>

                      <span className="text-sm font-serif font-bold text-[#2A211C]">
                        ₹{Number(order.grand_total).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* THUMBNAILS & ITEMS COUNT */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-x-auto py-1">
                      {order.items.map((it, idx) => (
                        <div key={idx} className="w-12 h-14 rounded-lg bg-stone-100 border border-stone-200 overflow-hidden relative shrink-0">
                          {it.image ? (
                            <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-400">
                              <ImageIcon className="w-4 h-4" />
                            </div>
                          )}
                          <span className="absolute bottom-0 right-0 bg-[#2A211C] text-white text-[9px] font-bold px-1 rounded-tl">
                            {it.size}
                          </span>
                        </div>
                      ))}
                      <span className="text-xs text-stone-500 ml-2 font-medium">
                        {order.items_count} {order.items_count === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedOrder(order);
                        setCurrentStep('order_details');
                      }}
                      className="px-4 py-2 bg-[#2A211C] hover:bg-[#332c24] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shrink-0 cursor-pointer"
                    >
                      SELECT ORDER
                    </button>
                  </div>

                  {!order.eligible && order.eligibility_reason && (
                    <p className="text-[11px] text-amber-700 bg-amber-50/70 p-2.5 rounded-lg border border-amber-200/50">
                      Reason: {order.eligibility_reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: ORDER DETAILS & ITEM CONFIGURATION */}
        {currentStep === 'order_details' && selectedOrder && (
          <div className="space-y-8 animate-fade-in">
            {/* TOP BAR */}
            <div className="bg-white rounded-2xl border border-[#E5D2BC]/25 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <button
                  onClick={() => setCurrentStep(ordersList.length > 1 ? 'order_list' : 'lookup')}
                  className="text-xs font-bold text-[#B08D57] hover:underline flex items-center gap-1 cursor-pointer mb-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Orders</span>
                </button>
                <div className="flex items-center gap-3">
                  <h2 className="font-serif text-xl font-bold text-[#2A211C]">Order #{selectedOrder.order_id}</h2>
                  <span className="text-xs text-stone-500">
                    Placed on {new Date(selectedOrder.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-stone-500 block">Total Paid</span>
                <span className="font-serif text-lg font-bold text-[#2A211C]">₹{Number(selectedOrder.grand_total).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* ITEMS LIST HEADER */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
                Select Items to Return or Exchange
              </h3>

              <div className="space-y-4">
                {selectedOrder.items.map((item) => {
                  const itemKey = `${item.product_id}_${item.size}`;
                  const isSelected = !!configuredItems[itemKey];
                  const itemConfig = configuredItems[itemKey];

                  return (
                    <div 
                      key={itemKey}
                      className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                        isSelected 
                          ? 'border-[#B08D57] shadow-md ring-1 ring-[#B08D57]/30' 
                          : 'border-[#E5D2BC]/25 shadow-sm'
                      }`}
                    >
                      {/* ITEM ROW HEADER */}
                      <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          {/* THUMBNAIL */}
                          <div className="w-16 h-20 rounded-xl bg-stone-100 border border-stone-200 overflow-hidden shrink-0">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-400">
                                <ImageIcon className="w-6 h-6" />
                              </div>
                            )}
                          </div>

                          {/* DETAILS */}
                          <div className="space-y-1">
                            <h4 className="font-serif font-bold text-sm text-[#2A211C]">{item.name}</h4>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                              <span>Purchased Size: <strong className="text-[#2A211C] font-mono">{item.size}</strong></span>
                              {item.color && (
                                <>
                                  <span className="text-stone-300">•</span>
                                  <span>Color: <strong className="text-[#2A211C]">{item.color}</strong></span>
                                </>
                              )}
                              <span className="text-stone-300">•</span>
                              <span>Qty: <strong className="text-[#2A211C]">{item.quantity}</strong></span>
                            </div>
                            <div className="font-serif font-bold text-sm text-[#2A211C]">
                              ₹{Number(item.price).toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>

                        {/* ELIGIBILITY & ACTION BUTTON */}
                        <div className="w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 border-stone-100 pt-3 sm:pt-0">
                          {item.eligible ? (
                            <button
                              type="button"
                              onClick={() => handleToggleItemSelection(item)}
                              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                                isSelected
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                                  : 'bg-[#2A211C] hover:bg-[#332c24] text-white shadow-sm'
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <X className="w-3.5 h-3.5" />
                                  <span>REMOVE ITEM</span>
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>RETURN / EXCHANGE</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <div className="text-right">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 inline-block">
                                Not Eligible
                              </span>
                              {item.ineligibility_reason && (
                                <p className="text-[10px] text-stone-400 mt-1 max-w-xs">{item.ineligibility_reason}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ITEM CONFIGURATION EXPANDED PANEL */}
                      {isSelected && itemConfig && (
                        <div className="bg-[#FAF8F5] border-t border-[#E5D2BC]/20 p-5 space-y-5 animate-fade-in">
                          
                          {/* ACTION SELECTOR: EXCHANGE vs RETURN */}
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                              What would you like to do with this item?
                            </label>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* EXCHANGE OPTION */}
                              <button
                                type="button"
                                onClick={() => updateItemConfig(itemKey, { action: 'exchange' })}
                                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                                  itemConfig.action === 'exchange'
                                    ? 'bg-white border-[#B08D57] shadow-sm ring-1 ring-[#B08D57]'
                                    : 'bg-white/60 border-stone-200 hover:border-stone-300'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-xs uppercase tracking-wider text-[#2A211C]">EXCHANGE SIZE</span>
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                    FREE (₹0 Fee)
                                  </span>
                                </div>
                                <p className="text-[11px] text-stone-500">
                                  Exchange for another available size of the exact same product and color.
                                </p>
                              </button>

                              {/* RETURN OPTION */}
                              <button
                                type="button"
                                onClick={() => updateItemConfig(itemKey, { action: 'return' })}
                                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                                  itemConfig.action === 'return'
                                    ? 'bg-white border-[#B08D57] shadow-sm ring-1 ring-[#B08D57]'
                                    : 'bg-white/60 border-stone-200 hover:border-stone-300'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-xs uppercase tracking-wider text-[#2A211C]">RETURN ITEM</span>
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                                    -₹100 Pickup Fee
                                  </span>
                                </div>
                                <p className="text-[11px] text-stone-500">
                                  Return item for refund. A ₹100 shipping fee is deducted once per pickup request.
                                </p>
                              </button>
                            </div>
                          </div>

                          {/* IF EXCHANGE: SIZE SELECTION */}
                          {itemConfig.action === 'exchange' && (
                            <div className="space-y-3 bg-white p-4 rounded-xl border border-stone-200">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
                                  Select New Size (Current Size: <strong className="text-[#B08D57] font-mono">{item.size}</strong>)
                                </span>
                                {isLoadingSizes[item.product_id] && (
                                  <span className="text-[10px] text-stone-400 flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3 animate-spin" /> Checking inventory...
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {(sizeOptions[item.product_id] || [
                                  { size: 'S', inStock: true },
                                  { size: 'M', inStock: true },
                                  { size: 'L', inStock: true },
                                  { size: 'XL', inStock: true },
                                  { size: 'XXL', inStock: false },
                                  { size: '30', inStock: true },
                                  { size: '32', inStock: true },
                                  { size: '34', inStock: true }
                                ]).map(szObj => {
                                  const isCurrent = szObj.size === item.size;
                                  const isChosen = itemConfig.requested_size === szObj.size;
                                  const isDisabled = isCurrent || !szObj.inStock;

                                  return (
                                    <button
                                      key={szObj.size}
                                      type="button"
                                      disabled={isDisabled}
                                      onClick={() => updateItemConfig(itemKey, { requested_size: szObj.size })}
                                      className={`px-3.5 py-2 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer relative ${
                                        isChosen
                                          ? 'bg-[#B08D57] text-white shadow'
                                          : isCurrent
                                          ? 'bg-stone-100 text-stone-400 line-through cursor-not-allowed border border-stone-200'
                                          : !szObj.inStock
                                          ? 'bg-stone-100 text-stone-300 cursor-not-allowed border border-stone-200'
                                          : 'bg-stone-50 border border-stone-200 text-stone-800 hover:border-[#B08D57]'
                                      }`}
                                    >
                                      {szObj.size}
                                      {!szObj.inStock && !isCurrent && (
                                        <span className="block text-[8px] font-sans font-normal text-stone-400 uppercase">OOS</span>
                                      )}
                                      {isCurrent && (
                                        <span className="block text-[8px] font-sans font-normal text-stone-400 uppercase">Current</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>

                              {itemConfig.requested_size && (
                                <p className="text-xs text-emerald-800 font-medium flex items-center gap-1.5 pt-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Selected Exchange Size: <strong className="font-mono">{itemConfig.requested_size}</strong> (Verified in stock)</span>
                                </p>
                              )}
                            </div>
                          )}

                          {/* REASON SELECTION */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-stone-200">
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                                Reason for {itemConfig.action === 'exchange' ? 'Exchange' : 'Return'} *
                              </label>
                              <select
                                value={itemConfig.reason}
                                onChange={(e) => updateItemConfig(itemKey, { reason: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-xs font-medium text-stone-800 bg-stone-50 focus:outline-none focus:border-[#B08D57]"
                              >
                                {(itemConfig.action === 'exchange' ? RETURNS_CONFIG.EXCHANGE_REASONS : RETURNS_CONFIG.RETURN_REASONS).map(r => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                                Additional Notes (Optional)
                              </label>
                              <input
                                type="text"
                                placeholder="Tell us more details..."
                                value={itemConfig.reason_notes}
                                onChange={(e) => updateItemConfig(itemKey, { reason_notes: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-xs text-stone-800 bg-stone-50 focus:outline-none focus:border-[#B08D57]"
                              />
                            </div>
                          </div>

                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* REQUEST SUMMARY BAR & CONTINUE BUTTON */}
            {selectedConfigList.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#E5D2BC]/30 p-6 shadow-md space-y-4 animate-fade-in">
                <h3 className="font-serif font-bold text-base text-[#2A211C] border-b border-stone-100 pb-2">
                  Request Summary ({selectedConfigList.length} {selectedConfigList.length === 1 ? 'item' : 'items'})
                </h3>

                <div className="space-y-2 text-xs">
                  {selectedConfigList.map((c: SelectedItemConfig) => (
                    <div key={`${c.item.product_id}_${c.item.size}`} className="flex items-center justify-between text-stone-700">
                      <span>
                        {c.item.name} ({c.action === 'exchange' ? `Size ${c.item.size} → ${c.requested_size || 'Select size'}` : `Return Size ${c.item.size}`})
                      </span>
                      <span className="font-bold">
                        {c.action === 'exchange' ? 'FREE' : `₹${(c.item.price * c.item.quantity).toLocaleString('en-IN')}`}
                      </span>
                    </div>
                  ))}

                  <div className="border-t border-stone-100 pt-2 flex items-center justify-between text-stone-600">
                    <span>Return Pickup Shipping Fee ({hasReturnItem ? '1 pickup fee per request' : 'Free'})</span>
                    <span className="font-bold text-[#B08D57]">
                      {hasReturnItem ? `-₹${RETURNS_CONFIG.RETURN_SHIPPING_FEE}` : '₹0'}
                    </span>
                  </div>

                  {hasReturnItem && (
                    <div className="border-t border-stone-200 pt-2 flex items-center justify-between text-sm font-bold text-[#2A211C]">
                      <span>Estimated Total Refund</span>
                      <span className="font-serif text-lg text-[#2A211C]">
                        ₹{estimatedRefundTotal.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleProceedToReview}
                  className="w-full py-4 bg-[#2A211C] hover:bg-[#332c24] text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>PROCEED TO REVIEW REQUEST</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>
        )}

        {/* STEP 5: REVIEW SCREEN */}
        {currentStep === 'review' && selectedOrder && (
          <div className="bg-white rounded-2xl border border-[#E5D2BC]/25 p-6 sm:p-10 shadow-sm space-y-6 animate-fade-in max-w-2xl mx-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div>
                <h2 className="font-serif text-xl font-bold text-[#2A211C]">Review Request</h2>
                <p className="text-xs text-stone-500">Order #{selectedOrder.order_id}</p>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep('order_details')}
                className="text-xs font-bold text-[#B08D57] hover:underline cursor-pointer"
              >
                Edit Selection
              </button>
            </div>

            {/* SELECTED ITEMS TABLE */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Selected Items</h3>
              {selectedConfigList.map((c: SelectedItemConfig) => (
                <div key={`${c.item.product_id}_${c.item.size}`} className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#2A211C] block">{c.item.name}</span>
                    <span className="text-stone-500">
                      Action: <strong className="uppercase text-[#B08D57]">{c.action}</strong> | {c.action === 'exchange' ? `Size: ${c.item.size} → ${c.requested_size}` : `Size: ${c.item.size}`}
                    </span>
                    <span className="block text-[11px] text-stone-400">Reason: {c.reason}</span>
                  </div>
                  <div className="text-right font-serif font-bold text-stone-900">
                    {c.action === 'exchange' ? '₹0' : `₹${(c.item.price * c.item.quantity).toLocaleString('en-IN')}`}
                  </div>
                </div>
              ))}
            </div>

            {/* CHARGES BREAKDOWN */}
            <div className="p-4 bg-[#FAF8F5] rounded-xl border border-[#E5D2BC]/20 space-y-2 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Exchange Fee</span>
                <span className="font-bold text-emerald-700">₹0 (FREE)</span>
              </div>
              {hasReturnItem && (
                <div className="flex justify-between text-stone-600">
                  <span>Return Shipping Charge (Deducted once)</span>
                  <span className="font-bold text-rose-700">-₹{RETURNS_CONFIG.RETURN_SHIPPING_FEE}</span>
                </div>
              )}
              {hasReturnItem && (
                <div className="border-t border-stone-200 pt-2 flex justify-between text-sm font-bold text-[#2A211C]">
                  <span>Estimated Total Refund</span>
                  <span className="font-serif text-base">₹{estimatedRefundTotal.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            {/* PICKUP ADDRESS PREVIEW */}
            <div className="text-xs text-stone-600 space-y-1 p-3 bg-stone-50 rounded-xl">
              <span className="font-bold text-stone-800 block">Reverse Pickup Address:</span>
              <p>{selectedOrder.shipping_address_masked?.address}, {selectedOrder.shipping_address_masked?.city}, {selectedOrder.shipping_address_masked?.state} - {selectedOrder.shipping_address_masked?.pincode}</p>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmitRequest}
              className="w-full py-4 bg-[#2A211C] hover:bg-[#332c24] text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting request...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>SUBMIT REQUEST NOW</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* STEP 6: CONFIRMATION SCREEN */}
        {currentStep === 'success' && submittedResponse && (
          <div className="bg-white rounded-2xl border border-[#E5D2BC]/25 p-8 sm:p-12 shadow-sm text-center space-y-6 max-w-xl mx-auto animate-fade-in">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-700">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-[#2A211C] mb-1">Request Submitted Successfully</h2>
              <p className="text-xs text-stone-500">
                Your return/exchange request has been logged and sent to our customer experience team.
              </p>
            </div>

            {/* REFERENCE DETAILS CARD */}
            <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 text-left space-y-3">
              <div className="flex justify-between items-center border-b border-stone-200 pb-2">
                <span className="text-xs text-stone-500">Request Reference ID</span>
                <span className="font-mono text-base font-bold text-[#B08D57]">{submittedResponse.request_id}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-500">Order ID</span>
                <span className="font-mono font-bold text-stone-800">{submittedResponse.order_id}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-500">Request Type</span>
                <span className="font-bold uppercase text-stone-800">{submittedResponse.request_type}</span>
              </div>

              {submittedResponse.return_shipping_fee > 0 && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-stone-500">Return Shipping Fee</span>
                  <span className="font-bold text-stone-800">₹{submittedResponse.return_shipping_fee}</span>
                </div>
              )}

              {submittedResponse.estimated_refund_total > 0 && (
                <div className="flex justify-between items-center text-xs pt-2 border-t border-stone-200 font-bold">
                  <span className="text-stone-800">Estimated Refund</span>
                  <span className="font-serif text-sm text-[#2A211C]">₹{submittedResponse.estimated_refund_total.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            {/* TIMELINE */}
            <div className="text-left text-xs space-y-2 p-4 bg-amber-50/50 rounded-xl border border-amber-200/50">
              <span className="font-bold text-amber-900 block flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#B08D57]" /> Next Steps Timeline:
              </span>
              <ol className="list-decimal list-inside text-stone-600 space-y-1 pl-1">
                <li>Our quality team reviews your request within 24 hours.</li>
                <li>Courier reverse pickup will be scheduled.</li>
                <li>Upon inspection at facility, exchange is dispatched / refund processed.</li>
              </ol>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <Link
                to="/shop"
                className="w-full py-3.5 bg-[#2A211C] hover:bg-[#332c24] text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer block text-center"
              >
                RETURN TO SHOP
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
