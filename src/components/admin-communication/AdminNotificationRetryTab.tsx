import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCcw,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Eye,
  Zap,
  Search,
  Filter,
  Mail,
  MessageSquare,
  Smartphone,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertTriangle,
  Check,
  Layers,
  Calendar,
  Download,
  Bookmark,
  TrendingUp,
  History,
  Info,
  CheckSquare,
  Square,
  Trash2,
  ListFilter,
  BarChart3
} from 'lucide-react';

export interface RetryJobItem {
  job_id: string;
  event_id: string;
  order_id?: string | null;
  masked_customer?: string;
  channel: 'email' | 'whatsapp' | 'sms';
  provider?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  retry_state: 'none' | 'scheduled' | 'processing' | 'exhausted';
  attempts: number;
  max_attempts: number;
  next_retry_at?: string | null;
  last_attempt_at?: string | null;
  failed_at?: string | null;
  created_at?: string;
  safe_error?: string | null;
  idempotency_key?: string | null;
  requeued_from_dead_letter_id?: string | null;
  dead_letter_id?: string | null;
}

export interface DeadLetterItem {
  dead_letter_id: string;
  original_job_id: string;
  event_id: string;
  order_id?: string | null;
  masked_customer?: string;
  channel: 'email' | 'whatsapp' | 'sms';
  provider?: string;
  attempts: number;
  max_attempts: number;
  safe_error?: string | null;
  failed_at: string;
  dead_lettered_at: string;
  idempotency_key?: string | null;
  reason?: string;
  new_job_id?: string | null;
}

export interface AuditLogEntry {
  audit_id: string;
  action: string;
  admin_email: string;
  target_type: string;
  target_count: number;
  target_ids: string[];
  successful_count: number;
  successful_ids: string[];
  skipped_count: number;
  skipped_ids: string[];
  failed_count: number;
  failed_ids: string[];
  reason?: string | null;
  created_at: string;
  request_id?: string;
  source?: string;
  metadata?: Record<string, any>;
}

export interface RetryAnalyticsData {
  range: string;
  totalRetryAttempts: number;
  successfulManualRetries: number;
  skippedOperations: number;
  failedAdminActions: number;
  requeuedDeadLetterJobs: number;
  cancelledQueuedJobs: number;
  mostCommonFailureReason: string;
  mostAffectedChannel: string;
  outcomes: { success: number; skipped: number; failed: number };
  channelFailures: { email: number; whatsapp: number; sms: number };
  actionsOverTime: Array<{ date: string; count: number }>;
}

export interface SavedViewPreset {
  id: string;
  name: string;
  channel: string;
  status: string;
  retryState: string;
  event: string;
  search: string;
  dateRange: string;
  isCustom?: boolean;
}

export interface AdminNotificationRetryTabProps {
  adminToken?: string;
  onSuccessToast?: (msg: string) => void;
  onErrorToast?: (msg: string) => void;
  isVisible?: boolean;
}

// Client-side privacy masking helpers
export function maskEmail(email?: string | null): string {
  if (!email || !email.includes('@')) return '***@***.***';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0] || '*'}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return '*****';
  const clean = phone.replace(/\s+/g, '');
  if (clean.length < 5) return '*****';
  const prefix = clean.startsWith('+') ? clean.slice(0, 3) : clean.slice(0, 2);
  const suffix = clean.slice(-3);
  return `${prefix} ***** **${suffix}`;
}

const DEFAULT_PRESETS: SavedViewPreset[] = [
  { id: 'all_failed', name: 'All Failed Jobs', channel: 'all', status: 'failed', retryState: 'all', event: 'all', search: '', dateRange: 'all' },
  { id: 'exhausted_email', name: 'Exhausted Email Retries', channel: 'email', status: 'all', retryState: 'exhausted', event: 'all', search: '', dateRange: 'all' },
  { id: 'failed_whatsapp', name: 'Failed WhatsApp Notifications', channel: 'whatsapp', status: 'failed', retryState: 'all', event: 'all', search: '', dateRange: 'all' },
  { id: 'scheduled_today', name: 'Scheduled Retries Today', channel: 'all', status: 'all', retryState: 'scheduled', event: 'all', search: '', dateRange: 'today' },
  { id: 'dlq_orders', name: 'Dead-Letter Queue - Order Events', channel: 'all', status: 'all', retryState: 'all', event: 'order_confirmed', search: '', dateRange: 'all' }
];

