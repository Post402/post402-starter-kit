/**
 * Database Layer
 * 
 * Handles all database operations for posts.
 */

import { supabase } from "./supabase";

export interface Post {
  id: string;
  title: string;
  content: string;
  wallet_address?: string;
  signature?: string;
  message?: string;
  payment_amount: string;
  payment_currency: string;
  media_files: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    preview: string;
    textContent?: string;
  }>;
  created_at: string;
}

export async function getAllPosts(): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching posts:", error);
    throw error;
  }

  return data || [];
}

export async function getPostById(id: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    console.error("Error fetching post:", error);
    throw error;
  }

  return data;
}

export async function createPost(post: Post): Promise<Post> {
  const { data, error } = await supabase
    .from("posts")
    .insert({
      ...post,
      created_at: post.created_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating post:", error);
    throw error;
  }

  return data;
}

