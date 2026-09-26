/**
 * Thin client for Blue Dart's APIGEE (DHL Developer Portal) API —
 * https://developer.dhl.com — the current Blue Dart integration surface,
 * replacing the older bluedart.com SOAP/WSDL API. Everything here is a
 * JSON REST pass-through to Blue Dart's legacy backend.
 *
 * Built from Blue Dart's own "Blue Dart – Digitized Booking Journey" BRD
 * (APIGEE Integration doc, Ver 2.10) and the Registration/JWT guides Blue
 * Dart emailed directly — endpoint URLs, the token exchange flow, and the
 * Waybill/Tracking/Finder request-response shapes below are taken from
 * that document, not guessed.
 *
 * One exception: the "Profile" object every Finder/Waybill call requires
 * (LoginID/LicenceKey/Api_type/Version) is defined in a separate "common
 * objects sheet" Blue Dart's doc references but didn't attach. The field
 * *names* used below (LoginID, LicenceKey, Api_type, Version) are Blue
 * Dart's long-standing, widely-documented legacy Profile schema carried
 * through unchanged into this pass-through layer — but BLUEDART_API_TYPE
 * and BLUEDART_API_VERSION specifically are our best inference, not
 * confirmed from Blue Dart's own docs. If the very first real call fails
 * with an auth/profile error, these two are the first thing to check —
 * bluedartApiError below surfaces Blue Dart's raw error text for exactly
 * that reason.
 *
 * Required env vars (server-side only, never sent to the browser):
 *   BLUEDART_ENV            "sandbox" (default) or "live"
 *   BLUEDART_CLIENT_ID      Apigee App "API Key" from developer.dhl.com
 *   BLUEDART_CLIENT_SECRET  Apigee App "API Secret" from developer.dhl.com
 *   BLUEDART_LOGIN_ID       Blue Dart LoginID (e.g. the "LOGIN ID" on your CCF)
 *   BLUEDART_LICENSE_KEY    Blue Dart LicenceKey ("Shipping License key")
 *   BLUEDART_API_TYPE       Profile.Api_type — default "S"
 *   BLUEDART_API_VERSION    Profile.Version — default "1.10"
 *   BLUEDART_ORIGIN_AREA    Shipper.OriginArea (Blue Dart branch code, e.g. "JAI")
 *   BLUEDART_CUSTOMER_CODE  Shipper.CustomerCode (Blue Dart account/customer code)
 *   BLUEDART_ORIGIN_NAME    Shipper.CustomerName (warehouse/business name)
 *   BLUEDART_ORIGIN_ADDRESS1  Shipper.CustomerAddress1
 *   BLUEDART_ORIGIN_ADDRESS2  Shipper.CustomerAddress2 (optional)
 *   BLUEDART_ORIGIN_PINCODE   Shipper.CustomerPincode
 *   BLUEDART_ORIGIN_PHONE     Shipper.CustomerTelephone / CustomerMobile
 */

const LIVE_BASE = 'https://apigateway.bluedart.com/in/transportation';
const SANDBOX_BASE = 'https://apigateway-sandbox.bluedart.com/in/transportation';

function isLiveEnv(): boolean {
  return (process.env.BLUEDART_ENV || 'sandbox').trim().toLowerCase() === 'live';
}

function baseUrl(): string {
  return isLiveEnv() ? LIVE_BASE : SANDBOX_BASE;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`${name} is not configured on this server.`);
  return value.trim();
}

function clientId(): string {
  return requiredEnv('BLUEDART_CLIENT_ID');
}
function clientSecret(): string {
  return requiredEnv('BLUEDART_CLIENT_SECRET');
}

function profile() {
  return {
    LoginID: requiredEnv('BLUEDART_LOGIN_ID'),
    LicenceKey: requiredEnv('BLUEDART_LICENSE_KEY'),
    Api_type: (process.env.BLUEDART_API_TYPE || 'S').trim(),
    Version: (process.env.BLUEDART_API_VERSION || '1.10').trim()
  };
}

