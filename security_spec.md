# Security Specification

## 1. Data Invariants
- Anyone (unauthenticated and authenticated) can read products.
- Only the specific Admin user with the email `shop@saandsha.com` can create, update, or delete products. Since we cannot check email directly in rules without authenticating, the admin must be logged in. The security rules will check if the user is signed in as an admin.
- Any product must have a valid non-empty string name, positive price, and valid enum values for category, fit, etc.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated write to products**: Payload trying to create a product without authentication.
2. **Non-admin write to products**: Payload trying to create a product from a regular user (not the admin).
3. **Invalid category enum**: Payload with an invalid category value (e.g. "shoes").
4. **Negative price**: Payload with a price <= 0.
5. **Too large name**: Payload with a name size exceeding 200 characters.
6. **Missing required fields**: Payload with missing critical properties like `name` or `price`.
7. **Invalid Fit enum**: Payload with an invalid fit (e.g. "Skinny").
8. **Invalid status enum**: Payload with invalid status (e.g. "archived").
9. **Invalid pattern enum**: Payload with invalid pattern (e.g. "Floral").
10. **Poisoned Product ID**: Document ID containing illegal characters.
11. **Injecting shadow fields**: Attempting to update a product with un-schema'd fields.
12. **Tampering rating**: A non-admin attempting to manually write review rating data.

## Phase 9C.3.2 Security Specification

### 1. Data Invariants
- `customer_security_events` collection is strictly append-only.
- Public/client write, update, and delete access to `customer_security_events` is denied in `firestore.rules`.
- Security events are created exclusively by server-side Admin SDK operations.
- `customer_security_events` queries must be scoped to `customer_profile_id` for customer requests.
- No raw session tokens, session token hashes, OTPs, Google ID tokens, access tokens, refresh tokens, Google UIDs, full IP addresses, or provider secrets may ever be stored in security event documents or returned by security APIs.
- IP addresses must be masked (`203.0.113.xxx` or `2001:db8:****:****`).

### 2. The "Dirty Dozen" Security Events Payloads
1. **Unauthenticated Access to Login History**: Request to `/api/customer/security/login-history` without session token.
2. **Cross-Customer Data Leak**: Request to `/api/customer/security/login-history` attempting to read another profile's security events.
3. **Client-side Attempt to Mutate Security Events**: Direct Firestore update/delete request to `customer_security_events/{id}`.
4. **Token/Secret Injected in Event Metadata**: Attempt to store raw session token or OTP inside event metadata object.
5. **Raw IP Address Exposure**: Unmasked IPv4 or IPv6 address returned in security history endpoint.
6. **Raw Google UID Exposure**: Unmasked Google UID returned in security event API response.
7. **Unbounded Event Query Scan**: Requesting login history without limit or requesting > 100 limit.
8. **Suspicious Login Bypass**: Failing multiple Mobile OTP requests without trigger of `RAPID_LOGIN_ATTEMPTS` or `MULTIPLE_FAILED_LOGINS` flags.
9. **Tampering Event ID/Type**: Client attempting to forge security event types via public endpoints.
10. **Admin Endpoint Access by Customer**: Regular customer attempting to call `/api/admin/customers/:id/security-events`.
11. **Session Rotation Failure Event Omission**: Session token rotation occurring without recording `token_rotated`/`session_rotated` event.
12. **Audit Fail-Open Crash**: Security event recording error causing auth flow failure (fault isolation breach).
