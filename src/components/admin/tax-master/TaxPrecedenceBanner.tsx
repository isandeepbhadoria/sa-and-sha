import React from 'react';
import { ArrowRight, Layers, Info } from 'lucide-react';

export const TaxPrecedenceBanner: React.FC = () => {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-emerald-800" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900">
          Canonical Tax Resolution Priority
        </h4>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-medium">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100/90 text-amber-900 border border-amber-300/80 rounded-lg shadow-2xs">
          <span className="font-bold">1. SKU Override</span>
          <span className="text-[10px] text-amber-700 bg-amber-200/60 px-1 rounded">Highest</span>
        </div>

        <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100/90 text-purple-900 border border-purple-300/80 rounded-lg shadow-2xs">
          <span className="font-bold">2. Product Override</span>
        </div>

        <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100/90 text-indigo-900 border border-indigo-300/80 rounded-lg shadow-2xs">
          <span className="font-bold">3. Category Rule</span>
          <span className="text-[10px] text-indigo-700 bg-indigo-200/60 px-1 rounded">Catalog Default</span>
        </div>

        <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-200/90 text-stone-800 border border-stone-300 rounded-lg shadow-2xs">
          <span className="font-bold">4. Default Fallback</span>
          <span className="text-[10px] text-stone-600 bg-stone-300/60 px-1 rounded">Lowest</span>
        </div>
      </div>

      <p className="text-xs text-stone-500 mt-3 flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5 text-stone-400 shrink-0" />
        The most specific active and date-effective rule is used when generating a GST invoice. If no rule matches, invoice generation will fail-closed.
      </p>
    </div>
  );
};
