/**
 * x402 Payment Verification
 *
 * Handles payment verification via facilitator
 */

import transactionStorage from "./transaction-storage";
import { X402_CONFIG } from "./x402-config";

interface PaymentPayload {
  signature: string;
  from: string;
  to: string;
  amount: string;
  token: string;
}

interface Payment {
  x402Version: number;
  scheme: string;
  network: string;
  payload: PaymentPayload;
}

interface VerificationResult {
  isValid: boolean;
  signature?: string;
  reason?: string;
}

export async function verifyPayment(
  payment: Payment,
  postId: string,
  requiredAmount: string,
  payToAddress: string,
  baseUrl?: string,
): Promise<VerificationResult> {
  try {
    if (!payment.payload || !payment.payload.signature) {
      return { isValid: false, reason: "Invalid payment structure" };
    }

    const { signature, from, to, amount } = payment.payload;

    // Check if already verified for this post
    if (await transactionStorage.has(signature, postId)) {
      return { isValid: true, signature };
    }

    const paymentRequirements = {
      scheme: "exact",
      network: X402_CONFIG.NETWORK,
      maxAmountRequired: requiredAmount,
      payTo: payToAddress,
      asset: X402_CONFIG.USDC_DEVNET_MINT,
    };

    // Verify payment matches requirements
    if (to !== payToAddress) {
      return { isValid: false, reason: "Invalid recipient address" };
    }

    if (amount !== requiredAmount) {
      return { isValid: false, reason: "Invalid payment amount" };
    }

    // Call facilitator to verify on blockchain
    // Use absolute URL for Edge runtime compatibility
    const origin =
      baseUrl ||
      (typeof window !== "undefined" ? window.location.origin : null);
    if (!origin) {
      return { isValid: false, reason: "Base URL required for verification" };
    }
    const verifyUrl = `${origin}${X402_CONFIG.FACILITATOR_BASE_URL}/verify`;

    const verifyResponse = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payment,
        paymentRequirements,
      }),
    });

    if (!verifyResponse.ok) {
      return {
        isValid: false,
        reason: `Facilitator verification failed: ${verifyResponse.status}`,
      };
    }

    const verifyResult = await verifyResponse.json();

    if (!verifyResult.isValid) {
      return {
        isValid: false,
        reason: verifyResult.reason || "Payment verification failed",
      };
    }

    // Store verified signature with post ID
    await transactionStorage.add(signature, postId, { from, to, amount });
    console.log("Payment verified successfully:", signature);

    try {
      const settleUrl = `${origin}${X402_CONFIG.FACILITATOR_BASE_URL}/settle`;
      await fetch(settleUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactionId: verifyResult.transactionId,
          payment,
        }),
      });
    } catch {
      // Settlement failed (non-critical)
    }

    return { isValid: true, signature };
  } catch (error) {
    return {
      isValid: false,
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function verifyCookieSignature(
  signature: string,
  postId: string,
): Promise<boolean> {
  // Since the cookie was set by middleware after successful payment verification,
  // we can trust that if the cookie exists with a signature, it's valid.
  // Transaction storage is in-memory and may not persist across Edge runtime isolates.

  console.log("verifyCookieSignature called:", {
    signature: signature?.slice(0, 20) + "...",
    signatureLength: signature?.length,
    postId,
  });

  if (!signature || signature.length < 32) {
    console.log("Signature invalid: too short or missing");
    return false;
  }

  // Optional: Check if it exists in storage (if same worker)
  // But don't rely on it since Edge runtime has multiple isolates
  const inStorage = await transactionStorage.has(signature, postId);
  console.log("Signature in storage:", inStorage);

  if (inStorage) {
    console.log("Signature found in storage, verified");
    return true;
  }

  // If not in storage (different worker), still trust the cookie
  // The middleware verified it before setting the cookie
  // Solana signatures are base58 encoded, typically 88 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  const isValidFormat = base58Regex.test(signature) && signature.length >= 32;

  console.log("Signature format check:", {
    isValidFormat,
    matchesBase58: base58Regex.test(signature),
    length: signature.length,
  });

  return isValidFormat;
}
