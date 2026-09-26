import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildSeedNodes,
  seedCategories,
  fetchAllCategoryNodes,
  createCategory,
  updateCategory,
  slugifyLabel
} from '../categoryHelpers';
import { applyCategoryMasterData, CANONICAL_COLLECTIONS, CANONICAL_PRODUCT_TYPES, CANONICAL_PRODUCT_SUB_TYPES, COLLECTION_PRODUCT_TYPE_MATRIX, PRODUCT_TYPE_SUBTYPES_MATRIX } from '../../config/catalogTaxonomy';

// ---------------------------------------------------------------------------
// Minimal in-memory fake Firestore — just enough surface
// (collection/doc/get/set/where) for categoryHelpers.ts, so this suite runs
// with no real Firebase Admin credentials (none are configured in this
// sandbox — see the PR description for how this was verified).
// ---------------------------------------------------------------------------
function createFakeDb() {
  const store = new Map<string, Record<string, any>>();

  function docHandle(collectionName: string, id: string) {
    const key = `${collectionName}/${id}`;
    return {
      id,
      get: async () => {
        const data = store.get(key);
        return {
          exists: data !== undefined,
          data: () => (data ? { ...data } : undefined)
        };
      },
      set: async (data: Record<string, any>, opts?: { merge?: boolean }) => {
        if (opts?.merge && store.has(key)) {
          store.set(key, { ...store.get(key), ...data });
        } else {
          store.set(key, { ...data });
        }
      }
    };
  }

  function collectionHandle(collectionName: string) {
    return {
      doc: (id: string) => docHandle(collectionName, id),
      get: async () => {
        const docs = Array.from(store.entries())
          .filter(([key]) => key.startsWith(`${collectionName}/`))
          .map(([key, data]) => ({ id: key.slice(collectionName.length + 1), data: () => ({ ...data }) }));
        return { docs, size: docs.length };
      },
      where: (field: string, _op: '==', value: any) => ({
        get: async () => {
          const docs = Array.from(store.entries())
            .filter(([key, data]) => key.startsWith(`${collectionName}/`) && data[field] === value)
            .map(([key, data]) => ({ id: key.slice(collectionName.length + 1), data: () => ({ ...data }) }));
          return { docs, size: docs.length };
        }
      })
    };
  }

  return {
    collection: (name: string) => collectionHandle(name),
    _dump: () => Object.fromEntries(store.entries())
  };
}

