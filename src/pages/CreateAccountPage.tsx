import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Building,
  Bell,
  Sparkles,
  Globe
} from 'lucide-react';
import { Msg91OtpVerification } from '../components/Msg91OtpVerification';
import { GstVerificationSection } from '../components/GstVerificationSection';
import { verifyGstinApi, VerifiedGstData } from '../utils/gstUtils';

const IndiaFlagIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-3.5" }) => (
  <svg className={`${className} rounded-[2px] border border-black/15 shadow-2xs flex-shrink-0`} viewBox="0 0 640 480" aria-label="India Flag">
    <path fill="#FF9933" d="M0 0h640v160H0z"/>
    <path fill="#FFFFFF" d="M0 160h640v160H0z"/>
    <path fill="#138808" d="M0 320h640v160H0z"/>
    <g transform="translate(320 240) scale(1.35)">
      <circle r="40" fill="none" stroke="#000080" strokeWidth="6"/>
      <circle r="6" fill="#000080"/>
      <path stroke="#000080" strokeWidth="3" d="M0-40V40M-40 0H40M-28.28-28.28l56.56 56.56M-28.28 28.28l56.56-56.56M-36.96-15.3l73.92 30.6M-36.96 15.3l73.92-30.6M-15.3-36.96l30.6 73.92M15.3-36.96l-30.6 73.92"/>
    </g>
  </svg>
);

const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

interface LocationState {
  source?: 'google' | 'mobile' | 'email';
  firstName?: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  registrationToken?: string;
}

