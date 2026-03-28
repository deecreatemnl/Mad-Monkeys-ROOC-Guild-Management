import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import * as bcrypt from "bcryptjs";

dotenv.config();

const url = process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_ANON_KEY || "";

// Only create client if credentials exist to avoid module-level throw
export const supabase = (url && key) 
  ? createClient(url, key) 
  : null as any;

if (!supabase) {
  console.warn("WARNING: Supabase credentials missing. API will fail.");
}

// Password Hashing Utilities
export const hashPassword = async (password: string): Promise<string> => {
  const b = (bcrypt as any).default || bcrypt;
  const salt = await b.genSalt(10);
  return b.hash(password, salt);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  const b = (bcrypt as any).default || bcrypt;
  return b.compare(password, hash);
};

// Database Interface (Legacy - will be removed after app.ts update)
export interface Database {
  get: () => Promise<any>;
  save: (data: any) => Promise<void>;
}
