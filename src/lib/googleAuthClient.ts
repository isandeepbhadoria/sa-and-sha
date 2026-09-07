import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from './firebase';

export interface GoogleAuthServerResponse {
  success: boolean;
  sessionToken?: string;
  verificationToken?: string;
  profileId?: string;
  customerId?: string;
  isNewCustomer?: boolean;
  profile?: any;
  error?: string;
  code?: string;
  registration_required?: boolean;
  registration_token?: string;
  verified_email?: string;
  google_name?: string;
  suggested_first_name?: string;
  suggested_last_name?: string;
}

export async function authenticateWithGoogle(): Promise<GoogleAuthServerResponse> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    // Open Google Popup Authentication
    const userCredential = await signInWithPopup(auth, provider);
    const idToken = await userCredential.user.getIdToken(true);

    if (!idToken) {
      throw new Error("Failed to retrieve Google authentication token.");
    }

    // Send token to backend endpoint for server-side verification & matching
    const response = await fetch('/api/customer/auth/google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ idToken })
    });

    const data: any = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || "Google authentication verification failed.",
        code: data.code,
        registration_required: data.registration_required,
        registration_token: data.registration_token,
        verified_email: data.verified_email,
        google_name: data.google_name,
        suggested_first_name: data.suggested_first_name,
        suggested_last_name: data.suggested_last_name
      };
    }

    return data;
  } catch (err: any) {
    console.error("Google Authentication Client Error:", err);
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      return {
        success: false,
        error: "Google sign-in window was closed before completing."
      };
    }
    return {
      success: false,
      error: err.message || "Google sign-in failed. Please try again or use mobile OTP."
    };
  }
}
