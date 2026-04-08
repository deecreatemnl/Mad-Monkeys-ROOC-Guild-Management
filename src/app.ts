import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import axios from "axios";
import fs from "fs";
import path from "path";
import { Database, FileDatabase, SupabaseDatabase, ensureDataIntegrity } from "./db.js";

export const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export function createApp(emitUpdate?: (type: string, data?: any) => void) {
  const app = express();

  // Initialize Database
  let db: Database;
  const isVercel = process.env.VERCEL === '1';
  const hasSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY;

  if (isVercel && !hasSupabase) {
    console.warn("WARNING: Running on Vercel without Supabase configuration. Data persistence will not work.");
  }

  try {
    console.log(`Initializing database... Vercel: ${isVercel}, Supabase: ${!!hasSupabase}`);
    db = hasSupabase 
      ? new SupabaseDatabase() 
      : new FileDatabase();
    
    console.log("Database initialized successfully");
    // Seed database
    db.seed().catch(err => {
      if (isVercel && !hasSupabase) {
        // Ignore seed errors on Vercel when using FileDatabase as it's expected to fail
        return;
      }
      console.error("Database Seeding Error:", err.message);
    });
  } catch (error: any) {
    console.error("Database Initialization Error:", error.message);
    db = new FileDatabase();
  }

  app.use(cors({
    allowedHeaders: ['Content-Type', 'Authorization', 'user-role'],
    origin: true,
    credentials: true
  }));
  app.use(express.json({ limit: '50mb' }));

  // Debug middleware for raffle API
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/raffle')) {
      console.log(`[Raffle API Debug] Path: ${req.path}, Method: ${req.method}, Role: ${req.headers['user-role']}`);
    }
    next();
  });

  // Security Middleware
  const checkAdmin = (req: any, res: any, next: any) => {
    const role = req.headers['user-role'];
    if (role === 'admin' || role === 'superadmin') {
      next();
    } else {
      res.status(403).json({ error: "Access denied. Admin privileges required." });
    }
  };

  const checkSuperAdmin = (req: any, res: any, next: any) => {
    const role = req.headers['user-role'];
    if (role === 'superadmin') {
      next();
    } else {
      res.status(403).json({ error: "Access denied. Superadmin privileges required." });
    }
  };

  const checkSelf = (req: any, res: any, next: any) => {
    const loggedInUser = req.headers['user-id'];
    const targetUser = req.body.username?.trim().toLowerCase() || req.params.id?.trim().toLowerCase();
    
    if (loggedInUser === targetUser || req.headers['user-role'] === 'superadmin') {
      next();
    } else {
      res.status(403).json({ error: "Access denied. You can only modify your own account." });
    }
  };

  // Setup API - For initial configuration
  app.get("/api/setup/status", asyncHandler(async (req: any, res: any) => {
    const users = await db.getUsers();
    const hasSuperAdmin = Object.values(users).some((u: any) => u.role === 'superadmin');
    res.json({ isSetup: hasSuperAdmin });
  }));

  app.post("/api/setup/init", asyncHandler(async (req: any, res: any) => {
    const users = await db.getUsers();
    const hasSuperAdmin = Object.values(users).some((u: any) => u.role === 'superadmin');
    
    if (hasSuperAdmin) {
      return res.status(403).json({ error: "System already setup" });
    }

    const { username, password, displayName, guildName } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const superAdmin = {
      id: username.toLowerCase(),
      username,
      displayName: displayName || username,
      role: 'superadmin',
      isApproved: true,
      createdAt: new Date().toISOString(),
      password: hashedPassword
    };

    await db.saveUser(superAdmin);

    // Save initial guild settings if provided
    if (guildName) {
      const settings = await db.getSettings();
      await db.saveSettings({ ...settings, name: guildName });
    }

    res.json({ success: true, message: "Superadmin created successfully" });
  }));

  // Health check
  // Check for Discord environment variables
  const discordConfig = {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    botToken: process.env.DISCORD_BOT_TOKEN
  };

  if (!discordConfig.clientId || !discordConfig.clientSecret || !discordConfig.botToken) {
    console.warn("⚠️ Discord Integration: Missing environment variables (DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, or DISCORD_BOT_TOKEN). Discord features will be disabled.");
  }

  app.get("/api/health", asyncHandler(async (req: any, res: any) => {
    let dbStatus = "unknown";
    try {
      const users = await db.getUsers();
      dbStatus = `connected (${Object.keys(users).length} users)`;
    } catch (e: any) {
      dbStatus = `error: ${e.message}`;
    }
    
    res.json({ 
      status: "ok", 
      database: process.env.SUPABASE_URL ? 'supabase' : 'file',
      dbStatus,
      env: {
        isVercel,
        hasSupabase: !!hasSupabase,
        hasDatabaseUrl: !!(process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL),
        nodeEnv: process.env.NODE_ENV,
        hasDiscord: !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_BOT_TOKEN)
      }
    });
  }));

  // Admin Management
  app.post("/api/admins/create", checkAdmin, asyncHandler(async (req: any, res: any) => {
    const { username, displayName, role, password, ign, uid } = req.body;
    const targetRole = role || "admin";
    const userId = username.trim().toLowerCase();
    const originalUsername = username.trim();
    
    const hashedPassword = await bcrypt.hash(password || "password123", 10);
    
    const newUser = {
      id: userId,
      username: originalUsername,
      displayName: displayName || originalUsername,
      ign: ign || originalUsername,
      uid: uid || '',
      role: targetRole,
      createdAt: new Date().toISOString(),
      isApproved: true,
      isPreAuthorized: true,
      password: hashedPassword
    };
    
    await db.saveUser(newUser);
    res.json({ success: true, id: userId });
  }));

  // Users API
  app.get("/api/users", checkAdmin, asyncHandler(async (req: any, res: any) => {
    const users = await db.getUsers();
    res.json(Object.values(users));
  }));

  app.put("/api/users/:id", checkAdmin, asyncHandler(async (req: any, res: any) => {
    const id = req.params.id;
    const user = await db.getUserById(id);
    if (user) {
      const updateData = { ...req.body };
      // Admins and superadmins are approved by default
      if (updateData.role === 'admin' || updateData.role === 'superadmin') {
        updateData.isApproved = true;
      }
      
      const updatedUser = { ...user, ...updateData };
      // If password is being updated, hash it
      if (req.body.password) {
        updatedUser.password = await bcrypt.hash(req.body.password, 10);
      }
      await db.saveUser(updatedUser);
      res.json(updatedUser);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  }));

  app.delete("/api/users/:id", checkSuperAdmin, asyncHandler(async (req: any, res: any) => {
    const user = await db.getUserById(req.params.id);
    if (user && user.role === 'superadmin') {
      return res.status(403).json({ error: "Cannot delete superadmin account" });
    }
    await db.deleteUser(req.params.id);
    res.json({ success: true });
  }));

  // Members API
  app.get("/api/members", asyncHandler(async (req: any, res: any) => {
    const members = await db.getMembers();
    const events = await db.getEvents();
    const now = new Date();
    
    // Helper to parse "Thu, Apr 9" format
    const parseAbsenceDate = (dateStr: string) => {
      const currentYear = new Date().getFullYear();
      return new Date(`${dateStr}, ${currentYear}`);
    };

    let hasChanges = false;
    const updatedMembers = await Promise.all(members.map(async (member: any) => {
      const memberAbsences: any[] = [];
      events.forEach((event: any) => {
        if (event.absences) {
          const absence = event.absences.find((a: any) => a.memberId === member.id);
          if (absence) {
            memberAbsences.push({ ...absence, eventName: event.name });
          }
        }
      });

      if (memberAbsences.length > 0) {
        let latestDate: Date | null = null;
        let latestAbsence: any = null;
        
        memberAbsences.forEach(absence => {
          if (absence.dates && absence.dates.length > 0) {
            absence.dates.forEach((dStr: string) => {
              const d = parseAbsenceDate(dStr);
              if (!latestDate || d > latestDate) {
                latestDate = d;
                latestAbsence = absence;
              }
            });
          }
        });

        if (latestDate) {
          const returnDate = new Date(latestDate);
          returnDate.setDate(returnDate.getDate() + 1);
          
          if (now > returnDate) {
            if (member.status === 'on-leave') {
              member.status = 'active';
              await db.saveMember(member);
              await db.saveMemberLog({
                memberId: member.id,
                type: 'status_change',
                oldValue: 'on-leave',
                newValue: 'active',
                timestamp: new Date().toISOString(),
                details: 'Automatically marked active as leave period ended.'
              });
              hasChanges = true;
            }
          } else {
            // If they have an active absence, ensure they are 'on-leave'
            if (member.status !== 'on-leave' && member.status !== 'left') {
              member.status = 'on-leave';
              member.leaveReason = latestAbsence.reason;
              member.leaveDates = latestAbsence.dates;
              await db.saveMember(member);
              hasChanges = true;
            }
            member.returnDate = returnDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            member.absentEvent = latestAbsence.eventName;
          }
        }
      }
      return member;
    }));

    if (hasChanges && emitUpdate) emitUpdate('members');
    res.json(updatedMembers);
  }));

  app.get("/api/logs", asyncHandler(async (req: any, res: any) => {
    const logs = await db.getAllMemberLogs();
    res.json(logs);
  }));

  app.get("/api/members/:id/logs", asyncHandler(async (req: any, res: any) => {
    const logs = await db.getMemberLogs(req.params.id);
    res.json(logs);
  }));

  app.post("/api/members", asyncHandler(async (req: any, res: any) => {
    const newMember = { ...req.body, id: Date.now().toString(), status: req.body.status || 'active' };
    await db.saveMember(newMember);
    
    // Log initial join
    await db.saveMemberLog({
      memberId: newMember.id,
      type: 'guild_join',
      newValue: 'active',
      timestamp: new Date().toISOString(),
      details: `Member joined the guild as ${newMember.job}`
    });
    
    res.json(newMember);
  }));

  app.put("/api/members/:id", checkAdmin, asyncHandler(async (req: any, res: any) => {
    const member = await db.getMemberById(req.params.id);
    if (member) {
      const oldRole = member.role;
      const newRole = req.body.role;
      const oldStatus = member.status || 'active';
      const newStatus = req.body.status || oldStatus;
      const oldIgn = member.ign;
      const newIgn = req.body.ign || oldIgn;
      const oldJob = member.job;
      const newJob = req.body.job || oldJob;

      const updatedMember = { ...member, ...req.body };
      
      // If status is changed to active, clear leave details and remove from all event absences
      if (newStatus === 'active' && oldStatus === 'on-leave') {
        updatedMember.leaveReason = undefined;
        updatedMember.leaveDates = undefined;
        
        // Remove from all event absences
        const events = await db.getEvents();
        for (const event of events) {
          if (event.absences && event.absences.some((a: any) => a.memberId === member.id)) {
            const updatedEvent = {
              ...event,
              absences: event.absences.filter((a: any) => a.memberId !== member.id)
            };
            await db.saveEvent(updatedEvent);
          }
        }
      }
      
      // Log changes
      if (oldStatus !== newStatus) {
        let type: any = 'status_change';
        if (newStatus === 'left') type = 'guild_leave';
        else if (oldStatus === 'left' && newStatus === 'active') type = 'guild_return';
        
        await db.saveMemberLog({
          memberId: member.id,
          type,
          oldValue: oldStatus,
          newValue: newStatus,
          timestamp: new Date().toISOString(),
          details: `Status changed from ${oldStatus} to ${newStatus}`
        });
      }

      if (oldIgn !== newIgn) {
        await db.saveMemberLog({
          memberId: member.id,
          type: 'name_change',
          oldValue: oldIgn,
          newValue: newIgn,
          timestamp: new Date().toISOString(),
          details: `Name changed from ${oldIgn} to ${newIgn}`
        });
      }

      if (oldJob !== newJob) {
        await db.saveMemberLog({
          memberId: member.id,
          type: 'job_change',
          oldValue: oldJob,
          newValue: newJob,
          timestamp: new Date().toISOString(),
          details: `Job changed from ${oldJob} to ${newJob}`
        });
      }

      if (oldRole !== newRole && newRole) {
        await db.saveMemberLog({
          memberId: member.id,
          type: 'role_change',
          oldValue: oldRole,
          newValue: newRole,
          timestamp: new Date().toISOString(),
          details: `Role changed from ${oldRole} to ${newRole}`
        });
        await db.updateAssignmentsRole(req.params.id, newRole);
      }
      
      await db.saveMember(updatedMember);
      if (emitUpdate) emitUpdate('members');
      res.json(updatedMember);
    } else {
      res.status(404).json({ error: "Member not found" });
    }
  }));

  app.delete("/api/members/:id", checkAdmin, asyncHandler(async (req: any, res: any) => {
    await db.deleteMember(req.params.id);
    if (emitUpdate) emitUpdate('members');
    res.json({ success: true });
  }));

  // Jobs API
  app.get("/api/jobs", asyncHandler(async (req: any, res: any) => {
    const jobs = await db.getJobs();
    res.json(jobs);
  }));

  app.post("/api/jobs", asyncHandler(async (req: any, res: any) => {
    const user = req.headers['user-role'];
    if (user !== 'admin' && user !== 'superadmin') {
      return res.status(403).json({ error: "Only admins can manage jobs" });
    }
    const newJob = { ...req.body, id: Date.now().toString() };
    await db.saveJob(newJob);
    if (emitUpdate) emitUpdate('jobs');
    res.json(newJob);
  }));

  app.put("/api/jobs/:id", asyncHandler(async (req: any, res: any) => {
    const user = req.headers['user-role'];
    if (user !== 'admin' && user !== 'superadmin') {
      return res.status(403).json({ error: "Only admins can manage jobs" });
    }
    const job = await db.getJobById(req.params.id);
    if (job) {
      const oldName = job.name;
      const newName = req.body.name;
      const updatedJob = { ...job, ...req.body };
      
      if (oldName !== newName) {
        await db.updateMembersJob(oldName, newName);
      }
      
      await db.saveJob(updatedJob);
      if (emitUpdate) emitUpdate('jobs');
      res.json(updatedJob);
    } else {
      res.status(404).json({ error: "Job not found" });
    }
  }));

  app.delete("/api/jobs/:id", asyncHandler(async (req: any, res: any) => {
    const user = req.headers['user-role'];
    if (user !== 'admin' && user !== 'superadmin') {
      return res.status(403).json({ error: "Only admins can manage jobs" });
    }
    await db.deleteJob(req.params.id);
    if (emitUpdate) emitUpdate('jobs');
    res.json({ success: true });
  }));

  // Roles API
  app.get("/api/roles", asyncHandler(async (req: any, res: any) => {
    const roles = await db.getRoles();
    res.json(roles);
  }));

  app.post("/api/roles", asyncHandler(async (req: any, res: any) => {
    const user = req.headers['user-role'];
    if (user !== 'admin' && user !== 'superadmin') {
      return res.status(403).json({ error: "Only admins can manage roles" });
    }
    const newRole = { ...req.body, id: Date.now().toString() };
    await db.saveRole(newRole);
    if (emitUpdate) emitUpdate('roles');
    res.json(newRole);
  }));

  app.put("/api/roles/:id", asyncHandler(async (req: any, res: any) => {
    const user = req.headers['user-role'];
    if (user !== 'admin' && user !== 'superadmin') {
      return res.status(403).json({ error: "Only admins can manage roles" });
    }
    const roles = await db.getRoles();
    const role = roles.find((r: any) => r.id === req.params.id);
    if (role) {
      const oldName = role.name;
      const newName = req.body.name;
      const updatedRole = { ...role, ...req.body };
      
      if (oldName !== newName) {
        await db.updateAssignmentsRole(oldName, newName);
      }
      
      await db.saveRole(updatedRole);
      if (emitUpdate) emitUpdate('roles');
      res.json(updatedRole);
    } else {
      res.status(404).json({ error: "Role not found" });
    }
  }));

  app.delete("/api/roles/:id", asyncHandler(async (req: any, res: any) => {
    const user = req.headers['user-role'];
    if (user !== 'admin' && user !== 'superadmin') {
      return res.status(403).json({ error: "Only admins can manage roles" });
    }
    await db.deleteRole(req.params.id);
    if (emitUpdate) emitUpdate('roles');
    res.json({ success: true });
  }));

  // Events API
  async function sendDiscordMessage(message: string, target: 'announcements' | 'absence' | 'both' = 'announcements') {
    const settings = await db.getSettings();
    const botToken = process.env.DISCORD_BOT_TOKEN;
    
    const channels = [];
    if (target === 'announcements' || target === 'both') {
      if (settings.discordAnnouncementsChannelId) channels.push(settings.discordAnnouncementsChannelId);
    }
    if (target === 'absence' || target === 'both') {
      if (settings.discordAbsenceChannelId) channels.push(settings.discordAbsenceChannelId);
    }

    if (botToken && channels.length > 0) {
      for (const channelId of channels) {
        try {
          await axios.post(`https://discord.com/api/v10/channels/${channelId}/messages`, {
            content: message
          }, {
            headers: {
              Authorization: `Bot ${botToken}`
            }
          });
        } catch (err: any) {
          console.error(`Failed to send Discord message to channel ${channelId} via Bot:`, err.response?.data || err.message);
        }
      }
    }
  }

  app.get("/api/events", asyncHandler(async (req: any, res: any) => {
    const events = await db.getEvents();
    res.json(events);
  }));

  app.get("/api/events/:id", checkAdmin, asyncHandler(async (req: any, res: any) => {
    const event = await db.getEventById(req.params.id);
    if (event) res.json(event);
    else res.status(404).json({ error: "Event not found" });
  }));

  app.post("/api/events", checkAdmin, asyncHandler(async (req: any, res: any) => {
    console.log("POST /api/events body:", req.body);
    const newEvent = { ...req.body, id: Date.now().toString(), subevents: [] };
    await db.saveEvent(newEvent);
    if (emitUpdate) emitUpdate('events');
    res.json(newEvent);
  }));

  app.put("/api/events-reorder", checkAdmin, asyncHandler(async (req: any, res: any) => {
    const { orderedIds } = req.body;
    await db.reorderEvents(orderedIds);
    if (emitUpdate) emitUpdate('events');
    res.json({ success: true });
  }));

  app.put("/api/events/:id", checkAdmin, asyncHandler(async (req: any, res: any) => {
    console.log("PUT /api/events/:id body:", req.body);
    const event = await db.getEventById(req.params.id);
    if (event) {
      const updatedEvent = { ...event, ...req.body };
      await db.saveEvent(updatedEvent);
      if (emitUpdate) emitUpdate('events');
      res.json(updatedEvent);
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.delete("/api/events/:id", checkAdmin, asyncHandler(async (req: any, res: any) => {
    await db.deleteEvent(req.params.id);
    if (emitUpdate) emitUpdate('events');
    res.json({ success: true });
  }));

  // Event Share Links
  app.get("/api/events/:eventId/share-links", checkAdmin, asyncHandler(async (req: any, res: any) => {
    const links = await db.getEventShareLinks(req.params.eventId);
    // Filter out expired links
    const now = new Date();
    const validLinks = links.filter((l: any) => new Date(l.expiresAt) > now);
    
    // Delete expired links
    for (const link of links) {
      if (new Date(link.expiresAt) <= now) {
        await db.deleteEventShareLink(link.id);
      }
    }
    
    res.json(validLinks);
  }));

  app.post("/api/events/:eventId/share-links", checkAdmin, asyncHandler(async (req: any, res: any) => {
    const eventId = req.params.eventId;
    const links = await db.getEventShareLinks(eventId);
    const now = new Date();
    const validLinks = links.filter((l: any) => new Date(l.expiresAt) > now);

    if (validLinks.length >= 2) {
      return res.status(400).json({ error: "Maximum of 2 active share links allowed per event." });
    }

    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const newLink = {
      id: Date.now().toString(),
      eventId,
      token,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    await db.saveEventShareLink(newLink);
    res.json(newLink);
  }));

  app.delete("/api/events/:eventId/share-links/:linkId", checkAdmin, asyncHandler(async (req: any, res: any) => {
    await db.deleteEventShareLink(req.params.linkId);
    res.json({ success: true });
  }));

  app.get("/api/public/events/by-token/:token", asyncHandler(async (req: any, res: any) => {
    const link = await db.getEventShareLinkByToken(req.params.token);
    if (!link) {
      return res.status(404).json({ error: "Link not found or expired" });
    }

    if (new Date(link.expiresAt) <= new Date()) {
      await db.deleteEventShareLink(link.id);
      return res.status(404).json({ error: "Link expired" });
    }

    const event = await db.getEventById(link.eventId);
    if (event) {
      res.json(event);
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.post("/api/events/:eventId/absent", asyncHandler(async (req: any, res: any) => {
    const { memberId, message, dates } = req.body;
    const eventId = req.params.eventId;
    const event = await db.getEventById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const member = await db.getMemberById(memberId);
    if (!member) return res.status(404).json({ error: "Member not found" });

    // Remove them from any party in this event
    const updatedEvent = {
      ...event,
      subevents: (event.subevents || []).map((subevent: any) => ({
        ...subevent,
        parties: (subevent.parties || []).map((party: any) => ({
          ...party,
          assignments: (party.assignments || []).filter((a: any) => a.memberId !== member.id)
        }))
      })),
      absences: [
        ...(event.absences || []).filter((a: any) => a.memberId !== member.id),
        {
          memberId: member.id,
          ign: member.ign,
          reason: message || 'No reason provided',
          dates: dates || [],
          timestamp: new Date().toISOString()
        }
      ]
    };

    await db.saveEvent(updatedEvent);

    // Update member status to 'on-leave' and save leave details
    await db.saveMember({ 
      ...member, 
      status: 'on-leave',
      leaveReason: message || 'No reason provided',
      leaveDates: dates || [],
      leaveStartedAt: new Date().toISOString()
    });
    
    // Log the status change
    await db.saveMemberLog({
      memberId: member.id,
      type: 'status_change',
      oldValue: member.status || 'active',
      newValue: 'on-leave',
      timestamp: new Date().toISOString(),
      details: `Status automatically changed to on-leave due to absence report for ${event.name}`
    });

    if (emitUpdate) {
      emitUpdate('events');
      emitUpdate('members');
    }
    const settings = await db.getSettings();
    let timezone = settings.timezone || 'UTC';
    
    const now = new Date();
    let dateStr, timeStr;
    try {
      dateStr = now.toLocaleDateString('en-US', { timeZone: timezone, month: 'long', day: 'numeric', year: 'numeric' });
      timeStr = now.toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) {
      console.warn(`Invalid timezone: ${timezone}, falling back to UTC`);
      dateStr = now.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
      timeStr = now.toLocaleTimeString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: true });
    }

    // Send message to Discord if configured
    let dateRangeStr = '';
    if (dates && dates.length > 0) {
      dateRangeStr = `\n**Dates:** ${dates.join(', ')}`;
    }

    const discordMsg = `${dateStr}\n${timeStr}\n\n**${member.ign}** won't be able to attend **${event.name}** because of the following reasons\n${message || 'No reason provided'}${dateRangeStr}`;
    await sendDiscordMessage(discordMsg, 'absence');

    res.json({ success: true });
  }));

  app.delete("/api/events/:eventId/absent/:memberId", checkAdmin, asyncHandler(async (req: any, res: any) => {
    const { eventId, memberId } = req.params;
    console.log(`[DELETE /api/events/${eventId}/absent/${memberId}] Request received`);
    const event = await db.getEventById(eventId);
    if (!event) {
      console.error(`[DELETE /api/events/${eventId}/absent/${memberId}] Event not found`);
      return res.status(404).json({ error: "Event not found" });
    }

    console.log(`[DELETE /api/events/${eventId}/absent/${memberId}] Current absences:`, event.absences);
    const updatedEvent = {
      ...event,
      absences: (event.absences || []).filter((a: any) => a.memberId !== memberId)
    };

    console.log(`[DELETE /api/events/${eventId}/absent/${memberId}] Updated absences:`, updatedEvent.absences);
    await db.saveEvent(updatedEvent);
    console.log(`[DELETE /api/events/${eventId}/absent/${memberId}] Event saved successfully`);
    res.json(updatedEvent);
  }));

  app.post("/api/events/:eventId/share-discord", asyncHandler(async (req: any, res: any) => {
    const { message } = req.body;
    const eventId = req.params.eventId;
    const event = await db.getEventById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    if (message) {
      await sendDiscordMessage(message, 'announcements');
    }

    res.json({ success: true });
  }));

  // SubEvents API
  app.get("/api/events/:eventId/subevents", asyncHandler(async (req: any, res: any) => {
    const event = await db.getEventById(req.params.eventId);
    res.json(event?.subevents || []);
  }));

  app.post("/api/events/:eventId/subevents", asyncHandler(async (req: any, res: any) => {
    const event = await db.getEventById(req.params.eventId);
    if (event) {
      const newSubEvent = { ...req.body, id: Date.now().toString(), parties: [] };
      if (!event.subevents) event.subevents = [];
      event.subevents.push(newSubEvent);
      await db.saveEvent(event);
      res.json(newSubEvent);
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.put("/api/events/:eventId/subevents/:id", asyncHandler(async (req: any, res: any) => {
    const event = await db.getEventById(req.params.eventId);
    if (event) {
      const subIndex = event.subevents.findIndex((s: any) => s.id === req.params.id);
      if (subIndex !== -1) {
        event.subevents[subIndex] = { ...event.subevents[subIndex], ...req.body };
        await db.saveEvent(event);
        res.json(event.subevents[subIndex]);
      } else {
        res.status(404).json({ error: "SubEvent not found" });
      }
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.put("/api/events/:eventId/subevents-reorder", asyncHandler(async (req: any, res: any) => {
    const { subevents } = req.body;
    const event = await db.getEventById(req.params.eventId);
    if (event) {
      event.subevents = subevents;
      await db.saveEvent(event);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.delete("/api/events/:eventId/subevents/:id", asyncHandler(async (req: any, res: any) => {
    const event = await db.getEventById(req.params.eventId);
    if (event) {
      event.subevents = event.subevents.filter((s: any) => s.id !== req.params.id);
      await db.saveEvent(event);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  // Parties API
  app.get("/api/events/:eventId/subevents/:subEventId/parties", asyncHandler(async (req: any, res: any) => {
    const event = await db.getEventById(req.params.eventId);
    const subEvent = event?.subevents?.find((s: any) => s.id === req.params.subEventId);
    res.json(subEvent?.parties || []);
  }));

  app.post("/api/events/:eventId/subevents/:subEventId/parties", asyncHandler(async (req: any, res: any) => {
    const event = await db.getEventById(req.params.eventId);
    if (event) {
      const subIndex = event.subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const newParty = { ...req.body, id: Date.now().toString(), assignments: [] };
        if (!event.subevents[subIndex].parties) event.subevents[subIndex].parties = [];
        event.subevents[subIndex].parties.push(newParty);
        await db.saveEvent(event);
        res.json(newParty);
      } else {
        res.status(404).json({ error: "SubEvent not found" });
      }
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.put("/api/events/:eventId/subevents/:subEventId/parties/:id", asyncHandler(async (req: any, res: any) => {
    const event = await db.getEventById(req.params.eventId);
    if (event) {
      const subIndex = event.subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const partyIndex = event.subevents[subIndex].parties.findIndex((p: any) => p.id === req.params.id);
        if (partyIndex !== -1) {
          event.subevents[subIndex].parties[partyIndex] = { ...event.subevents[subIndex].parties[partyIndex], ...req.body };
          await db.saveEvent(event);
          res.json(event.subevents[subIndex].parties[partyIndex]);
        } else {
          res.status(404).json({ error: "Party not found" });
        }
      } else {
        res.status(404).json({ error: "SubEvent not found" });
      }
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.put("/api/events/:eventId/subevents/:subEventId/parties-reorder", asyncHandler(async (req: any, res: any) => {
    const { parties } = req.body;
    const event = await db.getEventById(req.params.eventId);
    if (event) {
      const subIndex = event.subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        event.subevents[subIndex].parties = parties;
        await db.saveEvent(event);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "SubEvent not found" });
      }
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.put("/api/events/:eventId/move-party", asyncHandler(async (req: any, res: any) => {
    const { partyId, fromSubEventId, toSubEventId, newIndex } = req.body;
    const event = await db.getEventById(req.params.eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const fromSubIndex = event.subevents.findIndex((s: any) => s.id === fromSubEventId);
    const toSubIndex = event.subevents.findIndex((s: any) => s.id === toSubEventId);

    if (fromSubIndex === -1 || toSubIndex === -1) return res.status(404).json({ error: "SubEvent not found" });

    const partyIndex = event.subevents[fromSubIndex].parties.findIndex((p: any) => p.id === partyId);
    if (partyIndex === -1) return res.status(404).json({ error: "Party not found" });

    const [party] = event.subevents[fromSubIndex].parties.splice(partyIndex, 1);
    event.subevents[toSubIndex].parties.splice(newIndex, 0, party);

    // Update orders
    event.subevents[fromSubIndex].parties.forEach((p: any, i: number) => p.order = i);
    event.subevents[toSubIndex].parties.forEach((p: any, i: number) => p.order = i);

    await db.saveEvent(event);
    if (emitUpdate) emitUpdate('events');
    res.json({ success: true });
  }));

  app.delete("/api/events/:eventId/subevents/:subEventId/parties/:id", asyncHandler(async (req: any, res: any) => {
    const event = await db.getEventById(req.params.eventId);
    if (event) {
      const subIndex = event.subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        event.subevents[subIndex].parties = event.subevents[subIndex].parties.filter((p: any) => p.id !== req.params.id);
        await db.saveEvent(event);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "SubEvent not found" });
      }
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  // Assignments API
  app.get("/api/events/:eventId/subevents/:subEventId/parties/:partyId/assignments", asyncHandler(async (req: any, res: any) => {
    const event = await db.getEventById(req.params.eventId);
    const subEvent = event?.subevents?.find((s: any) => s.id === req.params.subEventId);
    const party = subEvent?.parties?.find((p: any) => p.id === req.params.partyId);
    res.json(party?.assignments || []);
  }));

  app.post("/api/events/:eventId/subevents/:subEventId/parties/:partyId/assignments", asyncHandler(async (req: any, res: any) => {
    const event = await db.getEventById(req.params.eventId);
    if (event) {
      const subIndex = event.subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const partyIndex = event.subevents[subIndex].parties.findIndex((p: any) => p.id === req.params.partyId);
        if (partyIndex !== -1) {
          const newAssignment = { ...req.body, id: Date.now().toString() };
          if (!event.subevents[subIndex].parties[partyIndex].assignments) event.subevents[subIndex].parties[partyIndex].assignments = [];
          event.subevents[subIndex].parties[partyIndex].assignments.push(newAssignment);
          await db.saveEvent(event);
          res.json(newAssignment);
        } else {
          res.status(404).json({ error: "Party not found" });
        }
      } else {
        res.status(404).json({ error: "SubEvent not found" });
      }
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.put("/api/events/:eventId/subevents/:subEventId/parties/:partyId/assignments/:id", asyncHandler(async (req: any, res: any) => {
    const event = await db.getEventById(req.params.eventId);
    if (event) {
      const subIndex = event.subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const partyIndex = event.subevents[subIndex].parties.findIndex((p: any) => p.id === req.params.partyId);
        if (partyIndex !== -1) {
          const assignIndex = event.subevents[subIndex].parties[partyIndex].assignments.findIndex((a: any) => a.id === req.params.id);
          if (assignIndex !== -1) {
            event.subevents[subIndex].parties[partyIndex].assignments[assignIndex] = { ...event.subevents[subIndex].parties[partyIndex].assignments[assignIndex], ...req.body };
            await db.saveEvent(event);
            res.json(event.subevents[subIndex].parties[partyIndex].assignments[assignIndex]);
          } else {
            res.status(404).json({ error: "Assignment not found" });
          }
        } else {
          res.status(404).json({ error: "Party not found" });
        }
      } else {
        res.status(404).json({ error: "SubEvent not found" });
      }
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.put("/api/events/:eventId/subevents/:subEventId/parties/:partyId/assignments-reorder", asyncHandler(async (req: any, res: any) => {
    const { assignments } = req.body;
    const event = await db.getEventById(req.params.eventId);
    if (event) {
      const subIndex = event.subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const partyIndex = event.subevents[subIndex].parties.findIndex((p: any) => p.id === req.params.partyId);
        if (partyIndex !== -1) {
          event.subevents[subIndex].parties[partyIndex].assignments = assignments;
          await db.saveEvent(event);
          res.json({ success: true });
        } else {
          res.status(404).json({ error: "Party not found" });
        }
      } else {
        res.status(404).json({ error: "SubEvent not found" });
      }
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.delete("/api/events/:eventId/subevents/:subEventId/parties/:partyId/assignments/:id", asyncHandler(async (req: any, res: any) => {
    const event = await db.getEventById(req.params.eventId);
    if (event) {
      const subIndex = event.subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const partyIndex = event.subevents[subIndex].parties.findIndex((p: any) => p.id === req.params.partyId);
        if (partyIndex !== -1) {
          event.subevents[subIndex].parties[partyIndex].assignments = event.subevents[subIndex].parties[partyIndex].assignments.filter((a: any) => a.id !== req.params.id);
          await db.saveEvent(event);
          res.json({ success: true });
        } else {
          res.status(404).json({ error: "Party not found" });
        }
      } else {
        res.status(404).json({ error: "SubEvent not found" });
      }
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  // Settings API
  app.get("/api/settings", asyncHandler(async (req: any, res: any) => {
    try {
      const settings = await db.getSettings();
      res.json(settings);
    } catch (err: any) {
      console.error("Get Settings Exception:", err.message);
      res.status(500).json({ error: "Failed to load settings" });
    }
  }));

  app.get("/api/settings/guild_settings", asyncHandler(async (req: any, res: any) => {
    const settings = await db.getSettings();
    res.json(settings);
  }));

  app.post("/api/raffle/settings", checkAdmin, asyncHandler(async (req: any, res: any) => {
    const raffle = await db.getRaffle();
    raffle.settings = { ...raffle.settings, ...req.body };
    await db.saveRaffle(raffle);
    if (emitUpdate) emitUpdate('raffle');
    res.json(raffle.settings);
  }));

  // Raffle API
  app.get("/api/raffle", asyncHandler(async (req: any, res: any) => {
    const raffle = await db.getRaffle();
    
    // Auto-advance logic for Monday morning (PHT)
    // Sunday 22:00 UTC = Monday 06:00 PHT
    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    
    // If it's Sunday after 22:00 UTC (Monday 6am PHT) or any day after Sunday (Monday-Saturday)
    // AND the raffle is currently closed (meaning last week's draw is done)
    // AND we haven't advanced yet (this part is tricky, maybe check if winners exist for current week)
    const hasWinnersForCurrentWeek = (raffle.winners || []).some((w: any) => 
      Number(w.week) === Number(raffle.settings.currentWeek) &&
      Number(w.month) === Number(raffle.settings.currentMonth) &&
      Number(w.year) === Number(raffle.settings.currentYear)
    );

    const isMondayOrLater = (day === 0 && hour >= 22) || (day > 0);

    if (isMondayOrLater && !raffle.settings.isOpen && hasWinnersForCurrentWeek) {
      console.log('[Raffle Auto-Advance] Monday morning detected, advancing week...');
      
      // Clear entries
      raffle.entries = [];
      
      const currentWeek = Number(raffle.settings.currentWeek);
      const currentMonth = Number(raffle.settings.currentMonth);
      const currentYear = Number(raffle.settings.currentYear);

      if (currentWeek >= 5) {
        raffle.settings.currentWeek = 1;
        if (currentMonth >= 12) {
          raffle.settings.currentMonth = 1;
          raffle.settings.currentYear = currentYear + 1;
        } else {
          raffle.settings.currentMonth = currentMonth + 1;
        }
      } else {
        raffle.settings.currentWeek = currentWeek + 1;
      }
      
      raffle.settings.isOpen = true;
      await db.saveRaffle(raffle);
      console.log('[Raffle Auto-Advance] Advanced to:', raffle.settings);
    }

    res.json(raffle);
  }));

  app.post("/api/raffle/join", asyncHandler(async (req: any, res: any) => {
    const { memberId } = req.body;
    const raffle = await db.getRaffle();
    const members = await db.getMembers();
    const member = members.find((m: any) => m.id === memberId);

    if (!member) return res.status(404).json({ error: "Member not found" });

    // Check if member is already a winner this month
    const isWinnerThisMonth = (raffle.winners || []).some((w: any) => 
      w.memberId === memberId && 
      w.month === raffle.settings.currentMonth && 
      w.year === raffle.settings.currentYear
    );

    if (isWinnerThisMonth) {
      return res.status(400).json({ error: "You have already won this month and cannot join until next month." });
    }

    // Check if already entered this week
    const alreadyEntered = (raffle.entries || []).some((e: any) => 
      e.memberId === memberId && 
      e.week === raffle.settings.currentWeek &&
      e.month === raffle.settings.currentMonth &&
      e.year === raffle.settings.currentYear
    );

    if (alreadyEntered) {
      return res.status(400).json({ error: "You have already joined the raffle for this week." });
    }

    const newEntry = {
      id: Date.now().toString(),
      memberId,
      ign: member.ign,
      week: raffle.settings.currentWeek,
      month: raffle.settings.currentMonth,
      year: raffle.settings.currentYear,
      timestamp: new Date().toISOString()
    };

    if (!raffle.entries) raffle.entries = [];
    raffle.entries.push(newEntry);
    await db.saveRaffle(raffle);
    res.json({ success: true, entry: newEntry });
  }));

  app.post("/api/raffle/draw", asyncHandler(async (req: any, res: any) => {
    const userRole = req.headers['user-role'];
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return res.status(403).json({ error: "Only admins can draw winners" });
    }

    const raffle = await db.getRaffle();
    const restrictedIds = raffle.settings.restrictedMemberIds || [];
    
    // Get all winners for the current month to exclude them
    const monthWinnerIds = new Set((raffle.winners || [])
      .filter((w: any) => Number(w.month) === Number(raffle.settings.currentMonth) && Number(w.year) === Number(raffle.settings.currentYear))
      .map((w: any) => w.memberId));

    const currentWeekEntries = (raffle.entries || []).filter((e: any) => {
      const match = Number(e.week) === Number(raffle.settings.currentWeek) &&
                  Number(e.month) === Number(raffle.settings.currentMonth) &&
                  Number(e.year) === Number(raffle.settings.currentYear);
      const notRestricted = !restrictedIds.includes(e.memberId);
      const notAlreadyWinner = !monthWinnerIds.has(e.memberId);
      return match && notRestricted && notAlreadyWinner;
    });

    // Ensure unique members if there are multiple entries (though join prevents this, safety first)
    const uniqueEntriesMap = new Map();
    currentWeekEntries.forEach(e => {
      if (!uniqueEntriesMap.has(e.memberId)) {
        uniqueEntriesMap.set(e.memberId, e);
      }
    });
    const uniqueEntries = Array.from(uniqueEntriesMap.values());

    const settings = await db.getSettings();
    const numWinners = settings.raffleWinners || 2;

    if (uniqueEntries.length < numWinners) {
      return res.status(400).json({ error: `Not enough unique entries to draw ${numWinners} winners. Available: ${uniqueEntries.length}` });
    }

    // Shuffle and pick winners
    const shuffled = [...uniqueEntries].sort(() => 0.5 - Math.random());
    const winners = shuffled.slice(0, numWinners).map((e, idx) => ({
      id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
      memberId: e.memberId,
      ign: e.ign,
      week: raffle.settings.currentWeek,
      month: raffle.settings.currentMonth,
      year: raffle.settings.currentYear,
      round: idx + 1,
      prize: raffle.settings.prizes?.[idx] || 'TBD',
      timestamp: new Date().toISOString()
    }));

    if (!raffle.winners) raffle.winners = [];
    raffle.winners.push(...winners);
    
    // Close raffle after draw, but DON'T advance week yet
    // This allows for rerolls if needed
    raffle.settings.isOpen = false;
    
    await db.saveRaffle(raffle);
    res.json({ success: true, winners });
  }));

  app.post("/api/raffle/advance", asyncHandler(async (req: any, res: any) => {
    const userRole = req.headers['user-role'];
    console.log(`[Raffle Advance] Request received. Role: ${userRole}`);
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      console.warn(`[Raffle Advance] Forbidden: Role ${userRole} is not admin`);
      return res.status(403).json({ error: "Only admins can advance the raffle" });
    }

    const raffle = await db.getRaffle();
    console.log(`[Raffle Advance] Current Settings:`, raffle.settings);
    
    // Clear current entries when advancing to next week
    raffle.entries = [];
    
    const currentWeek = Number(raffle.settings.currentWeek);
    const currentMonth = Number(raffle.settings.currentMonth);
    const currentYear = Number(raffle.settings.currentYear);

    if (currentWeek >= 5) {
      raffle.settings.currentWeek = 1;
      if (currentMonth >= 12) {
        raffle.settings.currentMonth = 1;
        raffle.settings.currentYear = currentYear + 1;
      } else {
        raffle.settings.currentMonth = currentMonth + 1;
      }
    } else {
      raffle.settings.currentWeek = currentWeek + 1;
    }
    
    raffle.settings.isOpen = true;
    raffle.settings.prizes = []; // Reset prizes for the new week
    console.log(`[Raffle Advance] New Settings:`, raffle.settings);
    await db.saveRaffle(raffle);
    console.log(`[Raffle Advance] Raffle advanced and entries cleared`);
    res.json({ success: true, settings: raffle.settings });
  }));

  app.post("/api/raffle/reroll", asyncHandler(async (req: any, res: any) => {
    const userRole = req.headers['user-role'];
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return res.status(403).json({ error: "Only admins can reroll winners" });
    }

    const { winnerId } = req.body;
    const raffle = await db.getRaffle();
    const restrictedIds = raffle.settings.restrictedMemberIds || [];

    const winnerIndex = (raffle.winners || []).findIndex((w: any) => w.id === winnerId);
    if (winnerIndex === -1) return res.status(404).json({ error: "Winner not found" });

    const oldWinner = raffle.winners[winnerIndex];
    
    // Get current month winners to exclude them
    const monthWinners = (raffle.winners || []).filter((w: any) => 
      w.month === oldWinner.month && w.year === oldWinner.year && w.id !== winnerId
    );
    const monthWinnerIds = new Set(monthWinners.map((w: any) => w.memberId));

    const currentWeekEntries = (raffle.entries || []).filter((e: any) => {
      const match = Number(e.week) === Number(oldWinner.week) &&
                  Number(e.month) === Number(oldWinner.month) &&
                  Number(e.year) === Number(oldWinner.year);
      const notAlreadyWinner = !monthWinnerIds.has(e.memberId);
      const notRestricted = !restrictedIds.includes(e.memberId);
      return match && notAlreadyWinner && notRestricted;
    });

    if (currentWeekEntries.length === 0) {
      return res.status(400).json({ error: "No other entries available for reroll." });
    }

    const newWinnerEntry = currentWeekEntries[Math.floor(Math.random() * currentWeekEntries.length)];
    const newWinner = {
      ...oldWinner,
      id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
      memberId: newWinnerEntry.memberId,
      ign: newWinnerEntry.ign,
      round: oldWinner.round, // Preserve round
      prize: oldWinner.prize || raffle.settings.prizes?.[oldWinner.round - 1] || 'TBD',
      timestamp: new Date().toISOString()
    };

    raffle.winners[winnerIndex] = newWinner;
    await db.saveRaffle(raffle);
    res.json({ success: true, winner: newWinner });
  }));

  app.post("/api/raffle/override", asyncHandler(async (req: any, res: any) => {
    const userRole = req.headers['user-role'];
    if (userRole !== 'superadmin') {
      return res.status(403).json({ error: "Only superadmins can override winners" });
    }

    const { winnerId, newMemberId } = req.body;
    const raffle = await db.getRaffle();
    const members = await db.getMembers();
    const newMember = members.find((m: any) => m.id === newMemberId);

    if (!newMember) return res.status(404).json({ error: "Member not found" });

    const winnerIndex = (raffle.winners || []).findIndex((w: any) => w.id === winnerId);
    if (winnerIndex === -1) return res.status(404).json({ error: "Winner not found" });

    const oldWinner = raffle.winners[winnerIndex];
    
    // Check if new member has an entry for that week
    const hasEntry = (raffle.entries || []).some((e: any) => 
      e.memberId === newMemberId && 
      Number(e.week) === Number(oldWinner.week) &&
      Number(e.month) === Number(oldWinner.month) &&
      Number(e.year) === Number(oldWinner.year)
    );

    if (!hasEntry) {
      return res.status(400).json({ error: "Member must have an entry for that week to be an override winner." });
    }

    const newWinner = {
      ...oldWinner,
      id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
      memberId: newMemberId,
      ign: newMember.ign,
      round: oldWinner.round, // Preserve round
      prize: oldWinner.prize || raffle.settings.prizes?.[oldWinner.round - 1] || 'TBD',
      timestamp: new Date().toISOString()
    };

    raffle.winners[winnerIndex] = newWinner;
    await db.saveRaffle(raffle);
    res.json({ success: true, winner: newWinner });
  }));

  app.post("/api/raffle/clear-entries", asyncHandler(async (req: any, res: any) => {
    const userRole = req.headers['user-role'];
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return res.status(403).json({ error: "Only admins can clear entries" });
    }

    const raffle = await db.getRaffle();
    raffle.entries = [];
    await db.saveRaffle(raffle);
    res.json({ success: true });
  }));

  app.post("/api/raffle/reset", asyncHandler(async (req: any, res: any) => {
    const userRole = req.headers['user-role'];
    console.log(`[Raffle Reset] Role: ${userRole}, Body:`, req.body);
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return res.status(403).json({ error: "Only admins can reset the raffle" });
    }

    const { nextWeek, nextMonth, nextYear } = req.body;
    const raffle = await db.getRaffle();
    
    if (nextWeek !== undefined) raffle.settings.currentWeek = Number(nextWeek);
    else raffle.settings.currentWeek = (raffle.settings.currentWeek % 5) + 1;
    
    if (nextMonth !== undefined) raffle.settings.currentMonth = Number(nextMonth);
    if (nextYear !== undefined) raffle.settings.currentYear = Number(nextYear);
    raffle.settings.isOpen = true;
    
    console.log(`[Raffle Reset] New Settings:`, raffle.settings);
    await db.saveRaffle(raffle);
    res.json({ success: true, settings: raffle.settings });
  }));

  app.post("/api/raffle/settings", asyncHandler(async (req: any, res: any) => {
    const userRole = req.headers['user-role'];
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return res.status(403).json({ error: "Only admins can change raffle settings" });
    }

    const raffle = await db.getRaffle();
    raffle.settings = { ...raffle.settings, ...req.body };
    await db.saveRaffle(raffle);
    res.json(raffle.settings);
  }));

  app.post("/api/raffle/remove-entry", asyncHandler(async (req: any, res: any) => {
    const userRole = req.headers['user-role'];
    console.log(`[Raffle Remove] Role: ${userRole}, Body:`, req.body);
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return res.status(403).json({ error: "Only admins can remove entries" });
    }

    const { entryId } = req.body;
    const raffle = await db.getRaffle();
    if (!raffle.entries) raffle.entries = [];
    const initialCount = raffle.entries.length;
    raffle.entries = raffle.entries.filter((e: any) => e.id !== entryId);
    const finalCount = raffle.entries.length;
    
    console.log(`[Raffle Remove] Initial: ${initialCount}, Final: ${finalCount}`);
    if (initialCount === finalCount) {
      console.warn(`[Raffle Remove] Entry not found: ${entryId}`);
    }
    
    await db.saveRaffle(raffle);
    res.json({ success: true, count: finalCount });
  }));

  app.post("/api/raffle/force-reset", asyncHandler(async (req: any, res: any) => {
    const userRole = req.headers['user-role'];
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return res.status(403).json({ error: "Only admins can force reset" });
    }

    const initialRaffle = {
      entries: [],
      winners: [],
      settings: {
        currentWeek: 1,
        currentMonth: 4,
        currentYear: 2026,
        isOpen: true
      }
    };
    await db.saveRaffle(initialRaffle);
    res.json({ success: true, raffle: initialRaffle });
  }));

  app.post("/api/settings/guild_settings", checkSuperAdmin, asyncHandler(async (req: any, res: any) => {
    const settings = await db.getSettings();
    const updatedSettings = { ...settings, ...req.body };
    await db.saveSettings(updatedSettings);
    if (emitUpdate) emitUpdate('settings');

    // If Discord channel was just connected/updated, send an automatic message
    if (req.body.discordAnnouncementsChannelId && req.body.discordAnnouncementsChannelId !== settings.discordAnnouncementsChannelId) {
      await sendDiscordMessage(`✅ **App Connected!** This channel will now receive guild event notifications.`, 'announcements');
    }
    if (req.body.discordAbsenceChannelId && req.body.discordAbsenceChannelId !== settings.discordAbsenceChannelId) {
      await sendDiscordMessage(`✅ **App Connected!** This channel will now receive guild absence reports.`, 'absence');
    }

    // If maxPartySize changed, update all existing parties across all events
    if (req.body.maxPartySize !== undefined) {
      const events = await db.getEvents();
      const updatedEvents = events.map((event: any) => ({
        ...event,
        subevents: (event.subevents || []).map((subevent: any) => ({
          ...subevent,
          parties: (subevent.parties || []).map((party: any) => ({
            ...party,
            maxSize: req.body.maxPartySize
          }))
        }))
      }));
      for (const event of updatedEvents) {
        await db.saveEvent(event);
      }
    }

    res.json(updatedSettings);
  }));

  // Discord OAuth API
  app.get("/api/auth/discord/url", (req: any, res: any) => {
    const { origin } = req.query;
    const clientId = process.env.DISCORD_CLIENT_ID;
    
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.get('host');
    const defaultRedirectUri = `${protocol}://${host}/auth/discord/callback`;
    const redirectUri = origin ? `${origin}/auth/discord/callback` : defaultRedirectUri;
    
    // Store origin in state to retrieve it in the callback
    const state = origin ? Buffer.from(origin as string).toString('base64') : '';
    
    console.log(`[Discord Auth URL] Origin: ${origin}, Host: ${host}, RedirectURI: ${redirectUri}, State: ${state}`);
    
    if (!clientId) {
      return res.status(500).json({ error: "Discord Client ID not configured" });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify guilds bot applications.commands',
      permissions: '3088',
      state: state
    });

    const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
    res.json({ url: authUrl });
  });

  app.get("/api/auth/discord/invite", (req: any, res: any) => {
    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: "Discord Client ID not configured" });
    }
    // Permissions: View Channels (1024), Send Messages (2048), Manage Channels (16) -> 3088
    const permissions = "3088"; 
    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=bot%20applications.commands`;
    res.json({ url: inviteUrl });
  });

  app.get("/auth/discord/callback", asyncHandler(async (req: any, res: any) => {
    const { code, guild_id, state } = req.query;
    if (!code) return res.status(400).send("Code missing");

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    
    // Retrieve origin from state
    let origin = '';
    if (state) {
      try {
        origin = Buffer.from(state as string, 'base64').toString('utf-8');
      } catch (e) {
        console.error("Failed to decode state:", e);
      }
    }

    // Reconstruct redirectUri consistently using the origin from state if available
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.get('host');
    const defaultRedirectUri = `${protocol}://${host}/auth/discord/callback`;
    const redirectUri = origin ? `${origin}/auth/discord/callback` : defaultRedirectUri;

    console.log(`[Discord Callback] Code: ${code ? 'present' : 'missing'}, Host: ${host}, RedirectURI: ${redirectUri}, Origin: ${origin}`);

    try {
      if (!clientId || !clientSecret) {
        throw new Error("Discord credentials not configured");
      }

      // Exchange code for token
      const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const { access_token } = tokenResponse.data;

      // Get user profile
      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      const discordUser = userResponse.data;
      
      const authData = { 
        type: 'DISCORD_AUTH_SUCCESS', 
        discordId: discordUser.id,
        username: discordUser.username,
        accessToken: access_token,
        guildId: guild_id || ''
      };

      res.send(`
        <html>
          <body>
            <script>
              const authData = ${JSON.stringify(authData)};
              authData.timestamp = Date.now();
              
              // Try postMessage to opener
              if (window.opener) {
                try {
                  window.opener.postMessage(authData, '*');
                } catch (e) {
                  console.error('postMessage failed:', e);
                }
              }
              
              // Always store in localStorage as fallback for same-origin
              localStorage.setItem('discord_auth_result', JSON.stringify(authData));
              
              // Close if it's a popup, otherwise redirect
              if (window.opener && !window.opener.closed) {
                window.close();
              } else {
                window.location.href = '${origin || ''}/settings?discord_success=true';
              }
            </script>
            <p>Discord authentication successful. You can close this window.</p>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error("Discord OAuth Error:", err.response?.data || err.message);
      res.status(500).send("Authentication failed");
    }
  }));

  app.get("/api/discord/guilds", asyncHandler(async (req: any, res: any) => {
    const accessToken = req.headers.authorization?.split(' ')[1];
    if (!accessToken) return res.status(401).json({ error: "Access token required" });

    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) return res.status(500).json({ error: "Bot token not configured" });

    try {
      // Fetch user's guilds
      const userGuildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      // Fetch bot's guilds
      const botGuildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bot ${botToken}` }
      });

      const botGuildIds = new Set(botGuildsResponse.data.map((g: any) => g.id));

      // Filter for guilds where user has MANAGE_GUILD (0x20) or is owner AND the bot is present
      const managedGuilds = userGuildsResponse.data.filter((g: any) => {
        const hasPermission = (BigInt(g.permissions) & BigInt(0x20)) === BigInt(0x20) || g.owner;
        const botPresent = botGuildIds.has(g.id);
        return hasPermission && botPresent;
      });

      res.json(managedGuilds);
    } catch (err: any) {
      console.error("Failed to fetch guilds:", err.response?.data || err.message);
      res.status(500).json({ error: err.message });
    }
  }));

  app.get("/api/discord/guild/:guildId", asyncHandler(async (req: any, res: any) => {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) return res.status(500).json({ error: "Bot token not configured" });

    try {
      const response = await axios.get(`https://discord.com/api/guilds/${req.params.guildId}`, {
        headers: { Authorization: `Bot ${botToken}` }
      });
      res.json(response.data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }));

  app.get("/api/discord/channels/:guildId", asyncHandler(async (req: any, res: any) => {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) return res.status(500).json({ error: "Bot token not configured" });

    try {
      const response = await axios.get(`https://discord.com/api/guilds/${req.params.guildId}/channels`, {
        headers: { Authorization: `Bot ${botToken}` }
      });
      // Filter for text channels (type 0)
      const textChannels = response.data.filter((c: any) => c.type === 0);
      res.json(textChannels);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message;
      console.error(`Discord API Error at /api/discord/channels/${req.params.guildId}:`, errorMsg);
      res.status(500).json({ error: `Failed to fetch channels: ${errorMsg}. Is the bot in this server?` });
    }
  }));

  // Auth API
  app.post("/api/auth/login", asyncHandler(async (req: any, res: any) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    try {
      const userId = username.trim().toLowerCase();
      const user = await db.getUserById(userId);
      
      if (user) {
        if (!user.password) {
          console.error(`Login Error: User ${userId} has no password hash in database.`);
          return res.status(401).json({ error: "Invalid username or password" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (isPasswordValid) {
          if (user.role !== 'superadmin' && !user.isApproved) {
            return res.status(403).json({ error: "Account pending approval by admin" });
          }
          const { password: _, ...userWithoutPassword } = user;
          res.json({ user: userWithoutPassword, token: "mock-jwt-token" });
        } else {
          res.status(401).json({ error: "Invalid username or password" });
        }
      } else {
        res.status(401).json({ error: "Invalid username or password" });
      }
    } catch (err: any) {
      console.error("Login Exception:", err.message);
      res.status(500).json({ error: "An error occurred during login" });
    }
  }));

  app.post("/api/auth/signup", asyncHandler(async (req: any, res: any) => {
    const settings = await db.getSettings();
    if (settings.disableSignups) {
      return res.status(403).json({ error: "Sign-ups are currently disabled by the administrator." });
    }

    const { username, password, ign, uid } = req.body;
    const userId = username.trim().toLowerCase();
    const existingUser = await db.getUserById(userId);
    if (existingUser) return res.status(400).json({ error: "User already exists" });
    
    // Check if UID is already taken
    const users = await db.getUsers();
    const uidExists = Object.values(users).some((u: any) => u.uid === uid);
    if (uidExists) return res.status(400).json({ error: "UID already registered" });

    const originalUsername = username.trim();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check if this is the very first user being registered (fallback if setup wizard wasn't used)
    const isFirstUser = Object.keys(users).length === 0;
    
    const newUser = { 
      id: userId, 
      username: originalUsername, 
      displayName: originalUsername, 
      ign: ign || originalUsername,
      uid: uid || '',
      isApproved: isFirstUser,
      role: isFirstUser ? 'superadmin' : 'user', 
      createdAt: new Date().toISOString(), 
      password: hashedPassword 
    };
    
    await db.saveUser(newUser);
    const { password: _, ...userWithoutPassword } = newUser;
    res.json({ user: userWithoutPassword, token: "mock-jwt-token" });
  }));

  app.post("/api/auth/change-password", checkSelf, asyncHandler(async (req: any, res: any) => {
    const { username, currentPassword, newPassword } = req.body;
    const userId = username.trim().toLowerCase();
    const user = await db.getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Incorrect current password" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await db.saveUser(user);
    res.json({ success: true });
  }));

  app.get("/api/auth/me", asyncHandler(async (req: any, res: any) => {
    res.json({ user: null });
  }));

  app.put("/api/auth/profile", checkSelf, asyncHandler(async (req: any, res: any) => {
    const { username, displayName } = req.body;
    if (!username) return res.status(400).json({ error: "Username is required" });
    
    const userId = username.trim().toLowerCase();
    const user = await db.getUserById(userId);
    
    if (user) {
      user.displayName = displayName;
      await db.saveUser(user);
      res.json({ success: true, user });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  }));

  app.put("/api/auth/password", checkSelf, asyncHandler(async (req: any, res: any) => {
    const { username, currentPassword, newPassword } = req.body;
    if (!username) return res.status(400).json({ error: "Username is required" });
    
    const userId = username.trim().toLowerCase();
    const user = await db.getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Incorrect current password" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await db.saveUser(user);
    res.json({ success: true });
  }));

  // Error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Express Error Handler:", err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({ 
      error: err.message || "Internal Server Error",
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });

  return app;
}
