import React, { useState, useEffect } from 'react';
import { Plus, Loader2, RefreshCw } from 'lucide-react';

interface MasterItem {
  id: string;
  name: string;
}

interface SimpleMasterListTabProps {
  title: string;
  description: string;
  endpoint: string; // e.g. "/api/admin/material-types"
  addLabel: string; // e.g. "Add Material Type"
  namePlaceholder: string; // e.g. "e.g. Rayon"
  adminToken?: string;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// Generic add-only master list — used identically for Material Type Master
// and Fit Profile Master (see server.ts's registerSimpleMasterEndpoints).
// No delete: these values are referenced by existing products, same
// reasoning as the ERP's own Brand Master never allowing delete.
export const SimpleMasterListTab: React.FC<SimpleMasterListTabProps> = ({
  title,
  description,
  endpoint,
  addLabel,
  namePlaceholder,
  adminToken,
  showToast
}) => {
  const [items, setItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${adminToken || ''}` }
      });
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
      } else {
        setError(data.error || 'Failed to load.');
      }
    } catch (err) {
      setError('Network error while loading.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken || ''}` },
        body: JSON.stringify({ name: trimmed })
      });
      const data = await res.json();
      if (data.success) {
        setNewName('');
        showToast?.(`"${trimmed}" added.`, 'success');
        await load();
      } else {
        showToast?.(data.error || 'Failed to add.', 'error');
      }
    } catch (err) {
      showToast?.('Network error while adding.', 'error');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-lg font-bold text-stone-800">{title}</h2>
          <p className="text-xs text-stone-500 mt-1 max-w-xl">{description}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-600 disabled:opacity-50 cursor-pointer"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <form onSubmit={handleAdd} className="flex items-end gap-3 bg-stone-50 border border-stone-200 rounded-xl p-4">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">{addLabel}</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={namePlaceholder}
            className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-white font-medium text-stone-800 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#B08D57] hover:bg-[#9c7a4a] text-white text-xs font-bold uppercase tracking-wider rounded transition-colors cursor-pointer disabled:opacity-50"
        >
          {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Add
        </button>
      </form>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
        {loading ? (
          <div className="p-6 text-center text-xs text-stone-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-xs text-stone-400">Nothing here yet — add the first one above.</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="px-4 py-2.5 text-sm font-medium text-stone-700">
              {item.name}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
