import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Cookie, ShieldCheck } from 'lucide-react';
import { useCookieConsent } from '../context/CookieConsentContext';

const ToggleRow: React.FC<{
  title: string;
  description: string;
  checked: boolean;
  locked?: boolean;
  onChange?: (next: boolean) => void;
  id: string;
}> = ({ title, description, checked, locked, onChange, id }) => (
  <div className="flex items-start justify-between gap-4 py-3 border-b border-[#E5D2BC]/10 last:border-b-0">
    <div className="pr-2">
      <p className="font-sans font-bold text-xs uppercase tracking-[0.12em] text-[#FBF6EE]">
        {title}
        {locked && (
          <span className="ml-2 normal-case font-medium tracking-normal text-[10px] text-[#E5D2BC]/70">
            (Always active)
          </span>
        )}
      </p>
      <p className="font-sans text-[11px] text-[#FBF6EE]/60 leading-relaxed mt-1">{description}</p>
    </div>
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={title}
      disabled={locked}
      onClick={() => onChange && onChange(!checked)}
      className={`relative shrink-0 w-10 h-6 rounded-full transition-colors duration-200 ${
        checked ? 'bg-[#B08D57]' : 'bg-[#FBF6EE]/20'
      } ${locked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[#FBF6EE] shadow transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

export const CookieConsentBanner: React.FC = () => {
  const { showBanner, consent, acceptAll, rejectNonEssential, savePreferences } = useCookieConsent();
  const [isManaging, setIsManaging] = useState(false);
  const [draftAnalytics, setDraftAnalytics] = useState(consent.analytics);
  const [draftMarketing, setDraftMarketing] = useState(consent.marketing);

  if (!showBanner) return null;

  const openManage = () => {
    setDraftAnalytics(consent.analytics);
    setDraftMarketing(consent.marketing);
    setIsManaging(true);
  };

  const handleSave = () => {
    savePreferences(draftAnalytics, draftMarketing);
    setIsManaging(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="cookie-consent-banner"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        id="cookie-consent-banner"
        role="dialog"
        aria-live="polite"
        aria-label="Cookie consent"
        className="fixed bottom-0 left-0 right-0 z-[110] bg-[#2A211C] text-[#FBF6EE] border-t border-[#E5D2BC]/20 shadow-2xl"
      >
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-5 md:py-6">
          {!isManaging ? (
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
              <div className="flex items-start gap-3 flex-1">
                <div className="bg-[#B08D57]/15 text-[#B08D57] p-2 rounded-full shrink-0">
                  <Cookie className="w-5 h-5" />
                </div>
                <p className="font-sans text-xs md:text-[13px] text-[#FBF6EE]/80 leading-relaxed">
                  We use cookies to improve your experience, remember your cart, and (with your
                  permission) understand site traffic and personalize ads. See our{' '}
                  <Link
                    to="/privacy-policy"
                    className="underline underline-offset-2 text-[#E5D2BC] hover:text-white transition-colors"
                  >
                    Privacy Policy
                  </Link>{' '}
                  for details.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  id="cookie-consent-manage-btn"
                  onClick={openManage}
                  className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2.5 rounded border border-[#E5D2BC]/30 text-[#FBF6EE] hover:border-[#E5D2BC] hover:bg-white/5 transition-colors"
                >
                  Manage Preferences
                </button>
                <button
                  type="button"
                  id="cookie-consent-reject-btn"
                  onClick={rejectNonEssential}
                  className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2.5 rounded border border-[#E5D2BC]/30 text-[#FBF6EE] hover:border-[#E5D2BC] hover:bg-white/5 transition-colors"
                >
                  Reject Non-Essential
                </button>
                <button
                  type="button"
                  id="cookie-consent-accept-btn"
                  onClick={acceptAll}
                  className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2.5 rounded bg-[#B08D57] hover:bg-[#B08D57]/90 text-white transition-colors"
                >
                  Accept All
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <h3 className="font-serif font-bold text-base md:text-lg text-[#FBF6EE]">
                    Cookie Preferences
                  </h3>
                  <p className="font-sans text-[11px] text-[#FBF6EE]/60 mt-1 max-w-xl">
                    Choose which cookies we're allowed to use. You can change this anytime from the
                    "Cookie Preferences" link in our footer.
                  </p>
                </div>
                <ShieldCheck className="w-5 h-5 text-[#B08D57] shrink-0 mt-1 hidden sm:block" />
              </div>

              <div className="mt-3 divide-y divide-[#E5D2BC]/10">
                <ToggleRow
                  id="cookie-toggle-necessary"
                  title="Necessary"
                  description="Required for core site features like your cart, checkout, and login — cannot be turned off."
                  checked={true}
                  locked
                />
                <ToggleRow
                  id="cookie-toggle-analytics"
                  title="Analytics"
                  description="Google Analytics helps us understand how visitors use the site so we can improve it."
                  checked={draftAnalytics}
                  onChange={setDraftAnalytics}
                />
                <ToggleRow
                  id="cookie-toggle-marketing"
                  title="Marketing"
                  description="Meta (Facebook/Instagram) Pixel — measures ad performance and lets us show relevant ads, like reminders about items left in your cart."
                  checked={draftMarketing}
                  onChange={setDraftMarketing}
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 mt-5">
                <button
                  type="button"
                  id="cookie-consent-back-btn"
                  onClick={() => setIsManaging(false)}
                  className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2.5 rounded border border-[#E5D2BC]/30 text-[#FBF6EE] hover:border-[#E5D2BC] hover:bg-white/5 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  id="cookie-consent-save-btn"
                  onClick={handleSave}
                  className="font-sans font-bold text-[11px] uppercase tracking-widest px-5 py-2.5 rounded bg-[#B08D57] hover:bg-[#B08D57]/90 text-white transition-colors"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
