import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { X402_CONFIG } from "./lib/x402-config";
import { verifyPayment, verifyCookieSignature } from "./lib/x402-verification";

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Only protect /post routes (not /api routes)
  if (!pathname.startsWith("/post/") || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Extract post UUID from pathname
  const postId = pathname.split("/post/")[1]?.split("/")[0];
  if (!postId) {
    return NextResponse.next();
  }

  // Fetch post data to get payment requirements
  let post;
  try {
    const baseUrl = request.nextUrl.origin;
    const postResponse = await fetch(`${baseUrl}/api/posts?uuid=${postId}`, {
      headers: {
        Cookie: request.headers.get("Cookie") || "",
      },
    });

    if (!postResponse.ok) {
      // Post doesn't exist or invalid - let the page handle 404
      return NextResponse.next();
    }

    post = await postResponse.json();

    // Check if post is valid and has payment requirements
    if (!post || !post.paymentAmount || !post.walletAddress) {
      // Post exists but no payment required - allow access
      return NextResponse.next();
    }
  } catch (error) {
    console.error("Error fetching post in middleware:", error);
    // On error, allow through and let page handle it
    return NextResponse.next();
  }

  // Check for payment cookie
  const cookieName = `${X402_CONFIG.COOKIE_NAME}_${postId}`;
  const paymentCookie = request.cookies.get(cookieName);

  if (paymentCookie?.value) {
    const isValid = await verifyCookieSignature(paymentCookie.value, postId);
    if (isValid) {
      return NextResponse.next(); // ✅ Already paid for this post
    }
  }

  // Check for payment header
  const paymentHeader = request.headers.get("X-PAYMENT");
  const acceptHeader = request.headers.get("Accept") || "";
  const userAgent = request.headers.get("User-Agent") || "";

  // For browser requests (HTML), let the page component handle payment UI
  // Only return JSON 402 for API/fetch requests
  const isBrowserRequest =
    acceptHeader.includes("text/html") ||
    (!acceptHeader.includes("application/json") &&
      userAgent.includes("Mozilla"));

  if (!paymentHeader) {
    if (isBrowserRequest) {
      // Let browser request through - React component will handle payment UI
      return NextResponse.next();
    } else {
      // No payment - return 402 JSON for API/fetch requests
      return NextResponse.json(
        {
          x402Version: 1,
          error: "Payment required",
          postId: postId,
          paymentAmount: post.paymentAmount,
          paymentCurrency: post.paymentCurrency,
          payTo: post.walletAddress,
          post: {
            id: post.id,
            title: post.title,
            content: "", // Don't send full content until paid
            walletAddress: post.walletAddress,
            paymentAmount: post.paymentAmount,
            paymentCurrency: post.paymentCurrency,
            createdAt: post.createdAt,
          },
        },
        { status: 402 },
      );
    }
  }

  // Verify payment
  try {
    const payment = JSON.parse(paymentHeader);

    // Convert payment amount to USDC amount (6 decimals)
    const requiredAmount = Math.round(
      parseFloat(post.paymentAmount) * 1000000,
    ).toString();

    const baseUrl = request.nextUrl.origin;
    const result = await verifyPayment(
      payment,
      postId,
      requiredAmount,
      post.walletAddress,
      baseUrl,
    );

    if (!result.isValid) {
      return NextResponse.json(
        {
          x402Version: 1,
          error: "Payment verification failed",
          reason: result.reason,
        },
        { status: 402 },
      );
    }

    // ✅ Payment verified - set cookie and grant access
    // If it's an API request (JSON), return JSON response
    // Otherwise return NextResponse.next() for HTML
    const wantsJson = acceptHeader.includes("application/json");

    if (wantsJson) {
      const jsonResponse = NextResponse.json(
        {
          success: true,
          message: "Payment verified",
          postId: postId,
        },
        { status: 200 },
      );
      jsonResponse.cookies.set(cookieName, result.signature!, {
        httpOnly: true,
        secure: X402_CONFIG.COOKIE_SECURE,
        sameSite: "lax",
        maxAge: X402_CONFIG.COOKIE_MAX_AGE,
        path: "/",
      });

      console.log("Payment verified, setting cookie (JSON response):", {
        cookieName,
        signature: result.signature?.slice(0, 20) + "...",
        postId,
      });

      return jsonResponse;
    }

    // HTML response
    const response = NextResponse.next();
    response.cookies.set(cookieName, result.signature!, {
      httpOnly: true,
      secure: X402_CONFIG.COOKIE_SECURE,
      sameSite: "lax",
      maxAge: X402_CONFIG.COOKIE_MAX_AGE,
      path: "/",
    });

    console.log("Payment verified, setting cookie (HTML response):", {
      cookieName,
      signature: result.signature?.slice(0, 20) + "...",
      postId,
    });

    return response;
  } catch (error) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      {
        x402Version: 1,
        error: "Payment verification failed",
        reason: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 402 },
    );
  }
}

export const config = {
  matcher: ["/post/:path*"],
};