export const AdminNotificationRetryTab: React.FC<AdminNotificationRetryTabProps> = ({
  adminToken,
  onSuccessToast,
  onErrorToast,
  isVisible = true
}) => {
  const [retries, setRetries] = useState<RetryJobItem[]>([]);
  const [deadLetters, setDeadLetters] = useState<DeadLetterItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [analytics, setAnalytics] = useState<RetryAnalyticsData | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Auto-refresh state (30s interval)
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [retryStateFilter, setRetryStateFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
  const [analyticsRange, setAnalyticsRange] = useState<'today' | '7days' | '30days'>('today');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Bulk Selection States
  const [selectedScheduledIds, setSelectedScheduledIds] = useState<Set<string>>(new Set());
  const [selectedFailedIds, setSelectedFailedIds] = useState<Set<string>>(new Set());
  const [selectedDLQIds, setSelectedDLQIds] = useState<Set<string>>(new Set());

  // Modals & Action Confirmations
  const [selectedInspectItem, setSelectedInspectItem] = useState<{
    item: RetryJobItem | DeadLetterItem;
    type: 'retry' | 'dead_letter';
  } | null>(null);

  const [selectedInspectAudit, setSelectedInspectAudit] = useState<AuditLogEntry | null>(null);

  const [confirmRetry, setConfirmRetry] = useState<RetryJobItem | null>(null);
  const [confirmRequeue, setConfirmRequeue] = useState<DeadLetterItem | null>(null);

  // Bulk Action Confirmation Modals
  const [bulkActionModal, setBulkActionModal] = useState<{
    type: 'retry' | 'cancel' | 'requeue';
    targetIds: string[];
  } | null>(null);

  // Bulk Execution Results Modal
  const [bulkResultModal, setBulkResultModal] = useState<{
    title: string;
    summary: { total: number; successful: number; skipped: number; failed: number };
    results: Array<{ id: string; status: string; reason?: string }>;
  } | null>(null);

  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Saved Views State
  const [savedViews, setSavedViews] = useState<SavedViewPreset[]>(() => {
    try {
      const stored = localStorage.getItem('kora_retry_saved_views');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return DEFAULT_PRESETS;
  });
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [showSavePresetModal, setShowSavePresetModal] = useState<boolean>(false);
  const [newPresetName, setNewPresetName] = useState<string>('');

  // Active view tab in Retry Centre
  const [activeTab, setActiveTab] = useState<'scheduled' | 'failed' | 'dead_letter' | 'audit' | 'analytics'>('scheduled');

  // Pagination for tables
  const [scheduledPage, setScheduledPage] = useState<number>(1);
  const [failedPage, setFailedPage] = useState<number>(1);
  const [deadLetterPage, setDeadLetterPage] = useState<number>(1);
  const [auditPage, setAuditPage] = useState<number>(1);
  const pageSize = 10;

  const getHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    return headers;
  };

  const fetchRetryData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (channelFilter !== 'all') queryParams.append('channel', channelFilter);
      if (statusFilter !== 'all') queryParams.append('status', statusFilter);
      queryParams.append('limit', '100');

      const dlQueryParams = new URLSearchParams();
      if (channelFilter !== 'all') dlQueryParams.append('channel', channelFilter);
      if (eventFilter !== 'all') dlQueryParams.append('event_id', eventFilter);
      dlQueryParams.append('limit', '100');

      const [retriesRes, dlRes, auditRes, analyticsRes] = await Promise.all([
        fetch(`/api/admin/notifications/retries?${queryParams.toString()}`, { headers: getHeaders() }),
        fetch(`/api/admin/notifications/dead-letter?${dlQueryParams.toString()}`, { headers: getHeaders() }),
        fetch('/api/admin/notifications/retry/audit-history?limit=50', { headers: getHeaders() }),
        fetch(`/api/admin/notifications/retry/analytics?range=${analyticsRange}`, { headers: getHeaders() })
      ]);

      const retriesData = await retriesRes.json();
      const dlData = await dlRes.json();
      const auditData = await auditRes.json();
      const analyticsData = await analyticsRes.json();

      if (retriesData.success) {
        setRetries(retriesData.retries || []);
      }
      if (dlData.success) {
        setDeadLetters(dlData.deadLetters || []);
      }
      if (auditData.success) {
        setAuditLogs(auditData.auditLogs || []);
      }
      if (analyticsData.success) {
        setAnalytics(analyticsData.analytics || null);
      }

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error('Error fetching retry centre data:', err);
      if (onErrorToast) onErrorToast('Network error while fetching retry centre data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRetryData();
  }, [channelFilter, statusFilter, eventFilter, analyticsRange]);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (autoRefresh && isVisible) {
      timerRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchRetryData();
        }
      }, 30000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoRefresh, isVisible, channelFilter, statusFilter, eventFilter, analyticsRange]);

  // Single Action Handlers
  const executeRetryNow = async () => {
    if (!confirmRetry) return;
    setActionLoading(true);

    try {
      const res = await fetch('/api/admin/notifications/retry', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ jobId: confirmRetry.job_id })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (onSuccessToast) {
          onSuccessToast(`Job ${confirmRetry.job_id.slice(0, 8)}... scheduled for immediate retry.`);
        }
        setConfirmRetry(null);
        fetchRetryData();
      } else {
        const errMsg = data.error || `HTTP ${res.status}: Failed to trigger retry.`;
        if (onErrorToast) onErrorToast(errMsg);
      }
    } catch (err: any) {
      if (onErrorToast) onErrorToast('Network error triggering notification job retry.');
    } finally {
      setActionLoading(false);
    }
  };

  const executeRequeueDeadLetter = async () => {
    if (!confirmRequeue) return;
    setActionLoading(true);

    try {
      const res = await fetch('/api/admin/notifications/dead-letter/requeue', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ deadLetterId: confirmRequeue.dead_letter_id })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (onSuccessToast) {
          onSuccessToast(
            `Dead-letter record ${confirmRequeue.dead_letter_id.slice(0, 8)}... requeued as new job ${data.newJobId.slice(0, 8)}...`
          );
        }
        setConfirmRequeue(null);
        fetchRetryData();
      } else {
        const errMsg = data.error || `HTTP ${res.status}: Failed to requeue dead-letter record.`;
        if (onErrorToast) onErrorToast(errMsg);
      }
    } catch (err: any) {
      if (onErrorToast) onErrorToast('Network error requeuing dead-letter record.');
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk Action Execution
  const executeBulkAction = async () => {
    if (!bulkActionModal) return;
    setActionLoading(true);

    const { type, targetIds } = bulkActionModal;

    try {
      let endpoint = '';
      let bodyKey = '';

      if (type === 'retry') {
        endpoint = '/api/admin/notifications/retry/bulk';
        bodyKey = 'jobIds';
      } else if (type === 'cancel') {
        endpoint = '/api/admin/notifications/queue/cancel/bulk';
        bodyKey = 'jobIds';
      } else if (type === 'requeue') {
        endpoint = '/api/admin/notifications/dead-letter/requeue/bulk';
        bodyKey = 'deadLetterIds';
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ [bodyKey]: targetIds })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setBulkActionModal(null);
        if (type === 'retry') setSelectedScheduledIds(new Set());
        if (type === 'cancel') setSelectedFailedIds(new Set());
        if (type === 'requeue') setSelectedDLQIds(new Set());

        setBulkResultModal({
          title: `Bulk ${type.toUpperCase()} Results`,
          summary: data.summary,
          results: data.results.map((r: any) => ({
            id: r.jobId || r.deadLetterId || 'N/A',
            status: r.status,
            reason: r.reason
          }))
        });

        if (onSuccessToast) {
          onSuccessToast(`Bulk ${type} completed. ${data.summary.successful} successful, ${data.summary.skipped} skipped, ${data.summary.failed} failed.`);
        }

        fetchRetryData();
      } else {
        if (onErrorToast) onErrorToast(data.error || 'Bulk operation failed.');
      }
    } catch (err: any) {
      if (onErrorToast) onErrorToast('Network error executing bulk operation.');
    } finally {
      setActionLoading(false);
    }
  };

  // Date Filter helper
  const filterByDate = (dateStr?: string | null): boolean => {
    if (!dateStr || dateRangeFilter === 'all') return true;
    const itemDate = new Date(dateStr).getTime();
    const now = Date.now();

    if (dateRangeFilter === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      return itemDate >= startOfDay.getTime();
    }
    if (dateRangeFilter === '7days') {
      return itemDate >= now - 7 * 24 * 60 * 60 * 1000;
    }
    if (dateRangeFilter === '30days') {
      return itemDate >= now - 30 * 24 * 60 * 60 * 1000;
    }
    return true;
  };

  // Filtered Lists
  const scheduledRetriesList = retries.filter((item) => {
    if (item.retry_state !== 'scheduled') return false;
    if (retryStateFilter !== 'all' && item.retry_state !== retryStateFilter) return false;
    if (eventFilter !== 'all' && item.event_id !== eventFilter) return false;
    if (!filterByDate(item.created_at || item.next_retry_at)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchJob = item.job_id.toLowerCase().includes(q);
      const matchOrder = (item.order_id || '').toLowerCase().includes(q);
      const matchEvent = item.event_id.toLowerCase().includes(q);
      const matchCustomer = (item.masked_customer || '').toLowerCase().includes(q);
      if (!matchJob && !matchOrder && !matchEvent && !matchCustomer) return false;
    }
    return true;
  });

  const failedJobsList = retries.filter((item) => {
    if (item.status !== 'failed' && item.retry_state !== 'exhausted') return false;
    if (retryStateFilter !== 'all' && item.retry_state !== retryStateFilter) return false;
    if (eventFilter !== 'all' && item.event_id !== eventFilter) return false;
    if (!filterByDate(item.failed_at || item.created_at)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchJob = item.job_id.toLowerCase().includes(q);
      const matchOrder = (item.order_id || '').toLowerCase().includes(q);
      const matchEvent = item.event_id.toLowerCase().includes(q);
      const matchCustomer = (item.masked_customer || '').toLowerCase().includes(q);
      if (!matchJob && !matchOrder && !matchEvent && !matchCustomer) return false;
    }
    return true;
  });

  const filteredDeadLetters = deadLetters.filter((dl) => {
    if (eventFilter !== 'all' && dl.event_id !== eventFilter) return false;
    if (!filterByDate(dl.dead_lettered_at || dl.failed_at)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDL = dl.dead_letter_id.toLowerCase().includes(q);
      const matchJob = dl.original_job_id.toLowerCase().includes(q);
      const matchOrder = (dl.order_id || '').toLowerCase().includes(q);
      const matchEvent = dl.event_id.toLowerCase().includes(q);
      const matchCustomer = (dl.masked_customer || '').toLowerCase().includes(q);
      const matchReason = (dl.reason || '').toLowerCase().includes(q);
      if (!matchDL && !matchJob && !matchOrder && !matchEvent && !matchCustomer && !matchReason) return false;
    }
    return true;
  });

  // Calculate Overview Stats
  const countScheduled = retries.filter((r) => r.retry_state === 'scheduled').length;
  const countFailed = retries.filter((r) => r.status === 'failed' || r.retry_state === 'exhausted').length;
  const countExhausted = retries.filter((r) => r.retry_state === 'exhausted').length;
  const countDeadLetters = deadLetters.length;

  // Pagination lists
  const scheduledPaginated = scheduledRetriesList.slice((scheduledPage - 1) * pageSize, scheduledPage * pageSize);
  const failedPaginated = failedJobsList.slice((failedPage - 1) * pageSize, failedPage * pageSize);
  const deadLetterPaginated = filteredDeadLetters.slice((deadLetterPage - 1) * pageSize, deadLetterPage * pageSize);
  const auditPaginated = auditLogs.slice((auditPage - 1) * pageSize, auditPage * pageSize);

  // Selection Checkbox Logic (Only current page)
  const isScheduledPageAllSelected = scheduledPaginated.length > 0 && scheduledPaginated.every((i) => selectedScheduledIds.has(i.job_id));
  const isFailedPageAllSelected = failedPaginated.length > 0 && failedPaginated.every((i) => selectedFailedIds.has(i.job_id));
  const isDLQPageAllSelected = deadLetterPaginated.length > 0 && deadLetterPaginated.every((i) => selectedDLQIds.has(i.dead_letter_id));

  const toggleSelectScheduledAllPage = () => {
    const next = new Set(selectedScheduledIds);
    if (isScheduledPageAllSelected) {
      scheduledPaginated.forEach((i) => next.delete(i.job_id));
    } else {
      scheduledPaginated.forEach((i) => next.add(i.job_id));
    }
    setSelectedScheduledIds(next);
  };

  const toggleSelectFailedAllPage = () => {
    const next = new Set(selectedFailedIds);
    if (isFailedPageAllSelected) {
      failedPaginated.forEach((i) => next.delete(i.job_id));
    } else {
      failedPaginated.forEach((i) => next.add(i.job_id));
    }
    setSelectedFailedIds(next);
  };

  const toggleSelectDLQAllPage = () => {
    const next = new Set(selectedDLQIds);
    if (isDLQPageAllSelected) {
      deadLetterPaginated.forEach((i) => next.delete(i.dead_letter_id));
    } else {
      deadLetterPaginated.forEach((i) => next.add(i.dead_letter_id));
    }
    setSelectedDLQIds(next);
  };

  const toggleSelectScheduledItem = (id: string) => {
    const next = new Set(selectedScheduledIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedScheduledIds(next);
  };

  const toggleSelectFailedItem = (id: string) => {
    const next = new Set(selectedFailedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedFailedIds(next);
  };

  const toggleSelectDLQItem = (id: string) => {
    const next = new Set(selectedDLQIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDLQIds(next);
  };

  // CSV Export Logic
  const exportCSV = (type: 'scheduled' | 'failed' | 'dead_letter' | 'audit') => {
    let filename = `kora_notification_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
    let rows: any[][] = [];

    if (type === 'scheduled') {
      rows.push(['Job ID', 'Event', 'Order ID', 'Masked Customer', 'Channel', 'Attempts', 'Next Retry At', 'Created At']);
      scheduledRetriesList.forEach((r) => {
        rows.push([
          r.job_id,
          r.event_id,
          r.order_id || 'None',
          r.masked_customer || 'N/A',
          r.channel,
          `${r.attempts}/${r.max_attempts}`,
          r.next_retry_at ? new Date(r.next_retry_at).toLocaleString() : 'N/A',
          r.created_at ? new Date(r.created_at).toLocaleString() : 'N/A'
        ]);
      });
    } else if (type === 'failed') {
      rows.push(['Job ID', 'Event', 'Order ID', 'Masked Customer', 'Channel', 'Status', 'Retry State', 'Attempts', 'Safe Error', 'Failed At']);
      failedJobsList.forEach((f) => {
        rows.push([
          f.job_id,
          f.event_id,
          f.order_id || 'None',
          f.masked_customer || 'N/A',
          f.channel,
          f.status,
          f.retry_state,
          `${f.attempts}/${f.max_attempts}`,
          f.safe_error || 'None',
          f.failed_at ? new Date(f.failed_at).toLocaleString() : 'N/A'
        ]);
      });
    } else if (type === 'dead_letter') {
      rows.push(['Dead-Letter ID', 'Original Job ID', 'Event', 'Order ID', 'Masked Customer', 'Channel', 'Attempts', 'Reason', 'Failed At', 'DLQ At']);
      filteredDeadLetters.forEach((d) => {
        rows.push([
          d.dead_letter_id,
          d.original_job_id,
          d.event_id,
          d.order_id || 'None',
          d.masked_customer || 'N/A',
          d.channel,
          `${d.attempts}/${d.max_attempts}`,
          d.reason || d.safe_error || 'Exceeded max attempts',
          d.failed_at ? new Date(d.failed_at).toLocaleString() : 'N/A',
          d.dead_lettered_at ? new Date(d.dead_lettered_at).toLocaleString() : 'N/A'
        ]);
      });
    } else if (type === 'audit') {
      rows.push(['Audit ID', 'Timestamp', 'Admin Email', 'Action', 'Target Count', 'Success', 'Skipped', 'Failed', 'Source']);
      auditLogs.forEach((a) => {
        rows.push([
          a.audit_id,
          a.created_at ? new Date(a.created_at).toLocaleString() : 'N/A',
          a.admin_email,
          a.action,
          a.target_count,
          a.successful_count,
          a.skipped_count,
          a.failed_count,
          a.source || 'ui'
        ]);
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onSuccessToast) onSuccessToast(`Exported ${type} data as CSV.`);
  };

  // Saved Preset Selection
  const applyPreset = (preset: SavedViewPreset) => {
    setSelectedPresetId(preset.id);
    setChannelFilter(preset.channel);
    setStatusFilter(preset.status);
    setRetryStateFilter(preset.retryState);
    setEventFilter(preset.event);
    setSearchQuery(preset.search);
    setDateRangeFilter(preset.dateRange);
    if (onSuccessToast) onSuccessToast(`Applied view: ${preset.name}`);
  };

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: SavedViewPreset = {
      id: `custom_${Date.now()}`,
      name: newPresetName.trim(),
      channel: channelFilter,
      status: statusFilter,
      retryState: retryStateFilter,
      event: eventFilter,
      search: searchQuery,
      dateRange: dateRangeFilter,
      isCustom: true
    };

    const updated = [...savedViews, newPreset];
    setSavedViews(updated);
    try {
      localStorage.setItem('kora_retry_saved_views', JSON.stringify(updated));
    } catch (e) {}

    setShowSavePresetModal(false);
    setNewPresetName('');
    setSelectedPresetId(newPreset.id);
    if (onSuccessToast) onSuccessToast(`Saved view "${newPreset.name}".`);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedViews.filter((v) => v.id !== id);
    setSavedViews(updated);
    try {
      localStorage.setItem('kora_retry_saved_views', JSON.stringify(updated));
    } catch (err) {}
    if (selectedPresetId === id) setSelectedPresetId('');
    if (onSuccessToast) onSuccessToast('Preset view deleted.');
  };

  const getChannelBadge = (ch: string) => {
    switch (ch) {
      case 'email':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-sky-50 text-sky-800 border border-sky-200 rounded-md text-[11px] font-semibold">
            <Mail className="w-3 h-3 text-sky-600" /> Email
          </span>
        );
      case 'whatsapp':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[11px] font-semibold">
            <MessageSquare className="w-3 h-3 text-emerald-600" /> WhatsApp
          </span>
        );
      case 'sms':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-[11px] font-semibold">
            <Smartphone className="w-3 h-3 text-amber-600" /> SMS
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-stone-100 text-stone-700 border border-stone-200 rounded-md text-[11px] font-semibold">
            {ch}
          </span>
        );
    }
  };

  const getRetryStateBadge = (st: string) => {
    switch (st) {
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-300/60 rounded-full text-[11px] font-bold">
            <Clock className="w-3 h-3 text-amber-600" /> Scheduled
          </span>
        );
      case 'exhausted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 text-rose-800 border border-rose-300/60 rounded-full text-[11px] font-bold">
            <ShieldAlert className="w-3 h-3 text-rose-600" /> Exhausted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-stone-100 text-stone-700 border border-stone-200 rounded-full text-[11px] font-semibold">
            {st}
          </span>
        );
    }
  };

  const isRetryDisabled = (item: RetryJobItem) => {
    return item.status === 'completed' || item.status === 'cancelled' || item.retry_state === 'exhausted';
  };

  if (!isVisible) return null;

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 bg-white rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-[#B85C38]" />
            <h2 className="text-lg font-bold text-stone-900 tracking-tight">Notification Retry Centre</h2>
            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full border border-amber-200">
              Queue Paused (Safeguard)
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Bulk operations, retry schedules, dead-letter records, audit history, and analytics for failed notifications.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 rounded-xl text-xs text-stone-700 font-medium">
            <Clock className="w-3.5 h-3.5 text-stone-500" />
            <span>Updated: {lastUpdated || 'Loading...'}</span>
          </div>

          <label className="flex items-center gap-2 px-3 py-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-[#B85C38] focus:ring-[#B85C38] w-3.5 h-3.5"
            />
            <span>Auto Refresh (30s)</span>
          </label>

          <button
            onClick={fetchRetryData}
            disabled={loading}
            className="p-2 bg-[#B85C38] hover:bg-[#A04D2E] text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center transition-colors"
            title="Refresh Data Now"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* READ-ONLY RETRY POLICY CARD */}
      <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
            <Info className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <span>Active Notification Retry Policy & Schedule</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-amber-800 flex-wrap pt-0.5">
            <span>Attempt 1: <strong className="text-amber-950">1m</strong></span>
            <span>•</span>
            <span>Attempt 2: <strong className="text-amber-950">5m</strong></span>
            <span>•</span>
            <span>Attempt 3: <strong className="text-amber-950">30m</strong></span>
            <span>•</span>
            <span>Attempt 4: <strong className="text-amber-950">2h</strong></span>
            <span>•</span>
            <span>Attempt 5: <strong className="text-amber-950">24h</strong></span>
          </div>
        </div>
        <div className="text-right text-[11px] text-amber-900">
          <div>Max Attempts: <strong className="font-bold">5</strong></div>
          <div>Exhausted Destination: <strong className="font-mono font-bold">notification_dead_letter</strong></div>
        </div>
      </div>

      {/* OVERVIEW STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
            <span>Scheduled Retries</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-stone-900">{countScheduled}</div>
          <div className="text-[10px] text-amber-700 font-medium">Pending automated schedule</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
            <span>Failed Jobs</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-stone-900">{countFailed}</div>
          <div className="text-[10px] text-rose-700 font-medium">{countExhausted} exhausted</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
            <span>Dead-Letter Queue</span>
            <ShieldAlert className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-stone-900">{countDeadLetters}</div>
          <div className="text-[10px] text-purple-700 font-medium">Permanent DLQ archive</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
            <span>Manual Actions Today</span>
            <History className="w-4 h-4 text-[#B85C38]" />
          </div>
          <div className="text-xl font-bold text-stone-900">{auditLogs.length}</div>
          <div className="text-[10px] text-stone-500 font-medium">Audit logs logged</div>
        </div>
      </div>

      {/* FILTER & SAVED VIEWS BAR */}
      <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search Job ID, Order ID, Event, Masked Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:ring-2 focus:ring-[#B85C38] focus:outline-hidden"
            />
          </div>

          {/* Saved Views Dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={selectedPresetId}
                onChange={(e) => {
                  const p = savedViews.find((v) => v.id === e.target.value);
                  if (p) applyPreset(p);
                }}
                className="pl-8 pr-8 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-800 cursor-pointer focus:ring-2 focus:ring-[#B85C38] focus:outline-hidden"
              >
                <option value="">Saved Views / Presets...</option>
                {savedViews.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.isCustom ? '(Custom)' : ''}
                  </option>
                ))}
              </select>
              <Bookmark className="w-3.5 h-3.5 text-amber-600 absolute left-2.5 top-2.5" />
            </div>

            <button
              onClick={() => setShowSavePresetModal(true)}
              className="px-3 py-1.5 bg-white hover:bg-stone-100 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Bookmark className="w-3.5 h-3.5 text-[#B85C38]" />
              <span>Save View</span>
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div>
            <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Channel</label>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="w-full p-1.5 bg-white border border-stone-200 rounded-lg font-semibold text-stone-800"
            >
              <option value="all">All Channels</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-1.5 bg-white border border-stone-200 rounded-lg font-semibold text-stone-800"
            >
              <option value="all">All Statuses</option>
              <option value="failed">Failed</option>
              <option value="queued">Queued</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Retry State</label>
            <select
              value={retryStateFilter}
              onChange={(e) => setRetryStateFilter(e.target.value)}
              className="w-full p-1.5 bg-white border border-stone-200 rounded-lg font-semibold text-stone-800"
            >
              <option value="all">All States</option>
              <option value="scheduled">Scheduled</option>
              <option value="exhausted">Exhausted</option>
              <option value="none">None</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Event</label>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="w-full p-1.5 bg-white border border-stone-200 rounded-lg font-semibold text-stone-800"
            >
              <option value="all">All Events</option>
              <option value="order_confirmed">order_confirmed</option>
              <option value="order_shipped">order_shipped</option>
              <option value="payment_failed">payment_failed</option>
              <option value="otp_sent">otp_sent</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Time Range</label>
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              className="w-full p-1.5 bg-white border border-stone-200 rounded-lg font-semibold text-stone-800"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* SECTION NAVIGATION TABS */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-2 overflow-x-auto gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === 'scheduled'
                ? 'bg-[#B85C38] text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Scheduled Retries ({scheduledRetriesList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('failed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === 'failed'
                ? 'bg-[#B85C38] text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Failed Jobs ({failedJobsList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('dead_letter')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === 'dead_letter'
                ? 'bg-[#B85C38] text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Dead-Letter Queue ({filteredDeadLetters.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'bg-[#B85C38] text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit History ({auditLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === 'analytics'
                ? 'bg-[#B85C38] text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Retry Analytics</span>
          </button>
        </div>

        {/* CSV Export Button for active view */}
        {activeTab !== 'analytics' && (
          <button
            onClick={() => exportCSV(activeTab as any)}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 border border-stone-200"
          >
            <Download className="w-3.5 h-3.5 text-stone-600" />
            <span>Export CSV</span>
          </button>
        )}
      </div>

      {/* VIEW CONTENT 1: SCHEDULED RETRIES */}
      {activeTab === 'scheduled' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden space-y-0">
          <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Scheduled Automatic Retries</h3>
              <p className="text-xs text-stone-500">Jobs waiting for next retry attempt. Paused while queue is disabled.</p>
            </div>

            {/* Bulk Action Controls */}
            {selectedScheduledIds.size > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 p-2 rounded-xl border border-amber-200">
                <span className="text-xs font-bold text-amber-900">{selectedScheduledIds.size} Selected</span>
                <button
                  onClick={() => setBulkActionModal({ type: 'retry', targetIds: Array.from(selectedScheduledIds) })}
                  className="px-3 py-1 bg-[#B85C38] hover:bg-[#A04D2E] text-white rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <Zap className="w-3 h-3" /> Retry Selected
                </button>
                <button
                  onClick={() => setBulkActionModal({ type: 'cancel', targetIds: Array.from(selectedScheduledIds) })}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Cancel Selected
                </button>
                <button
                  onClick={() => setSelectedScheduledIds(new Set())}
                  className="text-xs text-stone-500 underline hover:text-stone-800 ml-1"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-100/70 border-b border-stone-200 text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isScheduledPageAllSelected}
                      onChange={toggleSelectScheduledAllPage}
                      className="rounded text-[#B85C38] focus:ring-[#B85C38] w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="p-3">Job ID / Event</th>
                  <th className="p-3">Order / Recipient</th>
                  <th className="p-3">Channel</th>
                  <th className="p-3">Attempts</th>
                  <th className="p-3">Next Retry At</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs text-stone-800">
                {scheduledPaginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-stone-500 font-medium">
                      No scheduled retries found matching criteria.
                    </td>
                  </tr>
                ) : (
                  scheduledPaginated.map((item) => (
                    <tr key={item.job_id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedScheduledIds.has(item.job_id)}
                          onChange={() => toggleSelectScheduledItem(item.job_id)}
                          className="rounded text-[#B85C38] focus:ring-[#B85C38] w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-mono">
                        <div className="font-bold text-stone-900">{item.job_id.slice(0, 8)}...</div>
                        <div className="text-[11px] text-stone-500">{item.event_id}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-[#B85C38]">{item.order_id ? `#${item.order_id}` : 'None'}</div>
                        <div className="text-[11px] text-stone-500 font-mono">{item.masked_customer || 'N/A'}</div>
                      </td>
                      <td className="p-3">{getChannelBadge(item.channel)}</td>
                      <td className="p-3 font-semibold">
                        {item.attempts} / {item.max_attempts}
                      </td>
                      <td className="p-3 font-mono font-bold text-amber-700">
                        {item.next_retry_at ? new Date(item.next_retry_at).toLocaleString() : 'Pending'}
                      </td>
                      <td className="p-3 text-right space-x-1">
                        <button
                          onClick={() => setSelectedInspectItem({ item, type: 'retry' })}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Inspect
                        </button>
                        <button
                          onClick={() => setConfirmRetry(item)}
                          disabled={isRetryDisabled(item)}
                          className="px-2.5 py-1 bg-[#B85C38] hover:bg-[#A04D2E] text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40"
                        >
                          Retry Now
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600">
            <div>
              Showing {scheduledPaginated.length} of {scheduledRetriesList.length} items
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={scheduledPage === 1}
                onClick={() => setScheduledPage((p) => p - 1)}
                className="p-1 bg-white border border-stone-200 rounded-lg disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-stone-800">Page {scheduledPage}</span>
              <button
                disabled={scheduledPage * pageSize >= scheduledRetriesList.length}
                onClick={() => setScheduledPage((p) => p + 1)}
                className="p-1 bg-white border border-stone-200 rounded-lg disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW CONTENT 2: FAILED JOBS */}
      {activeTab === 'failed' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden space-y-0">
          <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Failed & Exhausted Notification Jobs</h3>
              <p className="text-xs text-stone-500">Jobs that encountered delivery errors or reached retry limit.</p>
            </div>

            {/* Bulk Actions */}
            {selectedFailedIds.size > 0 && (
              <div className="flex items-center gap-2 bg-rose-50 p-2 rounded-xl border border-rose-200">
                <span className="text-xs font-bold text-rose-900">{selectedFailedIds.size} Selected</span>
                <button
                  onClick={() => setBulkActionModal({ type: 'retry', targetIds: Array.from(selectedFailedIds) })}
                  className="px-3 py-1 bg-[#B85C38] hover:bg-[#A04D2E] text-white rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <Zap className="w-3 h-3" /> Retry Selected
                </button>
                <button
                  onClick={() => setSelectedFailedIds(new Set())}
                  className="text-xs text-stone-500 underline hover:text-stone-800 ml-1"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-100/70 border-b border-stone-200 text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isFailedPageAllSelected}
                      onChange={toggleSelectFailedAllPage}
                      className="rounded text-[#B85C38] focus:ring-[#B85C38] w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="p-3">Job ID / Event</th>
                  <th className="p-3">Order / Recipient</th>
                  <th className="p-3">Channel</th>
                  <th className="p-3">State / Attempts</th>
                  <th className="p-3">Safe Error</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs text-stone-800">
                {failedPaginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-stone-500 font-medium">
                      No failed jobs found.
                    </td>
                  </tr>
                ) : (
                  failedPaginated.map((item) => (
                    <tr key={item.job_id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedFailedIds.has(item.job_id)}
                          onChange={() => toggleSelectFailedItem(item.job_id)}
                          className="rounded text-[#B85C38] focus:ring-[#B85C38] w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-mono">
                        <div className="font-bold text-stone-900">{item.job_id.slice(0, 8)}...</div>
                        <div className="text-[11px] text-stone-500">{item.event_id}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-[#B85C38]">{item.order_id ? `#${item.order_id}` : 'None'}</div>
                        <div className="text-[11px] text-stone-500 font-mono">{item.masked_customer || 'N/A'}</div>
                      </td>
                      <td className="p-3">{getChannelBadge(item.channel)}</td>
                      <td className="p-3 space-y-0.5">
                        <div>{getRetryStateBadge(item.retry_state)}</div>
                        <div className="text-[10px] text-stone-500 font-mono">
                          {item.attempts} / {item.max_attempts} attempts
                        </div>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-rose-700 max-w-xs truncate">
                        {item.safe_error || 'Unknown error'}
                      </td>
                      <td className="p-3 text-right space-x-1">
                        <button
                          onClick={() => setSelectedInspectItem({ item, type: 'retry' })}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Inspect
                        </button>
                        <button
                          onClick={() => setConfirmRetry(item)}
                          disabled={isRetryDisabled(item)}
                          className="px-2.5 py-1 bg-[#B85C38] hover:bg-[#A04D2E] text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40"
                        >
                          Retry Now
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600">
            <div>
              Showing {failedPaginated.length} of {failedJobsList.length} items
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={failedPage === 1}
                onClick={() => setFailedPage((p) => p - 1)}
                className="p-1 bg-white border border-stone-200 rounded-lg disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-stone-800">Page {failedPage}</span>
              <button
                disabled={failedPage * pageSize >= failedJobsList.length}
                onClick={() => setFailedPage((p) => p + 1)}
                className="p-1 bg-white border border-stone-200 rounded-lg disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW CONTENT 3: DEAD-LETTER QUEUE */}
      {activeTab === 'dead_letter' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden space-y-0">
          <div className="p-4 bg-purple-50/60 border-b border-purple-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-purple-950 text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-purple-600" /> Dead-Letter Queue Archive (notification_dead_letter)
              </h3>
              <p className="text-xs text-purple-800">Exhausted jobs moved to permanent DLQ. Requeue creates a new queued job.</p>
            </div>

            {/* Bulk Actions */}
            {selectedDLQIds.size > 0 && (
              <div className="flex items-center gap-2 bg-purple-100 p-2 rounded-xl border border-purple-300">
                <span className="text-xs font-bold text-purple-900">{selectedDLQIds.size} Selected</span>
                <button
                  onClick={() => setBulkActionModal({ type: 'requeue', targetIds: Array.from(selectedDLQIds) })}
                  className="px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Requeue Selected
                </button>
                <button
                  onClick={() => setSelectedDLQIds(new Set())}
                  className="text-xs text-purple-700 underline hover:text-purple-950 ml-1"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-100/70 border-b border-stone-200 text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isDLQPageAllSelected}
                      onChange={toggleSelectDLQAllPage}
                      className="rounded text-purple-700 focus:ring-purple-700 w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="p-3">Dead-Letter ID / Event</th>
                  <th className="p-3">Order / Recipient</th>
                  <th className="p-3">Channel</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Dead-Lettered At</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs text-stone-800">
                {deadLetterPaginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-stone-500 font-medium">
                      No dead-letter records found.
                    </td>
                  </tr>
                ) : (
                  deadLetterPaginated.map((dl) => (
                    <tr key={dl.dead_letter_id} className="hover:bg-purple-50/30 transition-colors">
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedDLQIds.has(dl.dead_letter_id)}
                          onChange={() => toggleSelectDLQItem(dl.dead_letter_id)}
                          className="rounded text-purple-700 focus:ring-purple-700 w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-mono">
                        <div className="font-bold text-purple-900">{dl.dead_letter_id.slice(0, 8)}...</div>
                        <div className="text-[11px] text-stone-500">{dl.event_id}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-[#B85C38]">{dl.order_id ? `#${dl.order_id}` : 'None'}</div>
                        <div className="text-[11px] text-stone-500 font-mono">{dl.masked_customer || 'N/A'}</div>
                      </td>
                      <td className="p-3">{getChannelBadge(dl.channel)}</td>
                      <td className="p-3 font-mono text-[11px] text-rose-700 max-w-xs truncate">
                        {dl.reason || dl.safe_error || 'Exceeded max attempts'}
                      </td>
                      <td className="p-3 font-mono text-stone-600">
                        {dl.dead_lettered_at ? new Date(dl.dead_lettered_at).toLocaleString() : 'N/A'}
                      </td>
                      <td className="p-3 text-right space-x-1">
                        <button
                          onClick={() => setSelectedInspectItem({ item: dl, type: 'dead_letter' })}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Inspect
                        </button>
                        <button
                          onClick={() => setConfirmRequeue(dl)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Requeue
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600">
            <div>
              Showing {deadLetterPaginated.length} of {filteredDeadLetters.length} items
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={deadLetterPage === 1}
                onClick={() => setDeadLetterPage((p) => p - 1)}
                className="p-1 bg-white border border-stone-200 rounded-lg disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-stone-800">Page {deadLetterPage}</span>
              <button
                disabled={deadLetterPage * pageSize >= filteredDeadLetters.length}
                onClick={() => setDeadLetterPage((p) => p + 1)}
                className="p-1 bg-white border border-stone-200 rounded-lg disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW CONTENT 4: AUDIT HISTORY */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden space-y-0">
          <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-[#B85C38]" /> Retry Action Audit History (notification_retry_audit)
              </h3>
              <p className="text-xs text-stone-500">Immutable audit logs of manual retries, cancellations, and DLQ requeues.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-100/70 border-b border-stone-200 text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                  <th className="p-3">Time</th>
                  <th className="p-3">Admin</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Targets</th>
                  <th className="p-3">Success / Skip / Fail</th>
                  <th className="p-3">Source</th>
                  <th className="p-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs text-stone-800">
                {auditPaginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-stone-500 font-medium">
                      No audit history entries recorded.
                    </td>
                  </tr>
                ) : (
                  auditPaginated.map((audit) => (
                    <tr key={audit.audit_id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="p-3 font-mono text-[11px] font-semibold text-stone-700">
                        {audit.created_at ? new Date(audit.created_at).toLocaleString() : 'N/A'}
                      </td>
                      <td className="p-3 font-bold text-stone-900">{audit.admin_email}</td>
                      <td className="p-3 font-mono text-[11px]">
                        <span className="px-2 py-0.5 bg-stone-100 border border-stone-200 rounded font-bold uppercase text-[10px]">
                          {audit.action}
                        </span>
                      </td>
                      <td className="p-3 font-bold">{audit.target_count}</td>
                      <td className="p-3 font-mono text-[11px]">
                        <span className="text-emerald-700 font-bold">{audit.successful_count} succ</span> •{' '}
                        <span className="text-amber-700">{audit.skipped_count} skip</span> •{' '}
                        <span className="text-rose-700">{audit.failed_count} fail</span>
                      </td>
                      <td className="p-3 text-[11px] font-semibold uppercase">{audit.source || 'ui'}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setSelectedInspectAudit(audit)}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Inspect Log
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600">
            <div>
              Showing {auditPaginated.length} of {auditLogs.length} logs
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={auditPage === 1}
                onClick={() => setAuditPage((p) => p - 1)}
                className="p-1 bg-white border border-stone-200 rounded-lg disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-stone-800">Page {auditPage}</span>
              <button
                disabled={auditPage * pageSize >= auditLogs.length}
                onClick={() => setAuditPage((p) => p + 1)}
                className="p-1 bg-white border border-stone-200 rounded-lg disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW CONTENT 5: ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#B85C38]" /> Retry Analytics & Trend Intelligence
              </h3>
              <p className="text-xs text-stone-500">Action metrics, channel failure breakdown, and outcome ratios over time.</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-500 uppercase">Range:</span>
              <select
                value={analyticsRange}
                onChange={(e) => setAnalyticsRange(e.target.value as any)}
                className="px-3 py-1.5 bg-stone-100 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 cursor-pointer"
              >
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
              </select>
            </div>
          </div>

          {analytics && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-stone-500 uppercase">Total Retry Attempts</div>
                  <div className="text-2xl font-bold text-stone-900 mt-1">{analytics.totalRetryAttempts}</div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-emerald-700 uppercase">Successful Retries</div>
                  <div className="text-2xl font-bold text-emerald-700 mt-1">{analytics.successfulManualRetries}</div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-amber-700 uppercase">Skipped Operations</div>
                  <div className="text-2xl font-bold text-amber-700 mt-1">{analytics.skippedOperations}</div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-rose-700 uppercase">Failed Actions</div>
                  <div className="text-2xl font-bold text-rose-700 mt-1">{analytics.failedAdminActions}</div>
                </div>
              </div>

              {/* Channel Failure & Outcome Distribution */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-3">
                  <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider">Failures by Channel</h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between font-semibold mb-1">
                        <span>Email</span>
                        <span>{analytics.channelFailures.email || 0}</span>
                      </div>
                      <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-sky-500 h-2 rounded-full"
                          style={{
                            width: `${
                              analytics.totalRetryAttempts > 0
                                ? ((analytics.channelFailures.email || 0) / (analytics.totalRetryAttempts || 1)) * 100
                                : 0
                            }%`
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-semibold mb-1">
                        <span>WhatsApp</span>
                        <span>{analytics.channelFailures.whatsapp || 0}</span>
                      </div>
                      <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-2 rounded-full"
                          style={{
                            width: `${
                              analytics.totalRetryAttempts > 0
                                ? ((analytics.channelFailures.whatsapp || 0) / (analytics.totalRetryAttempts || 1)) * 100
                                : 0
                            }%`
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-semibold mb-1">
                        <span>SMS</span>
                        <span>{analytics.channelFailures.sms || 0}</span>
                      </div>
                      <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-500 h-2 rounded-full"
                          style={{
                            width: `${
                              analytics.totalRetryAttempts > 0
                                ? ((analytics.channelFailures.sms || 0) / (analytics.totalRetryAttempts || 1)) * 100
                                : 0
                            }%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-3">
                  <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider">Most Affected Highlights</h4>
                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                      <span className="text-[10px] font-bold text-stone-500 uppercase block">Top Error Reason</span>
                      <span className="font-mono text-rose-700 font-bold block mt-0.5">
                        {analytics.mostCommonFailureReason || 'None'}
                      </span>
                    </div>

                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                      <span className="text-[10px] font-bold text-stone-500 uppercase block">Most Affected Channel</span>
                      <span className="font-bold text-stone-900 block mt-0.5">
                        {analytics.mostAffectedChannel || 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* INSPECT MODAL FOR RETRY / DLQ ITEMS */}
      {selectedInspectItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#B85C38]" />
                <h3 className="font-bold text-sm">
                  Inspect {selectedInspectItem.type === 'retry' ? 'Notification Job' : 'Dead-Letter Record'}
                </h3>
              </div>
              <button onClick={() => setSelectedInspectItem(null)} className="text-stone-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200 font-mono">
                <div>
                  <span className="font-bold text-stone-500 uppercase text-[10px]">ID:</span>
                  <div className="font-bold text-stone-900 truncate">
                    {'job_id' in selectedInspectItem.item ? selectedInspectItem.item.job_id : selectedInspectItem.item.dead_letter_id}
                  </div>
                </div>

                <div>
                  <span className="font-bold text-stone-500 uppercase text-[10px]">Event Name:</span>
                  <div className="font-bold text-stone-900">{selectedInspectItem.item.event_id}</div>
                </div>

                <div>
                  <span className="font-bold text-stone-500 uppercase text-[10px]">Channel:</span>
                  <div className="mt-0.5">{getChannelBadge(selectedInspectItem.item.channel)}</div>
                </div>

                <div>
                  <span className="font-bold text-stone-500 uppercase text-[10px]">Masked Recipient:</span>
                  <div className="font-mono text-stone-900 font-semibold">{selectedInspectItem.item.masked_customer || 'N/A'}</div>
                </div>

                <div>
                  <span className="font-bold text-stone-500 uppercase text-[10px]">Order ID:</span>
                  <div className="font-mono text-[#B85C38] font-bold">
                    {selectedInspectItem.item.order_id ? `#${selectedInspectItem.item.order_id}` : 'None'}
                  </div>
                </div>

                <div>
                  <span className="font-bold text-stone-500 uppercase text-[10px]">Attempts:</span>
                  <div className="font-bold text-stone-900">
                    {selectedInspectItem.item.attempts} / {selectedInspectItem.item.max_attempts}
                  </div>
                </div>
              </div>

              {/* Safe Error Summary */}
              {selectedInspectItem.item.safe_error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
                  <span className="font-bold text-rose-900 block mb-1">Safe Error Summary:</span>
                  <code className="text-[11px] font-mono break-all">{selectedInspectItem.item.safe_error}</code>
                </div>
              )}
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
              <div>
                {'job_id' in selectedInspectItem.item && !isRetryDisabled(selectedInspectItem.item) && (
                  <button
                    onClick={() => {
                      setConfirmRetry(selectedInspectItem.item as RetryJobItem);
                      setSelectedInspectItem(null);
                    }}
                    className="px-4 py-2 bg-[#B85C38] hover:bg-[#A04D2E] text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Retry Job Now</span>
                  </button>
                )}
                {'dead_letter_id' in selectedInspectItem.item && (
                  <button
                    onClick={() => {
                      setConfirmRequeue(selectedInspectItem.item as DeadLetterItem);
                      setSelectedInspectItem(null);
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Requeue Dead-Letter Record</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => setSelectedInspectItem(null)}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECT AUDIT LOG MODAL */}
      {selectedInspectAudit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#B85C38]" />
                <h3 className="font-bold text-sm">Audit Log Details ({selectedInspectAudit.audit_id})</h3>
              </div>
              <button onClick={() => setSelectedInspectAudit(null)} className="text-stone-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-stone-50 rounded-xl border border-stone-200 font-mono">
                <div>Admin: <strong className="text-stone-900">{selectedInspectAudit.admin_email}</strong></div>
                <div>Action: <strong className="text-stone-900">{selectedInspectAudit.action}</strong></div>
                <div>Created: <strong className="text-stone-900">{new Date(selectedInspectAudit.created_at).toLocaleString()}</strong></div>
                <div>Request ID: <strong className="text-stone-900">{selectedInspectAudit.request_id || 'N/A'}</strong></div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-stone-600 block">Target IDs ({selectedInspectAudit.target_ids.length}):</span>
                <div className="p-2 bg-stone-100 rounded-lg font-mono text-[11px] max-h-24 overflow-y-auto break-all">
                  {selectedInspectAudit.target_ids.join(', ') || 'None'}
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-emerald-700 block">Successful IDs ({selectedInspectAudit.successful_ids.length}):</span>
                <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg font-mono text-[11px] max-h-24 overflow-y-auto break-all">
                  {selectedInspectAudit.successful_ids.join(', ') || 'None'}
                </div>
              </div>

              {selectedInspectAudit.skipped_ids.length > 0 && (
                <div className="space-y-1">
                  <span className="font-bold text-amber-700 block">Skipped IDs ({selectedInspectAudit.skipped_ids.length}):</span>
                  <div className="p-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg font-mono text-[11px] max-h-24 overflow-y-auto break-all">
                    {selectedInspectAudit.skipped_ids.join(', ')}
                  </div>
                </div>
              )}

              {selectedInspectAudit.failed_ids.length > 0 && (
                <div className="space-y-1">
                  <span className="font-bold text-rose-700 block">Failed IDs ({selectedInspectAudit.failed_ids.length}):</span>
                  <div className="p-2 bg-rose-50 border border-rose-200 text-rose-900 rounded-lg font-mono text-[11px] max-h-24 overflow-y-auto break-all">
                    {selectedInspectAudit.failed_ids.join(', ')}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-end">
              <button
                onClick={() => setSelectedInspectAudit(null)}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK ACTION CONFIRMATION MODAL */}
      {bulkActionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-stone-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-bold text-stone-900 text-sm capitalize">
                Confirm Bulk {bulkActionModal.type} Action
              </h3>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Are you sure you want to {bulkActionModal.type} <strong>{bulkActionModal.targetIds.length}</strong> selected records?
            </p>
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-[11px] font-mono space-y-1 max-h-24 overflow-y-auto">
              {bulkActionModal.targetIds.slice(0, 10).map((id) => (
                <div key={id}>• {id}</div>
              ))}
              {bulkActionModal.targetIds.length > 10 && (
                <div className="text-stone-500 font-bold">...and {bulkActionModal.targetIds.length - 10} more</div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setBulkActionModal(null)}
                disabled={actionLoading}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeBulkAction}
                disabled={actionLoading}
                className="px-4 py-2 bg-[#B85C38] hover:bg-[#A04D2E] text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                <span>{actionLoading ? 'Processing...' : `Confirm Bulk ${bulkActionModal.type}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK RESULT BREAKDOWN MODAL */}
      {bulkResultModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-stone-200 shadow-2xl space-y-4 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="font-bold text-stone-900 text-sm">{bulkResultModal.title}</h3>
              <button onClick={() => setBulkResultModal(null)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 bg-stone-50 border border-stone-200 rounded-lg">
                <span className="text-[10px] text-stone-500 block uppercase">Total</span>
                <span className="font-bold">{bulkResultModal.summary.total}</span>
              </div>
              <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg">
                <span className="text-[10px] block uppercase">Success</span>
                <span className="font-bold">{bulkResultModal.summary.successful}</span>
              </div>
              <div className="p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg">
                <span className="text-[10px] block uppercase">Skipped</span>
                <span className="font-bold">{bulkResultModal.summary.skipped}</span>
              </div>
              <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg">
                <span className="text-[10px] block uppercase">Failed</span>
                <span className="font-bold">{bulkResultModal.summary.failed}</span>
              </div>
            </div>

            <div className="overflow-y-auto space-y-1 text-xs max-h-48 p-2 bg-stone-50 border border-stone-200 rounded-xl font-mono">
              {bulkResultModal.results.map((r, idx) => (
                <div key={idx} className="flex items-center justify-between py-1 border-b border-stone-200/60 last:border-0">
                  <span className="truncate w-36">{r.id}</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                      r.status === 'successful'
                        ? 'bg-emerald-100 text-emerald-800'
                        : r.status === 'skipped'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {r.status}
                  </span>
                  {r.reason && <span className="text-[10px] text-stone-500 truncate max-w-[120px]">{r.reason}</span>}
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setBulkResultModal(null)}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVE PRESET MODAL */}
      {showSavePresetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-stone-200 shadow-2xl space-y-4">
            <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-[#B85C38]" /> Save Current Filter View
            </h3>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Preset Name</label>
              <input
                type="text"
                placeholder="e.g., Critical WhatsApp Failures"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                className="w-full p-2 border border-stone-200 rounded-xl text-xs font-semibold"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSavePresetModal(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreset}
                disabled={!newPresetName.trim()}
                className="px-4 py-2 bg-[#B85C38] hover:bg-[#A04D2E] text-white rounded-xl text-xs font-bold disabled:opacity-50"
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RETRY NOW CONFIRMATION DIALOG */}
      {confirmRetry && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-stone-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-bold text-stone-900 text-sm">Retry Notification Job</h3>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Retry this notification job now?
            </p>
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-[11px] font-mono space-y-1">
              <div>Job ID: <span className="font-bold">{confirmRetry.job_id}</span></div>
              <div>Event: <span className="font-bold">{confirmRetry.event_id}</span></div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmRetry(null)}
                disabled={actionLoading}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeRetryNow}
                disabled={actionLoading}
                className="px-4 py-2 bg-[#B85C38] hover:bg-[#A04D2E] text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                <span>{actionLoading ? 'Retrying...' : 'Confirm Retry'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQUEUE DEAD-LETTER CONFIRMATION DIALOG */}
      {confirmRequeue && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-stone-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <RotateCcw className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-bold text-stone-900 text-sm">Requeue Dead-Letter Record</h3>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Create a new queued job from this dead-letter record? The original dead-letter record will remain unchanged.
            </p>
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-[11px] font-mono space-y-1">
              <div>Dead-Letter ID: <span className="font-bold">{confirmRequeue.dead_letter_id}</span></div>
              <div>Original Job ID: <span className="font-bold">{confirmRequeue.original_job_id}</span></div>
              <div>Event: <span className="font-bold">{confirmRequeue.event_id}</span></div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmRequeue(null)}
                disabled={actionLoading}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeRequeueDeadLetter}
                disabled={actionLoading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>{actionLoading ? 'Requeuing...' : 'Confirm Requeue'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
