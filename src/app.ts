import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { Database, FileDatabase, SupabaseDatabase, ensureDataIntegrity } from "./db";

export const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export function createApp() {
  const app = express();

  // Initialize Database
  let db: Database;
  const isVercel = process.env.VERCEL === '1';
  const hasSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY;

  if (isVercel && !hasSupabase) {
    console.warn("WARNING: Running on Vercel without Supabase configuration. Data persistence will not work.");
  }

  try {
    db = hasSupabase 
      ? new SupabaseDatabase() 
      : new FileDatabase();
    
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

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", database: process.env.SUPABASE_URL ? 'supabase' : 'file' });
  });

  // Admin Management
  app.post("/api/admins/create", asyncHandler(async (req: any, res: any) => {
    const { username, displayName, role, password } = req.body;
    const targetRole = role || "admin";
    const userId = username.trim().toLowerCase();
    
    const hashedPassword = await bcrypt.hash(password || "password123", 10);
    
    const newUser = {
      id: userId,
      username: userId,
      displayName: displayName || userId,
      role: targetRole,
      createdAt: new Date().toISOString(),
      isPreAuthorized: true,
      password: hashedPassword
    };
    
    await db.saveUser(newUser);
    res.json({ success: true, id: userId });
  }));

  // Users API
  app.get("/api/users", asyncHandler(async (req: any, res: any) => {
    const users = await db.getUsers();
    res.json(Object.values(users));
  }));

  app.put("/api/users/:id", asyncHandler(async (req: any, res: any) => {
    const users = await db.getUsers();
    const id = req.params.id;
    if (users[id]) {
      const updatedUser = { ...users[id], ...req.body };
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

  app.delete("/api/users/:id", asyncHandler(async (req: any, res: any) => {
    const users = await db.getUsers();
    const user = users[req.params.id];
    if (user && user.role === 'superadmin') {
      return res.status(403).json({ error: "Cannot delete superadmin account" });
    }
    await db.deleteUser(req.params.id);
    res.json({ success: true });
  }));

  // Members API
  app.get("/api/members", asyncHandler(async (req: any, res: any) => {
    const members = await db.getMembers();
    res.json(members);
  }));

  app.post("/api/members", asyncHandler(async (req: any, res: any) => {
    const newMember = { ...req.body, id: Date.now().toString() };
    await db.saveMember(newMember);
    res.json(newMember);
  }));

  app.put("/api/members/:id", asyncHandler(async (req: any, res: any) => {
    const members = await db.getMembers();
    const index = members.findIndex((m: any) => m.id === req.params.id);
    if (index !== -1) {
      const updatedMember = { ...members[index], ...req.body };
      await db.saveMember(updatedMember);
      res.json(updatedMember);
    } else {
      res.status(404).json({ error: "Member not found" });
    }
  }));

  app.delete("/api/members/:id", asyncHandler(async (req: any, res: any) => {
    await db.deleteMember(req.params.id);
    res.json({ success: true });
  }));

  // Jobs API
  app.get("/api/jobs", asyncHandler(async (req: any, res: any) => {
    const jobs = await db.getJobs();
    res.json(jobs);
  }));

  app.post("/api/jobs", asyncHandler(async (req: any, res: any) => {
    const newJob = { ...req.body, id: Date.now().toString() };
    await db.saveJob(newJob);
    res.json(newJob);
  }));

  app.put("/api/jobs/:id", asyncHandler(async (req: any, res: any) => {
    const jobs = await db.getJobs();
    const index = jobs.findIndex((j: any) => j.id === req.params.id);
    if (index !== -1) {
      const oldName = jobs[index].name;
      const newName = req.body.name;
      const updatedJob = { ...jobs[index], ...req.body };
      
      if (oldName !== newName) {
        const members = await db.getMembers();
        const updatedMembers = members.map((m: any) => m.job === oldName ? { ...m, job: newName } : m);
        // This is still a bit slow, but better than before
        for (const m of updatedMembers) {
          if (m.job === newName) await db.saveMember(m);
        }
      }
      
      await db.saveJob(updatedJob);
      res.json(updatedJob);
    } else {
      res.status(404).json({ error: "Job not found" });
    }
  }));

  app.delete("/api/jobs/:id", asyncHandler(async (req: any, res: any) => {
    await db.deleteJob(req.params.id);
    res.json({ success: true });
  }));

  // Events API
  app.get("/api/events", asyncHandler(async (req: any, res: any) => {
    const events = await db.getEvents();
    res.json(events);
  }));

  app.get("/api/events/:id", asyncHandler(async (req: any, res: any) => {
    const events = await db.getEvents();
    const event = events.find((e: any) => e.id === req.params.id);
    if (event) res.json(event);
    else res.status(404).json({ error: "Event not found" });
  }));

  app.post("/api/events", asyncHandler(async (req: any, res: any) => {
    const newEvent = { ...req.body, id: Date.now().toString(), subevents: [] };
    await db.saveEvent(newEvent);
    res.json(newEvent);
  }));

  app.put("/api/events/:id", asyncHandler(async (req: any, res: any) => {
    const events = await db.getEvents();
    const index = events.findIndex((e: any) => e.id === req.params.id);
    if (index !== -1) {
      const updatedEvent = { ...events[index], ...req.body };
      await db.saveEvent(updatedEvent);
      res.json(updatedEvent);
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.delete("/api/events/:id", asyncHandler(async (req: any, res: any) => {
    await db.deleteEvent(req.params.id);
    res.json({ success: true });
  }));

  // SubEvents API
  app.get("/api/events/:eventId/subevents", asyncHandler(async (req: any, res: any) => {
    const events = await db.getEvents();
    const event = events.find((e: any) => e.id === req.params.eventId);
    res.json(event?.subevents || []);
  }));

  app.post("/api/events/:eventId/subevents", asyncHandler(async (req: any, res: any) => {
    const events = await db.getEvents();
    const eventIndex = events.findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const newSubEvent = { ...req.body, id: Date.now().toString(), parties: [] };
      if (!events[eventIndex].subevents) events[eventIndex].subevents = [];
      events[eventIndex].subevents.push(newSubEvent);
      await db.saveEvent(events[eventIndex]);
      res.json(newSubEvent);
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.put("/api/events/:eventId/subevents/:id", asyncHandler(async (req: any, res: any) => {
    const events = await db.getEvents();
    const eventIndex = events.findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.id);
      if (subIndex !== -1) {
        events[eventIndex].subevents[subIndex] = { ...events[eventIndex].subevents[subIndex], ...req.body };
        await db.saveEvent(events[eventIndex]);
        res.json(events[eventIndex].subevents[subIndex]);
      } else {
        res.status(404).json({ error: "SubEvent not found" });
      }
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.put("/api/events/:eventId/subevents-reorder", asyncHandler(async (req: any, res: any) => {
    const { subevents } = req.body;
    const events = await db.getEvents();
    const eventIndex = events.findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      events[eventIndex].subevents = subevents;
      await db.saveEvent(events[eventIndex]);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.delete("/api/events/:eventId/subevents/:id", asyncHandler(async (req: any, res: any) => {
    const events = await db.getEvents();
    const eventIndex = events.findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      events[eventIndex].subevents = events[eventIndex].subevents.filter((s: any) => s.id !== req.params.id);
      await db.saveEvent(events[eventIndex]);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  // Parties API
  app.get("/api/events/:eventId/subevents/:subEventId/parties", asyncHandler(async (req: any, res: any) => {
    const events = await db.getEvents();
    const event = events.find((e: any) => e.id === req.params.eventId);
    const subEvent = event?.subevents?.find((s: any) => s.id === req.params.subEventId);
    res.json(subEvent?.parties || []);
  }));

  app.post("/api/events/:eventId/subevents/:subEventId/parties", asyncHandler(async (req: any, res: any) => {
    const events = await db.getEvents();
    const eventIndex = events.findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const newParty = { ...req.body, id: Date.now().toString(), assignments: [] };
        if (!events[eventIndex].subevents[subIndex].parties) events[eventIndex].subevents[subIndex].parties = [];
        events[eventIndex].subevents[subIndex].parties.push(newParty);
        await db.saveEvent(events[eventIndex]);
        res.json(newParty);
      } else {
        res.status(404).json({ error: "SubEvent not found" });
      }
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.put("/api/events/:eventId/subevents/:subEventId/parties/:id", asyncHandler(async (req: any, res: any) => {
    const events = await db.getEvents();
    const eventIndex = events.findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const partyIndex = events[eventIndex].subevents[subIndex].parties.findIndex((p: any) => p.id === req.params.id);
        if (partyIndex !== -1) {
          events[eventIndex].subevents[subIndex].parties[partyIndex] = { ...events[eventIndex].subevents[subIndex].parties[partyIndex], ...req.body };
          await db.saveEvent(events[eventIndex]);
          res.json(events[eventIndex].subevents[subIndex].parties[partyIndex]);
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
    const events = await db.getEvents();
    const eventIndex = events.findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        events[eventIndex].subevents[subIndex].parties = parties;
        await db.saveEvent(events[eventIndex]);
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
    const events = await db.getEvents();
    const eventIndex = events.findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex === -1) return res.status(404).json({ error: "Event not found" });

    const fromSubIndex = events[eventIndex].subevents.findIndex((s: any) => s.id === fromSubEventId);
    const toSubIndex = events[eventIndex].subevents.findIndex((s: any) => s.id === toSubEventId);

    if (fromSubIndex === -1 || toSubIndex === -1) return res.status(404).json({ error: "SubEvent not found" });

    const partyIndex = events[eventIndex].subevents[fromSubIndex].parties.findIndex((p: any) => p.id === partyId);
    if (partyIndex === -1) return res.status(404).json({ error: "Party not found" });

    const [party] = events[eventIndex].subevents[fromSubIndex].parties.splice(partyIndex, 1);
    events[eventIndex].subevents[toSubIndex].parties.splice(newIndex, 0, party);

    // Update orders
    events[eventIndex].subevents[fromSubIndex].parties.forEach((p: any, i: number) => p.order = i);
    events[eventIndex].subevents[toSubIndex].parties.forEach((p: any, i: number) => p.order = i);

    await db.saveEvent(events[eventIndex]);
    res.json({ success: true });
  }));

  app.delete("/api/events/:eventId/subevents/:subEventId/parties/:id", asyncHandler(async (req: any, res: any) => {
    const events = await db.getEvents();
    const eventIndex = events.findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        events[eventIndex].subevents[subIndex].parties = events[eventIndex].subevents[subIndex].parties.filter((p: any) => p.id !== req.params.id);
        await db.saveEvent(events[eventIndex]);
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
    const events = await db.getEvents();
    const event = events.find((e: any) => e.id === req.params.eventId);
    const subEvent = event?.subevents?.find((s: any) => s.id === req.params.subEventId);
    const party = subEvent?.parties?.find((p: any) => p.id === req.params.partyId);
    res.json(party?.assignments || []);
  }));

  app.post("/api/events/:eventId/subevents/:subEventId/parties/:partyId/assignments", asyncHandler(async (req: any, res: any) => {
    const events = await db.getEvents();
    const eventIndex = events.findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const partyIndex = events[eventIndex].subevents[subIndex].parties.findIndex((p: any) => p.id === req.params.partyId);
        if (partyIndex !== -1) {
          const newAssignment = { ...req.body, id: Date.now().toString() };
          if (!events[eventIndex].subevents[subIndex].parties[partyIndex].assignments) events[eventIndex].subevents[subIndex].parties[partyIndex].assignments = [];
          events[eventIndex].subevents[subIndex].parties[partyIndex].assignments.push(newAssignment);
          await db.saveEvent(events[eventIndex]);
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
    const events = await db.getEvents();
    const eventIndex = events.findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const partyIndex = events[eventIndex].subevents[subIndex].parties.findIndex((p: any) => p.id === req.params.partyId);
        if (partyIndex !== -1) {
          const assignIndex = events[eventIndex].subevents[subIndex].parties[partyIndex].assignments.findIndex((a: any) => a.id === req.params.id);
          if (assignIndex !== -1) {
            events[eventIndex].subevents[subIndex].parties[partyIndex].assignments[assignIndex] = { ...events[eventIndex].subevents[subIndex].parties[partyIndex].assignments[assignIndex], ...req.body };
            await db.saveEvent(events[eventIndex]);
            res.json(events[eventIndex].subevents[subIndex].parties[partyIndex].assignments[assignIndex]);
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
    const events = await db.getEvents();
    const eventIndex = events.findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const partyIndex = events[eventIndex].subevents[subIndex].parties.findIndex((p: any) => p.id === req.params.partyId);
        if (partyIndex !== -1) {
          events[eventIndex].subevents[subIndex].parties[partyIndex].assignments = assignments;
          await db.saveEvent(events[eventIndex]);
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
    const events = await db.getEvents();
    const eventIndex = events.findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const partyIndex = events[eventIndex].subevents[subIndex].parties.findIndex((p: any) => p.id === req.params.partyId);
        if (partyIndex !== -1) {
          events[eventIndex].subevents[subIndex].parties[partyIndex].assignments = events[eventIndex].subevents[subIndex].parties[partyIndex].assignments.filter((a: any) => a.id !== req.params.id);
          await db.saveEvent(events[eventIndex]);
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
    const settings = await db.getSettings();
    res.json(settings);
  }));

  app.get("/api/settings/guild_settings", asyncHandler(async (req: any, res: any) => {
    const settings = await db.getSettings();
    res.json(settings);
  }));

  app.post("/api/settings/guild_settings", asyncHandler(async (req: any, res: any) => {
    const settings = await db.getSettings();
    const updatedSettings = { ...settings, ...req.body };
    await db.saveSettings(updatedSettings);
    res.json(updatedSettings);
  }));

  // Auth API
  app.post("/api/auth/login", asyncHandler(async (req: any, res: any) => {
    const { username, password } = req.body;
    const users = await db.getUsers();
    const userId = username.trim().toLowerCase();
    const user = users[userId];
    
    if (user) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (isPasswordValid) {
        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword, token: "mock-jwt-token" });
      } else {
        res.status(401).json({ error: "Invalid username or password" });
      }
    } else {
      res.status(401).json({ error: "Invalid username or password" });
    }
  }));

  app.post("/api/auth/signup", asyncHandler(async (req: any, res: any) => {
    const { username, password } = req.body;
    const users = await db.getUsers();
    const userId = username.trim().toLowerCase();
    if (users[userId]) return res.status(400).json({ error: "User already exists" });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = { 
      id: userId, 
      username: userId, 
      displayName: userId, 
      role: userId === 'readyhit' ? 'superadmin' : 'member', 
      createdAt: new Date().toISOString(), 
      password: hashedPassword 
    };
    
    await db.saveUser(newUser);
    const { password: _, ...userWithoutPassword } = newUser;
    res.json({ user: userWithoutPassword, token: "mock-jwt-token" });
  }));

  app.post("/api/auth/change-password", asyncHandler(async (req: any, res: any) => {
    const { username, currentPassword, newPassword } = req.body;
    const users = await db.getUsers();
    const userId = username.trim().toLowerCase();
    const user = users[userId];

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

  app.put("/api/auth/profile", asyncHandler(async (req: any, res: any) => {
    const { username, displayName } = req.body;
    if (!username) return res.status(400).json({ error: "Username is required" });
    
    const users = await db.getUsers();
    const userId = username.trim().toLowerCase();
    const user = users[userId];
    
    if (user) {
      user.displayName = displayName;
      await db.saveUser(user);
      res.json({ success: true, user });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  }));

  app.put("/api/auth/password", asyncHandler(async (req: any, res: any) => {
    const { username, currentPassword, newPassword } = req.body;
    if (!username) return res.status(400).json({ error: "Username is required" });
    
    const users = await db.getUsers();
    const userId = username.trim().toLowerCase();
    const user = users[userId];

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
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });

  return app;
}
