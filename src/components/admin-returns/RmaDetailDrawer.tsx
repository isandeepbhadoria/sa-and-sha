import React, { useState, useEffect } from "react";
import {
  X,
  User,
  ShoppingBag,
  Camera,
  Clock,
  MessageSquare,
  DollarSign,
  RefreshCw,
  Truck,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  UserCheck,
  ShieldCheck,
  Tag
} from "lucide-react";
import { RmaEvidencePanel } from "./RmaEvidencePanel";
import { RmaStatusTimeline } from "./RmaStatusTimeline";
import { RmaFinancialPreview } from "./RmaFinancialPreview";
import { RmaExchangePreview } from "./RmaExchangePreview";
import { RmaInternalNotes } from "./RmaInternalNotes";

export interface RmaDetailDrawerProps {
  rmaId: string | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRequestInfo: (id: string) => void;
  onSchedulePickup: (id: string) => void;
  onAssignStaff: (id: string) => void;
  onPriorityChange: (id: string, priority: "normal" | "high" | "urgent") => void;
  onAddNote: (id: string, note: string, noteType: string) => Promise<boolean>;
  onTransitionStatus: (id: string, targetStatus: string, reason?: string) => Promise<boolean>;
}

export const RmaDetailDrawer: React.FC<RmaDetailDrawerProps> = ({
  rmaId,
  onClose,
  onApprove,
  onReject,
  onRequestInfo,
  onSchedulePickup,
  onAssignStaff,
  onPriorityChange,
  onAddNote,
  onTransitionStatus,
}) => {
  const [loading, setLoading] = useState(false);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"evidence" | "timeline" | "notes" | "previews" | "context">("evidence");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rmaId) return;

    let isMounted = true;
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/returns/${rmaId}`);
        const data = await res.json();
        if (isMounted) {
          if (data.success && data.return_request) {
            setDetailData(data.return_request);
          } else {
            setError(data.error || "Failed to load RMA detail");
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Network error loading detail");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [rmaId]);

  if (!rmaId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex justify-end transition-opacity">
      <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col overflow-hidden border-l border-stone-200">
        {/* Drawer Header */}
        <div className="p-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold tracking-tight">RMA Detail: {detailData?.rma_number || rmaId}</h3>
              {detailData?.priority && (
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                    detailData.priority === "urgent"
                      ? "bg-rose-500 text-white"
                      : detailData.priority === "high"
                      ? "bg-amber-500 text-white"
                      : "bg-stone-700 text-stone-200"
                  }`}
                >
                  {detailData.priority} Priority
                </span>
              )}
            </div>
            <p className="text-xs text-stone-400">Order #{detailData?.order_id || "N/A"}</p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-800 transition cursor-pointer text-stone-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 p-12 text-center text-stone-500 text-xs">Loading RMA evidence package...</div>
        ) : error ? (
          <div className="flex-1 p-12 text-center text-rose-600 text-xs">{error}</div>
        ) : detailData ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Quick Action Ribbon */}
            <div className="p-3 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-stone-700">Status:</span>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-[#B08D57] text-white">
                  {detailData.status?.replace("_", " ")}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {["requested", "under_review", "information_required"].includes(detailData.status) && (
                  <>
                    <button
                      onClick={() => onApprove(rmaId)}
                      className="px-3 py-1.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition cursor-pointer flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() => onReject(rmaId)}
                      className="px-3 py-1.5 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition cursor-pointer flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                    <button
                      onClick={() => onRequestInfo(rmaId)}
                      className="px-3 py-1.5 font-semibold text-stone-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      Request Info
                    </button>
                  </>
                )}

                {detailData.status === "approved" && (
                  <button
                    onClick={() => onSchedulePickup(rmaId)}
                    className="px-3 py-1.5 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition cursor-pointer flex items-center gap-1"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Schedule Pickup
                  </button>
                )}
              </div>
            </div>

            {/* Sub Tabs Navigation */}
            <div className="flex border-b border-stone-200 bg-white overflow-x-auto text-xs shrink-0">
              <button
                onClick={() => setActiveSubTab("evidence")}
                className={`py-3 px-4 font-bold uppercase tracking-wider border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === "evidence" ? "border-[#B08D57] text-[#B08D57]" : "border-transparent text-stone-500 hover:text-stone-900"
                }`}
              >
                <Camera className="w-4 h-4" />
                Evidence Package
              </button>

              <button
                onClick={() => setActiveSubTab("previews")}
                className={`py-3 px-4 font-bold uppercase tracking-wider border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === "previews" ? "border-[#B08D57] text-[#B08D57]" : "border-transparent text-stone-500 hover:text-stone-900"
                }`}
              >
                <DollarSign className="w-4 h-4" />
                Financial & Exchange
              </button>

              <button
                onClick={() => setActiveSubTab("context")}
                className={`py-3 px-4 font-bold uppercase tracking-wider border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === "context" ? "border-[#B08D57] text-[#B08D57]" : "border-transparent text-stone-500 hover:text-stone-900"
                }`}
              >
                <User className="w-4 h-4" />
                Customer & Order Context
              </button>

              <button
                onClick={() => setActiveSubTab("timeline")}
                className={`py-3 px-4 font-bold uppercase tracking-wider border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === "timeline" ? "border-[#B08D57] text-[#B08D57]" : "border-transparent text-stone-500 hover:text-stone-900"
                }`}
              >
                <Clock className="w-4 h-4" />
                Status Timeline
              </button>

              <button
                onClick={() => setActiveSubTab("notes")}
                className={`py-3 px-4 font-bold uppercase tracking-wider border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === "notes" ? "border-[#B08D57] text-[#B08D57]" : "border-transparent text-stone-500 hover:text-stone-900"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Internal Notes ({detailData.internal_notes?.length || 0})
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {activeSubTab === "evidence" && (
                <RmaEvidencePanel
                  items={detailData.items}
                  photos={detailData.evidence_photos || detailData.photos}
                  reason={detailData.reason}
                  reasonDetails={detailData.reason_details}
                  resolution={detailData.resolution}
                  orderContext={detailData.order_context}
                />
              )}

              {activeSubTab === "previews" && (
                <div className="space-y-6">
                  <RmaFinancialPreview financialPreview={detailData.financial_preview} resolution={detailData.resolution} />
                  <RmaExchangePreview exchangePreview={detailData.exchange_preview} />
                </div>
              )}

              {activeSubTab === "context" && (
                <div className="space-y-6 text-xs">
                  {/* Customer Context */}
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
                    <h4 className="font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-200 pb-2">
                      <User className="w-4 h-4 text-[#B08D57]" />
                      Customer Intelligence Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-stone-700">
                      <div>
                        <span className="text-stone-400">Customer Name:</span>
                        <div className="font-semibold text-stone-900">{detailData.customer_name}</div>
                      </div>
                      <div>
                        <span className="text-stone-400">Business Customer ID:</span>
                        <div className="font-mono font-bold text-stone-900">
                          {detailData.customer_context?.business_customer_id || detailData.customer_profile_id}
                        </div>
                      </div>
                      <div>
                        <span className="text-stone-400">Tier Level:</span>
                        <div className="font-bold uppercase text-amber-800">{detailData.customer_context?.tier || "Silver"}</div>
                      </div>
                      <div>
                        <span className="text-stone-400">Total Lifetime Spend:</span>
                        <div className="font-bold text-stone-900">
                          ₹{detailData.customer_context?.lifetime_spend?.toLocaleString("en-IN") || 0}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Order Context */}
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
                    <h4 className="font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-200 pb-2">
                      <ShoppingBag className="w-4 h-4 text-[#B08D57]" />
                      Immutable Order Snapshot
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-stone-700">
                      <div>
                        <span className="text-stone-400">Order ID:</span>
                        <div className="font-bold text-stone-900">#{detailData.order_id}</div>
                      </div>
                      <div>
                        <span className="text-stone-400">Payment Method:</span>
                        <div className="font-semibold text-stone-900">{detailData.order_context?.payment_method || "Online"}</div>
                      </div>
                      <div>
                        <span className="text-stone-400">Delivered Date:</span>
                        <div className="font-semibold text-stone-900">{detailData.order_context?.delivered_at || "Delivered"}</div>
                      </div>
                      <div>
                        <span className="text-stone-400">Original Courier / AWB:</span>
                        <div className="font-semibold text-stone-900">
                          {detailData.order_context?.courier} ({detailData.order_context?.tracking_number})
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSubTab === "timeline" && (
                <RmaStatusTimeline
                  status={detailData.status}
                  timeline={detailData.timeline || []}
                  statusHistory={detailData.status_history || []}
                  onTransition={(targetStatus, reason) => onTransitionStatus(rmaId, targetStatus, reason)}
                />
              )}

              {activeSubTab === "notes" && (
                <RmaInternalNotes
                  notes={detailData.internal_notes || []}
                  onAddNote={(note, noteType) => onAddNote(rmaId, note, noteType)}
                />
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
