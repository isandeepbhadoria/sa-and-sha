import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, AlertTriangle, Layers, Info, CheckCircle2 } from 'lucide-react';
import { TaxRuleScope, TaxRateMode, TaxValueBand } from './types';
import { products as catalogProducts } from '../../../data';

interface AddTaxRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (ruleData: any) => Promise<boolean>;
  saving: boolean;
  initialScope?: TaxRuleScope;
  initialCategory?: string;
  initialProductId?: string;
  initialSku?: string;
}

export const AddTaxRuleModal: React.FC<AddTaxRuleModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  saving,
  initialScope = 'CATEGORY',
  initialCategory = '',
  initialProductId = '',
  initialSku = ''
}) => {
  const [scopeType, setScopeType] = useState<TaxRuleScope>(initialScope);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [customCategory, setCustomCategory] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProductId);
  const [productSearch, setProductSearch] = useState<string>('');
  const [selectedSku, setSelectedSku] = useState<string>(initialSku);

  // Core Tax Fields (NEVER HARDCODED / PRE-FILLED)
  const [hsnCode, setHsnCode] = useState<string>('');
  const [rateMode, setRateMode] = useState<TaxRateMode>('FIXED');
  const [gstRate, setGstRate] = useState<number | ''>('');
  const [valueBands, setValueBands] = useState<TaxValueBand[]>([
    { min_price: 0, max_price: 1000, gst_rate: 5 },
    { min_price: 1000.01, max_price: null, gst_rate: 12 }
  ]);
  const [effectiveFrom, setEffectiveFrom] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [effectiveTo, setEffectiveTo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Derive real categories from catalog
  const catalogCategories = useMemo(() => {
    const rawCategories = catalogProducts.map((p) => p.category).filter(Boolean);
    const unique = Array.from(new Set(rawCategories));
    return unique.sort();
  }, []);

  // Filtered products for Product Scope
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return catalogProducts.slice(0, 30);
    const q = productSearch.toLowerCase();
    return catalogProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [productSearch]);

  const selectedProduct = useMemo(() => {
    return catalogProducts.find((p) => p.id === selectedProductId);
  }, [selectedProductId]);

  if (!isOpen) return null;

  // Value Band Helpers
  const handleAddValueBand = () => {
    const lastBand = valueBands[valueBands.length - 1];
    const newMin = lastBand && lastBand.max_price !== null ? lastBand.max_price + 0.01 : 1000.01;
    setValueBands([...valueBands, { min_price: newMin, max_price: null, gst_rate: 12 }]);
  };

  const handleUpdateValueBand = (index: number, field: keyof TaxValueBand, value: any) => {
    const updated = [...valueBands];
    updated[index] = { ...updated[index], [field]: value };
    setValueBands(updated);
  };

  const handleRemoveValueBand = (index: number) => {
    if (valueBands.length <= 1) return;
    setValueBands(valueBands.filter((_, idx) => idx !== index));
  };

  const validateBands = (): string | null => {
    if (rateMode !== 'VALUE_BAND') return null;
    if (valueBands.length === 0) return 'At least one value band is required.';
    for (let i = 0; i < valueBands.length; i++) {
      const b = valueBands[i];
      if (b.min_price < 0) return `Band #${i + 1} has negative min price.`;
      if (b.max_price !== null && b.max_price <= b.min_price) {
        return `Band #${i + 1}: max price (₹${b.max_price}) must be strictly greater than min price (₹${b.min_price}).`;
      }
      if (b.gst_rate < 0 || b.gst_rate > 100 || isNaN(b.gst_rate)) {
        return `Band #${i + 1} has invalid GST rate.`;
      }
    }
    // Check overlaps
    for (let i = 0; i < valueBands.length; i++) {
      for (let j = i + 1; j < valueBands.length; j++) {
        const b1 = valueBands[i];
        const b2 = valueBands[j];
        const b1Max = b1.max_price === null ? Infinity : b1.max_price;
        const b2Max = b2.max_price === null ? Infinity : b2.max_price;
        const overlap = Math.max(b1.min_price, b2.min_price) <= Math.min(b1Max, b2Max);
        if (overlap) {
          return `Price bands #${i + 1} and #${j + 1} overlap.`;
        }
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate HSN Code
    const cleanHsn = hsnCode.trim();
    if (!cleanHsn) {
      setFormError('HSN code is required.');
      return;
    }
    if (!/^[0-9]{4,8}$/.test(cleanHsn)) {
      setFormError('Invalid HSN code. Must be 4 to 8 numeric digits.');
      return;
    }

    // Validate Rate
    if (rateMode === 'FIXED') {
      if (gstRate === '' || isNaN(Number(gstRate))) {
        setFormError('Please select a valid GST rate.');
        return;
      }
    } else {
      const bandErr = validateBands();
      if (bandErr) {
        setFormError(bandErr);
        return;
      }
    }

    // Scope-specific validation
    let scope_value = '';
    let categoryPayload: string | undefined = undefined;
    let productIdPayload: string | undefined = undefined;
    let skuPayload: string | undefined = undefined;

    if (scopeType === 'CATEGORY') {
      const cat = selectedCategory === '__CUSTOM__' ? customCategory.trim() : selectedCategory.trim();
      if (!cat) {
        setFormError('Please select or specify a category for the category rule.');
        return;
      }
      scope_value = cat;
      categoryPayload = cat;
    } else if (scopeType === 'PRODUCT') {
      if (!selectedProductId.trim()) {
        setFormError('Please select a product for the product rule.');
        return;
      }
      scope_value = selectedProductId.trim();
      productIdPayload = selectedProductId.trim();
    } else if (scopeType === 'SKU') {
      if (!selectedSku.trim()) {
        setFormError('Please specify a SKU for the SKU override rule.');
        return;
      }
      scope_value = selectedSku.trim();
      skuPayload = selectedSku.trim();
    } else if (scopeType === 'DEFAULT') {
      scope_value = 'DEFAULT';
    }

    if (!effectiveFrom) {
      setFormError('Effective From date is required.');
      return;
    }

    const payload = {
      scope_type: scopeType,
      scope_value: scope_value,
      category: categoryPayload,
      product_id: productIdPayload,
      sku: skuPayload,
      product_name_snapshot: selectedProduct ? selectedProduct.name : undefined,
      hsn_code: cleanHsn,
      rate_mode: rateMode,
      gst_rate: rateMode === 'FIXED' ? Number(gstRate) : undefined,
      value_bands: rateMode === 'VALUE_BAND' ? valueBands : undefined,
      effective_from: new Date(effectiveFrom).toISOString(),
      effective_to: effectiveTo ? new Date(effectiveTo).toISOString() : null,
      status: 'ACTIVE',
      notes: notes.trim() || undefined,
      reason: `Created ${scopeType} tax rule for '${scope_value}' via Admin UI`
    };

    const success = await onSubmit(payload);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-xl max-w-xl w-full p-6 space-y-5 shadow-2xl border border-stone-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-stone-900">Add Product Tax Master Rule</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Configure statutory HSN and GST rate mappings according to resolution priority.
            </p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. RULE SCOPE SELECTOR */}
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider">
                1. Rule Scope *
              </label>
              <span className="text-[11px] text-stone-500 font-medium">Priority Hierarchy</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setScopeType('CATEGORY')}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all text-center ${
                  scopeType === 'CATEGORY'
                    ? 'bg-indigo-700 text-white border-indigo-800 shadow-xs ring-2 ring-indigo-200'
                    : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                }`}
              >
                Category Rule
              </button>

              <button
                type="button"
                onClick={() => setScopeType('PRODUCT')}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all text-center ${
                  scopeType === 'PRODUCT'
                    ? 'bg-purple-700 text-white border-purple-800 shadow-xs ring-2 ring-purple-200'
                    : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                }`}
              >
                Product Rule
              </button>

              <button
                type="button"
                onClick={() => setScopeType('SKU')}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all text-center ${
                  scopeType === 'SKU'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs ring-2 ring-amber-200'
                    : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                }`}
              >
                SKU Override
              </button>

              <button
                type="button"
                onClick={() => setScopeType('DEFAULT')}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all text-center ${
                  scopeType === 'DEFAULT'
                    ? 'bg-stone-800 text-white border-stone-900 shadow-xs ring-2 ring-stone-200'
                    : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                }`}
              >
                Default Fallback
              </button>
            </div>

            <p className="text-[11px] text-stone-500 pt-1">
              Tax resolution priority: <strong>SKU Override</strong> → <strong>Product Override</strong> → <strong>Category Rule</strong> → <strong>Default Fallback</strong>.
            </p>
          </div>

          {/* 2. DYNAMIC SCOPE TARGET INPUT */}
          {scopeType === 'CATEGORY' && (
            <div className="space-y-2 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
              <label className="block text-xs font-semibold text-indigo-950 uppercase tracking-wider">
                Catalog Category *
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-700 focus:outline-none capitalize"
              >
                <option value="">-- Select Real Catalog Category --</option>
                {catalogCategories.map((cat) => {
                  const count = catalogProducts.filter((p) => p.category === cat).length;
                  return (
                    <option key={cat} value={cat}>
                      {cat.replace(/[-_]/g, ' ')} ({count} active products)
                    </option>
                  );
                })}
                <option value="__CUSTOM__">+ Enter Other Custom Category</option>
              </select>

              {selectedCategory === '__CUSTOM__' && (
                <div className="pt-2">
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter custom category name (e.g. kurtas)"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-700 focus:outline-none"
                  />
                </div>
              )}
              <p className="text-[11px] text-indigo-800/80">
                Rule applies automatically to all products in this category unless a product/SKU override exists.
              </p>
            </div>
          )}

          {scopeType === 'PRODUCT' && (
            <div className="space-y-2 p-3 bg-purple-50/50 rounded-lg border border-purple-100">
              <label className="block text-xs font-semibold text-purple-950 uppercase tracking-wider">
                Catalog Product *
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Type to filter product name or ID..."
                  className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-700 focus:outline-none"
                />

                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-700 focus:outline-none"
                >
                  <option value="">-- Select Catalog Product --</option>
                  {filteredProducts.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} ({prod.id}) — ₹{prod.price} [{prod.category}]
                    </option>
                  ))}
                </select>
              </div>

              {selectedProduct && (
                <div className="text-[11px] text-purple-900 bg-purple-100/60 p-2 rounded border border-purple-200">
                  Target Product ID: <strong className="font-mono">{selectedProduct.id}</strong> | Category: <strong className="capitalize">{selectedProduct.category}</strong> | Price: <strong>₹{selectedProduct.price}</strong>
                </div>
              )}
            </div>
          )}

          {scopeType === 'SKU' && (
            <div className="space-y-2 p-3 bg-amber-50/50 rounded-lg border border-amber-100">
              <label className="block text-xs font-semibold text-amber-950 uppercase tracking-wider">
                SKU Identifier * (Highest Priority Override)
              </label>
              <input
                type="text"
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value.toUpperCase())}
                placeholder="e.g. KL-LS-WHT-M"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-amber-600 focus:outline-none"
              />
              <p className="text-[11px] text-amber-800">
                SKU rules override both Product and Category rules for this exact stock-keeping unit.
              </p>
            </div>
          )}

          {scopeType === 'DEFAULT' && (
            <div className="p-3 bg-stone-100 rounded-lg border border-stone-300 text-xs text-stone-800 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block">Global Default Fallback Scope</strong>
                <p className="text-[11px] text-stone-600 mt-0.5">
                  Default rules apply strictly as the last resort when no SKU, Product, or Category rule matches the evaluated item.
                </p>
              </div>
            </div>
          )}

          {/* 3. HSN CODE & RATE MODE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                HSN Code (4-8 Digits) *
              </label>
              <input
                type="text"
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
                placeholder="e.g. 6205 or 6302"
                maxLength={8}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
              />
              <span className="text-[10px] text-stone-400 mt-0.5 block">Standard Goods and Services Harmonized Code</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                Rate Mode *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRateMode('FIXED')}
                  className={`py-2 rounded-lg text-xs font-semibold border text-center transition-all ${
                    rateMode === 'FIXED'
                      ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  Fixed Rate
                </button>
                <button
                  type="button"
                  onClick={() => setRateMode('VALUE_BAND')}
                  className={`py-2 rounded-lg text-xs font-semibold border text-center transition-all ${
                    rateMode === 'VALUE_BAND'
                      ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  Value Band
                </button>
              </div>
            </div>
          </div>

          {/* 4. GST RATE CONFIGURATION */}
          {rateMode === 'FIXED' ? (
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                GST Rate (%) *
              </label>
              <select
                value={gstRate}
                onChange={(e) => setGstRate(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
              >
                <option value="">-- Select Neutral GST Rate --</option>
                <option value={0}>0% (Exempt / Nil Rated)</option>
                <option value={5}>5%</option>
                <option value={12}>12%</option>
                <option value={18}>18%</option>
                <option value={28}>28%</option>
              </select>
            </div>
          ) : (
            <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-stone-900 uppercase">
                  Price Value Bands (Tiered Rates)
                </label>
                <button
                  type="button"
                  onClick={handleAddValueBand}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Band
                </button>
              </div>

              <div className="space-y-2">
                {valueBands.map((band, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-white rounded-lg border border-stone-200 grid grid-cols-12 gap-2 items-center text-xs"
                  >
                    <div className="col-span-4">
                      <span className="text-[10px] text-stone-500 uppercase block">Min Price (₹)</span>
                      <input
                        type="number"
                        value={band.min_price}
                        onChange={(e) => handleUpdateValueBand(idx, 'min_price', Number(e.target.value))}
                        min={0}
                        step="0.01"
                        className="w-full px-2 py-1 border border-stone-300 rounded text-xs font-mono"
                      />
                    </div>

                    <div className="col-span-4">
                      <span className="text-[10px] text-stone-500 uppercase block">Max Price (₹)</span>
                      <input
                        type="text"
                        value={band.max_price === null ? '' : band.max_price}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          handleUpdateValueBand(idx, 'max_price', val === '' ? null : Number(val));
                        }}
                        placeholder="No Limit (null)"
                        className="w-full px-2 py-1 border border-stone-300 rounded text-xs font-mono"
                      />
                    </div>

                    <div className="col-span-3">
                      <span className="text-[10px] text-stone-500 uppercase block">GST Rate</span>
                      <select
                        value={band.gst_rate}
                        onChange={(e) => handleUpdateValueBand(idx, 'gst_rate', Number(e.target.value))}
                        className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                      >
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                        <option value={28}>28%</option>
                      </select>
                    </div>

                    <div className="col-span-1 flex justify-end pt-3">
                      {valueBands.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveValueBand(idx)}
                          className="text-stone-400 hover:text-red-600 p-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-stone-500">
                Example: Unit price ≤ ₹1,000 taxes at 5%; Unit price &gt; ₹1,000 taxes at 12%. Leave Max Price blank for the upper tier.
              </p>
            </div>
          )}

          {/* 5. EFFECTIVE DATES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                Effective From *
              </label>
              <input
                type="date"
                required
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                Effective To (Optional)
              </label>
              <input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                placeholder="Indefinite"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-700 focus:outline-none"
              />
              <span className="text-[10px] text-stone-400 mt-0.5 block">Leave empty for active indefinite rule</span>
            </div>
          </div>

          {/* 6. NOTES */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
              Internal Audit Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Statutory HSN update according to notification 2026-GST-01"
              maxLength={200}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-stone-600 hover:text-stone-900 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-emerald-800 text-white rounded-lg text-xs font-bold hover:bg-emerald-900 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating Rule...' : 'Create Tax Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
