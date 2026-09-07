import React, { useState, useEffect, useCallback } from "react";
import { RotateCcw, AlertTriangle, Clock, RefreshCw, Layers } from "lucide-react";
import { RmaQueue, RmaQueueItem } from "./RmaQueue";
import { RmaFilters } from "./RmaFilters";
import { RmaDetailDrawer } from "./RmaDetailDrawer";
import { RmaApprovalModal } from "./RmaApprovalModal";
import { RmaRejectionModal } from "./RmaRejectionModal";
import { RmaInformationRequestModal } from "./RmaInformationRequestModal";
import { RmaPickupModal } from "./RmaPickupModal";

export const AdminReturnsTab: React.FC = () => {
  const [items, setItems] = useState<RmaQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Badge Counts
  const [stats, setStats] = useState({ pendingCount: 0, overdueCount: 0, highPriorityCount: 0 });

  // Filters State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [slaFilter, setSlaFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");

  // Selected Detail Drawer
  const [selectedRmaId, setSelectedRmaId] = useState<string | null>(null);

  // Modals
  const [approvalModalRmaId, setApprovalModalRmaId] = useState<string | null>(null);
  const [rejectionModalRmaId, setRejectionModalRmaId] = useState<string | null>(null);
  const [infoModalRmaId, setInfoModalRmaId] = useState<string | null>(null);
  const [pickupModalRmaId, setPickupModalRmaId] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/returns/stats");
      const data = await res.json();
      if (data.success) {
        setStats({
          pendingCount: data.pendingCount || 0,
          overdueCount: data.overdueCount || 0,
          highPriorityCount: data.highPriorityCount || 0
        });
      }
    } catch (err) {
      console.warn("Failed to fetch return stats:", err);
    }
  }, []);

  const fetchQueue = useCallback(async (isLoadMore = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter !== "all") params.append("request_type", typeFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);
      if (slaFilter !== "all") params.append("sla_state", slaFilter);
      if (staffFilter !== "all") params.append("assigned_staff", staffFilter);

      if (isLoadMore && nextCursor) {
        params.append("cursor", nextCursor);
      }

      params.append("pageSize", "25");

      const res = await fetch(`/api/admin/returns?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        if (isLoadMore) {
          setItems((prev) => [...prev, ...(data.items || [])]);
        } else {
          setItems(data.items || []);
        }
        setHasMore(data.hasMore || false);
        setNextCursor(data.nextCursor || null);
      }
    } catch (err) {
      console.error("Failed to fetch RMA queue:", err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, priorityFilter, slaFilter, staffFilter, nextCursor]);

  useEffect(() => {
    fetchStats();
    fetchQueue(false);
  }, [search, statusFilter, typeFilter, priorityFilter, slaFilter, staffFilter]);

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (statusFilter !== "all") params.append("status", statusFilter);
    if (typeFilter !== "all") params.append("request_type", typeFilter);

    window.open(`/api/admin/returns/export?${params.toString()}`, "_blank");
  };

  const handleApproveSubmit = async (payload: any) => {
    if (!approvalModalRmaId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/returns/${approvalModalRmaId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setApprovalModalRmaId(null);
        fetchQueue(false);
        fetchStats();
      } else {
        alert(data.error || "Approval failed.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (payload: any) => {
    if (!rejectionModalRmaId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/returns/${rejectionModalRmaId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setRejectionModalRmaId(null);
        fetchQueue(false);
        fetchStats();
      } else {
        alert(data.error || "Rejection failed.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestInfoSubmit = async (payload: any) => {
    if (!infoModalRmaId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/returns/${infoModalRmaId}/request-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setInfoModalRmaId(null);
        fetchQueue(false);
        fetchStats();
      } else {
        alert(data.error || "Failed to request info.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePickupSubmit = async (payload: any) => {
    if (!pickupModalRmaId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/returns/${pickupModalRmaId}/pickup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setPickupModalRmaId(null);
        fetchQueue(false);
        fetchStats();
      } else {
        alert(data.error || "Failed to schedule pickup.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async (id: string, note: string, noteType: string) => {
    try {
      const res = await fetch(`/api/admin/returns/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, note_type: noteType })
      });
      const data = await res.json();
      return data.success;
    } catch (err) {
      return false;
    }
  };

  const handleTransitionStatus = async (id: string, targetStatus: string, reason?: string) => {
    try {
      const res = await fetch(`/api/admin/returns/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus, reason })
      });
      const data = await res.json();
      if (data.success) {
        fetchQueue(false);
        fetchStats();
      }
      return data.success;
    } catch (err) {
      return false;
    }
  };

  return (
    <div className="space-y-6 pt-4">
      {/* Header Cards Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Pending Review</span>
            <div className="text-2xl font-bold text-stone-900">{stats.pendingCount}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Overdue SLA</span>
            <div className="text-2xl font-bold text-rose-600">{stats.overdueCount}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-800 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">High / Urgent Priority</span>
            <div className="text-2xl font-bold text-purple-700">{stats.highPriorityCount}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-800 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <RmaFilters
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        slaFilter={slaFilter}
        onSlaFilterChange={setSlaFilter}
        staffFilter={staffFilter}
        onStaffFilterChange={setStaffFilter}
        onRefresh={() => {
          fetchStats();
          fetchQueue(false);
        }}
        onExport={handleExportCsv}
        loading={loading}
      />

      {/* Queue Table */}
      <RmaQueue
        items={items}
        onViewDetail={(id) => setSelectedRmaId(id)}
        onApprove={(id) => setApprovalModalRmaId(id)}
        onReject={(id) => setRejectionModalRmaId(id)}
        onRequestInfo={(id) => setInfoModalRmaId(id)}
        onSchedulePickup={(id) => setPickupModalRmaId(id)}
        onAssignStaff={(id) => alert(`Assigned to current user`)}
        loading={loading}
      />

      {/* Pagination Load More */}
      {hasMore && (
        <div className="text-center pt-2">
          <button
            onClick={() => fetchQueue(true)}
            disabled={loading}
            className="px-6 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            {loading ? "Loading..." : "Load More Requests"}
          </button>
        </div>
      )}

      {/* Detail Slide Drawer */}
      {selectedRmaId && (
        <RmaDetailDrawer
          rmaId={selectedRmaId}
          onClose={() => setSelectedRmaId(null)}
          onApprove={(id) => setApprovalModalRmaId(id)}
          onReject={(id) => setRejectionModalRmaId(id)}
          onRequestInfo={(id) => setInfoModalRmaId(id)}
          onSchedulePickup={(id) => setPickupModalRmaId(id)}
          onAssignStaff={(id) => alert("Assigned")}
          onPriorityChange={(id, p) => alert(`Priority updated to ${p}`)}
          onAddNote={handleAddNote}
          onTransitionStatus={handleTransitionStatus}
        />
      )}

      {/* Modals */}
      {approvalModalRmaId && (
        <RmaApprovalModal
          rmaNumber={approvalModalRmaId}
          items={[]}
          resolution="refund_source"
          onConfirm={handleApproveSubmit}
          onClose={() => setApprovalModalRmaId(null)}
          loading={actionLoading}
        />
      )}

      {rejectionModalRmaId && (
        <RmaRejectionModal
          rmaNumber={rejectionModalRmaId}
          onConfirm={handleRejectSubmit}
          onClose={() => setRejectionModalRmaId(null)}
          loading={actionLoading}
        />
      )}

      {infoModalRmaId && (
        <RmaInformationRequestModal
          rmaNumber={infoModalRmaId}
          onConfirm={handleRequestInfoSubmit}
          onClose={() => setInfoModalRmaId(null)}
          loading={actionLoading}
        />
      )}

      {pickupModalRmaId && (
        <RmaPickupModal
          rmaNumber={pickupModalRmaId}
          onConfirm={handlePickupSubmit}
          onClose={() => setPickupModalRmaId(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
};