describe('Category Master — server helpers (src/server/categoryHelpers.ts)', () => {
  describe('buildSeedNodes() — pure derivation from catalogTaxonomy.ts defaults', () => {
    it('produces exactly the 2 collections, 7 product types, and 4 sub-types from the original hardcoded taxonomy', () => {
      const nodes = buildSeedNodes();

      const collections = nodes.filter(n => n.level === 0);
      const productTypes = nodes.filter(n => n.level === 1);
      const subTypes = nodes.filter(n => n.level === 2);

      expect(collections.map(n => n.id).sort()).toEqual(['accessories', 'apparel']);
      expect(productTypes.map(n => n.id).sort()).toEqual(
        ['bags-pouches', 'co-ord-sets', 'dresses', 'jackets', 'shorts-skirts', 'tops-shirts', 'trousers'].sort()
      );
      expect(subTypes.map(n => n.id).sort()).toEqual(['shirts', 'shorts', 'skirts', 'tops'].sort());
    });

    it('preserves each id and label exactly as catalogTaxonomy.ts defines them', () => {
      const nodes = buildSeedNodes();
      const dresses = nodes.find(n => n.id === 'dresses');
      expect(dresses?.label).toBe('Dresses');
      const topsShirts = nodes.find(n => n.id === 'tops-shirts');
      expect(topsShirts?.label).toBe('Top & Shirts');
    });

    it('derives parentId from the collection/product-type matrices', () => {
      const nodes = buildSeedNodes();
      const bagsPouches = nodes.find(n => n.id === 'bags-pouches');
      expect(bagsPouches?.parentId).toBe('accessories');
      const dresses = nodes.find(n => n.id === 'dresses');
      expect(dresses?.parentId).toBe('apparel');
      const tops = nodes.find(n => n.id === 'tops');
      expect(tops?.parentId).toBe('tops-shirts');
      const shorts = nodes.find(n => n.id === 'shorts');
      expect(shorts?.parentId).toBe('shorts-skirts');
    });
  });

  describe('seedCategories() — idempotent Firestore seed', () => {
    it('creates one document per seed node on first run', async () => {
      const db = createFakeDb();
      const result = await seedCategories(db);
      expect(result.seeded).toBe(result.total);
      expect(result.total).toBe(buildSeedNodes().length);

      const nodes = await fetchAllCategoryNodes(db);
      expect(nodes.length).toBe(result.total);
      expect(nodes.every(n => n.active === true)).toBe(true);
    });

    it('running it a second time seeds nothing new and does not duplicate documents', async () => {
      const db = createFakeDb();
      await seedCategories(db);
      const secondRun = await seedCategories(db);
      expect(secondRun.seeded).toBe(0);

      const nodes = await fetchAllCategoryNodes(db);
      expect(nodes.length).toBe(buildSeedNodes().length);
    });

    it('never overwrites an admin edit made after the initial seed', async () => {
      const db = createFakeDb();
      await seedCategories(db);

      // Simulate an admin deactivating "jackets" after the initial seed.
      await updateCategory('jackets', { active: false }, db);

      // Re-running the seed (e.g. via the manual /seed endpoint) must not
      // silently reactivate it.
      await seedCategories(db);

      const nodes = await fetchAllCategoryNodes(db);
      const jackets = nodes.find(n => n.id === 'jackets');
      expect(jackets?.active).toBe(false);
    });
  });

  describe('createCategory()', () => {
    it('creates a top-level Collection (parentId: null) at level 0', async () => {
      const db = createFakeDb();
      const result = await createCategory({ label: 'Footwear', parentId: null }, db);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.node.id).toBe('footwear');
        expect(result.node.level).toBe(0);
        expect(result.node.parentId).toBeNull();
        expect(result.node.active).toBe(true);
      }
    });

    it('creates a Product Type one level below its parent Collection', async () => {
      const db = createFakeDb();
      await seedCategories(db);
      const result = await createCategory({ label: 'Sandals', parentId: 'accessories' }, db);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.node.id).toBe('sandals');
        expect(result.node.level).toBe(1);
        expect(result.node.parentId).toBe('accessories');
      }
    });

    it('rejects a parentId that does not exist', async () => {
      const db = createFakeDb();
      const result = await createCategory({ label: 'Ghost Child', parentId: 'does-not-exist' }, db);
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.status).toBe(400);
    });

    it('rejects nesting past 3 levels (level > 2)', async () => {
      const db = createFakeDb();
      await seedCategories(db);
      // "tops" (level 2) already exists under "tops-shirts" — a child of it
      // would be level 3, which is one level too deep.
      const result = await createCategory({ label: 'Crop Tops', parentId: 'tops' }, db);
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.status).toBe(400);
    });

    it('rejects a duplicate id (slugified label collision)', async () => {
      const db = createFakeDb();
      await seedCategories(db);
      const result = await createCategory({ label: 'Dresses', parentId: 'apparel' }, db);
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.error).toContain('already exists');
    });

    it('rejects an empty label', async () => {
      const db = createFakeDb();
      const result = await createCategory({ label: '   ', parentId: null }, db);
      expect(result.ok).toBe(false);
    });
  });

  describe('updateCategory()', () => {
    it('deactivates a category without deleting it', async () => {
      const db = createFakeDb();
      await seedCategories(db);
      const result = await updateCategory('bags-pouches', { active: false }, db);
      expect(result.ok).toBe(true);

      const nodes = await fetchAllCategoryNodes(db);
      const node = nodes.find(n => n.id === 'bags-pouches');
      expect(node).toBeDefined();
      expect(node?.active).toBe(false);
    });

    it('renames a category label without changing its id', async () => {
      const db = createFakeDb();
      await seedCategories(db);
      const result = await updateCategory('jackets', { label: 'Outerwear & Jackets' }, db);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.node.id).toBe('jackets');
        expect(result.node.label).toBe('Outerwear & Jackets');
      }
    });

    it('returns a 404-shaped error for an unknown id', async () => {
      const db = createFakeDb();
      const result = await updateCategory('does-not-exist', { active: false }, db);
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.status).toBe(404);
    });
  });

  describe('slugifyLabel()', () => {
    it('produces a lowercase, hyphenated, URL-safe id', () => {
      expect(slugifyLabel('Top & Shirts')).toBe('top-shirts');
      expect(slugifyLabel('  Bags & Pouches  ')).toBe('bags-pouches');
    });
  });
});

