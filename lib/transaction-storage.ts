/**
 * Transaction Storage Utility
 *
 * Simple storage for verified transactions to prevent replay attacks.
 *
 * IN-MEMORY ONLY VERSION: Transactions are lost on server restart.
 * For production, replace this with Redis, database, or a distributed cache.
 */

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface TransactionRecord {
  signature: string;
  timestamp: number;
  postId?: string;
  metadata?: {
    from?: string;
    to?: string;
    amount?: string;
  };
}

class TransactionStorage {
  private cache: Map<string, TransactionRecord> = new Map();

  async has(signature: string, postId?: string): Promise<boolean> {
    const record = this.cache.get(signature);
    if (!record) return false;

    // If postId provided, verify it matches
    if (postId && record.postId !== postId) {
      return false;
    }

    // Check if expired
    if (Date.now() - record.timestamp > MAX_AGE_MS) {
      this.cache.delete(signature);
      return false;
    }

    return true;
  }

  async add(
    signature: string,
    postId?: string,
    metadata?: TransactionRecord["metadata"],
  ): Promise<void> {
    const record: TransactionRecord = {
      signature,
      timestamp: Date.now(),
      postId,
      metadata,
    };

    this.cache.set(signature, record);
  }

  async cleanup(): Promise<void> {
    const now = Date.now();

    for (const [signature, record] of this.cache.entries()) {
      if (now - record.timestamp > MAX_AGE_MS) {
        this.cache.delete(signature);
      }
    }
  }

  getSize(): number {
    return this.cache.size;
  }
}

const transactionStorage = new TransactionStorage();

if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      transactionStorage.cleanup().catch(console.error);
    },
    60 * 60 * 1000,
  );
}

export default transactionStorage;
