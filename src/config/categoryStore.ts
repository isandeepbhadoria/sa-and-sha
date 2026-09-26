/**
 * Category Master — client-side store.
 *
 * Holds the flat, admin-editable category tree fetched from the public
 * `GET /api/categories` endpoint (see server.ts / src/server/categoryHelpers.ts),
 * and keeps src/config/catalogTaxonomy.ts's module-level taxonomy data
 * (CANONICAL_COLLECTIONS, CANONICAL_PRODUCT_TYPES, ...) in sync with it via
 * applyCategoryMasterData().
 *
 * Consumers (AdminPage.tsx's product form, CollectionPage.tsx's
 * getTaxonomyRouteInfo() usage) don't need to fetch anything themselves —
 * they just call useCategoryMaster() so they re-render whenever this store
 * updates (initial load, or right after an admin edits Category Master).
 */

import { useSyncExternalStore } from 'react';
import { applyCategoryMasterData, CategoryMasterNode } from './catalogTaxonomy';

let nodes: CategoryMasterNode[] = [];
let loaded = false;
let snapshot: { nodes: CategoryMasterNode[]; loaded: boolean } = { nodes, loaded };
const listeners = new Set<() => void>();

function emit(): void {
  snapshot = { nodes, loaded };
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

/**
 * Applies a freshly-fetched node list to both this store and
 * catalogTaxonomy.ts's live taxonomy data, then notifies subscribers.
 */
export function setCategoryMasterNodes(fetchedNodes: CategoryMasterNode[]): void {
  if (!Array.isArray(fetchedNodes)) return;
  nodes = fetchedNodes;
  loaded = true;
  applyCategoryMasterData(fetchedNodes);
  emit();
}

/**
 * Fetches the active Category Master tree from the public API and applies
 * it. Safe to call more than once (e.g. once on app mount via ShopContext,
 * and again after an admin edits Category Master) — failures are swallowed
 * so the storefront/admin form simply keep using whatever data they already
 * have (the catalogTaxonomy.ts hardcoded defaults, until the first
 * successful fetch).
 */
export async function refreshCategoryMaster(): Promise<void> {
  try {
    const res = await fetch('/api/categories');
    if (!res.ok) return;
    const data = await res.json();
    if (data && Array.isArray(data.nodes)) {
      setCategoryMasterNodes(data.nodes);
    }
  } catch (err) {
    console.warn('[CategoryMaster] Failed to fetch /api/categories:', err);
  }
}

/**
 * Subscribes the calling component to Category Master updates. The return
 * value's `nodes`/`loaded` are rarely needed directly (most consumers keep
 * reading CANONICAL_COLLECTIONS etc. from catalogTaxonomy.ts as before) —
 * calling this hook is what makes the component re-render when that
 * underlying data changes.
 */
export function useCategoryMaster() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