describe('Category Master — client integration (src/config/catalogTaxonomy.ts applyCategoryMasterData)', () => {
  // Snapshot the original hardcoded defaults so every test in this file
  // (and every OTHER test file that imports catalogTaxonomy.ts, since
  // vitest may share the module registry within a run) sees them restored
  // afterward — applyCategoryMasterData() mutates shared module state by
  // design (see categoryStore.ts).
  const originalCollections = CANONICAL_COLLECTIONS;
  const originalProductTypes = CANONICAL_PRODUCT_TYPES;
  const originalSubTypes = CANONICAL_PRODUCT_SUB_TYPES;
  const originalCollectionMatrix = COLLECTION_PRODUCT_TYPE_MATRIX;
  const originalSubtypeMatrix = PRODUCT_TYPE_SUBTYPES_MATRIX;

  beforeEach(() => {
    applyCategoryMasterData([
      ...originalCollections.map((c, i) => ({ id: c.id, label: c.label, parentId: null, level: 0, sortOrder: i, active: true })),
      ...Object.entries(originalCollectionMatrix).flatMap(([collectionId, typeIds]) =>
        typeIds.map((typeId, i) => {
          const pt = originalProductTypes.find(p => p.id === typeId)!;
          return { id: pt.id, label: pt.label, parentId: collectionId, level: 1, sortOrder: i, active: true };
        })
      ),
      ...Object.entries(originalSubtypeMatrix).flatMap(([typeId, subIds]) =>
        (subIds || []).map((subId, i) => {
          const st = originalSubTypes.find(s => s.id === subId)!;
          return { id: st.id, label: st.label, parentId: typeId, level: 2, sortOrder: i, active: true };
        })
      )
    ]);
  });

  it('rebuilds CANONICAL_* arrays and both matrices from a flat admin-edited node list', () => {
    applyCategoryMasterData([
      { id: 'apparel', label: 'Apparel', parentId: null, level: 0, sortOrder: 0, active: true },
      { id: 'footwear', label: 'Footwear', parentId: null, level: 0, sortOrder: 1, active: true },
      { id: 'dresses', label: 'Dresses', parentId: 'apparel', level: 1, sortOrder: 0, active: true },
      { id: 'sandals', label: 'Sandals', parentId: 'footwear', level: 1, sortOrder: 0, active: true }
    ]);

    expect(CANONICAL_COLLECTIONS.map(c => c.id)).toEqual(['apparel', 'footwear']);
    expect(CANONICAL_PRODUCT_TYPES.map(p => p.id)).toEqual(['dresses', 'sandals']);
    expect(COLLECTION_PRODUCT_TYPE_MATRIX['footwear']).toEqual(['sandals']);
  });

  it('excludes inactive nodes from the rebuilt taxonomy', () => {
    applyCategoryMasterData([
      { id: 'apparel', label: 'Apparel', parentId: null, level: 0, sortOrder: 0, active: true },
      { id: 'dresses', label: 'Dresses', parentId: 'apparel', level: 1, sortOrder: 0, active: true },
      { id: 'jackets', label: 'Jackets', parentId: 'apparel', level: 1, sortOrder: 1, active: false }
    ]);

    expect(CANONICAL_PRODUCT_TYPES.map(p => p.id)).toEqual(['dresses']);
    expect(CANONICAL_PRODUCT_TYPES.map(p => p.id)).not.toContain('jackets');
  });

  it('is a no-op (keeps the current taxonomy) when given an empty or malformed node list', () => {
    const before = CANONICAL_PRODUCT_TYPES.map(p => p.id);
    applyCategoryMasterData([]);
    expect(CANONICAL_PRODUCT_TYPES.map(p => p.id)).toEqual(before);

    applyCategoryMasterData([{ id: 'orphan-subtype', label: 'Orphan', parentId: 'nothing', level: 2, sortOrder: 0, active: true }]);
    expect(CANONICAL_PRODUCT_TYPES.map(p => p.id)).toEqual(before);
  });

  it('restores the original hardcoded taxonomy after this suite (sanity check for the beforeEach reset)', () => {
    expect(CANONICAL_COLLECTIONS.map(c => c.id).sort()).toEqual(['accessories', 'apparel']);
  });
});
