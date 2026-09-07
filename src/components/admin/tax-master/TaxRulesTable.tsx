import React, { useState, useMemo } from 'react';
import { Search, Filter, Layers, CheckCircle2, AlertTriangle, ShieldCheck, Tag } from 'lucide-react';
import { ProductTaxRecord, TaxRuleScope } from './types';

interface TaxRulesTableProps {
  rules: ProductTaxRecord[];
  onDeactivateRule?: (recordId: string) => Promise<void>;
  loading?: boolean;
}

export const TaxRulesTable: React.FC<TaxRulesTableProps> = ({
  rules,
  onDeactivateRule,
  loading = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | TaxRuleScope>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUPERSEDED' | 'INACTIVE'>('ALL');

  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      // Scope filter
      const effectiveScope = rule.scope_type || (rule.category ? 'CATEGORY' : rule.product_id ? 'PRODUCT' : rule.sku ? 'SKU' : 'DEFAULT');
      if (scopeFilter !== 'ALL' && effectiveScope !== scopeFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && rule.status !== statusFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const target = (rule.scope_value || rule.category || rule.product_id || rule.sku || '').toLowerCase();
        const hsn = (rule.hsn_code || '').toLowerCase();
        const notes = (rule.notes || '').toLowerCase();
        const prodName = (rule.product_name_snapshot || '').toLowerCase();
        return target.includes(q) || hsn.includes(q) || notes.includes(q) || prodName.includes(q);
      }

      return true;
    });
  }, [rules, scopeFilter, statusFilter, searchQuery]);

  const renderScopeBadge = (rule: ProductTaxRecord) => {
    const scope = rule.scope_type || (rule.sku ? 'SKU' : rule.product_id ? 'PRODUCT' : rule.tax_class ? 'TAX_CLASS' : rule.category ? 'CATEGORY' : 'DEFAULT');
    switch (scope) {
      case 'TAX_CLASS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
            Tax Class
          </span>
        );
      case 'CATEGORY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
            Category
          </span>
        );
      case 'PRODUCT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            Product
          </span>
        );
      case 'SKU':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            SKU Override
          </span>
        );
      case 'DEFAULT':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-stone-200 text-stone-800 border border-stone-300">
            Default
          </span>
        );
    }
  };

  const renderTargetInfo = (rule: ProductTaxRecord) => {
    const scope = rule.scope_type || (rule.sku ? 'SKU' : rule.product_id ? 'PRODUCT' : rule.tax_class ? 'TAX_CLASS' : rule.category ? 'CATEGORY' : 'DEFAULT');
    if (scope === 'TAX_CLASS') {
      const tc = rule.tax_class || rule.scope_value || '—';
      return (
        <div>
          <span className="font-bold text-stone-900 font-mono">{tc}</span>
          <span className="block text-[10px] text-stone-500 font-mono">Scope: TAX_CLASS</span>
        </div>
      );
    }
    if (scope === 'CATEGORY') {
      const cat = rule.category || rule.scope_value || '—';
      return (
        <div>
          <span className="font-bold text-stone-900 capitalize">{cat.replace(/[-_]/g, ' ')}</span>
          <span className="block text-[10px] text-stone-500 font-mono">Scope: CATEGORY</span>
        </div>
      );
    }
    if (scope === 'PRODUCT') {
      const prodId = rule.product_id || rule.scope_value || '—';
      return (
        <div>
          <span className="font-bold text-stone-900">{rule.product_name_snapshot || prodId}</span>
          <span className="block text-[10px] text-stone-500 font-mono">ID: {prodId}</span>
        </div>
      );
    }
    if (scope === 'SKU') {
      const sku = rule.sku || rule.scope_value || '—';
      return (
        <div>
          <span className="font-mono font-bold text-stone-900">{sku}</span>
          <span className="block text-[10px] text-stone-500">SKU Item Override</span>
        </div>
      );
    }
    return (
      <div>
        <span className="font-bold text-stone-800">Global Fallback</span>
        <span className="block text-[10px] text-stone-500">Unmatched catalog items</span>
      </div>
    );
  };

  const renderRateSummary = (rule: ProductTaxRecord) => {
    if (rule.rate_mode === 'VALUE_BAND' && rule.value_bands && rule.value_bands.length > 0) {
      return (
        <div className="space-y-0.5">
          <span className="inline-block text-[10px] uppercase font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
            Value Band ({rule.value_bands.length} Tiers)
          </span>
          <div className="text-[11px] font-mono text-stone-700">
            {rule.value_bands.map((b, i) => (
              <span key={i} className="block">
                {b.max_price !== null
                  ? `₹${b.min_price} – ₹${b.max_price}: ${b.gst_rate}%`
                  : `> ₹${b.min_price}: ${b.gst_rate}%`}
              </span>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-stone-900 text-sm font-mono">{rule.gst_rate}%</span>
        <span className="text-[10px] text-stone-500 uppercase">Fixed</span>
      </div>
    );
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Indefinite';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Scope Filter */}
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg border border-stone-200 text-xs">
            <button
              onClick={() => setScopeFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                scopeFilter === 'ALL'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All Scopes ({rules.length})
            </button>
            <button
              onClick={() => setScopeFilter('TAX_CLASS')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                scopeFilter === 'TAX_CLASS'
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Tax Class
            </button>
            <button
              onClick={() => setScopeFilter('CATEGORY')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                scopeFilter === 'CATEGORY'
                  ? 'bg-indigo-700 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Category
            </button>
            <button
              onClick={() => setScopeFilter('PRODUCT')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                scopeFilter === 'PRODUCT'
                  ? 'bg-purple-700 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Product
            </button>
            <button
              onClick={() => setScopeFilter('SKU')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                scopeFilter === 'SKU'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              SKU
            </button>
            <button
              onClick={() => setScopeFilter('DEFAULT')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                scopeFilter === 'DEFAULT'
                  ? 'bg-stone-800 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Default
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Rules</option>
            <option value="SUPERSEDED">Superseded</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search target, HSN, notes..."
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />
        </div>
      </div>

      {/* Rules Table */}
      <div className="overflow-x-auto bg-white rounded-xl border border-stone-200 shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] uppercase font-semibold text-stone-500">
              <th className="py-3 px-3.5">Scope</th>
              <th className="py-3 px-3.5">Target</th>
              <th className="py-3 px-3.5">HSN Code</th>
              <th className="py-3 px-3.5">Tax Rate / Tiers</th>
              <th className="py-3 px-3.5">Effective Range</th>
              <th className="py-3 px-3.5">Status</th>
              <th className="py-3 px-3.5">Source</th>
              <th className="py-3 px-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-stone-400 text-xs">
                  Loading product tax master rules...
                </td>
              </tr>
            ) : filteredRules.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-stone-500 text-xs">
                  <Layers className="w-6 h-6 mx-auto text-stone-300 mb-2" />
                  <p className="font-semibold text-stone-700">No Product Tax Master rules found</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    {rules.length === 0
                      ? 'Create your first Category or Product tax rule to configure statutory GST rates.'
                      : 'No rules match your search and filter criteria.'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredRules.map((rule) => {
                const isActive = rule.status === 'ACTIVE';
                return (
                  <tr key={rule.tax_record_id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3 px-3.5 align-top">{renderScopeBadge(rule)}</td>
                    <td className="py-3 px-3.5 align-top">{renderTargetInfo(rule)}</td>
                    <td className="py-3 px-3.5 align-top font-mono font-bold text-stone-800">
                      {rule.hsn_code}
                    </td>
                    <td className="py-3 px-3.5 align-top">{renderRateSummary(rule)}</td>
                    <td className="py-3 px-3.5 align-top text-[11px] text-stone-600">
                      <span className="block font-medium">From: {formatDate(rule.effective_from)}</span>
                      <span className="block text-stone-400">To: {formatDate(rule.effective_to)}</span>
                    </td>
                    <td className="py-3 px-3.5 align-top">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ACTIVE
                        </span>
                      ) : rule.status === 'SUPERSEDED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                          SUPERSEDED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                          INACTIVE
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 align-top text-[11px] text-stone-500 capitalize">
                      {rule.source || 'MANUAL'}
                    </td>
                    <td className="py-3 px-3.5 align-top text-right">
                      {isActive && onDeactivateRule && (
                        <button
                          onClick={() => onDeactivateRule(rule.tax_record_id)}
                          className="text-[11px] font-semibold text-rose-700 hover:text-rose-900 transition-colors"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
