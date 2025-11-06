"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletModal } from "@/components/wallet-modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Dithering } from "@paper-design/shaders-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface MediaFile {
  file: File;
  preview: string;
  id: string;
  textContent?: string;
}

const DITHER_COLORS = [
  "#614B00",
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA15E",
  "#BC4749",
  "#A663CC",
  "#118AB2",
  "#06FFA5",
  "#FF006E",
  "#8338EC",
  "#FB5607",
  "#FFBE0B",
  "#3A86FF",
  "#F72585",
  "#7209B7",
  "#4361EE",
] as const;

const generateRandomColor = (): string => {
  const baseColor =
    DITHER_COLORS[Math.floor(Math.random() * DITHER_COLORS.length)];
  const r = parseInt(baseColor.slice(1, 3), 16);
  const g = parseInt(baseColor.slice(3, 5), 16);
  const b = parseInt(baseColor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.5)`;
};

export function PostCreator() {
  const router = useRouter();
  const { connected, publicKey, signMessage } = useWallet();
  const [ditherColor] = useState<string>(() => generateRandomColor());
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [paymentCurrency, setPaymentCurrency] = useState<string>("USDC");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleFileUpload = (file: File) => {
    const isValidFile =
      file.type.startsWith("image/") ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".mp4") ||
      file.type === "text/plain" ||
      file.type === "video/mp4";

    if (!isValidFile) {
      showToast("Please select a valid file (image, .txt, or .mp4).", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      const id = `${Date.now()}-${Math.random()}`;
      setMediaFiles((prev) => [
        ...prev,
        {
          file,
          preview,
          id,
        },
      ]);
    };
    reader.onerror = () => {
      showToast("Error reading the file.", "error");
    };

    if (file.type.startsWith("image/")) {
      reader.readAsDataURL(file);
    } else if (file.type === "video/mp4" || file.name.endsWith(".mp4")) {
      // For video files, create object URL
      const videoUrl = URL.createObjectURL(file);
      const id = `${Date.now()}-${Math.random()}`;
      setMediaFiles((prev) => [
        ...prev,
        {
          file,
          preview: videoUrl,
          id,
        },
      ]);
    } else {
      // For text files, read the content
      const textReader = new FileReader();
      textReader.onload = (e) => {
        const textContent = e.target?.result as string;
        const placeholder = "data:text/plain;base64,";
        const id = `${Date.now()}-${Math.random()}`;
        setMediaFiles((prev) => [
          ...prev,
          {
            file,
            preview: placeholder,
            id,
            textContent,
          },
        ]);
      };
      textReader.onerror = () => {
        showToast("Error reading the file.", "error");
      };
      textReader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach((file) => handleFileUpload(file));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => handleFileUpload(file));
    e.target.value = "";
  };

  const removeMediaFile = (id: string) => {
    setMediaFiles((prev) => prev.filter((mf) => mf.id !== id));
  };

  const handlePostContent = async () => {
    if (!connected) {
      showToast("Please connect your wallet first", "error");
      return;
    }
    if (!title.trim()) {
      showToast("Please enter a post title", "error");
      return;
    }
    if (!content.trim()) {
      showToast("Please enter post content", "error");
      return;
    }
    if (!paymentAmount.trim()) {
      showToast("Please enter a payment amount", "error");
      return;
    }

    setIsPosting(true);

    try {
      if (!publicKey || !signMessage) {
        showToast("Wallet not connected or signing not available", "error");
        setIsPosting(false);
        return;
      }

      // Create message to sign (includes post content for verification)
      const messageToSign = JSON.stringify({
        title: title.trim(),
        content: content.trim(),
        paymentAmount,
        paymentCurrency,
        timestamp: Date.now(),
      });

      // Sign the message
      const message = new TextEncoder().encode(messageToSign);
      const signature = await signMessage(message);

      // Convert signature to base58 for transmission
      const signatureBase58 = Buffer.from(signature).toString("base64");

      // Create post object (UUID and createdAt will be set on backend)
      const post = {
        title: title.trim(),
        content: content.trim(),
        paymentAmount,
        paymentCurrency,
        walletAddress: publicKey.toString(),
        signature: signatureBase58,
        message: messageToSign,
        mediaFiles: mediaFiles.map((mf) => ({
          id: mf.id,
          fileName: mf.file.name,
          fileType: mf.file.type,
          fileSize: mf.file.size,
          preview: mf.preview,
          textContent: mf.textContent,
        })),
      };

      // Save to file via API
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(post),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to save post" }));
        throw new Error(errorData.error || "Failed to save post");
      }

      const result = await response.json();
      const uuid = result.id;

      showToast(`Content posted successfully!`, "success");

      // Navigate to post page using UUID from backend
      router.push(`/post/${uuid}`);
    } catch (error: any) {
      console.error("Error posting content:", error);
      if (error.message?.includes("User rejected")) {
        showToast("Message signing cancelled", "error");
      } else {
        showToast(error.message || "Failed to save post", "error");
      }
      setIsPosting(false);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      (e.metaKey || e.ctrlKey) &&
      e.key === "Enter" &&
      connected &&
      title.trim() &&
      content.trim() &&
      paymentAmount.trim()
    ) {
      e.preventDefault();
      handlePostContent();
    }
  };

  // Handle keyboard navigation for carousel
  useEffect(() => {
    if (previewIndex === null) return;

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
          if (current === null || current >= mediaFiles.length - 1)
            return current;
          return current + 1;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewIndex, mediaFiles]);

  return (
    <div
      className="bg-background min-h-screen flex items-center justify-center select-none"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />

      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300 select-none">
          <div
            className={cn(
              "bg-black/90 backdrop-blur-sm border p-4 shadow-lg max-w-sm",
              toast.type === "success"
                ? "border-green-500/50 text-green-100"
                : "border-red-500/50 text-red-100",
            )}
          >
            <div className="flex items-center gap-3">
              {toast.type === "success" ? (
                <svg
                  className="w-5 h-5 text-green-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-red-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12m0 0l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              )}
              <p className="text-sm font-medium">{toast.message}</p>
            </div>
          </div>
        </div>
      )}

      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center select-none">
          <div className="bg-white/10 border-2 border-dashed border-white/50 p-12 text-center mx-4">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <h3 className="text-2xl font-bold text-white mb-2">
              Drop Images Here
            </h3>
            <p className="text-gray-300 text-base">
              Release to upload your images
            </p>
          </div>
        </div>
      )}

      {previewIndex !== null &&
        (() => {
          // Include all files in carousel
          const currentFile = mediaFiles[previewIndex];
          if (!currentFile) return null;

          const isImage = currentFile.file.type.startsWith("image/");
          const isVideo =
            currentFile.file.type === "video/mp4" ||
            currentFile.file.name.endsWith(".mp4");
          const isText =
            currentFile.file.type === "text/plain" ||
            currentFile.file.name.endsWith(".txt");
          const hasPrev = previewIndex > 0;
          const hasNext = previewIndex < mediaFiles.length - 1;

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
                  alt="Preview"
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
                    {currentFile.file.name}
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
                    {currentFile.file.name}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {(currentFile.file.size / 1024).toFixed(2)} KB
                  </div>
                </div>
              )}

              {mediaFiles.length > 1 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/90 text-white text-sm px-4 py-2 z-10">
                  {previewIndex + 1} / {mediaFiles.length}
                </div>
              )}
            </div>
          );
        })()}

      <div className="fixed inset-0 z-0 select-none">
        <Dithering
          colorBack="#00000000"
          colorFront={ditherColor}
          speed={0.43}
          shape="wave"
          type="4x4"
          pxSize={3}
          scale={1.1}
          style={{
            backgroundColor: "#000000",
            height: "100vh",
            width: "100vw",
          }}
        />
      </div>

      <div className="relative z-10 p-6 w-full max-w-3xl mx-auto select-none">
        <div className="bg-black/70 backdrop-blur-sm border border-gray-600 p-6 animate-in fade-in zoom-in-95 duration-200 space-y-6">
          <div className="">
            <div className="flex items-center justify-between mb-2">
              <a
                href="https://x.com/Post402"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <h1 className="text-2xl font-bold text-white select-none hover:text-gray-300 transition-colors cursor-pointer">
                  Post402
                </h1>
              </a>
              <a
                href="https://x.com/Post402"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 bg-black/50 border border-gray-600 hover:bg-black/70 hover:border-gray-500 transition-colors"
                aria-label="Visit our X profile"
              >
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
            <p className="text-sm text-gray-400">
              Create and share premium content
            </p>
          </div>

          {/* Payment Section */}
          <div>
            <div className="flex flex-col md:flex-row gap-4 w-full">
              <div className="flex-1 min-w-0 space-y-6">
                <label className="text-sm font-medium text-gray-300">
                  Payment Configuration
                </label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.01"
                    min="0"
                    step="0.01"
                    className="flex-1 bg-black/50 border-gray-600 text-white text-sm h-[40px] min-h-[40px] py-0"
                  />
                  <Select
                    value={paymentCurrency}
                    onValueChange={(value) => {
                      // Only allow USDC selection, block SOL
                      if (value === "USDC") {
                        setPaymentCurrency(value);
                      }
                    }}
                  >
                    <SelectTrigger className="w-28 bg-black/50 border-gray-600 text-white text-sm h-[40px] min-h-[40px] py-0 px-2 flex items-center">
                      <SelectValue>
                        <div className="flex items-center gap-1.5">
                          <img
                            src="https://pbs.twimg.com/profile_images/1916937910928211968/CKblfanr_400x400.png"
                            alt="USDC"
                            className="w-4 h-4"
                          />
                          <span>USDC</span>
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-black/95 border-gray-600 text-white">
                      <SelectItem value="USDC" className="text-sm">
                        <div className="flex items-center gap-2">
                          <img
                            src="https://pbs.twimg.com/profile_images/1916937910928211968/CKblfanr_400x400.png"
                            alt="USDC"
                            className="w-4 h-4"
                          />
                          <span>USDC</span>
                        </div>
                      </SelectItem>
                      <SelectItem
                        value="SOL"
                        className="text-sm opacity-50 cursor-not-allowed"
                        disabled
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src="https://pbs.twimg.com/profile_images/1983758234784534528/24dx-lu7_400x400.jpg"
                            alt="SOL"
                            className="w-4 h-4"
                          />
                          <span>SOL</span>
                          <span className="text-xs text-gray-400 ml-1">
                            (Coming Soon)
                          </span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-6">
                <label className="text-sm font-medium text-gray-300">
                  Payout Address
                </label>
                <Input
                  type="text"
                  value={publicKey ? publicKey.toString() : ""}
                  placeholder="Connect wallet to see address"
                  readOnly
                  className="w-full bg-black/50 border-gray-600 text-white text-sm h-[40px] min-h-[40px] py-0 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Input Section */}
          <div className="space-y-6">
            <div className="space-y-6">
              <label className="text-sm font-medium text-gray-300">
                Media Files ({mediaFiles.length})
              </label>
              <div
                className={cn(
                  "min-h-[112px] p-6 border-2 border-dashed cursor-pointer flex",
                  isDragOver
                    ? "border-white bg-white/5"
                    : "border-gray-600 bg-black/20",
                  mediaFiles.length === 0
                    ? "items-center justify-center"
                    : "items-start",
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                {mediaFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-gray-400 space-y-6">
                    <svg
                      className="w-8 h-8 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="text-sm font-medium text-gray-300">
                      Upload files here
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-3 flex-wrap w-full">
                    {mediaFiles.map((mediaFile, index) => {
                      const isImage = mediaFile.file.type.startsWith("image/");
                      const isText =
                        mediaFile.file.type === "text/plain" ||
                        mediaFile.file.name.endsWith(".txt");
                      const isVideo =
                        mediaFile.file.type === "video/mp4" ||
                        mediaFile.file.name.endsWith(".mp4");

                      return (
                        <div
                          key={mediaFile.id}
                          className="relative w-20 h-20 aspect-square border border-gray-600 overflow-hidden group flex items-center justify-center bg-black/50"
                        >
                          {isImage ? (
                            <>
                              <img
                                src={mediaFile.preview}
                                alt="Preview"
                                className="w-full h-full object-contain cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewIndex(index);
                                }}
                              />
                              <div className="absolute bottom-1 left-1 bg-black/80 text-white text-[8px] px-1.5 py-0.5 flex items-center gap-1">
                                <svg
                                  className="w-2.5 h-2.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <rect
                                    x="3"
                                    y="3"
                                    width="18"
                                    height="18"
                                    rx="2"
                                    strokeWidth="2"
                                  />
                                  <path d="M9 9h6v6H9z" strokeWidth="2" />
                                </svg>
                                <span>IMAGE</span>
                              </div>
                            </>
                          ) : isVideo ? (
                            <>
                              <video
                                src={mediaFile.preview}
                                className="w-full h-full object-cover cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewIndex(index);
                                }}
                                muted
                                playsInline
                              />
                              <div className="absolute bottom-1 left-1 bg-black/80 text-white text-[8px] px-1.5 py-0.5 flex items-center gap-1">
                                <svg
                                  className="w-2.5 h-2.5"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                                <span>VIDEO</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div
                                className="text-white text-xs text-center p-2 cursor-pointer w-full h-full flex flex-col items-center justify-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewIndex(index);
                                }}
                              >
                                <div className="text-2xl mb-1">📄</div>
                                <div className="truncate text-[10px]">
                                  {mediaFile.file.name}
                                </div>
                              </div>
                              <div className="absolute bottom-1 left-1 bg-black/80 text-white text-[8px] px-1.5 py-0.5">
                                <span className="uppercase">
                                  {mediaFile.file.name.split(".").pop() ||
                                    "FILE"}
                                </span>
                              </div>
                            </>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeMediaFile(mediaFile.id);
                            }}
                            className="absolute top-1 right-1 bg-black/90 hover:bg-red-600 text-white p-1 opacity-0 group-hover:opacity-100"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <input
                  id="file-input"
                  type="file"
                  accept="image/*,.txt,.mp4"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            </div>

            {/* Post Title */}
            <div className="space-y-6">
              <label className="text-sm font-medium text-gray-300">
                Post Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter post title..."
                className="bg-black/50 border-gray-600 text-white text-base"
              />
            </div>

            {/* Post Content */}
            <div className="space-y-6">
              <label className="text-sm font-medium text-gray-300">
                Post Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter post content..."
                className="w-full h-32 bg-black/50 border border-gray-600 text-white text-base md:text-sm resize-none p-6 select-text focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none shadow-xs transition-[color,box-shadow]"
              />
            </div>

            <div>
              {!connected ? (
                <Button
                  onClick={() => setIsWalletModalOpen(true)}
                  className="w-full h-12 text-base font-semibold bg-white text-black hover:bg-gray-200"
                >
                  Connect Wallet
                </Button>
              ) : (
                <Button
                  onClick={handlePostContent}
                  disabled={
                    !title.trim() ||
                    !content.trim() ||
                    !paymentAmount.trim() ||
                    isPosting
                  }
                  className="w-full h-12 text-base font-semibold bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPosting ? (
                    <div className="flex items-center gap-2">
                      <svg
                        className="animate-spin h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Posting...</span>
                    </div>
                  ) : paymentAmount.trim() ? (
                    `Post Content (${paymentAmount} ${paymentCurrency})`
                  ) : (
                    "Post Content"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
