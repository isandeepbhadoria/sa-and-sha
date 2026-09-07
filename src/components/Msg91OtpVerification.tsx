import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  ensureMsg91Initialized,
  verifyMsg91AccessTokenOnServer,
  extractAccessToken,
  checkAndRecordOtpSendRateLimit
} from '../lib/msg91';

interface Msg91OtpVerificationProps {
  phone?: string;
  email?: string;
  country?: string;
  isVerified: boolean;
  onVerified: (verifiedIdentifier: string, verificationToken?: string, verifiedCustomerSessionId?: string, profile?: any) => void;
  onResetVerification?: () => void;
  autoSend?: boolean;
  loginChallenge?: string;
  purpose?: 'login' | 'registration' | 'checkout';
}

export const Msg91OtpVerification: React.FC<Msg91OtpVerificationProps> = ({
  phone = '',
  email = '',
  country = 'India',
  isVerified,
  onVerified,
  onResetVerification,
  autoSend = false,
  loginChallenge,
  purpose = 'login'
}) => {
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [reqId, setReqId] = useState<string | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '']);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState<number>(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const prevTargetRef = useRef<string>(phone || email);
  const inFlightSendRef = useRef<boolean>(false);
  const reqIdRef = useRef<string | null>(null);
  const autoSendAttemptedRef = useRef<boolean>(false);

  const isEmailMode = Boolean(email && !phone);
  const cleanPhone = phone.replace(/\D/g, '');
  const cleanEmail = email.trim().toLowerCase();

  const isValidIndianPhone = !isEmailMode && country === 'India' && /^[6-9]\d{9}$/.test(cleanPhone);
  const isValidEmail = isEmailMode && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
  const isValidTarget = isEmailMode ? isValidEmail : isValidIndianPhone;

  const targetIdentifier = isEmailMode ? cleanEmail : `91${cleanPhone}`;
  const displayTarget = isEmailMode ? cleanEmail : `+91 ${cleanPhone}`;

  const currentTargetValue = phone || email;

  // Diagnostic state trackers
  useEffect(() => {
    console.log(`[DIAGNOSTIC STATE] isSending transition: ${isSending}`);
  }, [isSending]);

  useEffect(() => {
    console.log(`[DIAGNOSTIC STATE] otpSent transition: ${otpSent}`);
  }, [otpSent]);

  useEffect(() => {
    console.log(`[DIAGNOSTIC STATE] isResending transition: ${isResending}`);
  }, [isResending]);

  useEffect(() => {
    console.log(`[DIAGNOSTIC STATE] isVerifying transition: ${isVerifying}`);
  }, [isVerifying]);

  // Reset state if identifier changes
  useEffect(() => {
    if (prevTargetRef.current !== currentTargetValue) {
      prevTargetRef.current = currentTargetValue;
      setOtpSent(false);
      setReqId(null);
      reqIdRef.current = null;
      setOtpDigits(['', '', '', '']);
      setErrorMessage(null);
      setSuccessMessage(null);
      setResendTimer(0);
      inFlightSendRef.current = false;
      autoSendAttemptedRef.current = false;
      console.log('[DIAGNOSTIC STATE] inFlightSendRef transition: false');
      if (isVerified && onResetVerification) {
        onResetVerification();
      }
    }
  }, [currentTargetValue, isVerified, onResetVerification]);

  // Resend countdown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Auto-initialize MSG91 SDK in background
  useEffect(() => {
    if (isVerified || otpSent) return;

    ensureMsg91Initialized({
      hideMethod: isEmailMode ? 'mobile' : 'email'
    }).catch((err) => {
      console.warn('[MSG91] Auto-init background warning:', err?.message);
    });
  }, [isVerified, otpSent, isEmailMode]);

  // Helper to safely extract MSG91 request ID from callback payload
  const parseReqId = (data: any): string | null => {
    if (!data) return null;
    if (typeof data === 'string') {
      const trimmed = data.trim();
      if (trimmed.length > 5 && !trimmed.includes(' ')) return trimmed;
      try {
        const parsed = JSON.parse(trimmed);
        return parseReqId(parsed);
      } catch {
        return null;
      }
    }
    if (typeof data === 'object') {
      const candidates = [
        data.reqId,
        data.req_id,
        data.requestId,
        data.request_id,
        data.message_id,
        data.messageId,
        data?.data?.reqId,
        data?.data?.req_id,
        data?.data?.requestId,
        data?.data?.request_id,
        data?.data?.message_id,
        data?.data?.messageId
      ];
      for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 5 && !candidate.includes(' ')) {
          return candidate.trim();
        }
        if (typeof candidate === 'number') {
          const str = String(candidate);
          if (str.length > 5) return str;
        }
      }
    }
    return null;
  };

  // Handle triggering Send OTP via window.sendOtp
  const handleSendOtp = async () => {
    console.log(`[DIAGNOSTIC FLOW] handleSendOtp started | authMode: ${isEmailMode ? 'EMAIL' : 'MOBILE'} | inFlightSendRef: ${inFlightSendRef.current}`);
    autoSendAttemptedRef.current = true;
    if (inFlightSendRef.current) {
      console.log('[OTP SEND] Duplicate send attempt ignored while send is in flight');
      return;
    }

    if (!isValidTarget) {
      if (isEmailMode) {
        setErrorMessage('Please enter a valid email address.');
      } else {
        setErrorMessage('Please enter a valid 10-digit Indian mobile number starting with 6-9.');
      }
      return;
    }

    console.log('[OTP SEND] explicit user/auto action received for:', targetIdentifier);
    inFlightSendRef.current = true;
    console.log('[DIAGNOSTIC STATE] inFlightSendRef transition: true');
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSending(true);

    let sendTimeoutId: any = null;
    const clearSendTimeout = () => {
      if (sendTimeoutId) {
        clearTimeout(sendTimeoutId);
        sendTimeoutId = null;
      }
    };

    try {
      // 1. Check server-side rate limits before sending OTP
      const rateLimitRes = await checkAndRecordOtpSendRateLimit({
        channel: isEmailMode ? 'email' : 'mobile',
        identifier: targetIdentifier
      });
      console.log(`[DIAGNOSTIC PROMISE] checkAndRecordOtpSendRateLimit resolved | allowed: ${rateLimitRes.allowed}`);
      if (!rateLimitRes.allowed) {
        console.log('[OTP SEND] rate-limit approved: false');
        setIsSending(false);
        inFlightSendRef.current = false;
        console.log('[DIAGNOSTIC STATE] inFlightSendRef transition: false');
        if (rateLimitRes.retryAfterSeconds && rateLimitRes.retryAfterSeconds <= 45) {
          setResendTimer(rateLimitRes.retryAfterSeconds);
          setErrorMessage(
            `Please wait ${rateLimitRes.retryAfterSeconds} second${rateLimitRes.retryAfterSeconds > 1 ? 's' : ''} before requesting another OTP.`
          );
        } else {
          setErrorMessage(
            rateLimitRes.error || 'Too many OTP requests. Please wait a few minutes and try again.'
          );
          if (rateLimitRes.retryAfterSeconds) {
            setResendTimer(rateLimitRes.retryAfterSeconds);
          }
        }
        return;
      }

      console.log('[OTP SEND] rate-limit approved: true');

      // 2. Initialize MSG91 without identifier parameter to prevent auto-dispatch in initSendOTP
      const win = await ensureMsg91Initialized({
        hideMethod: isEmailMode ? 'mobile' : 'email'
      });
      console.log(`[DIAGNOSTIC PROMISE] ensureMsg91Initialized resolved in handleSendOtp | win.sendOtp present: ${typeof win.sendOtp === 'function'}`);

      // 3. Timeout guard if MSG91 SDK invokes neither callback
      sendTimeoutId = setTimeout(() => {
        console.warn('[DIAGNOSTIC CALLBACK] sendOtp timeout fired: yes');
        if (inFlightSendRef.current) {
          setIsSending(false);
          inFlightSendRef.current = false;
          console.log('[DIAGNOSTIC STATE] inFlightSendRef transition: false');
          setErrorMessage('We could not confirm that the verification code was sent. Please try again.');
        }
      }, 15000);

      console.log('[OTP SEND] sendOtp invoked exactly once for:', targetIdentifier);
      console.log(`[DIAGNOSTIC SDK CALL] window.sendOtp called | authMode: ${isEmailMode ? 'EMAIL' : 'MOBILE'}`);
      win.sendOtp(
        targetIdentifier,
        (data: any) => {
          clearSendTimeout();
          const validReqId = parseReqId(data);
          console.log(`[DIAGNOSTIC CALLBACK] sendOtp success callback fired: yes | reqId present: ${Boolean(validReqId)}`);
          setIsSending(false);
          inFlightSendRef.current = false;
          console.log('[DIAGNOSTIC STATE] inFlightSendRef transition: false');
          setOtpSent(true);
          setErrorMessage(null);
          setSuccessMessage('OTP sent successfully');

          if (validReqId) {
            setReqId(validReqId);
            reqIdRef.current = validReqId;
          }

          setResendTimer(rateLimitRes.cooldownSeconds || 45);
          setTimeout(() => {
            inputRefs.current[0]?.focus();
          }, 100);
        },
        (err: any) => {
          clearSendTimeout();
          console.error('[DIAGNOSTIC CALLBACK] sendOtp failure callback fired: yes | err present:', Boolean(err));
          setIsSending(false);
          inFlightSendRef.current = false;
          console.log('[DIAGNOSTIC STATE] inFlightSendRef transition: false');
          setErrorMessage("We couldn't send the OTP right now. Please try again shortly.");
        }
      );
    } catch (err: any) {
      clearSendTimeout();
      console.error('[DIAGNOSTIC PROMISE] Error in handleSendOtp:', err?.message || err);
      setIsSending(false);
      inFlightSendRef.current = false;
      console.log('[DIAGNOSTIC STATE] inFlightSendRef transition: false');
      setErrorMessage("We couldn't send the OTP right now. Please try again shortly.");
    }
  };

  // Auto-send effect for Customer Portal (guarded against infinite retries)
  useEffect(() => {
    if (
      autoSend &&
      !isVerified &&
      !otpSent &&
      !isSending &&
      isValidTarget &&
      !inFlightSendRef.current &&
      !autoSendAttemptedRef.current
    ) {
      handleSendOtp();
    }
  }, [autoSend, isVerified, otpSent, isSending, isValidTarget]);

  // Handle Resend OTP via window.retryOtp
  const handleResendOtp = async () => {
    console.log(`[DIAGNOSTIC FLOW] handleResendOtp started | authMode: ${isEmailMode ? 'EMAIL' : 'MOBILE'} | inFlightSendRef: ${inFlightSendRef.current}`);
    if (resendTimer > 0 || isResending || inFlightSendRef.current) return;

    console.log('[OTP SEND] explicit resend action received for:', targetIdentifier);
    inFlightSendRef.current = true;
    console.log('[DIAGNOSTIC STATE] inFlightSendRef transition: true');
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsResending(true);

    let resendTimeoutId: any = null;
    const clearResendTimeout = () => {
      if (resendTimeoutId) {
        clearTimeout(resendTimeoutId);
        resendTimeoutId = null;
      }
    };

    try {
      // 1. Check server-side rate limits
      const rateLimitRes = await checkAndRecordOtpSendRateLimit({
        channel: isEmailMode ? 'email' : 'mobile',
        identifier: targetIdentifier
      });
      console.log(`[DIAGNOSTIC PROMISE] checkAndRecordOtpSendRateLimit resolved in handleResendOtp | allowed: ${rateLimitRes.allowed}`);
      if (!rateLimitRes.allowed) {
        setIsResending(false);
        inFlightSendRef.current = false;
        console.log('[DIAGNOSTIC STATE] inFlightSendRef transition: false');
        if (rateLimitRes.retryAfterSeconds && rateLimitRes.retryAfterSeconds <= 45) {
          setResendTimer(rateLimitRes.retryAfterSeconds);
          setErrorMessage(
            `Please wait ${rateLimitRes.retryAfterSeconds} second${rateLimitRes.retryAfterSeconds > 1 ? 's' : ''} before requesting another OTP.`
          );
        } else {
          setErrorMessage(
            rateLimitRes.error || 'Too many OTP requests. Please wait a few minutes and try again.'
          );
          if (rateLimitRes.retryAfterSeconds) {
            setResendTimer(rateLimitRes.retryAfterSeconds);
          }
        }
        return;
      }

      // 2. Trigger MSG91 resend
      const win = await ensureMsg91Initialized({
        hideMethod: isEmailMode ? 'mobile' : 'email'
      });
      console.log(`[DIAGNOSTIC PROMISE] ensureMsg91Initialized resolved in handleResendOtp | retryOtp present: ${typeof win.retryOtp === 'function'}`);

      if (typeof win.retryOtp !== 'function') {
        setIsResending(false);
        inFlightSendRef.current = false;
        console.log('[DIAGNOSTIC STATE] inFlightSendRef transition: false');
        throw new Error('MSG91 retryOtp method not available on window.');
      }

      const channel = isEmailMode ? '3' : '11';
      const validReqId = reqIdRef.current || (reqId ? parseReqId(reqId) : null);

      resendTimeoutId = setTimeout(() => {
        console.warn('[DIAGNOSTIC CALLBACK] retryOtp timeout fired: yes');
        if (inFlightSendRef.current) {
          setIsResending(false);
          inFlightSendRef.current = false;
          console.log('[DIAGNOSTIC STATE] inFlightSendRef transition: false');
          setErrorMessage('We could not confirm that the verification code was resent. Please try again.');
        }
      }, 15000);

      const onResendSuccess = (data: any) => {
        clearResendTimeout();
        const newReqId = parseReqId(data);
        console.log(`[DIAGNOSTIC CALLBACK] retryOtp success callback fired: yes | reqId present: ${Boolean(newReqId)}`);
        setIsResending(false);
        inFlightSendRef.current = false;
        console.log('[DIAGNOSTIC STATE] inFlightSendRef transition: false');
        setOtpDigits(['', '', '', '']);
        setResendTimer(rateLimitRes.cooldownSeconds || 45);
        setErrorMessage(null);
        setSuccessMessage('OTP resent successfully');
        if (newReqId) {
          setReqId(newReqId);
          reqIdRef.current = newReqId;
        }
        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 100);
      };

      const onResendFailure = (err: any) => {
        clearResendTimeout();
        console.error('[DIAGNOSTIC CALLBACK] retryOtp failure callback fired: yes | err present:', Boolean(err));
        setIsResending(false);
        inFlightSendRef.current = false;
        console.log('[DIAGNOSTIC STATE] inFlightSendRef transition: false');
        setErrorMessage("We couldn't resend the OTP right now. Please try again shortly.");
      };

      console.log(`[DIAGNOSTIC SDK CALL] window.retryOtp called | channel: ${channel} | reqId present: ${Boolean(validReqId)}`);
      if (validReqId) {
        win.retryOtp(channel, onResendSuccess, onResendFailure, validReqId);
      } else {
        win.retryOtp(channel, onResendSuccess, onResendFailure);
      }
    } catch (err: any) {
      clearResendTimeout();
      console.error('[DIAGNOSTIC PROMISE] Error in handleResendOtp:', err?.message || err);
      setIsResending(false);
      inFlightSendRef.current = false;
      console.log('[DIAGNOSTIC STATE] inFlightSendRef transition: false');
      setErrorMessage("We couldn't resend the OTP right now. Please try again shortly.");
    }
  };

  // Handle Verify OTP via window.verifyOtp
  const handleVerifyOtp = async (codeToVerify?: string) => {
    console.log(`[DIAGNOSTIC FLOW] handleVerifyOtp started | authMode: ${isEmailMode ? 'EMAIL' : 'MOBILE'}`);
    const code = codeToVerify || otpDigits.join('');
    if (code.length !== 4) {
      setErrorMessage('Please enter complete 4-digit OTP.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsVerifying(true);

    try {
      const win = await ensureMsg91Initialized({
        hideMethod: isEmailMode ? 'mobile' : 'email'
      });
      console.log(`[DIAGNOSTIC PROMISE] ensureMsg91Initialized resolved in handleVerifyOtp | verifyOtp present: ${typeof win.verifyOtp === 'function'}`);

      if (typeof win.verifyOtp !== 'function') {
        throw new Error('MSG91 verifyOtp method not available.');
      }

      console.log(`[DIAGNOSTIC SDK CALL] window.verifyOtp called | reqId present: ${Boolean(reqIdRef.current || reqId)}`);
      win.verifyOtp(
        code,
        (data: any) => {
          console.log('[DIAGNOSTIC CALLBACK] verifyOtp success callback fired: yes');
          const accessToken = extractAccessToken(data);
          console.log(`[DIAGNOSTIC] accessToken extracted from callback: ${Boolean(accessToken)}`);

          if (!accessToken) {
            console.error('[MSG91] Unable to extract valid access token from verifyOtp response:', data);
            setIsVerifying(false);
            setErrorMessage('OTP verification could not be completed. Please try again.');
            return;
          }

          // Verify access token with server
          verifyMsg91AccessTokenOnServer(accessToken, targetIdentifier, { loginChallenge, purpose })
            .then((res) => {
              console.log(`[DIAGNOSTIC PROMISE] verifyMsg91AccessTokenOnServer resolved | success: ${res.success}`);
              if (res.success) {
                console.log('[MSG91] backend verification success');
                setErrorMessage(null);
                setSuccessMessage(null);
                setOtpDigits(['', '', '', '']);
                onVerified(
                  res.email || res.mobile || targetIdentifier,
                  res.sessionToken || res.token || res.verificationToken || undefined,
                  res.verifiedCustomerSessionId || undefined,
                  res.profile || undefined
                );
              } else {
                console.error('[MSG91] Backend verification failed:', res.error);
                setErrorMessage(res.error || 'OTP verification could not be completed. Please try again.');
              }
            })
            .catch((serverErr) => {
              console.error('[DIAGNOSTIC PROMISE] Error in server token verification:', serverErr?.message || serverErr);
              setErrorMessage('OTP verification could not be completed. Please try again.');
            })
            .finally(() => {
              setIsVerifying(false);
            });
        },
        (err: any) => {
          console.error('[DIAGNOSTIC CALLBACK] verifyOtp failure callback fired: yes | err present:', Boolean(err));
          setIsVerifying(false);
          const msg = String(err?.message || err?.description || '').toLowerCase();
          if (msg.includes('invalid') || msg.includes('incorrect') || msg.includes('wrong')) {
            setErrorMessage('Incorrect OTP. Please check and try again.');
          } else if (msg.includes('expire')) {
            setErrorMessage('OTP has expired. Please request a new OTP.');
          } else {
            setErrorMessage('Incorrect OTP. Please check and try again.');
          }
        },
        reqIdRef.current || reqId || undefined
      );
    } catch (err: any) {
      console.error('[DIAGNOSTIC PROMISE] Error in handleVerifyOtp:', err?.message || err);
      setIsVerifying(false);
      setErrorMessage('OTP verification could not be completed. Please try again.');
    }
  };

  // OTP Input handlers
  const handleOtpInputChange = (index: number, value: string) => {
    const cleanVal = value.replace(/\D/g, '');
    const newDigits = [...otpDigits];

    if (!cleanVal) {
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    newDigits[index] = cleanVal.slice(-1);
    setOtpDigits(newDigits);

    if (index < 3) {
      inputRefs.current[index + 1]?.focus();
    } else {
      const fullCode = newDigits.join('');
      if (fullCode.length === 4) {
        handleVerifyOtp(fullCode);
      }
    }
  };

  const handleOtpInputKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        const newDigits = [...otpDigits];
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleOtpInputPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;

    const newDigits = ['', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setOtpDigits(newDigits);

    const nextIndex = Math.min(pasted.length, 3);
    inputRefs.current[nextIndex]?.focus();

    if (pasted.length === 4) {
      handleVerifyOtp(pasted);
    }
  };

  if (!isEmailMode && country !== 'India') {
    console.log('[DIAGNOSTIC RENDER] render branch selected: NULL (non-Indian phone mode)');
    return null;
  }

  const selectedRenderBranch = isVerified
    ? 'VERIFIED'
    : !otpSent
    ? (isSending ? 'SEND_OTP_LOADING' : 'SEND_OTP_BUTTON')
    : 'OTP_INPUT_BOXES';

  console.log(
    `[DIAGNOSTIC RENDER] render branch selected: ${selectedRenderBranch} | authMode: ${
      isEmailMode ? 'EMAIL' : 'MOBILE'
    } | isSending: ${isSending ? 'yes' : 'no'} | otpSent: ${
      otpSent ? 'yes' : 'no'
    } | isResending: ${isResending ? 'yes' : 'no'} | isVerifying: ${
      isVerifying ? 'yes' : 'no'
    } | reqId present: ${Boolean(reqIdRef.current || reqId)}`
  );

  return (
    <div className="mt-2 space-y-2 font-sans">
      {isVerified ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <div className="flex-1">
            <span className="font-bold">✓ {isEmailMode ? 'Email Address' : 'Mobile Number'} Verified</span> ({displayTarget})
          </div>
          {onResetVerification && (
            <button
              type="button"
              onClick={onResetVerification}
              className="text-[10px] text-emerald-700 underline hover:text-emerald-900 ml-auto font-medium cursor-pointer"
            >
              Change
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {!otpSent ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={!isValidTarget || isSending || resendTimer > 0}
                className={`px-3.5 py-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  isValidTarget && !isSending && resendTimer === 0
                    ? 'bg-[#1F1B16] hover:bg-[#B85C38] text-white shadow-sm cursor-pointer'
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending OTP...</span>
                  </>
                ) : resendTimer > 0 ? (
                  <span>Please wait {resendTimer}s</span>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Send OTP</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="p-3 bg-stone-50 border border-[#C9B79C]/30 rounded-md space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#1F1B16] tracking-wider uppercase text-[11px]">
                  OTP VERIFICATION CODE
                </span>
                <span className="text-[11px] text-stone-500">
                  Sent to {displayTarget}
                </span>
              </div>

              {/* 4 Digit OTP Inputs */}
              <div className="flex items-center justify-center gap-2.5 py-1">
                {[0, 1, 2, 3].map((index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={otpDigits[index] || ''}
                    onChange={(e) => handleOtpInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpInputKeyDown(index, e)}
                    onPaste={handleOtpInputPaste}
                    disabled={isVerifying}
                    className="w-11 h-12 text-center text-lg font-bold font-mono border rounded-md border-[#C9B79C]/60 focus:border-[#1F1B16] focus:ring-1 focus:ring-[#1F1B16] focus:outline-none bg-white text-[#1F1B16] shadow-xs transition-all disabled:bg-stone-100"
                  />
                ))}
              </div>

              {/* Actions & Resend */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200/60">
                <div className="text-[11px] text-stone-500">
                  {resendTimer > 0 ? (
                    <span className="font-medium text-stone-600">
                      Resend OTP in <strong className="font-mono text-[#1F1B16]">{resendTimer}s</strong>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isResending || isVerifying}
                      className="text-[#B85C38] hover:text-[#1F1B16] font-semibold underline disabled:opacity-50 cursor-pointer"
                    >
                      {isResending ? 'Sending...' : 'Didn’t receive OTP? Resend OTP'}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleVerifyOtp()}
                  disabled={otpDigits.join('').length !== 4 || isVerifying}
                  className="px-4 py-1.5 bg-[#1F1B16] hover:bg-[#B85C38] text-white font-bold rounded text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Verify OTP</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {successMessage && !errorMessage && (
            <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
