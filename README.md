# Post402

<div align="center">

![Banner](./public/banner.png)

A simple content platform where you can post text and media files behind a Solana paywall. Posts are signed with your wallet, and readers pay USDC to view them.

</div>

## What it does

Create posts with text content and media files (images, videos, text files). When you publish, you sign a message with your Solana wallet to prove ownership. You can optionally set a payment amount in USDC - if you do, readers need to pay that amount to view the full post.

The payment system uses the x402 protocol. Payments are made in USDC on Solana devnet, verified on-chain, and stored in cookies so you don't have to pay again for 24 hours.

## Tech stack

- Next.js 14
- React 19
- Solana wallet adapter (Phantom, Solflare)
- x402 payment protocol
- Tailwind CSS
- TypeScript

## Setup

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

The app runs on `http://localhost:3000`.

## How it works

### Creating posts

1. Connect your Solana wallet
2. Write a title and content
3. Optionally drag and drop media files (images, videos, or text files)
4. Set a payment amount in USDC
5. Your payout address is automatically detected
6. Click "Publish" and sign the message with your wallet

Posts are stored in `data/posts/posts.json`. Each post gets a UUID and includes your wallet signature for verification.

### Viewing posts

Posts are at `/post/[uuid]`. If a post has a payment requirement:

- The middleware checks for a payment cookie
- If no cookie exists, you see the payment UI
- Connect your wallet and click "Pay" to send USDC
- The transaction is verified on-chain via the facilitator API
- A cookie is set so you can access the post for 24 hours

### Payment verification

The facilitator API (`/api/facilitator/verify`) checks that:

- The transaction signature exists on-chain
- The amount matches exactly
- The recipient address is correct
- The token is USDC

Once verified, the transaction signature is stored in memory (resets on server restart) and a cookie is set.

### Configuration

All config is in `lib/x402-config.ts`:

- `USDC_DEVNET_MINT` - Devnet USDC token mint address
- `USDC_MINT` - Mainnet USDC token mint address
- `NETWORK` - Solana network ("solana-devnet" or "solana")
- `RPC_ENDPOINT` - Solana RPC endpoint URL
- `FACILITATOR_BASE_URL` - Base path for facilitator API endpoints
- `COOKIE_NAME` - Name prefix for payment verification cookies
- `COOKIE_MAX_AGE` - Cookie expiration time in seconds (default: 24 hours)
- `COOKIE_SECURE` - Whether cookies should only be sent over HTTPS

## File structure

```
app/
  page.tsx              # Home page with post creator
  post/[uuid]/page.tsx  # Post viewer with payment UI
  api/
    posts/              # GET/POST endpoints for posts
    facilitator/        # Payment verification endpoints

components/
  post-creator.tsx      # Main posting interface
  wallet-modal.tsx      # Wallet connection modal
  solana-provider.tsx   # Solana wallet context

lib/
  x402-config.ts        # Configuration
  x402-verification.ts  # Payment verification logic
  transaction-storage.ts # In-memory transaction cache

middleware.ts           # Payment gate for /post routes
```

## Notes

- Posts are stored as JSON files, not in a database
- Transaction storage is in-memory only (lost on restart)
- Currently using Solana devnet
- Cookies are httpOnly and secure in production
- The payment UI shows a 402 error code (Payment Required)

## Development

The project uses TypeScript and Tailwind CSS. The post creator has a dithering shader background that changes colors. Media files are stored as base64 data URLs in the JSON.

To build for production:

```bash
npm run build
npm start
```
