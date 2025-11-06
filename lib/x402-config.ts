export const X402_CONFIG = {
  USDC_DEVNET_MINT: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", //Devnet USDC
  USDC_MINT: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // Mainnet USDC
  NETWORK: "solana-devnet", // "solana" for mainnet, "solana-devnet" for devnet
  RPC_ENDPOINT: "https://api.devnet.solana.com",
  FACILITATOR_BASE_URL: "/api/facilitator",
  COOKIE_NAME: "post_payment_verified",
  COOKIE_MAX_AGE: 60 * 60 * 24, // 24 hours
  COOKIE_SECURE: true, // Only send over HTTPS
} as const;
