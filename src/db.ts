import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const formatDateForDB = (dateString: string) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return dateString;
  }
};

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
  getMemberLogs: (memberId: string) => Promise<any[]>;
  getAllMemberLogs: () => Promise<any[]>;
  saveMemberLog: (log: any) => Promise<void>;
  getJobs: () => Promise<any>;
  saveJob: (job: any) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  getRoles: () => Promise<any>;
  saveRole: (role: any) => Promise<void>;
  deleteRole: (id: string) => Promise<void>;
  getEvents: () => Promise<any>;
  saveEvent: (event: any) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  getSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<void>;
  getRaffle: () => Promise<any>;
  saveRaffle: (raffle: any) => Promise<void>;
  getMemberById: (id: string) => Promise<any>;
  getJobById: (id: string) => Promise<any>;
  getEventById: (id: string) => Promise<any>;
  getUserById: (id: string) => Promise<any>;
  getEventShareLinks: (eventId: string) => Promise<any[]>;
  getEventShareLinkByToken: (token: string) => Promise<any>;
  saveEventShareLink: (link: any) => Promise<void>;
  deleteEventShareLink: (id: string) => Promise<void>;
  reorderEvents: (orderedIds: string[]) => Promise<void>;
  updateMembersJob: (oldJobName: string, newJobName: string) => Promise<void>;
  updateRoleName: (oldRoleName: string, newRoleName: string) => Promise<void>;
  updateAssignmentsRole: (memberId: string, newRole: string) => Promise<void>;
  seed: () => Promise<void>;
}

// File-based Database Implementation
const DB_FILE = "./db.json";
export const initialDb: any = {
  users: {},
  members: [],
  member_logs: {},
  events: [],
  event_share_links: [],
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
  roles: [
    { id: "1", name: "DPS", color: "#a1a1aa" },
    { id: "2", name: "Support", color: "#60a5fa" },
    { id: "3", name: "Tank", color: "#fb923c" },
    { id: "4", name: "Utility", color: "#34d399" }
  ],
  settings: {
    guild_settings: {
      name: 'Guild Name',
      timezone: 'Asia/Singapore',
      logoUrl: '',
      maxPartySize: 12,
      discordGuildId: '',
      discordAnnouncementsChannelId: '',
      discordAbsenceChannelId: '',
      discordWebhookUrl: '',
      disableSignups: false,
      raffleWinners: 2,
    }
  },
  raffle: {
    entries: [],
    winners: [],
    settings: {
      currentWeek: 1,
      currentMonth: 4,
      currentYear: 2026,
      isOpen: true
    }
  }
};

export class FileDatabase implements Database {
  private isVercel = process.env.VERCEL === '1';