export class BluedartApiError extends Error {
  constructor(message: string, public readonly raw?: unknown) {
    super(message);
    this.name = 'BluedartApiError';
  }
}

// --- JWT token exchange (Blue Dart Authentication API) ---
// Every other call needs this token as an `Authorization: Bearer` header.
// Cached in-memory per server process; Blue Dart's docs don't state an
// exact TTL, so we refetch a few minutes early and on any 401.
let cachedToken: { token: string; fetchedAt: number } | null = null;
const TOKEN_TTL_MS = 20 * 60 * 1000; // refresh every 20 min to be safe

async function getToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && Date.now() - cachedToken.fetchedAt < TOKEN_TTL_MS) {
    return cachedToken.token;
  }

  const res = await fetch(`${baseUrl()}/token/v1/login`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      ClientID: clientId(),
      clientSecret: clientSecret()
    }
  });

  const bodyText = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new BluedartApiError(`Blue Dart token request returned non-JSON (${res.status}): ${bodyText.slice(0, 300)}`);
  }

  if (!res.ok || !parsed?.JWTToken) {
    throw new BluedartApiError(`Blue Dart token request failed (${res.status}): ${JSON.stringify(parsed)}`, parsed);
  }

  cachedToken = { token: parsed.JWTToken, fetchedAt: Date.now() };
  return cachedToken.token;
}

