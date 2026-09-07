import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Users,
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  ArrowRight,
  GitMerge,
  FileText,
  Lock,
  UserCheck,
  Building,
  CreditCard,
  MapPin,
  Award
} from "lucide-react";

interface IdentityConflict {
  conflict_id: string;
  provider: "google" | "mobile_otp";
  provider_uid_hash: string;
  verified_email: string;
  matched_profile_ids: string[];
  matched_customer_ids: string[];
  reason: string;
  status: "pending" | "under_review" | "approved" | "rejected" | "resolved" | "cancelled";
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  reviewed_by?: string | null;
  resolution_action?: string | null;
  canonical_profile_id?: string | null;
  notes?: string | null;
  risk_flags: string[];
  source: string;
}

interface LinkedIdentity {
  identity_id: string;
  provider: string;
  verified_email: string;
  customer_profile_id: string;
  customer_id: string;
  linked_at: string;
  last_authenticated_at: string;
  masked_uid_hash: string;
  profile_snapshot?: { name?: string; picture?: string };
}

interface AuditRecord {
  audit_id: string;
  action: string;
  conflict_id?: string;
  provider: string;
  canonical_profile_id?: string;
  affected_profile_ids: string[];
  admin_email: string;
  reason?: string;
  outcome: string;
  created_at: string;
}

