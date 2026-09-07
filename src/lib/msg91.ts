export interface Msg91PublicConfig {
  widgetId: string;
  tokenAuth: string;
}

export interface RateLimitCheckResponse {
  allowed: boolean;
  error?: string;
  retryAfterSeconds?: number;
  cooldownSeconds?: number;
}

export interface CheckOtpRateLimitOptions {
  channel?: 'mobile' | 'email';
  identifier?: string;
  phone?: string;
  email?: string;
}

/**
 * Checks server-side OTP send rate limits before sending OTP via MSG91 widget.
 */
export async function checkAndRecordOtpSendRateLimit(
  input: string | CheckOtpRateLimitOptions
): Promise<RateLimitCheckResponse> {
  try {
    let payload: Record<string, any> = {};

    if (typeof input === 'string') {
      const isEmail = input.includes('@');
      if (isEmail) {
        payload = { channel: 'email', email: input.trim().toLowerCase() };
      } else {
        payload = { channel: 'mobile', phone: input };
      }
    } else {
      const isEmail =
        input.channel === 'email' ||
        Boolean(input.email) ||
        (Boolean(input.identifier) && input.identifier!.includes('@'));

      if (isEmail) {
        payload = {
          channel: 'email',
          email: (input.email || input.identifier || '').trim().toLowerCase()
        };
      } else {
        payload = {
          channel: 'mobile',
          phone: input.phone || input.identifier || ''
        };
      }
    }

    const res = await fetch('/api/otp/rate-limit-send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    return {
      allowed: Boolean(data.allowed),
      error: data.error,
      retryAfterSeconds: typeof data.retryAfterSeconds === 'number' ? data.retryAfterSeconds : undefined,
      cooldownSeconds: typeof data.cooldownSeconds === 'number' ? data.cooldownSeconds : 45
    };
  } catch (err: any) {
    console.warn('[OTP RATE LIMIT] Failed to contact rate limit endpoint:', err);
    // Fail-open on network error so customer is not permanently blocked
    return { allowed: true, cooldownSeconds: 45 };
  }
}

/**
 * Retrieves public MSG91 widget configuration.
 * Checks import.meta.env first, and falls back to /api/config/msg91 if empty.
 */
export async function getMsg91PublicConfig(): Promise<Msg91PublicConfig> {
  const envWidgetId = (import.meta as any).env?.VITE_MSG91_WIDGET_ID || '';
  const envTokenAuth = (import.meta as any).env?.VITE_MSG91_TOKEN_AUTH || '';

  if (envWidgetId) {
    return { widgetId: envWidgetId, tokenAuth: envTokenAuth };
  }

  try {
    const res = await fetch('/api/config/msg91');
    if (res.ok) {
      const data = await res.json();
      return {
        widgetId: data.widgetId || '',
        tokenAuth: data.tokenAuth || ''
      };
    }
  } catch (err) {
    console.warn('Failed to fetch MSG91 public config from backend:', err);
  }

  return { widgetId: '', tokenAuth: '' };
}

export interface Msg91InitOptions {
  identifier?: string;
  hideMethod?: 'mobile' | 'email' | string;
}

let msg91InitPromise: Promise<any> | null = null;
let currentActiveMode: string | null = null;

/**
 * Ensures MSG91 script and widget are initialized with exposeMethods: true.
 * Accepts mode options (hideMethod, identifier) to correctly configure MSG91 widget
 * for Mobile vs Email authentication modes.
 */
export async function ensureMsg91Initialized(options?: Msg91InitOptions): Promise<any> {
  if (typeof window === 'undefined') return null;

  const win = window as any;
  const targetMode = options?.hideMethod || 'default';

  console.log(`[DIAGNOSTIC] ensureMsg91Initialized called | targetMode: ${targetMode} | sendOtp present: ${typeof win.sendOtp === 'function'} | currentActiveMode: ${currentActiveMode}`);

  // If already initialized with the exact same mode and sendOtp is ready, return immediately
  if (typeof win.sendOtp === 'function' && currentActiveMode === targetMode) {
    console.log('[DIAGNOSTIC] ensureMsg91Initialized cached return | sendOtp present: yes');
    return win;
  }

  // If switching mode, delete stale window methods to ensure we wait for the new widget instance to expose them
  if (currentActiveMode !== targetMode) {
    console.log(`[DIAGNOSTIC] Deleting stale window methods due to mode switch from ${currentActiveMode} to ${targetMode}`);
    delete win.sendOtp;
    delete win.retryOtp;
    delete win.verifyOtp;
  }

  const config = await getMsg91PublicConfig();
  if (!config.widgetId) {
    throw new Error('MSG91 OTP Widget ID is not configured in environment settings.');
  }

  await loadMsg91Script();

  if (typeof win.initSendOTP !== 'function') {
    throw new Error('initSendOTP function is missing on window object after script load.');
  }

  console.log(`[DIAGNOSTIC] initSendOTP called | hideMethod: ${options?.hideMethod || 'none'} | identifier present: ${options?.identifier ? 'yes' : 'no'}`);

  win.initSendOTP({
    widgetId: config.widgetId,
    tokenAuth: config.tokenAuth,
    exposeMethods: true,
    ...(options?.hideMethod ? { hideMethod: options.hideMethod } : {}),
    success: (data: any) => {
      console.log('[DIAGNOSTIC] initSendOTP success callback fired: yes | data present:', Boolean(data));
    },
    failure: (err: any) => {
      console.error('[DIAGNOSTIC] initSendOTP failure callback fired: yes | err present:', Boolean(err));
    }
  });

  currentActiveMode = targetMode;

  let attempts = 0;
  while (typeof win.sendOtp !== 'function' && attempts < 60) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    attempts++;
  }

  // Ensure small settle window for widget state initialization
  await new Promise((resolve) => setTimeout(resolve, 150));

  if (typeof win.sendOtp === 'function') {
    console.log('[DIAGNOSTIC] ensureMsg91Initialized resolved | sendOtp present: yes');
    return win;
  } else {
    console.error('[DIAGNOSTIC] ensureMsg91Initialized rejected | sendOtp present: no');
    throw new Error('MSG91 sendOtp method is not available on window object.');
  }
}

