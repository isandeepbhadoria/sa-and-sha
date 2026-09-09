# Sa and Sha

Ladies apparel ecommerce site. The backend is ported from the Kora Linen
codebase (same owner's menswear brand) and re-branded for Sa and Sha — the
architecture, admin tooling, and business logic are unchanged; only brand
identity, catalog categories, and secrets/config are new.

## Stack

- **Frontend:** React 19 + Vite + Tailwind CSS, React Router
- **Backend:** Express (`server.ts`) running alongside Vite, Firebase Admin SDK
- **Data:** Firestore (rules in `firestore.rules`, indexes in `firestore.indexes.json`)
- **Payments:** Razorpay
- **Email:** SMTP (`src/server/mailer.ts`, via `nodemailer`) — send from
  any mailbox on your own domain, no third-party email API required
- **SMS/WhatsApp OTP:** MSG91
- **PDF generation:** PDFKit (invoices, credit notes)
- **Cloud Functions:** `functions/` (Firebase Functions)

## Feature set inherited from Kora Linen

- Product catalog with an admin CRUD UI and a merchandising taxonomy
  engine (`src/config/catalogTaxonomy.ts`) — collections, product types,
  sub-types, and validation matrix
- Customer accounts with mobile OTP / Google login, sessions, and a
  security-event audit trail
- Cart, checkout, and order management (customer + admin views)
- Returns / RMA workflow (`src/components/admin-returns`,
  `src/server/*Returns*`)
- GST-compliant invoicing and credit notes (`src/server/invoice/`)
- Tax master administration (HSN/GST rate configuration, independent from
  merchandising categories)
- Loyalty/rewards points
- Admin-customer communication tooling and email template management
- Notification engine with retry/dead-letter handling
  (`src/server/notification/`)
- Extensive Firestore security rules (`firestore.rules`) and a
  `security_spec.md` threat-model doc

## What changed from Kora Linen

- All brand strings, domains, and emails rebranded (`Kora Linen` →
  `Sa and Sha`, `koralinen.com` → `saandsha.com`, admin/role email domains
  updated to match)
- Kora Linen's trademarked logo/favicon image files were **removed**
  (they're that brand's IP) and replaced with a plain text placeholder
  (`src/components/SaAndShaLogo.tsx`, `public/favicon.svg`) — swap these
  for real Sa and Sha artwork once you have it
- `src/config/catalogTaxonomy.ts` and the Firestore product `category`
  enum were changed from menswear-linen categories (shirts, trousers,
  chinos, kurtas) to Sa and Sha's real product categories: Dresses,
  Top & Shirts, Shorts & Skirts, Co-Ord Sets, Trousers, Jackets, and
  Bags & Pouches, grouped under two collections (Apparel, Accessories).
  "Top & Shirts" and "Shorts & Skirts" have sub-types (tops/shirts,
  shorts/skirts) for filtering.
- `firebase-applet-config.json` had Kora Linen's live Firebase project
  credentials stripped and replaced with placeholders — you need your own
  Firebase project for Sa and Sha (see below)
- `.env.example` had Kora Linen's real MSG91 WhatsApp number/namespace and
  Firebase project ID removed
- Removed Kora Linen's hardcoded Firebase Web API key / project ID that
  were baked in as fallback defaults in `src/lib/firebase.ts`,
  `scripts/generate-seo-files.ts`, and `src/server/firebaseAdmin.ts` — the
  app now requires your own Firebase env vars (see `.env.example`) and has
  no fallback to any real project
- Social links (`BRAND_INSTAGRAM_URL` in `src/types/homepageMedia.ts`, and
  the Instagram/Facebook/X/Pinterest URLs in `src/components/Footer.tsx`)
  are placeholder handles guessed by the rebrand pass — verify or replace
  them with Sa and Sha's actual accounts before launch
- Removed the fabricated legal-entity line from the footer copyright
  (Kora Linen's actual registered company name/location) — replace
  `&copy; {year} Sa and Sha. All rights reserved.` with your real
  registered business name once you have one

## Frontend redesign

Header, Footer, and HomePage were redesigned with a layout loosely inspired
by a reference site the brand owner shared (warm-neutral luxury boutique
feel: hero → shop-by-category grid → product shelves → editorial banner →
testimonials → Instagram feed). Specifically:

- New color palette (`src/index.css` + inline Tailwind arbitrary values
  throughout `src/`): warm gold/blush tones in place of Kora Linen's
  terracotta/olive linen palette. Fonts (Cormorant Garamond serif + Inter
  sans) were kept — they already fit the new mood.
- `src/components/SaAndShaLogo.tsx` restyled as a small-caps serif
  wordmark.
- `src/components/Header.tsx` / `src/components/Footer.tsx` / `src/pages/HomePage.tsx`
  rewritten around the real category list (Dresses, Top & Shirts, Shorts &
  Skirts, Co-Ord Sets, Trousers, Jackets, Bags & Pouches) instead of Kora
  Linen's menswear-linen taxonomy; the old "Why Linen" fiber-science
  section was removed.
- Category tile images are generic Unsplash stock placeholders — swap for
  real Sa and Sha product photography.
- Also fixed several places where Kora Linen's actual brand copy would
  otherwise have reached customers unchanged: transactional email
  templates (`src/server/email.ts`, `src/server/emailTemplateHelpers.ts`,
  `src/server/notification/notificationProviders/emailProvider.ts`), and
  the GST invoice/credit-note PDF generator headers and filenames
  (`src/server/invoice/invoicePdfGenerator.ts`,
  `.../creditNotePdfGenerator.ts` — filenames no longer say "Kora-Linen").

## What the linen-copy sweep fixed

A follow-up pass swept the rest of the app for leftover Kora Linen
menswear branding beyond the Header/Footer/HomePage redesign — the
`FAQPage` ("Linen Care Guide" → "Fabric Care Guide", care copy
genericized), `AboutPage` (fully rewritten brand story), `CollectionPage`
(subcategory/fabric filters, comparison copy, "Coming Soon" states),
`AdminPage` (category/subcategory dropdowns actually matched the new
Firestore `category` enum — this was a real bug that would have broken
admin product creation), and the legal/support pages
(`PrivacyPolicyPage`, `TermsConditionsPage`, `ContactSupportPage`), which
had **fabricated real business data** — a physical RIICO Jaipur address,
phone numbers, GPS coordinates, and "Rajasthan Exports Overseas Pvt.
Ltd." as the legal entity — replaced with `[placeholder]` markers plus a
`ContactSupportPage` Google Maps embed of that real address, removed
entirely.

It also found and fixed several functional bugs, not just copy, because
the "KL"/"Kora Linen" prefix convention was baked into real business
logic, not just display text:
- The default GST invoice-numbering prefix (`invoiceNumberingConfig.ts`,
  `sellerTaxConfig.ts`, `server.ts`, admin UI placeholders) defaulted to
  `"KL"` — real Sa and Sha tax invoices would have been numbered
  `KL/26-27/0001` unless an admin manually overrode it. Now defaults to
  `"SS"`.
- Business Customer IDs, RMA numbers, and order ID generation
  (`customerProfileHelpers.ts`, `customerReturnsHelpers.ts`,
  `loyaltyHelpers.ts`, `financialReturnsHelpers.ts`, `trackingHelpers.ts`,
  `server.ts`, and others) all used a `KL-` prefix convention
  (`KL-C000001`, `KL-RMA-100001`, `KL-<id>-LX`) — renamed to `SS-`
  throughout, including the regexes/parsers that strip the prefix back
  off.
- The seeded promo codes in `server.ts` (`seedDefaultPromotionsIfEmpty`)
  were still `KORA10` / `LINENLOVE`, while every customer-facing surface
  (Header promo banner, `ShopContext.tsx`, checkout hints) had already
  been renamed to `SANDSHA10` / `WELCOME20` — real customers typing the
  advertised code would have had it rejected by the server. Both sides
  now agree. Stray `KORA10` display text on `ProductCard`, `CartDrawer`,
  and `ProductDetailPage` was fixed too.
- `scripts/generate-seo-files.ts` (the build-time sitemap generator) and
  a live `/sitemap.xml`-equivalent route table in `server.ts` both
  hardcoded the old menswear category slugs (`shirts`, `linen-pants`,
  `chinos`, `polos`, ...) — search engines would have been pointed at
  routes that no longer exist. Both now list the real product-type/
  collection routes.
- "Kora Rewards" (the loyalty program's display name) was still shown to
  customers and admins in `CustomerDashboardPage`, `CustomerRewardsPage`,
  `CustomerRewardsSection`, `RewardsPolicySettings`, `AdminPage`,
  `loyaltyPolicy.ts` (a transactional message string), Privacy/Terms
  copy, and a "Kora Size Chart" modal heading — all renamed to
  "Sa and Sha Rewards" / "Size Chart".
- Demo/fallback order data shown to real customers who track a demo
  order (`server.ts`'s seeded `KL102548` order for the track-order and
  returns flows) referenced Kora Linen menswear products and the old ID
  prefix — renamed to `SS102548` with ladies-apparel item names, and the
  example order ID shown as placeholder text on `ContactSupportPage` /
  `ReturnsExchangesPage` updated to match.

`npm test`, `npm run lint` (`tsc --noEmit`), and `npm run build` were all
re-verified green after this pass.

## Product catalog

`src/data.ts`'s 60 mock Kora Linen menswear products have been fully
removed. The catalog has one real Sa and Sha product so far (a Block
Print Maxi Dress under Dresses) plus, at the owner's explicit request,
one clearly-labeled `[Placeholder]` product per remaining category
(Top & Shirts has two — one Top, one Shirt — same for Shorts & Skirts)
so every category page and the homepage tiles have something to preview
before real inventory exists everywhere. Each placeholder:

- is named `[Placeholder] <Category>` so it can't be mistaken for a real
  listing in the storefront or admin product list
- uses a generic stock photo (reused from URLs already elsewhere in this
  app) and dummy price/fabric/description text
- has `rating: 0, reviewCount: 0, bestseller: false, newArrival: false`
  — it won't appear in Bestsellers/New Arrivals and shows the "New" /
  "Be the first to review" state, not a fabricated rating

Replace each placeholder's `name`, `price`, `fabric`, `sizes`,
`description`, `details`, `careInstructions`, and `images` with the real
product — the taxonomy fields (`category`, `collection`, `productType`,
etc.) are already correct as a template. The catalog is meant to keep
growing incrementally like this as real product data comes in.

To add a new real product, add an entry to the `products` array in
`src/data.ts` with the full taxonomy field set from
`src/config/catalogTaxonomy.ts`:
`category`/`subCategory` (legacy, kept for the Firestore rules and admin
form), `collection` (`apparel` | `accessories`), `productType` (one of
the 7 canonical types), `productSubType` (only for `tops-shirts` and
`shorts-skirts`), `materialType`, and `tax_class` (from
`SELECTABLE_TAX_CLASSES`). A few things that only apply once real
products exist:

- **Photos**: the one real product currently uses generic stock-photo
  placeholders (clearly reused Unsplash URLs already elsewhere in the
  app) — real photography still needs uploading per-product via the
  Admin panel's image upload flow.
- **Reviews**: `rating`/`reviewCount` should be `0` for a genuinely new
  product — don't invent numbers. `ProductCard` and `ProductDetailPage`
  now show a "New" / "Be the first to review" state instead of a
  fabricated star rating when `reviewCount` is `0`.
- **"Coming Soon" tiles**: the homepage category tiles and
  `getTaxonomyRouteInfo()` (`src/config/catalogTaxonomy.ts`) now compute
  "Coming Soon" dynamically from whether `products` has any live
  (non-draft, non-archived, non-decommissioned) item for that
  collection/product type/sub-type — no more manual flags to flip as
  inventory is added.
- **`categoryFAQs`** (`src/data.ts`) is keyed by product type; add a
  category's real FAQs there and `CollectionPage.tsx` will pick them up
  automatically.

The previous homepage "What They Say" testimonial carousel (`mockReviews`
in `src/data.ts`) has been removed rather than replaced — it was
fabricated reviews attributed to named "Verified Patron" customers, which
is the same kind of fake business/social-proof data this rebrand has
been removing elsewhere. Re-add the section once there are real customer
reviews to show.

`src/server/__tests__/phase10_5d3a12_shirt_subtype_reconciliation.test.ts`
was removed — like the already-removed `catalogMigration.ts`, it only
verified exact legacy Kora Linen shirt/polo product IDs and counts, which
don't apply to a fresh catalog.

## Not yet done

- Internal-only `localStorage` key names (`kora_cart`, `kora_customer_auth_token`,
  `kora_admin_logged_in`, etc.) and Firestore collection internals still
  use a `kora_` namespace. These are never shown to users and were left
  alone as out of scope for a copy sweep — rename only if you want full
  internal consistency, and do it as one careful pass since the same key
  string is read and written across many files.

## Test suite status

`npm test` passes 535/537 inherited tests. The 2 remaining failures
(`customerPortalAuth.test.ts`, `phase10_5a_returns_consolidation.test.ts`)
fail identically on the original Kora Linen repo in this environment —
they need live `MSG91_WIDGET_ID` / `RAZORPAY_KEY_ID` credentials to pass
and aren't a rebrand regression.

## Setup

1. Create a new Firebase project for Sa and Sha (Firestore + Auth +
   Storage + Functions), and fill in `firebase-applet-config.json` and the
   `FIREBASE_ADMIN_*` variables in `.env` (copy from `.env.example`).
2. Create an MSG91 account (for OTP/WhatsApp), set up SMTP on a mailbox
   on your own domain (for email — see `.env.example`'s `SMTP_*`
   variables), and fill those into `.env`. Razorpay can be added later —
   checkout works as Cash-on-Delivery-only until then.
3. `npm install`
4. `npm run dev` — runs the Express server + Vite dev server together.
5. Deploy Firestore rules/indexes and Cloud Functions with the Firebase
   CLI once the project is set up.

For deploying to a live domain on Hostinger (or adapting to another
host), see **[DEPLOYMENT.md](DEPLOYMENT.md)**.

## Scripts

- `npm run dev` — local development
- `npm run build` — production build (client + server bundle)
- `npm start` — run the built server
- `npm test` — run the vitest suite
- `npm run lint` — TypeScript type-check
