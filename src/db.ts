import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

// Database Interface
export interface Database {
  get: () => Promise<any>;
  save: (data: any) => Promise<void>;
  // Add granular methods for better performance
  getUsers: () => Promise<any>;
  saveUser: (user: any) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  getMembers: () => Promise<any>;
  saveMember: (member: any) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  getJobs: () => Promise<any>;
  saveJob: (job: any) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  getEvents: () => Promise<any>;
  saveEvent: (event: any) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  getSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<void>;
  seed: () => Promise<void>;
}

// File-based Database Implementation
const DB_FILE = "./db.json";
export const initialDb = {
  users: {
    "readyhit": {
      "id": "readyhit",
      "username": "readyhit",
      "displayName": "ReadyHit",
      "role": "superadmin",
      "createdAt": "2026-03-28T19:51:05Z",
      "password": "$2a$10$8KzX8KzX8KzX8KzX8KzX8Ou5ZIpBmHpdSOmA" // Placeholder, will be updated by seed
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

export class FileDatabase implements Database {
  constructor() {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
    }
  }

  async get() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const data = fs.readFileSync(DB_FILE, "utf-8");
        return JSON.parse(data);
      }
      return initialDb;
    } catch (e) {
      return initialDb;
    }
  }

  async save(data: any) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  }

  async getUsers() {
    const data = await this.get();
    return data.users || {};
  }

  async saveUser(user: any) {
    const data = await this.get();
    data.users[user.id] = user;
    await this.save(data);
  }

  async deleteUser(id: string) {
    const data = await this.get();
    delete data.users[id];
    await this.save(data);
  }

  async getMembers() {
    const data = await this.get();
    return data.members || [];
  }

  async saveMember(member: any) {
    const data = await this.get();
    const index = data.members.findIndex((m: any) => m.id === member.id);
    if (index !== -1) data.members[index] = member;
    else data.members.push(member);
    await this.save(data);
  }

  async deleteMember(id: string) {
    const data = await this.get();
    data.members = data.members.filter((m: any) => m.id !== id);
    await this.save(data);
  }

  async getJobs() {
    const data = await this.get();
    return data.jobs || [];
  }

  async saveJob(job: any) {
    const data = await this.get();
    const index = data.jobs.findIndex((j: any) => j.id === job.id);
    if (index !== -1) data.jobs[index] = job;
    else data.jobs.push(job);
    await this.save(data);
  }

  async deleteJob(id: string) {
    const data = await this.get();
    data.jobs = data.jobs.filter((j: any) => j.id !== id);
    await this.save(data);
  }

  async getEvents() {
    const data = await this.get();
    return data.events || [];
  }

  async saveEvent(event: any) {
    const data = await this.get();
    const index = data.events.findIndex((e: any) => e.id === event.id);
    if (index !== -1) data.events[index] = event;
    else data.events.push(event);
    await this.save(data);
  }

  async deleteEvent(id: string) {
    const data = await this.get();
    data.events = data.events.filter((e: any) => e.id !== id);
    await this.save(data);
  }

  async getSettings() {
    const data = await this.get();
    return data.settings?.guild_settings || initialDb.settings.guild_settings;
  }

  async saveSettings(settings: any) {
    const data = await this.get();
    data.settings.guild_settings = settings;
    await this.save(data);
  }

  async seed() {
    const users = await this.getUsers();
    if (!users["readyhit"]) {
      const hashedPassword = await bcrypt.hash("s5ZIpBmHpdSOmA", 10);
      await this.saveUser({
        id: "readyhit",
        username: "readyhit",
        displayName: "ReadyHit",
        role: "superadmin",
        createdAt: new Date().toISOString(),
        password: hashedPassword
      });
    } else {
      // Ensure password is correct for ReadyHit if it was changed or needs reset
      const user = users["readyhit"];
      const isCorrect = await bcrypt.compare("s5ZIpBmHpdSOmA", user.password);
      if (!isCorrect) {
        user.password = await bcrypt.hash("s5ZIpBmHpdSOmA", 10);
        await this.saveUser(user);
      }
    }
  }
}

