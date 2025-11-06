import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { getAllPosts, getPostById, createPost } from "@/lib/db";

// GET - Fetch all posts or a specific post
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get("uuid");

    if (uuid) {
      const post = await getPostById(uuid);
      if (!post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }
      // Transform to match frontend expectations (snake_case -> camelCase)
      return NextResponse.json({
        id: post.id,
        title: post.title,
        content: post.content,
        walletAddress: post.wallet_address,
        signature: post.signature,
        message: post.message,
        paymentAmount: post.payment_amount,
        paymentCurrency: post.payment_currency,
        mediaFiles: post.media_files,
        createdAt: post.created_at,
      });
    }

    const posts = await getAllPosts();
    // Transform all posts to match frontend expectations
    return NextResponse.json(
      posts.map((post) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        walletAddress: post.wallet_address,
        signature: post.signature,
        message: post.message,
        paymentAmount: post.payment_amount,
        paymentCurrency: post.payment_currency,
        mediaFiles: post.media_files,
        createdAt: post.created_at,
      }))
    );
  } catch (error) {
    console.error("Error reading posts:", error);
    return NextResponse.json(
      { error: "Failed to read posts" },
      { status: 500 },
    );
  }
}

// POST - Create a new post
export async function POST(request: NextRequest) {
  try {
    const postData = await request.json();

    // Verify signature
    if (!postData.walletAddress || !postData.signature || !postData.message) {
      return NextResponse.json(
        { error: "Missing signature data" },
        { status: 400 },
      );
    }

    try {
      const publicKey = new PublicKey(postData.walletAddress);
      const message = new TextEncoder().encode(postData.message);
      const signature = Uint8Array.from(
        Buffer.from(postData.signature, "base64"),
      );

      // Solana message signing uses a specific format: prefix + message
      // The wallet adapter should handle this, but we verify the raw signature
      // Verify the signature using Ed25519
      const isValid = nacl.sign.detached.verify(
        message,
        signature,
        publicKey.toBytes(),
      );

      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 },
        );
      }
    } catch (error) {
      console.error("Signature verification error:", error);
      return NextResponse.json(
        { error: "Failed to verify signature" },
        { status: 400 },
      );
    }

    // Transform frontend data (camelCase) to database format (snake_case)
    const dbPost = await createPost({
      id: crypto.randomUUID(),
      title: postData.title,
      content: postData.content,
      wallet_address: postData.walletAddress,
      signature: postData.signature,
      message: postData.message,
      payment_amount: postData.paymentAmount,
      payment_currency: postData.paymentCurrency,
      media_files: postData.mediaFiles,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, id: dbPost.id });
  } catch (error) {
    console.error("Error saving post:", error);
    return NextResponse.json({ error: "Failed to save post" }, { status: 500 });
  }
}
