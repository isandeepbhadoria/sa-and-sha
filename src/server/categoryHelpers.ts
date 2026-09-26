/**
 * Category Master — server-side helpers.
 *
 * Firestore-backed replacement for the hardcoded merchandising category
 * taxonomy in src/config/catalogTaxonomy.ts. Categories live in the
 * `categories` collection, one document per node, 3 levels deep
 * (Collection -> Product Type -> Sub-Type). A node's Firestore document id
 * IS its category id (e.g. "dresses") — this is what lets firestore.rules
 * validate a product's `category` field with a cheap exists() lookup
 * instead of a hardcoded array, and what lets existing products' plain
 * `category`/`subCategory`/`collection`/`productType`/`productSubType`
 * string fields keep resolving unchanged.
 *
 * `db` is accepted as a parameter (defaulting to getAdminDb()) purely so
 * these functions are unit-testable against a lightweight fake Firestore
 * without real credentials — see src/server/__tests__/categoryMaster.test.ts.
 */

import { getAdminDb } from './firebaseAdmin';
import {
  CANONICAL_COLLECTIONS,
  CANONICAL_PRODUCT_TYPES,
  CANONICAL_PRODUCT_SUB_TYPES,
  COLLECTION_PRODUCT_TYPE_MATRIX,
  PRODUCT_TYPE_SUBTYPES_MATRIX
} from '../config/catalogTaxonomy';