async function bluedartPost<T = any>(path: string, body: unknown): Promise<T> {
  const call = async (token: string) =>
    fetch(`${baseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

  let token = await getToken();
  let res = await call(token);
  if (res.status === 401) {
    // Token likely expired — refresh once and retry.
    token = await getToken(true);
    res = await call(token);
  }

  const bodyText = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new BluedartApiError(`Blue Dart ${path} returned non-JSON (${res.status}): ${bodyText.slice(0, 500)}`);
  }

  if (!res.ok || parsed?.IsError === true) {
    const message =
      parsed?.ErrorMessage ||
      parsed?.Status?.[0]?.StatusInformation ||
      `Blue Dart ${path} failed (${res.status})`;
    throw new BluedartApiError(message, parsed);
  }

  return parsed as T;
}

// --- Pincode Serviceability (Finder API) ---

export interface PincodeServiceability {
  pincode: string;
  serviceable: boolean;
  city: string | null;
  state: string | null;
  codAvailable: boolean;
  prepaidAvailable: boolean;
  errorMessage: string | null;
}

export async function bluedartCheckPincode(pincode: string): Promise<PincodeServiceability> {
  const clean = pincode.trim();
  if (!/^\d{6}$/.test(clean)) {
    throw new BluedartApiError('Pincode must be exactly 6 digits.');
  }

  // Confirmed from Blue Dart's own "Get Service for Pin-code" sample request
  // on the developer portal: the wrapper key is lowercase "profile", unlike
  // the BRD design doc's PascalCase "Profile" — the nested field names
  // (Api_type/LicenceKey/LoginID) match the BRD as documented.
  const result = await bluedartPost<any>('/finder/v1/GetServicesforPincode', {
    pinCode: clean,
    profile: profile()
  });

  const ref = result?.ServiceCenterDetailsReference || result;
  const isError = !!ref?.IsError;
  const codAvailable = ref?.eTailCODAirInbound === 'Y' || ref?.eTailCODGroundInbound === 'Y';
  const prepaidAvailable = ref?.eTailPrePaidAirInbound === 'Y' || ref?.eTailPrePaidGroundInbound === 'Y';

  return {
    pincode: clean,
    serviceable: !isError && (codAvailable || prepaidAvailable || ref?.GroundInbound === 'Y' || ref?.ApexInbound === 'Y'),
    city: ref?.CityDescription || ref?.PincodeDescription || null,
    state: ref?.State || null,
    codAvailable,
    prepaidAvailable,
    errorMessage: isError ? ref?.ErrorMessage || 'Pincode not serviceable.' : null
  };
}

// --- Tracking (query-string GET, no Profile object needed) ---

export interface BluedartScan {
  scan: string;
  scanCode: string;
  scanType: string;
  scanDate: string;
  scanTime: string;
  location: string;
}

export interface BluedartShipmentStatus {
  awb: string;
  status: string;
  statusType: string;
  statusDate: string | null;
  statusTime: string | null;
  expectedDeliveryDate: string | null;
  origin: string | null;
  destination: string | null;
  receivedBy: string | null;
  scans: BluedartScan[];
}

// scan: pass true for full scan history, false for latest status only.
export async function bluedartTrackShipment(awb: string, scan: boolean = true): Promise<BluedartShipmentStatus> {
  const clean = awb.trim();
  if (!clean) throw new BluedartApiError('AWB number is required.');

  const loginId = requiredEnv('BLUEDART_LOGIN_ID');
  const licenceKey = requiredEnv('BLUEDART_LICENSE_KEY');
  const token = await getToken();

  const url =
    `${baseUrl()}/tracking/v1?handler=tnt&action=custawbquery&loginid=${encodeURIComponent(loginId)}` +
    `&awb=awb&numbers=${encodeURIComponent(clean)}&format=json&lickey=${encodeURIComponent(licenceKey)}` +
    `&verno=1&scan=${scan ? 1 : 0}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { accept: 'application/json', Authorization: `Bearer ${token}` }
  });

  const bodyText = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new BluedartApiError(`Blue Dart tracking returned non-JSON (${res.status}): ${bodyText.slice(0, 500)}`);
  }

  const shipment = parsed?.ShipmentData?.Shipment || parsed?.Shipment;
  if (!res.ok || !shipment) {
    throw new BluedartApiError(`No tracking data found for AWB ${clean}.`, parsed);
  }

  const scanList: any[] = shipment?.Scans?.ScanDetail
    ? Array.isArray(shipment.Scans.ScanDetail)
      ? shipment.Scans.ScanDetail
      : [shipment.Scans.ScanDetail]
    : [];

  return {
    awb: clean,
    status: shipment?.Status || 'UNKNOWN',
    statusType: shipment?.StatusType || '',
    statusDate: shipment?.StatusDate || null,
    statusTime: shipment?.StatusTime || null,
    expectedDeliveryDate: shipment?.ExpectedDeliveryDate || null,
    origin: shipment?.Origin || null,
    destination: shipment?.Destination || null,
    receivedBy: shipment?.ReceivedBy || null,
    scans: scanList.map((s) => ({
      scan: s?.Scan || '',
      scanCode: s?.ScanCode || '',
      scanType: s?.ScanType || '',
      scanDate: s?.ScanDate || '',
      scanTime: s?.ScanTime || '',
      location: s?.ScannedLocation || ''
    }))
  };
}

// --- Waybill Generation (domestic e-commerce only — Product "A" per this
// account's onboarding; no international fields are implemented here) ---

export interface GenerateWaybillParams {
  orderId: string;
  consigneeName: string;
  addressLine1: string;
  addressLine2?: string;
  consigneePincode: string;
  consigneeMobile: string;
  consigneeEmail?: string;
  isCod: boolean;
  codAmount?: number;
  declaredValue: number;
  weightKg: number;
  pieceCount?: number;
}

export interface GenerateWaybillResult {
  awb: string;
  destinationArea: string | null;
  labelPdfBase64: string | null;
}

function shipperOrigin() {
  return {
    OriginArea: requiredEnv('BLUEDART_ORIGIN_AREA'),
    CustomerCode: requiredEnv('BLUEDART_CUSTOMER_CODE'),
    CustomerName: requiredEnv('BLUEDART_ORIGIN_NAME'),
    CustomerAddress1: requiredEnv('BLUEDART_ORIGIN_ADDRESS1'),
    CustomerAddress2: process.env.BLUEDART_ORIGIN_ADDRESS2 || '',
    CustomerPincode: requiredEnv('BLUEDART_ORIGIN_PINCODE'),
    CustomerTelephone: process.env.BLUEDART_ORIGIN_PHONE || '',
    CustomerMobile: process.env.BLUEDART_ORIGIN_PHONE || '',
    isToPayCustomer: false
  };
}

