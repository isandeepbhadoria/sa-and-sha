import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Package, Search, Filter, RefreshCw, ShoppingBag, ArrowLeft, AlertCircle } from "lucide-react";
import { OrderCard, OrderSummaryItem } from "../components/customer-orders/OrderCard";
import { ReorderPreviewModal, ReorderPreviewData } from "../components/customer-orders/ReorderPreviewModal";
import { CancelOrderModal } from "../components/customer-orders/CancelOrderModal";
import { OrderHelpModal } from "../components/customer-orders/OrderHelpModal";

export const CustomerOrdersPage: React.FC = () => {
  const navigate = useNavigate();

  // Filter States
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");

  // Data States
  const [orders, setOrders] = useState<OrderSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [reorderTargetId, setReorderTargetId] = useState<string | null>(null);
  const [reorderPreviewData, setReorderPreviewData] = useState<ReorderPreviewData | null>(null);
  const [reorderLoading, setReorderLoading] = useState(false);

  const [helpTargetId, setHelpTargetId] = useState<string | null>(null);

  // Fetch verified customer orders
  const fetchOrders = async (cursor?: string, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const token = localStorage.getItem("kora_customer_auth_token") || localStorage.getItem("verification_token") || "";
      const params = new URLSearchParams();
      if (activeTab !== "all") params.set("status", activeTab);
      if (paymentMethodFilter !== "all") params.set("paymentMethod", paymentMethodFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (cursor) params.set("cursor", cursor);
      params.set("pageSize", "10");

      const res = await fetch(`/api/customer/orders?${params.toString()}`, {
        headers: {
          "x-verification-token": token,
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 401) {
          setError("Please log in or verify via OTP to access your orders.");
        } else {
          setError(data.error || "Failed to load orders.");
        }
        return;
      }

      if (append) {
        setOrders((prev) => [...prev, ...(data.orders || [])]);
      } else {
        setOrders(data.orders || []);
      }

      setNextCursor(data.nextCursor || null);
      setHasMore(!!data.hasMore);
    } catch (err) {
      console.error("Error fetching customer orders:", err);
      setError("Network error while connecting to server.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [activeTab, paymentMethodFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  const handleInvoiceClick = async (orderNumber: string) => {
    const token = localStorage.getItem("kora_customer_auth_token") || localStorage.getItem("verification_token") || "";
    try {
      const res = await fetch(`/api/customer/orders/${orderNumber}/invoice?format=pdf`, {
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
      a.download = `Kora-Linen-Tax-Invoice-${orderNumber}.pdf`;
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
    if (!cancelTargetId) return;
    setCancelLoading(true);
    try {
      const token = localStorage.getItem("kora_customer_auth_token") || localStorage.getItem("verification_token") || "";
      const res = await fetch(`/api/customer/orders/${cancelTargetId}/cancel`, {
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
      setCancelTargetId(null);
      fetchOrders(); // Refresh order list
    } catch (err) {
      alert("Error processing cancellation.");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleReorderClick = async (orderNumber: string) => {
    setReorderTargetId(orderNumber);
    setReorderLoading(true);
    setReorderPreviewData(null);

    try {
      const token = localStorage.getItem("kora_customer_auth_token") || localStorage.getItem("verification_token") || "";
      const res = await fetch(`/api/customer/orders/${orderNumber}/reorder-preview`, {
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
        setReorderTargetId(null);
      }
    } catch (err) {
      alert("Error loading reorder preview.");
      setReorderTargetId(null);
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
      setReorderTargetId(null);
      navigate("/shop");
    } catch (e) {
      alert("Added items to bag.");
      setReorderTargetId(null);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/account"
            className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Account Overview</span>
          </Link>

          <span className="text-xs text-stone-500 font-mono">My Orders & Purchases</span>
        </div>

        {/* Page Title */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-xs">
          <div>
            <h1 className="text-2xl font-serif font-bold text-stone-900 flex items-center gap-2">
              <Package className="w-6 h-6 text-amber-800" />
              <span>Orders & Purchase History</span>
            </h1>
            <p className="text-xs text-stone-500 mt-1">
              Track shipments, download tax invoices, reorder favorites, and manage returns.
            </p>
          </div>

          <button
            onClick={() => fetchOrders()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filter Tabs Bar */}
        <div className="flex items-center justify-between gap-4 border-b border-stone-200 pb-2 overflow-x-auto">
          <div className="flex items-center gap-1">
            {[
              { id: "all", label: "All Orders" },
              { id: "active", label: "Active" },
              { id: "shipped", label: "Shipped & In Transit" },
              { id: "delivered", label: "Delivered" },
              { id: "cancelled", label: "Cancelled" },
              { id: "returns", label: "Returns & Refunds" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-stone-900 text-white shadow-xs"
                    : "text-stone-600 hover:bg-stone-200/60"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Secondary Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <form onSubmit={handleSearchSubmit} className="md:col-span-2 relative">
            <input
              type="text"
              placeholder="Search by Order ID (e.g. KL-123456-LX) or AWB..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-white border border-stone-200 rounded-xl py-2.5 pl-9 pr-4 focus:outline-hidden focus:border-stone-400 font-medium text-stone-900 shadow-xs"
            />
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
          </form>

          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="text-xs bg-white border border-stone-200 rounded-xl px-3 py-2.5 font-medium text-stone-800 focus:outline-hidden shadow-xs"
          >
            <option value="all">Payment Method: All</option>
            <option value="razorpay">Razorpay / Online</option>
            <option value="cod">Cash on Delivery (COD)</option>
          </select>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Orders Listing State */}
        {loading ? (
          <div className="py-20 text-center space-y-3 bg-white rounded-2xl border border-stone-200">
            <div className="w-8 h-8 border-3 border-stone-900 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold text-stone-600">Retrieving customer order history...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center space-y-4 bg-white rounded-2xl border border-stone-200 p-8">
            <Package className="w-12 h-12 text-stone-300 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-stone-900">No Orders Found</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
                {searchQuery || activeTab !== "all"
                  ? "No orders match your current filter or search criteria."
                  : "You haven't placed any orders yet. Explore our handcrafted pure linen collection."}
              </p>
            </div>
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-stone-900 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors shadow-xs"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Explore Collection</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onInvoiceClick={handleInvoiceClick}
                onCancelClick={(id) => setCancelTargetId(id)}
                onReorderClick={handleReorderClick}
              />
            ))}

            {/* Pagination Load More */}
            {hasMore && (
              <div className="pt-4 text-center">
                <button
                  onClick={() => fetchOrders(nextCursor || undefined, true)}
                  disabled={loadingMore}
                  className="px-6 py-2.5 text-xs font-bold text-stone-900 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl transition-colors shadow-xs disabled:opacity-50"
                >
                  {loadingMore ? "Loading More Orders..." : "Load More Orders"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <CancelOrderModal
        isOpen={!!cancelTargetId}
        onClose={() => setCancelTargetId(null)}
        orderNumber={cancelTargetId || ""}
        onConfirmCancel={handleCancelConfirm}
        loading={cancelLoading}
      />

      <ReorderPreviewModal
        isOpen={!!reorderTargetId}
        onClose={() => setReorderTargetId(null)}
        previewData={reorderPreviewData}
        loading={reorderLoading}
        onConfirmAddToCart={handleConfirmAddToCart}
      />

      <OrderHelpModal
        isOpen={!!helpTargetId}
        onClose={() => setHelpTargetId(null)}
        orderNumber={helpTargetId || ""}
      />
    </div>
  );
};
