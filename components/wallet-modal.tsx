"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletName } from "@solana/wallet-adapter-base";
import { cn } from "@/lib/utils";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const {
    wallet,
    wallets,
    select,
    connect,
    connecting,
    connected,
    disconnect,
  } = useWallet();
  const [selectedWallet, setSelectedWallet] = useState<WalletName | null>(null);

  useEffect(() => {
    if (connected && isOpen) {
      onClose();
    }
  }, [connected, isOpen, onClose]);

  const handleWalletSelect = async (walletName: WalletName) => {
    setSelectedWallet(walletName);
    try {
      select(walletName);
      await connect();
    } catch (error) {
      console.error("Error connecting wallet:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-black/70 backdrop-blur-sm border border-gray-600 p-8 max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Connect Wallet</h2>
          <button
            onClick={onClose}
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

        <div className="space-y-3">
          {wallets.map((walletOption) => {
            const isInstalled = walletOption.readyState === "Installed";
            const isSelected = selectedWallet === walletOption.adapter.name;
            const isConnecting = connecting && isSelected;

            return (
              <button
                key={walletOption.adapter.name}
                onClick={() => handleWalletSelect(walletOption.adapter.name)}
                disabled={!isInstalled || connecting}
                className={cn(
                  "w-full p-4 border transition-all text-left",
                  "bg-black/50 border-gray-600 hover:border-white/50",
                  "hover:bg-black/70 disabled:opacity-50 disabled:cursor-not-allowed",
                  isSelected && "border-white",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {walletOption.adapter.icon && (
                      <img
                        src={walletOption.adapter.icon}
                        alt={walletOption.adapter.name}
                        className="w-8 h-8"
                      />
                    )}
                    <div>
                      <div className="text-white font-semibold">
                        {walletOption.adapter.name}
                      </div>
                    </div>
                  </div>
                  {isConnecting && (
                    <svg
                      className="animate-spin h-5 w-5 text-white"
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
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {connected && wallet && (
          <div className="mt-6 pt-6 border-t border-gray-600">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">Connected</div>
                <div className="text-gray-400 text-sm">
                  {wallet.adapter.name}
                </div>
              </div>
              <button
                onClick={async () => {
                  await disconnect();
                  onClose();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
