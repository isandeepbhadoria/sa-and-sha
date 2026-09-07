import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  RotateCcw,
  RefreshCw,
  Package,
  CheckCircle2,
  AlertCircle,
  Clock,
  Truck,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  X,
  Upload,
  Image as ImageIcon,
  HelpCircle,
  DollarSign,
  Gift,
  Search,
  Calendar,
  User,
  Filter,
  FileText
} from "lucide-react";

export interface ReturnItem {
  product_id: string;
  name: string;
  original_size?: string;
  requested_size?: string;
  color?: string;
  quantity: number;
  price_paid: number;
  action: "return" | "exchange";
  reason?: string;
  reason_notes?: string;
  evidence_images?: string[];
}

export interface ReturnTimelineStep {
  status: string;
  title: string;
  description: string;
  timestamp: string;
}

export interface CustomerReturnRecord {
  id: string;
  rma_number: string;
  request_id?: string;
  order_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  request_type: "return" | "exchange" | "mixed";
  resolution: "refund_source" | "store_credit" | "exchange";
  reason: string;
  reason_details?: string;
  photos?: string[];
  items: ReturnItem[];
  return_shipping_fee: number;
  estimated_refund_total: number;
  status: string;
  status_label?: string;
  cancellation_reason?: string;
  pickup_address?: any;
  timeline: ReturnTimelineStep[];
  created_at: string;
  updated_at: string;
}

const REASON_OPTIONS = [
  "Wrong Size",
  "Wrong Colour",
  "Quality Issue",
  "Damaged",
  "Received Wrong Product",
  "Missing Item",
  "Changed Mind",
  "Other"
];

const AVAILABLE_SIZES = ["S", "M", "L", "XL", "XXL", "38", "40", "42", "44"];

