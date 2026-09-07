import React from 'react';
import { motion } from 'motion/react';
import { Building2, Check, CheckCircle2, Loader2, XCircle, MapPin } from 'lucide-react';
import { VerifiedGstData, getStateFromGstStateCode } from '../utils/gstUtils';

export interface GstVerificationSectionProps {
  gstin: string;
  onGstinChange: (val: string) => void;
  verificationState: 'idle' | 'verifying' | 'verified' | 'failed';
  verifiedGstData: VerifiedGstData | null;
  errorMessage: string | null;
  onVerify: (inputGstin?: string) => void;
  legalName?: string;
  onLegalNameChange?: (val: string) => void;
  tradeName?: string;
  onTradeNameChange?: (val: string) => void;
  onApplyGstAddress?: (addressData: { address: string; pincode?: string; state?: string }) => void;
  showManualFields?: boolean;
  theme?: 'stone' | 'checkout';
  label?: string;
  sublabel?: string;
}

export const GstVerificationSection: React.FC<GstVerificationSectionProps> = ({
  gstin,
  onGstinChange,
  verificationState,
  verifiedGstData,
  errorMessage,
  onVerify,
  legalName,
  onLegalNameChange,
  tradeName,
  onTradeNameChange,
  onApplyGstAddress,
  showManualFields = false,
  theme = 'stone',
  label = 'GSTIN for Business Billing (Optional)',
  sublabel = 'Provide a 15-character GSTIN if you require a tax credit invoice for your business entity.'
}) => {
  const isCheckoutTheme = theme === 'checkout';

  const containerBorder = isCheckoutTheme ? 'border-[#C9B79C]/20' : 'border-stone-200';
  const labelColor = isCheckoutTheme ? 'text-[#1F1B16]/70' : 'text-stone-700';
  const buttonBg = isCheckoutTheme ? 'bg-[#1F1B16] hover:bg-[#B85C38]' : 'bg-stone-900 hover:bg-stone-800';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    onGstinChange(val);
    if (val.length === 15) {
      onVerify(val);
    }
  };

  const derivedStateName = verifiedGstData?.state_code
    ? getStateFromGstStateCode(verifiedGstData.state_code)
    : null;

  return (
    <div className={`pt-3 border-t ${containerBorder} flex flex-col gap-2.5`}>
      <div className="flex items-center justify-between">
        <label className={`font-bold uppercase tracking-wider text-[10px] ${labelColor} flex items-center gap-1.5`}>
          <Building2 className="w-3.5 h-3.5 text-[#B85C38]" />
          <span>{label}</span>
        </label>
        {verificationState === 'verified' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold">
            <Check className="w-3 h-3 text-emerald-600" />
            Govt Verified
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={gstin}
          onChange={handleInputChange}
          maxLength={15}
          placeholder="e.g. 29ABCDE1234F1Z5"
          className={`w-full px-3.5 py-2.5 text-xs font-mono tracking-wider uppercase border rounded-xl focus:outline-none transition-colors ${
            verificationState === 'verified'
              ? 'border-emerald-500 bg-emerald-50/20 text-stone-900'
              : verificationState === 'failed'
              ? 'border-rose-400 bg-rose-50/20 text-stone-900'
              : 'border-stone-300 bg-white text-stone-900 focus:border-stone-900'
          }`}
        />
        <button
          type="button"
          onClick={() => onVerify()}
          disabled={verificationState === 'verifying' || !gstin || gstin.length < 15}
          className={`px-4 py-2.5 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1.5 cursor-pointer ${buttonBg}`}
        >
          {verificationState === 'verifying' ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Verifying...</span>
            </>
          ) : (
            <span>Verify GST</span>
          )}
        </button>
      </div>

      {verificationState === 'verifying' && (
        <p className="text-[11px] text-[#B85C38] flex items-center gap-1.5 animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Fetching verified business information from GSTIN Portal...</span>
        </p>
      )}

      {/* VERIFIED BUSINESS DETAILS CARD */}
      {verificationState === 'verified' && verifiedGstData && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2 text-xs text-stone-800"
        >
          <div className="flex items-center justify-between font-bold text-emerald-900 border-b border-emerald-200/60 pb-1.5">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{verifiedGstData.legal_name || 'Verified Business Entity'}</span>
            </span>
            <span className="text-[10px] uppercase bg-emerald-200/80 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
              {verifiedGstData.status || 'Active'}
            </span>
          </div>

          {verifiedGstData.trade_name && verifiedGstData.trade_name !== verifiedGstData.legal_name && (
            <p className="text-[11px] text-stone-600">
              <strong>Trade Name:</strong> {verifiedGstData.trade_name}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-600 pt-0.5">
            <div>
              <strong>Taxpayer Type:</strong> {verifiedGstData.taxpayer_type || 'Regular'}
            </div>
            <div>
              <strong>State:</strong> {derivedStateName || verifiedGstData.state_code || gstin.substring(0, 2)}
            </div>
          </div>

          {verifiedGstData.address && (
            <p className="text-[11px] text-stone-600 border-t border-emerald-200/40 pt-1.5">
              <strong>Registered Address:</strong> {verifiedGstData.address}
            </p>
          )}

          {onApplyGstAddress && verifiedGstData.address && (
            <div className="pt-1 border-t border-emerald-200/60">
              <button
                type="button"
                onClick={() => onApplyGstAddress({
                  address: verifiedGstData.address || '',
                  pincode: verifiedGstData.pincode,
                  state: derivedStateName || undefined
                })}
                className="text-xs font-semibold text-emerald-900 hover:text-emerald-950 underline flex items-center gap-1 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                <span>Use GST Registered Address for Shipping</span>
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* FAILED ERROR CARD */}
      {verificationState === 'failed' && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
          <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold">{errorMessage || 'GSTIN verification failed.'}</p>
            <p className="text-[10px] text-rose-600">Please double check the 15-character GST number, or continue standard submission.</p>
          </div>
        </div>
      )}

      {/* MANUAL OVERRIDE / READ-ONLY DISPLAY FIELDS */}
      {showManualFields && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Legal Business Name
            </label>
            <input
              type="text"
              value={legalName || ''}
              onChange={e => onLegalNameChange && onLegalNameChange(e.target.value)}
              placeholder="Legal Business Name"
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Trade Name (Optional)
            </label>
            <input
              type="text"
              value={tradeName || ''}
              onChange={e => onTradeNameChange && onTradeNameChange(e.target.value)}
              placeholder="Trade Name"
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
            />
          </div>
        </div>
      )}

      {sublabel && (
        <p className="text-[10px] text-gray-500">{sublabel}</p>
      )}
    </div>
  );
};
