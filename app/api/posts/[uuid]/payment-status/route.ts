import { NextRequest, NextResponse } from "next/server";
import { X402_CONFIG } from "@/lib/x402-config";
import { verifyCookieSignature } from "@/lib/x402-verification";

export async function GET(
  request: NextRequest,
  { params }: { params: { uuid: string } },
) {
  try {
    const postId = params.uuid;

    // Check for payment cookie
    const cookieName = `${X402_CONFIG.COOKIE_NAME}_${postId}`;
    const paymentCookie = request.cookies.get(cookieName);

    console.log("Payment status check:", {
      postId,
      cookieName,
      hasCookie: !!paymentCookie,
      cookieValue: paymentCookie?.value?.slice(0, 20) + "...",
      allCookies: Array.from(request.cookies.getAll()).map((c) => c.name),
    });

    if (paymentCookie?.value) {
      const isValid = await verifyCookieSignature(paymentCookie.value, postId);
      console.log("Cookie verification result:", isValid);
      if (isValid) {
        return NextResponse.json({ hasPaid: true });
      }
    }

    return NextResponse.json({ hasPaid: false });
  } catch (error) {
    console.error("Error checking payment status:", error);
    return NextResponse.json({ hasPaid: false }, { status: 500 });
  }
}
