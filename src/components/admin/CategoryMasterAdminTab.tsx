import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, RefreshCw, Pencil, Check, X, EyeOff, Eye, FolderTree } from 'lucide-react';
import { refreshCategoryMaster } from '../../config/categoryStore';

interface CategoryNode {
  id: string;
  label: string;
  parentId: string | null;
  level: number; // 0 = Collection, 1 = Product Type, 2 = Product Sub-Type
  sortOrder: number;
  active: boolean;
}

interface CategoryMasterAdminTabProps {
  adminToken?: string;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const LEVEL_LABEL = ['Collection', 'Product Type', 'Sub-Type'];

// 3-level admin-editable Category Master (Collection -> Product Type ->
// Sub-Type), replacing the old hardcoded arrays in
// src/config/catalogTaxonomy.ts. Backed by Firestore's `categories`
// collection — each node's `id` is the doc id, and is exactly what
// existing/new products store in `category` (level 1) or `collection`
// (level 0), and what firestore.rules checks with exists() on writes.
//
// No hard delete, same convention as Material Type / Fit Profile masters
// (see SimpleMasterListTab.tsx): existing products may reference any of
// these, so a category is deactivated instead — it disappears from
// storefront/product-form pickers but stays resolvable for whatever
// already points at it.
export const CategoryMasterAdminTab: React.FC<CategoryMasterAdminTabProps> = ({ adminToken, showToast }) => {
  const [nodes, setNodes] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Inline "add child" form: which parent it's for ('root' = new
  // Collection), and its current label input.
  const [addFormFor, setAddFormFor] = useState<string | null>(null);
  const [addLabel, setAddLabel] = useState('');
  const [adding, setAdding] = useState(false);

  // Inline rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const authHeaders = (): Record<string, string> => ({
    Authorization: `Bearer ${adminToken || ''}`
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/categories', { headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        setNodes(data.nodes || []);
      } else {
        setError(data.error || 'Failed to load categories.');
      }
    } catch (err) {
      setError('Network error while loading categories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh both this tab's own full (incl. inactive) list, and the shared
  // public store the product form / storefront read from — so a newly
  // added or deactivated category is usable elsewhere immediately, without
  // waiting for a page reload.
  const reloadEverything = async () => {
    await Promise.all([load(), refreshCategoryMaster()]);
  };

  const collections = useMemo(() => nodes.filter(n => n.level === 0).sort((a, b) => a.sortOrder - b.sortOrder), [nodes]);
  const childrenOf = (parentId: string) =>
    nodes.filter(n => n.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder);

  const openAddForm = (parentKey: string) => {
    setAddFormFor(parentKey);
    setAddLabel('');
  };

  const cancelAddForm = () => {
    setAddFormFor(null);
    setAddLabel('');
  };

  const submitAddForm = async (parentId: string | null) => {
    const label = addLabel.trim();
    if (!label) return;
    setAdding(true);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ label, parentId })
      });
      const data = await res.json();
      if (data.success) {
        showToast?.(`"${label}" added.`, 'success');
        setAddFormFor(null);
        setAddLabel('');
        await reloadEverything();
      } else {
        showToast?.(data.error || 'Failed to add category.', 'error');
      }
    } catch (err) {
      showToast?.('Network error while adding category.', 'error');
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (node: CategoryNode) => {
    setBusyId(node.id);
    try {
      const res = await fetch(`/api/admin/categories/${encodeURIComponent(node.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ active: !node.active })
      });
      const data = await res.json();
      if (data.success) {
        showToast?.(node.active ? `"${node.label}" deactivated.` : `"${node.label}" reactivated.`, 'success');
        await reloadEverything();
      } else {
        showToast?.(data.error || 'Failed to update category.', 'error');
      }
    } catch (err) {
      showToast?.('Network error while updating category.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (node: CategoryNode) => {
    setEditingId(node.id);
    setEditLabel(node.label);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel('');
  };

  const saveEdit = async (node: CategoryNode) => {
    const label = editLabel.trim();
    if (!label || label === node.label) {
      cancelEdit();
      return;
    }
    setBusyId(node.id);
    try {
      const res = await fetch(`/api/admin/categories/${encodeURIComponent(node.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ label })
      });
      const data = await res.json();
      if (data.success) {
        showToast?.('Category renamed.', 'success');
        cancelEdit();
        await reloadEverything();
      } else {
        showToast?.(data.error || 'Failed to rename category.', 'error');
      }
    } catch (err) {
      showToast?.('Network error while renaming category.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const renderAddForm = (parentId: string | null, parentKey: string) => {
    if (addFormFor !== parentKey) return null;
    return (
      <div className="flex items-center gap-2 mt-2 pl-2">
        <input
          autoFocus
          type="text"
          value={addLabel}
          onChange={(e) => setAddLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitAddForm(parentId);
            if (e.key === 'Escape') cancelAddForm();
          }}
          placeholder={`New ${LEVEL_LABEL[(parentId ? (nodes.find(n => n.id === parentId)?.level ?? -1) + 1 : 0)] || 'category'} name`}
          className="flex-1 px-2.5 py-1.5 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-white text-stone-800 text-xs"
        />
        <button
          onClick={() => submitAddForm(parentId)}
          disabled={adding || !addLabel.trim()}
          className="flex items-center gap-1 px-3 py-1.5 bg-[#B08D57] hover:bg-[#9c7a4a] text-white text-[11px] font-bold uppercase tracking-wider rounded transition-colors cursor-pointer disabled:opacity-50"
        >
          {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Save
        </button>
        <button
          onClick={cancelAddForm}
          className="p-1.5 text-stone-400 hover:text-stone-700 rounded cursor-pointer"
          aria-label="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  const renderRow = (node: CategoryNode, depth: number, onAddChild?: () => void) => {
    const isEditing = editingId === node.id;
    const isBusy = busyId === node.id;
    return (
      <div key={node.id} className={`py-2 ${depth > 0 ? 'pl-6 border-l border-stone-100 ml-2' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isEditing ? (
              <>
                <input
                  autoFocus
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(node);
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  className="px-2 py-1 border border-stone-200 rounded focus:outline-none focus:border-[#B08D57] bg-white text-stone-800 text-xs"
                />
                <button onClick={() => saveEdit(node)} disabled={isBusy} className="p-1 text-green-700 hover:bg-green-50 rounded cursor-pointer" aria-label="Save">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={cancelEdit} className="p-1 text-stone-400 hover:bg-stone-100 rounded cursor-pointer" aria-label="Cancel">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <span className={`text-sm font-medium truncate ${node.active ? 'text-stone-800' : 'text-stone-400 line-through'}`}>
                  {node.label}
                </span>
                <span className="text-[9px] font-mono text-stone-400 truncate">({node.id})</span>
                {!node.active && (
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full shrink-0">
                    Inactive
                  </span>
                )}
                <button
                  onClick={() => startEdit(node)}
                  className="p-1 text-stone-400 hover:text-[#B08D57] rounded cursor-pointer shrink-0"
                  aria-label={`Rename ${node.label}`}
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onAddChild && (
              <button
                onClick={onAddChild}
                className="flex items-center gap-1 px-2 py-1 border border-stone-200 hover:border-[#B08D57] hover:text-[#B08D57] text-stone-600 text-[10px] font-bold uppercase tracking-wider rounded transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Add {LEVEL_LABEL[node.level + 1]}
              </button>
            )}
            <button
              onClick={() => toggleActive(node)}
              disabled={isBusy}
              className="flex items-center gap-1 px-2 py-1 border border-stone-200 hover:border-stone-400 text-stone-500 text-[10px] font-bold uppercase tracking-wider rounded transition-colors cursor-pointer disabled:opacity-50"
            >
              {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : node.active ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {node.active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-[#B08D57]" />
          <div>
            <h2 className="font-serif text-lg font-bold text-stone-800">Category Master</h2>
            <p className="text-xs text-stone-500 mt-1 max-w-xl">
              The Collection → Product Type → Sub-Type hierarchy used by the storefront's shop navigation and the
              product form's category pickers. Categories are never deleted — deactivate one instead to hide it
              without breaking existing products that reference it.
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-600 disabled:opacity-50 cursor-pointer shrink-0"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Collections</span>
          <button
            onClick={() => openAddForm('root')}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#B08D57] hover:bg-[#9c7a4a] text-white text-[11px] font-bold uppercase tracking-wider rounded transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Collection
          </button>
        </div>

        {renderAddForm(null, 'root')}

        {loading ? (
          <div className="p-6 text-center text-xs text-stone-400">Loading…</div>
        ) : collections.length === 0 ? (
          <div className="p-6 text-center text-xs text-stone-400">No collections yet — add the first one above.</div>
        ) : (
          <div className="divide-y divide-stone-50 mt-2">
            {collections.map(collection => (
              <div key={collection.id}>
                {renderRow(collection, 0, () => openAddForm(collection.id))}
                {renderAddForm(collection.id, collection.id)}

                {childrenOf(collection.id).map(productType => (
                  <div key={productType.id}>
                    {renderRow(productType, 1, () => openAddForm(productType.id))}
                    {renderAddForm(productType.id, productType.id)}

                    {childrenOf(productType.id).map(subType => (
                      <div key={subType.id}>{renderRow(subType, 2)}</div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
