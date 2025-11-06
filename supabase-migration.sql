-- Supabase Migration: Create posts table
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  wallet_address TEXT,
  signature TEXT,
  message TEXT,
  payment_amount TEXT NOT NULL,
  payment_currency TEXT NOT NULL DEFAULT 'USDC',
  media_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create an index for faster lookups by ID
CREATE INDEX IF NOT EXISTS posts_id_idx ON posts(id);

-- Create an index for sorting by created_at
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at DESC);

-- Enable Row Level Security (RLS) - optional, but recommended
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows anyone to read posts (for public viewing)
CREATE POLICY "Anyone can read posts" ON posts
  FOR SELECT
  USING (true);

-- Create a policy that allows anyone to insert posts (for creating posts)
CREATE POLICY "Anyone can create posts" ON posts
  FOR INSERT
  WITH CHECK (true);

-- Optional: If you want to restrict updates/deletes to the post owner
-- CREATE POLICY "Only owner can update posts" ON posts
--   FOR UPDATE
--   USING (auth.uid()::text = wallet_address);

