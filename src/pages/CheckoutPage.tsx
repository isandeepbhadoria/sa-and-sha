import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useShop } from '../context/ShopContext';
import { GstVerificationSection } from '../components/GstVerificationSection';
import { verifyGstinApi } from '../utils/gstUtils';
import { 
  CreditCard, 
  Truck, 
  ShoppingBag, 
  ShieldCheck, 
  CheckCircle2, 
  ChevronRight, 
  MapPin, 
  QrCode, 
  ClipboardList, 
  Loader2, 
  Trash2, 
  Plus, 
  Minus, 
  ArrowLeft, 
  Sparkles, 
  Mail, 
  Phone, 
  User, 
  XCircle,
  FileText,
  Globe,
  Lock,
  RefreshCw,
  Building2,
  Building,
  Bell,
  Check,
  ChevronDown
} from 'lucide-react';

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
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, functions, httpsCallable } from '../lib/firebase';
import { doc, getDoc, setDoc, addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { useSEO } from '../hooks/useSEO';
import { CustomerAddressBookModal } from '../components/CustomerAddressBookModal';
import { CustomerAddress } from '../server/customerProfileHelpers';
import { Msg91OtpVerification } from '../components/Msg91OtpVerification';


type CheckoutStep = 'cart' | 'details' | 'shipping' | 'payment' | 'success';

interface ShippingForm {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  countryCode: string;
  dialCode: string;
  saveAddress: boolean;
  notes: string;
  // Billing Address
  sameAsShipping: boolean;
  billingFirstName: string;
  billingLastName: string;
  billingAddressLine1: string;
  billingAddressLine2: string;
  billingCity: string;
  billingState: string;
  billingPincode: string;
  billingCountry: string;
  gstin: string;
  // Marketing preferences
  whatsappUpdates: boolean;
  emailMarketing: boolean;
}

const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal"
];

const COUNTRIES = [
  "India",
  "United States",
  "United Kingdom",
  "United Arab Emirates",
  "Singapore",
  "Australia",
  "Canada",
  "Germany",
  "France",
  "Japan"
];