export const CreateAccountPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) || {};

  // Form Fields State
  const [firstName, setFirstName] = useState(state.firstName || '');
  const [lastName, setLastName] = useState(state.lastName || '');
  const [mobile, setMobile] = useState(state.mobile || '');
  const [email, setEmail] = useState(state.email || '');
  const [registrationToken, setRegistrationToken] = useState(state.registrationToken || '');

  // Mobile Verification State
  const [isMobileVerified, setIsMobileVerified] = useState(false);
  const [mobileAccessToken, setMobileAccessToken] = useState<string>('');

  // Shipping Address State
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('Delhi');
  const [pincode, setPincode] = useState('');
  const [country, setCountry] = useState('India');
  const [isPincodeLoading, setIsPincodeLoading] = useState(false);

  // Billing Address State
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [billingAddressLine1, setBillingAddressLine1] = useState('');
  const [billingAddressLine2, setBillingAddressLine2] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('Delhi');
  const [billingPincode, setBillingPincode] = useState('');

  // GST State
  const [addGst, setAddGst] = useState(false);
  const [gstin, setGstin] = useState('');
  const [gstVerificationState, setGstVerificationState] = useState<'idle' | 'verifying' | 'verified' | 'failed'>('idle');
  const [verifiedGstData, setVerifiedGstData] = useState<VerifiedGstData | null>(null);
  const [gstErrorMessage, setGstErrorMessage] = useState<string | null>(null);
  const [gstLegalName, setGstLegalName] = useState('');
  const [gstTradeName, setGstTradeName] = useState('');

  // Verify GSTIN via Server API
  const handleVerifyGstin = async (inputGstin?: string) => {
    const targetGstin = (inputGstin || gstin || '').trim().toUpperCase();
    if (!targetGstin) {
      setGstVerificationState('idle');
      setVerifiedGstData(null);
      setGstErrorMessage(null);
      return;
    }

    setGstVerificationState('verifying');
    setGstErrorMessage(null);

    const result = await verifyGstinApi(targetGstin);
    if (result.valid && result.data) {
      setGstVerificationState('verified');
      setVerifiedGstData(result.data);
      setGstErrorMessage(null);
      if (result.data.legal_name) {
        setGstLegalName(result.data.legal_name);
      }
      if (result.data.trade_name) {
        setGstTradeName(result.data.trade_name);
      }
    } else {
      setGstVerificationState('failed');
      setGstErrorMessage(result.error || 'GSTIN verification failed. Please check the number.');
      setVerifiedGstData(null);
    }
  };

  // Apply GST Address to Shipping Address
  const handleApplyGstAddress = (addressData: { address: string; pincode?: string; state?: string }) => {
    if (addressData.address) {
      setAddressLine1(addressData.address);
    }
    if (addressData.pincode && addressData.pincode.length === 6) {
      handlePincodeChange(addressData.pincode);
    }
    if (addressData.state && INDIAN_STATES.includes(addressData.state)) {
      setStateName(addressData.state);
    }
  };

  // Communication Preferences State
  const [whatsappConsent, setWhatsappConsent] = useState(true);
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(true);

  // Form Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auto-fetch City and State from Pincode
  const handlePincodeChange = async (val: string) => {
    const cleanPin = val.replace(/\D/g, '').slice(0, 6);
    setPincode(cleanPin);

    if (cleanPin.length === 6) {
      setIsPincodeLoading(true);
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
        const data = await res.json();
        if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice?.length > 0) {
          const po = data[0].PostOffice[0];
          if (po.District) setCity(po.District);
          if (po.State && INDIAN_STATES.includes(po.State)) setStateName(po.State);
        }
      } catch (err) {
        console.warn('India Post pincode lookup error:', err);
      } finally {
        setIsPincodeLoading(false);
      }
    }
  };

  // Auto-fetch Billing City and State from Billing Pincode
  const handleBillingPincodeChange = async (val: string) => {
    const cleanPin = val.replace(/\D/g, '').slice(0, 6);
    setBillingPincode(cleanPin);

    if (cleanPin.length === 6) {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
        const data = await res.json();
        if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice?.length > 0) {
          const po = data[0].PostOffice[0];
          if (po.District) setBillingCity(po.District);
          if (po.State && INDIAN_STATES.includes(po.State)) setBillingState(po.State);
        }
      } catch (err) {
        console.warn('Billing pincode lookup error:', err);
      }
    }
  };

  const cleanPhone = mobile.replace(/\D/g, '');
  const isValidPhoneLength = cleanPhone.length === 10 && /^[6-9]\d{9}$/.test(cleanPhone);
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isValidPincode = pincode.replace(/\D/g, '').length === 6;

  const isFormValid =
    isMobileVerified &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    isValidPhoneLength &&
    isValidEmail &&
    addressLine1.trim().length > 0 &&
    city.trim().length > 0 &&
    stateName.trim().length > 0 &&
    isValidPincode;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setFormError(null);
    setSuccessMessage(null);

    try {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mobile: cleanPhone,
        accessToken: mobileAccessToken,
        registrationToken: registrationToken || undefined,
        email: email.trim().toLowerCase(),
        shippingAddress: {
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim(),
          city: city.trim(),
          state: stateName.trim(),
          pincode: pincode.replace(/\D/g, ''),
          country: 'India'
        },
        billingAddress: sameAsShipping
          ? null
          : {
              addressLine1: billingAddressLine1.trim(),
              addressLine2: billingAddressLine2.trim(),
              city: billingCity.trim(),
              state: billingState.trim(),
              pincode: billingPincode.replace(/\D/g, ''),
              country: 'India'
            },
        gstin: addGst ? gstin.trim().toUpperCase() : undefined,
        gstLegalName: addGst ? (gstLegalName.trim() || verifiedGstData?.legal_name) : undefined,
        gstTradeName: addGst ? (gstTradeName.trim() || verifiedGstData?.trade_name) : undefined,
        gstDetails: addGst ? (verifiedGstData || undefined) : undefined,
        gstVerified: addGst ? (gstVerificationState === 'verified') : undefined,
        communicationPreferences: {
          whatsapp: whatsappConsent,
          email: newsletterConsent,
          sms: smsConsent
        },
        marketingConsent: newsletterConsent
      };

      const response = await fetch('/api/customer/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create account. Please check your details and try again.');
      }

      // Store customer session token
      const token = data.token || data.sessionToken || data.rawToken;
      if (token) {
        localStorage.setItem('kora_customer_token', token);
      }

      setSuccessMessage('Account created successfully! Redirecting to your dashboard...');
      setTimeout(() => {
        navigate('/account', { replace: true });
      }, 1200);

    } catch (err: any) {
      console.error('Account creation error:', err);
      setFormError(err.message || 'An error occurred while creating your account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F1E8] text-[#1C1917] font-sans antialiased py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Navigation / Header */}
        <div className="flex items-center justify-between border-b border-stone-300 pb-4">
          <Link
            to="/account"
            className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Login</span>
          </Link>
          <div className="text-right">
            <span className="font-serif text-lg tracking-wider text-stone-900 uppercase">Sa and Sha</span>
            <span className="text-[10px] tracking-widest text-stone-500 block uppercase">Identity & Loyalty</span>
          </div>
        </div>

        {/* Banner Header */}
        <div className="bg-stone-900 text-stone-100 rounded-2xl p-6 shadow-md border border-stone-800 relative overflow-hidden">
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-300 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>New Customer Registration</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl text-stone-50 font-normal tracking-tight">
              Create Your Sa and Sha Account
            </h1>
            <p className="text-stone-300 text-sm max-w-xl leading-relaxed">
              Complete your profile once to unlock order history, address book, tax invoices, and automated loyalty rewards.
            </p>
          </div>
        </div>

        {/* Main Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* SECTION: COUNTRY / REGION SELECTION */}
          <div className="bg-[#FAF8F5] border border-[#C9B79C]/30 rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-[#B85C38]" />
                <div>
                  <h2 className="font-serif text-base font-bold text-[#1F1B16]">Country / Region</h2>
                  <p className="text-[11px] text-[#1F1B16]/60">Currently serving deliveries across India (International expansion coming soon)</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1F1B16]/5 border border-[#C9B79C]/40 rounded-full text-xs font-bold text-[#1F1B16]">
                <IndiaFlagIcon className="w-4 h-3" />
                <span>India (+91)</span>
              </span>
            </div>
            <div className="pt-1">
              <div className="flex items-center w-full border border-[#C9B79C]/40 rounded-xl bg-white overflow-hidden focus-within:border-[#1F1B16] focus-within:ring-2 focus-within:ring-[#1F1B16]/10">
                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#FAF8F5]/80 border-r border-[#C9B79C]/40 select-none flex-shrink-0">
                  <IndiaFlagIcon className="w-5 h-3.5" />
                  <span className="text-xs font-bold text-[#1F1B16]">IN</span>
                </div>
                <select
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-transparent focus:outline-none text-[#1F1B16] h-[42px] cursor-pointer"
                >
                  <option value="India">India (Domestic Shipping)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 1: Personal Details */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-stone-900 border-b border-stone-100 pb-3">
              <User className="w-5 h-5 text-stone-700" />
              <h2 className="font-serif text-lg font-medium">1. Personal Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="e.g. Rahul"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Last Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="e.g. Sharma"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Mandatory Primary Contact (Mobile OTP Verification) */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2 text-stone-900">
                <Phone className="w-5 h-5 text-stone-700" />
                <h2 className="font-serif text-lg font-medium">2. Primary Contact & Security Anchor</h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
                Mandatory Step
              </span>
            </div>

            <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>System Governance Rule:</strong> Every Sa and Sha account must be anchored to a verified 10-digit Indian mobile number. Mobile OTP verification is strictly required before account activation.
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Mobile Number (India) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm font-medium text-stone-500">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={mobile}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setMobile(val);
                      if (isMobileVerified) setIsMobileVerified(false);
                    }}
                    placeholder="9876543210"
                    disabled={isMobileVerified}
                    className="w-full pl-12 pr-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* MSG91 OTP Verification Component */}
              {isValidPhoneLength && (
                <div className="pt-2">
                  <Msg91OtpVerification
                    phone={cleanPhone}
                    purpose="registration"
                    isVerified={isMobileVerified}
                    onVerified={(id, token) => {
                      setIsMobileVerified(true);
                      if (token) setMobileAccessToken(token);
                    }}
                    onResetVerification={() => {
                      setIsMobileVerified(false);
                      setMobileAccessToken('');
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Email Address */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-stone-900 border-b border-stone-100 pb-3">
              <Mail className="w-5 h-5 text-stone-700" />
              <h2 className="font-serif text-lg font-medium">3. Email Address</h2>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. rahul.sharma@example.com"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Used for digital tax invoices and shipping confirmation emails.
              </p>
            </div>
          </div>

          {/* Section 4: Primary Shipping Address */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-stone-900 border-b border-stone-100 pb-3">
              <MapPin className="w-5 h-5 text-stone-700" />
              <h2 className="font-serif text-lg font-medium">4. Primary Shipping Address</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Address Line 1 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addressLine1}
                  onChange={e => setAddressLine1(e.target.value)}
                  placeholder="House / Flat No., Building Name, Street"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={e => setAddressLine2(e.target.value)}
                  placeholder="Landmark, Area, Sector (Optional)"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    PIN Code <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={pincode}
                      onChange={e => handlePincodeChange(e.target.value)}
                      placeholder="110001"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
                    />
                    {isPincodeLoading && (
                      <Loader2 className="w-4 h-4 animate-spin text-stone-500 absolute right-3 top-3" />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="New Delhi"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    State <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={stateName}
                    onChange={e => setStateName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
                  >
                    {INDIAN_STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Billing Address */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="font-serif text-lg font-medium text-stone-900">5. Billing Address</h2>
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-800">
                <input
                  type="checkbox"
                  checked={sameAsShipping}
                  onChange={e => setSameAsShipping(e.target.checked)}
                  className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300"
                />
                <span>Same as shipping address</span>
              </label>
            </div>

            {!sameAsShipping && (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Billing Address Line 1 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required={!sameAsShipping}
                    value={billingAddressLine1}
                    onChange={e => setBillingAddressLine1(e.target.value)}
                    placeholder="House / Flat No., Building Name, Street"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Billing PIN Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={billingPincode}
                      onChange={e => handleBillingPincodeChange(e.target.value)}
                      placeholder="110001"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Billing City
                    </label>
                    <input
                      type="text"
                      value={billingCity}
                      onChange={e => setBillingCity(e.target.value)}
                      placeholder="City"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Billing State
                    </label>
                    <select
                      value={billingState}
                      onChange={e => setBillingState(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
                    >
                      {INDIAN_STATES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 6: GST Information (Optional) */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2 text-stone-900">
                <Building className="w-5 h-5 text-stone-700" />
                <h2 className="font-serif text-lg font-medium">6. Business GST Information (Optional)</h2>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-800">
                <input
                  type="checkbox"
                  checked={addGst}
                  onChange={e => {
                    setAddGst(e.target.checked);
                    if (!e.target.checked) {
                      setGstin('');
                      setGstVerificationState('idle');
                      setVerifiedGstData(null);
                      setGstErrorMessage(null);
                      setGstLegalName('');
                      setGstTradeName('');
                    }
                  }}
                  className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300 cursor-pointer"
                />
                <span>Add GSTIN</span>
              </label>
            </div>

            {addGst && (
              <GstVerificationSection
                gstin={gstin}
                onGstinChange={(val) => {
                  setGstin(val);
                  if (val.length < 15 && gstVerificationState !== 'idle') {
                    setGstVerificationState('idle');
                    setVerifiedGstData(null);
                    setGstErrorMessage(null);
                  }
                }}
                verificationState={gstVerificationState}
                verifiedGstData={verifiedGstData}
                errorMessage={gstErrorMessage}
                onVerify={handleVerifyGstin}
                legalName={gstLegalName}
                onLegalNameChange={setGstLegalName}
                tradeName={gstTradeName}
                onTradeNameChange={setGstTradeName}
                onApplyGstAddress={handleApplyGstAddress}
                showManualFields={true}
                theme="stone"
              />
            )}
          </div>

          {/* Section 7: Communication Preferences */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-stone-900 border-b border-stone-100 pb-3">
              <Bell className="w-5 h-5 text-stone-700" />
              <h2 className="font-serif text-lg font-medium">7. Communication & Privacy Preferences</h2>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whatsappConsent}
                  onChange={e => setWhatsappConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300"
                />
                <span className="text-xs text-stone-700 leading-snug">
                  Receive instant order confirmation & tracking updates on <strong>WhatsApp</strong>.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={smsConsent}
                  onChange={e => setSmsConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300"
                />
                <span className="text-xs text-stone-700 leading-snug">
                  Receive <strong>SMS notifications</strong> for delivery status and security alerts.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newsletterConsent}
                  onChange={e => setNewsletterConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300"
                />
                <span className="text-xs text-stone-700 leading-snug">
                  Subscribe to private collection drops, seasonal linen edits, and member events.
                </span>
              </label>
            </div>
          </div>

          {/* Status Messages */}
          {formError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Final Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="w-full py-4 px-6 bg-stone-900 hover:bg-stone-800 active:bg-black text-white font-medium text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>Create Sa and Sha Account</span>
                </>
              )}
            </button>
            {!isMobileVerified && (
              <p className="text-center text-xs text-amber-800 mt-2 font-medium">
                * Please verify your mobile number via MSG91 OTP above to enable account creation.
              </p>
            )}
          </div>

        </form>
      </div>
    </div>
  );
};