export interface CategoryNode {
  id: string;
  label: string;
  parentId: string | null;
  level: number; // 0 = Collection, 1 = Product Type, 2 = Product Sub-Type
  sortOrder: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SeedNodeInput {
  id: string;
  label: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
}

/**
 * Derives the exact one-time seed node list from catalogTaxonomy.ts's
 * hardcoded defaults — CANONICAL_COLLECTIONS, CANONICAL_PRODUCT_TYPES,
 * CANONICAL_PRODUCT_SUB_TYPES and the two matrices. Pure/no I/O: this
 * module never calls applyCategoryMasterData() itself, so on the server
 * these constants always stay equal to their original hardcoded values —
 * exactly what needs to be seeded into Firestore. Preserves every id and
 * label string exactly as-is.
 */
export function buildSeedNodes(): SeedNodeInput[] {
  const nodes: SeedNodeInput[] = [];

  CANONICAL_COLLECTIONS.forEach((c, i) => {
    nodes.push({ id: c.id, label: c.label, parentId: null, level: 0, sortOrder: i });
  });

  CANONICAL_COLLECTIONS.forEach((c) => {
    const typeIds = COLLECTION_PRODUCT_TYPE_MATRIX[c.id] || [];
    typeIds.forEach((ptId, i) => {
      const pt = CANONICAL_PRODUCT_TYPES.find(p => p.id === ptId);
      if (pt) nodes.push({ id: pt.id, label: pt.label, parentId: c.id, level: 1, sortOrder: i });
    });
  });

  CANONICAL_PRODUCT_TYPES.forEach((pt) => {
    const subIds = PRODUCT_TYPE_SUBTYPES_MATRIX[pt.id] || [];
    subIds.forEach((stId, i) => {
      const st = CANONICAL_PRODUCT_SUB_TYPES.find(s => s.id === stId);
      if (st) nodes.push({ id: st.id, label: st.label, parentId: pt.id, level: 2, sortOrder: i });
    });
  });

  return nodes;
}

/**
 * Idempotent seed: only creates documents that don't already exist, so
 * running it more than once never duplicates data or clobbers an admin's
 * subsequent edits (label/active/sortOrder) to an already-seeded category.
 * Same convention as seedDefaultMasterListIfEmpty() in server.ts for the
 * Material Type / Fit Profile masters.
 */
export async function seedCategories(db: any = getAdminDb()): Promise<{ total: number; seeded: number }> {
  const nodes = buildSeedNodes();
  const col = db.collection('categories');
  let seeded = 0;

  for (const node of nodes) {
    const ref = col.doc(node.id);
    const snap = await ref.get();
    if (!snap.exists) {
      const now = new Date().toISOString();
      await ref.set({
        id: node.id,
        label: node.label,
        parentId: node.parentId,
        level: node.level,
        sortOrder: node.sortOrder,
        active: true,
        createdAt: now,
        updatedAt: now
      });
      seeded++;
    }
  }

  return { total: nodes.length, seeded };
}

export async function fetchAllCategoryNodes(db: any = getAdminDb()): Promise<CategoryNode[]> {
  const snap = await db.collection('categories').get();
  return snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as CategoryNode[];
}

/** Same slug rules as server.ts's top-level slugify() / AdminPage.tsx's local copy. */
export function slugifyLabel(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export type CategoryMutationResult =
  | { ok: true; node: CategoryNode }
  | { ok: false; error: string; status: number };

/**
 * Creates a new category node. `parentId: null` creates a top-level
 * Collection (level 0); a non-null parentId creates a child one level
 * deeper than its parent (Product Type under a Collection, Sub-Type under
 * a Product Type) — nesting past level 2 is rejected, matching the fixed
 * 3-level Collection/Product Type/Sub-Type hierarchy this whole feature
 * models.
 */
export async function createCategory(
  input: { label: string; parentId: string | null; sortOrder?: number },
  db: any = getAdminDb()
): Promise<CategoryMutationResult> {
  const label = (input.label || '').toString().trim();
  if (!label) {
    return { ok: false, error: 'Label is required.', status: 400 };
  }

  const col = db.collection('categories');
  const parentId = input.parentId || null;
  let level = 0;

  if (parentId) {
    const parentSnap = await col.doc(parentId).get();
    if (!parentSnap.exists) {
      return { ok: false, error: 'Parent category not found.', status: 400 };
    }
    const parentData = parentSnap.data() || {};
    level = (typeof parentData.level === 'number' ? parentData.level : 0) + 1;
    if (level > 2) {
      return { ok: false, error: 'Maximum category depth (3 levels: Collection, Product Type, Sub-Type) exceeded.', status: 400 };
    }
  }

  const id = slugifyLabel(label);
  if (!id) {
    return { ok: false, error: 'Could not derive a valid id from this label.', status: 400 };
  }

  const ref = col.doc(id);
  const existing = await ref.get();
  if (existing.exists) {
    return { ok: false, error: `A category with id "${id}" already exists.`, status: 400 };
  }

  let sortOrder = input.sortOrder;
  if (sortOrder === undefined || sortOrder === null || !Number.isFinite(sortOrder)) {
    const siblingsSnap = await col.where('parentId', '==', parentId).get();
    sortOrder = siblingsSnap.size;
  }

  const now = new Date().toISOString();
  const node: CategoryNode = {
    id,
    label,
    parentId,
    level,
    sortOrder,
    active: true,
    createdAt: now,
    updatedAt: now
  };
  await ref.set(node);
  return { ok: true, node };
}

/**
 * Edits label/sortOrder/active on an existing category. parentId/level are
 * intentionally not editable here — re-parenting a node would change the
 * meaning of every product that already references it, which is out of
 * scope for this admin surface (deactivate + create a new node instead).
 */
export async function updateCategory(
  id: string,
  updates: { label?: string; sortOrder?: number; active?: boolean },
  db: any = getAdminDb()
): Promise<CategoryMutationResult> {
  const ref = db.collection('categories').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, error: 'Category not found.', status: 404 };
  }

  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (typeof updates.label === 'string' && updates.label.trim()) {
    patch.label = updates.label.trim();
  }
  if (typeof updates.sortOrder === 'number' && Number.isFinite(updates.sortOrder)) {
    patch.sortOrder = updates.sortOrder;
  }
  if (typeof updates.active === 'boolean') {
    patch.active = updates.active;
  }

  await ref.set(patch, { merge: true });
  const updatedSnap = await ref.get();
  return { ok: true, node: { id, ...updatedSnap.data() } as CategoryNode };
}
