import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Database Interface
export interface Database {
  get: () => Promise<any>;
  save: (data: any) => Promise<void>;
}

// Initial Database Structure
export const initialDb = {
  users: {
    "ReadyHit": {
      "id": "ReadyHit",
      "username": "ReadyHit",
      "displayName": "ReadyHit",
      "role": "superadmin",
      "createdAt": "2026-03-28T19:51:05Z",
      "password": "Nihsvxcuhyu47I"
    }
  },
  members: [],
  events: [],
  jobs: [
    { id: "1", name: "Lord Knight" },
    { id: "2", name: "High Priest" },
    { id: "3", name: "High Wizard" },
    { id: "4", name: "Sniper" },
    { id: "5", name: "Assassin Cross" },
    { id: "6", name: "Whitesmith" },
    { id: "7", name: "Creator" },
    { id: "8", name: "Paladin" },
    { id: "9", name: "Champion" },
    { id: "10", name: "Stalker" },
    { id: "11", name: "Professor" },
    { id: "12", name: "Minstrel" },
    { id: "13", name: "Gypsy" }
  ],
  settings: {
    guild_settings: {
      name: 'MadMonkeys',
      subtitle: 'Guild Management System',
      timezone: 'GMT+8 (Singapore/Manila)',
      logoUrl: '',
    }
  }
};

export class SupabaseDatabase implements Database {
  private supabase;
  private tableName = "guild_manager_storage";
  private rowId = 1;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be provided");
    }

    try {
      new URL(url);
    } catch (e) {
      throw new Error(`Invalid SUPABASE_URL: ${url}. Please ensure it starts with https://`);
    }

    this.supabase = createClient(url, key);
  }

  async get() {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select("data")
        .eq("id", this.rowId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // Row not found
          await this.save(initialDb);
          return initialDb;
        }
        console.error("Supabase Get Error:", error);
        return initialDb;
      }

      return data?.data || initialDb;
    } catch (e: any) {
      console.error("Supabase Exception in get():", e.message);
      return initialDb;
    }
  }

  async save(data: any) {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .upsert({ id: this.rowId, data });

      if (error) {
        console.error("Supabase Save Error:", error);
      }
    } catch (e: any) {
      console.error("Supabase Exception in save():", e.message);
    }
  }
}

export const ensureDataIntegrity = (data: any) => {
  if (!data) return initialDb;
  return {
    users: data.users || initialDb.users,
    members: data.members || initialDb.members,
    events: data.events || initialDb.events,
    jobs: data.jobs || initialDb.jobs,
    settings: {
      guild_settings: {
        ...initialDb.settings.guild_settings,
        ...(data.settings?.guild_settings || {})
      }
    }
  };
};
