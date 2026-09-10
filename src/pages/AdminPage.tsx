import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Lock, 
  Mail, 
  KeyRound, 
  Search, 
  Filter, 
  Eye, 
  ChevronDown, 
  CheckCircle2, 
  Truck, 
  X, 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp, 
  ShoppingBag, 
  Users, 
  DollarSign, 
  LogOut, 
  Calendar,
  Phone,
  MapPin,
  Clock,
  ArrowRight,
  Package,
  Plus,
  Trash2,
  Edit,
  Upload,
  Image as ImageIcon,
  ShieldCheck,
  QrCode,
  Smartphone,
  RotateCcw,
  Tag,
  Percent,
  Link2 as LinkIcon,
  Copy,
  Radio,
  Award,
  FileText,
  Sliders
} from 'lucide-react';
import { HomepageMediaAdmin } from '../components/admin/HomepageMediaAdmin';
import { useShop } from '../context/ShopContext';
import { Product, Promotion } from '../types';
import { AdminCustomersTab } from '../components/AdminCustomersTab';
import { AdminCommunicationTab } from '../components/AdminCommunicationTab';
import { AdminIdentityManagementTab } from '../components/AdminIdentityManagementTab';
import { AdminReturnsTab } from '../components/admin-returns/AdminReturnsTab';
import { TaxMasterAdminTab } from '../components/admin/TaxMasterAdminTab';
import { RewardsPolicySettings } from '../components/admin/RewardsPolicySettings';
import { AdminCreditNotesTab } from '../components/admin/AdminCreditNotesTab';
import {
  CANONICAL_COLLECTIONS,
  CANONICAL_PRODUCT_TYPES,
  CANONICAL_PRODUCT_SUB_TYPES,
  CANONICAL_MATERIAL_TYPES,
  SELECTABLE_TAX_CLASSES,
  getAvailableProductTypesForCollection,
  getAvailableSubTypesForProductType,
  isValidCollectionProductType,
  isValidProductSubTypeForType,
  validateProductTaxonomy
} from '../config/catalogTaxonomy';
import {
  auth,
  db,
  storage,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  collection,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  ref,
  uploadBytes,
  getDownloadURL,
  handleFirestoreError,
  OperationType
} from '../lib/firebase';
import { useSEO } from '../hooks/useSEO';

const ADMIN_EMAIL = 'sales@sa-and-sha.com';

const isPreviewEnvironment = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host.includes('ais-dev') || host.includes('ais-pre');
};

export const getOrderStatusBadgeClass = (status?: string): string => {
  const s = (status || 'placed').toLowerCase().trim();
  switch (s) {
    case 'paid':
      return 'bg-emerald-100/90 text-emerald-800 border border-emerald-200/60';
    case 'placed':
      return 'bg-blue-100/90 text-blue-800 border border-blue-200/60';
    case 'processing':
      return 'bg-amber-100/90 text-amber-800 border border-amber-200/60';
    case 'dispatched':
    case 'shipped':
      return 'bg-purple-100/90 text-purple-800 border border-purple-200/60';
    case 'delivered':
      return 'bg-teal-100/90 text-teal-800 border border-teal-200/60';
    case 'cancelled':
      return 'bg-rose-100/90 text-rose-800 border border-rose-200/60';
    case 'refund_initiated':
    case 'refund initiated':
      return 'bg-orange-100/90 text-orange-800 border border-orange-200/60';
    case 'refund_completed':
    case 'refund completed':
      return 'bg-indigo-100/90 text-indigo-800 border border-indigo-200/60';
    default:
      return 'bg-stone-100 text-stone-800 border border-stone-200/60';
  }
};

