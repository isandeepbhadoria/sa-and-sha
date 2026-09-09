import React from "react";
import { Search, Filter, RefreshCw, Download, Layers } from "lucide-react";

export interface RmaFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  typeFilter: string;
  onTypeFilterChange: (val: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (val: string) => void;
  slaFilter: string;
  onSlaFilterChange: (val: string) => void;
  staffFilter: string;
  onStaffFilterChange: (val: string) => void;
  onRefresh: () => void;
  onExport: () => void;
  loading?: boolean;
}

export const RmaFilters: React.FC<RmaFiltersProps> = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  slaFilter,
  onSlaFilterChange,
  staffFilter,
  onStaffFilterChange,
  onRefresh,
  onExport,
  loading
}) => {
  return (
    <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search Field */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search RMA Number, Order #, Customer ID, or Name..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-200 bg-stone-50 focus:outline-none focus:border-[#B08D57]"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={onExport}
            className="px-3 py-2 text-xs font-semibold text-white bg-[#2A211C] hover:bg-black rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter Select Dropdowns */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100 text-xs">
        <div className="flex items-center gap-1 text-stone-500 font-medium mr-1">
          <Filter className="w-3.5 h-3.5 text-stone-400" />
          <span>Filter:</span>
        </div>

        {/* Status Dropdown */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="py-1.5 px-2.5 rounded-lg border border-stone-200 bg-stone-50 font-medium text-stone-800 focus:outline-none focus:border-[#B08D57]"
        >
          <option value="all">All Statuses</option>
          <option value="requested">Requested</option>
          <option value="under_review">Under Review</option>
          <option value="information_required">Information Required</option>
          <option value="approved">Approved</option>
          <option value="pickup_scheduling">Pickup Scheduling</option>
          <option value="pickup_scheduled">Pickup Scheduled</option>
          <option value="picked_up">Picked Up</option>
          <option value="warehouse_received">Warehouse Received</option>
          <option value="inspection_in_progress">Inspection In Progress</option>
          <option value="refund_approved">Refund Approved</option>
          <option value="refund_completed">Refund Completed</option>
          <option value="exchange_approved">Exchange Approved</option>
          <option value="exchange_shipped">Exchange Shipped</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Request Type */}
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value)}
          className="py-1.5 px-2.5 rounded-lg border border-stone-200 bg-stone-50 font-medium text-stone-800 focus:outline-none focus:border-[#B08D57]"
        >
          <option value="all">All Request Types</option>
          <option value="return">Return Only</option>
          <option value="exchange">Exchange Only</option>
          <option value="mixed">Mixed Request</option>
        </select>

        {/* SLA State */}
        <select
          value={slaFilter}
          onChange={(e) => onSlaFilterChange(e.target.value)}
          className="py-1.5 px-2.5 rounded-lg border border-stone-200 bg-stone-50 font-medium text-stone-800 focus:outline-none focus:border-[#B08D57]"
        >
          <option value="all">All SLA States</option>
          <option value="on_time">On Time</option>
          <option value="due_soon">Due Soon (≤ 6h)</option>
          <option value="overdue">Overdue</option>
        </select>

        {/* Priority */}
        <select
          value={priorityFilter}
          onChange={(e) => onPriorityFilterChange(e.target.value)}
          className="py-1.5 px-2.5 rounded-lg border border-stone-200 bg-stone-50 font-medium text-stone-800 focus:outline-none focus:border-[#B08D57]"
        >
          <option value="all">All Priorities</option>
          <option value="normal">Normal Priority</option>
          <option value="high">High Priority</option>
          <option value="urgent">Urgent Priority</option>
        </select>

        {/* Staff Filter */}
        <select
          value={staffFilter}
          onChange={(e) => onStaffFilterChange(e.target.value)}
          className="py-1.5 px-2.5 rounded-lg border border-stone-200 bg-stone-50 font-medium text-stone-800 focus:outline-none focus:border-[#B08D57]"
        >
          <option value="all">All Staff Assignments</option>
          <option value="unassigned">Unassigned Only</option>
          <option value="shop@sa-and-sha.com">Assigned to shop@sa-and-sha.com</option>
        </select>
      </div>
    </div>
  );
};