/**
 * Utility to load the MSG91 Secure OTP Widget script on demand
 */
export function loadMsg91Script(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && ((window as any).initSendOTP || (window as any).sendOTP)) {
      console.log('[MSG91] SDK script loaded');
      resolve();
      return;
    }

    const existingScript = document.getElementById('msg91-otp-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        console.log('[MSG91] SDK script loaded');
        resolve();
      });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load MSG91 OTP script.')));
      return;
    }

    const script = document.createElement('script');
    script.id = 'msg91-otp-script';
    script.src = 'https://control.msg91.com/app/assets/otp-provider/otp-provider.js';
    script.async = true;
    script.onload = () => {
      console.log('[MSG91] SDK script loaded');
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load MSG91 OTP script.'));
    document.head.appendChild(script);
  });
}

export interface VerifyAccessTokenResponse {
  success: boolean;
  message?: string;
  error?: string;
  mobile?: string | null;
  email?: string | null;
  normalizedPhone?: string | null;
  verificationToken?: string | null;
  verifiedCustomerSessionId?: string | null;
  token?: string | null;
  sessionToken?: string | null;
  profile?: any;
}

/**
 * Safely extracts MSG91 access token string from callback payload.
 * Guards against treating human-readable status messages (e.g. "OTP verified successfully") as tokens.
 */
export function extractAccessToken(data: any): string | null {
  if (!data) return null;

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed && trimmed.length > 10 && !trimmed.includes(' ')) {
      return trimmed;
    }
    return null;
  }

  if (typeof data === 'object') {
    const candidates = [
      data['access-token'],
      data.accessToken,
      data.token,
      data.jwt,
      data['jwt-token'],
      data?.data?.['access-token'],
      data?.data?.accessToken,
      data?.data?.token,
      data?.data?.jwt,
      data.message
    ];

    for (const val of candidates) {
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed && trimmed.length > 10 && !trimmed.includes(' ')) {
          return trimmed;
        }
      }
    }
  }

  return null;
}

/**
 * Calls server-side Express API route to verify MSG91 access token.
 * Never passes or exposes MSG91_AUTH_KEY on client side.
 */
export async function verifyMsg91AccessTokenOnServer(
  tokenOrOptions: string | { accessToken: string; identifier?: string; phone?: string; email?: string; loginChallenge?: string; purpose?: string },
  identifierArg?: string | { loginChallenge?: string; purpose?: string },
  optionsArg?: { loginChallenge?: string; purpose?: string }
): Promise<VerifyAccessTokenResponse> {
  const token = typeof tokenOrOptions === 'string' ? tokenOrOptions : tokenOrOptions?.accessToken;
  const identifier = typeof tokenOrOptions === 'string'
    ? (typeof identifierArg === 'string' ? identifierArg : undefined)
    : (tokenOrOptions?.identifier || tokenOrOptions?.email || tokenOrOptions?.phone);

  const options = typeof tokenOrOptions === 'object'
    ? tokenOrOptions
    : (typeof identifierArg === 'object' ? identifierArg : optionsArg);

  const loginChallenge = options?.loginChallenge;
  const purpose = options?.purpose;

  console.log('[OTP VERIFY] frontend verification callback reached');
  console.log(`[OTP VERIFY] MSG91 access token present: ${Boolean(token)}`);

  if (!token || !token.trim()) {
    return {
      success: false,
      error: 'Access token is required for OTP verification.'
    };
  }

  const isEmail = Boolean(identifier && identifier.includes('@'));
  const cleanId = identifier ? identifier.trim() : undefined;

  try {
    const res = await fetch('/api/verify-msg91-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        accessToken: token.trim(),
        mobile: isEmail ? undefined : cleanId,
        email: isEmail ? cleanId : undefined,
        identifier: cleanId,
        loginChallenge,
        purpose
      })
    });

    const data = await res.json();
    if (!res.ok) {
      console.warn('[OTP VERIFY] backend verification rejected:', data?.error || res.status);
      return {
        success: false,
        error: data.error || data.message || 'OTP access token verification failed.'
      };
    }

    return {
      success: true,
      message: data.message || 'Verification completed successfully.',
      mobile: data.mobile || null,
      email: data.email || null,
      normalizedPhone: data.normalizedPhone || null,
      verificationToken: data.verificationToken || data.token || null,
      sessionToken: data.sessionToken || data.token || null,
      verifiedCustomerSessionId: data.verifiedCustomerSessionId || null,
      profile: data.profile || null
    };
  } catch (fetchErr: any) {
    console.error('[OTP VERIFY] network request to /api/verify-msg91-otp failed:', fetchErr?.message || fetchErr);
    return {
      success: false,
      error: fetchErr?.message || 'Network error while contacting verification server.'
    };
  }
}