// Next pickup slot: today if before 4pm local, else tomorrow — matches
// Blue Dart's usual same-day pickup cutoff. Kept simple/conservative
// since the exact cutoff is set by your local Blue Dart branch, not the API.
function nextPickupDateTime(): { pickupDateMs: number; pickupTime: string } {
  const now = new Date();
  const cutoffHour = 16;
  const pickup = new Date(now);
  if (now.getHours() >= cutoffHour) {
    pickup.setDate(pickup.getDate() + 1);
  }
  pickup.setHours(0, 0, 0, 0);
  return { pickupDateMs: pickup.getTime(), pickupTime: now.getHours() >= cutoffHour ? '1100' : '1700' };
}

export async function bluedartGenerateWaybill(params: GenerateWaybillParams): Promise<GenerateWaybillResult> {
  const { pickupDateMs, pickupTime } = nextPickupDateTime();

  const request = {
    Shipper: shipperOrigin(),
    Consignee: {
      ConsigneeName: params.consigneeName,
      ConsigneeAddress1: params.addressLine1,
      ConsigneeAddress2: params.addressLine2 || '',
      ConsigneePincode: params.consigneePincode,
      ConsigneeMobile: params.consigneeMobile,
      ConsigneeEmailID: params.consigneeEmail || ''
    },
    Services: {
      ProductCode: 'A',
      ProductType: 1, // Dutiables (apparel, not documents)
      SubProductCode: params.isCod ? 'C' : 'P',
      PieceCount: params.pieceCount ?? 1,
      ActualWeight: params.weightKg,
      PackType: 'L',
      InvoiceNo: params.orderId.slice(0, 10),
      DeclaredValue: params.declaredValue,
      ...(params.isCod ? { CollactableAmount: params.codAmount ?? params.declaredValue } : {}),
      CreditReferenceNo: `${params.orderId}-${Date.now()}`.slice(0, 20),
      PickupDate: pickupDateMs,
      PickupTime: pickupTime,
      RegisterPickup: true
    },
    IsUpdateAPI: false
  };

  // Applying the same lowercase-wrapper-key pattern confirmed for the
  // Finder API's "profile" key (see bluedartCheckPincode) — not yet
  // independently confirmed for Waybill specifically, so verify against
  // its own portal sample if this still 401s.
  const result = await bluedartPost<any>('/waybill/v1/GenerateWayBill', {
    request: request,
    profile: profile()
  });

  if (!result?.AWBNo) {
    throw new BluedartApiError('Blue Dart did not return an AWB number.', result);
  }

  return {
    awb: result.AWBNo,
    destinationArea: result.DestinationArea || null,
    labelPdfBase64: result.AWBPrintContent || null
  };
}

// --- Reverse Pickup (RMA / customer return collection) ---
//
// Blue Dart's Waybill API has no separate "pickup-only" registration
// endpoint documented anywhere in the BRD this integration was built
// from. The established pattern for booking a reverse pickup on this
// kind of courier API — and what we do here — is to call the SAME
// GenerateWayBill endpoint used for forward shipments above, but with
// Shipper and Consignee swapped: the customer's return address becomes
// the Shipper (pickup origin) and our own warehouse becomes the
// Consignee (delivery destination), with RegisterPickup still set.
//
// This is a reasonable, standard inference for reverse logistics on an
// API shaped like Blue Dart's, NOT something confirmed from Blue Dart's
// own docs for this specific account — say so plainly wherever this is
// referenced. It also inherits both of this file's other unconfirmed
// assumptions (BLUEDART_API_TYPE/VERSION, and the lowercase `profile`
// wrapper key — see the top-of-file comment and the note above
// bluedartGenerateWaybill's own bluedartPost call). If the very first
// real reverse-pickup call fails with a profile/auth-shaped error, the
// fix is checking Blue Dart's own developer-portal sample for the exact
// GenerateWayBill request shape used for reverse pickups, not assuming
// this Shipper/Consignee swap itself is at fault.

