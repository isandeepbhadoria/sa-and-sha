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
- **Email:** Resend
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

## Not yet done

- Deeper page content still has scattered Kora Linen linen/menswear/Jaipur
  copy that wasn't in scope for this pass (customer emails and invoices
  were fixed since those reach real customers): `src/App.tsx` has a whole
  "Linen Care Guide & FAQs" page that needs rewriting or removing for a
  non-linen brand, and `src/pages/{CollectionPage,ProductDetailPage,
  ContactSupportPage,PrivacyPolicyPage,TermsConditionsPage,WishlistPage,
  TrackOrderPage,CustomerOrdersPage,CustomerDashboardPage,AdminPage}.tsx`,
  `src/components/admin/HomepageMediaAdmin.tsx`, and
  `src/types/homepageMedia.ts` all still contain some linen/Jaipur
  references.
- Product seed/sample data (`src/data.ts`) still reflects Kora Linen
  products (including its `COLOR_SWATCHES`, which describe linen fabric
  colors) and needs replacing with real Sa and Sha inventory.
- Removed `src/server/catalogMigration.ts` and its test — it was a
  one-time script that migrated Kora Linen's specific 50 legacy products
  to the new taxonomy fields, which doesn't apply to a fresh catalog.

## Test suite status

`npm test` passes 541/543 inherited tests. The 2 remaining failures
(`customerPortalAuth.test.ts`, `phase10_5a_returns_consolidation.test.ts`)
fail identically on the original Kora Linen repo in this environment —
they need live `MSG91_WIDGET_ID` / `RAZORPAY_KEY_ID` credentials to pass
and aren't a rebrand regression.

## Setup

1. Create a new Firebase project for Sa and Sha (Firestore + Auth +
   Storage + Functions), and fill in `firebase-applet-config.json` and the
   `FIREBASE_ADMIN_*` variables in `.env` (copy from `.env.example`).
2. Create a Razorpay account/keys, a Resend API key, and an MSG91 account
   (for OTP/WhatsApp) for Sa and Sha, and fill those into `.env`.
3. `npm install`
4. `npm run dev` — runs the Express server + Vite dev server together.
5. Deploy Firestore rules/indexes and Cloud Functions with the Firebase
   CLI once the project is set up.

## Scripts

- `npm run dev` — local development
- `npm run build` — production build (client + server bundle)
- `npm start` — run the built server
- `npm test` — run the vitest suite
- `npm run lint` — TypeScript type-check
