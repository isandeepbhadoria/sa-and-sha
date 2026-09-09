import React, { useState, useEffect } from 'react';
import {
  Building2,
  FileSpreadsheet,
  Truck,
  Hash,
  History,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Upload,
  Plus,
  RefreshCw,
  Search,
  FileText,
  Save,
  Download,
  Calendar,
  Info
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { TaxPrecedenceBanner } from './tax-master/TaxPrecedenceBanner';
import { TaxCoverageCard } from './tax-master/TaxCoverageCard';
import { AddTaxRuleModal } from './tax-master/AddTaxRuleModal';
import { CsvBulkImportModal } from './tax-master/CsvBulkImportModal';
import { TaxRulesTable } from './tax-master/TaxRulesTable';
import {
  ProductTaxRecord,
  TaxCoverageSummary,
  TaxRuleScope
} from './tax-master/types';

interface TaxMasterAdminTabProps {
  adminToken?: string;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface SellerConfig {
  legal_name: string;
  trade_name: string;
  gstin: string;
  pan: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  state_code: string;
  pincode: string;
  country: string;
  support_email: string;
  support_phone: string;
  invoice_prefix: string;
  status: 'DRAFT' | 'ACTIVE';
  is_active: boolean;
}

interface ShippingTaxConfig {
  enabled: boolean;
  hsn_or_sac_code: string;
  gst_rate: number;
  tax_category: string;
  effective_from: string;
  status: 'DRAFT' | 'ACTIVE';
}

interface InvoiceNumberingConfig {
  prefix: string;
  separator: string;
  sequence_padding: number;
  reset_policy: string;
  status: 'DRAFT' | 'ACTIVE';
}

interface AuditLog {
  audit_id: string;
  created_at: string;
  admin_id: string;
  email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  reason?: string;
  before_summary?: any;
  after_summary?: any;
}

interface ReadinessData {
  overall_status: 'READY' | 'NOT_READY';
  summary: {
    seller_gst: { ready: boolean; legal_name: string | null; gstin: string | null; error: string | null };
    shipping_tax: { ready: boolean; hsn_or_sac_code: string; gst_rate: number; error: string | null };
    invoice_numbering: { ready: boolean; prefix: string; status: string };
    product_coverage: { total_active_skus: number; configured_skus: number; missing_skus: number; coverage_percentage: number };
  };
  coverage_details: Array<{ sku: string; product_id: string; name: string; hsn_code?: string; gst_rate?: number; status: string }>;
}

export const TaxMasterAdminTab: React.FC<TaxMasterAdminTabProps> = ({ adminToken, showToast }) => {
  const [activeSubTab, setActiveSubTab] = useState<'seller' | 'products' | 'shipping' | 'numbering' | 'audit'>('products');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Readiness & Coverage
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [coverageData, setCoverageData] = useState<TaxCoverageSummary | null>(null);

  // Seller State
  const [seller, setSeller] = useState<SellerConfig>({
    legal_name: '',
    trade_name: 'Sa and Sha',
    gstin: '',
    pan: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: 'Maharashtra',
    state_code: '27',
    pincode: '',
    country: 'India',
    support_email: 'shop@sa-and-sha.com',
    support_phone: '+91 98765 43210',
    invoice_prefix: 'SS',
    status: 'DRAFT',
    is_active: true
  });
  const [sellerValidation, setSellerValidation] = useState<{ valid: boolean; error?: string; missing_fields?: string[] } | null>(null);

  // Product Tax Master State
  const [products, setProducts] = useState<ProductTaxRecord[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [prefillScope, setPrefillScope] = useState<TaxRuleScope>('CATEGORY');
  const [prefillCategory, setPrefillCategory] = useState<string>('');
  const [prefillProductId, setPrefillProductId] = useState<string>('');
  const [prefillSku, setPrefillSku] = useState<string>('');

  // Shipping Tax State
  const [shipping, setShipping] = useState<ShippingTaxConfig>({
    enabled: true,
    hsn_or_sac_code: '996812',
    gst_rate: 18,
    tax_category: 'COURIER_SERVICES',
    effective_from: new Date().toISOString().split('T')[0],
    status: 'ACTIVE'
  });

  // Invoice Numbering State
  const [numbering, setNumbering] = useState<InvoiceNumberingConfig>({
    prefix: 'SS',
    separator: '/',
    sequence_padding: 6,
    reset_policy: 'ANNUAL_FY',
    status: 'ACTIVE'
  });

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Token retrieval helper
  const getAdminAuthToken = async (forceRefresh = false): Promise<string | null> => {
    if (auth?.currentUser) {
      try {
        const idToken = await auth.currentUser.getIdToken(forceRefresh);
        if (idToken) return idToken;
      } catch (err) {
        console.warn('[GST MASTER AUTH] Unable to retrieve Firebase Auth ID token:', err);
      }
    }

    if (adminToken) return adminToken;

    const storedToken = localStorage.getItem('admin_auth_token') || localStorage.getItem('kora_admin_token');
    if (storedToken) return storedToken;

    return null;
  };

  // Authenticated fetch wrapper with single 401 token refresh retry
  const authenticatedFetch = async (
    url: string,
    options: RequestInit = {},
    allowRetry = true
  ): Promise<{ ok: boolean; status: number; data: any; errorCategory?: string }> => {
    let token = await getAdminAuthToken(false);

    if (!token) {
      return {
        ok: false,
        status: 401,
        data: { success: false, error: 'Missing or invalid Firebase Auth admin session token.' },
        errorCategory: 'ADMIN_SESSION_MISSING'
      };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
      'Authorization': `Bearer ${token}`,
      'x-admin-token': token
    };

    try {
      let res = await fetch(url, { ...options, headers });

      if (res.status === 401 && allowRetry) {
        console.warn('[GST MASTER AUTH] Received 401 response. Force refreshing Firebase ID token and retrying...');
        const refreshedToken = await getAdminAuthToken(true);
        if (refreshedToken) {
          headers['Authorization'] = `Bearer ${refreshedToken}`;
          headers['x-admin-token'] = refreshedToken;
          res = await fetch(url, { ...options, headers });
        }
      }

      let data: any = {};
      try {
        data = await res.json();
      } catch (e) {
        data = {};
      }

      if (!res.ok || (data && data.success === false)) {
        let category = 'GST_CONFIG_ERROR';
        if (res.status === 401) {
          const errText = data?.error || '';
          if (errText.includes('Unauthorized email')) {
            category = 'ADMIN_UNAUTHORIZED';
          } else {
            category = 'ADMIN_SESSION_EXPIRED';
          }
        }
        return { ok: false, status: res.status, data, errorCategory: category };
      }

      return { ok: true, status: res.status, data };
    } catch (err: any) {
      console.error('[GST MASTER FETCH NETWORK ERROR]', err);
      return {
        ok: false,
        status: 500,
        data: { success: false, error: 'Network error communicating with GST Master server.' },
        errorCategory: 'NETWORK_ERROR'
      };
    }
  };

  useEffect(() => {
    loadAllTaxData();
  }, [adminToken]);

  const loadAllTaxData = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [readinessRes, coverageRes, sellerRes, productsRes, shippingRes, numberingRes, auditRes] = await Promise.all([
        authenticatedFetch('/api/admin/tax-master/readiness'),
        authenticatedFetch('/api/admin/tax-master/coverage'),
        authenticatedFetch('/api/admin/tax-master/seller'),
        authenticatedFetch('/api/admin/tax-master/products'),
        authenticatedFetch('/api/admin/tax-master/shipping'),
        authenticatedFetch('/api/admin/tax-master/invoice-numbering'),
        authenticatedFetch('/api/admin/tax-master/audit')
      ]);

      let hasAuthError = false;
      let authErrorMessage = '';

      if (readinessRes.ok && readinessRes.data) setReadiness(readinessRes.data);
      if (coverageRes.ok && coverageRes.data?.coverage) setCoverageData(coverageRes.data.coverage);

      if (sellerRes.ok && sellerRes.data) {
        if (sellerRes.data.config) setSeller(sellerRes.data.config);
        if (sellerRes.data.validation) setSellerValidation(sellerRes.data.validation);
      } else if (sellerRes.errorCategory === 'ADMIN_SESSION_MISSING' || sellerRes.errorCategory === 'ADMIN_SESSION_EXPIRED') {
        hasAuthError = true;
        authErrorMessage = sellerRes.data?.error || 'Missing or invalid Firebase Auth admin session token.';
      } else if (sellerRes.errorCategory === 'ADMIN_UNAUTHORIZED') {
        hasAuthError = true;
        authErrorMessage = sellerRes.data?.error || 'Unauthorized email. Only shop@sa-and-sha.com is granted admin access.';
      }

      if (productsRes.ok && productsRes.data) {
        setProducts(productsRes.data.records || []);
      }
      if (shippingRes.ok && shippingRes.data) {
        if (shippingRes.data.config) setShipping(shippingRes.data.config);
      }
      if (numberingRes.ok && numberingRes.data) {
        if (numberingRes.data.config) setNumbering(numberingRes.data.config);
      }
      if (auditRes.ok && auditRes.data) {
        setAuditLogs(auditRes.data.logs || []);
      }

      if (hasAuthError) {
        setMessage({ type: 'error', text: authErrorMessage });
        if (showToast) showToast(authErrorMessage, 'error');
      }
    } catch (err) {
      console.error('Error loading tax master data:', err);
      setMessage({ type: 'error', text: 'Error loading GST Master configuration.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSeller = async (statusOverride?: 'DRAFT' | 'ACTIVE') => {
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        ...seller,
        status: statusOverride || seller.status,
        reason: 'Admin updated seller GST configuration from Tax Master UI'
      };
      const { ok, data } = await authenticatedFetch('/api/admin/tax-master/seller', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (ok && data.success) {
        setMessage({ type: 'success', text: 'Seller GST master configuration saved successfully.' });
        if (showToast) showToast('Seller GST master configuration saved successfully.');
        setSeller(data.config);
        loadAllTaxData();
      } else {
        const errText = data?.error || 'Failed to save seller config.';
        setMessage({ type: 'error', text: errText });
        if (showToast) showToast(errText, 'error');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Network error saving seller config.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProductRule = async (rulePayload: any): Promise<boolean> => {
    setSaving(true);
    setMessage(null);
    try {
      const { ok, data } = await authenticatedFetch('/api/admin/tax-master/products', {
        method: 'POST',
        body: JSON.stringify(rulePayload)
      });
      if (ok && data.success) {
        setMessage({ type: 'success', text: 'Product tax rule created successfully.' });
        if (showToast) showToast('Product tax rule created successfully.');
        await loadAllTaxData();
        return true;
      } else {
        const errText = data?.error || 'Failed to create product tax rule.';
        setMessage({ type: 'error', text: errText });
        if (showToast) showToast(errText, 'error');
        return false;
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error creating product tax rule.' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateProductRule = async (recordId: string) => {
    if (!confirm('Are you sure you want to deactivate this Product Tax Master rule?')) return;
    setSaving(true);
    try {
      const { ok, data } = await authenticatedFetch(`/api/admin/tax-master/products/${recordId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'INACTIVE',
          reason: 'Deactivated rule via Admin UI'
        })
      });
      if (ok && data.success) {
        setMessage({ type: 'success', text: 'Rule deactivated successfully.' });
        if (showToast) showToast('Rule deactivated successfully.');
        await loadAllTaxData();
      } else {
        const err = data?.error || 'Failed to deactivate rule.';
        setMessage({ type: 'error', text: err });
        if (showToast) showToast(err, 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewCsv = async (csvContent: string) => {
    const { ok, data } = await authenticatedFetch('/api/admin/tax-master/products/import/preview', {
      method: 'POST',
      body: JSON.stringify({ csv_text: csvContent })
    });
    if (ok && data.success) {
      return data.preview;
    } else {
      throw new Error(data?.error || 'Failed to preview CSV import.');
    }
  };

  const handleCommitCsvImport = async (records: any[]): Promise<boolean> => {
    setSaving(true);
    try {
      // Re-convert records to CSV or send directly
      const lines = [
        'scope_type,scope_value,hsn_code,gst_rate,rate_mode,effective_from,notes',
        ...records.map((r) =>
          `"${r.scope_type || 'SKU'}","${r.scope_value || r.sku || ''}","${r.hsn_code}","${r.gst_rate ?? ''}","${r.rate_mode || 'FIXED'}","${r.effective_from || ''}","${r.notes || ''}"`
        )
      ];
      const csvStr = lines.join('\n');

      const { ok, data } = await authenticatedFetch('/api/admin/tax-master/products/import', {
        method: 'POST',
        body: JSON.stringify({ csv_text: csvStr, reason: 'Bulk CSV import via Admin UI' })
      });
      if (ok && data.success) {
        setMessage({ type: 'success', text: `Successfully imported ${data.imported_count} product tax rules.` });
        if (showToast) showToast(`Successfully imported ${data.imported_count} product tax rules.`);
        await loadAllTaxData();
        return true;
      } else {
        const errText = data?.error || 'Failed to import CSV rules.';
        setMessage({ type: 'error', text: errText });
        if (showToast) showToast(errText, 'error');
        return false;
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error committing CSV import.' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveShipping = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { ok, data } = await authenticatedFetch('/api/admin/tax-master/shipping', {
        method: 'PUT',
        body: JSON.stringify({ ...shipping, reason: 'Updated shipping tax config via Admin UI' })
      });
      if (ok && data.success) {
        setMessage({ type: 'success', text: 'Shipping tax master configuration saved.' });
        if (showToast) showToast('Shipping tax master configuration saved.');
        setShipping(data.config);
        loadAllTaxData();
      } else {
        const errText = data?.error || 'Failed to save shipping tax config.';
        setMessage({ type: 'error', text: errText });
        if (showToast) showToast(errText, 'error');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error saving shipping tax config.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNumbering = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { ok, data } = await authenticatedFetch('/api/admin/tax-master/invoice-numbering', {
        method: 'PUT',
        body: JSON.stringify({ ...numbering, reason: 'Updated invoice numbering format via Admin UI' })
      });
      if (ok && data.success) {
        setMessage({ type: 'success', text: 'Invoice numbering configuration saved.' });
        if (showToast) showToast('Invoice numbering configuration saved.');
        setNumbering(data.config);
        loadAllTaxData();
      } else {
        const errText = data?.error || 'Failed to save numbering config.';
        setMessage({ type: 'error', text: errText });
        if (showToast) showToast(errText, 'error');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error saving numbering config.' });
    } finally {
      setSaving(false);
    }
  };

  const openAddModalWithScope = (scopeType: TaxRuleScope, targetValue: string) => {
    setPrefillScope(scopeType);
    if (scopeType === 'CATEGORY') {
      setPrefillCategory(targetValue);
      setPrefillProductId('');
      setPrefillSku('');
    } else if (scopeType === 'PRODUCT') {
      setPrefillProductId(targetValue);
      setPrefillCategory('');
      setPrefillSku('');
    } else if (scopeType === 'SKU') {
      setPrefillSku(targetValue);
      setPrefillCategory('');
      setPrefillProductId('');
    }
    setShowAddModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Readiness Status */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              <h2 className="text-xl font-bold text-stone-900">GST Master System Administration</h2>
              {readiness && (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                    readiness.overall_status === 'READY'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {readiness.overall_status === 'READY' ? 'Ready for GST Invoicing' : 'Configuration Incomplete'}
                </span>
              )}
            </div>
            <p className="text-sm text-stone-500 mt-1">
              Firestore-backed tax master, verified seller identity, HSN & GST rate lookup, and immutable audit history.
            </p>
          </div>
          <button
            onClick={loadAllTaxData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-stone-300 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Config
          </button>
        </div>

        {/* Readiness Breakdown Grid */}
        {readiness && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-stone-200">
            {/* 1. Seller GST */}
            <div className="p-4 bg-stone-50 rounded-lg border border-stone-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-500 uppercase">Seller GST Identity</span>
                {readiness.summary.seller_gst.ready ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-amber-600" />
                )}
              </div>
              <p className="text-sm font-bold text-stone-900 mt-2">
                {readiness.summary.seller_gst.legal_name || 'Not Configured'}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                GSTIN: {readiness.summary.seller_gst.gstin || 'Missing'}
              </p>
              {readiness.summary.seller_gst.error && (
                <p className="text-xs text-amber-700 mt-1 font-medium">{readiness.summary.seller_gst.error}</p>
              )}
            </div>

            {/* 2. Shipping Tax */}
            <div className="p-4 bg-stone-50 rounded-lg border border-stone-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-500 uppercase">Shipping Tax</span>
                {readiness.summary.shipping_tax.ready ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-amber-600" />
                )}
              </div>
              <p className="text-sm font-bold text-stone-900 mt-2">
                SAC: {readiness.summary.shipping_tax.hsn_or_sac_code || '996812'}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                Rate: {readiness.summary.shipping_tax.gst_rate}%
              </p>
            </div>

            {/* 3. Invoice Numbering */}
            <div className="p-4 bg-stone-50 rounded-lg border border-stone-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-500 uppercase">Invoice Numbering</span>
                {readiness.summary.invoice_numbering.ready ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-amber-600" />
                )}
              </div>
              <p className="text-sm font-bold text-stone-900 mt-2">
                Series: {readiness.summary.invoice_numbering.prefix || 'SS'}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                Rule 46 Compliant Format
              </p>
            </div>

            {/* 4. Product Coverage */}
            <div className="p-4 bg-stone-50 rounded-lg border border-stone-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-500 uppercase">Catalog Tax Coverage</span>
                {readiness.summary.product_coverage.coverage_percentage === 100 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-amber-600" />
                )}
              </div>
              <p className="text-sm font-bold text-stone-900 mt-2">
                {readiness.summary.product_coverage.coverage_percentage}% Covered
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                {readiness.summary.product_coverage.missing_skus} unmapped product(s)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Toast / Message Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-stone-400 hover:text-stone-600">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-Tab Navigation Bar */}
      <div className="flex border-b border-stone-200 bg-white px-6 pt-4 rounded-t-xl gap-8 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('products')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeSubTab === 'products'
              ? 'border-emerald-700 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Product Tax Master
        </button>
        <button
          onClick={() => setActiveSubTab('seller')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeSubTab === 'seller'
              ? 'border-emerald-700 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Seller GST Config
        </button>
        <button
          onClick={() => setActiveSubTab('shipping')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeSubTab === 'shipping'
              ? 'border-emerald-700 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Truck className="w-4 h-4" />
          Shipping Tax
        </button>
        <button
          onClick={() => setActiveSubTab('numbering')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeSubTab === 'numbering'
              ? 'border-emerald-700 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Hash className="w-4 h-4" />
          Invoice Numbering
        </button>
        <button
          onClick={() => setActiveSubTab('audit')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeSubTab === 'audit'
              ? 'border-emerald-700 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <History className="w-4 h-4" />
          Audit Log
        </button>
      </div>

      {/* Sub-Tab 1: Product Tax Master (Priority upgraded UI) */}
      {activeSubTab === 'products' && (
        <div className="bg-white rounded-b-xl shadow-sm border border-stone-200 p-6 space-y-6">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
            <div>
              <h3 className="text-lg font-bold text-stone-900">Product Tax Master Management</h3>
              <p className="text-sm text-stone-500">
                Statutory HSN and GST rate mappings supporting Category, Product, SKU, and Default rules.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors"
              >
                <Upload className="w-4 h-4" />
                CSV Bulk Import
              </button>
              <button
                onClick={() => {
                  setPrefillScope('CATEGORY');
                  setPrefillCategory('');
                  setPrefillProductId('');
                  setPrefillSku('');
                  setShowAddModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-800 text-white rounded-lg text-sm font-medium hover:bg-emerald-900 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Tax Rule
              </button>
            </div>
          </div>

          {/* Tax Coverage Summary Card */}
          <TaxCoverageCard
            coverage={coverageData}
            onOpenAddModalWithScope={openAddModalWithScope}
          />

          {/* Resolution Priority Banner */}
          <TaxPrecedenceBanner />

          {/* Upgraded Tax Rules Table */}
          <TaxRulesTable
            rules={products}
            onDeactivateRule={handleDeactivateProductRule}
            loading={loading}
          />
        </div>
      )}

      {/* Sub-Tab 2: Seller GST Configuration Form */}
      {activeSubTab === 'seller' && (
        <div className="bg-white rounded-b-xl shadow-sm border border-stone-200 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-stone-200 pb-4">
            <div>
              <h3 className="text-lg font-bold text-stone-900">Seller GST Master Configuration</h3>
              <p className="text-sm text-stone-500">
                Verified legal entity tax credentials used for all legally binding GST tax invoices.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSaveSeller('DRAFT')}
                disabled={saving}
                className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50"
              >
                Save as Draft
              </button>
              <button
                onClick={() => handleSaveSeller('ACTIVE')}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-800 text-white rounded-lg text-sm font-medium hover:bg-emerald-900"
              >
                <Save className="w-4 h-4" />
                Activate Seller Config
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                Legal Entity Name *
              </label>
              <input
                type="text"
                value={seller.legal_name}
                onChange={(e) => setSeller({ ...seller, legal_name: e.target.value })}
                placeholder="e.g., SA AND SHA PRIVATE LIMITED"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                Trade Name
              </label>
              <input
                type="text"
                value={seller.trade_name}
                onChange={(e) => setSeller({ ...seller, trade_name: e.target.value })}
                placeholder="Sa and Sha"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                Seller GSTIN (15 Digits) *
              </label>
              <input
                type="text"
                value={seller.gstin}
                onChange={(e) => setSeller({ ...seller, gstin: e.target.value.toUpperCase() })}
                placeholder="27AABCK1234L1Z9"
                maxLength={15}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                PAN Number (10 Characters) *
              </label>
              <input
                type="text"
                value={seller.pan}
                onChange={(e) => setSeller({ ...seller, pan: e.target.value.toUpperCase() })}
                placeholder="AABCK1234L"
                maxLength={10}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                Registered Address Line 1 *
              </label>
              <input
                type="text"
                value={seller.address_line_1}
                onChange={(e) => setSeller({ ...seller, address_line_1: e.target.value })}
                placeholder="Building Name, Premises, Street Name"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                Address Line 2
              </label>
              <input
                type="text"
                value={seller.address_line_2 || ''}
                onChange={(e) => setSeller({ ...seller, address_line_2: e.target.value })}
                placeholder="Area, Landmark"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                City *
              </label>
              <input
                type="text"
                value={seller.city}
                onChange={(e) => setSeller({ ...seller, city: e.target.value })}
                placeholder="Mumbai"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                State & State Code *
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={seller.state}
                  onChange={(e) => setSeller({ ...seller, state: e.target.value })}
                  placeholder="Maharashtra"
                  className="col-span-2 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
                <input
                  type="text"
                  value={seller.state_code}
                  onChange={(e) => setSeller({ ...seller, state_code: e.target.value })}
                  placeholder="27"
                  maxLength={2}
                  className="px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                Pincode *
              </label>
              <input
                type="text"
                value={seller.pincode}
                onChange={(e) => setSeller({ ...seller, pincode: e.target.value })}
                placeholder="400001"
                maxLength={6}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                Support Email *
              </label>
              <input
                type="email"
                value={seller.support_email}
                onChange={(e) => setSeller({ ...seller, support_email: e.target.value })}
                placeholder="shop@sa-and-sha.com"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                Support Phone
              </label>
              <input
                type="text"
                value={seller.support_phone}
                onChange={(e) => setSeller({ ...seller, support_phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                Invoice Prefix
              </label>
              <input
                type="text"
                value={seller.invoice_prefix}
                onChange={(e) => setSeller({ ...seller, invoice_prefix: e.target.value.toUpperCase() })}
                placeholder="SS"
                maxLength={10}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Shipping Tax Configuration */}
      {activeSubTab === 'shipping' && (
        <div className="bg-white rounded-b-xl shadow-sm border border-stone-200 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-stone-200 pb-4">
            <div>
              <h3 className="text-lg font-bold text-stone-900">Shipping & Courier Freight GST Config</h3>
              <p className="text-sm text-stone-500">
                GST treatment applied to delivery charges and logistics fees.
              </p>
            </div>
            <button
              onClick={handleSaveShipping}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-800 text-white rounded-lg text-sm font-medium hover:bg-emerald-900"
            >
              <Save className="w-4 h-4" />
              Save Shipping Tax Config
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                SAC / HSN Code for Shipping *
              </label>
              <input
                type="text"
                value={shipping.hsn_or_sac_code}
                onChange={(e) => setShipping({ ...shipping, hsn_or_sac_code: e.target.value })}
                placeholder="996812"
                maxLength={6}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                Shipping GST Rate (%) *
              </label>
              <select
                value={shipping.gst_rate}
                onChange={(e) => setShipping({ ...shipping, gst_rate: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                <option value={18}>18% (Standard Courier & Freight)</option>
                <option value={12}>12%</option>
                <option value={5}>5%</option>
                <option value={0}>0% (Exempt)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 4: Invoice Numbering Configuration */}
      {activeSubTab === 'numbering' && (
        <div className="bg-white rounded-b-xl shadow-sm border border-stone-200 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-stone-200 pb-4">
            <div>
              <h3 className="text-lg font-bold text-stone-900">GST Invoice Numbering Format</h3>
              <p className="text-sm text-stone-500">
                Rule-based sequential invoice numbering according to Rule 46 of CGST Rules 2017.
              </p>
            </div>
            <button
              onClick={handleSaveNumbering}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-800 text-white rounded-lg text-sm font-medium hover:bg-emerald-900"
            >
              <Save className="w-4 h-4" />
              Save Numbering Config
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                Invoice Series Prefix *
              </label>
              <input
                type="text"
                value={numbering.prefix}
                onChange={(e) => setNumbering({ ...numbering, prefix: e.target.value.toUpperCase() })}
                placeholder="SS"
                maxLength={10}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                Delimiter Separator
              </label>
              <select
                value={numbering.separator}
                onChange={(e) => setNumbering({ ...numbering, separator: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                <option value="/">Forward Slash ( / )</option>
                <option value="-">Hyphen ( - )</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                Sequence Zero-Padding
              </label>
              <select
                value={numbering.sequence_padding}
                onChange={(e) => setNumbering({ ...numbering, sequence_padding: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                <option value={6}>6 Digits (e.g. 000001)</option>
                <option value={5}>5 Digits (e.g. 00001)</option>
                <option value={4}>4 Digits (e.g. 0001)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 5: Audit Log History */}
      {activeSubTab === 'audit' && (
        <div className="bg-white rounded-b-xl shadow-sm border border-stone-200 p-6 space-y-6">
          <div className="border-b border-stone-200 pb-4">
            <h3 className="text-lg font-bold text-stone-900">Tax Master Audit Logs</h3>
            <p className="text-sm text-stone-500">
              Immutable audit history tracking all seller GST and tax master administrative updates.
            </p>
          </div>

          <div className="space-y-3">
            {auditLogs.length === 0 ? (
              <div className="py-8 text-center text-stone-400 text-xs">
                No audit log entries recorded yet.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.audit_id} className="p-4 bg-stone-50 rounded-lg border border-stone-200 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900">{log.action}</span>
                    <span className="text-xs text-stone-500">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-stone-700 mt-1">{log.reason || 'No reason provided.'}</p>
                  <div className="text-xs text-stone-500 mt-2">
                    Admin: <span className="font-medium text-stone-800">{log.email || log.admin_id}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add Tax Rule Modal */}
      {showAddModal && (
        <AddTaxRuleModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleCreateProductRule}
          saving={saving}
          initialScope={prefillScope}
          initialCategory={prefillCategory}
          initialProductId={prefillProductId}
          initialSku={prefillSku}
        />
      )}

      {/* CSV Bulk Import Modal */}
      {showImportModal && (
        <CsvBulkImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onPreview={handlePreviewCsv}
          onCommit={handleCommitCsvImport}
          loading={saving}
        />
      )}
    </div>
  );
};
