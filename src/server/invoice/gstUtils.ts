// Indian GST State Code Mapping (2-digit GST state codes)
export const STATE_CODE_TO_NAME_MAP: Record<string, string> = {
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

export const STATE_NAME_TO_CODE_MAP: Record<string, string> = Object.entries(STATE_CODE_TO_NAME_MAP).reduce(
  (acc, [code, name]) => {
    acc[name.toLowerCase()] = code;
    return acc;
  },
  {} as Record<string, string>
);

// Common alias additions
STATE_NAME_TO_CODE_MAP['daman and diu'] = '26';
STATE_NAME_TO_CODE_MAP['dadra & nagar haveli'] = '26';
STATE_NAME_TO_CODE_MAP['daman & diu'] = '26';
STATE_NAME_TO_CODE_MAP['j&k'] = '01';
STATE_NAME_TO_CODE_MAP['up'] = '09';
STATE_NAME_TO_CODE_MAP['mp'] = '23';
STATE_NAME_TO_CODE_MAP['wb'] = '19';
STATE_NAME_TO_CODE_MAP['mh'] = '27';
STATE_NAME_TO_CODE_MAP['tn'] = '33';
STATE_NAME_TO_CODE_MAP['ka'] = '29';
STATE_NAME_TO_CODE_MAP['dl'] = '07';
STATE_NAME_TO_CODE_MAP['gj'] = '24';
STATE_NAME_TO_CODE_MAP['kl'] = '32';
STATE_NAME_TO_CODE_MAP['ap'] = '37';
STATE_NAME_TO_CODE_MAP['ts'] = '36';

export function normalizeGstStateCode(input?: string, fallbackCode: string = ""): string {
  if (!input || !input.trim()) return fallbackCode;
  const clean = input.trim().toLowerCase();

  // If 2-digit state code or single digit
  if (/^\d{1,2}$/.test(clean)) {
    const padded = clean.padStart(2, '0');
    if (STATE_CODE_TO_NAME_MAP[padded]) {
      return padded;
    }
  }

  // If GSTIN provided (e.g. 27ABCDE1234F1Z5)
  if (clean.length === 15 && /^\d{2}/.test(clean)) {
    const code = clean.substring(0, 2);
    if (STATE_CODE_TO_NAME_MAP[code]) {
      return code;
    }
  }

  // Search by state name or alias
  if (STATE_NAME_TO_CODE_MAP[clean]) {
    return STATE_NAME_TO_CODE_MAP[clean];
  }

  // Partial match fallback
  const entry = Object.entries(STATE_NAME_TO_CODE_MAP).find(([name]) => name.includes(clean) || clean.includes(name));
  if (entry) {
    return entry[1];
  }

  return fallbackCode;
}

export function getStateNameFromCode(code?: string, fallbackName: string = ""): string {
  if (!code) return fallbackName;
  const normalized = normalizeGstStateCode(code);
  return STATE_CODE_TO_NAME_MAP[normalized] || fallbackName;
}

export interface GstTreatmentInput {
  sellerStateCode: string;
  placeOfSupplyStateCode: string;
  gstRate: number;
}

export interface GstTreatmentResult {
  supply_type: "INTRASTATE" | "INTERSTATE";
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
}

export function determineGstTreatment(input: GstTreatmentInput): GstTreatmentResult {
  const sellerCode = normalizeGstStateCode(input.sellerStateCode);
  const posCode = normalizeGstStateCode(input.placeOfSupplyStateCode);
  const rate = typeof input.gstRate === 'number' && !isNaN(input.gstRate) && input.gstRate >= 0 ? input.gstRate : 0;

  if (sellerCode && sellerCode === posCode) {
    return {
      supply_type: "INTRASTATE",
      cgst_rate: rate / 2,
      sgst_rate: rate / 2,
      igst_rate: 0
    };
  } else {
    return {
      supply_type: "INTERSTATE",
      cgst_rate: 0,
      sgst_rate: 0,
      igst_rate: rate
    };
  }
}
