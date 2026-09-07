// Centralized Customer Auth Token Management Utility

const TOKEN_KEYS = [
  'kora_customer_auth_token',
  'kora_customer_token',
  'verification_token',
  'kora_customer_session'
];

const PHONE_KEYS = [
  'kora_customer_phone',
  'verification_phone'
];

const EMAIL_KEYS = [
  'kora_customer_email',
  'verification_email'
];

/**
 * Retrieves the stored customer auth token from any supported localStorage key.
 * Automatically synchronizes the token to the primary 'kora_customer_auth_token' key for consistency.
 */
export function getStoredCustomerAuthToken(): string {
  if (typeof window === 'undefined') return '';
  
  for (const key of TOKEN_KEYS) {
    const val = localStorage.getItem(key);
    if (val && val.trim() !== '') {
      // Sync to primary key
      if (key !== 'kora_customer_auth_token') {
        localStorage.setItem('kora_customer_auth_token', val);
      }
      return val.trim();
    }
  }
  return '';
}

/**
 * Stores the customer auth token across all fallback keys to maintain seamless multi-tab / cross-page compatibility.
 */
export function setStoredCustomerAuthToken(token: string, phone?: string, email?: string): void {
  if (typeof window === 'undefined') return;
  if (!token) return;

  for (const key of TOKEN_KEYS) {
    localStorage.setItem(key, token);
  }

  if (phone) {
    for (const key of PHONE_KEYS) {
      localStorage.setItem(key, phone);
    }
  }

  if (email) {
    for (const key of EMAIL_KEYS) {
      localStorage.setItem(key, email);
    }
  }
}

/**
 * Retrieves stored customer phone number from fallback keys.
 */
export function getStoredCustomerPhone(): string {
  if (typeof window === 'undefined') return '';
  for (const key of PHONE_KEYS) {
    const val = localStorage.getItem(key);
    if (val && val.trim() !== '') return val.trim();
  }
  return '';
}

/**
 * Clears all customer session credentials on logout or authentication failure.
 */
export function clearStoredCustomerAuth(): void {
  if (typeof window === 'undefined') return;
  for (const key of TOKEN_KEYS) localStorage.removeItem(key);
  for (const key of PHONE_KEYS) localStorage.removeItem(key);
  for (const key of EMAIL_KEYS) localStorage.removeItem(key);
}
