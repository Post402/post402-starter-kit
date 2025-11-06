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
- React 18
- Supabase (PostgreSQL database)
- Solana wallet adapter (Phantom, Solflare)
- x402 payment protocol
- Tailwind CSS
- TypeScript

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **Settings** → **API** to get your credentials
4. Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

5. Run the database migration:
   - In your Supabase dashboard, go to **SQL Editor**
   - Copy and run the SQL from `supabase-migration.sql`

### 3. Run the dev server

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

Posts are stored in Supabase. Each post gets a UUID and includes your wallet signature for verification.

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
  supabase.ts           # Supabase client configuration
  db.ts                 # Database operations
  x402-config.ts        # Configuration
  x402-verification.ts  # Payment verification logic
  transaction-storage.ts # In-memory transaction cache

middleware.ts           # Payment gate for /post routes
```

## Notes

- Posts are stored in Supabase (PostgreSQL database)
- Media files (images, videos) are stored as base64 data URLs in the database
- Transaction storage is in-memory only (lost on restart)
- Currently using Solana devnet
- Cookies are httpOnly and secure in production
- The payment UI shows a 402 error code (Payment Required)

## Database Schema

Posts are stored in a `posts` table with the following structure:
- `id` - UUID (primary key)
- `title` - Post title
- `content` - Post content
- `wallet_address` - Solana wallet address of the creator
- `signature` - Base64-encoded signature
- `message` - Original message that was signed
- `payment_amount` - Payment amount in USDC
- `payment_currency` - Currency (default: USDC)
- `media_files` - JSONB array of media file metadata
- `created_at` - Timestamp

## Development

The project uses TypeScript and Tailwind CSS. The post creator has a dithering shader background that changes colors. Media files are stored as base64 data URLs in the database.

**Note:** For production, consider using a proper file storage service (like Supabase Storage, AWS S3, or Cloudinary) instead of storing base64-encoded images in the database.

To build for production:

```bash
npm run build
npm start
```