export class SupabaseDatabase implements Database {
  private supabase;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be provided");
    }

    if (url.includes("YOUR_") || key.includes("YOUR_") || url.includes("TODO") || key.includes("TODO")) {
      console.warn("WARNING: Supabase URL or Key appears to be a placeholder. Please check your environment variables in the AI Studio Settings.");
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
      const [users, members, jobs, events, settings] = await Promise.all([
        this.getUsers(),
        this.getMembers(),
        this.getJobs(),
        this.getEvents(),
        this.getSettings()
      ]);

      return {
        users,
        members,
        jobs,
        events,
        settings: { guild_settings: settings }
      };
    } catch (e: any) {
      console.error("Supabase Exception in get():", e.message);
      return initialDb;
    }
  }

  async save(data: any) {
    // This is a legacy method, we should prefer granular saves
    // But for compatibility, we'll try to save everything (not recommended for performance)
    try {
      const promises = [];
      if (data.users) {
        for (const user of Object.values(data.users)) {
          promises.push(this.saveUser(user));
        }
      }
      if (data.members) {
        for (const member of data.members) {
          promises.push(this.saveMember(member));
        }
      }
      if (data.jobs) {
        for (const job of data.jobs) {
          promises.push(this.saveJob(job));
        }
      }
      if (data.events) {
        for (const event of data.events) {
          promises.push(this.saveEvent(event));
        }
      }
      if (data.settings?.guild_settings) {
        promises.push(this.saveSettings(data.settings.guild_settings));
      }
      await Promise.all(promises);
    } catch (e: any) {
      console.error("Supabase Exception in save():", e.message);
    }
  }

  async getUsers() {
    const { data, error } = await this.supabase.from('users').select('*');
    if (error) {
      if (!error.message.includes("Could not find the table")) {
        console.error("Supabase Get Users Error:", error.message);
      }
      return initialDb.users;
    }
    const usersObj: any = {};
    data?.forEach(u => {
      usersObj[u.id] = {
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        role: u.role,
        createdAt: u.created_at,
        password: u.password_hash // Map hash to password field for app compatibility
      };
    });
    return usersObj;
  }

  async saveUser(user: any) {
    const { error } = await this.supabase.from('users').upsert({
      id: user.id,
      username: user.username,
      display_name: user.displayName,
      role: user.role,
      password_hash: user.password
    });
    if (error) console.error("Supabase Save User Error:", error.message);
  }

  async deleteUser(id: string) {
    const { error } = await this.supabase.from('users').delete().eq('id', id);
    if (error) console.error("Supabase Delete User Error:", error.message);
  }

  async getMembers() {
    const { data, error } = await this.supabase.from('members').select('*');
    if (error) {
      if (!error.message.includes("Could not find the table")) {
        console.error("Supabase Get Members Error:", error.message);
      }
      return [];
    }
    return (data || []).map(m => ({
      id: m.id,
      ign: m.ign,
      job: m.job,
      dateJoined: m.date_joined,
      uid: m.uid
    }));
  }

  async saveMember(member: any) {
    const { error } = await this.supabase.from('members').upsert({
      id: member.id,
      ign: member.ign,
      job: member.job,
      date_joined: member.dateJoined,
      uid: member.uid
    });
    if (error) console.error("Supabase Save Member Error:", error.message);
  }

  async deleteMember(id: string) {
    const { error } = await this.supabase.from('members').delete().eq('id', id);
    if (error) console.error("Supabase Delete Member Error:", error.message);
  }

  async getJobs() {
    const { data, error } = await this.supabase.from('jobs').select('*');
    if (error) {
      if (!error.message.includes("Could not find the table")) {
        console.error("Supabase Get Jobs Error:", error.message);
      }
      return initialDb.jobs;
    }
    return data || [];
  }

  async saveJob(job: any) {
    const { error } = await this.supabase.from('jobs').upsert(job);
    if (error) console.error("Supabase Save Job Error:", error.message);
  }

  async deleteJob(id: string) {
    const { error } = await this.supabase.from('jobs').delete().eq('id', id);
    if (error) console.error("Supabase Delete Job Error:", error.message);
  }

  async getEvents() {
    const { data, error } = await this.supabase.from('events').select('*');
    if (error) {
      if (!error.message.includes("Could not find the table")) {
        console.error("Supabase Get Events Error:", error.message);
      }
      return [];
    }
    return data || [];
  }

  async saveEvent(event: any) {
    const { error } = await this.supabase.from('events').upsert(event);
    if (error) console.error("Supabase Save Event Error:", error.message);
  }

  async deleteEvent(id: string) {
    const { error } = await this.supabase.from('events').delete().eq('id', id);
    if (error) console.error("Supabase Delete Event Error:", error.message);
  }

  async getSettings() {
    const { data, error } = await this.supabase.from('settings').select('*').eq('id', 'guild_settings').single();
    if (error) {
      if (error.code !== 'PGRST116' && !error.message.includes("Could not find the table")) {
        console.error("Supabase Get Settings Error:", error.message);
      }
      return initialDb.settings.guild_settings;
    }
    return {
      name: data.name,
      subtitle: data.subtitle,
      timezone: data.timezone,
      logoUrl: data.logo_url
    };
  }

  async saveSettings(settings: any) {
    const { error } = await this.supabase.from('settings').upsert({
      id: 'guild_settings',
      name: settings.name,
      subtitle: settings.subtitle,
      timezone: settings.timezone,
      logo_url: settings.logoUrl
    });
    if (error) console.error("Supabase Save Settings Error:", error.message);
  }

  async seed() {
    const users = await this.getUsers();
    if (!users["readyhit"]) {
      const hashedPassword = await bcrypt.hash("s5ZIpBmHpdSOmA", 10);
      await this.saveUser({
        id: "readyhit",
        username: "readyhit",
        displayName: "ReadyHit",
        role: "superadmin",
        createdAt: new Date().toISOString(),
        password: hashedPassword
      });
    } else {
      const user = users["readyhit"];
      const isCorrect = await bcrypt.compare("s5ZIpBmHpdSOmA", user.password);
      if (!isCorrect) {
        user.password = await bcrypt.hash("s5ZIpBmHpdSOmA", 10);
        await this.saveUser(user);
      }
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
