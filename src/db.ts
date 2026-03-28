import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be provided");
}

export const supabase = createClient(url, key);

// Password Hashing Utilities
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// Database Interface (Legacy - will be removed after app.ts update)
export interface Database {
  get: () => Promise<any>;
  save: (data: any) => Promise<void>;
}
