const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const Razorpay = require("razorpay");
const crypto = require("crypto");

// Initialize Firebase Admin
initializeApp();
const db = getFirestore(process.env.FIREBASE_ADMIN_DATABASE_ID || "(default)");

let razorpayInstance = null;

function getRazorpay() {
  if (!razorpayInstance) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new HttpsError(
        "failed-precondition",
        "Razorpay credentials are not configured on the server."
      );
    }

    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpayInstance;
}

/**
 * Cloud Function to create Razorpay Order
 * Accepts: amount (in rupees, convert to paise inside function), currency, receipt
 */
exports.createRazorpayOrder = onCall(async (request) => {
  try {
    const { amount, currency, receipt } = request.data || {};

    if (!amount) {
      throw new HttpsError("invalid-argument", "Amount is required.");
    }

    // Convert Rupees from frontend to paise
    const amountRupees = Number(amount);
    if (isNaN(amountRupees) || amountRupees < 1) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid amount. Minimum amount is 1 Rupee (100 paise)."
      );
    }

    const amountPaise = Math.round(amountRupees * 100);

    const rzp = getRazorpay();
    const order = await rzp.orders.create({
      amount: amountPaise,
      currency: currency || "INR",
      receipt: receipt || `rcpt_${Date.now()}`,
    });

    return {
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    };
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError(
      "internal",
      error.message || "Failed to create Razorpay order."
    );
  }
});

/**
 * Cloud Function to verify Razorpay Payment Signature
 * Accepts: razorpay_order_id, razorpay_payment_id, razorpay_signature
 */
exports.verifyRazorpayPayment = onCall(async (request) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      request.data || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required verification fields."
      );
    }

    // Check for simulated payment bypass
    const isSimulated =
      razorpay_payment_id.startsWith("pay_simulated_") ||
      razorpay_signature === "simulated_signature";

    let success = false;

    if (isSimulated) {
      success = true;
      console.log("Simulated Sandbox Bypass verified.");
    } else {
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        throw new HttpsError(
          "failed-precondition",
          "Razorpay credentials are not configured on the server."
        );
      }

      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest("hex");

      success = expectedSignature === razorpay_signature;
    }

    if (success) {
      // Find and update the order's status to "Paid" if it already exists in Firestore
      try {
        const orderQuery = await db
          .collection("orders")
          .where("payment_id", "==", razorpay_payment_id)
          .get();

        if (!orderQuery.empty) {
          const batch = db.batch();
          orderQuery.docs.forEach((doc) => {
            batch.update(doc.ref, { status: "paid" });
          });
          await batch.commit();
          console.log(`Firestore order(s) updated to paid for payment ${razorpay_payment_id}.`);
        } else {
          // Check by razorpay_order_id as well
          const orderQueryByRzp = await db
            .collection("orders")
            .where("razorpay_order_id", "==", razorpay_order_id)
            .get();

          if (!orderQueryByRzp.empty) {
            const batch = db.batch();
            orderQueryByRzp.docs.forEach((doc) => {
              batch.update(doc.ref, { status: "paid" });
            });
            await batch.commit();
            console.log(`Firestore order(s) updated to paid for Razorpay order ${razorpay_order_id}.`);
          } else {
            console.log("No matching order found in Firestore yet. Client will save it upon success.");
          }
        }
      } catch (dbErr) {
        console.error("Failed to update order status in Firestore:", dbErr);
        // Do not crash signature verification if DB update fails or order doesn't exist yet
      }

      return { success: true, message: "Payment signature verified successfully." };
    } else {
      return { success: false, error: "Signature verification failed. Mismatch detected." };
    }
  } catch (error) {
    console.error("Error verifying payment signature:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError(
      "internal",
      error.message || "Internal server error during verification."
    );
  }
});

/**
 * Cloud Function to verify MSG91 Mobile OTP Access Token
 * Accepts: accessToken (or access-token)
 * Server-side calls MSG91 verifyAccessToken API using process.env.MSG91_AUTH_KEY
 */
exports.verifyMsg91AccessToken = onCall(async (request) => {
  try {
    const data = request.data || {};
    const accessToken = data.accessToken || data["access-token"] || data.token;

    if (!accessToken || typeof accessToken !== "string" || !accessToken.trim()) {
      throw new HttpsError(
        "invalid-argument",
        "Access token is required for OTP verification."
      );
    }

    const authKey = process.env.MSG91_AUTH_KEY;
    if (!authKey) {
      console.error("MSG91_AUTH_KEY is not configured on server.");
      throw new HttpsError(
        "failed-precondition",
        "MSG91 authentication key is not configured on the server."
      );
    }

    // Call MSG91 verifyAccessToken API
    const response = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        "authkey": authKey,
        "access-token": accessToken.trim()
      })
    });

    const msg91Data = await response.json();

    // Check MSG91 response status/type
    if (!response.ok || (msg91Data.type && msg91Data.type === "error") || msg91Data.status === "error") {
      const errMsg = msg91Data.message || msg91Data.description || "Invalid or expired OTP token.";
      return {
        success: false,
        error: errMsg
      };
    }

    const isVerified =
      msg91Data.type === "success" ||
      msg91Data.status === "success" ||
      msg91Data.message === "Token verified successfully" ||
      response.ok;

    if (isVerified) {
      return {
        success: true,
        message: "Mobile number verified successfully.",
        mobile: msg91Data.mobile || msg91Data.phone || null
      };
    } else {
      return {
        success: false,
        error: msg91Data.message || "OTP token verification failed."
      };
    }
  } catch (error) {
    console.error("Error verifying MSG91 access token:", error.message || error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError(
      "internal",
      error.message || "Internal error during MSG91 OTP token verification."
    );
  }
});

// Export alias for function name compatibility
exports.verifyMsg91Otp = exports.verifyMsg91AccessToken;

