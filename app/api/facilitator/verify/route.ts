import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { X402_CONFIG } from "@/lib/x402-config";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payment, paymentRequirements } = body;

    if (!payment || !paymentRequirements) {
      return NextResponse.json(
        { isValid: false, reason: "Missing payment or paymentRequirements" },
        { status: 200 },
      );
    }

    const { payload } = payment;
    if (!payload || !payload.signature) {
      return NextResponse.json(
        { isValid: false, reason: "Missing signature in payment payload" },
        { status: 200 },
      );
    }

    const { signature, to, amount, token } = payload;

    if (to !== paymentRequirements.payTo) {
      return NextResponse.json(
        { isValid: false, reason: "Invalid payTo address" },
        { status: 200 },
      );
    }

    if (token !== paymentRequirements.asset) {
      return NextResponse.json(
        { isValid: false, reason: "Invalid token mint" },
        { status: 200 },
      );
    }

    if (amount !== paymentRequirements.maxAmountRequired) {
      return NextResponse.json(
        { isValid: false, reason: "Invalid amount" },
        { status: 200 },
      );
    }

    // Verify the transaction on-chain
    const connection = new Connection(X402_CONFIG.RPC_ENDPOINT, "confirmed");

    let transaction;
    try {
      transaction = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });
    } catch {
      return NextResponse.json(
        { isValid: false, reason: "Transaction not found" },
        { status: 200 },
      );
    }

    if (!transaction) {
      return NextResponse.json(
        { isValid: false, reason: "Transaction not found" },
        { status: 200 },
      );
    }

    if (transaction.meta?.err) {
      return NextResponse.json(
        { isValid: false, reason: "Transaction failed on-chain" },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        isValid: true,
        transactionId: signature,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { isValid: false, reason: "Internal server error" },
      { status: 500 },
    );
  }
}