export interface RegisterReversePickupParams {
  returnId: string;
  shipperName: string;
  addressLine1: string;
  addressLine2?: string;
  shipperPincode: string;
  shipperMobile: string;
  shipperEmail?: string;
  declaredValue?: number;
  weightKg?: number;
  pieceCount?: number;
}

export type RegisterReversePickupResult = GenerateWaybillResult;

function warehouseAsConsignee() {
  // Same BLUEDART_ORIGIN_* env vars as shipperOrigin() above, just
  // re-shaped into Consignee field names — our warehouse is the
  // destination for a reverse pickup.
  return {
    ConsigneeName: requiredEnv('BLUEDART_ORIGIN_NAME'),
    ConsigneeAddress1: requiredEnv('BLUEDART_ORIGIN_ADDRESS1'),
    ConsigneeAddress2: process.env.BLUEDART_ORIGIN_ADDRESS2 || '',
    ConsigneePincode: requiredEnv('BLUEDART_ORIGIN_PINCODE'),
    ConsigneeMobile: process.env.BLUEDART_ORIGIN_PHONE || '',
    ConsigneeEmailID: ''
  };
}

export async function bluedartRegisterReversePickup(
  params: RegisterReversePickupParams
): Promise<RegisterReversePickupResult> {
  const { pickupDateMs, pickupTime } = nextPickupDateTime();

  const request = {
    // Customer's return address as Shipper (pickup origin). Blue Dart's
    // Shipper object schema also carries OriginArea/CustomerCode, which
    // are our own account's fields (branch code + billing account) — we
    // don't have a per-pincode area-code lookup in this integration, so
    // these fall back to our own registered origin/account even though
    // the physical pickup happens at the customer's address. Unconfirmed
    // against Blue Dart's own reverse-pickup sample; revisit if this
    // causes a wrong-area/misroute error rather than a clean AWB.
    Shipper: {
      OriginArea: requiredEnv('BLUEDART_ORIGIN_AREA'),
      CustomerCode: requiredEnv('BLUEDART_CUSTOMER_CODE'),
      CustomerName: params.shipperName,
      CustomerAddress1: params.addressLine1,
      CustomerAddress2: params.addressLine2 || '',
      CustomerPincode: params.shipperPincode,
      CustomerTelephone: params.shipperMobile,
      CustomerMobile: params.shipperMobile,
      isToPayCustomer: false
    },
    // Our own warehouse as Consignee (delivery destination for the
    // collected return).
    Consignee: warehouseAsConsignee(),
    Services: {
      ProductCode: 'A',
      ProductType: 1, // Dutiables (apparel, not documents)
      SubProductCode: 'P', // Prepaid — no COD collection on a reverse pickup
      PieceCount: params.pieceCount ?? 1,
      ActualWeight: params.weightKg ?? 0.5,
      PackType: 'L',
      InvoiceNo: params.returnId.slice(0, 10),
      DeclaredValue: params.declaredValue ?? 0,
      CreditReferenceNo: `${params.returnId}-${Date.now()}`.slice(0, 20),
      PickupDate: pickupDateMs,
      PickupTime: pickupTime,
      RegisterPickup: true
    },
    IsUpdateAPI: false
  };

  // Same lowercase-wrapper-key pattern used by bluedartGenerateWaybill —
  // not independently confirmed for Waybill (let alone for this
  // Shipper/Consignee-swapped reverse-pickup shape); if this 401s,
  // check Blue Dart's own portal sample before assuming anything else
  // is wrong.
  const result = await bluedartPost<any>('/waybill/v1/GenerateWayBill', {
    request,
    profile: profile()
  });

  if (!result?.AWBNo) {
    throw new BluedartApiError('Blue Dart did not return an AWB number for the reverse pickup.', result);
  }

  return {
    awb: result.AWBNo,
    destinationArea: result.DestinationArea || null,
    labelPdfBase64: result.AWBPrintContent || null
  };
}
