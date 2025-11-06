/**
 * Supported payment kinds endpoint
 * GET /api/facilitator/supported
 *
 * This endpoint is required by x402 middleware to discover which payment methods
 * the facilitator supports. This implements the x402 protocol format.
 */

import { NextResponse } from "next/server";
import { X402_CONFIG } from "@/lib/x402-config";

export async function GET() {
  // Return x402-compliant response
  return NextResponse.json({
    kinds: [
      {
        scheme: "exact",
        network: X402_CONFIG.NETWORK,
      },
    ],
  });
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
