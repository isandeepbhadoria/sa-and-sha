import React, { useState, useEffect } from 'react';
import {
  Clock,
  Zap,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Mail,
  MessageSquare,
  Smartphone,
  Eye,
  Slash,
  ChevronLeft,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

export interface NotificationQueueJob {
  job_id: string;
  event_id: string;
  event_name?: string;
  order_id?: string | null;
  customer_id?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  channel: 'email' | 'whatsapp' | 'sms';
  provider?: string | null;
  priority: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  payload: Record<string, any>;
  template_id?: string | null;
  attempts: number;
  max_attempts: number;
  created_at: string;
  scheduled_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  failed_at?: string | null;
  last_error?: string | null;
  provider_response?: Record<string, any> | null;
  worker_id?: string | null;
  locked: boolean;
  locked_at?: string | null;
  created_by?: string;
}

export interface QueueStats {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  total: number;
  channels: {
    email: number;
    whatsapp: number;
    sms: number;
  };
  priorities: {
    p1_otp: number;
    p2_payment: number;
    p3_orders: number;
    p4_returns: number;
    p10_marketing: number;
    other: number;
  };
}

export interface WorkerHeartbeatStatus {
  worker_id: string;
  hostname: string;
  status: 'online' | 'offline' | 'idle' | 'processing';
  started_at: string;
  last_heartbeat: string;
  jobs_processed: number;
  jobs_failed: number;
  version: string;
}

interface AdminDispatchQueueTabProps {
  adminToken?: string;
  onSuccessToast?: (msg: string) => void;
  onErrorToast?: (msg: string) => void;
}

export const AdminDispatchQueueTab: React.FC<AdminDispatchQueueTabProps> = ({
  adminToken,
  onSuccessToast,
  onErrorToast
}) => {
  const [jobs, setJobs] = useState<NotificationQueueJob[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);

  // Worker Status State
  const [workers, setWorkers] = useState<WorkerHeartbeatStatus[]>([]);
  const [isQueueEnabled, setIsQueueEnabled] = useState<boolean>(false);
  const [processingBatch, setProcessingBatch] = useState<boolean>(false);
  const [dispatchingJobId, setDispatchingJobId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination
  const [page, setPage] = useState<number>(1);
  const pageSize = 15;

  // Selected Job Modal Inspection
  const [selectedJob, setSelectedJob] = useState<NotificationQueueJob | null>(null);

  const getHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    return headers;
  };

  const fetchWorkerData = async () => {
    try {
      const res = await fetch('/api/admin/notifications/workers', { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setWorkers(data.workers || []);
        setIsQueueEnabled(Boolean(data.isQueueEnabled));
      }
    } catch (err) {
      console.warn('Error fetching worker status:', err);
    }
  };

  const fetchQueueData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'all') queryParams.append('status', statusFilter);
      if (channelFilter !== 'all') queryParams.append('channel', channelFilter);
      if (priorityFilter !== 'all') queryParams.append('priority', priorityFilter);
      if (searchQuery.trim()) queryParams.append('search', searchQuery.trim());
      queryParams.append('limit', '200');

      const [jobsRes, statsRes] = await Promise.all([
        fetch(`/api/admin/notifications/queue?${queryParams.toString()}`, { headers: getHeaders() }),
        fetch('/api/admin/notifications/queue/stats', { headers: getHeaders() }),
        fetchWorkerData()
      ]);

      const jobsData = await jobsRes.json();
      const statsData = await statsRes.json();

      if (jobsData.success) {
        setJobs(jobsData.jobs || []);
      } else if (onErrorToast) {
        onErrorToast(jobsData.error || 'Failed to fetch queue jobs.');
      }

      if (statsData.success) {
        setStats(statsData.stats);
      }
    } catch (err: any) {
      console.error('Error fetching queue dispatch data:', err);
      if (onErrorToast) onErrorToast('Network error while fetching queue jobs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueData();
  }, [statusFilter, channelFilter, priorityFilter]);

  const handleProcessBatch = async () => {
    setProcessingBatch(true);
    try {
      const res = await fetch('/api/admin/notifications/process', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ limit: 25 })
      });
      const data = await res.json();

      if (data.success && data.summary) {
        const { processedCount, succeededCount, failedCount } = data.summary;
        if (onSuccessToast) {
          onSuccessToast(
            `Batch execution completed: ${processedCount} processed (${succeededCount} succeeded, ${failedCount} failed).`
          );
        }
        fetchQueueData();
      } else {
        if (onErrorToast) onErrorToast(data.error || 'Failed to process queue batch.');
      }
    } catch (err) {
      if (onErrorToast) onErrorToast('Error triggering queue batch processing.');
    } finally {
      setProcessingBatch(false);
    }
  };

  const handleDispatchJob = async (jobId: string) => {
    setDispatchingJobId(jobId);
    try {
      const res = await fetch('/api/admin/notifications/dispatch', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ jobId })
      });
      const data = await res.json();

      if (data.success) {
        if (onSuccessToast) onSuccessToast(`Job ${jobId.slice(0, 8)}... dispatched successfully!`);
        if (selectedJob && selectedJob.job_id === jobId) {
          setSelectedJob(null);
        }
        fetchQueueData();
      } else {
        if (onErrorToast) onErrorToast(data.result?.error || data.error || 'Failed to dispatch job.');
      }
    } catch (err) {
      if (onErrorToast) onErrorToast('Error dispatching job.');
    } finally {
      setDispatchingJobId(null);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!window.confirm(`Are you sure you want to cancel Queue Job ${jobId.slice(0, 8)}...?`)) return;

    setCancellingJobId(jobId);
    try {
      const res = await fetch('/api/admin/notifications/queue/cancel', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ jobId })
      });
      const data = await res.json();

      if (data.success) {
        if (onSuccessToast) onSuccessToast('Notification queue job cancelled successfully.');
        fetchQueueData();
      } else {
        if (onErrorToast) onErrorToast(data.error || 'Failed to cancel queue job.');
      }
    } catch (err) {
      if (onErrorToast) onErrorToast('Error cancelling queue job.');
    } finally {
      setCancellingJobId(null);
    }
  };

  // Pagination filtering
  const totalPages = Math.ceil(jobs.length / pageSize) || 1;
  const paginatedJobs = jobs.slice((page - 1) * pageSize, page * pageSize);

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case 'email':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 text-sky-800 border border-sky-200 rounded-md text-[11px] font-semibold">
            <Mail className="w-3 h-3 text-sky-600" /> Email
          </span>
        );
      case 'whatsapp':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[11px] font-semibold">
            <MessageSquare className="w-3 h-3 text-emerald-600" /> WhatsApp
          </span>
        );
      case 'sms':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-[11px] font-semibold">
            <Smartphone className="w-3 h-3 text-amber-600" /> SMS
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-stone-100 text-stone-700 border border-stone-200 rounded-md text-[11px] font-semibold">
            {channel}
          </span>
        );
    }
  };

  const getPriorityBadge = (p: number) => {
    switch (p) {
      case 1:
        return <span className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded text-[10px] font-bold">P1 OTP</span>;
      case 2:
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded text-[10px] font-bold">P2 Payment</span>;
      case 3:
        return <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded text-[10px] font-bold">P3 Orders</span>;
      case 4:
        return <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded text-[10px] font-bold">P4 Returns</span>;
      case 10:
        return <span className="px-2 py-0.5 bg-stone-100 text-stone-700 rounded text-[10px] font-bold">P10 Promo</span>;
      default:
        return <span className="px-2 py-0.5 bg-stone-100 text-stone-700 rounded text-[10px] font-bold">P{p}</span>;
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300/60 rounded-full text-[11px] font-bold">
            <Clock className="w-3 h-3 text-amber-600" /> Queued
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 text-sky-800 border border-sky-300/60 rounded-full text-[11px] font-bold animate-pulse">
            <Zap className="w-3 h-3 text-sky-600" /> Processing
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300/60 rounded-full text-[11px] font-bold">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-300/60 rounded-full text-[11px] font-bold">
            <AlertCircle className="w-3 h-3 text-rose-600" /> Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-stone-100 text-stone-600 border border-stone-300/60 rounded-full text-[11px] font-bold">
            <XCircle className="w-3 h-3 text-stone-500" /> Cancelled
          </span>
        );
      default:
        return <span className="px-2 py-1 bg-stone-100 text-stone-700 rounded text-[11px] font-bold">{st}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* WORKER STATUS & QUEUE CONTROLS CARD */}
      <div className="p-5 bg-stone-900 text-white rounded-2xl border border-stone-800 shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold tracking-wider uppercase flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Notification Worker Status</span>
            </h3>

            {isQueueEnabled ? (
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-[11px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Queue Enabled (Active)
              </span>
            ) : (
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[11px] font-bold flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> Shadow Mode (Auto-Process Off)
              </span>
            )}
          </div>

          <div className="text-xs text-stone-300 flex items-center gap-4 flex-wrap font-mono">
            <div>
              <span className="text-stone-400 font-sans">Instance:</span>{' '}
              <span className="font-bold text-stone-100">{workers[0]?.hostname || 'Cloud Run Instance'}</span>
            </div>
            <div>
              <span className="text-stone-400 font-sans">Heartbeat:</span>{' '}
              <span className="font-bold text-stone-100">
                {workers[0]?.last_heartbeat
                  ? new Date(workers[0].last_heartbeat).toLocaleTimeString()
                  : 'Idle / On-Demand'}
              </span>
            </div>
            <div>
              <span className="text-stone-400 font-sans">Jobs Processed:</span>{' '}
              <span className="font-bold text-emerald-400">{workers[0]?.jobs_processed ?? 0}</span>
            </div>
            <div>
              <span className="text-stone-400 font-sans">Jobs Failed:</span>{' '}
              <span className="font-bold text-rose-400">{workers[0]?.jobs_failed ?? 0}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
          <button
            onClick={fetchQueueData}
            className="p-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl transition-colors cursor-pointer border border-stone-700 text-xs font-semibold flex items-center gap-1.5"
            title="Refresh Worker Status & Queue Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleProcessBatch}
            disabled={processingBatch}
            className="px-4 py-2.5 bg-[#B08D57] hover:bg-[#A04D2E] text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center gap-2 whitespace-nowrap"
          >
            <Zap className={`w-4 h-4 ${processingBatch ? 'animate-bounce' : ''}`} />
            <span>{processingBatch ? 'Processing Batch...' : 'Process Next Batch'}</span>
          </button>
        </div>
      </div>

      {/* SUMMARY STATS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-4 bg-white border border-[#E5D2BC]/30 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Queued</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-[#2A211C]">{stats?.queued ?? 0}</div>
          <p className="text-[11px] text-stone-500 mt-0.5">Awaiting Background Worker</p>
        </div>

        <div className="p-4 bg-white border border-[#E5D2BC]/30 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-sky-700 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Processing</span>
            <Zap className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-[#2A211C]">{stats?.processing ?? 0}</div>
          <p className="text-[11px] text-stone-500 mt-0.5">Active Dispatch Lock</p>
        </div>

        <div className="p-4 bg-white border border-[#E5D2BC]/30 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-[#2A211C]">{stats?.completed ?? 0}</div>
          <p className="text-[11px] text-stone-500 mt-0.5">Successfully Delivered</p>
        </div>

        <div className="p-4 bg-white border border-[#E5D2BC]/30 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Failed</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-[#2A211C]">{stats?.failed ?? 0}</div>
          <p className="text-[11px] text-stone-500 mt-0.5">Delivery Error / Exceeded</p>
        </div>

        <div className="p-4 bg-white border border-[#E5D2BC]/30 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-stone-600 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Cancelled</span>
            <XCircle className="w-4 h-4 text-stone-500" />
          </div>
          <div className="text-2xl font-black text-[#2A211C]">{stats?.cancelled ?? 0}</div>
          <p className="text-[11px] text-stone-500 mt-0.5">Admin Aborted</p>
        </div>
      </div>

      {/* FILTER & CONTROL BAR */}
      <div className="p-4 bg-white border border-[#E5D2BC]/30 rounded-xl shadow-2xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {/* SEARCH BOX */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search Job ID, Event, Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchQueueData()}
              className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-[#B08D57] outline-none"
            />
          </div>

          {/* STATUS FILTER */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium text-stone-700 outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* CHANNEL FILTER */}
          <select
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium text-stone-700 outline-none cursor-pointer"
          >
            <option value="all">All Channels</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
          </select>

          {/* PRIORITY FILTER */}
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium text-stone-700 outline-none cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="1">P1 - OTP</option>
            <option value="2">P2 - Payment</option>
            <option value="3">P3 - Orders</option>
            <option value="4">P4 - Returns</option>
            <option value="10">P10 - Promo</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchQueueData}
            disabled={loading}
            className="px-3 py-1.5 bg-[#B08D57] text-white hover:bg-[#A04D2E] rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* DISPATCH QUEUE TABLE */}
      <div className="bg-white border border-[#E5D2BC]/30 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                <th className="py-3 px-4">Job ID & Created</th>
                <th className="py-3 px-4">Event Name</th>
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs text-stone-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#B08D57] mb-2" />
                    <span>Loading dispatch queue jobs...</span>
                  </td>
                </tr>
              ) : paginatedJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-500">
                    <Clock className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="font-semibold text-stone-700">No Notification Queue Jobs Found</p>
                    <p className="text-xs text-stone-400 mt-1">
                      New transactional notification jobs created via Notification Router will appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedJobs.map((job) => (
                  <tr key={job.job_id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono text-[11px] text-stone-900 font-bold">
                        {job.job_id.slice(0, 13)}...
                      </div>
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        {job.created_at ? new Date(job.created_at).toLocaleString('en-IN') : '-'}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-stone-900">{job.event_name || job.event_id}</div>
                      <div className="text-[10px] text-stone-400 font-mono">{job.event_id}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-stone-900 font-medium">
                        {job.customer_email || job.customer_phone || 'System / Batch'}
                      </div>
                      {job.order_id && (
                        <div className="text-[10px] text-[#B08D57] font-medium mt-0.5">
                          Order #{job.order_id}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">{getChannelBadge(job.channel)}</td>

                    <td className="py-3 px-4">{getPriorityBadge(job.priority)}</td>

                    <td className="py-3 px-4">{getStatusBadge(job.status)}</td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedJob(job)}
                          className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md transition-colors cursor-pointer"
                          title="Inspect Job Payload"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {job.status === 'queued' && (
                          <>
                            <button
                              onClick={() => handleDispatchJob(job.job_id)}
                              disabled={dispatchingJobId === job.job_id}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-2xs"
                              title="Dispatch Selected Job Immediately"
                            >
                              <Zap className={`w-3 h-3 ${dispatchingJobId === job.job_id ? 'animate-spin' : ''}`} />
                              <span>{dispatchingJobId === job.job_id ? 'Sending...' : 'Dispatch'}</span>
                            </button>

                            <button
                              onClick={() => handleCancelJob(job.job_id)}
                              disabled={cancellingJobId === job.job_id}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                            >
                              <Slash className="w-3 h-3" />
                              <span>Cancel</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {jobs.length > pageSize && (
          <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600">
            <div>
              Showing <span className="font-bold text-stone-900">{(page - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold text-stone-900">{Math.min(page * pageSize, jobs.length)}</span> of{' '}
              <span className="font-bold text-stone-900">{jobs.length}</span> jobs
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="p-1.5 bg-white border border-stone-200 rounded hover:bg-stone-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-semibold">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="p-1.5 bg-white border border-stone-200 rounded hover:bg-stone-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* INSPECT JOB MODAL */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-stone-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-wide flex items-center gap-2">
                  <span>Job Inspector:</span>
                  <span className="font-mono text-xs text-amber-400">{selectedJob.job_id}</span>
                </h3>
                <p className="text-[11px] text-stone-400 mt-0.5">{selectedJob.event_name || selectedJob.event_id}</p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1 text-stone-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-stone-700">
              <div className="grid grid-cols-2 gap-3 bg-stone-50 p-3 rounded-lg border border-stone-200">
                <div>
                  <span className="font-bold text-stone-500 uppercase text-[10px]">Status:</span>
                  <div className="mt-0.5">{getStatusBadge(selectedJob.status)}</div>
                </div>
                <div>
                  <span className="font-bold text-stone-500 uppercase text-[10px]">Channel & Priority:</span>
                  <div className="mt-0.5 flex items-center gap-1">
                    {getChannelBadge(selectedJob.channel)}
                    {getPriorityBadge(selectedJob.priority)}
                  </div>
                </div>
                <div>
                  <span className="font-bold text-stone-500 uppercase text-[10px]">Recipient Email:</span>
                  <div className="font-medium text-stone-900">{selectedJob.customer_email || 'None'}</div>
                </div>
                <div>
                  <span className="font-bold text-stone-500 uppercase text-[10px]">Recipient Phone:</span>
                  <div className="font-medium text-stone-900">{selectedJob.customer_phone || 'None'}</div>
                </div>
                <div>
                  <span className="font-bold text-stone-500 uppercase text-[10px]">Order ID:</span>
                  <div className="font-medium text-stone-900">{selectedJob.order_id || 'None'}</div>
                </div>
                <div>
                  <span className="font-bold text-stone-500 uppercase text-[10px]">Created At:</span>
                  <div className="font-medium text-stone-900">
                    {selectedJob.created_at ? new Date(selectedJob.created_at).toLocaleString() : 'N/A'}
                  </div>
                </div>
              </div>

              {selectedJob.last_error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
                  <span className="font-bold text-rose-900 block mb-1">Last Error / Status Reason:</span>
                  <code className="text-[11px] font-mono break-all">{selectedJob.last_error}</code>
                </div>
              )}

              <div>
                <span className="font-bold text-stone-800 block mb-1">Job Payload Data (JSON):</span>
                <pre className="p-3 bg-stone-900 text-emerald-400 font-mono text-[11px] rounded-lg overflow-x-auto max-h-60 leading-relaxed">
                  {JSON.stringify(selectedJob.payload || {}, null, 2)}
                </pre>
              </div>

              {selectedJob.provider_response && (
                <div>
                  <span className="font-bold text-stone-800 block mb-1">Provider Response Data:</span>
                  <pre className="p-3 bg-stone-900 text-sky-400 font-mono text-[11px] rounded-lg overflow-x-auto max-h-40 leading-relaxed">
                    {JSON.stringify(selectedJob.provider_response, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
              <div>
                {selectedJob.status === 'queued' && (
                  <button
                    onClick={() => handleDispatchJob(selectedJob.job_id)}
                    disabled={dispatchingJobId === selectedJob.job_id}
                    className="px-4 py-2 bg-[#B08D57] hover:bg-[#A04D2E] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                  >
                    <Zap className={`w-3.5 h-3.5 ${dispatchingJobId === selectedJob.job_id ? 'animate-bounce' : ''}`} />
                    <span>{dispatchingJobId === selectedJob.job_id ? 'Dispatching Job...' : 'Dispatch Selected Job'}</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl font-bold text-xs cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