  constructor() {
    try {
      if (!fs.existsSync(DB_FILE)) {
        if (this.isVercel) {
          console.warn("FileDatabase: Running on Vercel with no db.json. Writes will fail.");
          return;
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
      }
    } catch (e: any) {
      console.error("FileDatabase Constructor Error:", e.message);
    }
  }

  async get() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const data = fs.readFileSync(DB_FILE, "utf-8");
        return ensureDataIntegrity(JSON.parse(data));
      }
      return ensureDataIntegrity(initialDb);
    } catch (e) {
      return ensureDataIntegrity(initialDb);
    }
  }

  async save(data: any) {
    try {
      if (this.isVercel) {
        console.warn("FileDatabase: Cannot save to read-only filesystem on Vercel.");
        return;
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e: any) {
      console.error("FileDatabase Save Error:", e.message);
    }
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
    const members = data.members || [];
    let hasChanges = false;
    
    // Migrate existing dates to the new format
    const migratedMembers = members.map((m: any) => {
      const newDate = formatDateForDB(m.dateJoined);
      if (m.dateJoined !== newDate) {
        hasChanges = true;
        return { ...m, dateJoined: newDate };
      }
      return m;
    });
    
    if (hasChanges) {
      data.members = migratedMembers;
      await this.save(data);
    }
    
    return migratedMembers;
  }

  async saveMember(member: any) {
    const data = await this.get();
    const formattedMember = { ...member, dateJoined: formatDateForDB(member.dateJoined) };
    const index = data.members.findIndex((m: any) => m.id === formattedMember.id);
    if (index !== -1) data.members[index] = formattedMember;
    else data.members.push(formattedMember);
    await this.save(data);
  }

  async deleteMember(id: string) {
    const data = await this.get();
    data.members = data.members.filter((m: any) => m.id !== id);
    if (data.member_logs) delete data.member_logs[id];
    await this.save(data);
  }

  async getMemberLogs(memberId: string) {
    const data = await this.get();
    if (!data.member_logs) data.member_logs = {};
    
    // Cleanup logs older than 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const cutoff = threeMonthsAgo.getTime();
    
    let hasChanges = false;
    if (data.member_logs[memberId]) {
      const originalLength = data.member_logs[memberId].length;
      data.member_logs[memberId] = data.member_logs[memberId].filter((l: any) => new Date(l.timestamp).getTime() >= cutoff);
      if (data.member_logs[memberId].length !== originalLength) hasChanges = true;
    }
    
    if (hasChanges) await this.save(data);
    
    return data.member_logs[memberId] || [];
  }

  async getAllMemberLogs() {
    const data = await this.get();
    if (!data.member_logs) return [];
    
    // Cleanup logs older than 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const cutoff = threeMonthsAgo.getTime();
    let hasChanges = false;
    
    const allLogs: any[] = [];
    Object.keys(data.member_logs).forEach((memberId) => {
      const logs = data.member_logs[memberId];
      if (Array.isArray(logs)) {
        const originalLength = logs.length;
        const filteredLogs = logs.filter((l: any) => new Date(l.timestamp).getTime() >= cutoff);
        if (filteredLogs.length !== originalLength) {
          data.member_logs[memberId] = filteredLogs;
          hasChanges = true;
        }
        allLogs.push(...filteredLogs);
      }
    });
    
    if (hasChanges) await this.save(data);
    
    return allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async saveMemberLog(log: any) {
    const data = await this.get();
    if (!data.member_logs) data.member_logs = {};
    if (!data.member_logs[log.memberId]) data.member_logs[log.memberId] = [];
    data.member_logs[log.memberId].push({ ...log, id: Date.now().toString() });
    
    // Cleanup logs older than 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const cutoff = threeMonthsAgo.getTime();
    data.member_logs[log.memberId] = data.member_logs[log.memberId].filter((l: any) => new Date(l.timestamp).getTime() >= cutoff);
    
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

  async getRoles() {
    const data = await this.get();
    return data.roles || initialDb.roles;
  }

  async saveRole(role: any) {
    const data = await this.get();
    if (!data.roles) data.roles = [];
    const index = data.roles.findIndex((r: any) => r.id === role.id);
    if (index !== -1) data.roles[index] = role;
    else data.roles.push(role);
    await this.save(data);
  }

  async deleteRole(id: string) {
    const data = await this.get();
    if (!data.roles) return;
    data.roles = data.roles.filter((r: any) => r.id !== id);
    await this.save(data);
  }

  async getEvents() {
    const data = await this.get();
    return data.events || [];
  }

  async saveEvent(event: any) {
    console.log("Saving event:", event.id, "Schedule:", event.schedule);
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

  async getRaffle() {
    const data = await this.get();
    return JSON.parse(JSON.stringify(data.raffle || initialDb.raffle));
  }

  async saveRaffle(raffle: any) {
    const data = await this.get();
    data.raffle = raffle;
    await this.save(data);
  }

  async getMemberById(id: string) {
    const data = await this.get();
    return data.members.find((m: any) => m.id === id);
  }

  async getJobById(id: string) {
    const data = await this.get();
    return data.jobs.find((j: any) => j.id === id);
  }

  async getEventById(id: string) {
    const data = await this.get();
    return data.events.find((e: any) => e.id === id);
  }

  async getUserById(id: string) {
    const data = await this.get();
    return data.users[id];
  }

  async reorderEvents(orderedIds: string[]) {
    const data = await this.get();
    data.events = orderedIds.map((id, index) => {
      const event = data.events.find((e: any) => e.id === id);
      return { ...event, order: index };
    });
    await this.save(data);
  }

  async updateMembersJob(oldJobName: string, newJobName: string) {
    const data = await this.get();
    data.members = data.members.map((m: any) => 
      m.job === oldJobName ? { ...m, job: newJobName } : m
    );
    await this.save(data);
  }

  async updateRoleName(oldRoleName: string, newRoleName: string) {
    const data = await this.get();
    
    // Update members
    data.members = (data.members || []).map((m: any) => 
      m.role === oldRoleName ? { ...m, role: newRoleName } : m
    );

    // Update assignments
    data.events = (data.events || []).map((event: any) => ({
      ...event,
      subevents: (event.subevents || []).map((subevent: any) => ({
        ...subevent,
        parties: (subevent.parties || []).map((party: any) => ({
          ...party,
          assignments: (party.assignments || []).map((assignment: any) => 
            assignment.role === oldRoleName ? { ...assignment, role: newRoleName } : assignment
          )
        }))
      }))
    }));
    await this.save(data);
  }

  async updateAssignmentsRole(memberId: string, newRole: string) {
    const data = await this.get();
    data.events = (data.events || []).map((event: any) => ({
      ...event,
      subevents: (event.subevents || []).map((subevent: any) => ({
        ...subevent,
        parties: (subevent.parties || []).map((party: any) => ({
          ...party,
          assignments: (party.assignments || []).map((assignment: any) => 
            assignment.memberId === memberId ? { ...assignment, role: newRole } : assignment
          )
        }))
      }))
    }));
    await this.save(data);
  }

  async getEventShareLinks(eventId: string) {
    const data = await this.get();
    return (data.event_share_links || []).filter((l: any) => l.eventId === eventId);
  }

  async getEventShareLinkByToken(token: string) {
    const data = await this.get();
    return (data.event_share_links || []).find((l: any) => l.token === token);
  }

  async saveEventShareLink(link: any) {
    const data = await this.get();
    if (!data.event_share_links) data.event_share_links = [];
    const index = data.event_share_links.findIndex((l: any) => l.id === link.id);
    if (index >= 0) {
      data.event_share_links[index] = link;
    } else {
      data.event_share_links.push(link);
    }
    await this.save(data);
  }

  async deleteEventShareLink(id: string) {
    const data = await this.get();
    if (data.event_share_links) {
      data.event_share_links = data.event_share_links.filter((l: any) => l.id !== id);
      await this.save(data);
    }
  }

  async seed() {
    // No default users created here to ensure fresh installs are clean.
    // Users are created via the Setup Wizard.
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
      console.warn("WARNING: Supabase URL or Key appears to be a placeholder. Please check your environment variables.");
    }

    try {
      new URL(url);
      console.log(`Supabase URL validated: ${url}`);
    } catch (e) {
      throw new Error(`Invalid SUPABASE_URL: ${url}. Please ensure it starts with https://`);
    }

    console.log("Creating Supabase client...");
    this.supabase = createClient(url, key);
    console.log("Supabase client created successfully");
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
    try {
      const { data, error } = await this.supabase.from('users').select('*');
      if (error) {
        if (!error.message.includes("Could not find the table")) {
          console.error("Supabase Get Users Error:", error.message, error.code);
        }
        return initialDb.users;
      }
      const usersObj: any = {};
      data?.forEach(u => {
        usersObj[u.id] = {
          id: u.id,
          username: u.username,
          displayName: u.display_name,
          ign: u.ign,
          uid: u.uid,
          isApproved: u.is_approved,
          role: u.role,
          createdAt: u.created_at,
          password: u.password_hash // Map hash to password field for app compatibility
        };
      });
      return usersObj;
    } catch (e: any) {
      console.error("Supabase Exception in getUsers():", e.message);
      return initialDb.users;
    }
  }

  async saveUser(user: any) {
    const { error } = await this.supabase.from('users').upsert({
      id: user.id,
      username: user.username,
      display_name: user.displayName,
      ign: user.ign,
      uid: user.uid,
      is_approved: user.isApproved,
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
    try {
      const { data, error } = await this.supabase.from('members').select('*');
      if (error) {
        if (!error.message.includes("Could not find the table")) {
          console.error("Supabase Get Members Error:", error.message, error.code);
        }
        return [];
      }
      
      const members = (data || []).map(m => ({
        id: m.id,
        ign: m.ign,
        job: m.job,
        role: m.role,
        dateJoined: m.date_joined,
        uid: m.uid,
        status: m.status || 'active',
        leaveReason: m.leave_reason,
        leaveDates: m.leave_dates || [],
        leaveStartedAt: m.leave_started_at
      }));

      // Migrate existing dates to the new format
      let hasChanges = false;
      const migratedMembers = members.map(m => {
        const newDate = formatDateForDB(m.dateJoined);
        if (m.dateJoined !== newDate) {
          hasChanges = true;
          // Fire and forget update to DB
          this.supabase.from('members').update({ date_joined: newDate }).eq('id', m.id).then();
          return { ...m, dateJoined: newDate };
        }
        return m;
      });

      return migratedMembers;
    } catch (e: any) {
      console.error("Supabase Exception in getMembers():", e.message);
      return [];
    }
  }

  async saveMember(member: any) {
    const payload: any = {
      id: member.id,
      ign: member.ign,
      job: member.job,
      role: member.role,
      date_joined: formatDateForDB(member.dateJoined),
      uid: member.uid,
      status: member.status || 'active',
      leave_reason: member.leaveReason,
      leave_dates: member.leaveDates || [],
      leave_started_at: member.leaveStartedAt
    };

    const { error } = await this.supabase.from('members').upsert(payload);
    
    if (error) {
      console.error("Supabase Save Member Error:", error.message);
      
      // Handle missing columns by retrying without them
      if (error.message.toLowerCase().includes("column") && (error.message.toLowerCase().includes("not found") || error.message.toLowerCase().includes("could not find"))) {
        const cleanPayload = { ...payload };
        // Try to match column name in single or double quotes
        const missingColumn = error.message.match(/column ['"]([^'"]+)['"]/) || error.message.match(/['"]([^'"]+)['"] column/);
        const columnName = missingColumn ? missingColumn[1] : null;
        
        if (columnName && cleanPayload[columnName] !== undefined) {
          console.warn(`Retrying saveMember without missing column: ${columnName}`);
          delete cleanPayload[columnName];
          const { error: retryError } = await this.supabase.from('members').upsert(cleanPayload);
          if (retryError) {
            // If it fails again, it might be ANOTHER column missing
            const secondMissingColumn = retryError.message.match(/column ['"]([^'"]+)['"]/) || retryError.message.match(/['"]([^'"]+)['"] column/);
            const secondColumnName = secondMissingColumn ? secondMissingColumn[1] : null;
            if (secondColumnName && cleanPayload[secondColumnName] !== undefined) {
              console.warn(`Retrying saveMember without second missing column: ${secondColumnName}`);
              delete cleanPayload[secondColumnName];
              const { error: thirdError } = await this.supabase.from('members').upsert(cleanPayload);
              if (thirdError) {
                // Try one more time for the third possible missing column
                const thirdMissingColumn = thirdError.message.match(/column ['"]([^'"]+)['"]/) || thirdError.message.match(/['"]([^'"]+)['"] column/);
                const thirdColumnName = thirdMissingColumn ? thirdMissingColumn[1] : null;
                if (thirdColumnName && cleanPayload[thirdColumnName] !== undefined) {
                  console.warn(`Retrying saveMember without third missing column: ${thirdColumnName}`);
                  delete cleanPayload[thirdColumnName];
                  await this.supabase.from('members').upsert(cleanPayload);
                }
              }
            }
          }
        }
      }
    }
  }

  async deleteMember(id: string) {
    const { error } = await this.supabase.from('members').delete().eq('id', id);
    if (error) console.error("Supabase Delete Member Error:", error.message);
  }

  async getMemberLogs(memberId: string) {
    try {
      // Cleanup logs older than 3 months
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      await this.supabase.from('member_logs').delete().lt('timestamp', threeMonthsAgo.toISOString());

      const { data, error } = await this.supabase.from('member_logs').select('*').eq('member_id', memberId).order('timestamp', { ascending: false });
      if (error) {
        console.error("Supabase Get Member Logs Error:", error.message);
        return [];
      }
      return (data || []).map(l => ({
        id: l.id,
        memberId: l.member_id,
        type: l.type,
        oldValue: l.old_value,
        newValue: l.new_value,
        details: l.details,
        timestamp: l.timestamp
      }));
    } catch (e: any) {
      console.error("Supabase Exception in getMemberLogs():", e.message);
      return [];
    }
  }

  async getAllMemberLogs() {
    try {
      // Cleanup logs older than 3 months
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      await this.supabase.from('member_logs').delete().lt('timestamp', threeMonthsAgo.toISOString());

      const { data, error } = await this.supabase.from('member_logs').select('*').order('timestamp', { ascending: false });
      if (error) {
        console.error("Supabase Get All Member Logs Error:", error.message);
        return [];
      }
      return (data || []).map(l => ({
        id: l.id,
        memberId: l.member_id,
        type: l.type,
        oldValue: l.old_value,
        newValue: l.new_value,
        details: l.details,
        timestamp: l.timestamp
      }));
    } catch (e: any) {
      console.error("Supabase Exception in getAllMemberLogs():", e.message);
      return [];
    }
  }

  async saveMemberLog(log: any) {
    const { error } = await this.supabase.from('member_logs').insert({
      id: log.id || Date.now().toString(),
      member_id: log.memberId,
      type: log.type,
      old_value: log.oldValue,
      new_value: log.newValue,
      details: log.details,
      timestamp: log.timestamp || new Date().toISOString()
    });
    if (error) console.error("Supabase Save Member Log Error:", error.message);
    
    // Cleanup logs older than 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    await this.supabase.from('member_logs').delete().lt('timestamp', threeMonthsAgo.toISOString());
  }

  async getJobs() {
    try {
      const { data, error } = await this.supabase.from('jobs').select('*');
      if (error) {
        if (!error.message.includes("Could not find the table")) {
          console.error("Supabase Get Jobs Error:", error.message, error.code);
        }
        return initialDb.jobs;
      }
      if (!data || data.length === 0) {
        // Seed initial jobs if empty
        for (const job of initialDb.jobs) {
          await this.saveJob(job);
        }
        return initialDb.jobs;
      }
      return data;
    } catch (e: any) {
      console.error("Supabase Exception in getJobs():", e.message);
      return initialDb.jobs;
    }
  }

  async saveJob(job: any) {
    const { error } = await this.supabase.from('jobs').upsert(job);
    if (error) console.error("Supabase Save Job Error:", error.message);
  }

  async deleteJob(id: string) {
    const { error } = await this.supabase.from('jobs').delete().eq('id', id);
    if (error) console.error("Supabase Delete Job Error:", error.message);
  }

  async getRoles() {
    try {
      const { data, error } = await this.supabase.from('roles').select('*');
      if (error) {
        if (!error.message.includes("Could not find the table")) {
          console.error("Supabase Get Roles Error:", error.message, error.code);
        }
        return initialDb.roles;
      }
      if (!data || data.length === 0) {
        // Seed initial roles if empty
        for (const role of initialDb.roles) {
          await this.saveRole(role);
        }
        return initialDb.roles;
      }
      return data;
    } catch (e: any) {
      console.error("Supabase Exception in getRoles():", e.message);
      return initialDb.roles;
    }
  }

  async saveRole(role: any) {
    const { error } = await this.supabase.from('roles').upsert(role);
    if (error) console.error("Supabase Save Role Error:", error.message);
  }

  async deleteRole(id: string) {
    const { error } = await this.supabase.from('roles').delete().eq('id', id);
    if (error) console.error("Supabase Delete Role Error:", error.message);
  }

  async getEvents() {
    try {
      let { data, error } = await this.supabase.from('events').select('*').order('order', { ascending: true });
      
      if (error) {
        // Fallback if 'order' column doesn't exist yet
        if (error.code === '42703' || error.message.includes('column "order" does not exist')) {
          console.warn("Supabase: 'order' column missing in events table, falling back to unordered query.");
          const fallback = await this.supabase.from('events').select('*');
          data = fallback.data;
          error = fallback.error;
        }
      }

      if (error) {
        if (!error.message.includes("Could not find the table")) {
          console.error("Supabase Get Events Error:", error.message, error.code);
        }
        return [];
      }
      return (data || []).map((event: any) => ({
        ...event,
        schedule: Array.isArray(event.schedule) ? event.schedule : [],
        absences: Array.isArray(event.absences) ? event.absences : []
      }));
    } catch (e: any) {
      console.error("Supabase Exception in getEvents():", e.message);
      return [];
    }
  }

  /**
   * Saves an event to Supabase.
   * NOTE: If you are using Supabase, you MUST run these SQL commands in your Supabase SQL Editor:
   * 
   * -- 1. Roles Table
   * CREATE TABLE IF NOT EXISTS roles (
   *   id TEXT PRIMARY KEY,
   *   name TEXT NOT NULL UNIQUE,
   *   color TEXT NOT NULL,
   *   created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   * );
   * 
   * -- 2. Jobs Table
   * CREATE TABLE IF NOT EXISTS jobs (
   *   id TEXT PRIMARY KEY,
   *   name TEXT NOT NULL UNIQUE,
   *   created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   * );
   * 
   * -- 3. Members Table
   * CREATE TABLE IF NOT EXISTS members (
   *   id TEXT PRIMARY KEY,
   *   ign TEXT NOT NULL,
   *   job TEXT,
   *   role TEXT,
   *   date_joined TEXT,
   *   uid TEXT,
   *   status TEXT DEFAULT 'active',
   *   leave_reason TEXT,
   *   leave_dates JSONB DEFAULT '[]'::jsonb,
   *   leave_started_at TIMESTAMP WITH TIME ZONE,
   *   created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   * );
   * 
   * -- 4. Member Logs Table
   * CREATE TABLE IF NOT EXISTS member_logs (
   *   id TEXT PRIMARY KEY,
   *   member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
   *   type TEXT NOT NULL,
   *   old_value TEXT,
   *   new_value TEXT,
   *   details TEXT,
   *   timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   * );
   * 
   * -- 5. Events Table
   * CREATE TABLE IF NOT EXISTS events (
   *   id TEXT PRIMARY KEY,
   *   name TEXT NOT NULL,
   *   description TEXT,
   *   instructions TEXT,
   *   schedule JSONB DEFAULT '[]'::jsonb,
   *   absences JSONB DEFAULT '[]'::jsonb,
   *   subevents JSONB DEFAULT '[]'::jsonb,
   *   "order" INTEGER DEFAULT 0,
   *   created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   * );
   * 
   * -- 6. Users Table
   * CREATE TABLE IF NOT EXISTS users (
   *   id TEXT PRIMARY KEY,
   *   username TEXT NOT NULL,
   *   display_name TEXT,
   *   ign TEXT,
   *   uid TEXT,
   *   role TEXT DEFAULT 'user',
   *   is_approved BOOLEAN DEFAULT false,
   *   password_hash TEXT NOT NULL,
   *   created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   * );
   */
  async saveEvent(event: any) {
    try {
      const { error } = await this.supabase.from('events').upsert(event);
      if (error) {
        // If the error is about a missing column, try saving without the problematic fields
        if (error.message.includes("Could not find the 'schedule' column") || 
            error.message.includes("Could not find the 'absences' column")) {
          
          console.warn(`Supabase Warning: Missing column in 'events' table. Retrying without missing fields.`);
          
          const eventToSave = { ...event };
          if (error.message.includes("Could not find the 'schedule' column")) {
            delete eventToSave.schedule;
          }
          if (error.message.includes("Could not find the 'absences' column")) {
            delete eventToSave.absences;
          }

          const { error: retryError } = await this.supabase.from('events').upsert(eventToSave);
          if (retryError) {
            // If it fails again, it might be the OTHER column missing
            if (retryError.message.includes("Could not find the 'schedule' column") || 
                retryError.message.includes("Could not find the 'absences' column")) {
              
              const finalEventToSave = { ...eventToSave };
              if (retryError.message.includes("Could not find the 'schedule' column")) {
                delete finalEventToSave.schedule;
              }
              if (retryError.message.includes("Could not find the 'absences' column")) {
                delete finalEventToSave.absences;
              }
              
              const { error: finalRetryError } = await this.supabase.from('events').upsert(finalEventToSave);
              if (finalRetryError) {
                console.error("Supabase Final Retry Save Event Error:", finalRetryError.message);
                throw new Error(`Failed to save event after final retry: ${finalRetryError.message}`);
              }
              return;
            }
            
            console.error("Supabase Retry Save Event Error:", retryError.message);
            throw new Error(`Failed to save event after retry: ${retryError.message}`);
          }
          return;
        }
        console.error("Supabase Save Event Error:", error.message, error.details, error.hint);
        throw new Error(`Failed to save event: ${error.message}`);
      }
    } catch (e: any) {
      console.error("Supabase Exception in saveEvent():", e.message);
      throw e;
    }
  }

  async deleteEvent(id: string) {
    const { error } = await this.supabase.from('events').delete().eq('id', id);
    if (error) console.error("Supabase Delete Event Error:", error.message);
  }

  async reorderEvents(orderedIds: string[]) {
    const updates = orderedIds.map((id, index) => 
      this.supabase.from('events').update({ order: index }).eq('id', id)
    );
    await Promise.all(updates);
  }

  async getSettings() {
    try {
      const { data, error } = await this.supabase.from('settings').select('*').eq('id', 'guild_settings').single();
      if (error) {
        if (error.code === 'PGRST116') {
          // Record not found, initialize it
          const initialState = initialDb.settings.guild_settings;
          await this.saveSettings(initialState);
          return initialState;
        }
        
        if (!error.message.includes("Could not find the table")) {
          console.error("Supabase Get Settings Error:", error.message);
        }
        return initialDb.settings.guild_settings;
      }
      if (!data) return initialDb.settings.guild_settings;
      return {
        name: data.name,
        timezone: data.timezone,
        logoUrl: data.logo_url,
        maxPartySize: data.max_party_size || 12,
        discordGuildId: data.discord_guild_id || '',
        discordAnnouncementsChannelId: data.discord_announcements_channel_id || '',
        discordAbsenceChannelId: data.discord_absence_channel_id || '',
        githubRepo: data.github_repo || '',
        disableSignups: data.disable_signups || false,
        raffleWinners: data.raffle_winners || 2
      };
    } catch (e: any) {
      console.error("Supabase Exception in getSettings():", e.message);
      return initialDb.settings.guild_settings;
    }
  }

  async saveSettings(settings: any) {
    const payload: any = {
      id: 'guild_settings',
      name: settings.name,
      timezone: settings.timezone,
      logo_url: settings.logoUrl,
      max_party_size: settings.maxPartySize,
    };

    // Only add Discord fields if they are provided, to avoid schema errors if columns are missing
    // Note: If columns are missing, Supabase will still throw an error on upsert if we include them.
    if (settings.discordGuildId !== undefined) payload.discord_guild_id = settings.discordGuildId;
    if (settings.discordAnnouncementsChannelId !== undefined) payload.discord_announcements_channel_id = settings.discordAnnouncementsChannelId;
    if (settings.discordAbsenceChannelId !== undefined) payload.discord_absence_channel_id = settings.discordAbsenceChannelId;
    if (settings.githubRepo !== undefined) payload.github_repo = settings.githubRepo;
    if (settings.disableSignups !== undefined) payload.disable_signups = settings.disableSignups;
    if (settings.raffleWinners !== undefined) payload.raffle_winners = settings.raffleWinners;

    const { error } = await this.supabase.from('settings').upsert(payload);
    if (error) {
      console.error("Supabase Save Settings Error:", error.message);
      
      // Handle missing columns by retrying without them
      if (error.message.includes("column") && error.message.includes("not found")) {
        const cleanPayload = { ...payload };
        const missingColumn = error.message.match(/column "([^"]+)"/)?.[1];
        
        if (missingColumn && cleanPayload[missingColumn] !== undefined) {
          console.warn(`Retrying saveSettings without missing column: ${missingColumn}`);
          delete cleanPayload[missingColumn];
          const { error: retryError } = await this.supabase.from('settings').upsert(cleanPayload);
          if (retryError) console.error("Supabase Retry Save Settings Error:", retryError.message);
        }
      }
    }
  }

  async getRaffle() {
    try {
      const { data, error } = await this.supabase.from('raffle').select('*').eq('id', 'main').single();
      if (error) {
        if (error.code === 'PGRST116') {
          // Record not found, initialize it
          const initialState = JSON.parse(JSON.stringify(initialDb.raffle));
          await this.saveRaffle(initialState);
          return initialState;
        }
        
        if (!error.message.includes("Could not find the table")) {
          console.error("Supabase Get Raffle Error:", error.message);
        }
        return JSON.parse(JSON.stringify(initialDb.raffle));
      }
      
      return {
        entries: Array.isArray(data.entries) ? data.entries : [],
        winners: Array.isArray(data.winners) ? data.winners : [],
        settings: data.settings || initialDb.raffle.settings
      };
    } catch (e: any) {
      console.error("Supabase Exception in getRaffle():", e.message);
      return JSON.parse(JSON.stringify(initialDb.raffle));
    }
  }

  async saveRaffle(raffle: any) {
    console.log('[Supabase] Saving raffle data...');
    const { error } = await this.supabase.from('raffle').upsert({ 
      id: 'main', 
      entries: raffle.entries || [],
      winners: raffle.winners || [],
      settings: raffle.settings || {}
    });
    if (error) {
      console.error("Supabase Save Raffle Error:", error.message, error.details, error.hint);
    } else {
      console.log('[Supabase] Raffle data saved successfully.');
    }
  }

  async getMemberById(id: string) {
    const { data, error } = await this.supabase.from('members').select('*').eq('id', id).single();
    if (error) return null;
    return {
      id: data.id,
      ign: data.ign,
      job: data.job,
      role: data.role,
      dateJoined: data.date_joined,
      uid: data.uid,
      status: data.status || 'active'
    };
  }

  async getJobById(id: string) {
    const { data, error } = await this.supabase.from('jobs').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  }

  async getEventById(id: string) {
    const { data, error } = await this.supabase.from('events').select('*').eq('id', id).single();
    if (error) return null;
    return {
      ...data,
      schedule: Array.isArray(data.schedule) ? data.schedule : [],
      absences: Array.isArray(data.absences) ? data.absences : []
    };
  }

  async getUserById(id: string) {
    const { data, error } = await this.supabase.from('users').select('*').eq('id', id).single();
    if (error) return null;
    return {
      id: data.id,
      username: data.username,
      displayName: data.display_name,
      ign: data.ign,
      uid: data.uid,
      isApproved: data.is_approved,
      role: data.role,
      createdAt: data.created_at,
      password: data.password_hash
    };
  }

  async getEventShareLinks(eventId: string) {
    const { data, error } = await this.supabase.from('event_share_links').select('*').eq('event_id', eventId);
    if (error) {
      console.error("Supabase Get EventShareLinks Error:", error.message);
      return [];
    }
    return data.map((l: any) => ({
      id: l.id,
      eventId: l.event_id,
      token: l.token,
      createdAt: l.created_at,
      expiresAt: l.expires_at
    }));
  }

  async getEventShareLinkByToken(token: string) {
    const { data, error } = await this.supabase.from('event_share_links').select('*').eq('token', token).single();
    if (error) return null;
    return {
      id: data.id,
      eventId: data.event_id,
      token: data.token,
      createdAt: data.created_at,
      expiresAt: data.expires_at
    };
  }

  async saveEventShareLink(link: any) {
    const payload = {
      id: link.id,
      event_id: link.eventId,
      token: link.token,
      created_at: link.createdAt,
      expires_at: link.expiresAt
    };
    const { error } = await this.supabase.from('event_share_links').upsert(payload);
    if (error) console.error("Supabase Save EventShareLink Error:", error.message);
  }

  async deleteEventShareLink(id: string) {
    const { error } = await this.supabase.from('event_share_links').delete().eq('id', id);
    if (error) console.error("Supabase Delete EventShareLink Error:", error.message);
  }

  async updateMembersJob(oldJobName: string, newJobName: string) {
    const { error } = await this.supabase.from('members').update({ job: newJobName }).eq('job', oldJobName);
    if (error) console.error("Supabase Update Members Job Error:", error.message);
  }

  async updateRoleName(oldRoleName: string, newRoleName: string) {
    // Update members
    const { error: membersError } = await this.supabase.from('members').update({ role: newRoleName }).eq('role', oldRoleName);
    if (membersError) console.error("Supabase Update Members Role Error:", membersError.message);

    // Update assignments
    const events = await this.getEvents();
    const updatedEvents = events.map((event: any) => ({
      ...event,
      subevents: (event.subevents || []).map((subevent: any) => ({
        ...subevent,
        parties: (subevent.parties || []).map((party: any) => ({
          ...party,
          assignments: (party.assignments || []).map((assignment: any) => 
            assignment.role === oldRoleName ? { ...assignment, role: newRoleName } : assignment
          )
        }))
      }))
    }));
    
    for (const event of updatedEvents) {
      await this.saveEvent(event);
    }
  }

  async updateAssignmentsRole(memberId: string, newRole: string) {
    const events = await this.getEvents();
    const updatedEvents = events.map((event: any) => ({
      ...event,
      subevents: (event.subevents || []).map((subevent: any) => ({
        ...subevent,
        parties: (subevent.parties || []).map((party: any) => ({
          ...party,
          assignments: (party.assignments || []).map((assignment: any) => 
            assignment.memberId === memberId ? { ...assignment, role: newRole } : assignment
          )
        }))
      }))
    }));
    
    for (const event of updatedEvents) {
      await this.saveEvent(event);
    }
  }

  async seed() {
    try {
      console.log("Checking database initialization...");
      const users = await this.getUsers();
      console.log(`Current users count: ${Object.keys(users).length}`);
      if (Object.keys(users).length === 0) {
        console.log("Database is empty. Waiting for setup wizard...");
      }
    } catch (e: any) {
      console.error("Database Check Error:", e.message);
    }
  }
}

export const ensureDataIntegrity = (data: any) => {
  if (!data) return initialDb;
  
  // Ensure events have schedules and absences
  const events = (data.events || initialDb.events).map((event: any) => ({
    ...event,
    schedule: Array.isArray(event.schedule) ? event.schedule : [],
    absences: Array.isArray(event.absences) ? event.absences : []
  }));

  return {
    users: data.users || initialDb.users,
    members: data.members || initialDb.members,
    events,
    jobs: data.jobs || initialDb.jobs,
    settings: {
      guild_settings: {
        ...initialDb.settings.guild_settings,
        ...(data.settings?.guild_settings || {})
      }
    },
    raffle: data.raffle || initialDb.raffle
  };
};
