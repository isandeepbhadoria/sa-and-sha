import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Download, 
  Filter, 
  ShieldCheck, 
  Mail, 
  Phone, 
  MessageSquare, 
  PhoneCall, 
  Star, 
  X, 
  Loader2, 
  ShoppingBag, 
  RotateCcw, 
  Tag, 
  FileSpreadsheet, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink,
  MapPin,
  Save,
  Eye,
  EyeOff,
  AlertTriangle,
  Clock,
  HeartPulse,
  PieChart,
  Plus,
  Check,
  Copy,
  Layers,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserPlus,
  UserX,
  Activity,
  GitMerge,
  MessageCircle,
  FileCheck,
  Award,
  CreditCard,
  Building2
} from 'lucide-react';

interface AdminCustomersTabProps {
  adminToken: string;
}

export const AdminCustomersTab: React.FC<AdminCustomersTabProps> = ({ adminToken }) => {
  // Main Navigation Sub-tabs: 'directory' | 'segments' | 'analytics'
  const [activeMainTab, setActiveMainTab] = useState<'directory' | 'segments' | 'analytics'>('directory');

  // Customer List State
  const [customers, setCustomers] = useState<any[]>([]);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [summaryMetrics, setSummaryMetrics] = useState({
    totalCustomers: 0,
    repeatCustomers: 0,
    totalLifetimeRevenue: 0,
    averageCustomerValue: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Directory Filters & Pagination
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [consentFilter, setConsentFilter] = useState('');
  const [selectedSegmentFilter, setSelectedSegmentFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const limit = 25;

  // Drawer State & Drawer Navigation ('profile' | 'timeline' | 'health' | 'notes' | 'loyalty' | 'security')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<'profile' | 'timeline' | 'health' | 'notes' | 'loyalty' | 'security'>('profile');
  const [customerDetail, setCustomerDetail] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Customer Security & Events State
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [securitySummary, setSecuritySummary] = useState<any | null>(null);
  const [isSecurityLoading, setIsSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);

  // Customer Loyalty & Store Credit Drawer State
  const [loyaltyDetail, setLoyaltyDetail] = useState<any | null>(null);
  const [isLoyaltyLoading, setIsLoyaltyLoading] = useState(false);
  const [ptsAdjAmount, setPtsAdjAmount] = useState('');
  const [ptsAdjReason, setPtsAdjReason] = useState('');
  const [creditAdjAmount, setCreditAdjAmount] = useState('');
  const [creditAdjReason, setCreditAdjReason] = useState('');
  const [creditAdjExpiry, setCreditAdjExpiry] = useState('');
  const [isSubmittingAdj, setIsSubmittingAdj] = useState(false);
  const [largeAdjConfirmOpen, setLargeAdjConfirmOpen] = useState(false);
  const [pendingAdjType, setPendingAdjType] = useState<'points' | 'credit' | null>(null);
  const [adjSuccessMsg, setAdjSuccessMsg] = useState<string | null>(null);
  const [adjErrorMsg, setAdjErrorMsg] = useState<string | null>(null);
  
  // Contact Unmasking State
  const [unmaskedData, setUnmaskedData] = useState<Record<string, { phone: string; email: string }>>({});
  const [unmaskLoading, setUnmaskLoading] = useState<Record<string, boolean>>({});
  const [unmaskError, setUnmaskError] = useState<string | null>(null);

  // Customer ID Copy State
  const [copiedId, setCopiedId] = useState(false);

  // Customer ID Migration State
  const [migrationModalOpen, setMigrationModalOpen] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationDryRunResult, setMigrationDryRunResult] = useState<any | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [migrationSuccessMsg, setMigrationSuccessMsg] = useState<string | null>(null);
  const [confirmAssignModalOpen, setConfirmAssignModalOpen] = useState(false);

  // Customer Activity Timeline State
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [timelineCategory, setTimelineCategory] = useState<string>('all');
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);

  // Customer Structured Notes State
  const [notesList, setNotesList] = useState<any[]>([]);
  const [isNotesLoading, setIsNotesLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteType, setNewNoteType] = useState('general');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Admin Metadata Editing
  const [adminTier, setAdminTier] = useState('Standard');
  const [adminTags, setAdminTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Health Recalculation State
  const [isRecalculatingHealth, setIsRecalculatingHealth] = useState(false);

  // Duplicate Merge Preview State
  const [mergePreviewModalOpen, setMergePreviewModalOpen] = useState(false);
  const [mergeDuplicateId, setMergeDuplicateId] = useState<string | null>(null);
  const [mergePreviewData, setMergePreviewData] = useState<any | null>(null);
  const [isMergePreviewLoading, setIsMergePreviewLoading] = useState(false);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Segments State
  const [segmentsList, setSegmentsList] = useState<any[]>([]);
  const [isSegmentsLoading, setIsSegmentsLoading] = useState(false);
  const [createSegmentModalOpen, setCreateSegmentModalOpen] = useState(false);
  const [newSegName, setNewSegName] = useState('');
  const [newSegDesc, setNewSegDesc] = useState('');
  const [newSegMinSpend, setNewSegMinSpend] = useState('');
  const [newSegMinOrders, setNewSegMinOrders] = useState('');
  const [newSegHealthStatus, setNewSegHealthStatus] = useState('');
  const [isCreatingSegment, setIsCreatingSegment] = useState(false);

  // CRM Analytics Dashboard State
  const [analyticsData, setAnalyticsData] = useState<any | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [batchActionStatus, setBatchActionStatus] = useState<string | null>(null);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  // Clear unmasked PII state when page, tab, or token changes (privacy enforcement)
  useEffect(() => {
    setUnmaskedData({});
    setUnmaskError(null);
  }, [page, activeMainTab, adminToken]);

  const handleToggleUnmask = async (customerId: string) => {
    setUnmaskError(null);

    // Toggle off if already unmasked
    if (unmaskedData[customerId]) {
      setUnmaskedData(prev => {
        const next = { ...prev };
        delete next[customerId];
        return next;
      });
      return;
    }

    // Require admin token
    if (!adminToken) {
      setUnmaskError('Unable to reveal contact details. Please refresh your Admin session.');
      return;
    }

    setUnmaskLoading(prev => ({ ...prev, [customerId]: true }));

    try {
      const res = await fetch(`/api/admin/customers/${encodeURIComponent(customerId)}`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const data = await res.json();
      if (data.success && data.customer) {
        const fullPhone = data.customer.normalized_phone || data.customer.phone || '';
        const fullEmail = data.customer.email || '';

        setUnmaskedData(prev => ({
          ...prev,
          [customerId]: {
            phone: fullPhone,
            email: fullEmail
          }
        }));
      } else {
        setUnmaskError(data.error || 'Unable to reveal contact details. Please refresh your Admin session.');
      }
    } catch (err) {
      setUnmaskError('Unable to reveal contact details. Please refresh your Admin session.');
    } finally {
      setUnmaskLoading(prev => ({ ...prev, [customerId]: false }));
    }
  };

  const handleRunMigrationDryRun = async () => {
    setIsMigrating(true);
    setMigrationError(null);
    setMigrationSuccessMsg(null);
    try {
      const res = await fetch('/api/admin/customers/migrate-ids', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dryRun: true, batchSize: 200 })
      });
      const data = await res.json();
      if (data.success && data.result) {
        setMigrationDryRunResult(data.result);
      } else {
        setMigrationError(data.error || 'Failed to execute dry-run migration.');
      }
    } catch (err: any) {
      setMigrationError(err.message || 'Error executing dry run.');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleExecuteMigration = async () => {
    setIsMigrating(true);
    setMigrationError(null);
    setMigrationSuccessMsg(null);
    setConfirmAssignModalOpen(false);

    try {
      const res = await fetch('/api/admin/customers/migrate-ids', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dryRun: false, batchSize: 200 })
      });
      const data = await res.json();
      if (data.success && data.result) {
        setMigrationSuccessMsg(`Successfully assigned Customer IDs to ${data.result.assigned} profile(s). Current counter: ${data.result.currentCounter}`);
        setMigrationDryRunResult(data.result);
        fetchCustomers();
      } else {
        setMigrationError(data.error || 'Failed to execute Customer ID migration.');
      }
    } catch (err: any) {
      setMigrationError(err.message || 'Error executing migration.');
    } finally {
      setIsMigrating(false);
    }
  };

  const getAuthHeaders = () => {
    const headers: Record<string, string> = {
      'x-admin-token': adminToken,
      'x-admin-key': adminToken
    };
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    return headers;
  };

  // Fetch Customers Directory
  const fetchCustomers = async (targetCursor?: string | null) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const activeCursor = targetCursor !== undefined ? targetCursor : currentCursor;
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
        ...(activeCursor ? { cursor: activeCursor } : {}),
        ...(search ? { search } : {}),
        ...(tierFilter ? { tier: tierFilter } : {}),
        ...(consentFilter ? { consent_channel: consentFilter } : {})
      });

      const res = await fetch(`/api/admin/customers?${queryParams.toString()}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (data.success) {
        setCustomers(data.customers || []);
        setHasMore(Boolean(data.hasMore));
        setNextCursor(data.nextCursor || null);
        setTotalCustomers(data.analytics?.totalCustomers || data.customers?.length || 0);
        setSummaryMetrics({
          totalCustomers: data.analytics?.totalCustomers || 0,
          repeatCustomers: data.analytics?.repeatCustomers || 0,
          totalLifetimeRevenue: data.analytics?.lifetimeRevenue || 0,
          averageCustomerValue: data.analytics?.avgCustomerValue || 0
        });
      } else {
        setErrorMsg(data.error || 'Failed to fetch customer directory.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error connecting to server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeMainTab === 'directory') {
      fetchCustomers(currentCursor);
    }
  }, [currentCursor, tierFilter, consentFilter, adminToken, activeMainTab]);

  // Fetch Segments
  const fetchSegments = async () => {
    setIsSegmentsLoading(true);
    try {
      const res = await fetch('/api/admin/customer-segments', {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setSegmentsList(data.segments || []);
      }
    } catch (err) {
      console.error('Failed to load segments:', err);
    } finally {
      setIsSegmentsLoading(false);
    }
  };

  useEffect(() => {
    if (activeMainTab === 'segments') {
      fetchSegments();
    }
  }, [activeMainTab]);

  // Fetch Analytics Overview
  const fetchAnalytics = async () => {
    setIsAnalyticsLoading(true);
    try {
      const res = await fetch('/api/admin/customer-analytics', {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setAnalyticsData(data.analytics);
      }
    } catch (err) {
      console.error('Failed to load CRM analytics:', err);
    } finally {
      setIsAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (activeMainTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeMainTab]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setCurrentCursor(null);
    setCursorStack([null]);
    fetchCustomers(null);
  };

  const fetchSecurityEvents = async (customerId: string) => {
    if (!customerId || !adminToken) return;
    setIsSecurityLoading(true);
    setSecurityError(null);
    try {
      const res = await fetch(`/api/admin/customers/${encodeURIComponent(customerId)}/security-events`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSecurityEvents(data.events || []);
        setSecuritySummary(data.summary || null);
      } else {
        setSecurityError(data.error || 'Failed to fetch customer security events.');
      }
    } catch (err: any) {
      setSecurityError('Error loading security events.');
    } finally {
      setIsSecurityLoading(false);
    }
  };

  const [isRepairingProfile, setIsRepairingProfile] = useState(false);

  // Repair Profile & Orders Helper
  const handleRepairProfile = async (targetPhone?: string, targetProfileId?: string) => {
    setIsRepairingProfile(true);
    setSaveSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/customers/repair-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ targetPhone, targetProfileId, dryRun: false })
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccessMsg(`Profile & orders repair completed (${data.result?.repairedProfilesCount} profile(s), ${data.result?.repairedOrdersCount} order(s) updated).`);
        if (selectedCustomerId) {
          handleOpenDetail(selectedCustomerId);
        }
        fetchCustomers(page);
      } else {
        setErrorMsg(data.error || 'Failed to repair profile.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error executing repair action.');
    } finally {
      setIsRepairingProfile(false);
    }
  };

  // Open Detail Drawer
  const handleOpenDetail = async (customerId: string) => {
    setSelectedCustomerId(customerId);
    setDrawerTab('profile');
    setIsDetailLoading(true);
    setSaveSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success && (data.customer || data.profile)) {
        const custObj = data.customer || data.profile;
        const normalizedDetail = {
          ...data,
          ...custObj,
          profile: custObj.profile || custObj,
          customer_id: custObj.customer_id || custObj.id,
          possible_duplicates: data.possible_duplicates || [],
          orders: data.orders || []
        };
        setCustomerDetail(normalizedDetail);
        setAdminTier(custObj.admin_metadata?.customer_tier || 'standard');
        setAdminTags(custObj.admin_metadata?.tags || []);
        setAdminNotes(custObj.admin_metadata?.internal_notes || '');
        // Fetch Notes & Timeline
        fetchTimeline(customerId, 'all');
        fetchNotes(customerId);
      } else {
        setErrorMsg(data.error || 'Failed to load customer profile.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load customer details.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Fetch Timeline Events
  const fetchTimeline = async (customerId: string, category: string) => {
    setIsTimelineLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/timeline?category=${category}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setTimelineEvents(data.events || []);
      }
    } catch (err) {
      console.error('Error fetching timeline:', err);
    } finally {
      setIsTimelineLoading(false);
    }
  };

  // Fetch Notes
  const fetchNotes = async (customerId: string) => {
    setIsNotesLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/notes`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setNotesList(data.notes || []);
      }
    } catch (err) {
      console.error('Error fetching notes:', err);
    } finally {
      setIsNotesLoading(false);
    }
  };

  // Add Service Note
  const handleAddNote = async () => {
    if (!selectedCustomerId || !newNoteText.trim()) return;
    setIsAddingNote(true);
    try {
      const res = await fetch(`/api/admin/customers/${selectedCustomerId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          note: newNoteText.trim(),
          note_type: newNoteType
        })
      });
      const data = await res.json();
      if (data.success) {
        setNewNoteText('');
        fetchNotes(selectedCustomerId);
        fetchTimeline(selectedCustomerId, timelineCategory);
      } else {
        alert(data.error || 'Failed to add note.');
      }
    } catch (err) {
      alert('Error saving note.');
    } finally {
      setIsAddingNote(false);
    }
  };

  // Fetch Loyalty & Store Credit Data
  const fetchLoyaltyData = async (customerId: string) => {
    setIsLoyaltyLoading(true);
    setAdjErrorMsg(null);
    setAdjSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/loyalty`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setLoyaltyDetail(data);
      } else {
        setAdjErrorMsg(data.error || 'Failed to fetch customer loyalty data.');
      }
    } catch (err) {
      setAdjErrorMsg('Error loading loyalty data.');
    } finally {
      setIsLoyaltyLoading(false);
    }
  };

  // Submit Loyalty Points Adjustment
  const executePointsAdjustment = async () => {
    if (!selectedCustomerId || !ptsAdjAmount || !ptsAdjReason.trim()) return;
    const pts = Number(ptsAdjAmount);
    if (isNaN(pts) || pts === 0) {
      setAdjErrorMsg('Please enter a valid non-zero points adjustment amount.');
      return;
    }

    setIsSubmittingAdj(true);
    setAdjErrorMsg(null);
    setAdjSuccessMsg(null);
    setLargeAdjConfirmOpen(false);

    try {
      const res = await fetch(`/api/admin/customers/${selectedCustomerId}/loyalty/adjust-points`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          points: pts,
          reason: ptsAdjReason.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        setPtsAdjAmount('');
        setPtsAdjReason('');
        setAdjSuccessMsg(`Successfully adjusted loyalty points by ${pts > 0 ? '+' : ''}${pts}!`);
        fetchLoyaltyData(selectedCustomerId);
      } else {
        setAdjErrorMsg(data.error || 'Failed to adjust points.');
      }
    } catch (err: any) {
      setAdjErrorMsg(err.message || 'Error processing points adjustment.');
    } finally {
      setIsSubmittingAdj(false);
    }
  };

  const handlePointsAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const pts = Math.abs(Number(ptsAdjAmount));
    if (pts > 5000) {
      setPendingAdjType('points');
      setLargeAdjConfirmOpen(true);
      return;
    }
    executePointsAdjustment();
  };

  // Submit Store Credit Adjustment
  const executeCreditAdjustment = async () => {
    if (!selectedCustomerId || !creditAdjAmount || !creditAdjReason.trim()) return;
    const amt = Number(creditAdjAmount);
    if (isNaN(amt) || amt === 0) {
      setAdjErrorMsg('Please enter a valid non-zero store credit amount.');
      return;
    }

    setIsSubmittingAdj(true);
    setAdjErrorMsg(null);
    setAdjSuccessMsg(null);
    setLargeAdjConfirmOpen(false);

    try {
      const res = await fetch(`/api/admin/customers/${selectedCustomerId}/loyalty/adjust-store-credit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          amount_rupees: amt,
          reason: creditAdjReason.trim(),
          expires_at: creditAdjExpiry || undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        setCreditAdjAmount('');
        setCreditAdjReason('');
        setCreditAdjExpiry('');
        setAdjSuccessMsg(`Successfully adjusted store credit by ${amt > 0 ? '+' : ''}₹${amt}!`);
        fetchLoyaltyData(selectedCustomerId);
      } else {
        setAdjErrorMsg(data.error || 'Failed to adjust store credit.');
      }
    } catch (err: any) {
      setAdjErrorMsg(err.message || 'Error processing store credit adjustment.');
    } finally {
      setIsSubmittingAdj(false);
    }
  };

  const handleCreditAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.abs(Number(creditAdjAmount));
    if (amt > 10000) {
      setPendingAdjType('credit');
      setLargeAdjConfirmOpen(true);
      return;
    }
    executeCreditAdjustment();
  };

  // Recalculate Single Customer Health
  const handleRecalculateHealth = async () => {
    if (!selectedCustomerId) return;
    setIsRecalculatingHealth(true);
    try {
      const res = await fetch(`/api/admin/customers/${selectedCustomerId}/recalculate-health`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccessMsg('Customer health score and metrics recalculated!');
        handleOpenDetail(selectedCustomerId);
      } else {
        alert(data.error || 'Failed to recalculate health.');
      }
    } catch (err) {
      alert('Error recalculating health.');
    } finally {
      setIsRecalculatingHealth(false);
    }
  };

  // Accept/Dismiss Suggested Tag
  const handleSuggestedTagAction = async (tag: string, action: 'accept' | 'dismiss') => {
    if (!selectedCustomerId) return;
    try {
      const res = await fetch(`/api/admin/customers/${selectedCustomerId}/suggested-tags/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ tag })
      });
      const data = await res.json();
      if (data.success) {
        handleOpenDetail(selectedCustomerId);
      }
    } catch (err) {
      console.error('Error with suggested tag:', err);
    }
  };

  // Accept/Dismiss VIP Candidate
  const handleVipSuggestionAction = async (action: 'accept' | 'dismiss') => {
    if (!selectedCustomerId) return;
    try {
      const res = await fetch(`/api/admin/customers/${selectedCustomerId}/vip-suggestion/${action}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccessMsg(action === 'accept' ? 'Customer promoted to VIP tier!' : 'VIP suggestion dismissed.');
        handleOpenDetail(selectedCustomerId);
      }
    } catch (err) {
      alert('Error updating VIP status.');
    }
  };

  // Save Admin Metadata
  const handleSaveAdminMetadata = async () => {
    if (!selectedCustomerId) return;
    setIsSavingMetadata(true);
    setSaveSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/customers/${selectedCustomerId}/admin-metadata`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          customer_tier: adminTier,
          tags: adminTags,
          internal_notes: adminNotes
        })
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccessMsg('Admin metadata updated successfully!');
        fetchCustomers();
      } else {
        alert(data.error || 'Failed to update metadata.');
      }
    } catch (err) {
      alert('Error updating customer metadata.');
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (trimmed && !adminTags.includes(trimmed)) {
      setAdminTags([...adminTags, trimmed]);
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setAdminTags(adminTags.filter(t => t !== tagToRemove));
  };

  // Duplicate Merge Preview
  const handleOpenMergePreview = async (duplicateId: string) => {
    if (!selectedCustomerId) return;
    setMergeDuplicateId(duplicateId);
    setMergePreviewModalOpen(true);
    setIsMergePreviewLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${selectedCustomerId}/merge-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ duplicate_id: duplicateId })
      });
      const data = await res.json();
      if (data.success) {
        setMergePreviewData(data.preview);
      } else {
        alert(data.error || 'Failed to generate merge preview.');
      }
    } catch (err) {
      alert('Error generating merge preview.');
    } finally {
      setIsMergePreviewLoading(false);
    }
  };

  // Create Custom Segment
  const handleCreateSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSegName.trim()) return;
    setIsCreatingSegment(true);
    try {
      const filters: any = {};
      if (newSegMinSpend) filters.min_lifetime_spend = Number(newSegMinSpend);
      if (newSegMinOrders) filters.min_total_orders = Number(newSegMinOrders);
      if (newSegHealthStatus) filters.health_status = [newSegHealthStatus];

      const res = await fetch('/api/admin/customer-segments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          name: newSegName.trim(),
          description: newSegDesc.trim(),
          filters
        })
      });
      const data = await res.json();
      if (data.success) {
        setCreateSegmentModalOpen(false);
        setNewSegName('');
        setNewSegDesc('');
        setNewSegMinSpend('');
        setNewSegMinOrders('');
        setNewSegHealthStatus('');
        fetchSegments();
      } else {
        alert(data.error || 'Failed to create segment.');
      }
    } catch (err) {
      alert('Error creating segment.');
    } finally {
      setIsCreatingSegment(false);
    }
  };

  // Batch Operations
  const handleRunBatchHealth = async () => {
    setIsBatchRunning(true);
    setBatchActionStatus('Running batch health score recalculation...');
    try {
      const res = await fetch('/api/admin/customers/recalculate-health-batch', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      setBatchActionStatus(data.message || 'Batch health recalculation finished.');
      fetchAnalytics();
    } catch (err) {
      setBatchActionStatus('Failed to execute batch health recalculation.');
    } finally {
      setIsBatchRunning(false);
    }
  };

  const handleRunBackfillTimeline = async () => {
    setIsBatchRunning(true);
    setBatchActionStatus('Running timeline backfill for existing orders & accounts...');
    try {
      const res = await fetch('/api/admin/customers/backfill-timeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ dryRun: false })
      });
      const data = await res.json();
      setBatchActionStatus(data.message || 'Timeline backfill completed.');
      fetchAnalytics();
    } catch (err) {
      setBatchActionStatus('Failed to backfill timeline.');
    } finally {
      setIsBatchRunning(false);
    }
  };

  // Export File
  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf' | 'phone_list' | 'email_list' | 'whatsapp_list') => {
    setIsExporting(true);
    setExportMenuOpen(false);
    try {
      const res = await fetch('/api/admin/customers/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          format,
          filter: {
            tier: tierFilter || undefined,
            consent: consentFilter || undefined,
            search: search || undefined
          }
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Export failed.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      let extension = 'csv';
      if (format === 'xlsx') extension = 'xlsx';
      if (format === 'pdf') extension = 'pdf';
      if (format.endsWith('_list')) extension = 'csv';

      a.download = `kora_customers_export_${format}_${new Date().toISOString().slice(0, 10)}.${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const totalPages = Math.ceil(totalCustomers / limit) || 1;

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* Top Navigation & Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#2A211C] flex items-center gap-2">
            <Users className="w-6 h-6 text-[#B08D57]" />
            <span>Customer CRM & Intelligence Center</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Retention analytics, activity timelines, automated segmentation, health scores, and service logs.
          </p>
        </div>

        {/* View Selector Tabs */}
        <div className="flex items-center bg-stone-100 p-1 rounded-lg text-xs font-bold border border-stone-200">
          <button
            type="button"
            onClick={() => setActiveMainTab('directory')}
            className={`px-3.5 py-2 rounded-md transition-colors flex items-center gap-1.5 ${
              activeMainTab === 'directory' ? 'bg-white text-[#2A211C] shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-[#B08D57]" />
            <span>Directory</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab('segments')}
            className={`px-3.5 py-2 rounded-md transition-colors flex items-center gap-1.5 ${
              activeMainTab === 'segments' ? 'bg-white text-[#2A211C] shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Segments</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab('analytics')}
            className={`px-3.5 py-2 rounded-md transition-colors flex items-center gap-1.5 ${
              activeMainTab === 'analytics' ? 'bg-white text-[#2A211C] shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <PieChart className="w-3.5 h-3.5 text-emerald-600" />
            <span>CRM Analytics</span>
          </button>
        </div>

        {/* Export Button Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            disabled={isExporting}
            className="px-4 py-2.5 bg-[#2A211C] text-white rounded-lg text-xs font-bold hover:bg-[#38322B] transition-colors flex items-center gap-2"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-amber-400" />}
            <span>Export Directory</span>
          </button>

          {exportMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-stone-200 z-30 py-2 text-xs">
              <p className="px-3 py-1 font-bold text-[10px] uppercase text-stone-400 tracking-wider">Standard Formats</p>
              <button
                type="button"
                onClick={() => handleExport('csv')}
                className="w-full text-left px-3 py-2 hover:bg-amber-50 flex items-center gap-2 text-stone-800"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Consent-Aware CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport('xlsx')}
                className="w-full text-left px-3 py-2 hover:bg-amber-50 flex items-center gap-2 text-stone-800"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Excel Spreadsheet (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport('pdf')}
                className="w-full text-left px-3 py-2 hover:bg-amber-50 flex items-center gap-2 text-stone-800"
              >
                <FileText className="w-4 h-4 text-red-600" />
                <span>Printable PDF Report</span>
              </button>

              <div className="my-1 border-t border-stone-100" />
              <p className="px-3 py-1 font-bold text-[10px] uppercase text-stone-400 tracking-wider">Targeted Consent Lists</p>
              <button
                type="button"
                onClick={() => handleExport('phone_list')}
                className="w-full text-left px-3 py-2 hover:bg-amber-50 flex items-center gap-2 text-stone-800"
              >
                <PhoneCall className="w-4 h-4 text-blue-600" />
                <span>Telemarketing Phone List</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport('whatsapp_list')}
                className="w-full text-left px-3 py-2 hover:bg-amber-50 flex items-center gap-2 text-stone-800"
              >
                <MessageSquare className="w-4 h-4 text-emerald-500" />
                <span>WhatsApp Broadcast List</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport('email_list')}
                className="w-full text-left px-3 py-2 hover:bg-amber-50 flex items-center gap-2 text-stone-800"
              >
                <Mail className="w-4 h-4 text-indigo-600" />
                <span>Email Newsletter List</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Summary Cards (Global Overview) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Total Customer Directory</p>
          <p className="font-serif text-xl font-bold text-[#2A211C] mt-1">{summaryMetrics.totalCustomers.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Repeat Customers</p>
          <p className="font-serif text-xl font-bold text-amber-800 mt-1">{summaryMetrics.repeatCustomers.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Total Customer LTV</p>
          <p className="font-serif text-xl font-bold text-emerald-800 mt-1">₹{summaryMetrics.totalLifetimeRevenue.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Avg Customer Value (AOV)</p>
          <p className="font-serif text-xl font-bold text-[#B08D57] mt-1">₹{summaryMetrics.averageCustomerValue.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. DIRECTORY VIEW                                                         */}
      {/* ========================================================================= */}
      {activeMainTab === 'directory' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm space-y-3">
            <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search customers by name, phone, email, city, state..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-[#B08D57]"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={tierFilter}
                  onChange={e => { setTierFilter(e.target.value); setPage(1); }}
                  className="py-2 px-3 border border-stone-200 rounded-lg text-xs bg-white focus:outline-none focus:border-[#B08D57]"
                >
                  <option value="">All Tiers</option>
                  <option value="VIP">VIP Tier</option>
                  <option value="Gold">Gold Tier</option>
                  <option value="Silver">Silver Tier</option>
                  <option value="Bronze">Bronze Tier</option>
                  <option value="Standard">Standard Tier</option>
                </select>

                <select
                  value={consentFilter}
                  onChange={e => { setConsentFilter(e.target.value); setPage(1); }}
                  className="py-2 px-3 border border-stone-200 rounded-lg text-xs bg-white focus:outline-none focus:border-[#B08D57]"
                >
                  <option value="">All Marketing Consent</option>
                  <option value="whatsapp">WhatsApp Consent</option>
                  <option value="email">Email Consent</option>
                  <option value="sms">SMS Consent</option>
                  <option value="voice">Phone Call Consent</option>
                </select>

                <button
                  type="submit"
                  className="px-4 py-2 bg-[#B08D57] text-white rounded-lg text-xs font-bold hover:bg-[#A04D2E]"
                >
                  Search
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMigrationModalOpen(true);
                    setMigrationError(null);
                    setMigrationSuccessMsg(null);
                    setMigrationDryRunResult(null);
                  }}
                  className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border border-stone-300"
                  title="Admin Utility: Assign missing business Customer IDs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#B08D57]" />
                  <span>Assign Customer IDs</span>
                </button>
              </div>
            </form>
          </div>

          {unmaskError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{unmaskError}</span>
              </div>
              <button
                type="button"
                onClick={() => setUnmaskError(null)}
                className="text-red-400 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Main Directory Table */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-stone-500 text-xs">
                <Loader2 className="w-5 h-5 animate-spin text-[#B08D57]" />
                <span>Loading customer records...</span>
              </div>
            ) : errorMsg ? (
              <div className="p-6 text-center text-red-600 text-xs">{errorMsg}</div>
            ) : customers.length === 0 ? (
              <div className="p-12 text-center text-stone-500 text-xs">
                <Users className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="font-bold">No customer records match your filter criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase text-[10px] font-bold tracking-wider">
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Contact Info</th>
                      <th className="py-3 px-4">Primary Location</th>
                      <th className="py-3 px-4 text-center">Orders</th>
                      <th className="py-3 px-4 text-right">Lifetime Spend</th>
                      <th className="py-3 px-4 text-center">Health</th>
                      <th className="py-3 px-4 text-center">Consent</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {customers.map((c: any) => {
                      const isUnmasked = Boolean(unmaskedData[c.id]);
                      const isLoadingUnmask = Boolean(unmaskLoading[c.id]);
                      const m = c.marketing_preferences || {};
                      const healthStatus = c.health_status || 'active';

                      return (
                        <tr key={c.id} className="hover:bg-amber-50/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <p className="font-bold text-[#2A211C]">{c.full_name || 'Valued Customer'}</p>
                              {(c.customer_type?.toString().toLowerCase() === 'business' || Boolean(c.gstin)) ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded text-[9px] font-bold">
                                  <Building2 className="w-2.5 h-2.5 text-emerald-700" />
                                  BUSINESS
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-stone-100 text-stone-600 border border-stone-200 rounded text-[9px] font-medium">
                                  INDIVIDUAL
                                </span>
                              )}
                            </div>
                            {c.business_name && (
                              <p className="text-[10px] text-emerald-800 font-semibold truncate max-w-[200px]">
                                🏢 {c.business_name}
                              </p>
                            )}
                            <p className="text-[10px] text-stone-500 font-mono font-semibold">
                              {c.customer_id ? `Customer ID: ${c.customer_id}` : 'Customer ID: Not assigned'}
                            </p>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center justify-between gap-2">
                              <div className="space-y-0.5">
                                <p className="font-mono text-stone-800">
                                  {isUnmasked ? unmaskedData[c.id].phone : (c.masked_phone || c.phone)}
                                </p>
                                <p className="text-stone-500 text-[11px]">
                                  {isUnmasked ? unmaskedData[c.id].email : (c.masked_email || c.email)}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={isLoadingUnmask}
                                onClick={() => handleToggleUnmask(c.id)}
                                className="p-1 text-stone-400 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded disabled:opacity-50 transition-colors"
                                aria-label={isUnmasked ? 'Hide contact details' : 'Show contact details'}
                                title={isUnmasked ? 'Hide contact details' : 'Show contact details'}
                              >
                                {isLoadingUnmask ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B08D57]" />
                                ) : isUnmasked ? (
                                  <EyeOff className="w-3.5 h-3.5 text-[#B08D57]" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <p className="text-stone-800 font-medium">{c.primary_location?.city || 'N/A'}</p>
                            <p className="text-[10px] text-stone-400">{c.primary_location?.state || 'India'}</p>
                          </td>

                          <td className="py-3 px-4 text-center font-bold text-stone-800">
                            {c.commerce_summary?.completed_orders || c.commerce_summary?.total_orders || 0}
                          </td>

                          <td className="py-3 px-4 text-right font-bold text-[#B08D57]">
                            ₹{(c.commerce_summary?.total_spent || 0).toLocaleString('en-IN')}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              healthStatus === 'vip' ? 'bg-purple-100 text-purple-900 border border-purple-200' :
                              healthStatus === 'active' ? 'bg-emerald-100 text-emerald-800' :
                              healthStatus === 'at_risk' ? 'bg-amber-100 text-amber-900' :
                              healthStatus === 'dormant' ? 'bg-stone-200 text-stone-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {healthStatus.toUpperCase()}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span title={`Email Marketing: ${m.email_marketing_consent ? 'YES' : 'NO'}`}>
                                <Mail className={`w-3.5 h-3.5 ${m.email_marketing_consent ? 'text-emerald-600' : 'text-stone-300'}`} />
                              </span>
                              <span title={`SMS Marketing: ${m.sms_marketing_consent ? 'YES' : 'NO'}`}>
                                <Phone className={`w-3.5 h-3.5 ${m.sms_marketing_consent ? 'text-emerald-600' : 'text-stone-300'}`} />
                              </span>
                              <span title={`WhatsApp: ${m.whatsapp_marketing_consent ? 'YES' : 'NO'}`}>
                                <MessageSquare className={`w-3.5 h-3.5 ${m.whatsapp_marketing_consent ? 'text-emerald-600' : 'text-stone-300'}`} />
                              </span>
                              <span title={`Voice Call: ${m.voice_call_consent ? 'YES' : 'NO'}`}>
                                <PhoneCall className={`w-3.5 h-3.5 ${m.voice_call_consent ? 'text-emerald-600' : 'text-stone-300'}`} />
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(c.id)}
                              className="px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded font-bold text-[11px] transition-colors"
                            >
                              Inspect CRM
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Footer */}
            <div className="p-4 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500 bg-stone-50">
              <span>
                Showing Page {page} ({customers.length} customer records)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || isLoading}
                  onClick={() => {
                    const newPage = page - 1;
                    const prevCursor = cursorStack[newPage - 1] || null;
                    setPage(newPage);
                    setCurrentCursor(prevCursor);
                  }}
                  className="p-1.5 border border-stone-200 rounded disabled:opacity-40 hover:bg-white flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
                <span className="font-bold text-stone-800">Page {page}</span>
                <button
                  type="button"
                  disabled={!hasMore || isLoading}
                  onClick={() => {
                    const newPage = page + 1;
                    setCursorStack(prev => [...prev, nextCursor]);
                    setPage(newPage);
                    setCurrentCursor(nextCursor);
                  }}
                  className="p-1.5 border border-stone-200 rounded disabled:opacity-40 hover:bg-white flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SEGMENTS VIEW                                                          */}
      {/* ========================================================================= */}
      {activeMainTab === 'segments' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
            <div>
              <h3 className="font-serif text-lg font-bold text-[#2A211C]">Customer Segments & Retention Cohorts</h3>
              <p className="text-xs text-stone-500">Automated built-in cohorts and custom saved retention segments.</p>
            </div>
            <button
              type="button"
              onClick={() => setCreateSegmentModalOpen(true)}
              className="px-4 py-2 bg-[#B08D57] text-white rounded-lg text-xs font-bold hover:bg-[#A04D2E] flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Custom Segment</span>
            </button>
          </div>

          {isSegmentsLoading ? (
            <div className="py-12 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#B08D57]" />
              <span>Loading customer segments...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {segmentsList.map((seg: any) => (
                <div key={seg.id} className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex flex-col justify-between hover:border-amber-300 transition-colors">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        seg.is_system ? 'bg-stone-100 text-stone-700' : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        {seg.is_system ? 'System Cohort' : 'Custom Saved'}
                      </span>
                      <Layers className="w-4 h-4 text-stone-400" />
                    </div>
                    <h4 className="font-bold text-sm text-[#2A211C] mt-2">{seg.name}</h4>
                    <p className="text-xs text-stone-500 mt-1 leading-relaxed">{seg.description}</p>
                  </div>

                  <div className="pt-4 border-t border-stone-100 mt-4 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-stone-400">ID: {seg.id}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSegmentFilter(seg.id);
                        setActiveMainTab('directory');
                      }}
                      className="px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded font-bold text-xs"
                    >
                      View Segment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CRM ANALYTICS DASHBOARD VIEW                                           */}
      {/* ========================================================================= */}
      {activeMainTab === 'analytics' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
            <div>
              <h3 className="font-serif text-lg font-bold text-[#2A211C]">Retention & Customer Health Intelligence</h3>
              <p className="text-xs text-stone-500">Automated health scores, RFM distributions, and bulk maintenance utilities.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isBatchRunning}
                onClick={handleRunBatchHealth}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-bold flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isBatchRunning ? 'animate-spin' : ''}`} />
                <span>Recalculate Batch Health</span>
              </button>
              <button
                type="button"
                disabled={isBatchRunning}
                onClick={handleRunBackfillTimeline}
                className="px-3 py-2 bg-stone-800 text-white rounded-lg text-xs font-bold hover:bg-stone-900 flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Backfill Activity Timeline</span>
              </button>
            </div>
          </div>

          {batchActionStatus && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-medium">
              {batchActionStatus}
            </div>
          )}

          {isAnalyticsLoading ? (
            <div className="py-12 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#B08D57]" />
              <span>Calculating CRM analytics...</span>
            </div>
          ) : analyticsData ? (
            <div className="space-y-6">
              {/* Health Score Breakdown Cards */}
              <div>
                <p className="font-bold text-xs uppercase text-stone-400 tracking-wider mb-3">Customer Health Distribution</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/30">
                    <p className="text-[10px] font-bold uppercase text-purple-700">VIP Champions</p>
                    <p className="font-serif text-xl font-bold text-purple-900 mt-1">{analyticsData.healthBreakdown?.vip || 0}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30">
                    <p className="text-[10px] font-bold uppercase text-emerald-700">Active / Healthy</p>
                    <p className="font-serif text-xl font-bold text-emerald-900 mt-1">{analyticsData.healthBreakdown?.active || 0}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/30">
                    <p className="text-[10px] font-bold uppercase text-amber-700">At-Risk</p>
                    <p className="font-serif text-xl font-bold text-amber-900 mt-1">{analyticsData.healthBreakdown?.at_risk || 0}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-stone-200 bg-stone-50">
                    <p className="text-[10px] font-bold uppercase text-stone-500">Dormant</p>
                    <p className="font-serif text-xl font-bold text-stone-800 mt-1">{analyticsData.healthBreakdown?.dormant || 0}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50/30">
                    <p className="text-[10px] font-bold uppercase text-red-700">Churned</p>
                    <p className="font-serif text-xl font-bold text-red-900 mt-1">{analyticsData.healthBreakdown?.churned || 0}</p>
                  </div>
                </div>
              </div>

              {/* Marketing Opt-In Rates & RFM */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-3">
                  <h4 className="font-bold text-sm text-[#2A211C] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Marketing Channel Consent Opt-In Rates</span>
                  </h4>
                  <div className="space-y-3 text-xs pt-1">
                    <div>
                      <div className="flex justify-between font-medium text-stone-700 mb-1">
                        <span>WhatsApp Consent</span>
                        <span className="font-bold">{analyticsData.consentRates?.whatsappPct || 0}%</span>
                      </div>
                      <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${analyticsData.consentRates?.whatsappPct || 0}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between font-medium text-stone-700 mb-1">
                        <span>Email Consent</span>
                        <span className="font-bold">{analyticsData.consentRates?.emailPct || 0}%</span>
                      </div>
                      <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${analyticsData.consentRates?.emailPct || 0}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between font-medium text-stone-700 mb-1">
                        <span>SMS Consent</span>
                        <span className="font-bold">{analyticsData.consentRates?.smsPct || 0}%</span>
                      </div>
                      <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${analyticsData.consentRates?.smsPct || 0}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-3">
                  <h4 className="font-bold text-sm text-[#2A211C] flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#B08D57]" />
                    <span>Repeat Purchase & Retention Rate</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                      <p className="text-[10px] font-bold text-stone-400 uppercase">Repeat Customer Rate</p>
                      <p className="font-serif text-2xl font-bold text-[#B08D57] mt-1">{analyticsData.repeatRatePct || 0}%</p>
                    </div>
                    <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                      <p className="text-[10px] font-bold text-stone-400 uppercase">Average LTV per Account</p>
                      <p className="font-serif text-2xl font-bold text-emerald-800 mt-1">₹{(analyticsData.avgLtv || 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CUSTOMER DETAIL DRAWER SLIDE-OVER                                         */}
      {/* ========================================================================= */}
      {selectedCustomerId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-3xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-stone-200 bg-[#FAF7F2] flex items-center justify-between sticky top-0 z-10">
              <div>
                <h3 className="font-serif text-xl font-bold text-[#2A211C]">
                  {customerDetail?.profile?.full_name || 'Customer Profile'}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-stone-700 font-mono font-semibold">
                    Customer ID: <span className="font-bold text-stone-900">{customerDetail?.profile?.customer_id || 'Not assigned'}</span>
                  </p>
                  {customerDetail?.profile?.customer_id && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(customerDetail.profile.customer_id);
                        setCopiedId(true);
                        setTimeout(() => setCopiedId(false), 2000);
                      }}
                      className="p-1 text-stone-400 hover:text-stone-700 rounded transition-colors"
                      title="Copy Customer ID"
                      aria-label="Copy Customer ID"
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleRepairProfile(customerDetail?.profile?.normalized_phone, customerDetail?.profile?.id)}
                  disabled={isRepairingProfile}
                  className="px-3 py-1.5 bg-[#B08D57] text-white hover:bg-[#A04D2E] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
                  title="Rescan and repair GST details, separate billing address, and order linking"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRepairingProfile ? 'animate-spin' : ''}`} />
                  <span>{isRepairingProfile ? 'Repairing...' : 'Repair GST & Orders'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedCustomerId(null); setCopiedId(false); }}
                  className="p-1 text-stone-400 hover:text-stone-700 rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Drawer Navigation Tabs */}
            <div className="flex border-b border-stone-200 bg-stone-50 text-xs font-bold">
              <button
                type="button"
                onClick={() => setDrawerTab('profile')}
                className={`px-4 py-3 transition-colors border-b-2 flex items-center gap-1.5 ${
                  drawerTab === 'profile' ? 'border-[#B08D57] text-[#B08D57] bg-white' : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Profile & Commerce</span>
              </button>
              <button
                type="button"
                onClick={() => { setDrawerTab('timeline'); fetchTimeline(selectedCustomerId, timelineCategory); }}
                className={`px-4 py-3 transition-colors border-b-2 flex items-center gap-1.5 ${
                  drawerTab === 'timeline' ? 'border-[#B08D57] text-[#B08D57] bg-white' : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Activity Timeline</span>
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('health')}
                className={`px-4 py-3 transition-colors border-b-2 flex items-center gap-1.5 ${
                  drawerTab === 'health' ? 'border-[#B08D57] text-[#B08D57] bg-white' : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <HeartPulse className="w-3.5 h-3.5 text-red-500" />
                <span>Health & VIP Suggestions</span>
              </button>
              <button
                type="button"
                onClick={() => { setDrawerTab('notes'); fetchNotes(selectedCustomerId); }}
                className={`px-4 py-3 transition-colors border-b-2 flex items-center gap-1.5 ${
                  drawerTab === 'notes' ? 'border-[#B08D57] text-[#B08D57] bg-white' : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
                <span>Service Notes ({notesList.length})</span>
              </button>
              <button
                type="button"
                onClick={() => { setDrawerTab('loyalty'); if (selectedCustomerId) fetchLoyaltyData(selectedCustomerId); }}
                className={`px-4 py-3 transition-colors border-b-2 flex items-center gap-1.5 ${
                  drawerTab === 'loyalty' ? 'border-[#B08D57] text-[#B08D57] bg-white' : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-amber-600" />
                <span>Loyalty & Store Credit</span>
              </button>
              <button
                type="button"
                onClick={() => { setDrawerTab('security'); if (selectedCustomerId) fetchSecurityEvents(selectedCustomerId); }}
                className={`px-4 py-3 transition-colors border-b-2 flex items-center gap-1.5 ${
                  drawerTab === 'security' ? 'border-[#B08D57] text-[#B08D57] bg-white' : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Security & Sessions</span>
              </button>
            </div>

            {/* Drawer Body */}
            {isDetailLoading ? (
              <div className="flex items-center justify-center py-20 gap-2 text-xs text-stone-500">
                <Loader2 className="w-5 h-5 animate-spin text-[#B08D57]" />
                <span>Fetching customer profile and order history...</span>
              </div>
            ) : customerDetail ? (
              <div className="p-6 space-y-6 flex-1 text-xs font-sans">
                
                {saveSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg">
                    {saveSuccessMsg}
                  </div>
                )}

                {/* VIP Candidate Banner */}
                {customerDetail.profile?.vip_candidate && (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-[#2A211C]">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span>Recommended VIP Promotion</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleVipSuggestionAction('accept')}
                          className="px-3 py-1 bg-purple-700 text-white rounded text-xs font-bold hover:bg-purple-800"
                        >
                          Promote to VIP
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVipSuggestionAction('dismiss')}
                          className="px-3 py-1 bg-white border border-purple-200 text-purple-900 rounded text-xs font-bold hover:bg-purple-100"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-purple-800 leading-relaxed">
                      {customerDetail.profile?.vip_reason || 'Customer has reached high spend/order milestones.'}
                    </p>
                  </div>
                )}

                {/* Possible Duplicates Warning */}
                {customerDetail.possible_duplicates && customerDetail.possible_duplicates.length > 0 && (
                  <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 font-bold text-xs text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Possible Duplicate Customer Profiles ({customerDetail.possible_duplicates.length})</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      The system detected potential duplicate profiles sharing verified contact details or primary location. Automatic merges are strictly disabled.
                    </p>
                    <div className="space-y-1.5 pt-1">
                      {customerDetail.possible_duplicates.map((dup: any) => (
                        <div key={dup.id} className="p-2.5 bg-white rounded-lg border border-amber-200 text-[11px] flex items-center justify-between gap-2 shadow-2xs">
                          <div>
                            <p className="font-bold text-stone-800">{dup.full_name} • <span className="font-mono text-stone-600">{dup.phone}</span></p>
                            <p className="text-[10px] text-stone-500">{dup.email}</p>
                            <p className="text-[10px] text-amber-700 font-medium mt-0.5">Reason: {dup.reason}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenMergePreview(dup.id)}
                            className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded text-[10px] font-bold shrink-0 flex items-center gap-1"
                          >
                            <GitMerge className="w-3 h-3 text-amber-700" />
                            <span>Preview Merge</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* DRAWER TAB 1: PROFILE & COMMERCE */}
                {drawerTab === 'profile' && (
                  <div className="space-y-6">
                    {/* Customer Identity & Type Card */}
                    <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#B08D57]" />
                          <span className="font-bold text-[#2A211C] text-xs uppercase tracking-wider">Customer Identity & Type</span>
                        </div>
                        {(customerDetail.profile?.customer_type?.toString().toLowerCase() === 'business' || Boolean(customerDetail.profile?.gstin)) ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-[10px] font-bold">
                            <Building2 className="w-3 h-3 text-emerald-700" />
                            BUSINESS CUSTOMER
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 text-stone-700 border border-stone-200 rounded-full text-[10px] font-bold">
                            INDIVIDUAL CUSTOMER
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-stone-800">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-stone-400">Full Name</p>
                          <p className="font-bold text-[#2A211C] text-sm">{customerDetail.profile?.full_name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-stone-400">Customer ID</p>
                          <p className="font-mono font-bold text-stone-700">{customerDetail.profile?.customer_id || 'Not assigned'}</p>
                        </div>

                        {(customerDetail.profile?.customer_type?.toString().toLowerCase() === 'business' || Boolean(customerDetail.profile?.gstin) || Boolean(customerDetail.profile?.business_name)) && (
                          <>
                            <div>
                              <p className="text-[10px] uppercase font-bold text-stone-400">Company / Business Name</p>
                              <p className="font-bold text-emerald-900">{customerDetail.profile?.business_name || customerDetail.profile?.gst_details?.legal_name || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase font-bold text-stone-400">GSTIN Number</p>
                              <p className="font-mono font-bold text-emerald-800 tracking-wider">{customerDetail.profile?.gstin || 'N/A'}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* GST Information & Verification Card */}
                    {(customerDetail.profile?.gstin || customerDetail.profile?.gst_details) && (
                      <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-3">
                        <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-emerald-700" />
                            <span className="font-bold text-emerald-900 text-xs uppercase tracking-wider">GST Information & Verification</span>
                          </div>
                          {customerDetail.profile?.gst_details ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[9px] font-bold">
                              <Check className="w-3 h-3 text-emerald-600" />
                              Govt Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 text-stone-600 border border-stone-300 rounded text-[9px] font-semibold">
                              Self Declared
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-stone-800">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-stone-500">GSTIN</p>
                            <p className="font-mono font-bold text-emerald-900 tracking-wider">{customerDetail.profile?.gstin || customerDetail.profile?.gst_details?.gstin}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-stone-500">Legal Business Name</p>
                            <p className="font-bold text-stone-800">{customerDetail.profile?.gst_details?.legal_name || customerDetail.profile?.business_name || 'N/A'}</p>
                          </div>
                          {customerDetail.profile?.gst_details?.trade_name && (
                            <div>
                              <p className="text-[10px] uppercase font-bold text-stone-500">Trade Name</p>
                              <p className="font-semibold text-stone-700">{customerDetail.profile?.gst_details?.trade_name}</p>
                            </div>
                          )}
                          {customerDetail.profile?.gst_details?.taxpayer_type && (
                            <div>
                              <p className="text-[10px] uppercase font-bold text-stone-500">Taxpayer Type</p>
                              <p className="font-semibold text-stone-700">{customerDetail.profile?.gst_details?.taxpayer_type}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Commerce Metrics Summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-stone-400">Total Orders</p>
                        <p className="font-serif text-lg font-bold text-[#2A211C]">
                          {customerDetail.profile?.commerce_summary?.total_orders || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-stone-400">Total Spent</p>
                        <p className="font-serif text-lg font-bold text-[#B08D57]">
                          ₹{(customerDetail.profile?.commerce_summary?.total_spent || 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-stone-400">Avg Order Value</p>
                        <p className="font-serif text-lg font-bold text-amber-800">
                          ₹{(customerDetail.profile?.commerce_summary?.average_order_value || 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-stone-400">Returns</p>
                        <p className="font-serif text-lg font-bold text-stone-700">
                          {customerDetail.profile?.commerce_summary?.total_returns || 0}
                        </p>
                      </div>
                    </div>

                    {/* Contact Info & Marketing Preferences */}
                    <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-3">
                      <p className="font-bold text-[#B08D57] uppercase text-[10px] tracking-wider">Verified Contact & Consent Information</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-800 border-b border-amber-200/60 pb-3">
                        <p>Phone: <span className="font-mono font-bold">{customerDetail.profile?.phone}</span></p>
                        <p>Email: <span className="font-bold">{customerDetail.profile?.email || 'N/A'}</span></p>
                        <p>First Order: <span className="font-mono">{customerDetail.profile?.commerce_summary?.first_order_at ? new Date(customerDetail.profile?.commerce_summary?.first_order_at).toLocaleDateString('en-IN') : 'N/A'}</span></p>
                        <p>Last Order: <span className="font-mono">{customerDetail.profile?.commerce_summary?.last_order_at ? new Date(customerDetail.profile?.commerce_summary?.last_order_at).toLocaleDateString('en-IN') : 'N/A'}</span></p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${customerDetail.profile?.marketing_preferences?.email_marketing_consent ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-stone-100 border-stone-200 text-stone-400'}`}>
                          <Mail className="w-3.5 h-3.5" />
                          <span className="font-semibold">Email: {customerDetail.profile?.marketing_preferences?.email_marketing_consent ? 'Yes' : 'No'}</span>
                        </div>
                        <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${customerDetail.profile?.marketing_preferences?.sms_marketing_consent ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-stone-100 border-stone-200 text-stone-400'}`}>
                          <Phone className="w-3.5 h-3.5" />
                          <span className="font-semibold">SMS: {customerDetail.profile?.marketing_preferences?.sms_marketing_consent ? 'Yes' : 'No'}</span>
                        </div>
                        <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${customerDetail.profile?.marketing_preferences?.whatsapp_marketing_consent ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-stone-100 border-stone-200 text-stone-400'}`}>
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="font-semibold">WhatsApp: {customerDetail.profile?.marketing_preferences?.whatsapp_marketing_consent ? 'Yes' : 'No'}</span>
                        </div>
                        <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${customerDetail.profile?.marketing_preferences?.voice_call_consent ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-stone-100 border-stone-200 text-stone-400'}`}>
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span className="font-semibold">Voice: {customerDetail.profile?.marketing_preferences?.voice_call_consent ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Addresses Section (Default Shipping & Saved Billing Address) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Default Shipping Address */}
                      <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs space-y-2">
                        <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
                          <MapPin className="w-3.5 h-3.5 text-[#B08D57]" />
                          <span className="font-bold text-[#2A211C] text-xs uppercase tracking-wider">Default Shipping Address</span>
                        </div>
                        {(() => {
                          const shipAddr = (customerDetail.profile?.addresses && customerDetail.profile.addresses.length > 0)
                            ? (customerDetail.profile.addresses.find((a: any) => a.is_default) || customerDetail.profile.addresses[0])
                            : customerDetail.profile?.default_address;
                          if (!shipAddr || (!shipAddr.address_line_1 && !shipAddr.city)) {
                            return <p className="text-stone-400 text-xs italic">No saved shipping address.</p>;
                          }
                          return (
                            <div className="text-xs text-stone-700 space-y-0.5">
                              <p className="font-bold text-stone-900">{shipAddr.full_name || (shipAddr.first_name ? `${shipAddr.first_name || ''} ${shipAddr.last_name || ''}`.trim() : customerDetail.profile?.full_name)}</p>
                              <p>{shipAddr.address_line_1 || shipAddr.address}</p>
                              {shipAddr.address_line_2 && <p>{shipAddr.address_line_2}</p>}
                              <p>{shipAddr.city}, {shipAddr.state} - <span className="font-mono">{shipAddr.postal_code || shipAddr.pincode}</span></p>
                              <p className="text-[10px] text-stone-400">{shipAddr.country || 'India'}</p>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Saved Billing Address */}
                      <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs space-y-2">
                        <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-[#B08D57]" />
                            <span className="font-bold text-[#2A211C] text-xs uppercase tracking-wider">Saved Billing Address</span>
                          </div>
                          <span className="text-[10px] font-bold text-stone-500">
                            {customerDetail.profile?.billing_same_as_shipping === false || customerDetail.profile?.billing_address?.is_same_as_shipping === false
                              ? 'Separate Address'
                              : 'Same as Shipping'}
                          </span>
                        </div>
                        {(() => {
                          const bAddr = customerDetail.profile?.billing_address;
                          if (!bAddr || (!bAddr.address_line_1 && !bAddr.city)) {
                            return (
                              <p className="text-stone-500 text-xs italic">
                                Same as default shipping address.
                              </p>
                            );
                          }
                          return (
                            <div className="text-xs text-stone-700 space-y-0.5">
                              <p className="font-bold text-stone-900">
                                {`${bAddr.first_name || ''} ${bAddr.last_name || ''}`.trim() || customerDetail.profile?.full_name}
                              </p>
                              <p>{bAddr.address_line_1}</p>
                              {bAddr.address_line_2 && <p>{bAddr.address_line_2}</p>}
                              <p>{bAddr.city}, {bAddr.state} - <span className="font-mono">{bAddr.postal_code || bAddr.pincode}</span></p>
                              <p className="text-[10px] text-stone-400">{bAddr.country || 'India'}</p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Technical Details Collapsible */}
                    <details className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-stone-600 text-xs">
                      <summary className="cursor-pointer font-bold text-stone-700 hover:text-stone-900 select-none flex items-center justify-between">
                        <span>Technical Details</span>
                        <span className="text-[10px] text-stone-400 font-normal">(Internal System References)</span>
                      </summary>
                      <div className="mt-2 space-y-1 font-mono text-[11px] pt-2 border-t border-stone-200 text-stone-600">
                        <p><span className="text-stone-400">Firestore Document ID:</span> {selectedCustomerId}</p>
                        <p><span className="text-stone-400">Business Customer ID:</span> {customerDetail.profile?.customer_id || 'Not assigned'}</p>
                      </div>
                    </details>

                    {/* Admin Tier & Metadata Section */}
                    <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs space-y-3">
                      <p className="font-bold text-[#2A211C] uppercase text-[10px] tracking-wider">Admin Customer Tier & Metadata</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold uppercase text-[10px] text-stone-500">Tier Level</label>
                          <select
                            value={adminTier}
                            onChange={e => setAdminTier(e.target.value)}
                            className="w-full p-2 border border-stone-200 rounded text-xs bg-white mt-1"
                          >
                            <option value="Standard">Standard</option>
                            <option value="Bronze">Bronze</option>
                            <option value="Silver">Silver</option>
                            <option value="Gold">Gold</option>
                            <option value="VIP">VIP Tier</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-bold uppercase text-[10px] text-stone-500">Custom Admin Tags</label>
                          <div className="flex gap-2 mt-1">
                            <input
                              type="text"
                              placeholder="e.g. High Return Risk"
                              value={newTagInput}
                              onChange={e => setNewTagInput(e.target.value)}
                              className="flex-1 p-2 border border-stone-200 rounded text-xs"
                            />
                            <button
                              type="button"
                              onClick={handleAddTag}
                              className="px-3 py-1 bg-stone-800 text-white rounded text-xs font-bold"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>

                      {adminTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {adminTags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-[10px] flex items-center gap-1">
                              {tag}
                              <X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveTag(tag)} />
                            </span>
                          ))}
                        </div>
                      )}

                      <div>
                        <label className="font-bold uppercase text-[10px] text-stone-500">Internal Admin Notes (Private)</label>
                        <textarea
                          rows={3}
                          value={adminNotes}
                          onChange={e => setAdminNotes(e.target.value)}
                          placeholder="Enter private notes visible only to store staff..."
                          className="w-full p-2.5 border border-stone-200 rounded text-xs mt-1"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveAdminMetadata}
                        disabled={isSavingMetadata}
                        className="px-4 py-2 bg-[#B08D57] text-white rounded text-xs font-bold hover:bg-[#A04D2E] flex items-center gap-2"
                      >
                        {isSavingMetadata ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>Save Internal Metadata</span>
                      </button>
                    </div>

                    {/* Order History */}
                    <div className="space-y-2">
                      <h4 className="font-bold text-[#2A211C] uppercase text-[11px]">
                        Order Snapshot History ({(customerDetail.orders || []).length})
                      </h4>
                      <div className="space-y-2">
                        {(customerDetail.orders || []).map((o: any) => (
                          <div key={o.order_id || o.id} className="p-3 bg-stone-50 border border-stone-200 rounded-lg flex items-center justify-between">
                            <div>
                              <p className="font-bold text-[#2A211C]">Order #{o.order_id || o.id}</p>
                              <p className="text-[10px] text-stone-500">{new Date(o.created_at).toLocaleDateString('en-IN')}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-[#B08D57]">₹{(o.total || 0).toLocaleString('en-IN')}</p>
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                                {o.status || 'Paid'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* DRAWER TAB 2: ACTIVITY TIMELINE */}
                {drawerTab === 'timeline' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-[#2A211C] uppercase text-[11px]">Customer Activity Event Timeline</h4>
                      <select
                        value={timelineCategory}
                        onChange={e => {
                          setTimelineCategory(e.target.value);
                          fetchTimeline(selectedCustomerId, e.target.value);
                        }}
                        className="py-1 px-2.5 border border-stone-200 rounded text-xs bg-white"
                      >
                        <option value="all">All Events</option>
                        <option value="orders">Orders</option>
                        <option value="payments">Payments</option>
                        <option value="shipping">Shipping</option>
                        <option value="returns">Returns</option>
                        <option value="addresses">Addresses</option>
                        <option value="marketing">Marketing Preferences</option>
                        <option value="admin">Admin Actions</option>
                      </select>
                    </div>

                    {isTimelineLoading ? (
                      <div className="py-12 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#B08D57]" />
                        <span>Loading timeline events...</span>
                      </div>
                    ) : timelineEvents.length === 0 ? (
                      <div className="p-8 text-center text-stone-400 text-xs">No activity events recorded in this category.</div>
                    ) : (
                      <div className="relative border-l-2 border-stone-200 ml-3 pl-4 space-y-4 py-2">
                        {timelineEvents.map((evt: any) => (
                          <div key={evt.id} className="relative group">
                            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#B08D57] border-2 border-white" />
                            <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-stone-800">{evt.title}</span>
                                <span className="text-[10px] text-stone-400 font-mono">
                                  {new Date(evt.occurred_at).toLocaleString('en-IN')}
                                </span>
                              </div>
                              <p className="text-stone-600 text-[11px]">{evt.description}</p>
                              {evt.source && (
                                <span className="inline-block px-2 py-0.5 bg-stone-200 text-stone-700 rounded text-[9px] font-mono uppercase">
                                  Source: {evt.source}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* DRAWER TAB 3: HEALTH & VIP SUGGESTIONS */}
                {drawerTab === 'health' && (
                  <div className="space-y-6">
                    <div className="p-5 bg-white rounded-xl border border-stone-200 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-[#2A211C] text-sm">Customer Retention & Health Score</h4>
                          <p className="text-xs text-stone-500">v1.0 Rules Engine Score & Risk Diagnostic</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleRecalculateHealth}
                          disabled={isRecalculatingHealth}
                          className="px-3 py-1.5 bg-[#B08D57] text-white rounded text-xs font-bold hover:bg-[#A04D2E] flex items-center gap-1.5"
                        >
                          {isRecalculatingHealth ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          <span>Recalculate Score</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-lg border border-stone-200">
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-stone-400 uppercase">Health Score</p>
                          <p className="font-serif text-3xl font-bold text-[#B08D57] mt-1">
                            {customerDetail.profile?.health_score ?? 80}/100
                          </p>
                        </div>
                        <div className="h-10 w-px bg-stone-200" />
                        <div>
                          <p className="text-[10px] font-bold text-stone-400 uppercase">Health Status</p>
                          <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold uppercase mt-1 bg-emerald-100 text-emerald-800">
                            {customerDetail.profile?.health_status || 'ACTIVE'}
                          </span>
                        </div>
                      </div>

                      {/* Suggested Tags Actions */}
                      {customerDetail.profile?.suggested_tags && customerDetail.profile?.suggested_tags.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <p className="font-bold text-[10px] text-stone-400 uppercase">System Suggested Tags</p>
                          <div className="flex flex-wrap gap-2">
                            {customerDetail.profile?.suggested_tags.map((st: string) => (
                              <div key={st} className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-center gap-2 text-xs font-medium">
                                <span>{st}</span>
                                <button
                                  type="button"
                                  onClick={() => handleSuggestedTagAction(st, 'accept')}
                                  className="p-0.5 text-emerald-700 hover:text-emerald-900"
                                  title="Accept tag"
                                >
                                  <Check className="w-3.5 h-3.5 font-bold" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSuggestedTagAction(st, 'dismiss')}
                                  className="p-0.5 text-red-600 hover:text-red-800"
                                  title="Dismiss tag"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* DRAWER TAB 4: SERVICE NOTES */}
                {drawerTab === 'notes' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                      <p className="font-bold text-xs text-[#2A211C] uppercase">Add Customer Service Note</p>
                      <div className="flex gap-2">
                        <select
                          value={newNoteType}
                          onChange={e => setNewNoteType(e.target.value)}
                          className="p-2 border border-stone-200 rounded text-xs bg-white font-medium"
                        >
                          <option value="general">General Note</option>
                          <option value="order_issue">Order Issue</option>
                          <option value="return_query">Return Query</option>
                          <option value="vip_request">VIP Special Request</option>
                          <option value="complaint">Customer Complaint</option>
                          <option value="feedback">Product Feedback</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Type service note details..."
                          value={newNoteText}
                          onChange={e => setNewNoteText(e.target.value)}
                          className="flex-1 p-2 border border-stone-200 rounded text-xs"
                        />
                        <button
                          type="button"
                          disabled={isAddingNote || !newNoteText.trim()}
                          onClick={handleAddNote}
                          className="px-4 py-2 bg-[#B08D57] text-white rounded text-xs font-bold hover:bg-[#A04D2E] disabled:opacity-40"
                        >
                          {isAddingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Note'}
                        </button>
                      </div>
                    </div>

                    {isNotesLoading ? (
                      <div className="py-12 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#B08D57]" />
                        <span>Loading service notes...</span>
                      </div>
                    ) : notesList.length === 0 ? (
                      <div className="p-8 text-center text-stone-400 text-xs">No customer service notes recorded yet.</div>
                    ) : (
                      <div className="space-y-3">
                        {notesList.map((n: any) => (
                          <div key={n.id} className="p-3.5 bg-white rounded-lg border border-stone-200 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 bg-stone-100 text-stone-800 font-bold rounded text-[10px] uppercase">
                                {n.note_type || 'general'}
                              </span>
                              <span className="text-[10px] text-stone-400 font-mono">
                                {n.created_by} • {new Date(n.created_at).toLocaleString('en-IN')}
                              </span>
                            </div>
                            <p className="text-stone-700 text-xs mt-1 leading-relaxed">{n.note}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 5: LOYALTY & STORE CREDIT */}
                {drawerTab === 'loyalty' && (
                  <div className="space-y-6">
                    {adjErrorMsg && (
                      <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <span>{adjErrorMsg}</span>
                      </div>
                    )}

                    {adjSuccessMsg && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{adjSuccessMsg}</span>
                      </div>
                    )}

                    {isLoyaltyLoading ? (
                      <div className="py-12 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-[#B08D57]" />
                        <span>Loading loyalty ledger & store credit account...</span>
                      </div>
                    ) : loyaltyDetail ? (
                      <div className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl">
                            <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Available Points</p>
                            <p className="font-mono text-xl font-bold text-amber-900 mt-1">
                              {loyaltyDetail.loyalty_summary?.available_points || 0}
                            </p>
                            <p className="text-[10px] text-amber-700 mt-0.5">Worth ₹{loyaltyDetail.loyalty_summary?.available_points || 0}</p>
                          </div>

                          <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl">
                            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Pending Points</p>
                            <p className="font-mono text-xl font-bold text-stone-800 mt-1">
                              {loyaltyDetail.loyalty_summary?.pending_points || 0}
                            </p>
                            <p className="text-[10px] text-stone-500 mt-0.5">Unlocks 14d post-delivery</p>
                          </div>

                          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                            <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Store Credit</p>
                            <p className="font-mono text-xl font-bold text-emerald-900 mt-1">
                              ₹{loyaltyDetail.store_credit_summary?.available_balance_rupees || 0}
                            </p>
                            <p className="text-[10px] text-emerald-700 mt-0.5">Active Balance</p>
                          </div>

                          <div className="p-3.5 bg-purple-50/60 border border-purple-200 rounded-xl">
                            <p className="text-[10px] font-bold text-purple-800 uppercase tracking-wider">Loyalty Tier</p>
                            <p className="font-serif text-lg font-bold text-purple-900 mt-1">
                              {loyaltyDetail.loyalty_summary?.current_tier || 'MEMBER'}
                            </p>
                            <p className="text-[10px] text-purple-700 mt-0.5">
                              Spent ₹{(loyaltyDetail.loyalty_summary?.tier_progress?.rolling_12m_spend_rupees || 0).toLocaleString('en-IN')} (12m)
                            </p>
                          </div>
                        </div>

                        {/* Admin Manual Adjustments Form */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Points Adjustment Form */}
                          <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                            <h4 className="font-bold text-stone-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                              <Award className="w-4 h-4 text-amber-600" />
                              <span>Manual Points Adjustment</span>
                            </h4>
                            <form onSubmit={handlePointsAdjustment} className="space-y-2 text-xs">
                              <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase">Points (+ or -)</label>
                                <input
                                  type="number"
                                  required
                                  placeholder="e.g. 500 or -200"
                                  value={ptsAdjAmount}
                                  onChange={e => setPtsAdjAmount(e.target.value)}
                                  className="w-full p-2 bg-white border border-stone-200 rounded mt-1 font-mono"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase">Audit Reason</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. Compensation for shipping delay"
                                  value={ptsAdjReason}
                                  onChange={e => setPtsAdjReason(e.target.value)}
                                  className="w-full p-2 bg-white border border-stone-200 rounded mt-1"
                                />
                              </div>
                              <button
                                type="submit"
                                disabled={isSubmittingAdj || !ptsAdjAmount || !ptsAdjReason.trim()}
                                className="w-full py-2 bg-[#B08D57] text-white font-bold rounded hover:bg-[#A04D2E] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                              >
                                {isSubmittingAdj ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply Points Adjustment'}
                              </button>
                            </form>
                          </div>

                          {/* Store Credit Adjustment Form */}
                          <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                            <h4 className="font-bold text-stone-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                              <CreditCard className="w-4 h-4 text-emerald-600" />
                              <span>Issue / Adjust Store Credit</span>
                            </h4>
                            <form onSubmit={handleCreditAdjustment} className="space-y-2 text-xs">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] font-bold text-stone-500 uppercase">Amount ₹ (+ or -)</label>
                                  <input
                                    type="number"
                                    required
                                    placeholder="e.g. 1000"
                                    value={creditAdjAmount}
                                    onChange={e => setCreditAdjAmount(e.target.value)}
                                    className="w-full p-2 bg-white border border-stone-200 rounded mt-1 font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-stone-500 uppercase">Expiry Date (Opt)</label>
                                  <input
                                    type="date"
                                    value={creditAdjExpiry}
                                    onChange={e => setCreditAdjExpiry(e.target.value)}
                                    className="w-full p-2 bg-white border border-stone-200 rounded mt-1"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase">Audit Reason</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. Goodwill credit for damaged box"
                                  value={creditAdjReason}
                                  onChange={e => setCreditAdjReason(e.target.value)}
                                  className="w-full p-2 bg-white border border-stone-200 rounded mt-1"
                                />
                              </div>
                              <button
                                type="submit"
                                disabled={isSubmittingAdj || !creditAdjAmount || !creditAdjReason.trim()}
                                className="w-full py-2 bg-emerald-700 text-white font-bold rounded hover:bg-emerald-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                              >
                                {isSubmittingAdj ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Issue Store Credit'}
                              </button>
                            </form>
                          </div>
                        </div>

                        {/* Recent Loyalty Ledger */}
                        <div className="space-y-3">
                          <h4 className="font-bold text-stone-800 text-xs uppercase tracking-wider">Loyalty Ledger Entries ({loyaltyDetail.loyalty_ledger?.length || 0})</h4>
                          <div className="border border-stone-200 rounded-xl overflow-hidden bg-white">
                            <table className="w-full text-left border-collapse text-[11px]">
                              <thead>
                                <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase font-bold text-[10px]">
                                  <th className="p-2.5">Type</th>
                                  <th className="p-2.5">Points</th>
                                  <th className="p-2.5">Status</th>
                                  <th className="p-2.5">Description</th>
                                  <th className="p-2.5">Date</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-100">
                                {(loyaltyDetail.loyalty_ledger || []).length === 0 ? (
                                  <tr>
                                    <td colSpan={5} className="p-4 text-center text-stone-400">No loyalty ledger entries.</td>
                                  </tr>
                                ) : (
                                  loyaltyDetail.loyalty_ledger.map((entry: any) => (
                                    <tr key={entry.id}>
                                      <td className="p-2.5 font-bold uppercase text-stone-800">{entry.entry_type}</td>
                                      <td className={`p-2.5 font-mono font-bold ${entry.points > 0 ? 'text-emerald-700' : 'text-stone-700'}`}>
                                        {entry.points > 0 ? `+${entry.points}` : entry.points}
                                      </td>
                                      <td className="p-2.5">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                          entry.status === 'available' ? 'bg-emerald-100 text-emerald-800' :
                                          entry.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600'
                                        }`}>
                                          {entry.status}
                                        </span>
                                      </td>
                                      <td className="p-2.5 text-stone-600 max-w-xs truncate">{entry.description}</td>
                                      <td className="p-2.5 text-stone-400 font-mono">{entry.created_at ? new Date(entry.created_at).toLocaleDateString() : 'N/A'}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Store Credit Ledger */}
                        <div className="space-y-3">
                          <h4 className="font-bold text-stone-800 text-xs uppercase tracking-wider">Store Credit Ledger ({loyaltyDetail.store_credit_ledger?.length || 0})</h4>
                          <div className="border border-stone-200 rounded-xl overflow-hidden bg-white">
                            <table className="w-full text-left border-collapse text-[11px]">
                              <thead>
                                <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase font-bold text-[10px]">
                                  <th className="p-2.5">Type</th>
                                  <th className="p-2.5">Amount (₹)</th>
                                  <th className="p-2.5">Status</th>
                                  <th className="p-2.5">Description</th>
                                  <th className="p-2.5">Date</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-100">
                                {(loyaltyDetail.store_credit_ledger || []).length === 0 ? (
                                  <tr>
                                    <td colSpan={5} className="p-4 text-center text-stone-400">No store credit entries.</td>
                                  </tr>
                                ) : (
                                  loyaltyDetail.store_credit_ledger.map((entry: any) => (
                                    <tr key={entry.id}>
                                      <td className="p-2.5 font-bold uppercase text-stone-800">{entry.entry_type}</td>
                                      <td className={`p-2.5 font-mono font-bold ${entry.amount_paise > 0 ? 'text-emerald-700' : 'text-stone-700'}`}>
                                        {entry.amount_paise > 0 ? `+₹${Math.floor(entry.amount_paise / 100)}` : `₹${Math.floor(entry.amount_paise / 100)}`}
                                      </td>
                                      <td className="p-2.5">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                          entry.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'
                                        }`}>
                                          {entry.status}
                                        </span>
                                      </td>
                                      <td className="p-2.5 text-stone-600 max-w-xs truncate">{entry.description}</td>
                                      <td className="p-2.5 text-stone-400 font-mono">{entry.created_at ? new Date(entry.created_at).toLocaleDateString() : 'N/A'}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* TAB 6: SECURITY & SESSIONS */}
                {drawerTab === 'security' && (
                  <div className="space-y-6">
                    {isSecurityLoading ? (
                      <div className="py-12 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-[#B08D57]" />
                        <span>Loading customer security history & session activity...</span>
                      </div>
                    ) : securityError ? (
                      <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <span>{securityError}</span>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Security Summary Cards */}
                        {securitySummary && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                              <span className="text-[10px] uppercase font-bold text-stone-400">30-Day Logins</span>
                              <p className="text-xs font-bold text-stone-800">
                                <span className="text-emerald-700">{securitySummary.successfulLogins30d} Success</span>
                                {securitySummary.failedLogins30d > 0 && <span className="text-rose-700 ml-1">• {securitySummary.failedLogins30d} Fail</span>}
                              </p>
                            </div>
                            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                              <span className="text-[10px] uppercase font-bold text-stone-400">Active Sessions</span>
                              <p className="text-xs font-bold text-stone-800">{securitySummary.activeSessionsCount} active ({securitySummary.revokedSessionsCount} revoked)</p>
                            </div>
                            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                              <span className="text-[10px] uppercase font-bold text-stone-400">Flagged Events</span>
                              <p className="text-xs font-bold text-amber-800">{securitySummary.suspiciousEventCount} suspicious ({securitySummary.highRiskEventCount} high risk)</p>
                            </div>
                            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                              <span className="text-[10px] uppercase font-bold text-stone-400">Primary Auth</span>
                              <p className="text-xs font-bold text-stone-800 uppercase">{securitySummary.googleLoginCount >= securitySummary.mobileOtpLoginCount ? 'Google' : 'Mobile OTP'}</p>
                            </div>
                          </div>
                        )}

                        {/* Security Events Table */}
                        <div className="space-y-3">
                          <h4 className="font-bold text-stone-800 text-xs uppercase tracking-wider">
                            Security Event Timeline ({securityEvents.length})
                          </h4>
                          <div className="border border-stone-200 rounded-xl overflow-hidden bg-white">
                            <table className="w-full text-left border-collapse text-[11px]">
                              <thead>
                                <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase font-bold text-[10px]">
                                  <th className="p-2.5">Event</th>
                                  <th className="p-2.5">Outcome</th>
                                  <th className="p-2.5">Risk Level</th>
                                  <th className="p-2.5">Device & Environment</th>
                                  <th className="p-2.5">Masked IP</th>
                                  <th className="p-2.5">Timestamp</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-100">
                                {securityEvents.length === 0 ? (
                                  <tr>
                                    <td colSpan={6} className="p-4 text-center text-stone-400">No security events recorded for this customer.</td>
                                  </tr>
                                ) : (
                                  securityEvents.map((ev: any) => (
                                    <tr key={ev.event_id} className="hover:bg-stone-50/50 transition-colors">
                                      <td className="p-2.5 font-bold uppercase text-stone-800">{ev.event_type?.replace(/_/g, ' ')}</td>
                                      <td className="p-2.5">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                          ev.outcome === 'success' ? 'bg-emerald-100 text-emerald-800' :
                                          ev.outcome === 'failed' || ev.outcome === 'failure' ? 'bg-rose-100 text-rose-800' :
                                          'bg-amber-100 text-amber-800'
                                        }`}>
                                          {ev.outcome}
                                        </span>
                                      </td>
                                      <td className="p-2.5">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                          ev.risk_level === 'high' || ev.risk_level === 'critical' ? 'bg-rose-100 text-rose-800 font-extrabold' :
                                          ev.risk_level === 'medium' ? 'bg-amber-100 text-amber-800' :
                                          'bg-stone-100 text-stone-600'
                                        }`}>
                                          {ev.risk_level || 'low'}
                                        </span>
                                      </td>
                                      <td className="p-2.5 text-stone-700">{ev.device_name} ({ev.browser} on {ev.operating_system})</td>
                                      <td className="p-2.5 font-mono text-stone-600">{ev.ip_masked}</td>
                                      <td className="p-2.5 text-stone-400 font-mono">{ev.created_at ? new Date(ev.created_at).toLocaleString() : 'N/A'}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            ) : null}

            {/* Large Adjustment Confirmation Modal */}
            {largeAdjConfirmOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
                <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200">
                  <div className="flex items-center gap-2 text-[#2A211C]">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <h3 className="font-serif text-lg font-bold">Confirm Large Adjustment</h3>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    You are performing a high-value manual adjustment:
                    <strong className="block font-mono text-stone-900 mt-1">
                      {pendingAdjType === 'points' ? `${ptsAdjAmount} Points` : `₹${creditAdjAmount} Store Credit`}
                    </strong>
                    Reason: <em>"{pendingAdjType === 'points' ? ptsAdjReason : creditAdjReason}"</em>
                  </p>
                  <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded border border-amber-200">
                    This action will be permanently recorded in the immutable ledger and logged to the admin audit trail.
                  </p>
                  <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => setLargeAdjConfirmOpen(false)}
                      className="px-4 py-2 bg-stone-100 text-stone-700 rounded text-xs font-bold hover:bg-stone-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (pendingAdjType === 'points') executePointsAdjustment();
                        else if (pendingAdjType === 'credit') executeCreditAdjustment();
                      }}
                      className="px-4 py-2 bg-amber-600 text-white rounded text-xs font-bold hover:bg-amber-700"
                    >
                      Confirm Adjustment
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SAFE MERGE PREVIEW MODAL                                                  */}
      {/* ========================================================================= */}
      {mergePreviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-serif text-lg font-bold text-[#2A211C] flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-amber-600" />
                <span>Duplicate Merge Preview & Validation</span>
              </h3>
              <button
                type="button"
                onClick={() => setMergePreviewModalOpen(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isMergePreviewLoading ? (
              <div className="py-12 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#B08D57]" />
                <span>Generating safe merge preview...</span>
              </div>
            ) : mergePreviewData ? (
              <div className="space-y-4 text-xs font-sans">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] leading-relaxed">
                  <strong>Safety Constraint:</strong> Automatic merges are strictly prohibited. Review the combined profile attributes below before performing any manual reconciliation.
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                    <p className="font-bold text-stone-500 uppercase text-[10px]">Target Primary Profile</p>
                    <p className="font-bold text-stone-800 mt-1">{mergePreviewData.primary_id}</p>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                    <p className="font-bold text-stone-500 uppercase text-[10px]">Source Duplicate Profile</p>
                    <p className="font-bold text-stone-800 mt-1">{mergePreviewData.duplicate_id}</p>
                  </div>
                </div>

                <div className="p-4 bg-white rounded-lg border border-stone-200 space-y-2">
                  <p className="font-bold text-stone-800 uppercase text-[10px]">Combined Commerce Preview</p>
                  <p className="text-stone-600">Combined Order Count: <strong className="text-stone-900">{mergePreviewData.combined_order_count}</strong></p>
                  <p className="text-stone-600">Combined Total Revenue: <strong className="text-emerald-700">₹{(mergePreviewData.combined_revenue || 0).toLocaleString('en-IN')}</strong></p>
                  <p className="text-stone-600">Merged Address Count: <strong className="text-stone-900">{mergePreviewData.merged_addresses?.length || 0}</strong></p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setMergePreviewModalOpen(false)}
                    className="px-4 py-2 bg-stone-800 text-white rounded text-xs font-bold hover:bg-stone-900"
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE CUSTOM SEGMENT MODAL                                               */}
      {/* ========================================================================= */}
      {createSegmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-serif text-lg font-bold text-[#2A211C]">Create Custom Retention Segment</h3>
              <button
                type="button"
                onClick={() => setCreateSegmentModalOpen(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSegment} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 uppercase text-[10px]">Segment Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP High Frequency Buyers"
                  value={newSegName}
                  onChange={e => setNewSegName(e.target.value)}
                  className="w-full p-2 border border-stone-200 rounded mt-1"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 uppercase text-[10px]">Description</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Customers with >₹20k spend and active status"
                  value={newSegDesc}
                  onChange={e => setNewSegDesc(e.target.value)}
                  className="w-full p-2 border border-stone-200 rounded mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-stone-700 uppercase text-[10px]">Min Lifetime Spend (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 10000"
                    value={newSegMinSpend}
                    onChange={e => setNewSegMinSpend(e.target.value)}
                    className="w-full p-2 border border-stone-200 rounded mt-1"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 uppercase text-[10px]">Min Total Orders</label>
                  <input
                    type="number"
                    placeholder="e.g. 3"
                    value={newSegMinOrders}
                    onChange={e => setNewSegMinOrders(e.target.value)}
                    className="w-full p-2 border border-stone-200 rounded mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 uppercase text-[10px]">Health Status Filter</label>
                <select
                  value={newSegHealthStatus}
                  onChange={e => setNewSegHealthStatus(e.target.value)}
                  className="w-full p-2 border border-stone-200 rounded mt-1 bg-white"
                >
                  <option value="">Any Status</option>
                  <option value="active">Active</option>
                  <option value="vip">VIP</option>
                  <option value="at_risk">At Risk</option>
                  <option value="dormant">Dormant</option>
                  <option value="churned">Churned</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateSegmentModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 rounded font-bold hover:bg-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingSegment}
                  className="px-4 py-2 bg-[#B08D57] text-white rounded font-bold hover:bg-[#A04D2E] flex items-center gap-1.5"
                >
                  {isCreatingSegment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Segment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADMIN CUSTOMER ID MIGRATION UTILITY MODAL                                  */}
      {/* ========================================================================= */}
      {migrationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2 text-[#2A211C]">
                <ShieldCheck className="w-5 h-5 text-[#B08D57]" />
                <h3 className="font-serif text-lg font-bold">Assign Missing Customer IDs</h3>
              </div>
              <button
                type="button"
                onClick={() => setMigrationModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Assign sequential business Customer IDs (e.g. <span className="font-mono font-bold text-stone-800">SS-C000001</span>) to customer profiles that do not currently have one assigned.
            </p>

            {migrationError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{migrationError}</span>
              </div>
            )}

            {migrationSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{migrationSuccessMsg}</span>
              </div>
            )}

            {/* Step 1: Dry Run */}
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">Step 1: Dry Run Verification</span>
                <button
                  type="button"
                  disabled={isMigrating}
                  onClick={handleRunMigrationDryRun}
                  className="px-3 py-1.5 bg-[#B08D57] text-white rounded text-xs font-bold hover:bg-[#A04D2E] disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isMigrating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>Run Dry Run</span>
                </button>
              </div>

              {migrationDryRunResult && (
                <div className="mt-3 text-xs space-y-2 bg-white p-3 rounded-lg border border-stone-200">
                  <p className="font-bold text-stone-800">Dry Run Execution Summary:</p>
                  <div className="grid grid-cols-2 gap-2 text-stone-600 text-[11px]">
                    <div>Profiles Scanned: <span className="font-bold text-stone-900">{migrationDryRunResult.scanned}</span></div>
                    <div>Needing ID Assignment: <span className="font-bold text-[#B08D57]">{migrationDryRunResult.assigned}</span></div>
                    <div>Already Has ID: <span className="font-bold text-emerald-700">{migrationDryRunResult.alreadyHadId}</span></div>
                    <div>System Counter: <span className="font-bold text-stone-900">{migrationDryRunResult.currentCounter}</span></div>
                  </div>
                  {migrationDryRunResult.assignedIdsSample && migrationDryRunResult.assignedIdsSample.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-stone-100 text-[10px] font-mono text-stone-500">
                      Sample assigned IDs: {migrationDryRunResult.assignedIdsSample.map((s: any) => s.customerId).join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Confirmation & Execution */}
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">Step 2: Assign Customer IDs</span>
                <button
                  type="button"
                  disabled={isMigrating || !migrationDryRunResult}
                  onClick={() => setConfirmAssignModalOpen(true)}
                  className="px-4 py-2 bg-emerald-700 text-white rounded text-xs font-bold hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                >
                  Assign IDs Now
                </button>
              </div>
              {!migrationDryRunResult && (
                <p className="text-[11px] text-stone-500">Please run Step 1 (Dry Run) first before assigning Customer IDs.</p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setMigrationModalOpen(false)}
                className="px-4 py-2 bg-stone-100 text-stone-700 rounded text-xs font-bold hover:bg-stone-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Confirmation Dialog */}
      {confirmAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200">
            <div className="flex items-center gap-2 text-stone-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <h3 className="font-serif text-lg font-bold">Confirm Customer ID Assignment</h3>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Are you sure you want to assign sequential business Customer IDs to all missing customer profiles? This will atomically update Firestore records and increment system sequence counters.
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setConfirmAssignModalOpen(false)}
                className="px-4 py-2 bg-stone-100 text-stone-700 rounded text-xs font-bold hover:bg-stone-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isMigrating}
                onClick={handleExecuteMigration}
                className="px-4 py-2 bg-[#B08D57] text-white rounded text-xs font-bold hover:bg-[#A04D2E] flex items-center gap-1.5"
              >
                {isMigrating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Confirm & Assign</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
