# Deploying Sa and Sha to sa-and-sha.com (Hostinger)

This walks through getting the app live on your reserved domain using
your existing Hostinger hosting and Firebase account, with:
- **Payments**: deferred (Razorpay integration comes later — checkout
  will not accept live payments yet)
- **Email**: SMTP via a mailbox on your own domain (not Resend)
- **OTP/WhatsApp**: a new MSG91 account you're creating for Sa and Sha

None of the account-creation or control-panel steps below can be done
for you — they need your Firebase, Hostinger, and MSG91 logins. This
doc is the checklist; come back with questions or errors at any step.

## 1. Firebase project

You don't need a new Google account — just a new **project** inside
your existing one (separate from Kora Linen's project; separate
Firestore database, separate Auth users, separate everything).

1. Go to the [Firebase Console](https://console.firebase.google.com/),
   click **Add project**, name it something like `sa-and-sha`.
2. Enable **Firestore Database** (production mode, pick a region close
   to your customers, e.g. `asia-south1` for India).
3. Enable **Authentication** → Sign-in method → turn on **Google**.
4. Enable **Storage** (for product images uploaded via the Admin panel).
5. Under Project Settings → General, add a **Web app** — this gives you
   `apiKey`, `authDomain`, `projectId`, `storageBucket`,
   `messagingSenderId`, `appId`. Put these into `.env` as the
   `VITE_FIREBASE_*` variables (copy `.env.example` to `.env` first).
6. Under Project Settings → Service Accounts, click **Generate new
   private key** — this downloads a JSON file. You need three values
   from it for `.env`: `FIREBASE_ADMIN_PROJECT_ID` (=`project_id`),
   `FIREBASE_ADMIN_CLIENT_EMAIL` (=`client_email`), and
   `FIREBASE_ADMIN_PRIVATE_KEY` (=`private_key`, keep the `\n` escapes
   as-is, wrap the whole value in quotes in `.env`).
7. Install the Firebase CLI locally (`npm install -g firebase-tools`),
   run `firebase login`, then from the project root:
   ```
   firebase use --add    # select your new sa-and-sha project
   firebase deploy --only firestore:rules,firestore:indexes
   ```
   This is what actually enforces `firestore.rules` (the category
   enum, admin checks, etc.) — skipping it leaves Firestore on default
   rules.
8. Cloud Functions (`functions/`) are Razorpay-webhook-only — skip
   deploying these until Razorpay is wired up.

## 2. MSG91 (OTP)

1. Sign up at [msg91.com](https://msg91.com/) for Sa and Sha (separate
   account from Kora Linen's).
2. Create an OTP Widget (Dashboard → OTP → Widgets) — this gives you a
   **Widget ID** and **Token Auth** key for `.env`:
   `VITE_MSG91_WIDGET_ID`, `VITE_MSG91_TOKEN_AUTH`.
3. Grab your account's **Auth Key** (Dashboard → API → Auth Key) for
   `MSG91_AUTH_KEY`.
4. WhatsApp (`MSG91_WHATSAPP_NUMBER`, `MSG91_WHATSAPP_NAMESPACE`) needs
   a separate WhatsApp Business API approval through MSG91 — optional
   for launch; the app degrades gracefully (mock mode) without it.

## 3. Email (SMTP via your own domain)

You said you'll use a mailbox on your own domain instead of Resend.
The code now uses standard SMTP (`src/server/mailer.ts`, via
`nodemailer`) instead of the Resend API — no third-party email service
required.

1. Create a mailbox (e.g. `orders@sa-and-sha.com`) — if you're using
   Hostinger's own email hosting, this is under hPanel → **Emails** →
   Email Accounts → Create. If you're using Google Workspace/Zoho
   instead, create the mailbox there.
2. Get the SMTP host/port for that mailbox. For **Hostinger Email**,
   this is typically:
   - Host: `smtp.hostinger.com`
   - Port: `465` (SSL) or `587` (STARTTLS)
   - Username: the full mailbox address
   - Password: the mailbox password
   (Confirm exact values in hPanel → Emails → Connect Apps & Devices,
   since Hostinger occasionally changes these.)
3. Fill into `.env`:
   ```
   SMTP_HOST=smtp.hostinger.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=orders@sa-and-sha.com
   SMTP_PASSWORD=<mailbox password>
   SMTP_FROM_EMAIL=orders@sa-and-sha.com
   SMTP_FROM_NAME=Sa and Sha
   ```
4. Test it after deploying: Admin Panel → Communication → Email
   Templates → send yourself a test email.

## 4. Hostinger — Node.js App setup

Your plan (Shared/Business/Cloud) supports Node apps via hPanel's
**Setup Node.js App** (Passenger-based), not a raw SSH daemon like a
VPS. Steps:

1. **Get the code onto the server.** Easiest is Git:
   - hPanel → **Advanced** → **Git** → create a repository pointing at
     `https://github.com/isandeepbhadoria/sa-and-sha` (branch `main`),
     deploy path e.g. `/home/<user>/sa-and-sha`.
   - If Git isn't available on your plan, download a ZIP of the repo
     from GitHub and upload/extract it via File Manager instead —
     you'll need to re-upload a new ZIP for every future update instead
     of just pulling.
2. **hPanel → Advanced → Setup Node.js App → Create Application**:
   - Node.js version: 20 (matches `functions/package.json`'s
     `engines.node`; use the closest available if 20 isn't listed)
   - Application mode: Production
   - Application root: the folder you deployed the code into
   - Application URL: `sa-and-sha.com` (or `www.sa-and-sha.com` —
     match whichever your domain's default document root expects)
   - Application startup file: `dist/server.cjs`
3. **Environment variables**: in the same Node.js App screen, add every
   variable from your `.env` (Hostinger's interface sets these as the
   process environment — you don't need a physical `.env` file on the
   server if you fill them in here; either way works, just don't do
   both with conflicting values). Also add `NODE_ENV=production`.
4. **Install dependencies**: use the **Run NPM Install** button in the
   same screen. This reads `package.json` and installs everything
   (`--packages=external` means the server bundle needs these present
   at runtime, not bundled in).
5. **Build the app**: the tricky part on shared hosting — `npm run
   build` needs to run once (it compiles the SEO files, bundles
   `server.ts` into `dist/server.cjs`, and builds the React frontend
   into `dist/`).
   - **If your plan includes SSH/terminal access** (Hostinger Business
     and Cloud plans generally do): SSH in, `cd` into the app folder,
     activate the Node virtualenv Hostinger created (there's usually an
     `source /home/<user>/nodevenv/<app-path>/20/bin/activate` command
     shown in the Node.js App screen), then run `npm run build`.
   - **If you only have the Node.js Selector UI with no shell**: some
     Hostinger plans expose a "Run JS Script" option for one-off
     scripts, or you may need to build locally (`npm run build` on
     your own machine) and upload the resulting `dist/` folder via File
     Manager/FTP instead of relying on the server to build it. If
     you hit this, tell me — I can also produce a pre-built `dist/`
     for you to upload directly.
6. **Restart the app** (button in the Node.js App screen) after any
   code, env var, or dependency change — Passenger doesn't auto-reload.
7. **Point the domain**: if `sa-and-sha.com` and this hosting are on
   the same Hostinger account, the Node.js App's "Application URL"
   field handles the domain binding directly. If the domain is
   registered elsewhere, make sure its nameservers/DNS point at this
   Hostinger hosting account first (hPanel → Domains).

## 5. Blue Dart (shipping)

Blue Dart powers pincode serviceability at checkout, forward AWB
generation + dispatch, live tracking, and (as of this integration)
automated reverse-pickup booking for customer returns — all through
Blue Dart's APIGEE developer portal (`developer.dhl.com`), not the
older bluedart.com SOAP API.

1. Get your Blue Dart account's LoginID, LicenceKey, Customer Code and
   registered pickup **OriginArea** (branch code) from your Blue Dart
   CCF/account manager, and register an app on
   [developer.dhl.com](https://developer.dhl.com) to get an API
   Key/Secret for the sandbox and (separately) live environments.
2. Fill the `BLUEDART_*` variables in `.env` — `.env.example` lists
   every one, with `BLUEDART_ORIGIN_*` describing your own
   warehouse/pickup address (used as the Shipper on forward shipments
   and as the Consignee on reverse pickups).
3. Leave `BLUEDART_ENV=sandbox` until you've confirmed real calls work,
   then switch to `BLUEDART_ENV=live` with your live credentials.

**Important — two config values are unverified, and now cover reverse
pickup too.** `src/server/bluedartClient.ts`'s own top-of-file comment
is explicit about this, and it's worth restating here since it's easy
to miss:
- `BLUEDART_API_TYPE`/`BLUEDART_API_VERSION` (sent as `Profile.Api_type`
  /`Version` on every call) are our best inference from Blue Dart's
  legacy Profile schema, not confirmed from this account's own docs.
- The lowercase `profile` wrapper key is confirmed correct for the
  Finder API (pincode check) from Blue Dart's own sample request, but
  was **not** independently confirmed for the Waybill API
  (`GenerateWayBill`) — which forward AWB generation, and now reverse
  pickup booking, both call.
- Reverse-pickup booking (`bluedartRegisterReversePickup` in
  `bluedartClient.ts`) reuses these same unverified assumptions, on top
  of one more inference of its own: Blue Dart's Waybill API has no
  separate pickup-only endpoint in the docs this integration was built
  from, so a reverse pickup is booked by calling the same
  `GenerateWayBill` endpoint with Shipper and Consignee **swapped** —
  the customer's return address as Shipper, your warehouse as
  Consignee. This is a standard, reasonable pattern for reverse
  logistics on an API shaped like this one, but it is not confirmed
  from Blue Dart's own docs for this account.

  **When you run the first real sandbox reverse pickup, watch it
  closely.** If it comes back with a profile/auth-shaped error (rather
  than a clean AWB), that's these assumptions, not a bug in the
  swap logic itself — the fix is checking Blue Dart's own
  developer-portal sample for the exact `GenerateWayBill` request shape,
  ideally one specific to reverse pickups if the portal has one. The
  error message you'll see is Blue Dart's own raw text (not swallowed
  or replaced), which is what to paste back for help debugging.

## 6. Razorpay (deferred)

Checkout currently only supports Cash on Delivery until Razorpay keys
(`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
`VITE_RAZORPAY_KEY_ID`) are added — the app already handles this
gracefully (COD-only checkout), so this isn't blocking going live for a
UI/UX and COD-order test. Come back to this once you have a Razorpay
account for Sa and Sha.

## 7. First smoke test after deploy

1. Visit `https://sa-and-sha.com/` — homepage should load with the 7
   category tiles and the real + placeholder products.
2. Try Google Sign-In on a customer account page — confirms Firebase
   Auth is wired correctly.
3. Add the Block Print Maxi Dress to cart, checkout with **Cash on
   Delivery** — confirms Firestore writes, order creation, and (once
   SMTP is filled in) the confirmation email.
4. Check `/admin` — log in and confirm the product list, tax master,
   and communication settings load.

If anything 500s, the Node.js App screen in hPanel has an error log
viewer — that's the first place to check, and the most useful thing to
paste back here for help debugging.