export const CustomerReturnsPage: React.FC = () => {
  const navigate = useNavigate();

  // Primary Data & Filter States
  const [activeTab, setActiveTab] = useState<"active" | "completed" | "rejected" | "cancelled">("active");
  const [returnsList, setReturnsList] = useState<CustomerReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal State
  const [selectedReturn, setSelectedReturn] = useState<CustomerReturnRecord | null>(null);
  const [cancelModalId, setCancelModalId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Wizard Modal State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [deliveredOrders, setDeliveredOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [eligibilityChecking, setEligibilityChecking] = useState(false);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);

  // Selected Return Items in Wizard
  // Key: item index or product_id + size
  const [wizardItems, setWizardItems] = useState<
    Array<{
      item: any;
      selected: boolean;
      quantity: number;
      action: "return" | "exchange";
      requested_size?: string;
    }>
  >([]);

  // Step 3 Inputs
  const [primaryReason, setPrimaryReason] = useState("Wrong Size");
  const [reasonDetails, setReasonDetails] = useState("");
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Step 4 Resolution Input
  const [resolution, setResolution] = useState<"refund_source" | "store_credit" | "exchange">("refund_source");

  // Wizard Submitting
  const [submittingWizard, setSubmittingWizard] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [wizardSuccessRma, setWizardSuccessRma] = useState<string | null>(null);

  // Auth token getter
  const getAuthToken = () => {
    return (
      localStorage.getItem("kora_customer_auth_token") ||
      localStorage.getItem("verification_token") ||
      ""
    );
  };

  const handleDownloadCreditNote = async (identifier: string) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/customer/returns/${encodeURIComponent(identifier)}/credit-note/pdf`, {
        headers: {
          "x-verification-token": token,
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        let errMessage = "GST Credit Note is not available for this return yet.";
        try {
          const errData = await res.json();
          if (errData.error) errMessage = errData.error;
        } catch (_) {}
        alert(errMessage);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Kora-Linen-Credit-Note-${identifier.replace(/[\/\\]/g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading credit note:", err);
      alert("Failed to download GST Credit Note.");
    }
  };

  // Fetch Returns List
  const fetchReturns = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/customer/returns?status=${activeTab}`, {
        headers: {
          "x-verification-token": token,
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 401) {
          setError("Please log in or verify your mobile number via OTP to view returns.");
        } else {
          setError(data.error || "Failed to load return requests.");
        }
        return;
      }

      setReturnsList(data.returns || []);
    } catch (err) {
      console.error("Error fetching customer returns:", err);
      setError("Unable to connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, [activeTab]);

  // Fetch Delivered Orders for Return Wizard
  const fetchDeliveredOrders = async () => {
    setLoadingOrders(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/customer/orders?status=delivered&pageSize=20`, {
        headers: {
          "x-verification-token": token,
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeliveredOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Error loading delivered orders:", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleOpenWizard = () => {
    setIsWizardOpen(true);
    setWizardStep(1);
    setSelectedOrder(null);
    setWizardItems([]);
    setPrimaryReason("Wrong Size");
    setReasonDetails("");
    setUploadedPhotos([]);
    setResolution("refund_source");
    setWizardError(null);
    setWizardSuccessRma(null);
    fetchDeliveredOrders();
  };

  // Select Order in Wizard
  const handleSelectOrder = async (order: any) => {
    setSelectedOrder(order);
    setEligibilityChecking(true);
    setEligibilityError(null);

    try {
      const token = getAuthToken();
      const res = await fetch(`/api/customer/returns/eligibility/${order.order_id || order.id}`, {
        headers: {
          "x-verification-token": token,
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();

      if (!data.eligible) {
        setEligibilityError(data.reason || "This order is not eligible for return or exchange.");
        setEligibilityChecking(false);
        return;
      }

      // Initialize wizard items
      const rawItems = Array.isArray(order.items) ? order.items : [];
      const initialized = rawItems.map((it: any) => ({
        item: it,
        selected: false,
        quantity: 1,
        action: "return" as "return" | "exchange",
        requested_size: it.size || "M"
      }));

      setWizardItems(initialized);
      setEligibilityChecking(false);
      setWizardStep(2);
    } catch (err) {
      console.error("Eligibility check error:", err);
      setEligibilityError("Failed to check return eligibility for this order.");
      setEligibilityChecking(false);
    }
  };

  // Image Upload Handler with client-side canvas compression
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadedPhotos.length + files.length > 6) {
      alert("Maximum 6 images allowed per return request.");
      return;
    }

    setUploadingImage(true);

    Array.from(files).forEach((file: File) => {
      if (!file.type.startsWith("image/")) {
        alert("Please upload valid JPEG, PNG, or WEBP images.");
        setUploadingImage(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.75);

          setUploadedPhotos((prev) => [...prev, compressedDataUrl]);
          setUploadingImage(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle Return Submit
  const handleSubmitReturnWizard = async () => {
    const selectedItems = wizardItems.filter((wi) => wi.selected);
    if (selectedItems.length === 0) {
      setWizardError("Please select at least one item to return or exchange.");
      return;
    }

    setSubmittingWizard(true);
    setWizardError(null);

    try {
      const token = getAuthToken();
      const payload = {
        order_id: selectedOrder.order_id || selectedOrder.id,
        items: selectedItems.map((wi) => ({
          product_id: wi.item.product_id || wi.item.id,
          name: wi.item.name || "Apparel Item",
          size: wi.item.size || "M",
          color: wi.item.color || "Standard",
          quantity: wi.quantity,
          price_paid: Number(wi.item.price || 0),
          action: wi.action,
          reason: primaryReason,
          reason_notes: reasonDetails,
          requested_size: wi.action === "exchange" ? wi.requested_size : undefined
        })),
        reason: primaryReason,
        reason_details: reasonDetails,
        photos: uploadedPhotos,
        resolution: resolution
      };

      const res = await fetch(`/api/customer/returns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-verification-token": token,
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setWizardError(data.error || "Failed to submit return request. Please try again.");
        return;
      }

      setWizardSuccessRma(data.rma_number);
      fetchReturns();
    } catch (err) {
      console.error("Submit return request error:", err);
      setWizardError("Network error while submitting request. Please try again.");
    } finally {
      setSubmittingWizard(false);
    }
  };

  // Handle Cancel Return Request
  const handleCancelReturn = async (rmaId: string) => {
    setCancelling(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/customer/returns/${rmaId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-verification-token": token,
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: cancelReason || "Cancelled by customer" })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCancelModalId(null);
        setCancelReason("");
        setSelectedReturn(null);
        fetchReturns();
      } else {
        alert(data.error || "Failed to cancel return request.");
      }
    } catch (err) {
      console.error("Cancel error:", err);
      alert("Error cancelling return request.");
    } finally {
      setCancelling(false);
    }
  };

  // Status Badge Styling Helper
  const renderStatusBadge = (status: string) => {
    const st = (status || "").toLowerCase();
    switch (st) {
      case "requested":
      case "under_review":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Under Review</span>
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Approved</span>
          </span>
        );
      case "pickup_scheduled":
      case "picked_up":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <Truck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Pickup Scheduled</span>
          </span>
        );
      case "warehouse_inspection":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            <span>Warehouse Inspection</span>
          </span>
        );
      case "refund_approved":
      case "completed":
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Completed / Refunded</span>
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <X className="w-3.5 h-3.5 text-rose-600" />
            <span>Request Rejected</span>
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200">
            <X className="w-3.5 h-3.5 text-stone-400" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 text-stone-800">
      {/* Top Header Breadcrumb & Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 border-b border-stone-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-stone-500 mb-2 font-medium">
            <Link to="/account" className="hover:text-stone-900 transition-colors">
              Customer Portal
            </Link>
            <ChevronRight className="w-3 h-3 text-stone-400" />
            <span className="text-stone-900 font-semibold">Returns & Exchanges</span>
          </div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-stone-900">
            Returns & Exchanges Portal
          </h1>
          <p className="text-xs md:text-sm text-stone-600 mt-1">
            Track active requests, schedule pickup details, and submit new return/exchange requests.
          </p>
        </div>

        <button
          onClick={handleOpenWizard}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 transition-colors shadow-xs"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Request Return / Exchange</span>
        </button>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-2 border-b border-stone-200 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap ${
            activeTab === "active"
              ? "bg-white border-t-2 border-stone-900 text-stone-900 shadow-xs"
              : "text-stone-500 hover:text-stone-800"
          }`}
        >
          Active Requests
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap ${
            activeTab === "completed"
              ? "bg-white border-t-2 border-stone-900 text-stone-900 shadow-xs"
              : "text-stone-500 hover:text-stone-800"
          }`}
        >
          Completed
        </button>
        <button
          onClick={() => setActiveTab("rejected")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap ${
            activeTab === "rejected"
              ? "bg-white border-t-2 border-stone-900 text-stone-900 shadow-xs"
              : "text-stone-500 hover:text-stone-800"
          }`}
        >
          Rejected
        </button>
        <button
          onClick={() => setActiveTab("cancelled")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap ${
            activeTab === "cancelled"
              ? "bg-white border-t-2 border-stone-900 text-stone-900 shadow-xs"
              : "text-stone-500 hover:text-stone-800"
          }`}
        >
          Cancelled
        </button>
      </div>

      {/* Loading & Error States */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-stone-400 animate-spin mx-auto" />
          <p className="text-xs text-stone-500 font-medium">Fetching return requests...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-xs md:text-sm font-semibold text-rose-800">{error}</p>
          <button
            onClick={fetchReturns}
            className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : returnsList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center space-y-4">
          <RotateCcw className="w-12 h-12 text-stone-300 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-serif text-lg font-bold text-stone-900">No Return Requests Found</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              You do not have any {activeTab} return or exchange requests at this time.
            </p>
          </div>
          <button
            onClick={handleOpenWizard}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors"
          >
            Request Return or Exchange
          </button>
        </div>
      ) : (
        /* Returns Cards List */
        <div className="space-y-4">
          {returnsList.map((ret) => (
            <div
              key={ret.id}
              className="bg-white rounded-2xl border border-stone-200 p-5 md:p-6 shadow-xs hover:border-stone-300 transition-all space-y-4"
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-stone-900 uppercase">
                      {ret.rma_number || ret.request_id}
                    </span>
                    <span className="text-stone-300">•</span>
                    <span className="text-xs font-medium text-stone-500">
                      Order #{ret.order_id}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400">
                    Requested on {new Date(ret.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {renderStatusBadge(ret.status)}
                </div>
              </div>

              {/* Items Summary Row */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Items ({ret.items?.length || 0})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {ret.items?.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 border border-stone-200/60"
                    >
                      <div className="w-10 h-10 rounded-lg bg-stone-200 flex items-center justify-center shrink-0 overflow-hidden text-stone-500 text-xs font-bold">
                        {it.name ? it.name.charAt(0) : "P"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-stone-900 truncate">{it.name}</p>
                        <p className="text-[11px] text-stone-500">
                          Qty: {it.quantity} • {it.original_size || "M"}{" "}
                          {it.action === "exchange" ? `➔ New Size: ${it.requested_size}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resolution & Actions Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-stone-100 text-xs">
                <div className="flex items-center gap-4 text-stone-600">
                  <span>
                    <strong>Resolution:</strong>{" "}
                    {ret.resolution === "store_credit"
                      ? "Store Credit Wallet"
                      : ret.resolution === "exchange"
                      ? "Size / Colour Exchange"
                      : "Refund to Original Payment"}
                  </span>
                  <span>
                    <strong>Est. Refund:</strong> ₹
                    {ret.estimated_refund_total?.toLocaleString("en-IN") || 0}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedReturn(ret)}
                    className="px-4 py-2 rounded-xl bg-stone-100 text-stone-800 font-semibold hover:bg-stone-200 transition-colors"
                  >
                    View Status & Timeline
                  </button>
                  {["requested", "under_review"].includes((ret.status || "").toLowerCase()) && (
                    <button
                      onClick={() => setCancelModalId(ret.rma_number || ret.id)}
                      className="px-3 py-2 rounded-xl border border-rose-200 text-rose-700 font-medium hover:bg-rose-50 transition-colors"
                    >
                      Cancel Request
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Return Detail & Progress Tracker Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <button
              onClick={() => setSelectedReturn(null)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-stone-100 text-stone-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-stone-900 uppercase">
                  {selectedReturn.rma_number || selectedReturn.request_id}
                </span>
                {renderStatusBadge(selectedReturn.status)}
              </div>
              <p className="text-xs text-stone-500">
                Order #{selectedReturn.order_id} • Created on{" "}
                {new Date(selectedReturn.created_at).toLocaleString("en-IN")}
              </p>
            </div>

            {/* Progress Timeline */}
            <div className="space-y-3 bg-stone-50 p-4 md:p-5 rounded-2xl border border-stone-200/70">
              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                Return Progress & Status Timeline
              </h4>

              <div className="space-y-3 relative pl-4 border-l-2 border-stone-200">
                {selectedReturn.timeline?.map((step, idx) => (
                  <div key={idx} className="relative space-y-0.5">
                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-stone-900 border-2 border-white" />
                    <p className="text-xs font-bold text-stone-900">{step.title}</p>
                    <p className="text-[11px] text-stone-600">{step.description}</p>
                    <p className="text-[10px] text-stone-400">
                      {new Date(step.timestamp).toLocaleString("en-IN")}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Items Breakdown */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                Requested Items
              </h4>
              <div className="space-y-2">
                {selectedReturn.items?.map((it, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-stone-900">{it.name}</p>
                      <p className="text-stone-500">
                        Action: {it.action.toUpperCase()} • Qty: {it.quantity} • Size:{" "}
                        {it.original_size}{" "}
                        {it.requested_size ? `➔ New Size: ${it.requested_size}` : ""}
                      </p>
                    </div>
                    <p className="font-semibold text-stone-900">₹{it.price_paid}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Resolution & Shipping Fee */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-stone-100 p-4 rounded-xl">
              <div>
                <p className="text-stone-500">Resolution Preference</p>
                <p className="font-bold text-stone-900 uppercase">{selectedReturn.resolution}</p>
              </div>
              <div>
                <p className="text-stone-500">Return Pickup Fee</p>
                <p className="font-bold text-stone-900">
                  ₹{selectedReturn.return_shipping_fee}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button
                onClick={() => handleDownloadCreditNote(selectedReturn.rma_number || selectedReturn.request_id || selectedReturn.id || selectedReturn.order_id)}
                className="px-4 py-2.5 rounded-xl bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-900 transition-colors inline-flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>Download GST Credit Note</span>
              </button>

              {["requested", "under_review"].includes((selectedReturn.status || "").toLowerCase()) && (
                <button
                  onClick={() => {
                    setCancelModalId(selectedReturn.rma_number || selectedReturn.id);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50 transition-colors"
                >
                  Cancel This Request
                </button>
              )}
              <button
                onClick={() => setSelectedReturn(null)}
                className="px-5 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Request Confirmation Modal */}
      {cancelModalId && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-serif text-lg font-bold text-stone-900">Cancel Return Request</h3>
            <p className="text-xs text-stone-600">
              Are you sure you want to cancel return request <strong>{cancelModalId}</strong>?
            </p>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Reason for cancellation (optional)
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Decided to keep the item"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:ring-1 focus:ring-stone-900 outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelModalId(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-100"
              >
                Back
              </button>
              <button
                onClick={() => handleCancelReturn(cancelModalId)}
                disabled={cancelling}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Request Wizard Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <button
              onClick={() => setIsWizardOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-stone-100 text-stone-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Wizard Header */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-widest">
                Step {wizardStep} of 5
              </span>
              <h2 className="font-serif text-xl font-bold text-stone-900">
                {wizardStep === 1 && "Select Order"}
                {wizardStep === 2 && "Choose Item(s) & Quantities"}
                {wizardStep === 3 && "Select Reason & Upload Evidence"}
                {wizardStep === 4 && "Preferred Resolution Option"}
                {wizardStep === 5 && "Review & Submit Request"}
              </h2>
            </div>

            {/* Success View */}
            {wizardSuccessRma ? (
              <div className="text-center space-y-4 py-6">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h3 className="font-serif text-xl font-bold text-stone-900">
                  Return Request Submitted!
                </h3>
                <p className="text-xs text-stone-600">
                  Your RMA number is <strong>{wizardSuccessRma}</strong>. Our care team will review
                  and update your pickup schedule within 24 hours.
                </p>
                <button
                  onClick={() => setIsWizardOpen(false)}
                  className="px-6 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors"
                >
                  View Returns Dashboard
                </button>
              </div>
            ) : (
              <>
                {/* STEP 1: Select Delivered Order */}
                {wizardStep === 1 && (
                  <div className="space-y-4">
                    <p className="text-xs text-stone-600">
                      Select a delivered order within the 7-day return window to begin your return or exchange request.
                    </p>

                    {loadingOrders ? (
                      <div className="py-8 text-center text-stone-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                        <p className="text-xs">Loading delivered orders...</p>
                      </div>
                    ) : deliveredOrders.length === 0 ? (
                      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 text-center text-xs text-stone-500">
                        No delivered orders eligible for return found.
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {deliveredOrders.map((ord) => (
                          <div
                            key={ord.id}
                            onClick={() => handleSelectOrder(ord)}
                            className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                              selectedOrder?.id === ord.id
                                ? "border-stone-900 bg-stone-50 shadow-xs"
                                : "border-stone-200 hover:border-stone-400 bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold text-xs text-stone-900 mb-1">
                              <span>Order #{ord.order_id || ord.id}</span>
                              <span>₹{ord.grand_total || ord.total_amount}</span>
                            </div>
                            <p className="text-[11px] text-stone-500">
                              Delivered on: {ord.delivered_at ? new Date(ord.delivered_at).toLocaleDateString("en-IN") : "Recent"} • Items: {ord.items?.length || 0}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {eligibilityChecking && (
                      <p className="text-xs text-amber-700 font-medium">
                        Checking return eligibility for selected order...
                      </p>
                    )}
                    {eligibilityError && (
                      <p className="text-xs text-rose-600 font-semibold">{eligibilityError}</p>
                    )}
                  </div>
                )}

                {/* STEP 2: Choose Items */}
                {wizardStep === 2 && (
                  <div className="space-y-4">
                    <p className="text-xs text-stone-600">
                      Select which item(s) you wish to return or exchange:
                    </p>

                    <div className="space-y-3">
                      {wizardItems.map((wi, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-2xl border border-stone-200 space-y-3 bg-stone-50/50"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={wi.selected}
                              onChange={(e) => {
                                const next = [...wizardItems];
                                next[idx].selected = e.target.checked;
                                setWizardItems(next);
                              }}
                              className="w-4 h-4 accent-stone-900 rounded"
                            />
                            <div className="min-w-0 flex-1 text-xs">
                              <p className="font-bold text-stone-900">{wi.item.name}</p>
                              <p className="text-stone-500">
                                Size: {wi.item.size || "M"} • Price: ₹{wi.item.price}
                              </p>
                            </div>
                          </div>

                          {wi.selected && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-stone-200/60 text-xs">
                              <div>
                                <label className="block text-stone-600 font-medium mb-1">
                                  Request Action
                                </label>
                                <select
                                  value={wi.action}
                                  onChange={(e) => {
                                    const next = [...wizardItems];
                                    next[idx].action = e.target.value as "return" | "exchange";
                                    setWizardItems(next);
                                  }}
                                  className="w-full px-3 py-1.5 rounded-xl border border-stone-300 bg-white"
                                >
                                  <option value="return">Return for Refund</option>
                                  <option value="exchange">Free Exchange for Size</option>
                                </select>
                              </div>

                              {wi.action === "exchange" && (
                                <div>
                                  <label className="block text-stone-600 font-medium mb-1">
                                    New Size Requested
                                  </label>
                                  <select
                                    value={wi.requested_size}
                                    onChange={(e) => {
                                      const next = [...wizardItems];
                                      next[idx].requested_size = e.target.value;
                                      setWizardItems(next);
                                    }}
                                    className="w-full px-3 py-1.5 rounded-xl border border-stone-300 bg-white"
                                  >
                                    {AVAILABLE_SIZES.map((sz) => (
                                      <option key={sz} value={sz}>
                                        Size {sz}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between pt-4">
                      <button
                        onClick={() => setWizardStep(1)}
                        className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => {
                          if (!wizardItems.some((w) => w.selected)) {
                            alert("Please select at least one item.");
                            return;
                          }
                          setWizardStep(3);
                        }}
                        className="px-5 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold"
                      >
                        Next: Reason & Evidence
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Reason & Photos */}
                {wizardStep === 3 && (
                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="block font-bold text-stone-800 mb-1">
                        Primary Reason for Return/Exchange
                      </label>
                      <select
                        value={primaryReason}
                        onChange={(e) => setPrimaryReason(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                      >
                        {REASON_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-stone-800 mb-1">
                        Additional Notes / Comments
                      </label>
                      <textarea
                        rows={3}
                        value={reasonDetails}
                        onChange={(e) => setReasonDetails(e.target.value)}
                        placeholder="Please describe any defects, sizing issues, or fitting notes..."
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-stone-800 mb-1">
                        Upload Photos (1-6 images)
                      </label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={handleImageUpload}
                        className="text-xs text-stone-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-stone-100 file:text-stone-800 hover:file:bg-stone-200"
                      />
                      {uploadingImage && <p className="text-[11px] text-amber-600 mt-1">Compressing image...</p>}

                      {uploadedPhotos.length > 0 && (
                        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                          {uploadedPhotos.map((imgSrc, i) => (
                            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border shrink-0">
                              <img src={imgSrc} alt="uploaded" className="w-full h-full object-cover" />
                              <button
                                onClick={() =>
                                  setUploadedPhotos((prev) => prev.filter((_, idx) => idx !== i))
                                }
                                className="absolute top-0 right-0 p-0.5 bg-stone-900/80 text-white rounded-bl"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between pt-4">
                      <button
                        onClick={() => setWizardStep(2)}
                        className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => setWizardStep(4)}
                        className="px-5 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold"
                      >
                        Next: Preferred Resolution
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4: Preferred Resolution */}
                {wizardStep === 4 && (
                  <div className="space-y-4 text-xs">
                    <p className="text-stone-600">
                      Choose how you would like your return or exchange resolved:
                    </p>

                    <div className="space-y-3">
                      <label
                        className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer ${
                          resolution === "refund_source"
                            ? "border-stone-900 bg-stone-50"
                            : "border-stone-200 bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="resolution"
                          value="refund_source"
                          checked={resolution === "refund_source"}
                          onChange={() => setResolution("refund_source")}
                          className="mt-1 accent-stone-900"
                        />
                        <div>
                          <p className="font-bold text-stone-900">Refund to Original Payment Method</p>
                          <p className="text-stone-500">
                            Processed back to UPI/card after warehouse quality inspection (3-5 business days).
                          </p>
                        </div>
                      </label>

                      <label
                        className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer ${
                          resolution === "store_credit"
                            ? "border-stone-900 bg-stone-50"
                            : "border-stone-200 bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="resolution"
                          value="store_credit"
                          checked={resolution === "store_credit"}
                          onChange={() => setResolution("store_credit")}
                          className="mt-1 accent-stone-900"
                        />
                        <div>
                          <p className="font-bold text-stone-900">Instant Kora Store Credit Wallet</p>
                          <p className="text-stone-500">
                            Credited instantly to your account wallet upon pickup verification.
                          </p>
                        </div>
                      </label>

                      <label
                        className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer ${
                          resolution === "exchange"
                            ? "border-stone-900 bg-stone-50"
                            : "border-stone-200 bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="resolution"
                          value="exchange"
                          checked={resolution === "exchange"}
                          onChange={() => setResolution("exchange")}
                          className="mt-1 accent-stone-900"
                        />
                        <div>
                          <p className="font-bold text-stone-900">Size / Colour Exchange</p>
                          <p className="text-stone-500">
                            Free doorstep pickup and replacement delivery for requested size/color.
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="flex justify-between pt-4">
                      <button
                        onClick={() => setWizardStep(3)}
                        className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => setWizardStep(5)}
                        className="px-5 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold"
                      >
                        Next: Review Summary
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 5: Review & Submit */}
                {wizardStep === 5 && (
                  <div className="space-y-4 text-xs">
                    <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-2">
                      <p className="font-bold text-stone-900">Request Summary</p>
                      <p className="text-stone-600">
                        Order: #{selectedOrder?.order_id || selectedOrder?.id}
                      </p>
                      <p className="text-stone-600">Reason: {primaryReason}</p>
                      <p className="text-stone-600">Resolution: {resolution.toUpperCase()}</p>
                      <p className="text-stone-600">
                        Selected Items: {wizardItems.filter((w) => w.selected).length}
                      </p>
                    </div>

                    {wizardError && (
                      <p className="text-xs text-rose-600 font-semibold">{wizardError}</p>
                    )}

                    <div className="flex justify-between pt-4">
                      <button
                        onClick={() => setWizardStep(4)}
                        className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleSubmitReturnWizard}
                        disabled={submittingWizard}
                        className="px-6 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 disabled:opacity-50"
                      >
                        {submittingWizard ? "Submitting..." : "Confirm & Submit Return"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
