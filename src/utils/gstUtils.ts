export interface VerifiedGstData {
  gstin: string;
  legal_name: string;
  trade_name?: string;
  status?: string;
  taxpayer_type?: string;
  business_constitution?: string;
  registration_date?: string;
  address?: string;
  pincode?: string;
  state_code?: string;
  block_status?: string;
  verified_at?: string;
  expires_at?: string;
}

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidGstinFormat(gstin: string): boolean {
  return GSTIN_REGEX.test(gstin.trim().toUpperCase());
}

export async function verifyGstinApi(gstin: string): Promise<{
  valid: boolean;
  data?: VerifiedGstData;
  error?: string;
}> {
  const cleanGstin = gstin.trim().toUpperCase();
  if (!isValidGstinFormat(cleanGstin)) {
    return {
      valid: false,
      error: 'GSTIN must be 15 alphanumeric characters (e.g. 29ABCDE1234F1Z5).'
    };
  }

  try {
    const res = await fetch(`/api/gst/verify/${encodeURIComponent(cleanGstin)}`);
    const data = await res.json();

    if (res.ok && data.valid && data.data) {
      return {
        valid: true,
        data: data.data
      };
    } else {
      return {
        valid: false,
        error: data.error || 'GSTIN verification failed. Please check the number.'
      };
    }
  } catch (err: any) {
    console.error('GSTIN verification fetch error:', err);
    return {
      valid: false,
      error: 'Unable to connect to GST verification service.'
    };
  }
}

// Indian GST State Code mapping
export const GST_STATE_CODE_MAP: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh'
};

export function getStateFromGstStateCode(code?: string): string | null {
  if (!code) return null;
  const cleanCode = code.padStart(2, '0');
  return GST_STATE_CODE_MAP[cleanCode] || null;
}
