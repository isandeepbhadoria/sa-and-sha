import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle, ChevronRight, Search, X, Plus } from 'lucide-react';
import { TaxCoverageSummary, TaxCoverageDetailItem } from './types';

interface TaxCoverageCardProps {
  coverage: TaxCoverageSummary | null;
  onOpenAddModalWithScope?: (scopeType: 'CATEGORY' | 'PRODUCT' | 'SKU', targetValue: string) => void;
}

export const TaxCoverageCard: React.FC<TaxCoverageCardProps> = ({
  coverage,
  onOpenAddModalWithScope
}) => {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'UNCOVERED' | 'COVERED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  if (!coverage) {
    return null;
  }

  const is100Percent = coverage.coverage_percentage === 100;
  const filteredDetails = (coverage.details || []).filter((item) => {
    if (filterStatus === 'UNCOVERED' && item.status === 'COVERED') return false;
    if (filterStatus === 'COVERED' && item.status !== 'COVERED') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.product_id.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <>
      <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {is100Percent ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-stone-900">Catalog GST Tax Coverage</h4>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    is100Percent
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {coverage.coverage_percentage}% Covered
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Evaluates active catalog products against configured SKU, Product, Category, and Default rules.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowDetailsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-stone-300 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors self-start sm:self-auto"
          >
            <span>Inspect Catalog Tax Coverage</span>
            <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden flex">
          <div
            className="bg-emerald-600 h-2.5 transition-all duration-500"
            style={{ width: `${coverage.coverage_percentage}%` }}
          />
          {coverage.coverage_percentage < 100 && (
            <div
              className="bg-amber-400 h-2.5 transition-all duration-500"
              style={{ width: `${100 - coverage.coverage_percentage}%` }}
            />
          )}
        </div>

        {/* Breakdown Metric Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
          <div className="bg-stone-50 rounded-lg p-2.5 border border-stone-200">
            <span className="text-[11px] text-stone-500 font-medium block">Total Catalog Items</span>
            <span className="text-sm font-bold text-stone-900">{coverage.total_products}</span>
          </div>

          <div className="bg-amber-50/70 rounded-lg p-2.5 border border-amber-200/70">
            <span className="text-[11px] text-amber-700 font-medium block">Covered by SKU</span>
            <span className="text-sm font-bold text-amber-900">{coverage.covered_by_sku}</span>
          </div>

          <div className="bg-purple-50/70 rounded-lg p-2.5 border border-purple-200/70">
            <span className="text-[11px] text-purple-700 font-medium block">Covered by Product</span>
            <span className="text-sm font-bold text-purple-900">{coverage.covered_by_product}</span>
          </div>

          <div className="bg-teal-50/70 rounded-lg p-2.5 border border-teal-200/70">
            <span className="text-[11px] text-teal-700 font-medium block">Covered by Tax Class</span>
            <span className="text-sm font-bold text-teal-900">{coverage.covered_by_tax_class || 0}</span>
          </div>

          <div className="bg-indigo-50/70 rounded-lg p-2.5 border border-indigo-200/70">
            <span className="text-[11px] text-indigo-700 font-medium block">Covered by Category</span>
            <span className="text-sm font-bold text-indigo-900">{coverage.covered_by_category}</span>
          </div>

          <div className="bg-stone-100 rounded-lg p-2.5 border border-stone-200">
            <span className="text-[11px] text-stone-700 font-medium block">Covered by Default</span>
            <span className="text-sm font-bold text-stone-900">{coverage.covered_by_default}</span>
          </div>

          <div
            className={`rounded-lg p-2.5 border ${
              coverage.uncovered_products > 0
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <span className="text-[11px] font-medium block">
              {coverage.uncovered_products > 0 ? 'Uncovered Products' : 'Uncovered Items'}
            </span>
            <span className="text-sm font-bold">{coverage.uncovered_products}</span>
          </div>
        </div>

        {coverage.uncovered_products > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>{coverage.uncovered_products} product(s)</strong> have no matching tax metadata. Add category or product rules to achieve 100% deterministic coverage before invoice finalization.
              </span>
            </div>
            <button
              onClick={() => {
                setFilterStatus('UNCOVERED');
                setShowDetailsModal(true);
              }}
              className="text-xs font-bold text-amber-900 underline hover:text-amber-700 whitespace-nowrap"
            >
              View Uncovered
            </button>
          </div>
        )}
      </div>

      {/* Catalog Tax Coverage Inspection Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-xl border border-stone-200">
            {/* Header */}
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-stone-900">Catalog Product Tax Coverage Summary</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Resolution check for each active item in the Sa and Sha catalog ({coverage.total_products} items total).
                </p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Bar */}
            <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setFilterStatus('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    filterStatus === 'ALL'
                      ? 'bg-stone-900 text-white'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  All ({coverage.total_products})
                </button>
                <button
                  onClick={() => setFilterStatus('UNCOVERED')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    filterStatus === 'UNCOVERED'
                      ? 'bg-rose-700 text-white'
                      : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
                  }`}
                >
                  Uncovered ({coverage.uncovered_products})
                </button>
                <button
                  onClick={() => setFilterStatus('COVERED')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    filterStatus === 'COVERED'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  Covered ({coverage.covered_products})
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter product, SKU, category..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>
            </div>

            {/* Product Table */}
            <div className="overflow-y-auto p-4 flex-1 divide-y divide-stone-100">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[11px] font-semibold text-stone-500 uppercase bg-stone-50/50">
                    <th className="py-2.5 px-3">Product / SKU</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Price</th>
                    <th className="py-2.5 px-3">Coverage Status</th>
                    <th className="py-2.5 px-3">Resolved Scope</th>
                    <th className="py-2.5 px-3">HSN & Rate</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredDetails.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-stone-500 text-xs">
                        No items match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredDetails.map((item) => (
                      <tr key={item.product_id} className="hover:bg-stone-50/80">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-stone-900">{item.name}</div>
                          <div className="font-mono text-[11px] text-stone-500">ID: {item.product_id} | SKU: {item.sku}</div>
                        </td>
                        <td className="py-2.5 px-3 capitalize text-stone-700 font-medium">
                          {item.category}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-stone-800">
                          ₹{item.price.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3">
                          {item.status === 'COVERED' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold text-[11px] border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Covered
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-bold text-[11px] border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Missing Tax
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {item.resolved_scope ? (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.resolved_scope === 'SKU'
                                  ? 'bg-amber-100 text-amber-800'
                                  : item.resolved_scope === 'PRODUCT'
                                  ? 'bg-purple-100 text-purple-800'
                                  : item.resolved_scope === 'TAX_CLASS'
                                  ? 'bg-teal-100 text-teal-800'
                                  : item.resolved_scope === 'CATEGORY'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-stone-100 text-stone-800'
                              }`}
                            >
                              {item.resolved_scope}
                            </span>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {item.hsn_code ? (
                            <div className="font-mono text-[11px]">
                              <span>HSN: {item.hsn_code}</span>
                              <span className="ml-1.5 font-bold text-emerald-700">({item.gst_rate}%)</span>
                            </div>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {item.status !== 'COVERED' && onOpenAddModalWithScope && (
                            <button
                              onClick={() => {
                                setShowDetailsModal(false);
                                onOpenAddModalWithScope('CATEGORY', item.category);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-800 hover:bg-emerald-900 text-white rounded text-[11px] font-semibold transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              Add Category Rule
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-stone-200 bg-stone-50 flex justify-end">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-1.5 bg-stone-200 text-stone-700 hover:bg-stone-300 rounded-lg text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