interface AdminIdentityManagementTabProps {
  adminToken: string;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const AdminIdentityManagementTab: React.FC<AdminIdentityManagementTabProps> = ({
  adminToken,
  showToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"conflicts" | "identities" | "audit">("conflicts");

  // Conflicts State
  const [conflicts, setConflicts] = useState<IdentityConflict[]>([]);
  const [isLoadingConflicts, setIsLoadingConflicts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Selected Inspector
  const [inspectConflictId, setInspectConflictId] = useState<string | null>(null);
  const [inspectData, setInspectData] = useState<any | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Merge Preview State
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [selectedCanonicalId, setSelectedCanonicalId] = useState<string>("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const [confirmTextInput, setConfirmTextInput] = useState("");
  const [isSubmittingMerge, setIsSubmittingMerge] = useState(false);
  const [mergeReason, setMergeReason] = useState("");

  // Reject Modal State
  const [rejectingConflictId, setRejectingConflictId] = useState<string | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState("");
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Linked Identities State
  const [linkedIdentities, setLinkedIdentities] = useState<LinkedIdentity[]>([]);
  const [isLoadingIdentities, setIsLoadingIdentities] = useState(false);

  // Audit State
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Fetch Conflicts
  const fetchConflicts = async () => {
    setIsLoadingConflicts(true);
    try {
      const queryParams = new URLSearchParams();
      if (statusFilter !== "ALL") queryParams.append("status", statusFilter);
      if (searchQuery.trim()) queryParams.append("email", searchQuery.trim());

      const res = await fetch(`/api/admin/identity/conflicts?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setConflicts(data.conflicts || []);
      } else {
        showToast(data.error || "Failed to fetch conflicts.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error fetching conflicts.", "error");
    } finally {
      setIsLoadingConflicts(false);
    }
  };

  // Fetch Linked Identities
  const fetchLinkedIdentities = async () => {
    setIsLoadingIdentities(true);
    try {
      const res = await fetch("/api/admin/identity/linked-identities", {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setLinkedIdentities(data.identities || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingIdentities(false);
    }
  };

  // Fetch Audit History
  const fetchAuditLogs = async () => {
    setIsLoadingAudit(true);
    try {
      const res = await fetch("/api/admin/identity/audit", {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.auditLogs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === "conflicts") fetchConflicts();
    else if (activeSubTab === "identities") fetchLinkedIdentities();
    else if (activeSubTab === "audit") fetchAuditLogs();
  }, [activeSubTab, statusFilter]);

  // Inspect Conflict Details
  const handleInspect = async (conflictId: string) => {
    setInspectConflictId(conflictId);
    setIsLoadingDetails(true);
    try {
      const res = await fetch(`/api/admin/identity/conflicts/${conflictId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setInspectData(data);
        if (data.profiles && data.profiles.length > 0) {
          setSelectedCanonicalId(data.profiles[0].profile_id);
        }
      } else {
        showToast(data.error || "Failed to load conflict details.", "error");
      }
    } catch (err) {
      showToast("Error loading details.", "error");
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Start Review
  const handleStartReview = async (conflictId: string) => {
    try {
      const res = await fetch(`/api/admin/identity/conflicts/${conflictId}/start-review`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (data.success) {
        showToast("Review started.", "success");
        fetchConflicts();
        if (inspectConflictId === conflictId) handleInspect(conflictId);
      } else {
        showToast(data.error || "Failed to start review.", "error");
      }
    } catch (err) {
      showToast("Error starting review.", "error");
    }
  };

  // Generate Merge Preview
  const handleGeneratePreview = async (conflictId: string, canonicalId?: string) => {
    setIsLoadingPreview(true);
    setConfirmCheckbox(false);
    setConfirmTextInput("");
    try {
      const res = await fetch(`/api/admin/identity/conflicts/${conflictId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ canonical_profile_id: canonicalId })
      });
      const data = await res.json();
      if (data.success) {
        setPreviewData(data.preview);
      } else {
        showToast(data.error || "Failed to generate merge preview.", "error");
      }
    } catch (err) {
      showToast("Error generating preview.", "error");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Execute Merge
  const handleExecuteMerge = async () => {
    if (!previewData) return;
    if (confirmTextInput !== "MERGE CUSTOMER PROFILES") {
      showToast("Confirmation text must be exactly 'MERGE CUSTOMER PROFILES'.", "error");
      return;
    }
    if (!confirmCheckbox) {
      showToast("You must confirm reviewing all profile conflicts.", "error");
      return;
    }

    setIsSubmittingMerge(true);
    try {
      const res = await fetch(`/api/admin/identity/conflicts/${previewData.conflict_id}/merge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          canonical_profile_id: previewData.canonical_profile.profile_id,
          confirmation_text: confirmTextInput,
          reason: mergeReason || "Admin merged profiles after conflict review"
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast("Profiles merged successfully!", "success");
        setPreviewData(null);
        setInspectData(null);
        setInspectConflictId(null);
        fetchConflicts();
      } else {
        showToast(data.error || "Merge failed.", "error");
      }
    } catch (err) {
      showToast("Network error executing merge.", "error");
    } finally {
      setIsSubmittingMerge(false);
    }
  };

  // Reject Conflict
  const handleRejectConflict = async () => {
    if (!rejectingConflictId) return;
    if (!rejectReasonInput.trim()) {
      showToast("Rejection reason is required.", "error");
      return;
    }

    setIsSubmittingReject(true);
    try {
      const res = await fetch(`/api/admin/identity/conflicts/${rejectingConflictId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ reason: rejectReasonInput.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showToast("Conflict rejected.", "success");
        setRejectingConflictId(null);
        setRejectReasonInput("");
        fetchConflicts();
        if (inspectConflictId === rejectingConflictId) setInspectData(null);
      } else {
        showToast(data.error || "Failed to reject conflict.", "error");
      }
    } catch (err) {
      showToast("Error rejecting conflict.", "error");
    } finally {
      setIsSubmittingReject(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-stone-800" />
            <h1 className="text-2xl font-serif text-stone-900">Identity Management</h1>
          </div>
          <p className="text-sm text-stone-600 mt-1">
            Safely review account-linking conflicts, perform audited profile merges, and monitor linked Google identities.
          </p>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveSubTab("conflicts")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeSubTab === "conflicts"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            Conflict Queue ({conflicts.filter((c) => c.status === "pending" || c.status === "under_review").length})
          </button>
          <button
            onClick={() => setActiveSubTab("identities")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeSubTab === "identities"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            Linked Identities
          </button>
          <button
            onClick={() => setActiveSubTab("audit")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeSubTab === "audit"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            Audit History
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: CONFLICT QUEUE */}
      {activeSubTab === "conflicts" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200">
            <div className="flex items-center gap-3 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by verified email or Customer ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchConflicts()}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-800 bg-white"
                />
              </div>
              <button
                onClick={fetchConflicts}
                className="px-3 py-2 bg-stone-800 text-white text-xs rounded-lg hover:bg-stone-900 transition-colors flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                Search
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-stone-500" />
                <span className="text-xs text-stone-600">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-stone-200 rounded-lg bg-white focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="under_review">Under Review</option>
                  <option value="resolved">Resolved (Merged)</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <button
                onClick={fetchConflicts}
                className="p-2 text-stone-600 hover:text-stone-900 rounded-lg border border-stone-200 bg-white hover:bg-stone-100"
                title="Refresh queue"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Conflicts Table */}
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
            {isLoadingConflicts ? (
              <div className="p-8 text-center text-stone-500 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-stone-400" />
                Loading identity conflict queue...
              </div>
            ) : conflicts.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-medium text-stone-800">No account conflicts found</p>
                <p className="text-xs text-stone-500">
                  There are currently no customer account linking conflicts requiring administrative review.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-700">
                  <thead className="bg-stone-50 border-b border-stone-200 font-medium text-stone-600 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Conflict ID</th>
                      <th className="px-4 py-3">Verified Email</th>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Matched Customers</th>
                      <th className="px-4 py-3">Risk Flags</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created At</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {conflicts.map((cnf) => (
                      <tr key={cnf.conflict_id} className="hover:bg-stone-50/50">
                        <td className="px-4 py-3 font-mono text-[11px] text-stone-600">
                          {cnf.conflict_id.slice(0, 16)}...
                        </td>
                        <td className="px-4 py-3 font-medium text-stone-900">{cnf.verified_email}</td>
                        <td className="px-4 py-3">
                          <span className="capitalize px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-mono text-[10px]">
                            {cnf.provider}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-stone-800">
                          {(cnf.matched_customer_ids || []).join(", ") || cnf.matched_profile_ids.length + " profiles"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(cnf.risk_flags || ["MULTIPLE_MATCHES"]).map((flag, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase bg-amber-50 text-amber-800 border border-amber-200 rounded"
                              >
                                {flag.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full ${
                              cnf.status === "pending"
                                ? "bg-amber-100 text-amber-800"
                                : cnf.status === "under_review"
                                ? "bg-blue-100 text-blue-800"
                                : cnf.status === "resolved"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-stone-100 text-stone-600"
                            }`}
                          >
                            {cnf.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-stone-500 text-[11px]">
                          {new Date(cnf.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleInspect(cnf.conflict_id)}
                              className="px-2.5 py-1 text-[11px] font-medium border border-stone-200 rounded bg-white hover:bg-stone-50 text-stone-700 flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              Inspect
                            </button>

                            {cnf.status === "pending" && (
                              <button
                                onClick={() => handleStartReview(cnf.conflict_id)}
                                className="px-2.5 py-1 text-[11px] font-medium rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                              >
                                Review
                              </button>
                            )}

                            {(cnf.status === "pending" || cnf.status === "under_review") && (
                              <>
                                <button
                                  onClick={() => handleGeneratePreview(cnf.conflict_id)}
                                  className="px-2.5 py-1 text-[11px] font-medium rounded bg-stone-800 text-white hover:bg-stone-900 flex items-center gap-1"
                                >
                                  <GitMerge className="w-3 h-3" />
                                  Preview Merge
                                </button>
                                <button
                                  onClick={() => setRejectingConflictId(cnf.conflict_id)}
                                  className="px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 rounded"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: LINKED IDENTITIES */}
      {activeSubTab === "identities" && (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
            <h3 className="text-sm font-medium text-stone-900">Verified Google Identities</h3>
            <button
              onClick={fetchLinkedIdentities}
              className="p-1.5 text-stone-600 hover:text-stone-900 rounded border border-stone-200 bg-white"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {isLoadingIdentities ? (
            <div className="p-8 text-center text-stone-500 text-xs">Loading linked identities...</div>
          ) : linkedIdentities.length === 0 ? (
            <div className="p-8 text-center text-stone-500 text-xs">No linked third-party identities found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700">
                <thead className="bg-stone-50 border-b border-stone-200 font-medium text-stone-600 uppercase">
                  <tr>
                    <th className="px-4 py-3">Customer ID</th>
                    <th className="px-4 py-3">Verified Email</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Masked UID Hash</th>
                    <th className="px-4 py-3">Linked At</th>
                    <th className="px-4 py-3">Last Login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {linkedIdentities.map((id) => (
                    <tr key={id.identity_id} className="hover:bg-stone-50/50">
                      <td className="px-4 py-3 font-mono font-medium text-stone-900">{id.customer_id}</td>
                      <td className="px-4 py-3">{id.verified_email}</td>
                      <td className="px-4 py-3">
                        <span className="capitalize px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[10px]">
                          {id.provider}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-stone-500">{id.masked_uid_hash}</td>
                      <td className="px-4 py-3 text-stone-500">{new Date(id.linked_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-stone-500">
                        {id.last_authenticated_at ? new Date(id.last_authenticated_at).toLocaleString() : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: AUDIT HISTORY */}
      {activeSubTab === "audit" && (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
            <h3 className="text-sm font-medium text-stone-900">Identity Audit Trail</h3>
            <button
              onClick={fetchAuditLogs}
              className="p-1.5 text-stone-600 hover:text-stone-900 rounded border border-stone-200 bg-white"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {isLoadingAudit ? (
            <div className="p-8 text-center text-stone-500 text-xs">Loading audit history...</div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center text-stone-500 text-xs">No identity audit events recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700">
                <thead className="bg-stone-50 border-b border-stone-200 font-medium text-stone-600 uppercase">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Admin Email</th>
                    <th className="px-4 py-3">Outcome</th>
                    <th className="px-4 py-3">Conflict ID</th>
                    <th className="px-4 py-3">Reason / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {auditLogs.map((log) => (
                    <tr key={log.audit_id} className="hover:bg-stone-50/50">
                      <td className="px-4 py-3 text-stone-500 text-[11px]">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-stone-900">
                        <span className="font-mono text-[11px] bg-stone-100 px-1.5 py-0.5 rounded">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-stone-600">{log.admin_email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${
                            log.outcome === "SUCCESS"
                              ? "bg-emerald-100 text-emerald-800"
                              : log.outcome === "BLOCKED"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-stone-100 text-stone-700"
                          }`}
                        >
                          {log.outcome}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-stone-500">
                        {log.conflict_id ? log.conflict_id.slice(0, 14) + "..." : "-"}
                      </td>
                      <td className="px-4 py-3 text-stone-600 max-w-xs truncate">{log.reason || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: IDENTITY INSPECTOR */}
      {inspectConflictId && inspectData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-4">
              <div>
                <h3 className="text-lg font-serif font-medium text-stone-900">Identity Conflict Inspector</h3>
                <p className="text-xs text-stone-500 font-mono mt-0.5">ID: {inspectData.conflict.conflict_id}</p>
              </div>
              <button
                onClick={() => {
                  setInspectConflictId(null);
                  setInspectData(null);
                }}
                className="text-stone-400 hover:text-stone-700"
              >
                ✕
              </button>
            </div>

            {/* Summary Banner */}
            <div className="bg-stone-50 p-4 rounded-lg border border-stone-200 flex flex-wrap gap-4 text-xs">
              <div>
                <span className="text-stone-500 block">Verified Email:</span>
                <span className="font-medium text-stone-900">{inspectData.conflict.verified_email}</span>
              </div>
              <div>
                <span className="text-stone-500 block">Provider:</span>
                <span className="font-medium text-stone-900 uppercase font-mono">{inspectData.conflict.provider}</span>
              </div>
              <div>
                <span className="text-stone-500 block">Status:</span>
                <span className="font-semibold text-stone-900 capitalize">{inspectData.conflict.status}</span>
              </div>
              <div>
                <span className="text-stone-500 block">Created At:</span>
                <span className="text-stone-700">{new Date(inspectData.conflict.created_at).toLocaleString()}</span>
              </div>
            </div>

            {/* Matched Profiles Comparison */}
            <div>
              <h4 className="text-sm font-medium text-stone-900 mb-3">Matched Customer Profiles</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inspectData.profiles.map((p: any) => (
                  <div
                    key={p.profile_id}
                    className={`p-4 rounded-xl border transition-all ${
                      selectedCanonicalId === p.profile_id
                        ? "border-stone-800 bg-stone-50/50 ring-1 ring-stone-800"
                        : "border-stone-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                      <div>
                        <span className="text-xs font-mono font-bold text-stone-900">{p.customer_id}</span>
                        {selectedCanonicalId === p.profile_id && (
                          <span className="ml-2 px-2 py-0.5 text-[9px] font-bold bg-stone-800 text-white rounded">
                            CANONICAL CANDIDATE
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedCanonicalId(p.profile_id)}
                        className="text-[11px] font-medium text-blue-600 hover:text-blue-800"
                      >
                        Set Canonical
                      </button>
                    </div>

                    <div className="mt-3 space-y-2 text-xs text-stone-700">
                      <div>
                        <span className="text-stone-500">Name:</span> {p.full_name || "(blank)"}
                      </div>
                      <div>
                        <span className="text-stone-500">Email:</span> {p.email || "(blank)"}
                      </div>
                      <div>
                        <span className="text-stone-500">Verified Mobile:</span>{" "}
                        <span className="font-mono">{p.phone || p.normalized_phone || "(none)"}</span>
                      </div>
                      <div>
                        <span className="text-stone-500">GSTIN / Company:</span>{" "}
                        {p.gstin ? `${p.gstin} (${p.company_name})` : "None"}
                      </div>
                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-stone-600">
                        <span>Orders: {p.orders_count}</span>
                        <span>Spend: ₹{p.lifetime_spend}</span>
                        <span>Points: {p.loyalty_points}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setInspectConflictId(null);
                  setInspectData(null);
                }}
                className="px-4 py-2 border border-stone-200 text-xs font-medium rounded-lg hover:bg-stone-50"
              >
                Close
              </button>
              {(inspectData.conflict.status === "pending" || inspectData.conflict.status === "under_review") && (
                <button
                  onClick={() => handleGeneratePreview(inspectData.conflict.conflict_id, selectedCanonicalId)}
                  className="px-4 py-2 bg-stone-800 text-white text-xs font-medium rounded-lg hover:bg-stone-900 flex items-center gap-1.5"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  Generate Merge Preview
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: MERGE PREVIEW */}
      {previewData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-4">
              <div className="flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-stone-800" />
                <h3 className="text-lg font-serif font-medium text-stone-900">Merge Preview & Safety Check</h3>
              </div>
              <button onClick={() => setPreviewData(null)} className="text-stone-400 hover:text-stone-700">
                ✕
              </button>
            </div>

            {/* Blocking Alert if Merge Blocked */}
            {!previewData.can_merge ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm">
                  <ShieldAlert className="w-5 h-5 text-rose-600" />
                  Automatic Merge Blocked
                </div>
                <ul className="list-disc list-inside text-xs text-rose-700 space-y-1">
                  {previewData.blocking_reasons.map((reason: string, idx: number) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
                <p className="text-[11px] text-rose-600 pt-1">
                  Profiles with different verified mobile numbers cannot be merged automatically to prevent account takeover risks.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>All profile rules passed. No verified mobile conflicts detected.</span>
              </div>
            )}

            {/* Field Classifications Matrix */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">Field Classification Analysis</h4>
              <div className="border border-stone-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-stone-50 border-b border-stone-200 font-medium text-stone-600">
                    <tr>
                      <th className="p-3">Field</th>
                      <th className="p-3">Canonical Profile ({previewData.canonical_profile.customer_id})</th>
                      <th className="p-3">Duplicate Profiles</th>
                      <th className="p-3">Resolved Result</th>
                      <th className="p-3">Classification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {previewData.field_classifications.map((fieldItem: any, idx: number) => (
                      <tr key={idx} className="hover:bg-stone-50/50">
                        <td className="p-3 font-medium text-stone-900 capitalize">
                          {fieldItem.field.replace(/_/g, " ")}
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          {typeof fieldItem.canonical_value === "object"
                            ? JSON.stringify(fieldItem.canonical_value)
                            : String(fieldItem.canonical_value)}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-stone-500">
                          {Array.isArray(fieldItem.duplicate_values)
                            ? fieldItem.duplicate_values.map((v: any) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ")
                            : String(fieldItem.duplicate_values)}
                        </td>
                        <td className="p-3 font-mono text-[11px] font-semibold text-stone-900">
                          {typeof fieldItem.resolved_value === "object"
                            ? JSON.stringify(fieldItem.resolved_value)
                            : String(fieldItem.resolved_value)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                              fieldItem.classification === "KEEP_CANONICAL"
                                ? "bg-stone-100 text-stone-800"
                                : fieldItem.classification === "FILL_MISSING"
                                ? "bg-blue-50 text-blue-800"
                                : fieldItem.classification === "COMBINE"
                                ? "bg-emerald-50 text-emerald-800"
                                : fieldItem.classification === "BLOCKED"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {fieldItem.classification}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Explicit Confirmation Controls (Only if can_merge is true) */}
            {previewData.can_merge && (
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-4 text-xs">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-stone-800 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmCheckbox}
                      onChange={(e) => setConfirmCheckbox(e.target.checked)}
                      className="w-4 h-4 rounded border-stone-300 text-stone-800 focus:ring-stone-800"
                    />
                    I confirm that I reviewed all profile conflicts and verify this merge action is accurate.
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-stone-700 font-medium">
                    Type <span className="font-mono bg-stone-200 px-1 py-0.5 rounded text-stone-900 font-bold">MERGE CUSTOMER PROFILES</span> to unlock execution:
                  </label>
                  <input
                    type="text"
                    value={confirmTextInput}
                    onChange={(e) => setConfirmTextInput(e.target.value)}
                    placeholder="MERGE CUSTOMER PROFILES"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg font-mono text-xs focus:ring-1 focus:ring-stone-800 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-stone-700 font-medium">Reason for Merge (Audit Note):</label>
                  <input
                    type="text"
                    value={mergeReason}
                    onChange={(e) => setMergeReason(e.target.value)}
                    placeholder="e.g. Verified customer requested account consolidation"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs bg-white"
                  />
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setPreviewData(null)}
                className="px-4 py-2 border border-stone-200 text-xs font-medium rounded-lg hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteMerge}
                disabled={
                  !previewData.can_merge ||
                  !confirmCheckbox ||
                  confirmTextInput !== "MERGE CUSTOMER PROFILES" ||
                  isSubmittingMerge
                }
                className={`px-5 py-2 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
                  !previewData.can_merge || !confirmCheckbox || confirmTextInput !== "MERGE CUSTOMER PROFILES" || isSubmittingMerge
                    ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                    : "bg-emerald-700 text-white hover:bg-emerald-800"
                }`}
              >
                {isSubmittingMerge ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Executing Merge...
                  </>
                ) : (
                  <>
                    <GitMerge className="w-3.5 h-3.5" />
                    Confirm & Execute Merge
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REJECT CONFLICT */}
      {rejectingConflictId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-serif font-medium text-stone-900">Reject Account Link Conflict</h3>
            <p className="text-xs text-stone-600">
              Rejecting this conflict marks it as resolved without merging any customer profiles.
            </p>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-stone-700">Rejection Reason *</label>
              <textarea
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                placeholder="State reason for rejecting this conflict..."
                className="w-full p-2.5 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-stone-800"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingConflictId(null)}
                className="px-3 py-1.5 border border-stone-200 rounded-lg text-xs font-medium hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConflict}
                disabled={isSubmittingReject || !rejectReasonInput.trim()}
                className="px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 disabled:opacity-50"
              >
                {isSubmittingReject ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