export const CheckoutPage: React.FC = () => {
  useSEO({
    title: 'Checkout | Sa and Sha',
    description: 'Complete your purchase at Sa and Sha. Secure checkout for dresses, tops, and more.',
    noindex: true
  });

  const navigate = useNavigate();
  const { 
    cart, 
    cartSubtotal, 
    updateCartQuantity, 
    removeFromCart, 
    clearCart, 
    applyCoupon,
    removeCoupon,
    showToast 
  } = useShop();

  const [step, setStep] = useState<CheckoutStep>('cart');
  const [user, setUser] = useState<FirebaseUser | null>(null);

  // Form State
  const [form, setForm] = useState<ShippingForm>({
    firstName: '',
    lastName: '',
    fullName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    countryCode: 'IN',
    dialCode: '+91',
    saveAddress: true,
    notes: '',
    sameAsShipping: true,
    billingFirstName: '',
    billingLastName: '',
    billingAddressLine1: '',
    billingAddressLine2: '',
    billingCity: '',
    billingState: '',
    billingPincode: '',
    billingCountry: 'India',
    gstin: '',
    whatsappUpdates: true,
    emailMarketing: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPincodeLoading, setIsPincodeLoading] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [verifiedMobileToken, setVerifiedMobileToken] = useState<string | null>(null);
  const [verifiedCustomerSessionId, setVerifiedCustomerSessionId] = useState<string | null>(() => {
    try {
      return (typeof window !== 'undefined' ? sessionStorage.getItem('verifiedCustomerSessionId') : null) || null;
    } catch {
      return null;
    }
  });
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isSavedAddressLoaded, setIsSavedAddressLoaded] = useState(false);
  const [savedProfile, setSavedProfile] = useState<any | null>(null);
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [marketingPreferences, setMarketingPreferences] = useState({
    email_marketing_consent: false,
    sms_marketing_consent: false,
    whatsapp_marketing_consent: false,
    voice_call_consent: false
  });

  // GST Auto Verification State (Phase 9E)
  const [gstVerificationState, setGstVerificationState] = useState<'idle' | 'verifying' | 'verified' | 'failed'>('idle');
  const [verifiedGstData, setVerifiedGstData] = useState<any | null>(null);
  const [gstErrorMessage, setGstErrorMessage] = useState<string | null>(null);

  // Verify GSTIN via Server API
  const handleVerifyGstin = async (inputGstin?: string) => {
    const targetGstin = (inputGstin || form.gstin || '').trim().toUpperCase();
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
      showToast(`Business verified: ${result.data.legal_name || 'Active Taxpayer'}`);
    } else {
      setGstVerificationState('failed');
      setGstErrorMessage(result.error || 'GSTIN verification failed. Please check the number.');
      setVerifiedGstData(null);
    }
  };


  // Shipping choices
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'express' | 'international'>('standard');
  const [customIntlRate, setCustomIntlRate] = useState(1499);
  const [isEditingIntlRate, setIsEditingIntlRate] = useState(false);

  // Coupons
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // Payments
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay');
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [openSimulatedPayment, setOpenSimulatedPayment] = useState(false);

  // Stable checkout session & idempotency key per checkout attempt
  const [checkoutSessionId, setCheckoutSessionId] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('kl_checkout_session_id');
      if (saved) return saved;
      const newId = `cs_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
      sessionStorage.setItem('kl_checkout_session_id', newId);
      return newId;
    } catch {
      return `cs_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
    }
  });

  // Track key parameters to reset checkoutSessionId if cart or order parameters change
  const currentCartSig = `${cart.map(c => `${c.product.id}_${c.quantity}_${c.selectedSize}`).join('|')}_${appliedCoupon?.code || 'none'}_${form.email}_${form.phone}_${shippingMethod}`;
  const [lastCartSig, setLastCartSig] = useState(currentCartSig);

  if (currentCartSig !== lastCartSig) {
    setLastCartSig(currentCartSig);
    const freshId = `cs_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
    try {
      sessionStorage.setItem('kl_checkout_session_id', freshId);
    } catch {}
    setCheckoutSessionId(freshId);
  }
  const [simulatedCard, setSimulatedCard] = useState({ number: '', expiry: '', cvv: '' });
  const [simulatedUpiId, setSimulatedUpiId] = useState('');
  const [simulatedOrderId, setSimulatedOrderId] = useState<string | null>(null);

  // Receipt details for successful order
  const [completedOrder, setCompletedOrder] = useState<any | null>(null);
  const [emailDispatchedSuccess, setEmailDispatchedSuccess] = useState<boolean | null>(null);

  // Listen to Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.email) {
        const authEmail = currentUser.email.trim().toLowerCase();
        if (authEmail && authEmail !== 'shop@sa-and-sha.com') {
          setForm(prev => ({ ...prev, email: prev.email || authEmail }));
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync shipping selection based on country selection
  useEffect(() => {
    if (form.country !== 'India') {
      setShippingMethod('international');
    } else {
      setShippingMethod('standard');
    }
  }, [form.country]);

  // Form Validation
  const validateForm = (updatedForm = form) => {
    const newErrors: Record<string, string> = {};
    
    // First Name & Last Name
    const fName = updatedForm.firstName.trim();
    const lName = updatedForm.lastName.trim();
    if (!fName) {
      newErrors.firstName = 'First name is required.';
    }
    if (!lName) {
      newErrors.lastName = 'Last name is required.';
    }
    
    // Customer email is required for order confirmation and notifications
    const trimmedEmail = updatedForm.email.trim();
    if (!trimmedEmail) {
      newErrors.email = 'Email address is required.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        newErrors.email = 'Please enter a valid email address.';
      }
    }
    
    const cleanPhone = updatedForm.phone.replace(/\D/g, '');
    if (!updatedForm.phone.trim()) {
      newErrors.phone = 'Mobile phone number is required.';
    } else if (updatedForm.country === 'India' && cleanPhone.length !== 10) {
      newErrors.phone = 'Mobile number must be exactly 10 digits.';
    } else if (updatedForm.country === 'India' && !/^[6-9]\d{9}$/.test(cleanPhone)) {
      newErrors.phone = 'Please enter a valid 10-digit Indian mobile number starting with 6-9.';
    } else if (updatedForm.phone.length < 7) {
      newErrors.phone = 'Please enter a valid phone number.';
    }
    
    if (!updatedForm.addressLine1.trim()) {
      newErrors.addressLine1 = 'Address line 1 is required.';
    } else if (updatedForm.addressLine1.trim().length < 5) {
      newErrors.addressLine1 = 'Please specify a detailed address (min 5 characters).';
    }
    
    if (!updatedForm.city.trim()) {
      newErrors.city = 'City / District is required.';
    }
    
    if (!updatedForm.state.trim()) {
      newErrors.state = 'State is required.';
    }
    
    if (!updatedForm.pincode.trim()) {
      newErrors.pincode = 'Pincode / ZIP is required.';
    } else if (updatedForm.country === 'India' && updatedForm.pincode.trim().length !== 6) {
      newErrors.pincode = 'Indian pincode must be exactly 6 digits.';
    }

    // Billing validation if separate address
    if (!updatedForm.sameAsShipping) {
      if (!updatedForm.billingFirstName.trim()) {
        newErrors.billingFirstName = 'Billing first name is required.';
      }
      if (!updatedForm.billingLastName.trim()) {
        newErrors.billingLastName = 'Billing last name is required.';
      }
      if (!updatedForm.billingAddressLine1.trim()) {
        newErrors.billingAddressLine1 = 'Billing address line 1 is required.';
      }
      if (!updatedForm.billingCity.trim()) {
        newErrors.billingCity = 'Billing city is required.';
      }
      if (!updatedForm.billingState.trim()) {
        newErrors.billingState = 'Billing state is required.';
      }
      if (!updatedForm.billingPincode.trim()) {
        newErrors.billingPincode = 'Billing pincode is required.';
      } else if (updatedForm.billingCountry === 'India' && updatedForm.billingPincode.trim().length !== 6) {
        newErrors.billingPincode = 'Indian billing pincode must be 6 digits.';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let val: any = value;
    if (type === 'checkbox') {
      val = (e.target as HTMLInputElement).checked;
    }

    const updatedForm = { ...form, [name]: val };

    if (name === 'firstName' || name === 'lastName') {
      const fn = name === 'firstName' ? val : form.firstName;
      const ln = name === 'lastName' ? val : form.lastName;
      updatedForm.fullName = `${fn.trim()} ${ln.trim()}`.trim();
    }

    setForm(updatedForm);

    // Dynamic verification
    validateForm(updatedForm);

    // Auto lookup pincode
    if (name === 'pincode' && value.replace(/\D/g, '').length === 6 && form.country === 'India') {
      fetchAddressFromPincode(value);
    }
    if (name === 'billingPincode' && value.replace(/\D/g, '').length === 6 && form.billingCountry === 'India') {
      fetchBillingAddressFromPincode(value);
    }
  };

  // Fetch billing address from India Post API
  const fetchBillingAddressFromPincode = async (pin: string) => {
    const cleanPin = pin.replace(/\D/g, '').substring(0, 6);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
      const data = await res.json();
      if (data && data[0] && data[0].Status === 'Success') {
        const postOffices = data[0].PostOffice;
        if (postOffices && postOffices.length > 0) {
          const po = postOffices[0];
          setForm(prev => {
            const updated = {
              ...prev,
              billingPincode: cleanPin,
              billingCity: po.District || po.Block || prev.billingCity,
              billingState: po.State || prev.billingState
            };
            validateForm(updated);
            return updated;
          });
        }
      }
    } catch (err) {
      console.warn('Billing pincode lookup warning:', err);
    }
  };

  // Fetch address from India Post API
  const fetchAddressFromPincode = async (pin: string) => {
    const cleanPin = pin.replace(/\D/g, '').substring(0, 6);
    setIsPincodeLoading(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
      const data = await res.json();
      if (data && data[0] && data[0].Status === 'Success') {
        const postOffices = data[0].PostOffice;
        if (postOffices && postOffices.length > 0) {
          const po = postOffices[0];
          const updated = {
            ...form,
            pincode: cleanPin,
            city: po.District || po.Block || form.city,
            state: po.State || form.state
          };
          setForm(updated);
          validateForm(updated);
          showToast(`City & State auto-filled: ${po.District}, ${po.State}`);
        }
      }
    } catch (err) {
      console.warn('Silent warning: India Post API failed. Falling back to local values.', err);
    } finally {
      setIsPincodeLoading(false);
    }
  };

  // Apply Promo code via server-authoritative validation
  const handleApplyCoupon = async (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;

    setIsApplyingCoupon(true);
    setCouponError(null);

    try {
      const itemsPayload = cart.map(item => ({
        product_id: item.product.id,
        id: item.product.id,
        price: item.product.price,
        quantity: item.quantity,
        category: item.product.category,
        subCategory: item.product.subCategory,
        name: item.product.name
      }));

      const res = await fetch('/api/promotions/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promo_code: cleanCode,
          items: itemsPayload,
          customer_email: form.email || undefined,
          customer_phone: form.phone || undefined
        })
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        setAppliedCoupon({
          code: data.code,
          type: data.discount_type,
          value: data.discount_value,
          amount: data.discount_amount,
          display: data.discount_display
        });
        await applyCoupon(data.code);
        showToast(data.message || `Promo code "${data.code}" applied successfully!`);
      } else {
        setCouponError(data.message || 'Invalid promo code.');
        setAppliedCoupon(null);
        removeCoupon();
      }
    } catch (err: any) {
      console.error('Error validating promo code:', err);
      setCouponError('Network error while validating promo code.');
      setAppliedCoupon(null);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
    removeCoupon();
    showToast('Promo code removed.');
  };

  // Grand total calculations
  const subtotal = cartSubtotal;
  
  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    if (typeof appliedCoupon.amount === 'number') {
      return appliedCoupon.amount;
    }
    if (appliedCoupon.type === 'percentage') {
      return Math.round(subtotal * (appliedCoupon.value / 100));
    } else if (appliedCoupon.type === 'fixed' || appliedCoupon.type === 'fixed_amount') {
      return appliedCoupon.value;
    }
    return 0;
  };

  const discount = calculateDiscount();

  const calculateShippingCost = () => {
    if (form.country !== 'India' || shippingMethod === 'international') {
      return customIntlRate;
    }
    if (shippingMethod === 'express') {
      return 199;
    }
    // standard shipping: Free shipping above ₹1,999, else ₹99 shipping
    return subtotal >= 1999 ? 0 : 99;
  };

  const shippingCost = calculateShippingCost();
  const grandTotal = Math.max(0, subtotal - discount + shippingCost);

  // Validate form readiness for payment phase
  const isFormValid = () => {
    const cleanFn = form.firstName.trim();
    const cleanLn = form.lastName.trim();
    const cleanFull = form.fullName.trim();
    const hasName = (cleanFn.length >= 1 && cleanLn.length >= 1) || cleanFull.length >= 3;

    const emailValid = form.email.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
    const phoneValid = form.country === 'India' 
      ? /^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, '')) 
      : form.phone.trim().length >= 7;

    const addressValid = form.addressLine1.trim().length >= 5 &&
      form.city.trim().length > 0 &&
      form.state.trim().length > 0 &&
      (form.country === 'India' ? form.pincode.trim().length === 6 : form.pincode.trim().length > 0);

    const billingValid = form.sameAsShipping || (
      form.billingFirstName.trim().length >= 1 &&
      form.billingLastName.trim().length >= 1 &&
      form.billingAddressLine1.trim().length >= 5 &&
      form.billingCity.trim().length > 0 &&
      form.billingState.trim().length > 0 &&
      (form.billingCountry === 'India' ? form.billingPincode.trim().length === 6 : form.billingPincode.trim().length > 0)
    );

    return hasName && emailValid && phoneValid && addressValid && billingValid && Object.keys(errors).length === 0;
  };

  // Email triggers by calling server transactional endpoint (/api/orders/send-email)
  const triggerEmails = async (orderPayload: any) => {
    try {
      const res = await fetch('/api/orders/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderPayload.order_id
        })
      });

      if (!res.ok) {
        console.warn(`Server email endpoint returned status ${res.status}`);
        setEmailDispatchedSuccess(false);
      } else {
        const data = await res.json();
        console.log('Server transactional email response:', data);
        if (data.success && data.customerSuccess) {
          setEmailDispatchedSuccess(true);
        } else {
          setEmailDispatchedSuccess(false);
        }
      }
    } catch (mailErr) {
      console.warn('Silent email trigger warning:', mailErr);
      setEmailDispatchedSuccess(false);
    }
  };

  // Submit and Complete order creation
  const handleServerOrderCreation = async (paymentType: 'razorpay' | 'cod', rzpPayload?: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
    setIsPaymentProcessing(true);
    setPaymentError(null);

    const mappedItems = cart.map(it => ({
      product_id: it.product.id,
      name: it.product.name,
      price: it.product.price,
      quantity: it.quantity,
      size: it.selectedSize,
      color: it.product.color,
      image: it.product.images[0] || ''
    }));

    try {
      let endpoint = '/api/orders/create-cod';
      const idempKey = checkoutSessionId;
      const computedFullName = (form.fullName || `${form.firstName} ${form.lastName}`).trim();

      let payload: any = {
        idempotency_key: idempKey,
        first_name: form.firstName.trim() || computedFullName.split(/\s+/)[0] || '',
        last_name: form.lastName.trim() || computedFullName.split(/\s+/).slice(1).join(' ') || '',
        customer_name: computedFullName,
        customer_email: form.email.trim(),
        customer_phone: form.phone.trim(),
        address: form.addressLine1.trim(),
        address_line_2: form.addressLine2 ? form.addressLine2.trim() : "",
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        country: form.country || "India",
        country_code: form.countryCode || "IN",
        dial_code: form.dialCode || "+91",
        billing_address: form.sameAsShipping ? {
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          full_name: computedFullName,
          address_line_1: form.addressLine1.trim(),
          address_line_2: form.addressLine2 ? form.addressLine2.trim() : "",
          city: form.city.trim(),
          state: form.state.trim(),
          postal_code: form.pincode.trim(),
          country: form.country || "India"
        } : {
          first_name: form.billingFirstName.trim(),
          last_name: form.billingLastName.trim(),
          full_name: `${form.billingFirstName} ${form.billingLastName}`.trim(),
          address_line_1: form.billingAddressLine1.trim(),
          address_line_2: form.billingAddressLine2 ? form.billingAddressLine2.trim() : "",
          city: form.billingCity.trim(),
          state: form.billingState.trim(),
          postal_code: form.billingPincode.trim(),
          country: form.billingCountry || "India"
        },
        gstin: form.gstin ? form.gstin.trim().toUpperCase() : null,
        business_name: verifiedGstData?.legal_name || null,
        gst_details: verifiedGstData || null,
        whatsapp_updates: form.whatsappUpdates,
        email_marketing: form.emailMarketing,
        notes: form.notes,
        shipping_method: shippingMethod,
        items: mappedItems,
        couponCode: appliedCoupon?.code,
        saveAddress: form.saveAddress,
        verificationToken: verifiedMobileToken,
        verifiedCustomerSessionId: verifiedCustomerSessionId || (typeof window !== 'undefined' ? sessionStorage.getItem('verifiedCustomerSessionId') : null),
        marketing_preferences: {
          whatsapp_marketing_consent: form.whatsappUpdates,
          email_marketing_consent: form.emailMarketing
        },
        updateAddressId: selectedAddressId || undefined
      };

      if (paymentType === 'razorpay') {
        endpoint = '/api/orders/verify-and-create';
        payload = {
          ...payload,
          razorpay_order_id: rzpPayload?.razorpay_order_id,
          razorpay_payment_id: rzpPayload?.razorpay_payment_id,
          razorpay_signature: rzpPayload?.razorpay_signature,
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete order processing on server.');
      }

      // Clear checkout session on successful order
      try {
        sessionStorage.removeItem('kl_checkout_session_id');
        sessionStorage.removeItem('verifiedCustomerSessionId');
      } catch {}

      setCompletedOrder(data.order);
      setEmailDispatchedSuccess(Boolean(data.emailDispatched));
      setStep('success');
      clearCart();
      window.scrollTo(0, 0);
      showToast('Order placed successfully!');
    } catch (err: any) {
      console.error('Server order processing failed:', err);
      const userFriendlyMessage = err.message || 'We could not complete your order. Please try again or contact customer support.';
      setPaymentError(userFriendlyMessage);
      showToast(userFriendlyMessage, 'error');
    } finally {
      setIsPaymentProcessing(false);
      setOpenSimulatedPayment(false);
    }
  };

  const handleSimulatedPaymentSuccess = async () => {
    const mockPaymentId = 'pay_simulated_success_' + Date.now();
    const mockSignature = 'simulated_signature';
    const orderId = simulatedOrderId || 'order_simulated';

    await handleServerOrderCreation('razorpay', {
      razorpay_order_id: orderId,
      razorpay_payment_id: mockPaymentId,
      razorpay_signature: mockSignature
    });
  };

  // Open Razorpay SDK or embed Mock fallback inside iframe
  const handleProceedToPayment = async () => {
    if (!isFormValid()) {
      showToast('Please correct the validation errors in delivery details.', 'error');
      return;
    }

    setPaymentError(null);
    setIsPaymentProcessing(true);

    if (paymentMethod === 'cod') {
      // COD trigger directly via server-authoritative endpoint
      if (grandTotal >= 5000) {
        showToast('Cash on Delivery is restricted to orders under ₹5,000.', 'error');
        setIsPaymentProcessing(false);
        return;
      }
      if (form.country !== 'India') {
        showToast('COD is restricted to Indian domestic delivery only.', 'error');
        setIsPaymentProcessing(false);
        return;
      }
      await handleServerOrderCreation('cod');
      return;
    }

    // Step 1: Create an order on the backend server with authoritative calculation
    let orderData: any;
    try {
      const mappedItems = cart.map(it => ({
        product_id: it.product.id,
        name: it.product.name,
        price: it.product.price,
        quantity: it.quantity,
        size: it.selectedSize,
        color: it.product.color,
        image: it.product.images[0] || ''
      }));

      const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: checkoutSessionId,
          items: mappedItems,
          couponCode: appliedCoupon?.code,
          country: form.country,
          shipping_method: shippingMethod,
          customer_email: form.email,
          customer_phone: form.phone,
          receipt: `rcpt_${Date.now()}`
        })
      });
      if (!response.ok) {
        throw new Error(`Local Express API returned status ${response.status}`);
      }
      orderData = await response.json();
    } catch (err: any) {
      console.warn('Local Express API create-order failed/unconfigured. Generating simulated order...', err);
      orderData = {
        order_id: 'order_simulated_' + Math.random().toString(36).substring(2, 11),
        amount: Math.round(grandTotal * 100),
        currency: 'INR',
        is_simulated: true
      };
    }

    const orderId = orderData.order_id || 'order_simulated_fallback';
    setSimulatedOrderId(orderId);

    if (orderData.is_simulated) {
      console.log('Using simulated order mode. Launching sandbox modal...');
      setOpenSimulatedPayment(true);
      setIsPaymentProcessing(false);
      return;
    }

    // Razorpay Integration
    const rzpKey = (import.meta as any).env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TFgbejfPbqD95I';

    const loadScript = () => {
      return new Promise((resolve) => {
        if ((window as any).Razorpay) {
          resolve(true);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });
    };

    const isLoaded = await loadScript();
    if (!isLoaded) {
      console.warn('Razorpay Script could not load. Triggering embedded simulator.');
      setOpenSimulatedPayment(true);
      setIsPaymentProcessing(false);
      return;
    }

    const options = {
      key: rzpKey,
      amount: orderData.amount,
      currency: orderData.currency,
      name: "Sa and Sha",
      description: "Sa and Sha Checkout",
      order_id: orderId,
      image: "https://www.sa-and-sha.com/logo.png",
      handler: async function (response: any) {
        await handleServerOrderCreation('razorpay', {
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
      },
      prefill: {
        name: form.fullName,
        email: form.email,
        contact: form.phone
      },
      theme: {
        color: "#2A211C"
      },
      modal: {
        ondismiss: function () {
          setIsPaymentProcessing(false);
          showToast('Payment window dismissed by user.', 'error');
        }
      }
    };

    try {
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.warn('Razorpay checkout block (expected inside cross-origin iframe sandbox). Triggering simulator.', err);
      setOpenSimulatedPayment(true);
      setIsPaymentProcessing(false);
    }
  };

  if (cart.length === 0 && step !== 'success') {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-20 text-center space-y-6">
        <div className="w-16 h-16 bg-[#F4E6D7]/20 rounded-full flex items-center justify-center mx-auto text-[#E5D2BC] border border-[#E5D2BC]/30">
          <ShoppingBag className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h2 className="font-serif text-2xl font-bold text-[#2A211C]">Your Shopping Bag is Empty</h2>
          <p className="font-sans text-xs text-[#2A211C]/60 max-w-sm mx-auto">
            Add items to your bag before proceeding to checkout.
          </p>
        </div>
        <div>
          <Link
            to="/shop/all"
            className="bg-[#2A211C] text-[#FBF6EE] hover:bg-[#B08D57] px-8 py-3.5 rounded font-sans font-bold text-xs uppercase tracking-widest transition-colors inline-block"
          >
            Explore Collections
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-4" id="checkout-root">
      
      {/* 1. PROGRESS BREADCRUMBS INDICATOR */}
      {step !== 'success' && (
        <div className="flex flex-wrap justify-center items-center gap-2 md:gap-4 text-[10px] md:text-xs font-sans font-bold uppercase tracking-widest text-[#2A211C]/40 mb-8 max-w-2xl mx-auto border-b border-[#E5D2BC]/10 pb-4">
          <button 
            onClick={() => setStep('cart')}
            className={`transition-colors ${step === 'cart' ? 'text-[#B08D57] underline underline-offset-4' : 'text-[#C98A82] hover:text-[#B08D57]'}`}
          >
            1. Cart Review
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-[#E5D2BC]" />
          
          <button 
            onClick={() => { if (step !== 'cart') setStep('details'); }}
            disabled={step === 'cart'}
            className={`transition-colors disabled:opacity-50 ${step === 'details' ? 'text-[#B08D57] underline underline-offset-4' : step === 'shipping' || step === 'payment' ? 'text-[#C98A82] hover:text-[#B08D57]' : ''}`}
          >
            2. Details
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-[#E5D2BC]" />

          <button 
            onClick={() => { if (step === 'payment') setStep('shipping'); }}
            disabled={step === 'cart' || step === 'details'}
            className={`transition-colors disabled:opacity-50 ${step === 'shipping' ? 'text-[#B08D57] underline underline-offset-4' : step === 'payment' ? 'text-[#C98A82] hover:text-[#B08D57]' : ''}`}
          >
            3. Shipping
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-[#E5D2BC]" />

          <span className={step === 'payment' ? 'text-[#B08D57] underline underline-offset-4' : ''}>
            4. Payment
          </span>
        </div>
      )}

      {/* MAIN VIEW CONTROLS */}
      {step === 'success' ? (
        
        /* Step 5: Order Confirmation Page */
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto bg-white border border-[#E5D2BC]/30 rounded-xl p-6 md:p-10 space-y-8 shadow-sm" 
          id="checkout-success-view"
        >
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-[#C98A82]/10 rounded-full flex items-center justify-center mx-auto border border-[#C98A82]/20">
              <CheckCircle2 className="w-9 h-9 text-[#C98A82]" />
            </div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#2A211C] tracking-tight">Order Confirmed</h1>
            <p className="font-sans text-xs text-[#C98A82] uppercase tracking-widest font-bold">
              Thank you for shopping with us!
            </p>
          </div>

          {/* Ticket styling receipt */}
          <div className="bg-[#FBF6EE]/40 border border-[#E5D2BC]/30 p-5 rounded-lg space-y-4 text-xs font-sans text-[#2A211C]">
            <div className="grid grid-cols-2 gap-4 border-b border-[#E5D2BC]/20 pb-3">
              <div>
                <span className="text-[#2A211C]/50 uppercase tracking-wider text-[9px] block">Order Reference</span>
                <p className="font-bold text-[#2A211C] text-sm mt-0.5">{completedOrder?.order_id}</p>
              </div>
              <div>
                <span className="text-[#2A211C]/50 uppercase tracking-wider text-[9px] block">Shipping Destination</span>
                <p className="font-bold text-[#2A211C] text-sm mt-0.5">{completedOrder?.customer_name}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-b border-[#E5D2BC]/20 pb-3">
              <div>
                <span className="text-[#2A211C]/50 uppercase tracking-wider text-[9px] block">Estimated Delivery</span>
                <p className="font-semibold text-[#C98A82] mt-0.5">
                  {completedOrder?.shipping_method === 'express' ? 'Premium Air (2-3 Business Days)' : completedOrder?.shipping_method === 'international' ? 'International Air Cargo (7-10 Business Days)' : 'Standard Ground (3-5 Business Days)'}
                </p>
              </div>
              <div>
                <span className="text-[#2A211C]/50 uppercase tracking-wider text-[9px] block">Contact Number</span>
                <p className="font-bold text-[#2A211C] mt-0.5">{completedOrder?.customer_phone}</p>
              </div>
            </div>

            <div>
              <span className="text-[#2A211C]/50 uppercase tracking-wider text-[9px] block mb-0.5">Delivery Address</span>
              <p className="font-medium text-[#2A211C]/80 leading-relaxed">
                {completedOrder?.address}, {completedOrder?.city}, {completedOrder?.state} - {completedOrder?.pincode}, {completedOrder?.country}
              </p>
            </div>

            {completedOrder?.notes && (
              <div className="bg-white/60 p-2.5 rounded border border-[#E5D2BC]/25 text-[11px] italic">
                <span className="text-[9px] uppercase tracking-wider text-[#2A211C]/50 block not-italic font-bold">Order Note:</span>
                "{completedOrder.notes}"
              </div>
            )}
          </div>

          {/* Email Notification Note Badge */}
          <div className="bg-[#C98A82]/10 border border-[#C98A82]/20 p-3.5 rounded-lg flex items-start gap-3 text-xs text-[#C98A82] font-sans">
            <Mail className="w-5 h-5 shrink-0 text-[#C98A82] mt-0.5" />
            <div className="space-y-1">
              {emailDispatchedSuccess === true ? (
                <>
                  <span className="font-bold uppercase tracking-wider text-[10px]">Email Confirmation Dispatched</span>
                  <p className="text-[#2A211C]/70 leading-relaxed text-[11px]">
                    A receipt and package tracking estimate have been successfully sent to <strong className="text-stone-900">{completedOrder?.customer_email}</strong>. Our staff has also sent a copy to <strong className="text-stone-900">shop@sa-and-sha.com</strong> to coordinate packing.
                  </p>
                </>
              ) : (
                <>
                  <span className="font-bold uppercase tracking-wider text-[10px]">Order Confirmed</span>
                  <p className="text-[#2A211C]/70 leading-relaxed text-[11px]">
                    Your order has been successfully placed. We’ll send order and shipping updates to your registered email address <strong className="text-stone-900">{completedOrder?.customer_email}</strong>.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Purchased Items List Breakdown */}
          <div className="space-y-3.5">
            <h3 className="font-serif text-sm font-bold text-[#2A211C] uppercase tracking-wider flex items-center gap-2 border-b border-[#E5D2BC]/20 pb-2">
              <ClipboardList className="w-4 h-4 text-[#B08D57]" />
              <span>Items Purchased ({completedOrder?.items?.length})</span>
            </h3>
            <div className="divide-y divide-[#E5D2BC]/10">
              {completedOrder?.items?.map((item: any, idx: number) => (
                <div key={idx} className="py-3 flex justify-between items-center text-xs font-sans">
                  <div className="flex items-center gap-3">
                    {item.image && (
                      <img src={item.image} alt={item.name} className="w-10 h-12 object-cover rounded bg-stone-100" referrerPolicy="no-referrer" />
                    )}
                    <div>
                      <h4 className="font-bold text-[#2A211C]">{item.name}</h4>
                      <p className="text-[#2A211C]/60 mt-0.5">Size: {item.size} | Color: {item.color || 'Standard'} | Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <span className="font-bold text-[#2A211C]">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>

            {/* Price Calculations */}
            <div className="bg-[#FBF6EE]/20 border border-[#E5D2BC]/20 p-4 rounded-lg space-y-2 text-xs font-sans font-medium text-[#2A211C]/80">
              <div className="flex justify-between">
                <span>Items Subtotal:</span>
                <span>₹{completedOrder?.subtotal?.toLocaleString('en-IN')}</span>
              </div>
              {completedOrder?.discount > 0 && (
                <div className="flex justify-between text-[#C98A82]">
                  <span>Promo Coupon Discount:</span>
                  <span>-₹{completedOrder?.discount?.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Shipping Fee:</span>
                <span>{completedOrder?.shipping_cost === 0 ? 'FREE' : `₹${completedOrder?.shipping_cost}`}</span>
              </div>
              <div className="flex justify-between items-center font-bold text-sm text-[#2A211C] border-t border-[#E5D2BC]/20 pt-2.5 mt-1">
                <span>Total Amount paid:</span>
                <span className="text-base text-[#B08D57]">₹{completedOrder?.grand_total?.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Proceed button */}
          <div className="pt-4">
            <button
              onClick={() => navigate('/')}
              className="bg-[#2A211C] hover:bg-[#B08D57] text-white py-3.5 px-8 rounded font-sans font-bold text-xs uppercase tracking-widest transition-colors w-full active:scale-[0.98]"
            >
              Back to Storefront
            </button>
          </div>
        </motion.div>

      ) : (
        
        /* CHECKOUT WORKFLOW STEPS GRID */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT INTERACTIVE PANEL (7 Columns) */}
          <div className={`lg:col-span-7 ${step === 'details' ? 'space-y-6' : 'bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-8'}`}>
            
            {/* STEP 1: CART REVIEW */}
            {step === 'cart' && (
              <div className="space-y-6" id="checkout-cart-step">
                <div className="flex items-center gap-2 border-b border-[#E5D2BC]/20 pb-3">
                  <ShoppingBag className="w-5 h-5 text-[#B08D57]" />
                  <h2 className="font-serif text-lg font-bold text-[#2A211C]">Step 1 — Cart Review</h2>
                </div>

                <div className="divide-y divide-[#E5D2BC]/10 border-b border-[#E5D2BC]/10 pb-4">
                  {cart.map((item, idx) => (
                    <div key={idx} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <img 
                          src={item.product.images[0]} 
                          alt={item.product.name} 
                          className="w-16 h-20 object-cover rounded bg-stone-100 border border-[#E5D2BC]/20" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="space-y-1">
                          <h3 className="font-serif font-bold text-[#2A211C] text-sm">{item.product.name}</h3>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-sans text-[#2A211C]/60">
                            <span>Size: <strong className="text-[#2A211C]">{item.selectedSize}</strong></span>
                            <span>Color: <strong className="text-[#2A211C]">{item.product.color}</strong></span>
                            <span>Fabric: <strong className="text-[#2A211C]">{item.product.fabric}</strong></span>
                          </div>
                          <p className="font-sans text-xs font-semibold text-[#B08D57] mt-1">
                            ₹{item.product.price.toLocaleString('en-IN')} each
                          </p>
                        </div>
                      </div>

                      {/* Controls Row */}
                      <div className="flex items-center justify-between sm:justify-end gap-6 border-t border-[#E5D2BC]/10 pt-3 sm:pt-0 sm:border-0">
                        {/* Quantity adjusters */}
                        <div className="flex items-center border border-[#E5D2BC]/40 rounded overflow-hidden h-8">
                          <button
                            onClick={() => updateCartQuantity(item.product.id, item.selectedSize, item.quantity - 1)}
                            className="px-2.5 hover:bg-stone-50 transition-colors h-full flex items-center text-stone-500"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="text"
                            value={item.quantity}
                            onChange={(e) => {
                              const parsed = parseInt(e.target.value.replace(/\D/g, ''));
                              updateCartQuantity(item.product.id, item.selectedSize, isNaN(parsed) ? 1 : parsed);
                            }}
                            className="w-8 text-center text-xs font-sans font-bold text-[#2A211C] focus:outline-none"
                          />
                          <button
                            onClick={() => updateCartQuantity(item.product.id, item.selectedSize, item.quantity + 1)}
                            className="px-2.5 hover:bg-stone-50 transition-colors h-full flex items-center text-stone-500"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Item subtotal & delete */}
                        <div className="flex items-center gap-4 text-right">
                          <div className="text-xs font-sans">
                            <span className="text-[#2A211C]/50 block text-[9px] uppercase tracking-wider font-semibold">Subtotal</span>
                            <span className="font-bold text-[#2A211C]">₹{(item.product.price * item.quantity).toLocaleString('en-IN')}</span>
                          </div>

                          <button
                            onClick={() => removeFromCart(item.product.id, item.selectedSize)}
                            className="p-1.5 hover:bg-[#B08D57]/10 hover:text-[#B08D57] text-stone-400 rounded transition-all"
                            title="Remove item"
                            aria-label="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center text-stone-800 pt-2 font-sans font-medium text-xs">
                  <span>Cart Items Subtotal:</span>
                  <span className="text-base font-bold text-[#2A211C]">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>

                <button
                  onClick={() => setStep('details')}
                  className="w-full bg-[#2A211C] hover:bg-[#B08D57] text-white py-3.5 rounded font-sans font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
                >
                  <span>Continue to Details</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* STEP 2: VERIFIED CONTACT & DELIVERY DETAILS */}
            {step === 'details' && (
              <div className="space-y-6" id="checkout-details-step">
                
                {/* SECTION: COUNTRY / REGION SELECTION */}
                <div className="bg-[#FAF8F5] border border-[#E5D2BC]/30 rounded-2xl p-6 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <Globe className="w-5 h-5 text-[#B08D57]" />
                      <div>
                        <h2 className="font-serif text-base font-bold text-[#2A211C]">Country / Region</h2>
                        <p className="text-[11px] text-[#2A211C]/60">Currently serving deliveries across India (International expansion coming soon)</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#2A211C]/5 border border-[#E5D2BC]/40 rounded-full text-xs font-bold text-[#2A211C]">
                      <IndiaFlagIcon className="w-4 h-3" />
                      <span>India (+91)</span>
                    </span>
                  </div>
                  <div className="pt-1">
                    <div className="flex items-center w-full border border-[#E5D2BC]/40 rounded-xl bg-white overflow-hidden focus-within:border-[#2A211C] focus-within:ring-2 focus-within:ring-[#2A211C]/10">
                      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#FAF8F5]/80 border-r border-[#E5D2BC]/40 select-none flex-shrink-0">
                        <IndiaFlagIcon className="w-5 h-3.5" />
                        <span className="text-xs font-bold text-[#2A211C]">IN</span>
                      </div>
                      <select
                        name="country"
                        value={form.country}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 text-xs font-semibold bg-transparent focus:outline-none text-[#2A211C] h-[42px] cursor-pointer"
                      >
                        <option value="India">India (Domestic Shipping)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECTION 1: PERSONAL INFORMATION */}
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
                        name="firstName"
                        required
                        value={form.firstName}
                        onChange={handleInputChange}
                        placeholder="e.g. Rahul"
                        className={`w-full px-3.5 py-2.5 bg-stone-50 border rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all ${errors.firstName ? 'border-rose-400 bg-rose-50/20' : 'border-stone-300'}`}
                      />
                      {errors.firstName && <span className="text-[11px] text-rose-500 mt-1 block">{errors.firstName}</span>}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Last Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        required
                        value={form.lastName}
                        onChange={handleInputChange}
                        placeholder="e.g. Sharma"
                        className={`w-full px-3.5 py-2.5 bg-stone-50 border rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all ${errors.lastName ? 'border-rose-400 bg-rose-50/20' : 'border-stone-300'}`}
                      />
                      {errors.lastName && <span className="text-[11px] text-rose-500 mt-1 block">{errors.lastName}</span>}
                    </div>
                  </div>
                </div>

                {/* SECTION 2: PRIMARY CONTACT & SECURITY ANCHOR */}
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
                      <strong>System Governance Rule:</strong> Every order must be anchored to a verified 10-digit Indian mobile number for real-time WhatsApp dispatch updates.
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Mobile Phone Number (India) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-sm font-medium text-stone-500 select-none">
                          +91
                        </span>
                        <input
                          type="tel"
                          name="phone"
                          value={form.phone}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/\D/g, '').substring(0, 10);
                            const updated = { ...form, phone: cleaned };
                            setForm(updated);
                            validateForm(updated);
                            if (verifiedPhone && cleaned !== verifiedPhone) {
                              setIsPhoneVerified(false);
                              setVerifiedPhone(null);
                              setVerifiedMobileToken(null);
                              setVerifiedCustomerSessionId(null);
                              try { sessionStorage.removeItem('verifiedCustomerSessionId'); } catch {}
                              setIsSavedAddressLoaded(false);
                              setSavedProfile(null);
                            }
                          }}
                          placeholder="9876543210"
                          maxLength={10}
                          disabled={isPhoneVerified}
                          required
                          className={`w-full pl-12 pr-3.5 py-2.5 bg-stone-50 border rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all disabled:opacity-75 disabled:cursor-not-allowed ${errors.phone ? 'border-rose-400 bg-rose-50/20' : 'border-stone-300'}`}
                        />
                      </div>
                      {errors.phone && <span className="text-[11px] text-rose-500 mt-1 block font-medium">{errors.phone}</span>}
                    </div>

                    {/* MSG91 Mobile OTP Verification Component */}
                    <Msg91OtpVerification
                      phone={form.phone}
                      country={form.country}
                      isVerified={isPhoneVerified}
                      purpose="checkout"
                      onVerified={(verifiedNum, token, sessionId, directProfile) => {
                        setIsPhoneVerified(true);
                        setVerifiedPhone(verifiedNum);
                        if (token) {
                          setVerifiedMobileToken(token);
                        }
                        if (sessionId) {
                          setVerifiedCustomerSessionId(sessionId);
                          try { sessionStorage.setItem('verifiedCustomerSessionId', sessionId); } catch {}
                        }
                        showToast('Mobile number verified successfully via MSG91 OTP!');

                        // Server-side profile lookup for verified mobile number
                        if (token) {
                          setIsProfileLoading(true);
                          fetch('/api/customer/profile/lookup', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ verificationToken: token, mobile: verifiedNum })
                          })
                            .then(res => res.json())
                            .then(data => {
                              if (data.success && data.found && data.profile) {
                                const p = data.profile;
                                const addrs: CustomerAddress[] = p.addresses || [];
                                setCustomerAddresses(addrs);

                                const defaultAddr = addrs.find(a => a.is_default) || addrs[0] || p.default_address || {};
                                if (defaultAddr && defaultAddr.id) {
                                  setSelectedAddressId(defaultAddr.id);
                                }

                                let profileEmail = (p.email || '').trim().toLowerCase();
                                if (profileEmail === 'shop@sa-and-sha.com') {
                                  profileEmail = '';
                                }

                                const fName = p.first_name || (p.full_name ? p.full_name.split(' ')[0] : form.firstName);
                                const lName = p.last_name || (p.full_name ? p.full_name.split(' ').slice(1).join(' ') : form.lastName);

                                const profileGstin = (p.gstin || p.gst_details?.gstin || '').toString().trim().toUpperCase();
                                const shouldAutofillGstin = profileGstin && (!form.gstin || !form.gstin.trim());
                                const finalGstin = shouldAutofillGstin ? profileGstin : form.gstin;

                                if (shouldAutofillGstin) {
                                  if (p.gst_details) {
                                    setVerifiedGstData(p.gst_details);
                                    setGstVerificationState('verified');
                                  } else if (p.business_name) {
                                    setVerifiedGstData({ legal_name: p.business_name, trade_name: p.business_name, gstin: profileGstin });
                                    setGstVerificationState('verified');
                                  }
                                }

                                const bAddr = p.billing_address;
                                let billingSameAsShipping = form.sameAsShipping;
                                let bFirstName = form.billingFirstName;
                                let bLastName = form.billingLastName;
                                let bAddressLine1 = form.billingAddressLine1;
                                let bAddressLine2 = form.billingAddressLine2;
                                let bCity = form.billingCity;
                                let bState = form.billingState;
                                let bPincode = form.billingPincode;
                                let bCountry = form.billingCountry;

                                if (bAddr) {
                                  const isSame = typeof p.billing_same_as_shipping === 'boolean'
                                    ? p.billing_same_as_shipping
                                    : (typeof bAddr.is_same_as_shipping === 'boolean' ? bAddr.is_same_as_shipping : true);
                                  
                                  billingSameAsShipping = isSame;
                                  bFirstName = bAddr.first_name || fName;
                                  bLastName = bAddr.last_name || lName;
                                  bAddressLine1 = bAddr.address_line_1 || bAddr.address || '';
                                  bAddressLine2 = bAddr.address_line_2 || '';
                                  bCity = bAddr.city || '';
                                  bState = bAddr.state || '';
                                  bPincode = bAddr.postal_code || bAddr.pincode || '';
                                  bCountry = bAddr.country || 'India';
                                }

                                const updatedForm = {
                                  ...form,
                                  firstName: fName,
                                  lastName: lName,
                                  fullName: p.full_name || `${fName} ${lName}`.trim(),
                                  email: profileEmail || form.email,
                                  addressLine1: defaultAddr.address_line_1 || form.addressLine1,
                                  addressLine2: defaultAddr.address_line_2 || form.addressLine2,
                                  city: defaultAddr.city || form.city,
                                  state: defaultAddr.state || form.state,
                                  pincode: defaultAddr.postal_code || form.pincode,
                                  country: defaultAddr.country || 'India',
                                  gstin: finalGstin,
                                  sameAsShipping: billingSameAsShipping,
                                  billingFirstName: bFirstName,
                                  billingLastName: bLastName,
                                  billingAddressLine1: bAddressLine1,
                                  billingAddressLine2: bAddressLine2,
                                  billingCity: bCity,
                                  billingState: bState,
                                  billingPincode: bPincode,
                                  billingCountry: bCountry,
                                  saveAddress: true
                                };
                                setForm(updatedForm);
                                validateForm(updatedForm);
                                setSavedProfile(p);
                                setIsSavedAddressLoaded(true);

                                if (p.marketing_preferences) {
                                  setMarketingPreferences({
                                    email_marketing_consent: Boolean(p.marketing_preferences.email_marketing_consent),
                                    sms_marketing_consent: Boolean(p.marketing_preferences.sms_marketing_consent),
                                    whatsapp_marketing_consent: Boolean(p.marketing_preferences.whatsapp_marketing_consent),
                                    voice_call_consent: Boolean(p.marketing_preferences.voice_call_consent)
                                  });
                                }
                                showToast('Welcome back — saved profile and address auto-filled!');
                              } else {
                                setIsSavedAddressLoaded(false);
                                setSavedProfile(null);
                                setCustomerAddresses([]);
                              }
                            })
                            .catch(err => {
                              console.warn('Customer profile lookup failed:', err);
                            })
                            .finally(() => {
                              setIsProfileLoading(false);
                            });
                        }
                      }}
                      onResetVerification={() => {
                        setIsPhoneVerified(false);
                        setVerifiedPhone(null);
                        setVerifiedMobileToken(null);
                        setVerifiedCustomerSessionId(null);
                        try { sessionStorage.removeItem('verifiedCustomerSessionId'); } catch {}
                        setIsSavedAddressLoaded(false);
                        setSavedProfile(null);
                      }}
                    />
                  </div>
                </div>

                {/* SECTION 3: EMAIL ADDRESS */}
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
                      name="email"
                      required
                      value={form.email}
                      onChange={handleInputChange}
                      placeholder="e.g. rahul.sharma@example.com"
                      className={`w-full px-3.5 py-2.5 bg-stone-50 border rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all ${errors.email ? 'border-rose-400 bg-rose-50/20' : 'border-stone-300'}`}
                    />
                    {errors.email ? (
                      <span className="text-[11px] text-rose-500 mt-1 block">{errors.email}</span>
                    ) : (
                      <p className="text-[11px] text-stone-500 mt-1">
                        Used for digital tax invoices and shipping confirmation emails.
                      </p>
                    )}
                  </div>
                </div>

                {/* SECTION 4: PRIMARY SHIPPING ADDRESS */}
                <div className={`bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4 transition-all ${!isPhoneVerified ? 'opacity-90' : ''}`}>
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-2 text-stone-900">
                      <MapPin className="w-5 h-5 text-stone-700" />
                      <h2 className="font-serif text-lg font-medium">4. Primary Shipping Address</h2>
                    </div>

                    {isSavedAddressLoaded && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Profile Loaded
                      </span>
                    )}
                  </div>

                  {isProfileLoading && (
                    <div className="flex items-center justify-center py-4 gap-2 text-xs text-stone-600">
                      <Loader2 className="w-4 h-4 animate-spin text-stone-700" />
                      <span>Checking verified customer profile...</span>
                    </div>
                  )}

                  {isSavedAddressLoaded && savedProfile && (
                    <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 text-xs text-stone-900">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            Welcome Back, {form.firstName ? `${form.firstName} ${form.lastName}` : (form.fullName || 'Valued Customer')}
                          </p>
                          <p className="text-stone-600 text-[11px] mt-0.5">
                            Saved profile auto-populated with {customerAddresses.length} saved address{customerAddresses.length === 1 ? '' : 'es'}.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsAddressModalOpen(true)}
                            className="px-3 py-1.5 bg-stone-900 text-white rounded-xl text-xs font-medium hover:bg-stone-800 transition-colors flex items-center gap-1.5"
                          >
                            <MapPin className="w-3.5 h-3.5 text-amber-400" />
                            <span>Address Book ({customerAddresses.length})</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setForm(prev => ({
                                ...prev,
                                firstName: '',
                                lastName: '',
                                fullName: '',
                                addressLine1: '',
                                addressLine2: '',
                                city: '',
                                state: '',
                                pincode: ''
                              }));
                              setSelectedAddressId(null);
                              setIsSavedAddressLoaded(false);
                              showToast('Cleared shipping fields to enter a new address.');
                            }}
                            className="text-xs text-stone-600 underline font-medium hover:text-stone-900"
                          >
                            Clear & enter new
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Address Line 1 <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="addressLine1"
                        required
                        value={form.addressLine1}
                        onChange={handleInputChange}
                        placeholder="House / Flat No., Building Name, Street"
                        className={`w-full px-3.5 py-2.5 bg-stone-50 border rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all ${errors.addressLine1 ? 'border-rose-400 bg-rose-50/20' : 'border-stone-300'}`}
                      />
                      {errors.addressLine1 && <span className="text-[11px] text-rose-500 mt-1 block">{errors.addressLine1}</span>}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Address Line 2
                      </label>
                      <input
                        type="text"
                        name="addressLine2"
                        value={form.addressLine2}
                        onChange={handleInputChange}
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
                            name="pincode"
                            required
                            maxLength={6}
                            value={form.pincode}
                            onChange={handleInputChange}
                            placeholder="110001"
                            className={`w-full px-3.5 py-2.5 bg-stone-50 border rounded-xl text-sm font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all ${errors.pincode ? 'border-rose-400 bg-rose-50/20' : 'border-stone-300'}`}
                          />
                          {isPincodeLoading && (
                            <Loader2 className="w-4 h-4 animate-spin text-stone-500 absolute right-3 top-3" />
                          )}
                        </div>
                        {errors.pincode && <span className="text-[11px] text-rose-500 mt-1 block">{errors.pincode}</span>}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          City <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="city"
                          required
                          value={form.city}
                          onChange={handleInputChange}
                          placeholder="New Delhi"
                          className={`w-full px-3.5 py-2.5 bg-stone-50 border rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all ${errors.city ? 'border-rose-400 bg-rose-50/20' : 'border-stone-300'}`}
                        />
                        {errors.city && <span className="text-[11px] text-rose-500 mt-1 block">{errors.city}</span>}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          State <span className="text-rose-500">*</span>
                        </label>
                        <select
                          name="state"
                          value={form.state}
                          onChange={handleInputChange}
                          className={`w-full px-3.5 py-2.5 bg-stone-50 border rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all ${errors.state ? 'border-rose-400 bg-rose-50/20' : 'border-stone-300'}`}
                        >
                          <option value="">Select State</option>
                          {INDIAN_STATES.map((s, i) => (
                            <option key={i} value={s}>{s}</option>
                          ))}
                        </select>
                        {errors.state && <span className="text-[11px] text-rose-500 mt-1 block">{errors.state}</span>}
                      </div>
                    </div>

                    {/* Save information checkbox */}
                    <div className="pt-2 border-t border-stone-100">
                      <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-800">
                        <input
                          type="checkbox"
                          id="saveAddressCheckbox"
                          name="saveAddress"
                          checked={form.saveAddress}
                          onChange={handleInputChange}
                          className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300 cursor-pointer"
                        />
                        <span>Save this information for next time</span>
                      </label>
                    </div>

                    {/* Order Notes */}
                    <div className="pt-2">
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Delivery Instructions / Notes (Optional)
                      </label>
                      <textarea
                        name="notes"
                        value={form.notes}
                        onChange={handleInputChange}
                        placeholder="e.g. Please call before delivery, or leave at front desk."
                        rows={2}
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 5: BILLING ADDRESS */}
                <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-2 text-stone-900">
                      <Building2 className="w-5 h-5 text-stone-700" />
                      <h2 className="font-serif text-lg font-medium">5. Billing Address</h2>
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-800">
                      <input
                        type="checkbox"
                        name="sameAsShipping"
                        checked={form.sameAsShipping}
                        onChange={(e) => {
                          const updated = { ...form, sameAsShipping: e.target.checked };
                          setForm(updated);
                          validateForm(updated);
                        }}
                        className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300 cursor-pointer"
                      />
                      <span>Same as shipping address</span>
                    </label>
                  </div>

                  {!form.sameAsShipping && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-4 pt-1"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1">
                            Billing First Name <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            name="billingFirstName"
                            value={form.billingFirstName}
                            onChange={handleInputChange}
                            placeholder="First Name"
                            className={`w-full px-3.5 py-2.5 bg-stone-50 border rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all ${errors.billingFirstName ? 'border-rose-400' : 'border-stone-300'}`}
                          />
                          {errors.billingFirstName && <span className="text-[11px] text-rose-500 mt-1 block">{errors.billingFirstName}</span>}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1">
                            Billing Last Name <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            name="billingLastName"
                            value={form.billingLastName}
                            onChange={handleInputChange}
                            placeholder="Last Name"
                            className={`w-full px-3.5 py-2.5 bg-stone-50 border rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all ${errors.billingLastName ? 'border-rose-400' : 'border-stone-300'}`}
                          />
                          {errors.billingLastName && <span className="text-[11px] text-rose-500 mt-1 block">{errors.billingLastName}</span>}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Billing Address Line 1 <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="billingAddressLine1"
                          value={form.billingAddressLine1}
                          onChange={handleInputChange}
                          placeholder="House / Flat No., Building Name, Street"
                          className={`w-full px-3.5 py-2.5 bg-stone-50 border rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all ${errors.billingAddressLine1 ? 'border-rose-400' : 'border-stone-300'}`}
                        />
                        {errors.billingAddressLine1 && <span className="text-[11px] text-rose-500 mt-1 block">{errors.billingAddressLine1}</span>}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Billing Address Line 2
                        </label>
                        <input
                          type="text"
                          name="billingAddressLine2"
                          value={form.billingAddressLine2}
                          onChange={handleInputChange}
                          placeholder="Landmark, Area (Optional)"
                          className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1">
                            Billing PIN Code <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            name="billingPincode"
                            value={form.billingPincode}
                            onChange={handleInputChange}
                            maxLength={6}
                            placeholder="110001"
                            className={`w-full px-3.5 py-2.5 bg-stone-50 border rounded-xl text-sm font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all ${errors.billingPincode ? 'border-rose-400' : 'border-stone-300'}`}
                          />
                          {errors.billingPincode && <span className="text-[11px] text-rose-500 mt-1 block">{errors.billingPincode}</span>}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1">
                            Billing City <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            name="billingCity"
                            value={form.billingCity}
                            onChange={handleInputChange}
                            placeholder="City"
                            className={`w-full px-3.5 py-2.5 bg-stone-50 border rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all ${errors.billingCity ? 'border-rose-400' : 'border-stone-300'}`}
                          />
                          {errors.billingCity && <span className="text-[11px] text-rose-500 mt-1 block">{errors.billingCity}</span>}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1">
                            Billing State <span className="text-rose-500">*</span>
                          </label>
                          <select
                            name="billingState"
                            value={form.billingState}
                            onChange={handleInputChange}
                            className={`w-full px-3.5 py-2.5 bg-stone-50 border rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all ${errors.billingState ? 'border-rose-400' : 'border-stone-300'}`}
                          >
                            <option value="">Select State</option>
                            {INDIAN_STATES.map((s, i) => (
                              <option key={i} value={s}>{s}</option>
                            ))}
                          </select>
                          {errors.billingState && <span className="text-[11px] text-rose-500 mt-1 block">{errors.billingState}</span>}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* SECTION 6: BUSINESS GST INFORMATION (OPTIONAL) */}
                <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-2 text-stone-900">
                      <Building className="w-5 h-5 text-stone-700" />
                      <h2 className="font-serif text-lg font-medium">6. Business GST Information (Optional)</h2>
                    </div>
                  </div>

                  <GstVerificationSection
                    gstin={form.gstin}
                    onGstinChange={(val) => {
                      setForm(prev => ({ ...prev, gstin: val }));
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
                    theme="stone"
                  />
                </div>

                {/* SECTION 7: COMMUNICATION & PRIVACY PREFERENCES */}
                <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 text-stone-900 border-b border-stone-100 pb-3">
                    <Bell className="w-5 h-5 text-stone-700" />
                    <h2 className="font-serif text-lg font-medium">7. Communication & Privacy Preferences</h2>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="whatsappUpdates"
                        checked={form.whatsappUpdates}
                        onChange={handleInputChange}
                        className="mt-0.5 w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300 cursor-pointer"
                      />
                      <span className="text-xs text-stone-700 leading-snug">
                        Receive instant order confirmation & tracking updates on <strong>WhatsApp</strong>.
                      </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="emailMarketing"
                        checked={form.emailMarketing}
                        onChange={handleInputChange}
                        className="mt-0.5 w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300 cursor-pointer"
                      />
                      <span className="text-xs text-stone-700 leading-snug">
                        Subscribe to private collection drops, seasonal edits, and member events.
                      </span>
                    </label>
                  </div>
                </div>

                {/* NAVIGATION BUTTONS */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('cart')}
                    className="py-3.5 px-6 border border-stone-300 text-stone-700 hover:text-stone-900 rounded-xl text-xs font-medium hover:bg-stone-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Cart</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isPhoneVerified) {
                        showToast('Please verify your mobile number with OTP before proceeding.', 'error');
                        return;
                      }
                      if (validateForm()) {
                        setStep('shipping');
                      } else {
                        showToast('Please complete all required fields correctly.', 'error');
                      }
                    }}
                    className="bg-stone-900 hover:bg-stone-800 text-white py-3.5 px-6 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
                  >
                    <span>Shipping Method</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: SHIPPING METHOD */}
            {step === 'shipping' && (
              <div className="space-y-6" id="checkout-shipping-step">
                <div className="flex items-center gap-2 border-b border-[#E5D2BC]/20 pb-3">
                  <Truck className="w-5 h-5 text-[#B08D57]" />
                  <h2 className="font-serif text-lg font-bold text-[#2A211C]">Step 3 — Shipping Options</h2>
                </div>

                {form.country === 'India' ? (
                  /* Domestic choices */
                  <div className="space-y-4">
                    <span className="text-[10px] font-sans font-bold uppercase text-[#2A211C]/50">Choose domestic shipping speed:</span>
                    
                    {/* Standard Shipping */}
                    <label className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                      shippingMethod === 'standard' ? 'border-[#B08D57] bg-[#F4E6D7]/10' : 'border-[#E5D2BC]/30 bg-white hover:border-[#2A211C]'
                    }`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          checked={shippingMethod === 'standard'}
                          onChange={() => setShippingMethod('standard')}
                          className="text-[#B08D57] focus:ring-[#B08D57] w-4 h-4"
                        />
                        <div className="text-xs font-sans text-[#2A211C]">
                          <p className="font-bold">Standard Ground Delivery</p>
                          <p className="text-[#2A211C]/60 mt-0.5">Delivery within 3-5 business days. Safe & contactless.</p>
                        </div>
                      </div>
                      <span className="font-sans text-xs font-bold text-[#2A211C]">
                        {subtotal >= 2999 ? 'FREE' : '₹99'}
                      </span>
                    </label>

                    {/* Express Shipping */}
                    <label className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                      shippingMethod === 'express' ? 'border-[#B08D57] bg-[#F4E6D7]/10' : 'border-[#E5D2BC]/30 bg-white hover:border-[#2A211C]'
                    }`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          checked={shippingMethod === 'express'}
                          onChange={() => setShippingMethod('express')}
                          className="text-[#B08D57] focus:ring-[#B08D57] w-4 h-4"
                        />
                        <div className="text-xs font-sans text-[#2A211C]">
                          <p className="font-bold">Premium Air Express Courier</p>
                          <p className="text-[#2A211C]/60 mt-0.5">Guaranteed delivery within 2-3 business days.</p>
                        </div>
                      </div>
                      <span className="font-sans text-xs font-bold text-[#2A211C]">₹199</span>
                    </label>
                  </div>
                ) : (
                  /* International Choice */
                  <div className="space-y-4">
                    <span className="text-[10px] font-sans font-bold uppercase text-[#2A211C]/50">International Shipping selection:</span>
                    
                    <div className="p-4 rounded-lg border border-[#B08D57] bg-[#F4E6D7]/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-sans text-[#2A211C]">
                          <p className="font-bold">Global Cargo Express to {form.country}</p>
                          <p className="text-[#2A211C]/60 mt-0.5">Delivered safely via UPS/FedEx in 7-10 business days.</p>
                        </div>
                        <span className="font-sans text-xs font-bold text-[#2A211C] text-right">
                          ₹{customIntlRate.toLocaleString('en-IN')}
                        </span>
                      </div>

                      {/* Customizable International Shipping input */}
                      <div className="pt-2 border-t border-[#E5D2BC]/20 text-xs font-sans">
                        {isEditingIntlRate ? (
                          <div className="flex items-center gap-2">
                            <span className="text-stone-500 font-bold">₹</span>
                            <input
                              type="number"
                              value={customIntlRate}
                              onChange={(e) => setCustomIntlRate(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-24 px-2 py-1 border border-[#E5D2BC]/40 rounded text-xs focus:outline-none"
                            />
                            <button
                              onClick={() => setIsEditingIntlRate(false)}
                              className="bg-[#2A211C] text-white px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <p className="text-[#2A211C]/60 text-[11px]">
                            Customs fees might apply.{' '}
                            <button
                              onClick={() => setIsEditingIntlRate(true)}
                              className="text-[#B08D57] underline font-bold"
                            >
                              Edit Shipping Rate
                            </button>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Subtotal review summary card */}
                <div className="bg-[#FBF6EE] border border-[#E5D2BC]/30 p-4 rounded-lg text-xs font-sans text-[#2A211C] space-y-1">
                  <p className="font-bold uppercase tracking-wider text-[9px] text-[#2A211C]/50">Consignee Address Recap:</p>
                  <p className="font-bold">{form.fullName} | {form.phone}</p>
                  <p className="font-medium text-[#2A211C]/80">{form.addressLine1}, {form.city}, {form.state} - {form.pincode}, {form.country}</p>
                  <button onClick={() => setStep('details')} className="text-[#B08D57] font-bold uppercase text-[9px] tracking-widest hover:underline mt-1">Edit Info</button>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <button
                    onClick={() => setStep('details')}
                    className="py-3.5 border border-[#E5D2BC] text-[#2A211C] rounded text-xs font-sans font-bold uppercase tracking-widest hover:bg-[#2A211C]/5 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Details</span>
                  </button>
                  <button
                    onClick={() => setStep('payment')}
                    className="bg-[#2A211C] hover:bg-[#B08D57] text-white py-3.5 rounded font-sans font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.99]"
                  >
                    <span>Proceed to Payment</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: PAYMENT SELECTIONS */}
            {step === 'payment' && (
              <div className="space-y-6" id="checkout-payment-step">
                <div className="flex items-center gap-2 border-b border-[#E5D2BC]/20 pb-3">
                  <CreditCard className="w-5 h-5 text-[#B08D57]" />
                  <h2 className="font-serif text-lg font-bold text-[#2A211C]">Step 4 — Secure Checkout & Payment</h2>
                </div>

                <div className="space-y-4">
                  
                  {/* Razorpay Option */}
                  <label className={`flex items-start justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                    paymentMethod === 'razorpay' ? 'border-[#B08D57] bg-[#F4E6D7]/10' : 'border-[#E5D2BC]/30 bg-white hover:border-[#2A211C]'
                  }`}>
                    <div className="flex gap-3">
                      <input
                        type="radio"
                        checked={paymentMethod === 'razorpay'}
                        onChange={() => setPaymentMethod('razorpay')}
                        className="text-[#B08D57] focus:ring-[#B08D57] w-4 h-4 mt-0.5"
                      />
                      <div className="text-xs font-sans text-[#2A211C]">
                        <p className="font-bold">Razorpay Online Gateway</p>
                        <p className="text-[#2A211C]/60 mt-0.5">Cards, UPI apps (GPay, PhonePe), Netbanking, and Wallets.</p>
                      </div>
                    </div>
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/commons/8/89/Razorpay_logo.svg" 
                      alt="Razorpay" 
                      className="h-4 mt-1 object-contain grayscale opacity-60" 
                    />
                  </label>

                  {/* Cash on Delivery (COD) */}
                  <label className={`flex items-start justify-between p-4 rounded-lg border transition-all ${
                    grandTotal >= 5000 || form.country !== 'India'
                      ? 'opacity-50 cursor-not-allowed border-[#E5D2BC]/20 bg-stone-50'
                      : paymentMethod === 'cod' 
                        ? 'border-[#B08D57] bg-[#F4E6D7]/10 cursor-pointer' 
                        : 'border-[#E5D2BC]/30 bg-white hover:border-[#2A211C] cursor-pointer'
                  }`}>
                    <div className="flex gap-3">
                      <input
                        type="radio"
                        name="payment_choice"
                        disabled={grandTotal >= 5000 || form.country !== 'India'}
                        checked={paymentMethod === 'cod'}
                        onChange={() => setPaymentMethod('cod')}
                        className="text-[#B08D57] focus:ring-[#B08D57] w-4 h-4 mt-0.5 disabled:opacity-30"
                      />
                      <div className="text-xs font-sans text-[#2A211C]">
                        <p className="font-bold">Cash on Delivery (COD)</p>
                        <p className="text-[#2A211C]/60 mt-0.5">Pay with cash or UPI scan at your doorstep upon receipt.</p>
                        
                        {grandTotal >= 5000 && (
                          <p className="text-red-500 text-[10px] font-bold mt-1.5">
                            * Restricted to transactions under ₹5,000. Current order total: ₹{grandTotal.toLocaleString('en-IN')}.
                          </p>
                        )}
                        {form.country !== 'India' && (
                          <p className="text-red-500 text-[10px] font-bold mt-1.5">
                            * Restricted to domestic India shipping only.
                          </p>
                        )}
                      </div>
                    </div>
                  </label>
                </div>

                {/* Secure Seal Badges */}
                <div className="p-3 bg-[#C98A82]/10 border border-[#C98A82]/20 rounded flex items-center gap-3 text-xs text-[#C98A82] font-sans">
                  <ShieldCheck className="w-5 h-5 shrink-0" />
                  <span className="font-semibold leading-normal">
                    Secure checkout guaranteed. Transactions are tokenized and protected under standard 256-Bit SSL encryption.
                  </span>
                </div>

                {/* Error Banner */}
                {paymentError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-500 font-sans font-medium">
                    {paymentError}
                  </div>
                )}

                {/* Action CTA Buttons */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <button
                    onClick={() => setStep('shipping')}
                    className="py-3.5 border border-[#E5D2BC] text-[#2A211C] rounded text-xs font-sans font-bold uppercase tracking-widest hover:bg-[#2A211C]/5 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Shipping</span>
                  </button>
                  <button
                    onClick={handleProceedToPayment}
                    disabled={isPaymentProcessing}
                    className="bg-[#B08D57] hover:bg-[#B08D57]/90 disabled:bg-[#B08D57]/50 text-white py-3.5 rounded text-xs font-sans font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99] disabled:cursor-not-allowed"
                    id="checkout-payment-btn"
                  >
                    {isPaymentProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Processing Payment...</span>
                      </>
                    ) : (
                      <span>Place Order (₹{grandTotal.toLocaleString('en-IN')})</span>
                    )}
                  </button>
                </div>

                {/* Trust Badges */}
                <div className="grid grid-cols-3 gap-3 pt-6 border-t border-[#E5D2BC]/20 text-center font-sans">
                  <div className="space-y-1 bg-[#FBF6EE]/20 p-2.5 rounded border border-[#E5D2BC]/10">
                    <ShieldCheck className="w-5 h-5 mx-auto text-[#C98A82]" />
                    <span className="block text-[9px] font-bold text-[#2A211C]/80 uppercase tracking-wider">Secure Payment</span>
                    <span className="block text-[8px] text-[#2A211C]/50">Razorpay Verified</span>
                  </div>
                  <div className="space-y-1 bg-[#FBF6EE]/20 p-2.5 rounded border border-[#E5D2BC]/10">
                    <Sparkles className="w-5 h-5 mx-auto text-[#B08D57]" />
                    <span className="block text-[9px] font-bold text-[#2A211C]/80 uppercase tracking-wider">Quality Guarantee</span>
                    <span className="block text-[8px] text-[#2A211C]/50">Pre-shrunk where applicable</span>
                  </div>
                  <div className="space-y-1 bg-[#FBF6EE]/20 p-2.5 rounded border border-[#E5D2BC]/10">
                    <Truck className="w-5 h-5 mx-auto text-stone-500" />
                    <span className="block text-[9px] font-bold text-[#2A211C]/80 uppercase tracking-wider">Easy Exchange</span>
                    <span className="block text-[8px] text-[#2A211C]/50">7-Day Doorstep Pickup</span>
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* RIGHT SIDEBAR ORDER SUMMARY PANEL (5 Columns) */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-6 sticky top-28" id="checkout-sidebar-summary">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-serif text-lg font-medium text-stone-900">
                Shopping Bag Summary ({cart.length})
              </h3>
              <span className="text-xs font-medium px-2.5 py-1 bg-stone-100 text-stone-700 rounded-lg">
                {cart.reduce((sum, item) => sum + item.quantity, 0)} {cart.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Scrollable list items */}
            <div className="max-h-[260px] overflow-y-auto divide-y divide-stone-100 pr-1 space-y-3">
              {cart.map((item, idx) => (
                <div key={idx} className="pt-3 flex justify-between items-center text-xs">
                  <div className="flex items-center gap-3">
                    <img 
                      src={item.product.images[0]} 
                      alt={item.product.name} 
                      className="w-12 h-14 object-cover rounded-xl bg-stone-100 border border-stone-200" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="space-y-0.5">
                      <h4 className="font-medium text-stone-900 truncate max-w-[170px]">{item.product.name}</h4>
                      <p className="text-stone-500 text-[11px]">
                        Size: {item.selectedSize} • Qty: {item.quantity}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-stone-900 whitespace-nowrap">
                    ₹{(item.product.price * item.quantity).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>

            {/* Billing table details */}
            <div className="border-t border-stone-100 pt-4 space-y-3 text-xs text-stone-700 font-medium">
              <div className="flex justify-between">
                <span className="text-stone-600">Items Subtotal:</span>
                <span className="font-semibold text-stone-900">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>

              {appliedCoupon ? (
                <div className="flex justify-between text-emerald-700 items-center bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Coupon ({appliedCoupon.code}) applied:</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">-₹{discount.toLocaleString('en-IN')}</span>
                    <button onClick={handleRemoveCoupon} className="text-rose-600 font-medium hover:underline text-[11px]">Remove</button>
                  </div>
                </div>
              ) : (
                /* Coupon application box */
                <div className="pt-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Coupon Code (e.g. SANDSHA10)"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      className="flex-grow px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs uppercase focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all font-mono"
                    />
                    <button
                      onClick={() => handleApplyCoupon(couponInput)}
                      disabled={isApplyingCoupon}
                      className="bg-stone-900 hover:bg-stone-800 text-white px-4 rounded-xl text-xs font-medium transition-all flex items-center justify-center cursor-pointer shrink-0"
                    >
                      {isApplyingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply'}
                    </button>
                  </div>
                  {couponError && <span className="text-[11px] text-rose-500 mt-1 block font-medium">{couponError}</span>}
                  <span className="text-[10px] text-stone-400 mt-1 block">Try: SANDSHA10 (10%), FRESH15 (15%), WELCOME20 (20%)</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-stone-600">Shipping Cost:</span>
                <span className="font-medium text-stone-900">{shippingCost === 0 ? 'FREE' : `₹${shippingCost}`}</span>
              </div>

              <div className="border-t border-stone-100 pt-3 flex justify-between items-center text-sm font-semibold text-stone-900">
                <span>Grand Total Amount:</span>
                <span className="text-base font-bold text-stone-900">₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* SECURE PAYMENT SIMULATOR MODAL (Solves iframe sandbox blocks elegantly!) */}
      <AnimatePresence>
        {openSimulatedPayment && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#FBF6EE] rounded-xl shadow-2xl max-w-md w-full p-6 border-2 border-[#E5D2BC] relative text-[#2A211C]"
            >
              {/* Close out */}
              <button
                onClick={() => {
                  setOpenSimulatedPayment(false);
                  setIsPaymentProcessing(false);
                  showToast('Payment window dismissed.', 'error');
                }}
                className="absolute right-4 top-4 p-1 rounded-full hover:bg-stone-200 text-[#2A211C] transition-colors"
                aria-label="Close"
              >
                <XCircle className="w-5 h-5" />
              </button>

              <div className="text-center space-y-2 border-b border-[#E5D2BC]/30 pb-4 mb-4">
                <div className="w-10 h-10 bg-[#B08D57]/15 rounded-full flex items-center justify-center mx-auto text-[#B08D57] border border-[#B08D57]/20">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-lg font-bold text-[#2A211C]">Razorpay Gateway Sandbox</h3>
                <p className="font-sans text-[11px] text-[#2A211C]/60">
                  Securing order checkout of <strong>₹{grandTotal.toLocaleString('en-IN')}</strong>
                </p>
              </div>

              {/* Sandbox choices */}
              <div className="space-y-4 font-sans text-xs">
                
                {/* Simulated payment trigger form */}
                <div className="bg-white p-4 rounded border border-[#E5D2BC]/30 space-y-3">
                  <p className="font-bold text-[10px] uppercase text-[#B08D57] tracking-wider">Simulated Card Details</p>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-3 flex flex-col gap-1">
                      <label className="text-[9px] font-bold text-stone-500 uppercase">Card Number</label>
                      <input
                        type="text"
                        placeholder="4111 2222 3333 4444"
                        maxLength={19}
                        value={simulatedCard.number}
                        onChange={(e) => setSimulatedCard(prev => ({ 
                          ...prev, 
                          number: e.target.value.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ') 
                        }))}
                        className="py-1.5 px-2.5 border border-[#E5D2BC]/40 rounded bg-stone-50 text-xs text-[#2A211C] font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-stone-500 uppercase">Expiry Date</label>
                      <input
                        type="text"
                        placeholder="MM / YY"
                        maxLength={5}
                        value={simulatedCard.expiry}
                        onChange={(e) => setSimulatedCard(prev => ({ 
                          ...prev, 
                          expiry: e.target.value.replace(/\D/g, '').replace(/(\d{2})(?=\d)/g, '$1/') 
                        }))}
                        className="py-1.5 px-2.5 border border-[#E5D2BC]/40 rounded bg-stone-50 text-xs text-[#2A211C] font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-stone-500 uppercase">CVV</label>
                      <input
                        type="password"
                        placeholder="***"
                        maxLength={3}
                        value={simulatedCard.cvv}
                        onChange={(e) => setSimulatedCard(prev => ({ 
                          ...prev, 
                          cvv: e.target.value.replace(/\D/g, '') 
                        }))}
                        className="py-1.5 px-2.5 border border-[#E5D2BC]/40 rounded bg-stone-50 text-xs text-[#2A211C] font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded border border-[#E5D2BC]/30 space-y-2">
                  <p className="font-bold text-[10px] uppercase text-[#B08D57] tracking-wider">Simulated UPI App</p>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-stone-500 uppercase">UPI ID / VPA</label>
                    <input
                      type="text"
                      placeholder="e.g. rahul@okhdfcbank"
                      value={simulatedUpiId}
                      onChange={(e) => setSimulatedUpiId(e.target.value)}
                      className="py-1.5 px-2.5 border border-[#E5D2BC]/40 rounded bg-stone-50 text-xs text-[#2A211C] font-bold"
                    />
                  </div>
                </div>

                {/* Simulated gateway buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleSimulatedPaymentSuccess}
                    className="w-full bg-[#C98A82] hover:bg-[#C98A82]/90 text-white font-sans font-bold uppercase tracking-widest py-3 rounded transition-colors text-[11px]"
                  >
                    Authorize Successful Payment (Success Simulation)
                  </button>
                  <button
                    onClick={() => {
                      setPaymentError('The payment bank terminal rejected the card transaction request. Please retry or pick another method.');
                      setOpenSimulatedPayment(false);
                      setIsPaymentProcessing(false);
                      showToast('Payment rejected.', 'error');
                    }}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-sans font-bold uppercase tracking-widest py-3 rounded transition-colors text-[11px]"
                  >
                    Decline Transaction Request (Failure Simulation)
                  </button>
                </div>

                <div className="flex items-center gap-2 justify-center text-stone-500 text-[10px] pt-1">
                  <ShieldCheck className="w-4 h-4 text-[#C98A82]" />
                  <span>256-Bit SSL tokenised simulated connection.</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CUSTOMER ADDRESS BOOK MODAL */}
      <CustomerAddressBookModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        verificationToken={verifiedMobileToken || ''}
        mobile={verifiedPhone || form.phone}
        addresses={customerAddresses}
        selectedAddressId={selectedAddressId || undefined}
        onSelectAddress={(addr) => {
          setSelectedAddressId(addr.id);
          setForm(f => ({
            ...f,
            fullName: addr.recipient_name || f.fullName,
            addressLine1: addr.address_line_1,
            addressLine2: addr.address_line_2 || '',
            city: addr.city,
            state: addr.state,
            pincode: addr.postal_code,
            country: addr.country || 'India'
          }));
          showToast(`Selected address: ${addr.label} (${addr.city})`);
        }}
        onAddressesUpdated={(updated) => {
          setCustomerAddresses(updated);
        }}
      />

    </div>
  );
};
