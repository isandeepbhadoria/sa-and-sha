import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  FileText,
  RotateCcw,
  XCircle,
  HelpCircle,
  AlertCircle,
  MapPin,
  Clock,
  ShieldCheck,
  Truck
} from "lucide-react";
import { OrderStatusTimeline, TimelineStep } from "../components/customer-orders/OrderStatusTimeline";
import { OrderItems, OrderLineItem } from "../components/customer-orders/OrderItems";
import { OrderPaymentSummary } from "../components/customer-orders/OrderPaymentSummary";
import { OrderTrackingPanel } from "../components/customer-orders/OrderTrackingPanel";
import { OrderNotificationHistory, OrderNotificationLog } from "../components/customer-orders/OrderNotificationHistory";
import { CancelOrderModal } from "../components/customer-orders/CancelOrderModal";
import { ReorderPreviewModal, ReorderPreviewData } from "../components/customer-orders/ReorderPreviewModal";
import { OrderHelpModal } from "../components/customer-orders/OrderHelpModal";

export const CustomerOrderDetailsPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<any>(null);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [showReorderModal, setShowReorderModal] = useState(false);
  const [reorderPreviewData, setReorderPreviewData] = useState<ReorderPreviewData | null>(null);
  const [reorderLoading, setReorderLoading] = useState(false);

  const [showHelpModal, setShowHelpModal] = useState(false);

  const fetchOrderDetail = async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("kora_customer_auth_token") || localStorage.getItem("verification_token") || "";
      const res = await fetch(`/api/customer/orders/${orderId}`, {
        headers: {
          "x-verification-token": token,
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 401) {
          setError("Please log in or verify via OTP to view this order.");
        } else {
          setError(data.error || "Order not found.");
        }
        return;
      }

      setOrder(data.order);
    } catch (err) {
      console.error("Error fetching order detail:", err);
      setError("Network error while connecting to server.");
    } finally {
      setLoading(false);
    }
  };

  const fetchCreditNotes = async () => {
    if (!orderId) return;
    try {
      const token = localStorage.getItem("kora_customer_auth_token") || localStorage.getItem("verification_token") || "";
      const res = await fetch(`/api/customer/orders/${orderId}/credit-notes`, {
        headers: {
          "x-verification-token": token,
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.creditNotes)) {
        setCreditNotes(data.creditNotes);
      }
    } catch (err) {
      console.error("Error fetching credit notes:", err);
    }
  };

  useEffect(() => {
    fetchOrderDetail();
    fetchCreditNotes();
  }, [orderId]);

  const handleCreditNoteDownload = async (cnId: string, cnNumber?: string) => {
    const token = localStorage.getItem("kora_customer_auth_token") || localStorage.getItem("verification_token") || "";
    try {
      const res = await fetch(`/api/customer/credit-notes/${encodeURIComponent(cnId)}/pdf`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-verification-token": token
        }
      });
      if (!res.ok) {
        alert("Failed to download GST Credit Note.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Sa-and-Sha-Credit-Note-${(cnNumber || cnId).replace(/[\/\\]/g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading credit note:", err);
      alert("Failed to download credit note.");
    }
  };

  const handleInvoiceDownload = async () => {
    if (!orderId) return;
    const token = localStorage.getItem("kora_customer_auth_token") || localStorage.getItem("verification_token") || "";
    try {
      const res = await fetch(`/api/customer/orders/${orderId}/invoice?format=pdf`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-verification-token": token
        }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Tax invoice is not available yet." }));
        alert(err.error || "Tax invoice is not available yet.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Sa-and-Sha-Tax-Invoice-${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading invoice:", err);
      alert("Failed to download tax invoice.");
    }
  };

  const handleCancelConfirm = async (reason: string) => {
    if (!orderId) return;
    setCancelLoading(true);
    try {
      const token = localStorage.getItem("kora_customer_auth_token") || localStorage.getItem("verification_token") || "";
      const res = await fetch(`/api/customer/orders/${orderId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-verification-token": token,
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Failed to cancel order.");
        return;
      }

      alert(data.message || "Order cancelled successfully.");
      setShowCancelModal(false);
      fetchOrderDetail();
    } catch (err) {
      alert("Error cancelling order.");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleReorderClick = async () => {
    setShowReorderModal(true);
    setReorderLoading(true);
    setReorderPreviewData(null);

    try {
      const token = localStorage.getItem("kora_customer_auth_token") || localStorage.getItem("verification_token") || "";
      const res = await fetch(`/api/customer/orders/${orderId}/reorder-preview`, {
        method: "POST",
        headers: {
          "x-verification-token": token,
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setReorderPreviewData(data);
      } else {
        alert(data.error || "Failed to preview reorder.");
        setShowReorderModal(false);
      }
    } catch (err) {
      alert("Error loading reorder preview.");
      setShowReorderModal(false);
    } finally {
      setReorderLoading(false);
    }
  };

  const handleConfirmAddToCart = (availableItems: any[]) => {
    try {
      const existingCart = JSON.parse(localStorage.getItem("kora_cart") || "[]");
      const updatedCart = [...existingCart, ...availableItems];
      localStorage.setItem("kora_cart", JSON.stringify(updatedCart));
      alert(`${availableItems.length} items added to your shopping bag!`);
      setShowReorderModal(false);
      navigate("/shop");
    } catch (e) {
      alert("Added items to bag.");
      setShowReorderModal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 py-20 px-4 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-stone-900 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold text-stone-600">Retrieving order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-stone-50 py-16 px-4">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-600 mx-auto" />
          <h2 className="text-lg font-serif font-bold text-stone-900">Unable to Display Order</h2>
          <p className="text-xs text-stone-500">{error || "Order not found."}</p>
          <Link
            to="/account/orders"
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Orders List</span>
          </Link>
        </div>
      </div>
    );
  }

  const isDelivered = ["delivered", "completed"].includes(order.order_status);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/account/orders"
            className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Orders</span>
          </Link>

          <span className="text-xs text-stone-500 font-mono">Order Details</span>
        </div>

        {/* Top Header Card */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-serif font-bold text-stone-900">
                Order #{order.order_id}
              </h1>
              <span className="px-3 py-1 text-xs font-bold rounded-full bg-stone-100 text-stone-800 border border-stone-200 uppercase tracking-wider">
                {order.order_status}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Placed on{" "}
              {new Date(order.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleInvoiceDownload}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors border border-stone-300"
            >
              <FileText className="w-4 h-4 text-stone-600" />
              <span>Tax Invoice</span>
            </button>

            {creditNotes.length === 1 && (
              <button
                onClick={() => handleCreditNoteDownload(creditNotes[0].credit_note_id || creditNotes[0].credit_note_number, creditNotes[0].credit_note_number)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors border border-emerald-300"
              >
                <FileText className="w-4 h-4 text-emerald-700" />
                <span>GST Credit Note</span>
              </button>
            )}

            <button
              onClick={handleReorderClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors border border-amber-200"
            >
              <RotateCcw className="w-4 h-4 text-amber-700" />
              <span>Buy Again</span>
            </button>

            {order.can_cancel && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-colors border border-red-200"
              >
                <XCircle className="w-4 h-4 text-red-600" />
                <span>Cancel Order</span>
              </button>
            )}

            <button
              onClick={() => setShowHelpModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-stone-700 bg-stone-50 hover:bg-stone-100 rounded-xl transition-colors border border-stone-200"
            >
              <HelpCircle className="w-4 h-4 text-stone-500" />
              <span>Need Help?</span>
            </button>
          </div>
        </div>

        {/* Grid Layout: Main vs Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main 2 Cols */}
          <div className="lg:col-span-2 space-y-6">
            {/* Timeline */}
            <OrderStatusTimeline steps={order.timeline || []} currentStatus={order.order_status} />

            {/* Item List */}
            <OrderItems
              items={order.items || []}
              isDelivered={isDelivered}
              onReviewClick={(pId, pName) => alert(`Review form for ${pName}`)}
            />

            {/* Tracking Panel */}
            <OrderTrackingPanel
              courierName={order.courier_name}
              trackingNumber={order.tracking_number}
              trackingUrl={order.tracking_url}
              estimatedDelivery={order.estimated_delivery}
              city={order.city}
              state={order.state}
            />

            {/* Communication History */}
            <OrderNotificationHistory notifications={order.notifications || []} />

            {/* Finalized GST Credit Notes List */}
            {creditNotes.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-serif font-bold text-stone-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-700" />
                    <span>GST Credit Notes ({creditNotes.length})</span>
                  </h3>
                  <span className="text-[11px] font-medium text-stone-500">Section 34 Statutory Reversals</span>
                </div>

                <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
                  {creditNotes.map((cn) => (
                    <div
                      key={cn.credit_note_id || cn.credit_note_number}
                      className="p-4 bg-stone-50 hover:bg-stone-100/80 transition-colors flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 font-mono font-bold text-stone-900">
                          <span>{cn.credit_note_number}</span>
                          <span className="px-2 py-0.5 text-[10px] rounded-md bg-emerald-100 text-emerald-800 uppercase font-semibold">
                            {cn.status || "ISSUED"}
                          </span>
                        </div>
                        <p className="text-stone-500">
                          Issued: {new Date(cn.issue_date || cn.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          {cn.rma_number ? ` • RMA: ${cn.rma_number}` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-[10px] text-stone-400 block uppercase font-medium">Credited Total</span>
                          <span className="font-bold text-stone-900 text-sm font-mono">
                            ₹{(cn.grand_total_reversal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <button
                          onClick={() => handleCreditNoteDownload(cn.credit_note_id || cn.credit_note_number, cn.credit_note_number)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Download PDF</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Payment Summary */}
            <OrderPaymentSummary
              subtotal={order.subtotal}
              discount={order.discount}
              promoCode={order.promo_code}
              loyaltyPointsRedeemed={order.loyalty_points_redeemed}
              storeCreditRedeemedRupees={order.store_credit_redeemed_rupees}
              shippingCost={order.shipping_cost}
              grandTotal={order.grand_total}
              paymentMethod={order.payment_method}
              paymentStatus={order.payment_status}
              refundStatus={order.refund_status}
              refundAmount={order.refund_amount}
              pointsRestored={order.points_restored}
              creditRestoredRupees={order.credit_restored_rupees}
            />

            {/* Shipping Address Box */}
            <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-800" />
                <span>Shipping Address</span>
              </h3>
              <div className="text-xs text-stone-700 leading-relaxed font-medium">
                <p className="font-bold text-stone-900">{order.customer_name}</p>
                <p>{order.address}</p>
                <p>{order.city}, {order.state} - {order.pincode}</p>
                <p className="mt-2 text-stone-500 font-mono">Phone: {order.customer_phone}</p>
                {order.customer_email && (
                  <p className="text-stone-500 font-mono">Email: {order.customer_email}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CancelOrderModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        orderNumber={order?.order_id || ""}
        onConfirmCancel={handleCancelConfirm}
        loading={cancelLoading}
      />

      <ReorderPreviewModal
        isOpen={showReorderModal}
        onClose={() => setShowReorderModal(false)}
        previewData={reorderPreviewData}
        loading={reorderLoading}
        onConfirmAddToCart={handleConfirmAddToCart}
      />

      <OrderHelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        orderNumber={order?.order_id || ""}
      />
    </div>
  );
};