export const AdminPage: React.FC = () => {
  useSEO({
    title: 'Admin Dashboard | Sa and Sha',
    description: 'Sa and Sha internal admin workspace panel to manage inventory, catalog, and orders securely.',
    noindex: true
  });

  const navigate = useNavigate();
  const { showToast } = useShop();

  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    if (isPreviewEnvironment()) {
      return localStorage.getItem('kora_admin_bypass_logged_in') === 'true';
    }
    return false;
  });
  const [authError, setAuthError] = useState('');
  const [adminToken, setAdminToken] = useState<string>('');
  
  // Password Reset state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<'idle' | 'sending' | 'success'>('idle');

  // Tab state
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'returns' | 'enquiries' | 'promotions' | 'customers' | 'communications' | 'identity' | 'tax-master' | 'rewards-policy' | 'credit-notes' | 'homepage-media'>('orders');

  // Promotions management state
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isPromotionsLoading, setIsPromotionsLoading] = useState(false);
  const [promotionsSearch, setPromotionsSearch] = useState('');
  const [promotionsStatusFilter, setPromotionsStatusFilter] = useState('All');
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [promoForm, setPromoForm] = useState<Partial<Promotion>>({
    code: '',
    discount_type: 'percentage',
    discount_value: 10,
    minimum_order_amount: 0,
    maximum_discount_amount: null,
    starts_at: new Date().toISOString().split('T')[0],
    expires_at: '',
    is_active: true,
    usage_limit: null,
    usage_count: 0,
    per_customer_limit: null,
    applicable_product_ids: [],
    applicable_categories: []
  });
  const [isSavingPromo, setIsSavingPromo] = useState(false);
  const [promoModalError, setPromoModalError] = useState<string | null>(null);

  // Customer Enquiries management state
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [enquiriesSearch, setEnquiriesSearch] = useState('');
  const [enquiriesStatusFilter, setEnquiriesStatusFilter] = useState('All');
  const [enquiriesTypeFilter, setEnquiriesTypeFilter] = useState('All');
  const [selectedEnquiry, setSelectedEnquiry] = useState<any | null>(null);
  const [isUpdatingEnquiry, setIsUpdatingEnquiry] = useState(false);
  const [enquiryAdminNotes, setEnquiryAdminNotes] = useState('');

  // Returns & Exchanges management state
  const [returnRequests, setReturnRequests] = useState<any[]>([]);
  const [returnsSearch, setReturnsSearch] = useState('');
  const [returnsStatusFilter, setReturnsStatusFilter] = useState('All');
  const [returnsTypeFilter, setReturnsTypeFilter] = useState('All');
  const [selectedReturnReq, setSelectedReturnReq] = useState<any | null>(null);
  const [isUpdatingReturn, setIsUpdatingReturn] = useState(false);
  const [adminNotesInput, setAdminNotesInput] = useState('');

  // Dashboard state
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Authoritative Status & Dispatch Modal State
  const [statusUpdateModal, setStatusUpdateModal] = useState<{
    isOpen: boolean;
    order: any;
    targetStatus: string;
  } | null>(null);

  const [dispatchForm, setDispatchForm] = useState({
    courier_name: '',
    tracking_number: '',
    tracking_url: '',
    dispatch_date: new Date().toISOString().split('T')[0],
    estimated_delivery_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    adminNotes: ''
  });

  const [statusNotesInput, setStatusNotesInput] = useState('');
  const [refundProviderConfirmed, setRefundProviderConfirmed] = useState(false);
  const [refundAmountInput, setRefundAmountInput] = useState('');
  const [refundNoteInput, setRefundNoteInput] = useState('');
  const [refundReferenceInput, setRefundReferenceInput] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [retryingEmailStatus, setRetryingEmailStatus] = useState<string | null>(null);

  // Real Razorpay Refund Modal State
  const [razorpayRefundModal, setRazorpayRefundModal] = useState<{
    isOpen: boolean;
    order: any;
    amountInput: string;
    reasonInput: string;
    confirmed: boolean;
    isSubmitting: boolean;
  } | null>(null);

  const handleOpenRazorpayRefundModal = (order: any) => {
    const grandTotal = Number(order.grand_total) || 0;
    const refunds = Array.isArray(order.refunds) ? order.refunds : [];
    const prevRefunds = refunds.filter((r: any) => r.status !== 'failed').reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
    const maxRefundable = Math.max(0, Math.round((grandTotal - prevRefunds) * 100) / 100);

    setRazorpayRefundModal({
      isOpen: true,
      order,
      amountInput: String(maxRefundable),
      reasonInput: '',
      confirmed: false,
      isSubmitting: false
    });
  };

  const handleExecuteRazorpayRefund = async () => {
    if (!razorpayRefundModal) return;
    const { order, amountInput, reasonInput, confirmed } = razorpayRefundModal;
    
    const amt = Number(amountInput);
    if (isNaN(amt) || amt <= 0) {
      showToast('A valid refund amount greater than ₹0 is required.', 'error');
      return;
    }

    if (!confirmed) {
      showToast('You must confirm that you understand this will initiate a real Razorpay refund.', 'error');
      return;
    }

    setRazorpayRefundModal((prev) => prev ? { ...prev, isSubmitting: true } : null);

    try {
      const token = await getAdminAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const orderKey = order.id || order.order_id;
      const res = await fetch(`/api/admin/orders/${orderKey}/refund`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: amt,
          reason: reasonInput.trim(),
          confirm_razorpay: true
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Razorpay refund successfully initiated!');
        setRazorpayRefundModal(null);
        await loadOrders();
        if (selectedOrder && (selectedOrder.order_id === order.order_id || selectedOrder.id === order.id)) {
          setSelectedOrder(data.order || {
            ...selectedOrder,
            refund_total: data.refund_total,
            refundable_balance: data.refundable_balance,
            refund_status: data.refund_status,
            refunds: data.order?.refunds || [...(selectedOrder.refunds || []), data.refund]
          });
        }
      } else {
        showToast(data.error || 'Failed to process Razorpay refund.', 'error');
      }
    } catch (err: any) {
      console.error('Error executing Razorpay refund:', err);
      showToast('Network error processing Razorpay refund.', 'error');
    } finally {
      setRazorpayRefundModal((prev) => prev ? { ...prev, isSubmitting: false } : null);
    }
  };

  const handleReconcileRefund = async (order: any) => {
    if (!order) return;
    const orderKey = order.order_id || order.id;
    try {
      showToast('Reconciling refund status with Razorpay...', 'info');
      const token = await getAdminAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/admin/orders/${orderKey}/reconcile-refund`, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Refund reconciled successfully!');
        await loadOrders();
        if (selectedOrder && (selectedOrder.order_id === order.order_id || selectedOrder.id === order.id)) {
          setSelectedOrder(data.order || selectedOrder);
        }
      } else {
        showToast(data.error || 'Failed to reconcile refund with Razorpay.', 'error');
      }
    } catch (err) {
      console.error('Error reconciling refund:', err);
      showToast('Network error during reconciliation.', 'error');
    }
  };

  const getFinancialRefundStatusBadge = (refundStatusRaw: string) => {
    const st = (refundStatusRaw || 'no_refund').toLowerCase();
    switch (st) {
      case 'refund_completed':
        return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
      case 'partially_refunded':
        return 'bg-amber-50 text-amber-800 border border-amber-200';
      case 'refund_pending':
        return 'bg-purple-50 text-purple-800 border border-purple-200';
      case 'refund_failed':
        return 'bg-red-50 text-red-800 border border-red-200';
      default:
        return 'bg-stone-100 text-stone-600 border border-stone-200';
    }
  };

  // Product management state
  const { allProducts, refreshProducts } = useShop();
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('All');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formPreviousSlugs, setFormPreviousSlugs] = useState<string[]>([]);
  const [formCategory, setFormCategory] = useState<'dresses' | 'tops-shirts' | 'shorts-skirts' | 'co-ord-sets' | 'trousers' | 'jackets' | 'bags-pouches'>('dresses');
  const [formSubCategory, setFormSubCategory] = useState<'dresses' | 'tops' | 'shirts' | 'shorts' | 'skirts' | 'co-ord-sets' | 'trousers' | 'jackets' | 'bags-pouches'>('dresses');
  const [formCollection, setFormCollection] = useState<string>('');
  const [formProductType, setFormProductType] = useState<string>('');
  const [formProductSubType, setFormProductSubType] = useState<string>('');
  const [formMaterialType, setFormMaterialType] = useState<string>('');
  const [formTaxClass, setFormTaxClass] = useState<string>('');
  const [formSku, setFormSku] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCompareAtPrice, setFormCompareAtPrice] = useState('');
  const [formFabric, setFormFabric] = useState('');
  const [formFit, setFormFit] = useState<'Slim' | 'Regular' | 'Relaxed'>('Regular');
  const [formColor, setFormColor] = useState('');
  const [formColorHex, setFormColorHex] = useState('#FBF6EE');
  const [formSizes, setFormSizes] = useState<string[]>([]);
  const [formCollar, setFormCollar] = useState<string>('Spread');
  const [formSleeve, setFormSleeve] = useState<string>('Full Sleeve');
  const [formPattern, setFormPattern] = useState<'Solid' | 'Striped' | 'Printed' | 'Checked'>('Solid');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formDescription, setFormDescription] = useState('');
  const [formDetails, setFormDetails] = useState('');
  const [formCareInstructions, setFormCareInstructions] = useState('');
  const [formStatus, setFormStatus] = useState<'draft' | 'published'>('published');
  const [formStock, setFormStock] = useState<Record<string, number>>({});

  // File drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check login state on mount via Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const isPreview = isPreviewEnvironment();
      if (isPreview && localStorage.getItem('kora_admin_bypass_logged_in') === 'true') {
        setIsLoggedIn(true);
        return;
      }
      if (user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        setIsLoggedIn(true);
        localStorage.setItem('kora_admin_logged_in', 'true');
      } else {
        setIsLoggedIn(false);
        localStorage.removeItem('kora_admin_logged_in');
        localStorage.removeItem('kora_admin_bypass_logged_in');
      }
    });
    return unsubscribe;
  }, []);

  // Fetch orders, return requests, customer enquiries, and promotions when logged in
  useEffect(() => {
    if (isLoggedIn) {
      getAdminAuthToken().then(t => {
        if (t) setAdminToken(t);
      });
      loadOrders();
      loadReturnRequests();
      loadEnquiries();
      loadPromotions();
    }
  }, [isLoggedIn]);

  const loadPromotions = async () => {
    setIsPromotionsLoading(true);
    try {
      let token = await getAdminAuthToken();
      let headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      let res = await fetch('/api/admin/promotions', { headers });
      if (res.status === 401) {
        token = await getAdminAuthToken(true);
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          res = await fetch('/api/admin/promotions', { headers });
        }
      }

      const data = await res.json();
      if (res.ok && data.success) {
        setPromotions(data.promotions || []);
      } else {
        console.warn('Failed to load promotions:', data.error);
        if (res.status === 401) {
          showToast('Your admin session has expired. Please log in again.', 'error');
        }
      }
    } catch (err) {
      console.warn('Error loading promotions:', err);
    } finally {
      setIsPromotionsLoading(false);
    }
  };

  const handleOpenPromoModal = (promo?: Promotion) => {
    if (promo) {
      setSelectedPromo(promo);
      setPromoForm({
        code: promo.code,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        minimum_order_amount: promo.minimum_order_amount,
        maximum_discount_amount: promo.maximum_discount_amount,
        starts_at: promo.starts_at ? new Date(promo.starts_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        expires_at: promo.expires_at ? new Date(promo.expires_at).toISOString().split('T')[0] : '',
        is_active: promo.is_active,
        usage_limit: promo.usage_limit,
        per_customer_limit: promo.per_customer_limit,
        applicable_product_ids: promo.applicable_product_ids || [],
        applicable_categories: promo.applicable_categories || []
      });
    } else {
      setSelectedPromo(null);
      setPromoForm({
        code: '',
        discount_type: 'percentage',
        discount_value: 10,
        minimum_order_amount: 0,
        maximum_discount_amount: null,
        starts_at: new Date().toISOString().split('T')[0],
        expires_at: '',
        is_active: true,
        usage_limit: null,
        usage_count: 0,
        per_customer_limit: null,
        applicable_product_ids: [],
        applicable_categories: []
      });
    }
    setPromoModalError(null);
    setIsPromoModalOpen(true);
  };

  const handleSavePromotion = async () => {
    setPromoModalError(null);
    if (!promoForm.code || !promoForm.code.trim()) {
      setPromoModalError('Promo code is required.');
      return;
    }

    if (promoForm.discount_value === undefined || Number(promoForm.discount_value) <= 0) {
      setPromoModalError('Discount value must be greater than zero.');
      return;
    }

    if (promoForm.discount_type === 'percentage' && Number(promoForm.discount_value) > 100) {
      setPromoModalError('Percentage discount value cannot exceed 100%.');
      return;
    }

    setIsSavingPromo(true);
    try {
      const payload = {
        code: promoForm.code.trim().toUpperCase(),
        discount_type: promoForm.discount_type || 'percentage',
        discount_value: Number(promoForm.discount_value),
        minimum_order_amount: Number(promoForm.minimum_order_amount) || 0,
        maximum_discount_amount: promoForm.maximum_discount_amount !== null && promoForm.maximum_discount_amount !== undefined && String(promoForm.maximum_discount_amount) !== '' ? Number(promoForm.maximum_discount_amount) : null,
        starts_at: promoForm.starts_at ? new Date(promoForm.starts_at).toISOString() : new Date().toISOString(),
        expires_at: promoForm.expires_at ? new Date(promoForm.expires_at).toISOString() : null,
        is_active: promoForm.is_active ?? true,
        usage_limit: promoForm.usage_limit !== null && promoForm.usage_limit !== undefined && String(promoForm.usage_limit) !== '' ? Number(promoForm.usage_limit) : null,
        per_customer_limit: promoForm.per_customer_limit !== null && promoForm.per_customer_limit !== undefined && String(promoForm.per_customer_limit) !== '' ? Number(promoForm.per_customer_limit) : null,
        applicable_product_ids: promoForm.applicable_product_ids || [],
        applicable_categories: promoForm.applicable_categories || []
      };

      let url = '/api/admin/promotions';
      let method = 'POST';

      if (selectedPromo?.id) {
        url = `/api/admin/promotions/${selectedPromo.id}`;
        method = 'PATCH';
      }

      let token = await getAdminAuthToken();
      if (!token) {
        setPromoModalError('Your admin session has expired. Please log in again.');
        setIsSavingPromo(false);
        return;
      }

      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      let res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        token = await getAdminAuthToken(true);
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          res = await fetch(url, {
            method,
            headers,
            body: JSON.stringify(payload)
          });
        }
      }

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(selectedPromo ? `Promo code "${payload.code}" updated!` : `Promo code "${payload.code}" created!`);
        setIsPromoModalOpen(false);
        setSelectedPromo(null);
        await loadPromotions();
      } else {
        if (res.status === 401) {
          setPromoModalError('Your admin session has expired. Please log in again.');
        } else {
          setPromoModalError(data.error || 'Failed to save promotion.');
        }
      }
    } catch (err: any) {
      console.error('Error saving promotion:', err);
      setPromoModalError(err.message || 'Error saving promotion.');
    } finally {
      setIsSavingPromo(false);
    }
  };

  const handleDeletePromotion = async (id: string, code: string) => {
    if (!window.confirm(`Are you sure you want to delete promo code "${code}"?`)) return;

    try {
      let token = await getAdminAuthToken();
      if (!token) {
        showToast('Your admin session has expired. Please log in again.', 'error');
        return;
      }

      let headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`
      };

      let res = await fetch(`/api/admin/promotions/${id}`, {
        method: 'DELETE',
        headers
      });

      if (res.status === 401) {
        token = await getAdminAuthToken(true);
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          res = await fetch(`/api/admin/promotions/${id}`, {
            method: 'DELETE',
            headers
          });
        }
      }

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Promo code "${code}" deleted.`);
        await loadPromotions();
      } else {
        if (res.status === 401) {
          showToast('Your admin session has expired. Please log in again.', 'error');
        } else {
          showToast(data.error || 'Failed to delete promo code.', 'error');
        }
      }
    } catch (err) {
      console.error('Error deleting promotion:', err);
      showToast('Error deleting promotion.', 'error');
    }
  };

  const handleTogglePromoStatus = async (promo: Promotion) => {
    try {
      let token = await getAdminAuthToken();
      if (!token) {
        showToast('Your admin session has expired. Please log in again.', 'error');
        return;
      }

      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      let res = await fetch(`/api/admin/promotions/${promo.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_active: !promo.is_active })
      });

      if (res.status === 401) {
        token = await getAdminAuthToken(true);
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          res = await fetch(`/api/admin/promotions/${promo.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ is_active: !promo.is_active })
          });
        }
      }

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Promo code "${promo.code}" ${!promo.is_active ? 'activated' : 'deactivated'}.`);
        await loadPromotions();
      } else {
        if (res.status === 401) {
          showToast('Your admin session has expired. Please log in again.', 'error');
        } else {
          showToast(data.error || 'Failed to update promo status.', 'error');
        }
      }
    } catch (err) {
      console.error('Error toggling promo status:', err);
      showToast('Error updating promo status.', 'error');
    }
  };

  const loadEnquiries = async () => {
    try {
      const token = await getAdminAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/admin/enquiries', { headers });
      const data = await res.json();
      if (data.success) {
        setEnquiries(data.enquiries || []);
      }
    } catch (err) {
      console.warn('Failed to load customer enquiries for admin:', err);
    }
  };

  const handleUpdateEnquiryStatus = async (enquiryId: string, newStatus: string) => {
    setIsUpdatingEnquiry(true);
    try {
      const token = await getAdminAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/admin/enquiries/${enquiryId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: newStatus,
          adminNotes: enquiryAdminNotes
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Enquiry ${enquiryId} updated successfully.`);
        loadEnquiries();
        setSelectedEnquiry(data.enquiry);
      } else {
        showToast(data.error || 'Failed to update enquiry.');
      }
    } catch (err) {
      showToast('Error updating enquiry status.');
    } finally {
      setIsUpdatingEnquiry(false);
    }
  };

  const loadReturnRequests = async () => {
    try {
      const token = await getAdminAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/admin/returns', { headers });
      const data = await res.json();
      if (data.success) {
        setReturnRequests(data.requests || []);
      }
    } catch (err) {
      console.warn('Failed to load return requests for admin:', err);
    }
  };

  const handleUpdateReturnStatus = async (newStatus: string) => {
    if (!selectedReturnReq) return;
    setIsUpdatingReturn(true);

    try {
      const token = await getAdminAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/admin/returns', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          requestId: selectedReturnReq.request_id,
          status: newStatus,
          adminNotes: adminNotesInput
        })
      });

      const data = await res.json();
      if (data.success) {
        setSelectedReturnReq(data.request);
        loadReturnRequests();
        alert(`Request status updated to ${newStatus}`);
      } else {
        alert(data.error || 'Failed to update request.');
      }
    } catch (err) {
      alert('Network error while updating status.');
    } finally {
      setIsUpdatingReturn(false);
    }
  };

  const getAdminAuthToken = async (forceRefresh = false): Promise<string | null> => {
    if (auth.currentUser) {
      try {
        return await auth.currentUser.getIdToken(forceRefresh);
      } catch (err) {
        console.warn('Could not retrieve Firebase Auth ID token:', err);
      }
    }
    return null;
  };

  const loadOrders = async () => {
    setIsLoading(true);

    try {
      const token = await getAdminAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/admin/orders', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          setOrders(data.orders);
          setIsLoading(false);
          return;
        }
      }
      console.error('Failed to fetch orders from Admin API:', res.statusText);
      showToast('Unable to load live orders. Please refresh and try again.', 'error');
      setOrders([]);
    } catch (apiErr) {
      console.error('API fetch orders failed:', apiErr);
      showToast('Unable to load live orders. Please refresh and try again.', 'error');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoading(true);

    const targetEmail = email.trim().toLowerCase();

    // 1. Enforce strict email restriction
    if (targetEmail !== ADMIN_EMAIL.toLowerCase()) {
      setAuthError('Unauthorized admin email. Access denied. Only sales@sa-and-sha.com can access the admin portal.');
      showToast('Unauthorized admin email. Access denied.', 'error');
      setIsLoading(false);
      return;
    }

    // 2. Validate 6-digit TOTP format
    const cleanTotp = totpCode.trim();
    if (!cleanTotp || cleanTotp.length !== 6 || !/^\d{6}$/.test(cleanTotp)) {
      setAuthError('Please enter a valid 6-digit Google Authenticator code.');
      showToast('6-digit Authenticator code required.', 'error');
      setIsLoading(false);
      return;
    }

    // 3. Step A: Firebase Authentication
    let firebaseUser: any = null;
    const isPreview = isPreviewEnvironment();

    try {
      const userCred = await signInWithEmailAndPassword(auth, targetEmail, password);
      firebaseUser = userCred.user;
    } catch (err: any) {
      if (isPreview && err.code === 'auth/user-not-found') {
        try {
          const newCred = await createUserWithEmailAndPassword(auth, targetEmail, password);
          firebaseUser = newCred.user;
        } catch (createErr) {
          console.warn('Silent Firebase registration warning in preview:', createErr);
        }
      }
      if (!firebaseUser) {
        console.error('Firebase Auth failure:', err);
        setIsLoggedIn(false);
        localStorage.removeItem('kora_admin_logged_in');
        localStorage.removeItem('kora_admin_bypass_logged_in');
        setAuthError('Incorrect admin password or Firebase authentication failed.');
        showToast('Authentication failed. Access denied.', 'error');
        setIsLoading(false);
        return;
      }
    }

    if (!firebaseUser || firebaseUser.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      await signOut(auth);
      setIsLoggedIn(false);
      localStorage.removeItem('kora_admin_logged_in');
      localStorage.removeItem('kora_admin_bypass_logged_in');
      setAuthError('Unauthorized admin email. Access denied.');
      showToast('Unauthorized admin account.', 'error');
      setIsLoading(false);
      return;
    }

    // 4. Step B: Server-Side TOTP Verification via POST /api/admin/verify-totp
    try {
      const totpRes = await fetch('/api/admin/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanTotp })
      });

      const totpData = await totpRes.json();

      if (!totpRes.ok || !totpData.success) {
        await signOut(auth);
        setIsLoggedIn(false);
        localStorage.removeItem('kora_admin_logged_in');
        localStorage.removeItem('kora_admin_bypass_logged_in');
        const errMsg = totpData.error || 'Invalid 6-digit Authenticator verification code. Access denied.';
        setAuthError(errMsg);
        showToast(errMsg, 'error');
        setIsLoading(false);
        return;
      }

      // Success: Both Firebase Auth and Server TOTP verification passed
      setIsLoggedIn(true);
      localStorage.setItem('kora_admin_logged_in', 'true');
      showToast('Welcome back, Admin! Firebase Password & Server TOTP authorized.');
    } catch (err: any) {
      console.error('Error contacting TOTP verification server:', err);
      await signOut(auth);
      setIsLoggedIn(false);
      localStorage.removeItem('kora_admin_logged_in');
      localStorage.removeItem('kora_admin_bypass_logged_in');
      setAuthError('TOTP verification service unavailable. Access denied.');
      showToast('Verification service unavailable.', 'error');
    }

    setIsLoading(false);
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('kora_admin_bypass_logged_in');
      localStorage.removeItem('kora_admin_logged_in');
      await signOut(auth);
      setIsLoggedIn(false);
      showToast('Logged out of Admin Portal.');
    } catch (err) {
      console.error('Error signing out:', err);
      setIsLoggedIn(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = forgotEmail.trim().toLowerCase();
    if (targetEmail !== ADMIN_EMAIL.toLowerCase()) {
      showToast('Email address not registered as Admin.', 'error');
      return;
    }

    setForgotStatus('sending');
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setForgotStatus('success');
      showToast('Password reset link sent successfully.');
    } catch (err: any) {
      console.error('Error sending reset email:', err);
      setForgotStatus('success');
      showToast('Password reset link sent successfully.');
    }
  };

  const handleOpenStatusModal = (order: any, newStatus: string) => {
    const cleanStatus = newStatus.toLowerCase();
    if (order.status?.toLowerCase() === cleanStatus) {
      showToast(`Order is already in '${cleanStatus}' status.`);
      return;
    }

    const isRazorpay = (order.payment_method || '').toString().toLowerCase() === 'razorpay' || !!order.payment_id;
    if (isRazorpay && (cleanStatus === 'refund_initiated' || cleanStatus === 'refund_completed')) {
      showToast('Razorpay prepaid orders must be refunded using "Initiate Razorpay Refund". Completion is automated via Webhook.', 'error');
      return;
    }

    if (cleanStatus === 'dispatched') {
      setDispatchForm({
        courier_name: order.courier_name || order.courier || '',
        tracking_number: order.tracking_number || '',
        tracking_url: order.tracking_url || '',
        dispatch_date: order.dispatch_date || new Date().toISOString().split('T')[0],
        estimated_delivery_date: order.estimated_delivery_date || order.estimated_delivery || new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
        adminNotes: ''
      });
    }

    if (cleanStatus === 'refund_initiated') {
      setRefundProviderConfirmed(false);
      setRefundAmountInput(order.grand_total ? String(order.grand_total) : '');
      setRefundNoteInput('');
    } else if (cleanStatus === 'refund_completed') {
      setRefundReferenceInput('');
      setRefundAmountInput(order.refund_amount ? String(order.refund_amount) : (order.grand_total ? String(order.grand_total) : ''));
    }

    setStatusNotesInput('');
    setStatusUpdateModal({
      isOpen: true,
      order,
      targetStatus: cleanStatus
    });
  };

  const handleExecuteStatusUpdate = async () => {
    if (!statusUpdateModal) return;
    const { order, targetStatus } = statusUpdateModal;
    setIsSubmittingStatus(true);

    try {
      const token = await getAdminAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const body: any = {
        status: targetStatus,
        adminNotes: statusNotesInput.trim()
      };

      if (targetStatus === 'dispatched') {
        if (!dispatchForm.courier_name.trim()) {
          showToast('Courier name is required for dispatch.', 'error');
          setIsSubmittingStatus(false);
          return;
        }
        if (!dispatchForm.tracking_number.trim()) {
          showToast('Tracking number / AWB is required for dispatch.', 'error');
          setIsSubmittingStatus(false);
          return;
        }
        if (!dispatchForm.tracking_url.trim() || !dispatchForm.tracking_url.startsWith('https://')) {
          showToast('A valid HTTPS tracking URL is required.', 'error');
          setIsSubmittingStatus(false);
          return;
        }
        if (!dispatchForm.dispatch_date || !dispatchForm.estimated_delivery_date) {
          showToast('Valid dispatch and estimated delivery dates are required.', 'error');
          setIsSubmittingStatus(false);
          return;
        }
        if (new Date(dispatchForm.estimated_delivery_date) < new Date(dispatchForm.dispatch_date)) {
          showToast('Estimated delivery date cannot be before dispatch date.', 'error');
          setIsSubmittingStatus(false);
          return;
        }

        body.courier_name = dispatchForm.courier_name.trim();
        body.tracking_number = dispatchForm.tracking_number.trim();
        body.tracking_url = dispatchForm.tracking_url.trim();
        body.dispatch_date = dispatchForm.dispatch_date.trim();
        body.estimated_delivery_date = dispatchForm.estimated_delivery_date.trim();
        if (dispatchForm.adminNotes.trim()) {
          body.adminNotes = dispatchForm.adminNotes.trim();
        }
      }

      if (targetStatus === 'refund_initiated') {
        if (!refundProviderConfirmed) {
          showToast('You must confirm that you have initiated this refund through Razorpay/payment provider.', 'error');
          setIsSubmittingStatus(false);
          return;
        }
        const amt = Number(refundAmountInput);
        if (isNaN(amt) || amt <= 0) {
          showToast('A valid refund amount (> 0) is required.', 'error');
          setIsSubmittingStatus(false);
          return;
        }
        body.refund_provider_confirmed = true;
        body.refund_amount = amt;
        body.refund_note = refundNoteInput.trim();
      }

      if (targetStatus === 'refund_completed') {
        if (!refundReferenceInput.trim()) {
          showToast('Refund reference / transaction ID is required.', 'error');
          setIsSubmittingStatus(false);
          return;
        }
        const amt = Number(refundAmountInput);
        if (isNaN(amt) || amt <= 0) {
          showToast('A valid refund amount (> 0) is required.', 'error');
          setIsSubmittingStatus(false);
          return;
        }
        body.refund_reference = refundReferenceInput.trim();
        body.refund_amount = amt;
      }

      const orderKey = order.id || order.order_id;
      const res = await fetch(`/api/admin/orders/${orderKey}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const emailInfo = data.emailResult?.alreadySent
          ? '(Email was previously sent)'
          : data.emailResult?.success
          ? '(Transactional email sent via SMTP)'
          : data.emailResult?.error
          ? `(Email error: ${data.emailResult.error})`
          : '';
        showToast(`Order status updated to '${targetStatus}'. ${emailInfo}`);
        setStatusUpdateModal(null);
        await loadOrders();
        if (selectedOrder && (selectedOrder.order_id === order.order_id || selectedOrder.id === order.id)) {
          setSelectedOrder(data.order);
        }
      } else {
        showToast(data.error || 'Failed to update order status.', 'error');
      }
    } catch (err: any) {
      console.error('Error in status update API call:', err);
      showToast('Network error updating order status.', 'error');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const handleRetryEmail = async (orderId: string, eventType: string) => {
    setRetryingEmailStatus(eventType);
    try {
      const token = await getAdminAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/admin/orders/${orderId}/retry-email`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ eventType })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Transactional email re-sent successfully for '${eventType}' event.`);
        await loadOrders();
        if (selectedOrder) {
          setSelectedOrder((prev: any) => ({
            ...prev,
            emailStatus: data.emailStatus
          }));
        }
      } else {
        showToast(data.error || 'Failed to re-send email.', 'error');
      }
    } catch (err) {
      showToast('Error re-sending email.', 'error');
    } finally {
      setRetryingEmailStatus(null);
    }
  };



  // Helper slugify function
  const slugify = (text: string): string => {
    if (!text) return '';
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };

  // Helper to collect all used slugs across static and dynamic products
  const getUsedSlugsSet = (excludeProductId?: string): Set<string> => {
    const used = new Set<string>();
    allProducts.forEach(p => {
      if (excludeProductId && p.id === excludeProductId) return;
      const primarySlug = (p.slug || slugify(p.name)).toLowerCase();
      if (primarySlug) used.add(primarySlug);
      if (Array.isArray(p.previousSlugs)) {
        p.previousSlugs.forEach(prev => {
          if (prev) used.add(prev.toLowerCase());
        });
      }
    });
    return used;
  };

  // Helper to generate a unique auto-suffixed slug for new products or auto-generation
  const generateUniqueSlug = (baseText: string, excludeProductId?: string): string => {
    const base = slugify(baseText);
    if (!base) return 'product';
    const used = getUsedSlugsSet(excludeProductId);
    if (!used.has(base)) return base;

    let counter = 2;
    while (used.has(`${base}-${counter}`)) {
      counter++;
    }
    return `${base}-${counter}`;
  };

  // ==================== PRODUCT MANAGEMENT OPERATIONS ====================
  const handleCollectionChange = (newCol: string) => {
    setFormCollection(newCol);
    // If currently selected productType is not valid for new collection, reset it
    if (newCol && formProductType && !isValidCollectionProductType(newCol, formProductType)) {
      setFormProductType('');
      setFormProductSubType('');
    }
  };

  const handleProductTypeChange = (newType: string) => {
    setFormProductType(newType);
    // If currently selected subType is not valid for new type, reset it
    if (newType && formProductSubType && !isValidProductSubTypeForType(newType, formProductSubType)) {
      setFormProductSubType('');
    }
  };

  const initProductForm = (product: Product | null = null) => {
    if (product) {
      setEditingProduct(product);
      setFormName(product.name);
      setFormSlug(product.slug || slugify(product.name));
      setFormPreviousSlugs(product.previousSlugs || []);
      setFormCategory(product.category as any);
      setFormSubCategory(product.subCategory as any);
      setFormCollection(product.collection || '');
      setFormProductType(product.productType || '');
      setFormProductSubType(product.productSubType || '');
      setFormMaterialType(product.materialType || '');
      setFormTaxClass(product.tax_class || '');
      setFormSku(product.sku || '');
      setFormPrice(product.price ? String(product.price) : '');
      setFormCompareAtPrice(product.compareAtPrice ? String(product.compareAtPrice) : '');
      setFormFabric(product.fabric || '');
      setFormFit(product.fit || 'Regular');
      setFormColor(product.color || '');
      setFormColorHex(product.colorHex || '#FBF6EE');
      setFormSizes(product.sizes || []);
      setFormCollar(product.collar || 'Spread');
      setFormSleeve(product.sleeve || 'Full Sleeve');
      setFormPattern(product.pattern || 'Solid');
      setFormImages(product.images || []);
      setFormDescription(product.description || '');
      setFormDetails((product.details || []).join('\n'));
      setFormCareInstructions((product.careInstructions || []).join('\n'));
      setFormStatus(product.status || 'published');
      setFormStock(product.stock || {});
      setSelectedFiles([]);
    } else {
      setEditingProduct(null);
      setFormName('');
      setFormSlug('');
      setFormPreviousSlugs([]);
      setFormCategory('dresses');
      setFormSubCategory('dresses');
      setFormCollection('');
      setFormProductType('');
      setFormProductSubType('');
      setFormMaterialType('');
      setFormTaxClass('');
      setFormSku('');
      setFormPrice('');
      setFormCompareAtPrice('');
      setFormFabric('');
      setFormFit('Regular');
      setFormColor('');
      setFormColorHex('#FBF6EE');
      setFormSizes([]);
      setFormCollar('Spread');
      setFormSleeve('Full Sleeve');
      setFormPattern('Solid');
      setFormImages([]);
      setFormDescription('');
      setFormDetails('');
      setFormCareInstructions('');
      setFormStatus('published');
      setFormStock({});
      setSelectedFiles([]);
    }
    setShowProductForm(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files: File[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (file.type.startsWith('image/')) {
          files.push(file);
        }
      }
      addFilesToSelection(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files: File[] = Array.from(e.target.files);
      addFilesToSelection(files);
    }
  };

  const addFilesToSelection = (files: File[]) => {
    const totalCount = formImages.length + selectedFiles.length + files.length;
    if (totalCount > 6) {
      showToast('Maximum 6 images are allowed per product.');
      return;
    }
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeUploadedImage = (index: number) => {
    setFormImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSizeToggle = (size: string) => {
    setFormSizes(prev => {
      if (prev.includes(size)) {
        const updated = prev.filter(s => s !== size);
        setFormStock(stock => {
          const newStock = { ...stock };
          delete newStock[size];
          return newStock;
        });
        return updated;
      } else {
        const updated = [...prev, size];
        setFormStock(stock => ({
          ...stock,
          [size]: stock[size] !== undefined ? stock[size] : 10
        }));
        return updated;
      }
    });
  };

  const handleStockChange = (size: string, qtyStr: string) => {
    const quantity = qtyStr === '' ? 0 : Number(qtyStr);
    setFormStock(prev => ({
      ...prev,
      [size]: quantity
    }));
  };

  const uploadAndSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formName.trim()) {
      showToast('Product name is required.');
      return;
    }
    if (!formPrice || isNaN(Number(formPrice))) {
      showToast('Valid price in INR is required.');
      return;
    }
    if (formSizes.length === 0) {
      showToast('At least one available size must be selected.');
      return;
    }

    const totalImages = formImages.length + selectedFiles.length;
    if (totalImages < 1) {
      showToast('At least 1 product image is required (minimum 1, maximum 6).');
      return;
    }

    setIsSavingProduct(true);
    showToast('Uploading images and saving product...');

    try {
      const uploadedUrls: string[] = [...formImages];

      for (const file of selectedFiles) {
        try {
          const fileRef = ref(storage, `products/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(fileRef, file);
          const downloadUrl = await getDownloadURL(snapshot.ref);
          uploadedUrls.push(downloadUrl);
        } catch (storageErr) {
          console.error('Firebase Storage upload failed, falling back to Base64 data URL:', file.name, storageErr);
          const base64Url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
          });
          uploadedUrls.push(base64Url);
        }
      }

      const detailsArray = formDetails.split('\n').map(l => l.trim()).filter(Boolean);
      const careArray = formCareInstructions.split('\n').map(l => l.trim()).filter(Boolean);

      const finalImages = uploadedUrls.length > 0 ? uploadedUrls : [
        'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800'
      ];

      const rawBaseSlug = slugify(formSlug || formName);
      const usedSlugs = getUsedSlugsSet(editingProduct?.id);

      let computedSlug = rawBaseSlug;

      if (!editingProduct) {
        // For NEW products, automatically find a unique slug if collision exists
        computedSlug = generateUniqueSlug(formSlug || formName, undefined);
      } else {
        // For EXISTING products:
        // Check if the requested slug collides with another product's current slug or redirect history
        if (usedSlugs.has(rawBaseSlug)) {
          showToast('This URL slug is already used by another product or redirect history. Please choose a different slug.');
          setIsSavingProduct(false);
          return;
        }
        computedSlug = rawBaseSlug;
      }

      let updatedPreviousSlugs = [...formPreviousSlugs];

      if (editingProduct) {
        const oldSlug = editingProduct.slug || slugify(editingProduct.name);
        if (oldSlug && oldSlug !== computedSlug && !updatedPreviousSlugs.includes(oldSlug)) {
          updatedPreviousSlugs.push(oldSlug);
        }
      }

      if (formCollection || formProductType || formProductSubType || formMaterialType) {
        const taxonomyCheck = validateProductTaxonomy({
          collection: formCollection || undefined,
          productType: formProductType || undefined,
          productSubType: formProductSubType || undefined,
          materialType: formMaterialType || undefined,
          tax_class: formTaxClass || undefined
        });

        if (!taxonomyCheck.valid) {
          showToast(`Taxonomy Error: ${taxonomyCheck.errors.join('; ')}`);
          setIsSavingProduct(false);
          return;
        }
      }

      const productData: Omit<Product, 'id'> = {
        name: formName,
        slug: computedSlug,
        previousSlugs: updatedPreviousSlugs,
        category: formCategory,
        subCategory: formSubCategory,
        collection: formCollection ? (formCollection as any) : undefined,
        productType: formProductType ? (formProductType as any) : undefined,
        productSubType: formProductSubType ? (formProductSubType as any) : undefined,
        materialType: formMaterialType ? (formMaterialType as any) : undefined,
        tax_class: formTaxClass ? formTaxClass.trim() : undefined,
        price: Number(formPrice),
        compareAtPrice: formCompareAtPrice ? Number(formCompareAtPrice) : 0,
        fabric: formFabric || 'Premium Fabric',
        fit: formFit,
        color: formColor || 'Natural',
        colorHex: formColorHex || '#FBF6EE',
        sizes: formSizes,
        collar: (formCategory === 'tops-shirts' ? formCollar : undefined) as any,
        sleeve: (formCategory === 'tops-shirts' ? formSleeve : undefined) as any,
        pattern: formPattern,
        images: finalImages,
        rating: editingProduct ? editingProduct.rating : 4.5,
        reviewCount: editingProduct ? editingProduct.reviewCount : 1,
        bestseller: editingProduct ? editingProduct.bestseller : false,
        newArrival: editingProduct ? editingProduct.newArrival : true,
        dateAdded: editingProduct ? editingProduct.dateAdded : new Date().toISOString().split('T')[0],
        description: formDescription,
        details: detailsArray.length > 0 ? detailsArray : ['Premium quality fabric', 'Tailored stitching'],
        careInstructions: careArray.length > 0 ? careArray : ['Machine wash cold', 'Dry in shade'],
        sku: formSku,
        status: formStatus,
        stock: formStock
      };

      if (editingProduct) {
        const isPreview = isPreviewEnvironment();
        const bypassActive = isPreview && localStorage.getItem('kora_admin_bypass_logged_in') === 'true';
        const useLocalFallback = isPreview && (bypassActive || !auth.currentUser);

        if (useLocalFallback) {
          const localCustom = localStorage.getItem('kora_custom_products');
          const customProducts: Product[] = localCustom ? JSON.parse(localCustom) : [];
          const updated = customProducts.map(p => 
            p.id === editingProduct.id ? { ...p, ...productData } : p
          );
          if (!customProducts.some(p => p.id === editingProduct.id)) {
            updated.push({ id: editingProduct.id, ...productData } as Product);
          }
          localStorage.setItem('kora_custom_products', JSON.stringify(updated));
          showToast(`Product "${formName}" updated locally in Sandbox!`);
        } else {
          try {
            await setDoc(doc(db, 'products', editingProduct.id), productData, { merge: true });
            showToast(`Product "${formName}" updated successfully!`);
          } catch (fbErr) {
            console.warn('Firebase save failed, falling back to local sandbox storage:', fbErr);
            const localCustom = localStorage.getItem('kora_custom_products');
            const customProducts: Product[] = localCustom ? JSON.parse(localCustom) : [];
            const updated = customProducts.map(p => 
              p.id === editingProduct.id ? { ...p, ...productData } : p
            );
            if (!customProducts.some(p => p.id === editingProduct.id)) {
              updated.push({ id: editingProduct.id, ...productData } as Product);
            }
            localStorage.setItem('kora_custom_products', JSON.stringify(updated));
            showToast(`Saved "${formName}" locally (Firebase access restricted).`);
          }
        }
      } else {
        const isPreview = isPreviewEnvironment();
        const bypassActive = isPreview && localStorage.getItem('kora_admin_bypass_logged_in') === 'true';
        const useLocalFallback = isPreview && (bypassActive || !auth.currentUser);

        if (useLocalFallback) {
          const localCustom = localStorage.getItem('kora_custom_products');
          const customProducts: Product[] = localCustom ? JSON.parse(localCustom) : [];
          const newProduct: Product = {
            id: `custom-${Date.now()}`,
            ...productData
          } as Product;
          customProducts.push(newProduct);
          localStorage.setItem('kora_custom_products', JSON.stringify(customProducts));
          showToast(`Product "${formName}" added locally in Sandbox!`);
        } else {
          try {
            await addDoc(collection(db, 'products'), productData);
            showToast(`Product "${formName}" added successfully!`);
          } catch (fbErr) {
            console.warn('Firebase save failed, falling back to local sandbox storage:', fbErr);
            const localCustom = localStorage.getItem('kora_custom_products');
            const customProducts: Product[] = localCustom ? JSON.parse(localCustom) : [];
            const newProduct: Product = {
              id: `custom-${Date.now()}`,
              ...productData
            } as Product;
            customProducts.push(newProduct);
            localStorage.setItem('kora_custom_products', JSON.stringify(customProducts));
            showToast(`Saved "${formName}" locally (Firebase access restricted).`);
          }
        }
      }

      await refreshProducts();
      setShowProductForm(false);
      setEditingProduct(null);
    } catch (err: any) {
      console.error('Error saving product to Firestore:', err);
      showToast('Error saving product: ' + err.message);
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (window.confirm(`Are you sure you want to delete product "${productName}"?`)) {
      const isPreview = isPreviewEnvironment();
      const bypassActive = isPreview && localStorage.getItem('kora_admin_bypass_logged_in') === 'true';
      const useLocalFallback = isPreview && (bypassActive || !auth.currentUser);

      if (useLocalFallback) {
        const localCustom = localStorage.getItem('kora_custom_products');
        let customProducts: Product[] = localCustom ? JSON.parse(localCustom) : [];
        customProducts = customProducts.filter(p => p.id !== productId);
        localStorage.setItem('kora_custom_products', JSON.stringify(customProducts));

        const deletedIds = JSON.parse(localStorage.getItem('kora_deleted_products') || '[]');
        if (!deletedIds.includes(productId)) {
          deletedIds.push(productId);
          localStorage.setItem('kora_deleted_products', JSON.stringify(deletedIds));
        }

        showToast(`Product "${productName}" deleted locally in Sandbox.`);
        await refreshProducts();
      } else {
        try {
          await deleteDoc(doc(db, 'products', productId));
          showToast(`Product "${productName}" deleted successfully.`);
          await refreshProducts();
        } catch (err: any) {
          console.warn('Firebase delete failed, trying local deletion:', err);
          const localCustom = localStorage.getItem('kora_custom_products');
          let customProducts: Product[] = localCustom ? JSON.parse(localCustom) : [];
          customProducts = customProducts.filter(p => p.id !== productId);
          localStorage.setItem('kora_custom_products', JSON.stringify(customProducts));

          const deletedIds = JSON.parse(localStorage.getItem('kora_deleted_products') || '[]');
          if (!deletedIds.includes(productId)) {
            deletedIds.push(productId);
            localStorage.setItem('kora_deleted_products', JSON.stringify(deletedIds));
          }

          showToast(`Deleted "${productName}" locally (Firebase access restricted).`);
          await refreshProducts();
        }
      }
    }
  };



  // Metrics Calculations
  const totalRevenue = orders.reduce((sum, o) => {
    if (o.status !== 'cancelled') {
      return sum + Number(o.grand_total || 0);
    }
    return sum;
  }, 0);

  const totalOrdersCount = orders.length;
  const activeOrdersCount = orders.filter(o => o.status === 'placed' || o.status === 'processing').length;
  const averageOrderValue = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;

  // Filter and search
  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.city && o.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (o.pincode && o.pincode.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || o.status?.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const filteredProducts = allProducts.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())) ||
      (p.color && p.color.toLowerCase().includes(productSearch.toLowerCase()));

    const matchesCategory = 
      productCategoryFilter === 'All' || 
      p.category.toLowerCase() === productCategoryFilter.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6" id="admin-root-container">
      {!isLoggedIn ? (
        /* LOGIN PANEL */
        <div className="min-h-[60vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8 bg-white p-8 md:p-10 rounded-xl shadow-xl border border-[#E5D2BC]/20 relative overflow-hidden">
            
            {/* Top design accent */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-[#B08D57]" />

            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-full bg-[#2A211C] text-[#FBF6EE] mb-2">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-[#2A211C]">
                Sa and Sha Admin
              </h2>
              <p className="text-stone-500 text-xs font-sans">
                Secure executive access panel for order processing
              </p>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleLogin}>
              {authError && (
                <div className="p-3.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100 flex gap-2 font-sans">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="rounded-md space-y-4 font-sans text-xs">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold tracking-wider uppercase text-stone-500 block">
                    Administrative Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter administrative email"
                      className="w-full pl-9 pr-3 py-2.5 rounded border border-[#E5D2BC]/30 focus:outline-none focus:ring-1 focus:ring-[#B08D57] focus:border-[#B08D57] bg-stone-50 text-[#2A211C] font-medium"
                      id="admin-email-input"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold tracking-wider uppercase text-stone-500 block">
                      Access Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotStatus('idle');
                        setForgotEmail('');
                        setShowForgotModal(true);
                      }}
                      className="text-[10px] font-bold text-[#B08D57] hover:underline uppercase tracking-wider cursor-pointer"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-9 pr-3 py-2.5 rounded border border-[#E5D2BC]/30 focus:outline-none focus:ring-1 focus:ring-[#B08D57] focus:border-[#B08D57] bg-stone-50 text-[#2A211C] font-medium"
                      id="admin-password-input"
                    />
                  </div>
                </div>

                {/* Google Authenticator (MFA) Code Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold tracking-wider uppercase text-stone-500 block">
                    Google Authenticator 6-Digit Code (MFA)
                  </label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      pattern="\d{6}"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 6-digit verification code"
                      className="w-full pl-9 pr-3 py-2.5 rounded border border-[#E5D2BC]/30 focus:outline-none focus:ring-1 focus:ring-[#B08D57] focus:border-[#B08D57] bg-stone-50 text-[#2A211C] font-medium tracking-[0.1em] text-center text-sm"
                      id="admin-totp-input"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#2A211C] hover:bg-[#322c24] text-[#FBF6EE] font-sans font-bold text-xs uppercase tracking-widest py-3.5 px-4 rounded-lg transition-colors cursor-pointer shadow-md flex items-center justify-center gap-2"
                id="admin-login-submit"
              >
                <span>Authorize Login</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Autofill Sandbox Email Button - ONLY rendered in preview/dev environment */}
            {isPreviewEnvironment() && (
              <>
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-stone-100"></div>
                  <span className="flex-shrink mx-4 text-stone-400 text-[10px] uppercase font-bold tracking-wider font-sans">Or</span>
                  <div className="flex-grow border-t border-stone-100"></div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEmail(ADMIN_EMAIL);
                    showToast('Autofilled admin email. Enter password and your 6-digit Authenticator code.');
                  }}
                  className="w-full bg-stone-50 hover:bg-stone-100 text-[#2A211C] font-sans font-bold text-xs uppercase tracking-widest py-3 px-4 rounded-lg transition-colors cursor-pointer border border-[#E5D2BC]/30 flex items-center justify-center gap-2 shadow-sm"
                  id="admin-login-bypass"
                >
                  <span>Autofill Sandbox Email</span>
                  <span className="text-[9px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200/50 font-mono font-bold tracking-normal shrink-0">Preview</span>
                </button>
              </>
            )}

            {/* Quick Helper Credentials Tip for Demo Verification */}
            <div className="pt-4 border-t border-stone-100 text-center">
              <span className="text-[10px] text-stone-400 font-sans tracking-wide">
                Secure 2FA validation configured and strictly active by design.
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* ADMIN DASHBOARD */
        <div className="space-y-6">
          
          {/* HEADER ROW */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5D2BC]/20 pb-5">
            <div>
              <div className="flex items-center gap-2 text-stone-500 text-xs tracking-wider uppercase font-sans font-bold">
                <span>Executive Dashboard</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#C98A82]"></span>
                <span className="text-[#C98A82]">Live Session</span>
              </div>
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#2A211C] mt-1">
                Sa and Sha Order Registry
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadOrders}
                disabled={isLoading}
                className="p-2.5 rounded-lg border border-[#E5D2BC]/30 hover:bg-stone-50 text-[#2A211C] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={handleLogout}
                className="p-2.5 rounded-lg bg-stone-100 border border-stone-200 text-stone-700 hover:bg-stone-200 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          </div>



          {/* TAB SWITCHER */}
          <div className="flex flex-wrap gap-y-1 border-b border-stone-200 mt-4" id="admin-tab-switcher">
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-3 px-6 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'orders'
                  ? 'border-[#B08D57] text-[#B08D57]'
                  : 'border-transparent text-stone-500 hover:text-[#2A211C]'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Orders Registry ({orders.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`py-3 px-6 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'products'
                  ? 'border-[#B08D57] text-[#B08D57]'
                  : 'border-transparent text-stone-500 hover:text-[#2A211C]'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Product Catalog ({allProducts.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('promotions')}
              className={`py-3 px-6 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'promotions'
                  ? 'border-[#B08D57] text-[#B08D57]'
                  : 'border-transparent text-stone-500 hover:text-[#2A211C]'
              }`}
              id="admin-tab-promotions"
            >
              <Tag className="w-4 h-4" />
              <span>Promo Codes ({promotions.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`py-3 px-6 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'customers'
                  ? 'border-[#B08D57] text-[#B08D57]'
                  : 'border-transparent text-stone-500 hover:text-[#2A211C]'
              }`}
              id="admin-tab-customers"
            >
              <Users className="w-4 h-4" />
              <span>Customers</span>
            </button>
            <button
              onClick={() => setActiveTab('returns')}
              className={`py-3 px-6 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'returns'
                  ? 'border-[#B08D57] text-[#B08D57]'
                  : 'border-transparent text-stone-500 hover:text-[#2A211C]'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Returns & Exchanges ({returnRequests.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('enquiries')}
              className={`py-3 px-6 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'enquiries'
                  ? 'border-[#B08D57] text-[#B08D57]'
                  : 'border-transparent text-stone-500 hover:text-[#2A211C]'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Customer Enquiries ({enquiries.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('communications')}
              className={`py-3 px-6 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'communications'
                  ? 'border-[#B08D57] text-[#B08D57]'
                  : 'border-transparent text-stone-500 hover:text-[#2A211C]'
              }`}
              id="admin-tab-communications"
            >
              <Radio className="w-4 h-4" />
              <span>Communication Centre</span>
            </button>
            <button
              onClick={() => setActiveTab('identity')}
              className={`py-3 px-6 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'identity'
                  ? 'border-[#B08D57] text-[#B08D57]'
                  : 'border-transparent text-stone-500 hover:text-[#2A211C]'
              }`}
              id="admin-tab-identity"
            >
              <Users className="w-4 h-4" />
              <span>Identity Management</span>
            </button>
            <button
              onClick={() => setActiveTab('tax-master')}
              className={`py-3 px-6 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'tax-master'
                  ? 'border-[#B08D57] text-[#B08D57]'
                  : 'border-transparent text-stone-500 hover:text-[#2A211C]'
              }`}
              id="admin-tab-tax-master"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>GST Tax Master</span>
            </button>
            <button
              onClick={() => setActiveTab('rewards-policy')}
              className={`py-3 px-6 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'rewards-policy'
                  ? 'border-[#B08D57] text-[#B08D57]'
                  : 'border-transparent text-stone-500 hover:text-[#2A211C]'
              }`}
              id="admin-tab-rewards-policy"
            >
              <Award className="w-4 h-4" />
              <span>Sa and Sha Rewards Settings</span>
            </button>
            <button
              onClick={() => setActiveTab('credit-notes')}
              className={`py-3 px-6 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'credit-notes'
                  ? 'border-[#B08D57] text-[#B08D57]'
                  : 'border-transparent text-stone-500 hover:text-[#2A211C]'
              }`}
              id="admin-tab-credit-notes"
            >
              <FileText className="w-4 h-4" />
              <span>GST Credit Notes</span>
            </button>
            <button
              onClick={() => setActiveTab('homepage-media')}
              className={`py-3 px-6 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'homepage-media'
                  ? 'border-[#B08D57] text-[#B08D57]'
                  : 'border-transparent text-stone-500 hover:text-[#2A211C]'
              }`}
              id="admin-tab-homepage-media"
            >
              <Sliders className="w-4 h-4" />
              <span>Homepage Media CMS</span>
            </button>
          </div>

          {activeTab === 'identity' && (
            <AdminIdentityManagementTab adminToken={adminToken} showToast={showToast} />
          )}

          {activeTab === 'tax-master' && (
            <TaxMasterAdminTab adminToken={adminToken} showToast={showToast} />
          )}

          {activeTab === 'rewards-policy' && (
            <RewardsPolicySettings adminToken={adminToken} />
          )}

          {activeTab === 'credit-notes' && (
            <AdminCreditNotesTab adminToken={adminToken} showToast={showToast} />
          )}

          {activeTab === 'homepage-media' && (
            <HomepageMediaAdmin getAdminAuthToken={getAdminAuthToken} />
          )}

          {activeTab === 'orders' && (
            <div className="space-y-6 animate-fade-in">
              {/* METRIC CARDS GRID */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="admin-metrics-row">
                <div className="bg-white p-5 rounded-xl border border-[#E5D2BC]/20 shadow-sm space-y-1.5">
                  <div className="flex items-center justify-between text-[#2A211C]/50">
                    <span className="text-[10px] font-bold tracking-wider uppercase font-sans">Total Revenue</span>
                    <DollarSign className="w-4 h-4 text-[#B08D57]" />
                  </div>
                  <div className="font-serif text-lg md:text-2xl font-bold text-[#2A211C]">
                    ₹{totalRevenue.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-stone-400 font-sans tracking-wide">
                    Excludes cancelled orders
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-[#E5D2BC]/20 shadow-sm space-y-1.5">
                  <div className="flex items-center justify-between text-[#2A211C]/50">
                    <span className="text-[10px] font-bold tracking-wider uppercase font-sans">Total Orders</span>
                    <ShoppingBag className="w-4 h-4 text-stone-600" />
                  </div>
                  <div className="font-serif text-lg md:text-2xl font-bold text-[#2A211C]">
                    {totalOrdersCount}
                  </div>
                  <div className="text-[10px] text-stone-400 font-sans tracking-wide">
                    All historical checkouts
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-[#E5D2BC]/20 shadow-sm space-y-1.5">
                  <div className="flex items-center justify-between text-[#2A211C]/50">
                    <span className="text-[10px] font-bold tracking-wider uppercase font-sans">Active Processing</span>
                    <Clock className="w-4 h-4 text-[#B08D57]" />
                  </div>
                  <div className="font-serif text-lg md:text-2xl font-bold text-[#2A211C]">
                    {activeOrdersCount}
                  </div>
                  <div className="text-[10px] text-stone-400 font-sans tracking-wide">
                    Placed or Processing status
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-[#E5D2BC]/20 shadow-sm space-y-1.5">
                  <div className="flex items-center justify-between text-[#2A211C]/50">
                    <span className="text-[10px] font-bold tracking-wider uppercase font-sans">Average Value</span>
                    <TrendingUp className="w-4 h-4 text-[#C98A82]" />
                  </div>
                  <div className="font-serif text-lg md:text-2xl font-bold text-[#2A211C]">
                    ₹{Math.round(averageOrderValue).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-stone-400 font-sans tracking-wide">
                    Value per cart order
                  </div>
                </div>
              </div>

              {/* FILTER AND SEARCH BAR */}
              <div className="bg-white p-4 rounded-xl border border-[#E5D2BC]/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative md:w-1/3 font-sans text-xs">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search ID, Customer, City, PIN..."
                    className="w-full pl-9 pr-3 py-2.5 rounded border border-stone-200 focus:outline-none focus:ring-1 focus:ring-[#B08D57] focus:border-[#B08D57] bg-stone-50 text-stone-800"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-stone-400 mr-2 font-sans">Status:</span>
                  {['All', 'Paid', 'Placed', 'Processing', 'Dispatched', 'Delivered', 'Cancelled', 'Refund Initiated', 'Refund Completed'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                        statusFilter === status 
                          ? 'bg-[#2A211C] text-[#FBF6EE]' 
                          : 'bg-stone-100 hover:bg-stone-200 text-[#2A211C]/70'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* ORDERS REGISTRY LIST TABLE */}
              <div className="bg-white rounded-xl border border-[#E5D2BC]/20 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-sans text-xs md:text-sm">
                    <thead>
                      <tr className="bg-[#2A211C] text-[#FBF6EE] text-[10px] font-bold tracking-widest uppercase border-b border-stone-800">
                        <th className="p-4">Order ID</th>
                        <th className="p-4">Date</th>
                        <th className="p-4">Customer</th>
                        <th className="p-4">Location</th>
                        <th className="p-4 text-right">Grand Total</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-[#2A211C]">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-stone-400 space-y-2">
                            <ShoppingBag className="w-8 h-8 mx-auto text-stone-300" />
                            <p className="font-medium text-xs">No orders match your filters or query</p>
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((order) => {
                          const dateObj = new Date(order.created_at);
                          const formattedDate = dateObj.toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          });
                          const formattedTime = dateObj.toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit'
                          });

                          return (
                            <tr key={order.order_id} className="hover:bg-stone-50 transition-colors">
                              <td className="p-4 font-mono font-bold text-stone-900">
                                {order.order_id}
                              </td>
                              <td className="p-4 text-stone-500 whitespace-nowrap">
                                <div className="font-medium text-stone-700">{formattedDate}</div>
                                <div className="text-[10px] text-stone-400 mt-0.5">{formattedTime}</div>
                              </td>
                              <td className="p-4">
                                <div className="font-bold text-stone-800">{order.customer_name}</div>
                                <div className="text-[10px] text-stone-400 font-medium mt-0.5">{order.customer_phone}</div>
                              </td>
                              <td className="p-4 text-stone-600 font-medium">
                                <div>{order.city}</div>
                                <div className="text-[10px] text-stone-400 mt-0.5">{order.state} ({order.pincode})</div>
                              </td>
                              <td className="p-4 text-right font-serif font-bold text-stone-900">
                                ₹{Number(order.grand_total).toLocaleString('en-IN')}
                              </td>
                              <td className="p-4 whitespace-nowrap">
                                <span className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider ${getOrderStatusBadgeClass(order.status)}`}>
                                  {(order.status || 'placed').replace('_', ' ')}
                                </span>
                              </td>
                              <td className="p-4 text-center whitespace-nowrap">
                                <button
                                  onClick={() => setSelectedOrder(order)}
                                  className="px-3 py-1.5 bg-[#2A211C] hover:bg-[#322c24] text-white text-[10px] font-bold uppercase tracking-wider rounded transition-colors cursor-pointer"
                                >
                                  Details
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PRODUCT CATALOG & MANAGER VIEW */}
          {activeTab === 'products' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-4 rounded-xl border border-[#E5D2BC]/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Search Input */}
                <div className="relative md:w-1/3 font-sans text-xs">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search product catalog by Name, SKU, color..."
                    className="w-full pl-9 pr-3 py-2.5 rounded border border-stone-200 focus:outline-none focus:ring-1 focus:ring-[#B08D57] focus:border-[#B08D57] bg-stone-50 text-stone-800"
                  />
                </div>

                {/* Category filters & Add Product Button */}
                <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-stone-400 font-sans">Category:</span>
                    <select
                      value={productCategoryFilter}
                      onChange={(e) => setProductCategoryFilter(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-stone-100 text-xs text-[#2A211C] font-bold uppercase border-none focus:ring-1 focus:ring-[#B08D57]"
                    >
                      <option value="All">All Categories</option>
                      <option value="shirts">Shirts</option>
                      <option value="pants">Pants/Trousers</option>
                      <option value="kurtas">Kurtas</option>
                      <option value="co-ord sets">Co-ord Sets</option>
                      <option value="jackets">Jackets</option>
                      <option value="accessories">Accessories</option>
                    </select>
                  </div>

                  <button
                    onClick={() => initProductForm(null)}
                    className="bg-[#B08D57] hover:bg-[#a04e2e] text-white py-2 px-4 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Product</span>
                  </button>
                </div>
              </div>

              {/* PRODUCTS LIST TABLE */}
              <div className="bg-white rounded-xl border border-[#E5D2BC]/20 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-sans text-xs md:text-sm">
                    <thead>
                      <tr className="bg-[#2A211C] text-[#FBF6EE] text-[10px] font-bold tracking-widest uppercase border-b border-stone-800">
                        <th className="p-4 w-16">Preview</th>
                        <th className="p-4">Product details</th>
                        <th className="p-4">SKU Code</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Price (INR)</th>
                        <th className="p-4">Sizes & Stock</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-[#2A211C]">
                      {filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-12 text-center text-stone-400 space-y-2">
                            <Package className="w-8 h-8 mx-auto text-stone-300" />
                            <p className="font-medium text-xs">No products found in Firestore catalog</p>
                            <button
                              onClick={() => initProductForm(null)}
                              className="text-[#B08D57] hover:underline font-bold text-xs"
                            >
                              Create your first product now
                            </button>
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map((product) => (
                          <tr key={product.id} className="hover:bg-stone-50 transition-colors">
                            <td className="p-4">
                              <img
                                src={product.images && product.images[0] ? product.images[0] : 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=100'}
                                alt=""
                                className="w-10 h-12 object-cover rounded bg-stone-100 border border-stone-200 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-stone-900">{product.name}</div>
                              <div className="text-[10px] text-stone-400 mt-0.5 whitespace-nowrap">
                                Color: <strong className="text-stone-700">{product.color || 'Natural'}</strong> • Fit: <strong className="text-stone-700">{product.fit || 'Regular'}</strong>
                              </div>
                            </td>
                            <td className="p-4 font-mono text-stone-600 font-medium">
                              {product.sku || 'N/A'}
                            </td>
                            <td className="p-4">
                              <span className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                {product.category}
                              </span>
                            </td>
                            <td className="p-4 font-serif font-bold text-stone-900">
                              <div>₹{product.price.toLocaleString('en-IN')}</div>
                              {product.compareAtPrice ? (
                                <div className="text-[10px] text-stone-400 line-through font-sans">₹{product.compareAtPrice.toLocaleString('en-IN')}</div>
                              ) : null}
                            </td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-1 max-w-[200px]">
                                {product.sizes && product.sizes.length > 0 ? (
                                  product.sizes.map(size => {
                                    const qty = product.stock?.[size] ?? 0;
                                    return (
                                      <span
                                        key={size}
                                        className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase font-mono border ${
                                          qty === 0 
                                            ? 'bg-red-50 text-red-700 border-red-100' 
                                            : qty <= 5 
                                              ? 'bg-amber-50 text-amber-800 border-amber-100' 
                                              : 'bg-stone-50 text-stone-700 border-stone-200'
                                        }`}
                                        title={`Stock quantity: ${qty}`}
                                      >
                                        {size}: {qty}
                                      </span>
                                    );
                                  })
                                ) : (
                                  <span className="text-red-500 font-semibold text-[10px]">No sizes selected</span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider ${
                                product.status === 'draft' 
                                  ? 'bg-stone-100 text-stone-600' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {product.status || 'published'}
                              </span>
                            </td>
                            <td className="p-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => initProductForm(product)}
                                  className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded transition-colors cursor-pointer"
                                  title="Edit Product"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(product.id, product.name)}
                                  className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors cursor-pointer"
                                  title="Delete Product"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ADD / EDIT PRODUCT FORM FULL-OVERLAY */}
          {showProductForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-end">
              <div className="bg-white shadow-2xl max-w-4xl w-full h-full overflow-y-auto border-l border-[#E5D2BC]/30 flex flex-col font-sans animate-slide-left">
                {/* Form Pinned Header */}
                <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50 sticky top-0 z-10">
                  <div>
                    <span className="text-[9px] font-bold tracking-widest uppercase text-[#B08D57] block">Product Catalog Administration</span>
                    <h3 className="font-serif text-lg font-bold text-[#2A211C]">
                      {editingProduct ? `Edit Product: ${editingProduct.name}` : 'Create Brand-New Product'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Discard unsaved changes?')) {
                        setShowProductForm(false);
                        setEditingProduct(null);
                      }
                    }}
                    className="p-1.5 rounded-full hover:bg-stone-200 text-stone-500 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form Main Body Content */}
                <form onSubmit={uploadAndSaveProduct} className="p-6 space-y-6 flex-1 overflow-y-auto text-xs text-stone-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* LEFT COLUMN: CORE INFO */}
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Product Name *</label>
                        <input
                          type="text"
                          required
                          value={formName}
                          onChange={(e) => {
                            const newName = e.target.value;
                            setFormName(newName);
                            if (!editingProduct && (!formSlug || formSlug === slugify(formName))) {
                              setFormSlug(slugify(newName));
                            }
                          }}
                          placeholder="e.g. Belgian Heritage Mandarin Collar Shirt"
                          className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 font-medium text-stone-800"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">URL Slug (SEO Permalink)</label>
                        <input
                          type="text"
                          value={formSlug}
                          onChange={(e) => setFormSlug(slugify(e.target.value))}
                          placeholder={slugify(formName) || "e.g. floral-wrap-midi-dress"}
                          className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 font-medium text-stone-800"
                        />
                        <p className="text-[10px] text-stone-400">Canonical URL: /product/{formSlug || slugify(formName) || "..."}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">SKU Code</label>
                          <input
                            type="text"
                            value={formSku}
                            onChange={(e) => setFormSku(e.target.value)}
                            placeholder="e.g. SS-SH-004"
                            className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 font-medium text-stone-800"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Fit Profile</label>
                          <select
                            value={formFit}
                            onChange={(e) => setFormFit(e.target.value as any)}
                            className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 font-medium text-stone-800"
                          >
                            <option value="Slim">Slim Fit</option>
                            <option value="Regular">Regular Fit</option>
                            <option value="Relaxed">Relaxed Fit</option>
                          </select>
                        </div>
                      </div>

                      {/* CATALOG MERCHANDISING TAXONOMY */}
                      <div className="border border-stone-200 bg-stone-50/70 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-stone-200/80 pb-2">
                          <div className="flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-[#B08D57]" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-800">Catalog Classification</span>
                          </div>
                          <span className="text-[9px] font-bold bg-[#B08D57]/10 text-[#B08D57] px-2 py-0.5 rounded-full">Normalized Taxonomy</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Merchandising Collection</label>
                            <select
                              value={formCollection}
                              onChange={(e) => handleCollectionChange(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-white text-stone-800 text-xs"
                            >
                              <option value="">-- None / Unassigned --</option>
                              {CANONICAL_COLLECTIONS.map(col => (
                                <option key={col.id} value={col.id}>{col.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Product Type</label>
                            <select
                              value={formProductType}
                              onChange={(e) => handleProductTypeChange(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-white text-stone-800 text-xs"
                            >
                              <option value="">-- None / Unassigned --</option>
                              {getAvailableProductTypesForCollection(formCollection).map(pt => (
                                <option key={pt.id} value={pt.id}>{pt.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {getAvailableSubTypesForProductType(formProductType).length > 0 && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Product Sub-Type (Optional)</label>
                            <select
                              value={formProductSubType}
                              onChange={(e) => setFormProductSubType(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-white text-stone-800 text-xs"
                            >
                              <option value="">-- Standard / No Sub-Type --</option>
                              {getAvailableSubTypesForProductType(formProductType).map(st => (
                                <option key={st.id} value={st.id}>{st.label}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Material Type</label>
                          <select
                            value={formMaterialType}
                            onChange={(e) => setFormMaterialType(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-white text-stone-800 text-xs"
                          >
                            <option value="">-- None / Unassigned --</option>
                            {CANONICAL_MATERIAL_TYPES.map(mt => (
                              <option key={mt.id} value={mt.id}>{mt.label}</option>
                            ))}
                          </select>
                        </div>

                        <p className="text-[10px] text-stone-500 italic">
                          Enables multi-dimensional discovery (Shop by Collection & Shop by Product) from a single product record.
                        </p>
                      </div>

                      {/* STATUTORY TAX CLASSIFICATION */}
                      <div className="border border-amber-200/80 bg-amber-50/50 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-amber-200/70 pb-2">
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-800" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">Statutory Tax Classification</span>
                          </div>
                          <span className="text-[9px] font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">Tax Master Link</span>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-stone-600 block">Tax Class (tax_class)</label>
                          <select
                            value={formTaxClass}
                            onChange={(e) => setFormTaxClass(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-amber-200 rounded focus:outline-none focus:border-amber-600 bg-white text-stone-800 text-xs font-mono"
                          >
                            <option value="">-- Unassigned / Category Fallback --</option>
                            {SELECTABLE_TAX_CLASSES.map(tc => (
                              <option key={tc.id} value={tc.id}>{tc.label}</option>
                            ))}
                          </select>
                          <p className="text-[10px] text-stone-500">
                            Tax Class links this product to Product Tax Master. HSN and GST rates are managed separately in GST Tax Master.
                          </p>
                        </div>
                      </div>

                      {/* LEGACY STOREFRONT ROUTING */}
                      <div className="border border-stone-200 bg-stone-50/40 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-stone-200/70 pb-2">
                          <div className="flex items-center gap-1.5">
                            <LinkIcon className="w-3.5 h-3.5 text-stone-500" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">Active Storefront Routing (Legacy)</span>
                          </div>
                          <span className="text-[9px] text-stone-400 font-mono">Preserved</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Storefront Category *</label>
                            <select
                              value={formCategory}
                              onChange={(e) => {
                                const cat = e.target.value as any;
                                setFormCategory(cat);
                                if (cat === 'tops-shirts') setFormSubCategory('tops');
                                else if (cat === 'shorts-skirts') setFormSubCategory('shorts');
                                else setFormSubCategory(cat);
                              }}
                              className="w-full px-2.5 py-1.5 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-white text-stone-800 text-xs"
                            >
                              <option value="dresses">Dresses</option>
                              <option value="tops-shirts">Top & Shirts</option>
                              <option value="shorts-skirts">Shorts & Skirts</option>
                              <option value="co-ord-sets">Co-Ord Sets</option>
                              <option value="trousers">Trousers</option>
                              <option value="jackets">Jackets</option>
                              <option value="bags-pouches">Bags & Pouches</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Storefront Sub-Category *</label>
                            <select
                              value={formSubCategory}
                              onChange={(e) => setFormSubCategory(e.target.value as any)}
                              className="w-full px-2.5 py-1.5 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-white text-stone-800 text-xs"
                            >
                              {formCategory === 'dresses' && <option value="dresses">Dresses</option>}
                              {formCategory === 'tops-shirts' && (
                                <>
                                  <option value="tops">Tops</option>
                                  <option value="shirts">Shirts</option>
                                </>
                              )}
                              {formCategory === 'shorts-skirts' && (
                                <>
                                  <option value="shorts">Shorts</option>
                                  <option value="skirts">Skirts</option>
                                </>
                              )}
                              {formCategory === 'co-ord-sets' && <option value="co-ord-sets">Co-Ord Sets</option>}
                              {formCategory === 'trousers' && <option value="trousers">Trousers</option>}
                              {formCategory === 'jackets' && <option value="jackets">Jackets</option>}
                              {formCategory === 'bags-pouches' && <option value="bags-pouches">Bags & Pouches</option>}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Short Description *</label>
                        <textarea
                          rows={3}
                          value={formDescription}
                          onChange={(e) => setFormDescription(e.target.value)}
                          placeholder="Brief single-paragraph customer hooks describing the item..."
                          className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 font-medium text-stone-800"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Full Description & Fabric details (One per line)</label>
                        <textarea
                          rows={4}
                          value={formDetails}
                          onChange={(e) => setFormDetails(e.target.value)}
                          placeholder="e.g. Soft, breathable fabric&#10;Flattering relaxed fit&#10;Pre-washed for lasting comfort"
                          className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 font-medium text-stone-800 font-mono text-[11px]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Care Instructions (One per line)</label>
                        <textarea
                          rows={3}
                          value={formCareInstructions}
                          onChange={(e) => setFormCareInstructions(e.target.value)}
                          placeholder="e.g. Cold gentle machine wash&#10;Dry flat in soft ambient shade&#10;Warm iron on reverse while damp"
                          className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 font-medium text-stone-800 font-mono text-[11px]"
                        />
                      </div>
                    </div>

                    {/* RIGHT COLUMN: PRICING, MEDIA & STOCK */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Price (INR) *</label>
                          <input
                            type="number"
                            required
                            min="0"
                            value={formPrice}
                            onChange={(e) => setFormPrice(e.target.value)}
                            placeholder="e.g. 3200"
                            className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 font-medium text-[#2A211C]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Discounted / Compare At Price (INR)</label>
                          <input
                            type="number"
                            min="0"
                            value={formCompareAtPrice}
                            onChange={(e) => setFormCompareAtPrice(e.target.value)}
                            placeholder="e.g. 4500"
                            className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 font-medium text-[#2A211C]"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Fabric Material specifications</label>
                        <input
                          type="text"
                          value={formFabric}
                          onChange={(e) => setFormFabric(e.target.value)}
                          placeholder="e.g. 100% Cotton, lightweight weave"
                          className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 font-medium text-stone-800"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Color Name</label>
                          <input
                            type="text"
                            value={formColor}
                            onChange={(e) => setFormColor(e.target.value)}
                            placeholder="e.g. Blush Pink, Ivory"
                            className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 font-medium text-[#2A211C]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Color Palette Accent Hex</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={formColorHex}
                              onChange={(e) => setFormColorHex(e.target.value)}
                              className="w-10 h-9 p-0.5 border border-stone-200 rounded cursor-pointer shrink-0"
                            />
                            <input
                              type="text"
                              value={formColorHex}
                              onChange={(e) => setFormColorHex(e.target.value)}
                              placeholder="#FBF6EE"
                              className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 font-mono text-[11px] text-stone-800"
                            />
                          </div>
                        </div>
                      </div>

                      {formCategory === 'tops-shirts' && (
                        <div className="grid grid-cols-2 gap-4 border border-[#E5D2BC]/10 p-3 rounded-lg bg-stone-50">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Collar Style</label>
                            <input
                              type="text"
                              value={formCollar}
                              onChange={(e) => setFormCollar(e.target.value)}
                              placeholder="Spread, Mandarin, Button-Down"
                              className="w-full px-2 py-1.5 border border-stone-200 rounded focus:outline-none bg-white text-stone-800"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Sleeve Cut</label>
                            <input
                              type="text"
                              value={formSleeve}
                              onChange={(e) => setFormSleeve(e.target.value)}
                              placeholder="Full Sleeve, Half Sleeve"
                              className="w-full px-2 py-1.5 border border-stone-200 rounded focus:outline-none bg-white text-stone-800"
                            />
                          </div>
                        </div>
                      )}

                      {/* AVAILABLE SIZES SELECTION */}
                      <div className="space-y-2 border border-stone-100 p-4 rounded-xl">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Available Sizes & Stock Quantity per Size *</label>
                        <p className="text-[10px] text-stone-400">Check size to enable it, then specify available stock units.</p>
                        
                        <div className="grid grid-cols-3 gap-3">
                          {(formCategory === 'trousers'
                            ? ['30', '32', '34', '36', '38']
                            : ['S', 'M', 'L', 'XL', 'XXL', '3XL']
                          ).map((size) => {
                            const isChecked = formSizes.includes(size);
                            return (
                              <div key={size} className="space-y-1.5 border border-stone-100 p-2 rounded bg-stone-50/50">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleSizeToggle(size)}
                                    className="rounded border-stone-300 text-[#B08D57] focus:ring-[#B08D57] w-4 h-4 cursor-pointer"
                                  />
                                  <span className="font-bold text-stone-800 text-xs font-mono">{size}</span>
                                </label>
                                
                                {isChecked && (
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="Stock Qty"
                                    value={formStock[size] !== undefined ? formStock[size] : ''}
                                    onChange={(e) => handleStockChange(size, e.target.value)}
                                    className="w-full px-1.5 py-1 text-[11px] font-mono border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-[#B08D57]"
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* MEDIA FILE UPLOAD ZONE */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Product Media Images (Minimum 1, Maximum 6) *</label>
                        
                        {/* Drag and Drop Zone */}
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
                            isDragging
                              ? 'border-[#B08D57] bg-[#B08D57]/5'
                              : 'border-stone-200 hover:border-[#B08D57] hover:bg-stone-50'
                          }`}
                        >
                          <Upload className="w-7 h-7 text-stone-400 animate-pulse" />
                          <span className="text-[11px] font-bold text-stone-700">Drag & drop product photos here or click to browse</span>
                          <span className="text-[9px] text-stone-400 uppercase tracking-wide">JPG, PNG, WEBP formats</span>
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            multiple
                            accept="image/*"
                            className="hidden"
                          />
                        </div>

                        {/* Images list and priorities */}
                        <div className="flex flex-wrap gap-2 pt-2">
                          {/* Firebase Stored Images */}
                          {formImages.map((imgUrl, idx) => (
                            <div key={`form-img-${idx}`} className="relative w-16 h-20 bg-stone-100 border border-stone-200 rounded overflow-hidden group">
                              <img
                                src={imgUrl}
                                alt=""
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <button
                                type="button"
                                onClick={() => removeUploadedImage(idx)}
                                className="absolute top-0.5 right-0.5 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                              <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-white text-center font-bold py-0.5">
                                Active
                              </div>
                            </div>
                          ))}

                          {/* Selected files pending upload */}
                          {selectedFiles.map((file, idx) => {
                            const localUrl = URL.createObjectURL(file);
                            return (
                              <div key={`local-file-${idx}`} className="relative w-16 h-20 bg-stone-100 border border-stone-200 rounded overflow-hidden group">
                                <img
                                  src={localUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeSelectedFile(idx)}
                                  className="absolute top-0.5 right-0.5 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                                <div className="absolute bottom-0 inset-x-0 bg-[#C98A82] text-[8px] text-white text-center font-bold py-0.5">
                                  Pending
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* STATUS TOGGLE */}
                      <div className="p-4 rounded-xl border border-stone-100 bg-stone-50 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Catalog Visibility Status</label>
                          <p className="text-[10px] text-stone-400">Published items are visible to buyers. Draft items are hidden.</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setFormStatus('draft')}
                            className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                              formStatus === 'draft'
                                ? 'bg-stone-800 text-white shadow'
                                : 'bg-white text-stone-500 border border-stone-200'
                            }`}
                          >
                            Draft
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormStatus('published')}
                            className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                              formStatus === 'published'
                                ? 'bg-[#C98A82] text-white shadow'
                                : 'bg-white text-stone-500 border border-stone-200'
                            }`}
                          >
                            Published
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Form Action Footer */}
                  <div className="pt-6 border-t border-stone-100 flex items-center justify-end gap-3 sticky bottom-0 bg-white pb-2">
                    <button
                      type="button"
                      disabled={isSavingProduct}
                      onClick={() => {
                        if (window.confirm('Discard unsaved changes?')) {
                          setShowProductForm(false);
                          setEditingProduct(null);
                        }
                      }}
                      className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded font-bold uppercase tracking-wider text-[10px] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingProduct}
                      className="px-6 py-2.5 bg-[#B08D57] hover:bg-[#a04e2e] text-white rounded font-bold uppercase tracking-wider text-[10px] transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSavingProduct ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving to Catalog...</span>
                        </>
                      ) : (
                        <span>Save & Apply Product</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* RETURNS & EXCHANGES MANAGEMENT TAB */}
          {activeTab === 'returns' && (
            <AdminReturnsTab />
          )}
          {false && (
            <div>
              <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                  {/* Search input */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Search Request ID, Order ID, Email..."
                      value={returnsSearch}
                      onChange={(e) => setReturnsSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-200 bg-stone-50 focus:outline-none focus:border-[#B08D57]"
                    />
                  </div>

                  {/* Status filter dropdown */}
                  <div className="flex items-center gap-1.5 text-xs text-stone-600">
                    <Filter className="w-3.5 h-3.5 text-stone-400" />
                    <select
                      value={returnsStatusFilter}
                      onChange={(e) => setReturnsStatusFilter(e.target.value)}
                      className="py-2 px-3 rounded-lg border border-stone-200 bg-stone-50 font-bold text-xs text-stone-800 focus:outline-none focus:border-[#B08D57]"
                    >
                      <option value="All">All Statuses</option>
                      <option value="REQUESTED">Requested</option>
                      <option value="APPROVED">Approved</option>
                      <option value="PICKUP_SCHEDULED">Pickup Scheduled</option>
                      <option value="PICKED_UP">Picked Up</option>
                      <option value="RECEIVED">Received</option>
                      <option value="QUALITY_CHECK">Quality Check</option>
                      <option value="REFUND_PROCESSED">Refund Processed</option>
                      <option value="EXCHANGE_SHIPPED">Exchange Shipped</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </div>

                  {/* Type filter dropdown */}
                  <select
                    value={returnsTypeFilter}
                    onChange={(e) => setReturnsTypeFilter(e.target.value)}
                    className="py-2 px-3 rounded-lg border border-stone-200 bg-stone-50 font-bold text-xs text-stone-800 focus:outline-none focus:border-[#B08D57]"
                  >
                    <option value="All">All Types</option>
                    <option value="RETURN">Return Only</option>
                    <option value="EXCHANGE">Exchange Only</option>
                    <option value="MIXED">Mixed (Return & Exchange)</option>
                  </select>
                </div>

                <button
                  onClick={loadReturnRequests}
                  className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>

              {/* TABLE OF REQUESTS */}
              <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider text-[10px] border-b border-stone-200">
                    <tr>
                      <th className="p-3.5">Request ID / Date</th>
                      <th className="p-3.5">Order ID</th>
                      <th className="p-3.5">Customer</th>
                      <th className="p-3.5">Type & Items</th>
                      <th className="p-3.5 text-right">Fee / Refund</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {returnRequests
                      .filter(req => {
                        const term = returnsSearch.toLowerCase().trim();
                        const matchesSearch = !term || 
                          (req.request_id && req.request_id.toLowerCase().includes(term)) ||
                          (req.order_id && req.order_id.toLowerCase().includes(term)) ||
                          (req.customer_email && req.customer_email.toLowerCase().includes(term)) ||
                          (req.customer_phone && req.customer_phone.includes(term));
                        
                        const matchesStatus = returnsStatusFilter === 'All' || req.status === returnsStatusFilter;
                        const matchesType = returnsTypeFilter === 'All' || req.request_type === returnsTypeFilter;

                        return matchesSearch && matchesStatus && matchesType;
                      })
                      .map(req => (
                        <tr key={req.request_id} className="hover:bg-stone-50 transition-colors">
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="font-mono font-bold text-[#B08D57] block">{req.request_id}</span>
                            <span className="text-[10px] text-stone-400">
                              {new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono font-bold text-stone-800">
                            {req.order_id}
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-stone-900">{req.customer_name || 'Customer'}</div>
                            <div className="text-[10px] text-stone-400">{req.customer_email}</div>
                          </td>
                          <td className="p-3.5">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider mb-1 ${
                              req.request_type === 'EXCHANGE' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                              req.request_type === 'RETURN' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                              'bg-purple-50 text-purple-800 border border-purple-200'
                            }`}>
                              {req.request_type}
                            </span>
                            <div className="text-[11px] text-stone-600">
                              {req.items?.length || 0} item(s) requested
                            </div>
                          </td>
                          <td className="p-3.5 text-right font-mono">
                            {req.return_shipping_fee > 0 && (
                              <div className="text-[10px] text-rose-600 font-medium">Fee: -₹{req.return_shipping_fee}</div>
                            )}
                            <div className="font-bold text-stone-900">
                              Refund: ₹{Number(req.estimated_refund_total || 0).toLocaleString('en-IN')}
                            </div>
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider ${
                              req.status === 'COMPLETED' || req.status === 'REFUND_PROCESSED' || req.status === 'EXCHANGE_SHIPPED' ? 'bg-emerald-100 text-emerald-800' :
                              req.status === 'APPROVED' || req.status === 'PICKUP_SCHEDULED' ? 'bg-blue-100 text-blue-800' :
                              req.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedReturnReq(req);
                                setAdminNotesInput(req.admin_notes || '');
                              }}
                              className="px-3 py-1.5 bg-[#2A211C] hover:bg-[#332c24] text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      ))}
                    {returnRequests.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-stone-400 font-sans text-xs">
                          No return or exchange requests logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ORDER DETAIL DRAWER / MODAL OVERLAY */}
          {selectedOrder && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#E5D2BC]/30 flex flex-col font-sans">
                {/* Header */}
                <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50">
                  <div>
                    <span className="text-[9px] font-bold tracking-widest uppercase text-[#B08D57] block">Order Detail Invoice</span>
                    <div className="flex items-center gap-3 mt-0.5">
                      <h3 className="font-serif text-lg font-bold text-[#2A211C]">Registry ID: {selectedOrder.order_id}</h3>
                      <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${getOrderStatusBadgeClass(selectedOrder.status)}`}>
                        {(selectedOrder.status || 'placed').replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-1.5 rounded-full hover:bg-stone-200 text-stone-500 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-6 overflow-y-auto text-xs text-stone-700">
                  {/* Status update box */}
                  <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 space-y-3 font-sans">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-wider uppercase text-stone-500 block">Authoritative Order Lifecycle State</span>
                      <span className="text-[10px] font-mono text-stone-400">Server-Enforced State Machine</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {(() => {
                        const isRazorpayOrder = (selectedOrder.payment_method || '').toString().toLowerCase() === 'razorpay' || !!selectedOrder.payment_id;
                        return [
                          { key: 'processing', label: 'Processing' },
                          { key: 'dispatched', label: 'Dispatched / Shipped' },
                          { key: 'delivered', label: 'Delivered' },
                          { key: 'cancelled', label: 'Cancelled' },
                          { key: 'refund_initiated', label: 'Refund Initiated', autoOnly: true },
                          { key: 'refund_completed', label: 'Refund Completed', autoOnly: true }
                        ].map((st) => {
                          const isDisabled = isRazorpayOrder && st.autoOnly;
                          return (
                            <button
                              key={st.key}
                              disabled={isDisabled}
                              title={isDisabled ? 'Razorpay prepaid order refunds are initiated via the Razorpay panel below and completed automatically via Webhook.' : ''}
                              onClick={() => !isDisabled && handleOpenStatusModal(selectedOrder, st.key)}
                              className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                                isDisabled
                                  ? 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed opacity-60'
                                  : selectedOrder.status?.toLowerCase() === st.key || (st.key === 'dispatched' && selectedOrder.status?.toLowerCase() === 'shipped')
                                  ? 'bg-[#B08D57] text-white shadow'
                                  : 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 cursor-pointer'
                              }`}
                            >
                              {st.label} {isDisabled && '(Auto Webhook)'}
                            </button>
                          );
                        });
                      })()}
                    </div>

                    {/* Secure Public Tracking Link Section */}
                    <div className="mt-3 p-3 bg-[#FDFBF7] rounded border border-[#E8DFD3] space-y-2 text-stone-700 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-900 flex items-center gap-1.5">
                          <LinkIcon className="w-3.5 h-3.5 text-[#8C6D53]" />
                          <span>Sa and Sha Tracking Link</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const link = selectedOrder.tracking_token
                              ? `${window.location.origin}/track-order/${selectedOrder.tracking_token}`
                              : `${window.location.origin}/track-order?orderId=${selectedOrder.order_id}`;
                            navigator.clipboard.writeText(link);
                            showToast('Tracking link copied to clipboard!');
                          }}
                          className="px-2 py-1 bg-[#2A211C] text-[#FDFBF7] rounded hover:bg-[#38322B] text-[10px] font-medium flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy Tracking Link</span>
                        </button>
                      </div>
                      <p className="font-mono text-[10px] text-stone-500 truncate">
                        {selectedOrder.tracking_token
                          ? `${window.location.origin}/track-order/trk_***${selectedOrder.tracking_token.slice(-6)}`
                          : `${window.location.origin}/track-order?orderId=${selectedOrder.order_id}`}
                      </p>
                    </div>

                    {/* Display Courier & Tracking Info if Dispatched */}
                    {selectedOrder.tracking_number && (
                      <div className="mt-3 p-3 bg-white rounded border border-stone-200 space-y-1 text-stone-700 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-stone-900 flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-[#B08D57]" />
                            <span>Courier: {selectedOrder.courier_name || selectedOrder.courier || 'Express Shipping'}</span>
                          </span>
                          <span className="font-mono font-bold text-stone-900">AWB: {selectedOrder.tracking_number}</span>
                        </div>
                        {selectedOrder.tracking_url && (
                          <div className="pt-1">
                            <a
                              href={selectedOrder.tracking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#B08D57] font-mono hover:underline flex items-center gap-1 text-[10px]"
                            >
                              <span>Track Live Package</span>
                              <ArrowRight className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                        {selectedOrder.estimated_delivery_date && (
                          <div className="text-[10px] text-stone-500 pt-0.5">
                            Est. Delivery: <strong>{selectedOrder.estimated_delivery_date}</strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Razorpay Financial & Real Refund Management Panel */}
                  <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 space-y-3 font-sans text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-wider uppercase text-stone-500">
                        Razorpay Financial & Refund State
                      </span>
                      <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${getFinancialRefundStatusBadge(selectedOrder.refund_status)}`}>
                        {(selectedOrder.refund_status || 'no_refund').replace('_', ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-stone-700 bg-white p-3 rounded border border-stone-200">
                      <div>
                        <span className="text-[10px] text-stone-400 block uppercase font-bold">Method</span>
                        <span className="font-bold text-stone-900 uppercase text-[11px]">
                          {selectedOrder.payment_method || 'Razorpay'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 block uppercase font-bold">Paid Total</span>
                        <span className="font-bold font-mono text-stone-900">
                          ₹{Number(selectedOrder.grand_total || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 block uppercase font-bold">Refunded</span>
                        <span className="font-bold font-mono text-emerald-800">
                          ₹{(
                            selectedOrder.refund_total !== undefined
                              ? selectedOrder.refund_total
                              : (selectedOrder.refunds || []).filter((r: any) => r.status !== 'failed').reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0)
                          ).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 block uppercase font-bold">Refundable Balance</span>
                        <span className="font-bold font-mono text-[#B08D57]">
                          ₹{(
                            selectedOrder.refundable_balance !== undefined
                              ? selectedOrder.refundable_balance
                              : Math.max(0, (Number(selectedOrder.grand_total) || 0) - ((selectedOrder.refunds || []).filter((r: any) => r.status !== 'failed').reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0)))
                          ).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Status Banner for Razorpay Prepaid Orders */}
                    {(selectedOrder.payment_method?.toLowerCase() === 'razorpay' || selectedOrder.payment_id) && (
                      <div className="pt-1">
                        {selectedOrder.refund_status === 'UNKNOWN' || selectedOrder.reconciliation_required ? (
                          <div className="p-3 bg-amber-50 border border-amber-300 text-amber-950 rounded text-xs flex items-center justify-between gap-2 font-medium shadow-sm">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                              <span><strong>REFUND STATUS UNCONFIRMED:</strong> Your refund status is being confirmed with Razorpay.</span>
                            </div>
                            <button
                              onClick={() => handleReconcileRefund(selectedOrder)}
                              className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white font-bold text-[10px] uppercase tracking-wider rounded transition-colors shrink-0 cursor-pointer"
                            >
                              Check Provider Status
                            </button>
                          </div>
                        ) : selectedOrder.refund_status === 'refund_completed' || selectedOrder.status === 'refund_completed' || selectedOrder.refund_status === 'PROCESSED' ? (
                          <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded text-xs flex items-center gap-2 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                            <span>Refund Completed (Verified Razorpay Webhook / Provider Confirmation)</span>
                          </div>
                        ) : selectedOrder.refund_status === 'refund_pending' || selectedOrder.refund_status === 'INITIATED' || (Array.isArray(selectedOrder.refunds) && selectedOrder.refunds.some((r: any) => r.status === 'pending' || r.status === 'submitting')) ? (
                          <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded text-xs flex items-center gap-2 font-medium">
                            <Clock className="w-4 h-4 text-amber-700 shrink-0 animate-pulse" />
                            <span>Waiting for Razorpay confirmation</span>
                          </div>
                        ) : selectedOrder.refund_status === 'refund_failed' || selectedOrder.refund_status === 'FAILED' ? (
                          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-900 rounded text-xs flex items-center gap-2 font-medium">
                            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                            <span>Refund Failed</span>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Notice if order is cancelled and prepaid */}
                    {selectedOrder.status?.toLowerCase() === 'cancelled' &&
                     (selectedOrder.payment_method?.toLowerCase() === 'razorpay' || selectedOrder.payment_id) &&
                     ((selectedOrder.refundable_balance !== undefined ? selectedOrder.refundable_balance : (Number(selectedOrder.grand_total || 0) - ((selectedOrder.refunds || []).filter((r: any) => r.status !== 'failed').reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0)))) > 0) && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 text-xs flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>Order cancelled. Prepaid payment requires refund.</span>
                        </div>
                        <button
                          onClick={() => handleOpenRazorpayRefundModal(selectedOrder)}
                          className="px-3 py-1.5 bg-[#B08D57] hover:bg-[#a04e2e] text-white font-bold text-[10px] uppercase tracking-wider rounded transition-colors shrink-0 cursor-pointer"
                        >
                          Initiate Refund
                        </button>
                      </div>
                    )}

                    {/* Initiate Razorpay Refund Action */}
                    {(selectedOrder.payment_method?.toLowerCase() === 'razorpay' || selectedOrder.payment_id) &&
                     ((selectedOrder.refundable_balance !== undefined ? selectedOrder.refundable_balance : (Number(selectedOrder.grand_total || 0) - ((selectedOrder.refunds || []).filter((r: any) => r.status !== 'failed').reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0)))) > 0) && (
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={() => handleOpenRazorpayRefundModal(selectedOrder)}
                          className="px-4 py-2 bg-[#B08D57] hover:bg-[#a04e2e] text-white font-bold text-xs uppercase tracking-wider rounded shadow transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Initiate Razorpay Refund</span>
                        </button>
                      </div>
                    )}

                    {/* Refund History Table */}
                    {Array.isArray(selectedOrder.refunds) && selectedOrder.refunds.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Refund History Log</span>
                        <div className="overflow-x-auto border border-stone-200 rounded bg-white">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-stone-100 text-stone-600 font-bold uppercase text-[9px]">
                              <tr>
                                <th className="p-2">Refund ID</th>
                                <th className="p-2">Amount</th>
                                <th className="p-2">Status</th>
                                <th className="p-2">Reason</th>
                                <th className="p-2">Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 font-mono text-[10px]">
                              {selectedOrder.refunds.map((refItem: any, rIdx: number) => (
                                <tr key={rIdx}>
                                  <td className="p-2 font-bold text-stone-900">{refItem.razorpay_refund_id || refItem.internal_refund_id}</td>
                                  <td className="p-2 font-bold text-stone-900">₹{Number(refItem.amount).toLocaleString('en-IN')}</td>
                                  <td className="p-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                      refItem.status === 'processed' ? 'bg-emerald-100 text-emerald-800' :
                                      refItem.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      {refItem.status}
                                    </span>
                                  </td>
                                  <td className="p-2 font-sans text-stone-600">{refItem.reason || '-'}</td>
                                  <td className="p-2 text-stone-400">
                                    {refItem.created_at ? new Date(refItem.created_at).toLocaleDateString('en-IN') : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Transactional Email Status & Manual Retry Panel */}
                  <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 space-y-3 font-sans text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-wider uppercase text-stone-500">
                        Transactional Email & Idempotency Audit
                      </span>
                      <span className="text-[10px] font-mono text-stone-400">
                        SMTP Provider Tracking
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {[
                        { event: 'processing', label: 'Processing', sent: selectedOrder.emailStatus?.processingSent, sentAt: selectedOrder.emailStatus?.processingSentAt },
                        { event: 'dispatched', label: 'Dispatched', sent: selectedOrder.emailStatus?.dispatchedSent, sentAt: selectedOrder.emailStatus?.dispatchedSentAt },
                        { event: 'delivered', label: 'Delivered', sent: selectedOrder.emailStatus?.deliveredSent, sentAt: selectedOrder.emailStatus?.deliveredSentAt },
                        { event: 'cancellation', label: 'Cancellation', sent: selectedOrder.emailStatus?.cancellationSent, sentAt: selectedOrder.emailStatus?.cancellationSentAt },
                        { event: 'refund_initiated', label: 'Refund Initiated', sent: selectedOrder.emailStatus?.refundInitiatedSent, sentAt: selectedOrder.emailStatus?.refundInitiatedSentAt },
                        { event: 'refund_completed', label: 'Refund Completed', sent: selectedOrder.emailStatus?.refundCompletedSent, sentAt: selectedOrder.emailStatus?.refundCompletedSentAt },
                      ].map((em) => (
                        <div key={em.event} className="p-2 bg-white rounded border border-stone-200 flex flex-col justify-between">
                          <div>
                            <div className="text-[10px] font-bold text-stone-700">{em.label}</div>
                            <div className="text-[9px] mt-0.5">
                              {em.sent ? (
                                <span className="text-emerald-700 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Sent
                                </span>
                              ) : (
                                <span className="text-stone-400">Not Sent</span>
                              )}
                            </div>
                            {em.sentAt && (
                              <div className="text-[9px] text-stone-400 font-mono mt-0.5">
                                {new Date(em.sentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleRetryEmail(selectedOrder.id || selectedOrder.order_id, em.event)}
                            disabled={retryingEmailStatus === em.event || em.sent === true}
                            className="mt-1.5 w-full py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 text-[9px] font-bold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw className={`w-2.5 h-2.5 ${retryingEmailStatus === em.event ? 'animate-spin' : ''}`} />
                            <span>{em.sent === true ? 'Sent' : retryingEmailStatus === em.event ? 'Sending...' : 'Retry'}</span>
                          </button>
                        </div>
                      ))}
                    </div>

                    {selectedOrder.emailStatus?.lastError && (
                      <div className="p-2 bg-red-50 border border-red-200 text-red-700 text-[10px] rounded flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Last Email Dispatch Note: {selectedOrder.emailStatus.lastError}</span>
                      </div>
                    )}
                  </div>

                  {/* Customer Information Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 border-r border-stone-100 pr-2">
                      <h4 className="font-bold text-[#2A211C] text-[10px] uppercase tracking-wider text-stone-400">Buyer Profile</h4>
                      <div className="space-y-1.5 text-stone-600 font-medium">
                        <p className="font-bold text-stone-900">{selectedOrder.customer_name}</p>
                        <p className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-stone-400" />
                          <span>{selectedOrder.customer_phone || 'No phone registered'}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-stone-400" />
                          <span>Registered Customer</span>
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-[#2A211C] text-[10px] uppercase tracking-wider text-stone-400">Delivery Address</h4>
                      <div className="space-y-1.5 text-stone-600 font-medium">
                        <p className="flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                          <span>{selectedOrder.address}, {selectedOrder.city}, {selectedOrder.state} - {selectedOrder.pincode}</span>
                        </p>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-[#C98A82] mt-1.5">
                          Method: {selectedOrder.shipping_method} • Mode: {selectedOrder.payment_method}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Items Invoice list */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-[#2A211C] text-[10px] uppercase tracking-wider text-stone-400 border-b border-stone-100 pb-1.5">Items Ordered</h4>
                    <div className="space-y-3">
                      {selectedOrder.items && Array.isArray(selectedOrder.items) ? (
                        selectedOrder.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between gap-3 border-b border-stone-50 pb-2">
                            <div className="flex items-center gap-3">
                              {item.image && (
                                <img 
                                  src={item.image} 
                                  alt={item.name} 
                                  className="w-10 h-12 object-cover rounded bg-stone-100 border border-stone-200"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <div>
                                <span className="font-bold text-stone-900 block">{item.name}</span>
                                <span className="text-[10px] text-stone-400 block font-medium">
                                  Size: <strong className="text-stone-700">{item.size}</strong> • Color: <strong className="text-stone-700">{item.color || 'Standard'}</strong>
                                </span>
                              </div>
                            </div>
                            <div className="text-right whitespace-nowrap">
                              <span className="font-bold text-stone-900">₹{Number(item.price).toLocaleString('en-IN')}</span>
                              <span className="text-stone-400 text-[10px] block font-medium">Qty: {item.quantity}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-stone-400">No items available</p>
                      )}
                    </div>
                  </div>

                  {/* Billing calculation card */}
                  <div className="border-t border-stone-100 pt-4 space-y-1.5 font-medium text-stone-600">
                    <div className="flex justify-between">
                      <span>Cart Subtotal</span>
                      <span className="text-stone-900">₹{Number(selectedOrder.subtotal).toLocaleString('en-IN')}</span>
                    </div>
                    {Number(selectedOrder.discount) > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Coupon Discount</span>
                        <span>-₹{Number(selectedOrder.discount).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Shipping Fee ({selectedOrder.shipping_method})</span>
                      <span className="text-stone-900">₹{Number(selectedOrder.shipping_cost).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-base font-serif font-bold text-[#2A211C] border-t border-stone-100 pt-3.5">
                      <span>Grand Total Amount</span>
                      <span>₹{Number(selectedOrder.grand_total).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-stone-100 bg-stone-50 text-right">
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="px-5 py-2.5 bg-stone-800 hover:bg-stone-900 text-white rounded text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
                  >
                    Close Invoice View
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* RETURN REQUEST DETAIL DRAWER / MODAL OVERLAY */}
          {selectedReturnReq && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#E5D2BC]/30 flex flex-col font-sans">
                {/* Header */}
                <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50">
                  <div>
                    <span className="text-[9px] font-bold tracking-widest uppercase text-[#B08D57] block">Return / Exchange Request</span>
                    <h3 className="font-serif text-lg font-bold text-[#2A211C]">ID: {selectedReturnReq.request_id}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedReturnReq(null)}
                    className="p-1.5 rounded-full hover:bg-stone-200 text-stone-500 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-6 text-xs text-stone-800">
                  {/* METADATA SUMMARY */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-stone-50 rounded-xl border border-stone-200">
                    <div>
                      <span className="text-[10px] uppercase text-stone-400 font-bold block">Order ID</span>
                      <span className="font-mono font-bold text-[#2A211C]">{selectedReturnReq.order_id}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-stone-400 font-bold block">Request Type</span>
                      <span className="font-bold text-[#B08D57] uppercase">{selectedReturnReq.request_type}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-stone-400 font-bold block">Date Submitted</span>
                      <span>{new Date(selectedReturnReq.created_at).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-stone-400 font-bold block">Current Status</span>
                      <span className="font-bold uppercase text-emerald-700">{selectedReturnReq.status}</span>
                    </div>
                  </div>

                  {/* CUSTOMER & REVERSE PICKUP ADDRESS */}
                  <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                    <span className="font-bold text-[#2A211C] uppercase text-[10px] tracking-wider block">Customer & Reverse Pickup Location</span>
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <div className="font-bold text-stone-900">{selectedReturnReq.customer_name}</div>
                        <div className="text-stone-500">{selectedReturnReq.customer_email} | {selectedReturnReq.customer_phone}</div>
                      </div>
                    </div>
                    {selectedReturnReq.shipping_address && (
                      <div className="text-stone-600 pt-1 border-t border-stone-200/60 mt-1">
                        {selectedReturnReq.shipping_address.address}, {selectedReturnReq.shipping_address.city}, {selectedReturnReq.shipping_address.state} - {selectedReturnReq.shipping_address.pincode}
                      </div>
                    )}
                  </div>

                  {/* REQUESTED ITEMS LIST */}
                  <div>
                    <h4 className="font-bold uppercase tracking-wider text-[10px] text-stone-500 mb-2">Requested Items</h4>
                    <div className="space-y-2">
                      {selectedReturnReq.items?.map((it: any, idx: number) => (
                        <div key={idx} className="p-3 bg-[#FAF8F5] rounded-xl border border-stone-200 space-y-1">
                          <div className="flex justify-between font-bold text-stone-900">
                            <span>{it.name}</span>
                            <span className="uppercase text-[#B08D57]">{it.action}</span>
                          </div>
                          <div className="text-stone-600">
                            Purchased Size: <strong className="font-mono">{it.original_size}</strong>
                            {it.action === 'exchange' && (
                              <> → Requested Size: <strong className="font-mono text-emerald-800">{it.requested_size}</strong></>
                            )}
                          </div>
                          <div className="text-stone-500 text-[11px]">Reason: {it.reason} {it.reason_notes && `("${it.reason_notes}")`}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* FINANCIAL OVERVIEW */}
                  <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5 text-right font-mono">
                    <div className="flex justify-between text-stone-600">
                      <span>Return Shipping Charge:</span>
                      <span className="text-rose-600 font-bold">-₹{selectedReturnReq.return_shipping_fee || 0}</span>
                    </div>
                    <div className="flex justify-between font-bold text-stone-900 text-sm border-t border-stone-200 pt-1.5">
                      <span>Estimated Total Refund:</span>
                      <span>₹{Number(selectedReturnReq.estimated_refund_total || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* STATUS MANAGEMENT ACTIONS */}
                  <div className="p-4 bg-stone-100/70 rounded-xl border border-stone-200 space-y-3">
                    <label className="font-bold uppercase tracking-wider text-[10px] text-stone-700 block">
                      Update Request Lifecycle Status
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'REQUESTED',
                        'APPROVED',
                        'PICKUP_SCHEDULED',
                        'PICKED_UP',
                        'RECEIVED',
                        'QUALITY_CHECK',
                        'REFUND_PROCESSED',
                        'EXCHANGE_SHIPPED',
                        'COMPLETED',
                        'REJECTED'
                      ].map(st => (
                        <button
                          key={st}
                          disabled={isUpdatingReturn}
                          onClick={() => handleUpdateReturnStatus(st)}
                          className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                            selectedReturnReq.status === st
                              ? 'bg-[#B08D57] text-white shadow'
                              : 'bg-white text-stone-700 border border-stone-200 hover:border-[#B08D57]'
                          }`}
                        >
                          {st.replace('_', ' ')}
                        </button>
                      ))}
                    </div>

                    <div className="pt-2">
                      <label className="text-[10px] font-bold uppercase text-stone-500 block mb-1">Internal Admin Notes</label>
                      <textarea
                        rows={2}
                        value={adminNotesInput}
                        onChange={(e) => setAdminNotesInput(e.target.value)}
                        placeholder="Add tracking numbers, courier notes, or customer communication logs..."
                        className="w-full p-2.5 rounded border border-stone-200 bg-white text-xs text-stone-800 focus:outline-none focus:border-[#B08D57]"
                      />
                    </div>
                  </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-stone-100 bg-stone-50 text-right">
                  <button
                    onClick={() => setSelectedReturnReq(null)}
                    className="px-5 py-2.5 bg-stone-800 hover:bg-stone-900 text-white rounded text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
                  >
                    Close Request View
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CUSTOMER ENQUIRIES MANAGEMENT TAB */}
          {activeTab === 'enquiries' && (
            <div className="space-y-6 pt-6">
              {/* FILTER BAR */}
              <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                  {/* Search input */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Search Ticket ID, Customer Name, Email, Phone, Order ID..."
                      value={enquiriesSearch}
                      onChange={(e) => setEnquiriesSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-200 bg-stone-50 focus:outline-none focus:border-[#B08D57]"
                    />
                  </div>

                  {/* Status filter dropdown */}
                  <div className="flex items-center gap-1.5 text-xs text-stone-600">
                    <Filter className="w-3.5 h-3.5 text-stone-400" />
                    <select
                      value={enquiriesStatusFilter}
                      onChange={(e) => setEnquiriesStatusFilter(e.target.value)}
                      className="py-2 px-3 rounded-lg border border-stone-200 bg-stone-50 font-bold text-xs text-stone-800 focus:outline-none focus:border-[#B08D57]"
                    >
                      <option value="All">All Statuses</option>
                      <option value="NEW">New Ticket</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="AWAITING_CUSTOMER">Awaiting Customer</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>

                  {/* Category filter dropdown */}
                  <div className="flex items-center gap-1.5 text-xs text-stone-600">
                    <select
                      value={enquiriesTypeFilter}
                      onChange={(e) => setEnquiriesTypeFilter(e.target.value)}
                      className="py-2 px-3 rounded-lg border border-stone-200 bg-stone-50 font-bold text-xs text-stone-800 focus:outline-none focus:border-[#B08D57]"
                    >
                      <option value="All">All Categories</option>
                      <option value="Order Related">Order Related</option>
                      <option value="Product / Sizing Advice">Product / Sizing Advice</option>
                      <option value="Return or Exchange">Return or Exchange</option>
                      <option value="Custom Tailoring">Custom Tailoring</option>
                      <option value="Wholesale / B2B">Wholesale / B2B</option>
                      <option value="General Enquiry">General Enquiry</option>
                    </select>
                  </div>
                </div>

                <div className="text-xs text-stone-500 font-bold">
                  Total Enquiries: {enquiries.length}
                </div>
              </div>

              {/* ENQUIRIES TABLE */}
              <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                        <th className="p-4">Ticket ID</th>
                        <th className="p-4">Customer Details</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Order ID</th>
                        <th className="p-4">Message Preview</th>
                        <th className="p-4">Submitted At</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-xs text-stone-700">
                      {enquiries
                        .filter(e => {
                          const query = enquiriesSearch.toLowerCase();
                          const matchesSearch = 
                            !query ||
                            (e.enquiry_id && e.enquiry_id.toLowerCase().includes(query)) ||
                            (e.customer_name && e.customer_name.toLowerCase().includes(query)) ||
                            (e.customer_email && e.customer_email.toLowerCase().includes(query)) ||
                            (e.customer_phone && e.customer_phone.toLowerCase().includes(query)) ||
                            (e.order_id && e.order_id.toLowerCase().includes(query)) ||
                            (e.message && e.message.toLowerCase().includes(query));

                          const matchesStatus = enquiriesStatusFilter === 'All' || e.status === enquiriesStatusFilter;
                          const matchesType = enquiriesTypeFilter === 'All' || e.enquiry_type === enquiriesTypeFilter;

                          return matchesSearch && matchesStatus && matchesType;
                        })
                        .map((enq) => {
                          let badgeBg = 'bg-blue-100 text-blue-800 border-blue-200';
                          if (enq.status === 'IN_PROGRESS') badgeBg = 'bg-amber-100 text-amber-800 border-amber-200';
                          if (enq.status === 'AWAITING_CUSTOMER') badgeBg = 'bg-purple-100 text-purple-800 border-purple-200';
                          if (enq.status === 'RESOLVED') badgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                          if (enq.status === 'CLOSED') badgeBg = 'bg-stone-100 text-stone-600 border-stone-200';

                          return (
                            <tr key={enq.enquiry_id || enq.id} className="hover:bg-stone-50/80 transition-colors">
                              <td className="p-4 font-mono font-bold text-stone-900 whitespace-nowrap">
                                #{enq.enquiry_id || enq.id}
                              </td>
                              <td className="p-4">
                                <div className="font-bold text-stone-900">{enq.customer_name}</div>
                                <div className="text-[11px] text-stone-500 font-mono">{enq.customer_email}</div>
                                <div className="text-[11px] text-stone-500 font-mono">{enq.customer_phone}</div>
                              </td>
                              <td className="p-4 font-medium text-stone-800">
                                {enq.enquiry_type || 'General'}
                              </td>
                              <td className="p-4 font-mono font-bold text-[#B08D57]">
                                {enq.order_id ? `#${enq.order_id}` : '—'}
                              </td>
                              <td className="p-4 max-w-xs truncate text-stone-600">
                                {enq.message}
                              </td>
                              <td className="p-4 whitespace-nowrap text-stone-500 text-[11px]">
                                {enq.created_at ? new Date(enq.created_at).toLocaleDateString('en-IN', {
                                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                }) : 'N/A'}
                              </td>
                              <td className="p-4 whitespace-nowrap">
                                <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${badgeBg}`}>
                                  {enq.status || 'NEW'}
                                </span>
                              </td>
                              <td className="p-4 text-right whitespace-nowrap">
                                <button
                                  onClick={() => {
                                    setSelectedEnquiry(enq);
                                    setEnquiryAdminNotes(enq.admin_notes || '');
                                  }}
                                  className="px-3 py-1.5 bg-[#2A211C] hover:bg-[#322c24] text-white rounded text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                >
                                  Manage Ticket
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                      {enquiries.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-stone-500 font-sans">
                            <Mail className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                            <p className="font-bold text-stone-700">No customer support enquiries recorded yet.</p>
                            <p className="text-xs text-stone-400 mt-1">
                              When shoppers fill out the Contact Support form at /contact-support, their messages will record here automatically.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ENQUIRY DETAILS & RESPONSE MODAL */}
              {selectedEnquiry && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-[#E5D2BC]/30 overflow-hidden flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="p-5 bg-stone-900 text-stone-100 flex items-center justify-between border-b border-stone-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold tracking-widest uppercase text-[#E5D2BC]">Customer Support Ticket</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-stone-800 text-amber-400 border border-stone-700 font-mono">
                            #{selectedEnquiry.enquiry_id || selectedEnquiry.id}
                          </span>
                        </div>
                        <h3 className="font-serif text-lg font-bold text-white mt-1">
                          {selectedEnquiry.customer_name} ({selectedEnquiry.enquiry_type || 'General Enquiry'})
                        </h3>
                      </div>
                      <button
                        onClick={() => setSelectedEnquiry(null)}
                        className="p-1 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto space-y-6 text-xs text-stone-700">
                      {/* Customer Info Card */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-stone-50 border border-stone-200">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-stone-400 block">Customer Name</span>
                          <p className="font-bold text-stone-900 text-sm mt-0.5">{selectedEnquiry.customer_name}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-stone-400 block">Email Address</span>
                          <a href={`mailto:${selectedEnquiry.customer_email}`} className="font-mono text-stone-900 hover:text-[#B08D57] underline mt-0.5 block">
                            {selectedEnquiry.customer_email}
                          </a>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-stone-400 block">Mobile Number</span>
                          <a href={`tel:${selectedEnquiry.customer_phone}`} className="font-mono text-stone-900 hover:text-[#B08D57] underline mt-0.5 block">
                            {selectedEnquiry.customer_phone}
                          </a>
                        </div>
                        {selectedEnquiry.order_id && (
                          <div className="col-span-full pt-2 border-t border-stone-200/60 flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase text-stone-500">Related Order Reference:</span>
                            <span className="font-mono font-bold text-[#B08D57] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              #{selectedEnquiry.order_id}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Message Body */}
                      <div>
                        <span className="text-[10px] font-bold uppercase text-stone-500 block mb-1.5">Customer Message</span>
                        <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 text-stone-800 leading-relaxed font-sans text-xs whitespace-pre-wrap">
                          {selectedEnquiry.message}
                        </div>
                      </div>

                      {/* Update Status & Admin Notes */}
                      <div className="space-y-4 pt-4 border-t border-stone-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold uppercase text-stone-500 block mb-1">Ticket Status</label>
                            <select
                              value={selectedEnquiry.status || 'NEW'}
                              onChange={(e) => {
                                const newStatus = e.target.value;
                                handleUpdateEnquiryStatus(selectedEnquiry.enquiry_id || selectedEnquiry.id, newStatus);
                              }}
                              disabled={isUpdatingEnquiry}
                              className="w-full p-2.5 rounded border border-stone-300 font-bold text-xs text-stone-900 bg-white focus:outline-none focus:border-[#B08D57]"
                            >
                              <option value="NEW">NEW - Unassigned</option>
                              <option value="IN_PROGRESS">IN_PROGRESS - Concierge Reviewing</option>
                              <option value="AWAITING_CUSTOMER">AWAITING_CUSTOMER - Reply Sent</option>
                              <option value="RESOLVED">RESOLVED - Solved</option>
                              <option value="CLOSED">CLOSED - Closed</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase text-stone-500 block mb-1">Direct Email Action</label>
                            <a
                              href={`mailto:${selectedEnquiry.customer_email}?subject=${encodeURIComponent(`[Sa and Sha] Re: Ticket #${selectedEnquiry.enquiry_id || selectedEnquiry.id} - ${selectedEnquiry.enquiry_type || 'Support Enquiry'}`)}`}
                              className="w-full py-2.5 px-4 bg-[#B08D57] hover:bg-[#a04e2e] text-white font-bold rounded text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Mail className="w-4 h-4" />
                              <span>Reply via Email Client</span>
                            </a>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase text-stone-500 block mb-1">Internal Admin Notes & Log</label>
                          <textarea
                            rows={3}
                            value={enquiryAdminNotes}
                            onChange={(e) => setEnquiryAdminNotes(e.target.value)}
                            placeholder="Add concierge notes, resolution details, or phone call summaries..."
                            className="w-full p-2.5 rounded border border-stone-300 bg-white text-xs text-stone-800 focus:outline-none focus:border-[#B08D57]"
                          />
                        </div>

                        <div className="flex justify-end">
                          <button
                            onClick={() => handleUpdateEnquiryStatus(selectedEnquiry.enquiry_id || selectedEnquiry.id, selectedEnquiry.status || 'NEW')}
                            disabled={isUpdatingEnquiry}
                            className="px-5 py-2 bg-[#2A211C] hover:bg-[#322c24] text-white rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            {isUpdatingEnquiry ? 'Saving...' : 'Save Notes & Status'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-stone-100 bg-stone-50 text-right">
                      <button
                        onClick={() => setSelectedEnquiry(null)}
                        className="px-5 py-2.5 bg-stone-800 hover:bg-stone-900 text-white rounded text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
                      >
                        Close Ticket View
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PROMOTIONS MANAGEMENT VIEW */}
          {activeTab === 'promotions' && (
            <div className="space-y-6 animate-fade-in" id="admin-promotions-view">
              {/* Header & Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#E5D2BC]/20 shadow-sm">
                <div>
                  <h2 className="font-serif text-lg font-bold text-[#2A211C]">Promo Code Directory</h2>
                  <p className="text-xs text-stone-500 font-sans">
                    Create, manage, and monitor server-authoritative discount promo codes.
                  </p>
                </div>
                <button
                  onClick={() => handleOpenPromoModal()}
                  className="px-4 py-2.5 bg-[#B08D57] hover:bg-[#a04e2e] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
                  id="admin-create-promo-btn"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Promo Code</span>
                </button>
              </div>

              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    value={promotionsSearch}
                    onChange={(e) => setPromotionsSearch(e.target.value)}
                    placeholder="Search promo code..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-stone-200 bg-white text-xs text-stone-900 focus:outline-none focus:border-[#B08D57]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-stone-400 shrink-0" />
                  <select
                    value={promotionsStatusFilter}
                    onChange={(e) => setPromotionsStatusFilter(e.target.value)}
                    className="px-3 py-2.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-800 focus:outline-none focus:border-[#B08D57]"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Active">Active Only</option>
                    <option value="Inactive">Inactive Only</option>
                    <option value="Expired">Expired Only</option>
                  </select>
                </div>
              </div>

              {/* Promotions Table */}
              <div className="bg-white rounded-xl border border-[#E5D2BC]/20 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 text-[10px] font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-4">Promo Code</th>
                        <th className="p-4">Discount</th>
                        <th className="p-4">Min. Order</th>
                        <th className="p-4">Usage Count</th>
                        <th className="p-4">Validity Period</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-stone-700">
                      {promotions
                        .filter(p => {
                          if (promotionsSearch.trim()) {
                            const q = promotionsSearch.trim().toLowerCase();
                            if (!p.code.toLowerCase().includes(q)) return false;
                          }
                          const now = new Date();
                          const isExpired = p.expires_at ? new Date(p.expires_at) < now : false;
                          if (promotionsStatusFilter === 'Active') {
                            return p.is_active && !isExpired;
                          } else if (promotionsStatusFilter === 'Inactive') {
                            return !p.is_active;
                          } else if (promotionsStatusFilter === 'Expired') {
                            return isExpired;
                          }
                          return true;
                        })
                        .map((promo) => {
                          const now = new Date();
                          const isExpired = promo.expires_at ? new Date(promo.expires_at) < now : false;

                          let statusBadge = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                          let statusText = 'Active';

                          if (!promo.is_active) {
                            statusBadge = 'bg-stone-100 text-stone-600 border-stone-200';
                            statusText = 'Inactive';
                          } else if (isExpired) {
                            statusBadge = 'bg-rose-50 text-rose-800 border-rose-200';
                            statusText = 'Expired';
                          }

                          return (
                            <tr key={promo.id} className="hover:bg-stone-50/80 transition-colors">
                              <td className="p-4 whitespace-nowrap">
                                <div className="font-mono font-bold text-sm text-[#2A211C] flex items-center gap-2">
                                  <Tag className="w-3.5 h-3.5 text-[#B08D57]" />
                                  <span>{promo.code}</span>
                                </div>
                              </td>
                              <td className="p-4 whitespace-nowrap font-semibold text-stone-900">
                                {promo.discount_type === 'percentage' ? (
                                  <span>{promo.discount_value}% OFF {promo.maximum_discount_amount ? <span className="text-[10px] text-stone-500 font-normal">(Max ₹{promo.maximum_discount_amount.toLocaleString('en-IN')})</span> : ''}</span>
                                ) : (
                                  <span>₹{promo.discount_value.toLocaleString('en-IN')} OFF</span>
                                )}
                              </td>
                              <td className="p-4 whitespace-nowrap font-medium text-stone-800">
                                {promo.minimum_order_amount > 0 ? `₹${promo.minimum_order_amount.toLocaleString('en-IN')}` : 'No Minimum'}
                              </td>
                              <td className="p-4 whitespace-nowrap font-mono text-stone-800">
                                <span className="font-bold">{promo.usage_count || 0}</span>
                                <span className="text-stone-400"> / {promo.usage_limit ? promo.usage_limit : '∞'}</span>
                                {promo.per_customer_limit ? (
                                  <span className="block text-[10px] text-stone-500 font-sans">Max {promo.per_customer_limit}/customer</span>
                                ) : null}
                              </td>
                              <td className="p-4 whitespace-nowrap text-stone-600 text-[11px]">
                                {promo.expires_at ? (
                                  <span>Expires {new Date(promo.expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                ) : (
                                  <span className="text-emerald-700 font-medium">No Expiration</span>
                                )}
                              </td>
                              <td className="p-4 whitespace-nowrap">
                                <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${statusBadge}`}>
                                  {statusText}
                                </span>
                              </td>
                              <td className="p-4 text-right whitespace-nowrap space-x-2">
                                <button
                                  onClick={() => handleTogglePromoStatus(promo)}
                                  className="px-2.5 py-1 rounded border border-stone-200 text-stone-700 hover:bg-stone-100 text-[11px] font-bold uppercase transition-colors cursor-pointer"
                                >
                                  {promo.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                  onClick={() => handleOpenPromoModal(promo)}
                                  className="p-1.5 rounded border border-stone-200 text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer inline-flex items-center"
                                  title="Edit Promo"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeletePromotion(promo.id, promo.code)}
                                  className="p-1.5 rounded border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer inline-flex items-center"
                                  title="Delete Promo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                      {promotions.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-stone-500 font-sans">
                            <Tag className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                            <p className="font-bold text-stone-700">No promo codes found in Firestore.</p>
                            <p className="text-xs text-stone-400 mt-1">
                              Click "Create Promo Code" to add server-validated checkout discounts.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PROMO CODE EDIT/CREATE MODAL */}
              {isPromoModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-[#E5D2BC]/30 overflow-hidden flex flex-col max-h-[90vh]">
                    {/* Modal Header */}
                    <div className="p-5 bg-stone-900 text-stone-100 flex items-center justify-between border-b border-stone-800">
                      <div className="flex items-center gap-2">
                        <Tag className="w-5 h-5 text-[#E5D2BC]" />
                        <h3 className="font-serif text-lg font-bold text-white">
                          {selectedPromo ? `Edit Promo Code "${selectedPromo.code}"` : 'Create New Promo Code'}
                        </h3>
                      </div>
                      <button
                        onClick={() => setIsPromoModalOpen(false)}
                        className="p-1 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6 overflow-y-auto space-y-4 text-xs text-stone-800 font-sans">
                      {promoModalError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold">
                          {promoModalError}
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-stone-600 block">Promo Code Name *</label>
                        <input
                          type="text"
                          required
                          value={promoForm.code || ''}
                          onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                          placeholder="e.g. SUMMER25"
                          className="w-full px-3 py-2.5 border border-stone-300 rounded font-mono font-bold text-sm text-stone-900 bg-stone-50 focus:outline-none focus:border-[#B08D57]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-stone-600 block">Discount Type *</label>
                          <select
                            value={promoForm.discount_type || 'percentage'}
                            onChange={(e) => setPromoForm({ ...promoForm, discount_type: e.target.value as any })}
                            className="w-full px-3 py-2.5 border border-stone-300 rounded font-semibold text-xs text-stone-900 bg-white focus:outline-none focus:border-[#B08D57]"
                          >
                            <option value="percentage">Percentage (%)</option>
                            <option value="fixed_amount">Fixed Amount (₹)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-stone-600 block">
                            Discount Value ({promoForm.discount_type === 'percentage' ? '%' : '₹'}) *
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="any"
                            required
                            value={promoForm.discount_value ?? ''}
                            onChange={(e) => setPromoForm({ ...promoForm, discount_value: parseFloat(e.target.value) || 0 })}
                            placeholder={promoForm.discount_type === 'percentage' ? 'e.g. 15' : 'e.g. 500'}
                            className="w-full px-3 py-2.5 border border-stone-300 rounded font-mono font-bold text-xs text-stone-900 bg-stone-50 focus:outline-none focus:border-[#B08D57]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-stone-600 block">Minimum Order Amount (₹)</label>
                          <input
                            type="number"
                            min="0"
                            value={promoForm.minimum_order_amount ?? ''}
                            onChange={(e) => setPromoForm({ ...promoForm, minimum_order_amount: parseFloat(e.target.value) || 0 })}
                            placeholder="0 for no minimum"
                            className="w-full px-3 py-2.5 border border-stone-300 rounded font-mono text-xs text-stone-900 bg-stone-50 focus:outline-none focus:border-[#B08D57]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-stone-600 block">Max Discount Cap (₹)</label>
                          <input
                            type="number"
                            min="0"
                            value={promoForm.maximum_discount_amount ?? ''}
                            onChange={(e) => setPromoForm({ ...promoForm, maximum_discount_amount: e.target.value ? parseFloat(e.target.value) : null })}
                            placeholder="Optional cap for % discounts"
                            className="w-full px-3 py-2.5 border border-stone-300 rounded font-mono text-xs text-stone-900 bg-stone-50 focus:outline-none focus:border-[#B08D57]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-stone-600 block">Global Usage Limit</label>
                          <input
                            type="number"
                            min="1"
                            value={promoForm.usage_limit ?? ''}
                            onChange={(e) => setPromoForm({ ...promoForm, usage_limit: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="Unlimited if blank"
                            className="w-full px-3 py-2.5 border border-stone-300 rounded font-mono text-xs text-stone-900 bg-stone-50 focus:outline-none focus:border-[#B08D57]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-stone-600 block">Per Customer Limit</label>
                          <input
                            type="number"
                            min="1"
                            value={promoForm.per_customer_limit ?? ''}
                            onChange={(e) => setPromoForm({ ...promoForm, per_customer_limit: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="Unlimited if blank"
                            className="w-full px-3 py-2.5 border border-stone-300 rounded font-mono text-xs text-stone-900 bg-stone-50 focus:outline-none focus:border-[#B08D57]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-stone-600 block">Start Date</label>
                          <input
                            type="date"
                            value={promoForm.starts_at || ''}
                            onChange={(e) => setPromoForm({ ...promoForm, starts_at: e.target.value })}
                            className="w-full px-3 py-2 border border-stone-300 rounded text-xs text-stone-900 bg-stone-50 focus:outline-none focus:border-[#B08D57]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-stone-600 block">Expiration Date</label>
                          <input
                            type="date"
                            value={promoForm.expires_at || ''}
                            onChange={(e) => setPromoForm({ ...promoForm, expires_at: e.target.value })}
                            className="w-full px-3 py-2 border border-stone-300 rounded text-xs text-stone-900 bg-stone-50 focus:outline-none focus:border-[#B08D57]"
                          />
                        </div>
                      </div>

                      <div className="pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={promoForm.is_active ?? true}
                            onChange={(e) => setPromoForm({ ...promoForm, is_active: e.target.checked })}
                            className="w-4 h-4 text-[#B08D57] rounded border-stone-300 focus:ring-[#B08D57]"
                          />
                          <span className="text-xs font-semibold text-stone-800">
                            Promo code is active for customer checkout
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-3">
                      <button
                        onClick={() => setIsPromoModalOpen(false)}
                        className="px-4 py-2 border border-stone-300 text-stone-700 hover:bg-stone-100 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSavePromotion}
                        disabled={isSavingPromo}
                        className="px-5 py-2 bg-[#B08D57] hover:bg-[#a04e2e] text-white rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2"
                      >
                        {isSavingPromo ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <span>{selectedPromo ? 'Update Promo Code' : 'Save Promo Code'}</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CUSTOMERS DATABASE VIEW */}
          {activeTab === 'customers' && (
            <AdminCustomersTab adminToken={adminToken} />
          )}

          {/* COMMUNICATION CENTRE VIEW */}
          {activeTab === 'communications' && (
            <AdminCommunicationTab adminToken={adminToken} />
          )}

          {/* FORGOT PASSWORD MODAL */}
          {showForgotModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-[#E5D2BC]/30 relative">
                <button
                  onClick={() => setShowForgotModal(false)}
                  className="absolute right-4 top-4 p-1 rounded-full hover:bg-stone-100 text-stone-500 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="text-center space-y-3">
                  <div className="p-3 bg-stone-100 inline-block rounded-full text-[#B08D57] mb-1">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-stone-900">Forgot Password Recovery</h3>
                  <p className="font-sans text-xs text-stone-500 leading-normal">
                    Enter the authorized admin email address below to dispatch a secure, self-signed reset passcode link.
                  </p>
                </div>

                {forgotStatus === 'success' ? (
                  <div className="mt-6 p-4 bg-[#C98A82]/10 border border-[#C98A82]/20 text-[#2A211C] rounded-lg text-xs font-sans space-y-2 text-center">
                    <p className="font-bold text-[#C98A82] uppercase text-[10px]">Secure Email Sent!</p>
                    <p className="leading-relaxed">
                      A personalized recovery verification link has been dispatched to <strong className="underline text-stone-900 font-bold">{forgotEmail}</strong>.
                    </p>
                    <button
                      onClick={() => setShowForgotModal(false)}
                      className="mt-2 w-full py-1.5 bg-[#C98A82] hover:bg-[#C98A82]/90 text-white font-bold rounded uppercase text-[10px] tracking-wider"
                    >
                      Return to login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="mt-6 space-y-4 font-sans text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold tracking-wider text-stone-500 uppercase">
                        Admin Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="Enter administrative email"
                        className="w-full px-3 py-2.5 rounded border border-stone-200 focus:outline-none focus:border-[#B08D57] bg-stone-50"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={forgotStatus === 'sending'}
                      className="w-full bg-[#2A211C] hover:bg-[#322c24] text-[#FBF6EE] font-bold uppercase tracking-widest py-3 rounded transition-colors cursor-pointer"
                    >
                      {forgotStatus === 'sending' ? 'Sending Recovery Mail...' : 'Send Recovery Link'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* STATUS CHANGE & DISPATCH FORM MODAL */}
          {statusUpdateModal?.isOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[#E5D2BC]/30 relative font-sans space-y-5">
                <button
                  onClick={() => setStatusUpdateModal(null)}
                  className="absolute right-4 top-4 p-1 rounded-full hover:bg-stone-100 text-stone-500 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#B08D57] block">
                    Authoritative Order Transition
                  </span>
                  <h3 className="font-serif text-lg font-bold text-stone-900">
                    Update Order #{statusUpdateModal.order.order_id} → <span className="uppercase text-[#B08D57]">{statusUpdateModal.targetStatus.replace('_', ' ')}</span>
                  </h3>
                  <p className="text-xs text-stone-500 flex items-center gap-1.5 mt-1">
                    <span>Current Status:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getOrderStatusBadgeClass(statusUpdateModal.order.status)}`}>
                      {(statusUpdateModal.order.status || 'placed').replace('_', ' ')}
                    </span>
                  </p>
                </div>

                {statusUpdateModal.targetStatus === 'dispatched' ? (
                  /* DISPATCH FORM */
                  <div className="space-y-3.5 text-xs">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] flex items-start gap-2">
                      <Truck className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
                      <span>
                        Dispatching an order records courier tracking parameters and automatically dispatches a shipping notification email to <strong>{statusUpdateModal.order.customer_email}</strong>.
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-stone-600 block">Courier Name *</label>
                      <input
                        type="text"
                        required
                        value={dispatchForm.courier_name}
                        onChange={(e) => setDispatchForm({ ...dispatchForm, courier_name: e.target.value })}
                        placeholder="e.g. Delhivery, DTDC, India Post"
                        className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 text-stone-900 font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-stone-600 block">Tracking Number / AWB *</label>
                        <input
                          type="text"
                          required
                          value={dispatchForm.tracking_number}
                          onChange={(e) => setDispatchForm({ ...dispatchForm, tracking_number: e.target.value })}
                          placeholder="e.g. 1234567890"
                          className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 text-stone-900 font-mono font-medium"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-stone-600 block">Dispatch Date *</label>
                        <input
                          type="date"
                          required
                          value={dispatchForm.dispatch_date}
                          onChange={(e) => setDispatchForm({ ...dispatchForm, dispatch_date: e.target.value })}
                          className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 text-stone-900 font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-stone-600 block">Live Tracking URL *</label>
                      <input
                        type="url"
                        required
                        value={dispatchForm.tracking_url}
                        onChange={(e) => setDispatchForm({ ...dispatchForm, tracking_url: e.target.value })}
                        placeholder="https://courier.com/track?awb=..."
                        className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 text-stone-900 font-mono text-[11px]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-stone-600 block">Estimated Delivery Date *</label>
                      <input
                        type="date"
                        required
                        value={dispatchForm.estimated_delivery_date}
                        onChange={(e) => setDispatchForm({ ...dispatchForm, estimated_delivery_date: e.target.value })}
                        className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 text-stone-900 font-medium"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-stone-600 block">Dispatch Admin Notes (Optional)</label>
                      <textarea
                        rows={2}
                        value={dispatchForm.adminNotes}
                        onChange={(e) => setDispatchForm({ ...dispatchForm, adminNotes: e.target.value })}
                        placeholder="Optional internal dispatch notes..."
                        className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 text-stone-900"
                      />
                    </div>
                  </div>
                ) : statusUpdateModal.targetStatus === 'refund_initiated' ? (
                  /* REFUND INITIATED FORM */
                  <div className="space-y-3.5 text-xs">
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs space-y-1">
                      <p className="font-bold flex items-center gap-1.5 text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" /> Important Refund Notice
                      </p>
                      <p className="text-amber-800 leading-relaxed">
                        Changing this status does not issue a refund. Process the refund in Razorpay/payment provider first.
                      </p>
                    </div>

                    <label className="flex items-start gap-2.5 p-3 bg-stone-50 border border-stone-200 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={refundProviderConfirmed}
                        onChange={(e) => setRefundProviderConfirmed(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-[#B08D57] rounded border-stone-300 focus:ring-[#B08D57] cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-stone-800 leading-snug">
                        I have initiated this refund through Razorpay/payment provider.
                      </span>
                    </label>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-stone-600 block">Refund Amount (₹) *</label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        required
                        value={refundAmountInput}
                        onChange={(e) => setRefundAmountInput(e.target.value)}
                        placeholder="e.g. 2999"
                        className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 font-mono text-stone-900 font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-stone-600 block">Refund Note / Reason (Optional)</label>
                      <textarea
                        rows={2}
                        value={refundNoteInput}
                        onChange={(e) => setRefundNoteInput(e.target.value)}
                        placeholder="Internal notes or customer explanation for refund initiation..."
                        className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 text-stone-900"
                      />
                    </div>
                  </div>
                ) : statusUpdateModal.targetStatus === 'refund_completed' ? (
                  /* REFUND COMPLETED FORM */
                  <div className="space-y-3.5 text-xs">
                    <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs space-y-1">
                      <p className="font-bold text-blue-900">Authoritative Refund Proof Required</p>
                      <p className="text-blue-800 leading-relaxed">
                        To mark this order as refund completed, you must provide the verified payment provider refund reference / transaction ID.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-stone-600 block">Refund Reference / Transaction ID *</label>
                      <input
                        type="text"
                        required
                        value={refundReferenceInput}
                        onChange={(e) => setRefundReferenceInput(e.target.value)}
                        placeholder="e.g. rfnd_P18273645920 or Razorpay Refund ID"
                        className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 font-mono text-stone-900 font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-stone-600 block">Refund Amount (₹) *</label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        required
                        value={refundAmountInput}
                        onChange={(e) => setRefundAmountInput(e.target.value)}
                        placeholder="e.g. 2999"
                        className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 font-mono text-stone-900 font-bold"
                      />
                    </div>
                  </div>
                ) : (
                  /* STANDARD CONFIRMATION FORM */
                  <div className="space-y-3.5 text-xs">
                    <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-700 space-y-1">
                      <p className="font-bold text-stone-900">Automatic Customer Notification</p>
                      <p className="text-stone-500 leading-relaxed">
                        Updating status to <strong className="uppercase text-[#B08D57]">{statusUpdateModal.targetStatus.replace('_', ' ')}</strong> will execute backend validation and trigger a transactional email to <strong>{statusUpdateModal.order.customer_email}</strong> via SMTP.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-stone-600 block">Internal Admin Notes / Audit Reason (Optional)</label>
                      <textarea
                        rows={2}
                        value={statusNotesInput}
                        onChange={(e) => setStatusNotesInput(e.target.value)}
                        placeholder="Reason for status change or internal notes..."
                        className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 text-stone-900"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setStatusUpdateModal(null)}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs uppercase tracking-wider rounded transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteStatusUpdate}
                    disabled={isSubmittingStatus}
                    className="px-5 py-2 bg-[#2A211C] hover:bg-[#322c24] text-white font-bold text-xs uppercase tracking-wider rounded transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSubmittingStatus && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSubmittingStatus ? 'Updating Status...' : 'Confirm Status Update'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* REAL RAZORPAY REFUND MODAL */}
          {razorpayRefundModal?.isOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E5D2BC]/30 relative font-sans space-y-5">
                <button
                  onClick={() => setRazorpayRefundModal(null)}
                  className="absolute right-4 top-4 p-1 rounded-full hover:bg-stone-100 text-stone-500 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#B08D57] block">
                    Razorpay Automated Refund Engine
                  </span>
                  <h3 className="font-serif text-lg font-bold text-stone-900">
                    Initiate Refund — #{razorpayRefundModal.order.order_id}
                  </h3>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-2">
                  <div className="flex justify-between text-stone-700">
                    <span>Payment Method:</span>
                    <strong className="font-mono text-stone-900 uppercase">{razorpayRefundModal.order.payment_method || 'Prepaid Razorpay'}</strong>
                  </div>
                  <div className="flex justify-between text-stone-700">
                    <span>Payment ID:</span>
                    <strong className="font-mono text-stone-900">{razorpayRefundModal.order.payment_id || razorpayRefundModal.order.razorpay_payment_id || 'N/A'}</strong>
                  </div>
                  <div className="flex justify-between text-stone-700">
                    <span>Original Captured Amount:</span>
                    <strong className="font-mono text-stone-900">₹{Number(razorpayRefundModal.order.grand_total || 0).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="flex justify-between text-stone-700">
                    <span>Previously Refunded:</span>
                    <strong className="font-mono text-stone-900">
                      ₹{(
                        (razorpayRefundModal.order.refunds || [])
                          .filter((r: any) => r.status !== 'failed')
                          .reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0)
                      ).toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div className="flex justify-between text-amber-900 border-t border-amber-200/60 pt-1.5 font-bold">
                    <span>Maximum Refundable Balance:</span>
                    <span className="font-mono text-base text-[#B08D57]">
                      ₹{Math.max(
                        0,
                        (Number(razorpayRefundModal.order.grand_total) || 0) -
                        ((razorpayRefundModal.order.refunds || [])
                          .filter((r: any) => r.status !== 'failed')
                          .reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0))
                      ).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-stone-600 block">Refund Amount (₹) *</label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      required
                      value={razorpayRefundModal.amountInput}
                      onChange={(e) => setRazorpayRefundModal({ ...razorpayRefundModal, amountInput: e.target.value })}
                      placeholder="e.g. 2999"
                      className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 font-mono text-stone-900 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-stone-600 block">Refund Reason / Admin Note *</label>
                    <textarea
                      rows={2}
                      value={razorpayRefundModal.reasonInput}
                      onChange={(e) => setRazorpayRefundModal({ ...razorpayRefundModal, reasonInput: e.target.value })}
                      placeholder="e.g. Customer cancellation, quality dispute, item out of stock..."
                      className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-stone-50 text-stone-900"
                    />
                  </div>

                  <label className="flex items-start gap-2.5 p-3 bg-red-50/60 border border-red-200/80 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={razorpayRefundModal.confirmed}
                      onChange={(e) => setRazorpayRefundModal({ ...razorpayRefundModal, confirmed: e.target.checked })}
                      className="mt-0.5 w-4 h-4 text-[#B08D57] rounded border-stone-300 focus:ring-[#B08D57] cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-red-900 leading-snug">
                      I understand this will initiate a real refund through Razorpay.
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setRazorpayRefundModal(null)}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs uppercase tracking-wider rounded transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteRazorpayRefund}
                    disabled={
                      razorpayRefundModal.isSubmitting ||
                      !razorpayRefundModal.confirmed ||
                      !razorpayRefundModal.amountInput ||
                      Number(razorpayRefundModal.amountInput) <= 0 ||
                      Number(razorpayRefundModal.amountInput) >
                        Math.max(
                          0,
                          (Number(razorpayRefundModal.order.grand_total) || 0) -
                          ((razorpayRefundModal.order.refunds || [])
                            .filter((r: any) => r.status !== 'failed')
                            .reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0))
                        ) + 0.01
                    }
                    className="px-5 py-2 bg-[#B08D57] hover:bg-[#a04e2e] text-white font-bold text-xs uppercase tracking-wider rounded transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {razorpayRefundModal.isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{razorpayRefundModal.isSubmitting ? 'Executing Refund...' : 'Execute Razorpay Refund'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
