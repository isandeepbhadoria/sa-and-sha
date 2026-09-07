import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { authenticateWithGoogle, GoogleAuthServerResponse } from '../lib/googleAuthClient';

interface GoogleSignInButtonProps {
  onSuccess: (res: GoogleAuthServerResponse) => void;
  onError: (errorMsg: string) => void;
  onAccountNotFound?: (res: GoogleAuthServerResponse) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  onAccountNotFound,
  label = "Continue with Google",
  className = "",
  disabled = false
}) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      const result = await authenticateWithGoogle();
      if (result.success) {
        onSuccess(result);
      } else if (result.code === 'ACCOUNT_NOT_FOUND' || result.registration_required) {
        if (onAccountNotFound) {
          onAccountNotFound(result);
        } else {
          onError("Account not found. Please create an account to sign in.");
        }
      } else {
        onError(result.error || "Google sign-in failed. Please try again.");
      }
    } catch (err: any) {
      onError(err.message || "An unexpected error occurred during Google sign-in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || disabled}
      className={`w-full py-3 px-4 bg-white border border-stone-300 hover:bg-stone-50 active:bg-stone-100 text-stone-800 font-medium text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-1 ${className}`}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-stone-600" />
          <span>Verifying Google Account...</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
};
