"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PublicKey, Connection, Transaction } from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletModal } from "@/components/wallet-modal";
import { Button } from "@/components/ui/button";
import nacl from "tweetnacl";
import { Input } from "@/components/ui/input";
import { X402_CONFIG } from "@/lib/x402-config";

interface Post {
  id: string;
  title: string;
  content: string;
  walletAddress?: string;
  signature?: string;
  message?: string;
  paymentAmount: string;
  paymentCurrency: string;
  mediaFiles: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    preview: string;
    textContent?: string;
  }>;
  createdAt: string;
}

const USDC_MINT = X402_CONFIG.USDC_DEVNET_MINT;
const RPC_ENDPOINT = X402_CONFIG.RPC_ENDPOINT;

export default function PostPage() {
  const params = useParams();
  const uuid = params.uuid as string;
  const { connected, publicKey, sendTransaction } = useWallet();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [editWalletAddress, setEditWalletAddress] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editSignature, setEditSignature] = useState("");

  // Payment state
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<{
    paymentAmount: string;
    paymentCurrency: string;
    payTo: string;
  } | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);

  useEffect(() => {
    // Fetch post from API
    // Note: Middleware already checked cookie when page loaded
    // If we're seeing this page, middleware either allowed access (cookie valid) or let through for payment UI
    const fetchPost = async () => {
      try {
        const apiResponse = await fetch(`/api/posts?uuid=${uuid}`, {
          credentials: "include",
        });

        if (apiResponse.ok) {
          const data = await apiResponse.json();

          // Check if post has payment requirements
          if (data.paymentAmount && data.walletAddress) {
            // Check payment status via API endpoint that can read httpOnly cookie
            const paymentCheckResponse = await fetch(
              `/api/posts/${uuid}/payment-status`,
              {
                credentials: "include",
              },
            );

            if (paymentCheckResponse.ok) {
              const paymentStatus = await paymentCheckResponse.json();
              console.log("Payment status response:", paymentStatus);

              if (paymentStatus.hasPaid) {
                // Already paid - show full content
                console.log("User has paid, showing full content");
                setPost(data);
                setPaymentRequired(false);
              } else {
                // Payment required
                console.log("User has not paid, showing payment UI");
                setPaymentRequired(true);
                setPaymentInfo({
                  paymentAmount: data.paymentAmount,
                  paymentCurrency: data.paymentCurrency,
                  payTo: data.walletAddress,
                });
                setPost({
                  ...data,
                  content: "", // Hide content until paid
                });
              }
            } else {
              // Assume payment required if check fails
              console.log(
                "Payment status check failed, assuming payment required",
              );
              setPaymentRequired(true);
              setPaymentInfo({
                paymentAmount: data.paymentAmount,
                paymentCurrency: data.paymentCurrency,
                payTo: data.walletAddress,
              });
              setPost({
                ...data,
                content: "", // Hide content until paid
              });
            }
          } else {
            // No payment required
            setPost(data);
            setPaymentRequired(false);
          }
        } else if (apiResponse.status === 404) {
          setPost(null);
        }
      } catch (error) {
        console.error("Error fetching post:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [uuid]);

  // Handle keyboard navigation for carousel
  useEffect(() => {
    if (previewIndex === null || !post) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreviewIndex(null);
      } else if (e.key === "ArrowLeft") {
        setPreviewIndex((current) => {
          if (current === null || current <= 0) return current;
          return current - 1;
        });
      } else if (e.key === "ArrowRight") {
        setPreviewIndex((current) => {
          if (current === null || current >= post.mediaFiles.length - 1)
            return current;
          return current + 1;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewIndex, post]);

  const verifySignature = (
    walletAddress: string,
    message: string,
    signature: string,
  ) => {
    if (!walletAddress || !signature || !message) {
      return false;
    }

    try {
      const publicKey = new PublicKey(walletAddress);
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = Uint8Array.from(Buffer.from(signature, "base64"));

      return nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKey.toBytes(),
      );
    } catch (error) {
      console.error("Verification error:", error);
      return false;
    }
  };

  const handleVerify = () => {
    if (!post?.walletAddress || !post?.signature || !post?.message) {
      setIsVerified(false);
      setShowVerifyModal(true);
      return;
    }

    // Initialize edit fields with original values
    setEditWalletAddress(post.walletAddress);
    setEditMessage(post.message);
    setEditSignature(post.signature);

    // Verify with original values
    const isValid = verifySignature(
      post.walletAddress,
      post.message,
      post.signature,
    );
    setIsVerified(isValid);
    setShowVerifyModal(true);
  };

  // Re-verify when any field changes
  useEffect(() => {
    if (showVerifyModal && editWalletAddress && editMessage && editSignature) {
      const isValid = verifySignature(
        editWalletAddress,
        editMessage,
        editSignature,
      );
      setIsVerified(isValid);
    }
  }, [editWalletAddress, editMessage, editSignature, showVerifyModal]);

  const handlePayment = async () => {
    if (!connected || !publicKey || !paymentInfo) {
      setShowWalletModal(true);
      return;
    }

    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      const connection = new Connection(RPC_ENDPOINT, "confirmed");
      const usdcMint = new PublicKey(USDC_MINT);
      const recipientPubkey = new PublicKey(paymentInfo.payTo);
      const senderPubkey = publicKey;

      // Convert payment amount to USDC amount (6 decimals)
      const amount = Math.round(
        parseFloat(paymentInfo.paymentAmount) * 1000000,
      );

      // Get associated token account addresses
      const senderTokenAccount = await getAssociatedTokenAddress(
        usdcMint,
        senderPubkey,
      );

      const recipientTokenAccount = await getAssociatedTokenAddress(
        usdcMint,
        recipientPubkey,
      );

      // Check if token accounts exist and create them if needed
      const transaction = new Transaction();

      // Check sender token account
      try {
        await getAccount(connection, senderTokenAccount);
      } catch (e) {
        alert(e);
        // Sender doesn't have a token account - they need USDC first
        setPaymentError(
          "You need USDC in your wallet to make this payment. Please get some USDC first.",
        );
        setIsProcessingPayment(false);
        return;
      }

      // Check recipient token account and create if needed
      try {
        await getAccount(connection, recipientTokenAccount);
      } catch {
        // Recipient doesn't have a token account - create it
        transaction.add(
          createAssociatedTokenAccountInstruction(
            senderPubkey, // payer
            recipientTokenAccount, // ata
            recipientPubkey, // owner
            usdcMint, // mint
          ),
        );
      }

      // Create transfer instruction
      const transferInstruction = createTransferCheckedInstruction(
        senderTokenAccount,
        usdcMint,
        recipientTokenAccount,
        senderPubkey,
        amount,
        6, // USDC has 6 decimals
      );

      transaction.add(transferInstruction);

      // Get latest blockhash and set fee payer
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = senderPubkey;

      // Send transaction
      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: false,
      });

      // Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed");

      // Retry request with X-PAYMENT header
      const paymentData = {
        x402Version: 1,
        scheme: "exact",
        network: "solana-devnet",
        payload: {
          signature: signature,
          from: senderPubkey.toString(),
          to: paymentInfo.payTo,
          amount: amount.toString(),
          token: USDC_MINT,
        },
      };

      // Send payment verification request
      // Use the full URL to ensure cookies are set properly
      const verifyUrl = window.location.origin + window.location.pathname;
      const response = await fetch(verifyUrl, {
        method: "GET",
        headers: {
          "X-PAYMENT": JSON.stringify(paymentData),
          Accept: "application/json", // Request JSON to get proper response
        },
        credentials: "include",
      });

      console.log("Payment verification response:", {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (response.ok) {
        // Payment successful - cookie should be set by middleware
        // The cookie is set in the response headers, browser will handle it
        console.log("Payment verification successful, cookie should be set");

        // Wait a moment for cookie to be properly set, then reload
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Force a hard reload to ensure cookie is read
        window.location.href = window.location.href;
      } else {
        // Try to parse error response
        try {
          const error = await response.json();
          setPaymentError(
            error.reason || error.error || "Payment verification failed",
          );
        } catch {
          setPaymentError("Payment verification failed. Please try again.");
        }
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      setPaymentError(error.message || "Payment failed. Please try again.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400 text-lg">Loading...</p>
      </div>
    );
  }

  if (!post && !paymentRequired) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold">Post not found</h1>
          <a href="/" className="text-gray-400 hover:text-white">
            ← Go Home
          </a>
        </div>
      </div>
    );
  }

  // Show payment UI if payment is required
  if (paymentRequired && paymentInfo) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">
              Payment Required to view this post (x402).
            </h1>
          </div>

          <div className="bg-black/70 backdrop-blur-sm border border-gray-600 p-6">
            <div className="space-y-6">
              <div>
                <label className="text-lg font-semibold text-gray-400 block">
                  Payment Amount
                </label>
                <p className="text-white text-lg">
                  {paymentInfo.paymentAmount} {paymentInfo.paymentCurrency}
                </p>
              </div>

              <div>
                <label className="text-lg font-semibold text-gray-400 block">
                  Pay To
                </label>
                <p className="text-white break-all text-base font-mono">
                  {paymentInfo.payTo}
                </p>
              </div>

              {paymentError && (
                <div className="bg-red-900/30 border border-red-600 text-red-400 p-3">
                  <p className="text-sm">{paymentError}</p>
                </div>
              )}

              <div>
                {!connected ? (
                  <Button
                    onClick={() => setShowWalletModal(true)}
                    className="w-full h-12 text-base font-semibold bg-white text-black hover:bg-gray-200"
                  >
                    Connect Wallet
                  </Button>
                ) : (
                  <Button
                    onClick={handlePayment}
                    disabled={isProcessingPayment}
                    className="w-full h-12 text-base font-semibold bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessingPayment
                      ? "Processing Payment..."
                      : `Pay ${paymentInfo.paymentAmount} ${paymentInfo.paymentCurrency}`}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div>
            <a href="/" className="text-gray-400 hover:text-white">
              ← Go Home
            </a>
          </div>
        </div>

        <WalletModal
          isOpen={showWalletModal}
          onClose={() => setShowWalletModal(false)}
        />
      </div>
    );
  }

  if (!post) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Post Title */}
        <div>
          <label className="text-lg font-semibold text-gray-400 block">
            Post Title
          </label>
          <p className="text-white text-base">{post.title}</p>
        </div>

        {/* Posting Wallet */}
        {post.walletAddress && (
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <label className="text-lg font-semibold text-gray-400 block">
                Posting Wallet
              </label>
              <p className="text-white truncate text-base">
                {post.walletAddress}
              </p>
            </div>
            {post.signature && post.message && (
              <button
                onClick={handleVerify}
                className="px-4 py-2 bg-white text-black hover:bg-gray-200 text-sm font-semibold whitespace-nowrap self-center h-10"
              >
                VERIFY
              </button>
            )}
          </div>
        )}

        {/* Post Content */}
        <div>
          <label className="text-lg font-semibold text-gray-400 block">
            Post Content
          </label>
          <p className="text-white whitespace-pre-wrap leading-relaxed text-base">
            {post.content}
          </p>
        </div>

        {/* Media Files */}
        {post.mediaFiles.length > 0 && (
          <div>
            <label className="text-lg font-semibold text-gray-400 block">
              Media Files ({post.mediaFiles.length})
            </label>
            <div className="flex gap-3 flex-wrap">
              {post.mediaFiles.map((file, index) => {
                const isImage = file.fileType.startsWith("image/");
                const isVideo =
                  file.fileType === "video/mp4" ||
                  file.fileName.endsWith(".mp4");

                return (
                  <div
                    key={file.id}
                    className="relative w-32 h-32 aspect-square border border-gray-600 overflow-hidden cursor-pointer bg-black/50"
                    onClick={() => setPreviewIndex(index)}
                  >
                    {isImage ? (
                      <img
                        src={file.preview}
                        alt={file.fileName}
                        className="w-full h-full object-contain"
                      />
                    ) : isVideo ? (
                      <video
                        src={file.preview}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center space-y-6">
                          <div className="text-2xl">📄</div>
                          <div className="text-[10px] text-gray-400 truncate px-1">
                            {file.fileName}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {previewIndex !== null &&
          post &&
          (() => {
            const currentFile = post.mediaFiles[previewIndex];
            if (!currentFile) return null;

            const isImage = currentFile.fileType.startsWith("image/");
            const isVideo =
              currentFile.fileType === "video/mp4" ||
              currentFile.fileName.endsWith(".mp4");
            const isText =
              currentFile.fileType === "text/plain" ||
              currentFile.fileName.endsWith(".txt");
            const hasPrev = previewIndex > 0;
            const hasNext = previewIndex < post.mediaFiles.length - 1;

            return (
              <div
                className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"
                onClick={() => setPreviewIndex(null)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewIndex(null);
                  }}
                  className="absolute top-4 right-4 bg-black/90 hover:bg-red-600 text-white p-2 z-10"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>

                {hasPrev && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewIndex(previewIndex - 1);
                    }}
                    className="absolute left-4 bg-black/90 hover:bg-white/20 text-white p-3 z-10"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                )}

                {hasNext && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewIndex(previewIndex + 1);
                    }}
                    className="absolute right-4 bg-black/90 hover:bg-white/20 text-white p-3 z-10"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                )}

                {isImage ? (
                  <img
                    src={currentFile.preview}
                    alt={currentFile.fileName}
                    className="max-w-[90vw] max-h-[90vh] object-contain"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : isVideo ? (
                  <video
                    src={currentFile.preview}
                    controls
                    className="max-w-[90vw] max-h-[90vh]"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : isText && currentFile.textContent ? (
                  <div
                    className="max-w-[90vw] max-h-[90vh] bg-black/50 border border-gray-600 p-6 flex flex-col space-y-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-white text-xl font-semibold text-center break-all">
                      {currentFile.fileName}
                    </div>
                    <div className="flex-1 overflow-auto">
                      <pre className="text-white text-sm whitespace-pre-wrap font-mono">
                        {currentFile.textContent}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div
                    className="max-w-[90vw] max-h-[90vh] bg-black/50 border border-gray-600 p-6 flex flex-col items-center justify-center space-y-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-6xl">📄</div>
                    <div className="text-white text-xl font-semibold text-center break-all">
                      {currentFile.fileName}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {(currentFile.fileSize / 1024).toFixed(2)} KB
                    </div>
                  </div>
                )}

                {post.mediaFiles.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/90 text-white text-sm px-4 py-2 z-10">
                    {previewIndex + 1} / {post.mediaFiles.length}
                  </div>
                )}
              </div>
            );
          })()}

        <div className="border-t border-gray-600 flex items-center justify-between pt-4">
          <a href="/" className="text-gray-400 hover:text-white">
            ← Go Home
          </a>
          <p className="text-gray-400 text-sm">
            {new Date(post.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Verify Modal */}
      {showVerifyModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setShowVerifyModal(false)}
        >
          <div
            className="bg-black/70 backdrop-blur-sm border border-gray-600 p-8 max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                Signature Verify
              </h2>
              <button
                onClick={() => setShowVerifyModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              <div>
                {isVerified === true ? (
                  <>
                    <p className="text-white text-lg font-semibold mb-2">
                      Verified
                    </p>
                    <p className="text-gray-400 text-sm">
                      The signature is valid and matches the wallet address.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-white text-lg font-semibold mb-2">
                      Verification Failed
                    </p>
                    <p className="text-gray-400 text-sm">
                      The signature could not be verified.
                    </p>
                  </>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-600">
                <div>
                  <label className="text-sm font-medium text-gray-400 block mb-1">
                    Wallet Address
                  </label>
                  <Input
                    type="text"
                    value={editWalletAddress}
                    onChange={(e) => setEditWalletAddress(e.target.value)}
                    className="bg-black/50 border-gray-600 text-white text-base font-mono"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-400 block mb-1">
                    Message
                  </label>
                  <Input
                    type="text"
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                    className="bg-black/50 border-gray-600 text-white text-base font-mono"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-400 block mb-1">
                    Signature
                  </label>
                  <Input
                    type="text"
                    value={editSignature}
                    onChange={(e) => setEditSignature(e.target.value)}
                    className="bg-black/50 border-gray-600 text-white text-base font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
