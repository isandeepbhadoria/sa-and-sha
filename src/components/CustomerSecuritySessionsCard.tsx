import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Laptop, Smartphone, Tablet, Key, Clock, 
  MapPin, AlertTriangle, LogOut, Trash2, CheckCircle2, 
  RefreshCw, Loader2, Lock, ShieldAlert, History, Filter,
  Info, Eye, AlertOctagon, Check, Search, Calendar, UserCheck
} from 'lucide-react';

interface SessionItem {
  session_id: string;
  auth_method: 'mobile_otp' | 'google';
  device_name: string;
  device_type: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  operating_system: string;
  ip_masked: string;
  status: 'active' | 'revoked' | 'expired';
  created_at: string;
  last_activity_at: string;
  is_current?: boolean;
}

interface SecurityEventItem {
  event_id: string;
  event_type: string;
  auth_method: string;
  outcome: 'success' | 'failed' | 'failure' | 'rejected' | 'warning' | 'info';
  reason?: string | null;
  device_name: string;
  browser: string;
  operating_system: string;
  device_type: 'desktop' | 'mobile' | 'tablet';
  ip_masked: string;
  approximate_location: string;
  created_at: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_flags: string[];
  is_current_session?: boolean;
  request_id?: string | null;
}

interface SecuritySummary {
  lastSuccessfulLogin: string | null;
  lastFailedLogin: string | null;
  successfulLogins30d: number;
  failedLogins30d: number;
  googleLoginCount: number;
  mobileOtpLoginCount: number;
  activeSessionsCount: number;
  revokedSessionsCount: number;
  suspiciousEventCount: number;
  highRiskEventCount: number;
  latestDevice: string | null;
  latestApproximateLocation: string | null;
  securityRecommendations: string[];
}

interface CustomerSecuritySessionsCardProps {
  token: string;
  onLogout?: () => void;
}

