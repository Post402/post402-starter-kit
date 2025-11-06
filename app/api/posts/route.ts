import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

const POSTS_DIR = path.join(process.cwd(), "data", "posts");
const POSTS_FILE = path.join(POSTS_DIR, "posts.json");

// Ensure directory exists
async function ensureDirectory() {
  if (!existsSync(POSTS_DIR)) {
    await mkdir(POSTS_DIR, { recursive: true });
  }
}

// GET - Fetch all posts or a specific post
export async function GET(request: NextRequest) {
  try {
    await ensureDirectory();

    if (!existsSync(POSTS_FILE)) {
      return NextResponse.json([]);
    }

    const fileContent = await readFile(POSTS_FILE, "utf-8");
    const posts = JSON.parse(fileContent || "[]");

    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get("uuid");

    if (uuid) {
      const post = posts.find((p: any) => p.id === uuid);
      if (!post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }
      return NextResponse.json(post);
    }

    return NextResponse.json(posts);
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
    await ensureDirectory();

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

    // Generate UUID and add createdAt on the backend
    const post = {
      ...postData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    // Read existing posts
    let posts = [];
    if (existsSync(POSTS_FILE)) {
      const fileContent = await readFile(POSTS_FILE, "utf-8");
      posts = JSON.parse(fileContent || "[]");
    }

    // Add new post
    posts.push(post);

    // Write back to file
    await writeFile(POSTS_FILE, JSON.stringify(posts, null, 2), "utf-8");

    return NextResponse.json({ success: true, id: post.id });
  } catch (error) {
    console.error("Error saving post:", error);
    return NextResponse.json({ error: "Failed to save post" }, { status: 500 });
  }
}
