// Live per-size stock is kept in Product.stock (Record<size, quantity>) by
// the ERP's inventory webhook — see server.ts's /api/webhooks/erp-inventory,
// which sets `stock.${size}` via a dotted field update whenever that size's
// real ERP quantity changes.
//
// A size that's never received a webhook (not yet ERP-synced, or the SKU
// isn't registered) is left `undefined`, not 0 — checkout already treats an
// untracked size as sold on trust (see erpSync.ts's reserveErpStockOrThrow:
// "untracked — not registered with the ERP yet, don't block on it"), so the
// storefront follows the same rule here: only a *confirmed* zero counts as
// out of stock, never an unknown.

export interface StockAwareProduct {
  stock?: Record<string, number>;
}

export function isSizeOutOfStock(product: StockAwareProduct, size: string): boolean {
  const qty = product.stock?.[size];
  return qty !== undefined && qty <= 0;
}

// True only when every size the product is listed in comes back as a
// confirmed zero — a product with any untracked (unknown-stock) size is
// never considered sold out, same "trust it" rule as above.
export function isProductSoldOut(product: StockAwareProduct & { sizes: string[] }): boolean {
  return product.sizes.length > 0 && product.sizes.every(size => isSizeOutOfStock(product, size));
}