export const CustomerSecuritySessionsCard: React.FC<CustomerSecuritySessionsCardProps> = ({
  token,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'sessions' | 'history'>('sessions');

  // Sessions State
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  // History State
  const [historyEvents, setHistoryEvents] = useState<SecurityEventItem[]>([]);
  const [historySummary, setHistorySummary] = useState<SecuritySummary | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters State
  const [filterEventType, setFilterEventType] = useState<string>('');
  const [filterAuthMethod, setFilterAuthMethod] = useState<string>('');
  const [filterOutcome, setFilterOutcome] = useState<string>('');
  const [filterRiskLevel, setFilterRiskLevel] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  // Selected Event Modal
  const [selectedEvent, setSelectedEvent] = useState<SecurityEventItem | null>(null);

  // Revoke Action State
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState<{
    type: 'single' | 'all' | 'everywhere';
    sessionId?: string;
    deviceName?: string;
  } | null>(null);

  const fetchSessions = async () => {
    if (!token) return;
    setLoadingSessions(true);
    setSessionsError(null);
    try {
      const res = await fetch('/api/customer/security/sessions', {
        headers: {
          'x-verification-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        setSessions(resData.sessions || []);
      } else {
        setSessionsError(resData.error || 'Failed to load security sessions.');
      }
    } catch (err) {
      setSessionsError('Connection error while fetching security sessions.');
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchHistorySummary = async () => {
    if (!token) return;
    setLoadingSummary(true);
    try {
      const res = await fetch('/api/customer/security/summary', {
        headers: {
          'x-verification-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        setHistorySummary(resData.summary || null);
      }
    } catch (e) {
      // Ignore summary fetch error
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchLoginHistory = async (reset = true) => {
    if (!token) return;
    if (reset) {
      setLoadingHistory(true);
      setHistoryError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const queryParams = new URLSearchParams();
      if (filterEventType) queryParams.set('event_type', filterEventType);
      if (filterAuthMethod) queryParams.set('auth_method', filterAuthMethod);
      if (filterOutcome) queryParams.set('outcome', filterOutcome);
      if (filterRiskLevel) queryParams.set('risk_level', filterRiskLevel);
      if (filterDateFrom) queryParams.set('date_from', new Date(filterDateFrom).toISOString());
      if (filterDateTo) queryParams.set('date_to', new Date(filterDateTo + 'T23:59:59').toISOString());
      if (!reset && nextCursor) queryParams.set('cursor', nextCursor);
      queryParams.set('limit', '20');

      const res = await fetch(`/api/customer/security/login-history?${queryParams.toString()}`, {
        headers: {
          'x-verification-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      const resData = await res.json();

      if (res.ok && resData.success) {
        const fetched = resData.events || [];
        if (reset) {
          setHistoryEvents(fetched);
        } else {
          setHistoryEvents((prev) => [...prev, ...fetched]);
        }
        setNextCursor(resData.nextCursor || null);
        setHasMore(Boolean(resData.hasMore));
      } else {
        setHistoryError(resData.error || 'Failed to load login history.');
      }
    } catch (err) {
      setHistoryError('Error loading login history events.');
    } finally {
      setLoadingHistory(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [token]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistorySummary();
      fetchLoginHistory(true);
    }
  }, [activeTab, token]);

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    fetchLoginHistory(true);
  };

  const handleResetFilters = () => {
    setFilterEventType('');
    setFilterAuthMethod('');
    setFilterOutcome('');
    setFilterRiskLevel('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setTimeout(() => {
      fetchLoginHistory(true);
    }, 0);
  };

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingId(sessionId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/customer/security/sessions/${sessionId}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-verification-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        if (resData.isCurrentSession && onLogout) {
          onLogout();
          return;
        }
        setActionMessage({ type: 'success', text: resData.message || 'Device session revoked.' });
        fetchSessions();
      } else {
        setActionMessage({ type: 'error', text: resData.error || 'Failed to revoke session.' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Error revoking session. Please try again.' });
    } finally {
      setRevokingId(null);
      setShowConfirmModal(null);
    }
  };

  const handleRevokeAllSessions = async (keepCurrent: boolean) => {
    setRevokingAll(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/customer/security/sessions/revoke-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-verification-token': token,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ keep_current: keepCurrent })
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        if (!keepCurrent && onLogout) {
          onLogout();
          return;
        }
        setActionMessage({ type: 'success', text: resData.message || 'Other device sessions revoked.' });
        fetchSessions();
      } else {
        setActionMessage({ type: 'error', text: resData.error || 'Failed to revoke sessions.' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Error revoking sessions. Please try again.' });
    } finally {
      setRevokingAll(false);
      setShowConfirmModal(null);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="w-5 h-5 text-stone-700" />;
      case 'tablet':
        return <Tablet className="w-5 h-5 text-stone-700" />;
      default:
        return <Laptop className="w-5 h-5 text-stone-700" />;
    }
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return 'N/A';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  const getEventBadge = (outcome: string) => {
    switch (outcome) {
      case 'success':
        return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Success</span>;
      case 'failed':
      case 'failure':
        return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-rose-100 text-rose-800 border border-rose-200">Failed</span>;
      case 'warning':
        return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-100 text-amber-800 border border-amber-200">Warning</span>;
      default:
        return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-stone-100 text-stone-700 border border-stone-200">Info</span>;
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'high':
      case 'critical':
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-rose-50 text-rose-700 border border-rose-200">High Risk</span>;
      case 'medium':
        return <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-amber-50 text-amber-800 border border-amber-200">Medium Risk</span>;
      default:
        return <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-stone-100 text-stone-600">Low Risk</span>;
    }
  };

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const inactiveSessions = sessions.filter((s) => s.status !== 'active');

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-6 shadow-2xs">
      {/* Header & Tabs */}
      <div className="space-y-4 pb-4 border-b border-stone-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              <h2 className="text-lg font-serif text-stone-900">Security & Account Access</h2>
            </div>
            <p className="text-xs text-stone-500">
              Manage active device sessions, review login history, and monitor account security events.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (activeTab === 'sessions') fetchSessions();
                else { fetchHistorySummary(); fetchLoginHistory(true); }
              }}
              disabled={loadingSessions || loadingHistory}
              className="p-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${(loadingSessions || loadingHistory) ? 'animate-spin' : ''}`} />
            </button>
            {activeTab === 'sessions' && activeSessions.length > 1 && (
              <button
                onClick={() => setShowConfirmModal({ type: 'all' })}
                className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 bg-rose-50/50 hover:bg-rose-100/80 text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out Other Devices</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-stone-200 pt-2">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'sessions'
                ? 'border-stone-900 text-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>Active Sessions ({activeSessions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-stone-900 text-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Login History & Security Logs</span>
          </button>
        </div>
      </div>

      {/* Action Messages */}
      {actionMessage && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
          actionMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
            : 'bg-rose-50 text-rose-800 border border-rose-200/80'
        }`}>
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* TAB 1: ACTIVE SESSIONS */}
      {activeTab === 'sessions' && (
        <div>
          {loadingSessions && sessions.length === 0 ? (
            <div className="py-12 text-center text-stone-500 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-700" />
              <p className="text-xs font-medium">Loading active device sessions...</p>
            </div>
          ) : sessionsError ? (
            <div className="p-4 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
              <span>{sessionsError}</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active Sessions */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                  Active Logged-In Devices ({activeSessions.length})
                </h3>

                {activeSessions.length === 0 ? (
                  <p className="text-xs text-stone-500 italic py-2">No active sessions found.</p>
                ) : (
                  <div className="divide-y divide-stone-100 border border-stone-200/80 rounded-xl overflow-hidden bg-stone-50/30">
                    {activeSessions.map((s) => (
                      <div key={s.session_id} className="p-4 sm:p-5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-stone-50/50 transition-colors">
                        <div className="flex items-start gap-3.5">
                          <div className="p-2.5 rounded-xl bg-stone-100/80 shrink-0 mt-0.5">
                            {getDeviceIcon(s.device_type)}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-stone-900">{s.device_name}</span>
                              {s.is_current && (
                                <span className="px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200/80">
                                  Current Device
                                </span>
                              )}
                              <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-stone-100 text-stone-700 uppercase">
                                {s.auth_method === 'google' ? 'Google Sign-In' : 'Mobile OTP'}
                              </span>
                            </div>

                            <div className="text-xs text-stone-500 space-y-0.5">
                              <p>
                                {s.browser} • {s.operating_system} • <span className="font-mono text-stone-600">{s.ip_masked}</span>
                              </p>
                              <p className="flex items-center gap-3 pt-0.5">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-stone-400" />
                                  Active: {formatDate(s.last_activity_at)}
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {!s.is_current ? (
                            <button
                              onClick={() => setShowConfirmModal({ type: 'single', sessionId: s.session_id, deviceName: s.device_name })}
                              disabled={revokingId === s.session_id}
                              className="px-3 py-1.5 text-xs font-medium rounded-xl border border-rose-200 text-rose-700 bg-white hover:bg-rose-50 transition-colors flex items-center gap-1.5"
                            >
                              {revokingId === s.session_id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <LogOut className="w-3.5 h-3.5" />
                              )}
                              <span>Sign Out</span>
                            </button>
                          ) : (
                            <span className="text-xs text-emerald-700 font-medium flex items-center gap-1 px-2.5 py-1 bg-emerald-50 rounded-lg">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Active Session
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Inactive or Revoked Sessions */}
              {inactiveSessions.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                    Recent Inactive / Revoked Devices ({inactiveSessions.length})
                  </h3>
                  <div className="divide-y divide-stone-100 border border-stone-200/60 rounded-xl overflow-hidden bg-stone-50/20">
                    {inactiveSessions.map((s) => (
                      <div key={s.session_id} className="p-3.5 sm:p-4 bg-stone-50/40 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-stone-200/50 text-stone-400">
                            {getDeviceIcon(s.device_type)}
                          </div>
                          <div>
                            <p className="font-medium text-stone-700">{s.device_name}</p>
                            <p className="text-stone-400">{s.browser} • {s.ip_masked}</p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-stone-200/60 text-stone-600">
                          {s.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Security Note */}
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 text-xs text-stone-600 flex items-start gap-3">
                <Lock className="w-4 h-4 text-stone-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-stone-800">Cryptographically Secured & Privacy Protected</p>
                  <p>
                    Sa and Sha uses SHA-256 session token hashing and IPv4/IPv6 masking to protect your identity.
                    If you suspect unauthorized access, click <strong>Sign Out Other Devices</strong> above.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LOGIN HISTORY & SECURITY LOGS */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          {historySummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-stone-200/80 bg-stone-50/40 space-y-1">
                <span className="text-[11px] text-stone-500 font-medium">Last Successful Login</span>
                <p className="text-xs font-semibold text-stone-900 truncate">
                  {historySummary.lastSuccessfulLogin ? formatDate(historySummary.lastSuccessfulLogin) : 'None'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-stone-200/80 bg-stone-50/40 space-y-1">
                <span className="text-[11px] text-stone-500 font-medium">30-Day Logins</span>
                <p className="text-xs font-semibold text-stone-900">
                  <span className="text-emerald-700">{historySummary.successfulLogins30d} Success</span>
                  {historySummary.failedLogins30d > 0 && (
                    <span className="text-rose-700 ml-1.5">• {historySummary.failedLogins30d} Failed</span>
                  )}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-stone-200/80 bg-stone-50/40 space-y-1">
                <span className="text-[11px] text-stone-500 font-medium">Primary Auth Method</span>
                <p className="text-xs font-semibold text-stone-900">
                  {historySummary.googleLoginCount >= historySummary.mobileOtpLoginCount ? 'Google Sign-In' : 'Mobile OTP'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-stone-200/80 bg-stone-50/40 space-y-1">
                <span className="text-[11px] text-stone-500 font-medium">Security Status</span>
                <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{historySummary.suspiciousEventCount > 0 ? `${historySummary.suspiciousEventCount} Flagged` : 'Protected'}</span>
                </p>
              </div>
            </div>
          )}

          {/* Security Recommendations */}
          {historySummary && historySummary.securityRecommendations.length > 0 && (
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2">
              <span className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-stone-700" /> Security Recommendations
              </span>
              <div className="flex flex-wrap gap-2">
                {historySummary.securityRecommendations.map((rec, i) => (
                  <span key={i} className="px-2.5 py-1 text-xs bg-white text-stone-700 border border-stone-200 rounded-lg flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" /> {rec}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Event Filters */}
          <form onSubmit={handleApplyFilters} className="p-4 rounded-xl border border-stone-200/80 bg-stone-50/30 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-stone-600" /> Filter Security Events
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-stone-500 hover:text-stone-800 underline"
              >
                Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Event Type</label>
                <select
                  value={filterEventType}
                  onChange={(e) => setFilterEventType(e.target.value)}
                  className="w-full p-2 border border-stone-200 rounded-lg bg-white text-stone-800"
                >
                  <option value="">All Events</option>
                  <option value="login_success">Login Success</option>
                  <option value="login_failed">Login Failed</option>
                  <option value="mobile_otp_requested">Mobile OTP Requested</option>
                  <option value="mobile_otp_verified">Mobile OTP Verified</option>
                  <option value="mobile_otp_failed">Mobile OTP Failed</option>
                  <option value="google_login_success">Google Login Success</option>
                  <option value="session_created">Session Created</option>
                  <option value="session_revoked">Session Revoked</option>
                  <option value="token_rotated">Token Rotated</option>
                  <option value="suspicious_login">Suspicious Activity</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Auth Method</label>
                <select
                  value={filterAuthMethod}
                  onChange={(e) => setFilterAuthMethod(e.target.value)}
                  className="w-full p-2 border border-stone-200 rounded-lg bg-white text-stone-800"
                >
                  <option value="">All Methods</option>
                  <option value="google">Google</option>
                  <option value="mobile_otp">Mobile OTP</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Outcome</label>
                <select
                  value={filterOutcome}
                  onChange={(e) => setFilterOutcome(e.target.value)}
                  className="w-full p-2 border border-stone-200 rounded-lg bg-white text-stone-800"
                >
                  <option value="">All Outcomes</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="warning">Warning</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Risk Level</label>
                <select
                  value={filterRiskLevel}
                  onChange={(e) => setFilterRiskLevel(e.target.value)}
                  className="w-full p-2 border border-stone-200 rounded-lg bg-white text-stone-800"
                >
                  <option value="">All Risk Levels</option>
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-1.5 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Apply Filters</span>
              </button>
            </div>
          </form>

          {/* History Event List */}
          {loadingHistory ? (
            <div className="py-12 text-center text-stone-500 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-700" />
              <p className="text-xs font-medium">Loading security event history...</p>
            </div>
          ) : historyError ? (
            <div className="p-4 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
              <span>{historyError}</span>
            </div>
          ) : historyEvents.length === 0 ? (
            <p className="text-xs text-stone-500 italic text-center py-8">No security events match your filters.</p>
          ) : (
            <div className="space-y-3">
              <div className="divide-y divide-stone-100 border border-stone-200/80 rounded-xl overflow-hidden bg-white">
                {historyEvents.map((ev) => (
                  <div key={ev.event_id} className="p-4 hover:bg-stone-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-stone-100 shrink-0 mt-0.5">
                        {getDeviceIcon(ev.device_type)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-stone-900 capitalize">
                            {ev.event_type.replace(/_/g, ' ')}
                          </span>
                          {getEventBadge(ev.outcome)}
                          {getRiskBadge(ev.risk_level)}
                          {ev.is_current_session && (
                            <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-emerald-100 text-emerald-800">
                              Current Session
                            </span>
                          )}
                        </div>

                        <p className="text-stone-500">
                          {ev.device_name} • {ev.browser} ({ev.operating_system}) • <span className="font-mono text-stone-600">{ev.ip_masked}</span>
                        </p>

                        <div className="text-[11px] text-stone-400 flex items-center gap-3">
                          <span>{formatDate(ev.created_at)}</span>
                          <span>• Auth: {ev.auth_method === 'google' ? 'Google' : 'Mobile OTP'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="self-end sm:self-center">
                      <button
                        onClick={() => setSelectedEvent(ev)}
                        className="px-3 py-1.5 border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors flex items-center gap-1 text-[11px] font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" /> Inspect Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load More Pagination */}
              {hasMore && (
                <div className="text-center pt-2">
                  <button
                    onClick={() => fetchLoginHistory(false)}
                    disabled={loadingMore}
                    className="px-4 py-2 border border-stone-300 text-stone-700 font-medium rounded-xl hover:bg-stone-50 transition-colors text-xs flex items-center gap-2 mx-auto"
                  >
                    {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Load Earlier Events</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Inspect Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                <h3 className="font-serif text-lg text-stone-900 font-semibold capitalize">
                  {selectedEvent.event_type.replace(/_/g, ' ')}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-stone-400 hover:text-stone-700 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-stone-700">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-stone-50 border border-stone-200">
                <div>
                  <span className="text-[10px] uppercase text-stone-400 font-bold">Outcome</span>
                  <p className="mt-0.5">{getEventBadge(selectedEvent.outcome)}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-stone-400 font-bold">Risk Classification</span>
                  <p className="mt-0.5">{getRiskBadge(selectedEvent.risk_level)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-stone-400 font-semibold">Timestamp:</span>
                  <p className="text-stone-900 font-mono">{formatDate(selectedEvent.created_at)}</p>
                </div>

                <div>
                  <span className="text-stone-400 font-semibold">Device & Environment:</span>
                  <p className="text-stone-900">{selectedEvent.device_name} ({selectedEvent.browser} on {selectedEvent.operating_system})</p>
                </div>

                <div>
                  <span className="text-stone-400 font-semibold">Masked IP Address:</span>
                  <p className="text-stone-900 font-mono">{selectedEvent.ip_masked}</p>
                </div>

                <div>
                  <span className="text-stone-400 font-semibold">Authentication Method:</span>
                  <p className="text-stone-900 uppercase font-medium">{selectedEvent.auth_method}</p>
                </div>

                {selectedEvent.reason && (
                  <div>
                    <span className="text-stone-400 font-semibold">Reason / Details:</span>
                    <p className="text-stone-900">{selectedEvent.reason}</p>
                  </div>
                )}

                {selectedEvent.risk_flags && selectedEvent.risk_flags.length > 0 && (
                  <div>
                    <span className="text-stone-400 font-semibold">Triggered Risk Flags:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedEvent.risk_flags.map((flag, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px]">
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-medium hover:bg-stone-800 transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-xl border border-stone-200">
            <div className="flex items-center gap-3 text-rose-800">
              <div className="p-2.5 bg-rose-100 rounded-xl text-rose-700">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-serif text-lg text-stone-900 font-semibold">
                  {showConfirmModal.type === 'single' && 'Sign Out Device?'}
                  {showConfirmModal.type === 'all' && 'Sign Out All Other Devices?'}
                  {showConfirmModal.type === 'everywhere' && 'Sign Out Everywhere?'}
                </h3>
                <p className="text-xs text-stone-500">Confirm security session revocation</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              {showConfirmModal.type === 'single' && (
                <>Are you sure you want to sign out <strong>{showConfirmModal.deviceName}</strong>? This device will require verification to access your account again.</>
              )}
              {showConfirmModal.type === 'all' && (
                <>This will revoke all active sessions on other browsers, laptops, and mobile devices while keeping your current session active.</>
              )}
              {showConfirmModal.type === 'everywhere' && (
                <>This will immediately revoke <strong>ALL</strong> active sessions, including this device. You will be signed out and redirected to login.</>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 text-xs font-medium hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showConfirmModal.type === 'single' && showConfirmModal.sessionId) {
                    handleRevokeSession(showConfirmModal.sessionId);
                  } else if (showConfirmModal.type === 'all') {
                    handleRevokeAllSessions(true);
                  } else if (showConfirmModal.type === 'everywhere') {
                    handleRevokeAllSessions(false);
                  }
                }}
                disabled={revokingAll || Boolean(revokingId)}
                className="px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-medium hover:bg-rose-800 transition-colors flex items-center gap-1.5"
              >
                {(revokingAll || revokingId) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-xl border border-stone-200">
            <div className="flex items-center gap-3 text-rose-800">
              <div className="p-2.5 bg-rose-100 rounded-xl text-rose-700">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-serif text-lg text-stone-900 font-semibold">
                  {showConfirmModal.type === 'single' && 'Sign Out Device?'}
                  {showConfirmModal.type === 'all' && 'Sign Out All Other Devices?'}
                  {showConfirmModal.type === 'everywhere' && 'Sign Out Everywhere?'}
                </h3>
                <p className="text-xs text-stone-500">Confirm security session revocation</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              {showConfirmModal.type === 'single' && (
                <>Are you sure you want to sign out <strong>{showConfirmModal.deviceName}</strong>? This device will require verification to access your account again.</>
              )}
              {showConfirmModal.type === 'all' && (
                <>This will revoke all active sessions on other browsers, laptops, and mobile devices while keeping your current session active.</>
              )}
              {showConfirmModal.type === 'everywhere' && (
                <>This will immediately revoke <strong>ALL</strong> active sessions, including this device. You will be signed out and redirected to login.</>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 text-xs font-medium hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showConfirmModal.type === 'single' && showConfirmModal.sessionId) {
                    handleRevokeSession(showConfirmModal.sessionId);
                  } else if (showConfirmModal.type === 'all') {
                    handleRevokeAllSessions(true);
                  } else if (showConfirmModal.type === 'everywhere') {
                    handleRevokeAllSessions(false);
                  }
                }}
                disabled={revokingAll || Boolean(revokingId)}
                className="px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-medium hover:bg-rose-800 transition-colors flex items-center gap-1.5"
              >
                {(revokingAll || revokingId) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
