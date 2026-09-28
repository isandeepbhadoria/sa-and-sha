/**
 * Analytics / ad-pixel loaders — Google Analytics 4 and Meta (Facebook) Pixel.
 *
 * These are only ever invoked once the visitor has given cookie consent
 * (see src/context/CookieConsentContext.tsx). Both loaders are:
 *   - Fail closed: if the relevant VITE_* env var isn't configured, this is
 *     a silent no-op (matches the fail-closed pattern used elsewhere in this
 *     codebase, e.g. src/server/notification/whatsappService.ts's getConfig()).
 *   - Idempotent: calling them more than once (e.g. consent state changing
 *     twice in a session) never injects the scripts twice.
 */

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
    fbq?: any;
    _fbq?: any;
  }
}

let gaLoaded = false;
let pixelLoaded = false;

/**
 * Loads the Google Analytics 4 (gtag.js) snippet and initializes it for the
 * given measurement ID. No-op if measurementId is empty or GA is already loaded.
 */
export function loadGoogleAnalytics(measurementId: string | undefined | null): void {
  if (!measurementId) return;
  if (gaLoaded || typeof window.gtag === 'function') {
    gaLoaded = true;
    return;
  }
  if (typeof document === 'undefined') return;

  gaLoaded = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: any[]) {
    window.dataLayer!.push(args);
  };

  // This function is only ever called once the visitor has already granted
  // analytics consent via our own banner, so declare that known state
  // directly as the default. ad_storage/ad_user_data/ad_personalization
  // stay denied — those gate Google Ads features we don't use, not basic
  // GA4 collection (confirmed: granting all four made no difference to
  // whether hits were sent).
  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });

  window.gtag('js', new Date());
  window.gtag('config', measurementId);

  // Sending the first explicit pageview right on script.onload still isn't
  // enough of a gap: onload only confirms gtag.js finished downloading and
  // running its own top-level code, not that its internal client-ID/cookie
  // bootstrap (which does its own follow-up async work — confirmed via
  // DevTools: no _ga cookie exists yet at that point) has actually
  // finished. Directly verified in the browser Console that ANY gtag()
  // call made after that bootstrap has had time to settle succeeds
  // (produces a real collect hit) — including a manual call typed in
  // fresh, with no special context of its own. So: give it a short buffer
  // after onload before sending the first pageview, rather than firing
  // the instant the script file itself is ready.
  script.onload = () => {
    setTimeout(() => {
      window.gtag!('event', 'page_view', {
        page_path: window.location.pathname + window.location.search
      });
    }, 1500);
  };
  document.head.appendChild(script);
}

/**
 * Loads Meta's standard Pixel base code and initializes it for the given
 * pixel ID. No-op if pixelId is empty or the Pixel is already loaded.
 */
export function loadMetaPixel(pixelId: string | undefined | null): void {
  if (!pixelId) return;
  if (pixelLoaded || typeof window.fbq === 'function') {
    pixelLoaded = true;
    return;
  }
  if (typeof document === 'undefined') return;

  pixelLoaded = true;

  // Meta's standard Pixel base code (fbevents.js loader).
  (function (f: any, b: Document, e: string, v: string, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function (...args: any[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e) as HTMLScriptElement;
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode!.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
}

/**
 * Fires a client-side pageview on GA4 and/or the Meta Pixel, for SPA route
 * changes after the initial load (the base snippets above only send one
 * pageview on injection).
 */
export function trackPageView(path: string): void {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', { page_path: path });
  }
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'PageView');
  }
}
