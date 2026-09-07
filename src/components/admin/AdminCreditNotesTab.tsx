import React, { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  X,
  ShieldCheck,
  Building,
  User,
  DollarSign
} from "lucide-react";

export interface AdminCreditNotesTabProps {
  adminToken?: string;
  showToast?: (message: string, type?: "success" | "error") => void;
}

export const AdminCreditNotesTab: React.FC<AdminCreditNotesTabProps> = ({
  adminToken,
  showToast
}) => {
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [fyFilter, setFyFilter] = useState("ALL");
  const [customerTypeFilter, setCustomerTypeFilter] = useState("ALL");
  const [reportingStatusFilter, setReportingStatusFilter] = useState("ALL");

  // Selected Detail Modal State
  const [selectedNote, setSelectedNote] = useState<any | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Status Edit State inside modal
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [editReportingStatus, setEditReportingStatus] = useState("");
  const [editTaxLiabilityAdjusted, setEditTaxLiabilityAdjusted] = useState(false);
  const [editReportingPeriod, setEditReportingPeriod] = useState("");
  const [editAdjustmentReference, setEditAdjustmentReference] = useState("");

  const getHeaders = () => {
    const token =
      adminToken ||
      localStorage.getItem("admin_auth_token") ||
      localStorage.getItem("kora_admin_token") ||
      "";
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-admin-token": token
    };
  };

  const fetchCreditNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      let queryParams = new URLSearchParams();
      if (fyFilter !== "ALL") queryParams.append("financialYear", fyFilter);
      if (customerTypeFilter !== "ALL") queryParams.append("customerType", customerTypeFilter);
      queryParams.append("limit", "100");

      const res = await fetch(`/api/admin/credit-notes?${queryParams.toString()}`, {
        headers: getHeaders()
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to load credit notes.");
        return;
      }

      setCreditNotes(data.creditNotes || []);
    } catch (err) {
      console.error("Error loading credit notes:", err);
      setError("Unable to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditNotes();
  }, [fyFilter, customerTypeFilter]);

  // Client-side filtering for search & reporting status
  const filteredNotes = creditNotes.filter((cn) => {
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchCnNum = (cn.credit_note_number || "").toLowerCase().includes(q);
      const matchInvoice = (cn.original_invoice_number || "").toLowerCase().includes(q);
      const matchOrder = (cn.order_id || cn.order_number || "").toLowerCase().includes(q);
      const matchRma = (cn.rma_number || "").toLowerCase().includes(q);
      const matchBuyer = (cn.buyer_snapshot?.full_name || cn.buyer_snapshot?.company_name || "").toLowerCase().includes(q);

      if (!matchCnNum && !matchInvoice && !matchOrder && !matchRma && !matchBuyer) {
        return false;
      }
    }

    // Reporting status filter
    if (reportingStatusFilter !== "ALL") {
      if ((cn.gst_reporting_status || "NOT_REPORTED") !== reportingStatusFilter) {
        return false;
      }
    }

    return true;
  });

  // Calculate totals
  const totalCreditValue = filteredNotes.reduce((acc, cn) => acc + (cn.grand_total_reversal || 0), 0);
  const totalCgstReversal = filteredNotes.reduce((acc, cn) => acc + (cn.cgst_total_reversal || 0) + (cn.shipping_cgst_reversal || 0), 0);
  const totalSgstReversal = filteredNotes.reduce((acc, cn) => acc + (cn.sgst_total_reversal || 0) + (cn.shipping_sgst_reversal || 0), 0);
  const totalIgstReversal = filteredNotes.reduce((acc, cn) => acc + (cn.igst_total_reversal || 0) + (cn.shipping_igst_reversal || 0), 0);
  const totalTaxReversal = totalCgstReversal + totalSgstReversal + totalIgstReversal;

  const handleDownloadPdf = async (cn: any) => {
    const id = cn.credit_note_id || cn.credit_note_number;
    setDownloadingId(id);
    try {
      const res = await fetch(`/api/admin/credit-notes/${encodeURIComponent(id)}/pdf`, {
        headers: getHeaders()
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Download failed" }));
        alert(errData.error || "Failed to download Credit Note PDF.");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GST-Credit-Note-${(cn.credit_note_number || id).replace(/[\/\\]/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      if (showToast) showToast("Credit Note PDF downloaded successfully.", "success");
    } catch (err) {
      console.error("Error downloading credit note PDF:", err);
      alert("Error downloading Credit Note PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleOpenDetailModal = (cn: any) => {
    setSelectedNote(cn);
    setEditReportingStatus(cn.gst_reporting_status || "NOT_REPORTED");
    setEditTaxLiabilityAdjusted(cn.tax_liability_adjusted || false);
    setEditReportingPeriod(cn.gst_reporting_period || "");
    setEditAdjustmentReference(cn.gst_adjustment_reference || "");
  };

  const handleUpdateReportingStatus = async () => {
    if (!selectedNote) return;
    setUpdatingStatus(true);
    try {
      const id = selectedNote.credit_note_id || selectedNote.credit_note_number;
      const res = await fetch(`/api/admin/credit-notes/${encodeURIComponent(id)}/gst-status`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({
          gstReportingStatus: editReportingStatus,
          taxLiabilityAdjusted: editTaxLiabilityAdjusted,
          gstReportingPeriod: editReportingPeriod,
          gstAdjustmentReference: editAdjustmentReference
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Failed to update GST status.");
        return;
      }

      if (showToast) showToast("GST reporting status updated.", "success");
      fetchCreditNotes();
      setSelectedNote(data.creditNote || { ...selectedNote, gst_reporting_status: editReportingStatus, tax_liability_adjusted: editTaxLiabilityAdjusted });
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "ADJUSTED":
      case "REPORTED":
        return (
          <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold uppercase tracking-wider">
            {status}
          </span>
        );
      case "EXPIRED":
      case "INELIGIBLE":
        return (
          <span className="px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold uppercase tracking-wider">
            {status}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold uppercase tracking-wider">
            NOT REPORTED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER SECTION */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-stone-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-800" />
            <span>GST Credit Notes Registry</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Statutory credit note issuing, historical shipping tax snapshot audit, and Section 34 CGST Act compliance.
          </p>
        </div>

        <button
          onClick={fetchCreditNotes}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-stone-800 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-xl transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh List</span>
        </button>
      </div>

      {/* METRIC SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-1">
          <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Credit Notes Count</p>
          <p className="text-2xl font-bold font-mono text-stone-900">{filteredNotes.length}</p>
          <p className="text-[11px] text-stone-400">Total issuing events</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-1">
          <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Total Value Reversed</p>
          <p className="text-2xl font-bold font-mono text-amber-900">
            ₹{totalCreditValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-stone-400">Grand total reversals</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-1">
          <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Total GST Reversals</p>
          <p className="text-2xl font-bold font-mono text-emerald-800">
            ₹{totalTaxReversal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-stone-400">CGST + SGST + IGST</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-1">
          <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Tax Adjustments</p>
          <p className="text-2xl font-bold font-mono text-blue-900">
            {filteredNotes.filter((n) => n.tax_liability_adjusted || n.gst_reporting_status === "ADJUSTED").length} / {filteredNotes.length}
          </p>
          <p className="text-[11px] text-stone-400">Section 34 liability adjusted</p>
        </div>
      </div>

      {/* SEARCH AND FILTERS BAR */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-wrap items-center gap-4">
        {/* Search Field */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Credit Note #, Invoice #, Order ID, RMA, or Buyer..."
            className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-800/30 font-medium"
          />
        </div>

        {/* Financial Year Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-stone-600">FY:</label>
          <select
            value={fyFilter}
            onChange={(e) => setFyFilter(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 focus:outline-none"
          >
            <option value="ALL">All FY</option>
            <option value="25-26">FY 25-26</option>
            <option value="26-27">FY 26-27</option>
            <option value="27-28">FY 27-28</option>
          </select>
        </div>

        {/* B2B / B2C Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-stone-600">Type:</label>
          <select
            value={customerTypeFilter}
            onChange={(e) => setCustomerTypeFilter(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 focus:outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="B2B">B2B</option>
            <option value="B2C">B2C</option>
          </select>
        </div>

        {/* Reporting Status Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-stone-600">GST Status:</label>
          <select
            value={reportingStatusFilter}
            onChange={(e) => setReportingStatusFilter(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="NOT_REPORTED">Not Reported</option>
            <option value="REPORTED">Reported</option>
            <option value="ADJUSTED">Adjusted</option>
            <option value="EXPIRED">Expired</option>
            <option value="INELIGIBLE">Ineligible</option>
          </select>
        </div>
      </div>

      {/* TABLE SECTION */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-stone-200 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-stone-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-stone-600">Loading GST credit notes...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl text-center text-rose-800 text-xs font-medium space-y-2">
          <AlertCircle className="w-6 h-6 text-rose-600 mx-auto" />
          <p>{error}</p>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-stone-200 text-center space-y-2 text-stone-500">
          <FileText className="w-10 h-10 text-stone-300 mx-auto" />
          <p className="text-sm font-semibold text-stone-800">No GST Credit Notes Found</p>
          <p className="text-xs">Try adjusting your search criteria or financial year filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100/80 border-b border-stone-200 text-stone-600 uppercase tracking-wider font-bold">
                <tr>
                  <th className="p-4">Credit Note #</th>
                  <th className="p-4">Invoice & Order</th>
                  <th className="p-4">RMA / Date</th>
                  <th className="p-4">Customer Type</th>
                  <th className="p-4 text-right">Taxable Reversal</th>
                  <th className="p-4 text-right">GST Reversal</th>
                  <th className="p-4 text-right">Credit Total</th>
                  <th className="p-4">GST Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredNotes.map((cn) => {
                  const id = cn.credit_note_id || cn.credit_note_number;
                  const cgst = (cn.cgst_total_reversal || 0) + (cn.shipping_cgst_reversal || 0);
                  const sgst = (cn.sgst_total_reversal || 0) + (cn.shipping_sgst_reversal || 0);
                  const igst = (cn.igst_total_reversal || 0) + (cn.shipping_igst_reversal || 0);
                  const taxTot = cgst + sgst + igst;

                  return (
                    <tr key={id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="p-4 font-mono font-bold text-stone-900">
                        <div>{cn.credit_note_number}</div>
                        <span className="text-[10px] text-stone-400 font-sans font-normal">
                          FY {cn.financial_year}
                        </span>
                      </td>

                      <td className="p-4 space-y-0.5">
                        <div className="font-semibold text-stone-800">
                          Inv: {cn.original_invoice_number || "N/A"}
                        </div>
                        <div className="text-[11px] text-stone-500 font-mono">
                          Order: {cn.order_number || cn.order_id || "N/A"}
                        </div>
                      </td>

                      <td className="p-4 space-y-0.5">
                        <div className="font-mono text-stone-800">{cn.rma_number || "Direct"}</div>
                        <div className="text-[10px] text-stone-400">
                          {new Date(cn.issue_date || cn.created_at).toLocaleDateString("en-IN")}
                        </div>
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            cn.gst_customer_type === "B2B"
                              ? "bg-purple-100 text-purple-800 border border-purple-200"
                              : "bg-blue-100 text-blue-800 border border-blue-200"
                          }`}
                        >
                          {cn.gst_customer_type || "B2C"}
                        </span>
                        <div className="text-[10px] text-stone-400 mt-0.5">{cn.place_of_supply}</div>
                      </td>

                      <td className="p-4 text-right font-mono font-medium text-stone-800">
                        ₹{(cn.taxable_total_reversal + (cn.shipping_taxable_reversal || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-4 text-right font-mono text-stone-700">
                        ₹{taxTot.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-4 text-right font-mono font-bold text-amber-900 text-sm">
                        ₹{(cn.grand_total_reversal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-4 space-y-1">
                        {renderStatusBadge(cn.gst_reporting_status || "NOT_REPORTED")}
                        {cn.tax_liability_adjusted && (
                          <span className="block text-[10px] text-emerald-700 font-medium">
                            ✓ Liability Adjusted
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenDetailModal(cn)}
                            title="View Details"
                            className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDownloadPdf(cn)}
                            disabled={downloadingId === id}
                            title="Download Credit Note PDF"
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors disabled:opacity-50"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAIL & AUDIT MODAL */}
      {selectedNote && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-stone-200 max-w-3xl w-full p-6 md:p-8 space-y-6 max-h-[90vh] overflow-y-auto relative shadow-2xl">
            <button
              onClick={() => setSelectedNote(null)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-stone-100 text-stone-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="space-y-1 border-b border-stone-200 pb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-serif font-bold text-stone-900">
                  GST Credit Note #{selectedNote.credit_note_number}
                </h3>
                {renderStatusBadge(selectedNote.gst_reporting_status || "NOT_REPORTED")}
              </div>
              <p className="text-xs text-stone-500 font-mono">
                Issued on {new Date(selectedNote.issue_date || selectedNote.created_at).toLocaleString("en-IN")} • Original Invoice: #{selectedNote.original_invoice_number}
              </p>
            </div>

            {/* Key Metadata Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-200 text-xs">
              <div>
                <span className="text-stone-400 block font-medium">Order ID</span>
                <span className="font-mono font-bold text-stone-900">{selectedNote.order_number || selectedNote.order_id}</span>
              </div>
              <div>
                <span className="text-stone-400 block font-medium">RMA Number</span>
                <span className="font-mono font-bold text-stone-900">{selectedNote.rma_number || "Direct"}</span>
              </div>
              <div>
                <span className="text-stone-400 block font-medium">Customer Type</span>
                <span className="font-bold text-stone-900 uppercase">{selectedNote.gst_customer_type || "B2C"}</span>
              </div>
              <div>
                <span className="text-stone-400 block font-medium">Place of Supply</span>
                <span className="font-bold text-stone-900">{selectedNote.place_of_supply} ({selectedNote.place_of_supply_state_code})</span>
              </div>
            </div>

            {/* Snapshots Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/50 space-y-2">
                <h4 className="font-bold text-stone-800 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-stone-600" />
                  <span>Seller Snapshot</span>
                </h4>
                <p className="font-bold text-stone-900">{selectedNote.seller_snapshot?.trade_name || selectedNote.seller_snapshot?.legal_name}</p>
                <p className="font-mono text-stone-600">GSTIN: {selectedNote.seller_snapshot?.gstin}</p>
                <p className="text-stone-500">{selectedNote.seller_snapshot?.address_line_1}, {selectedNote.seller_snapshot?.city}, {selectedNote.seller_snapshot?.state} - {selectedNote.seller_snapshot?.pincode}</p>
              </div>

              <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/50 space-y-2">
                <h4 className="font-bold text-stone-800 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-stone-600" />
                  <span>Buyer Snapshot</span>
                </h4>
                <p className="font-bold text-stone-900">{selectedNote.buyer_snapshot?.company_name || selectedNote.buyer_snapshot?.full_name}</p>
                {selectedNote.buyer_snapshot?.gstin && (
                  <p className="font-mono text-stone-600">GSTIN: {selectedNote.buyer_snapshot.gstin}</p>
                )}
                <p className="text-stone-500">{selectedNote.buyer_snapshot?.address_line_1}, {selectedNote.buyer_snapshot?.city}, {selectedNote.buyer_snapshot?.state} - {selectedNote.buyer_snapshot?.pincode}</p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-2">
              <h4 className="font-bold text-stone-800 text-xs uppercase tracking-wider">Credited Line Items</h4>
              <div className="border border-stone-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100 text-stone-600 uppercase font-bold text-[10px]">
                    <tr>
                      <th className="p-3">Product / SKU</th>
                      <th className="p-3 text-center">HSN</th>
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-right font-mono">Taxable Reversal</th>
                      <th className="p-3 text-right">GST Rate</th>
                      <th className="p-3 text-right font-mono">Tax Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {selectedNote.line_items?.map((li: any, idx: number) => {
                      const taxVal = (li.cgst_reversal || 0) + (li.sgst_reversal || 0) + (li.igst_reversal || 0);
                      return (
                        <tr key={idx} className="hover:bg-stone-50">
                          <td className="p-3">
                            <p className="font-bold text-stone-900">{li.product_name}</p>
                            <p className="text-[10px] text-stone-400 font-mono">SKU: {li.sku}</p>
                          </td>
                          <td className="p-3 text-center font-mono">{li.hsn_code}</td>
                          <td className="p-3 text-center font-semibold">{li.credited_quantity}</td>
                          <td className="p-3 text-right font-mono">₹{li.taxable_value_reversal?.toFixed(2)}</td>
                          <td className="p-3 text-right font-semibold">{li.gst_rate}%</td>
                          <td className="p-3 text-right font-mono">₹{taxVal.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Historical Shipping Tax Snapshot Box */}
            {selectedNote.shipping_taxable_reversal > 0 && (
              <div className="p-4 rounded-2xl border border-stone-200 bg-amber-50/50 space-y-2 text-xs">
                <h4 className="font-bold text-amber-900 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-800" />
                  <span>Historical Freight / Shipping Reversal Snapshot</span>
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-amber-800/70 block">SAC Code</span>
                    <span className="font-mono font-bold text-amber-950">{selectedNote.shipping_sac || "996812"}</span>
                  </div>
                  <div>
                    <span className="text-amber-800/70 block">Shipping GST Rate</span>
                    <span className="font-semibold text-amber-950">{selectedNote.shipping_gst_rate || 18}%</span>
                  </div>
                  <div>
                    <span className="text-amber-800/70 block">Freight Taxable Reversal</span>
                    <span className="font-mono font-bold text-amber-950">₹{(selectedNote.shipping_taxable_reversal || 0).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-amber-800/70 block">Freight GST Reversal</span>
                    <span className="font-mono font-bold text-amber-950">₹{(selectedNote.shipping_tax_reversal || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Totals Box */}
            <div className="bg-stone-900 text-white p-5 rounded-2xl space-y-2 text-xs font-mono">
              <div className="flex justify-between text-stone-300">
                <span>Subtotal Reversal:</span>
                <span>₹{(selectedNote.subtotal_reversal || 0).toFixed(2)}</span>
              </div>
              {selectedNote.shipping_taxable_reversal > 0 && (
                <div className="flex justify-between text-stone-300">
                  <span>Shipping Freight Taxable Reversal:</span>
                  <span>₹{(selectedNote.shipping_taxable_reversal || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-300">
                <span>CGST Reversal:</span>
                <span>₹{((selectedNote.cgst_total_reversal || 0) + (selectedNote.shipping_cgst_reversal || 0)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-stone-300">
                <span>SGST Reversal:</span>
                <span>₹{((selectedNote.sgst_total_reversal || 0) + (selectedNote.shipping_sgst_reversal || 0)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-stone-300">
                <span>IGST Reversal:</span>
                <span>₹{((selectedNote.igst_total_reversal || 0) + (selectedNote.shipping_igst_reversal || 0)).toFixed(2)}</span>
              </div>
              <div className="border-t border-stone-800 pt-2 flex justify-between text-base font-bold text-amber-300">
                <span>GRAND TOTAL REVERSAL:</span>
                <span>₹{(selectedNote.grand_total_reversal || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* GST Status Update Panel */}
            <div className="bg-stone-50 border border-stone-200 p-5 rounded-2xl space-y-4 text-xs">
              <h4 className="font-bold text-stone-900 uppercase tracking-wider text-[11px]">
                Section 34 GST Reporting & Tax Adjustment Status
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-600 font-medium mb-1">GSTR-1 / GSTR-3B Status</label>
                  <select
                    value={editReportingStatus}
                    onChange={(e) => setEditReportingStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-semibold text-stone-800"
                  >
                    <option value="NOT_REPORTED">NOT REPORTED</option>
                    <option value="REPORTED">REPORTED (in GSTR-1)</option>
                    <option value="ADJUSTED">ADJUSTED (in GSTR-3B)</option>
                    <option value="EXPIRED">EXPIRED (Section 34 Deadline Passed)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-600 font-medium mb-1">Reporting Period (e.g., 2026-04)</label>
                  <input
                    type="text"
                    value={editReportingPeriod}
                    onChange={(e) => setEditReportingPeriod(e.target.value)}
                    placeholder="YYYY-MM"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono text-stone-800"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-stone-800">
                  <input
                    type="checkbox"
                    checked={editTaxLiabilityAdjusted}
                    onChange={(e) => setEditTaxLiabilityAdjusted(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-800 border-stone-300 focus:ring-amber-800"
                  />
                  <span>Mark Tax Liability Adjusted under Section 34</span>
                </label>

                <button
                  onClick={handleUpdateReportingStatus}
                  disabled={updatingStatus}
                  className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  {updatingStatus ? "Saving..." : "Update Status"}
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => handleDownloadPdf(selectedNote)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
