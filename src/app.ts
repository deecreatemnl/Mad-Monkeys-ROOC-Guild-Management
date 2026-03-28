import express from "express";
import cors from "cors";
import { Database, SupabaseDatabase, ensureDataIntegrity } from "./db";

export const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export function createApp() {
  const app = express();

  // Initialize Database
  let db: Database;
  try {
    db = new SupabaseDatabase();
  } catch (error: any) {
    console.error("Database Initialization Error:", error.message);
    // If Supabase is not configured, we'll throw an error on the first request
    // or we can provide a dummy DB that throws errors.
    db = {
      get: async () => { throw new Error("Database not configured: " + error.message); },
      save: async () => { throw new Error("Database not configured: " + error.message); }
    };
  }

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      database: 'supabase',
      configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
    });
  });

  // Admin Management
  app.post("/api/admins/create", asyncHandler(async (req: any, res: any) => {
    const { username, displayName, role, password } = req.body;
    const targetRole = role || "admin";
    const data = ensureDataIntegrity(await db.get());
    const userId = username.trim();
    data.users[userId] = {
      id: userId,
      username: userId,
      displayName: displayName || userId,
      role: targetRole,
      createdAt: new Date().toISOString(),
      isPreAuthorized: true,
      password: password || "password123"
    };
    await db.save(data);
    res.json({ success: true, id: userId });
  }));

  // Users API
  app.get("/api/users", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    res.json(Object.values(data.users));
  }));

  app.put("/api/users/:id", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    const id = req.params.id;
    if (data.users[id]) {
      data.users[id] = { ...data.users[id], ...req.body };
      await db.save(data);
      res.json(data.users[id]);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  }));

  app.delete("/api/users/:id", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    const user = data.users[req.params.id];
    if (user && user.role === 'superadmin') {
      return res.status(403).json({ error: "Cannot delete superadmin account" });
    }
    delete data.users[req.params.id];
    await db.save(data);
    res.json({ success: true });
  }));

  // Members API
  app.get("/api/members", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    res.json(data.members);
  }));

  app.post("/api/members", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    const newMember = { ...req.body, id: Date.now().toString() };
    data.members.push(newMember);
    await db.save(data);
    res.json(newMember);
  }));

  app.put("/api/members/:id", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    const index = data.members.findIndex((m: any) => m.id === req.params.id);
    if (index !== -1) {
      data.members[index] = { ...data.members[index], ...req.body };
      await db.save(data);
      res.json(data.members[index]);
    } else {
      res.status(404).json({ error: "Member not found" });
    }
  }));

  app.delete("/api/members/:id", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    data.members = data.members.filter((m: any) => m.id !== req.params.id);
    await db.save(data);
    res.json({ success: true });
  }));

  // Jobs API
  app.get("/api/jobs", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    res.json(data.jobs || []);
  }));

  app.post("/api/jobs", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    const newJob = { ...req.body, id: Date.now().toString() };
    if (!data.jobs) data.jobs = [];
    data.jobs.push(newJob);
    await db.save(data);
    res.json(newJob);
  }));

  app.put("/api/jobs/:id", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    const index = data.jobs.findIndex((j: any) => j.id === req.params.id);
    if (index !== -1) {
      const oldName = data.jobs[index].name;
      const newName = req.body.name;
      data.jobs[index] = { ...data.jobs[index], ...req.body };
      if (oldName !== newName) {
        data.members = data.members.map((m: any) => m.job === oldName ? { ...m, job: newName } : m);
      }
      await db.save(data);
      res.json(data.jobs[index]);
    } else {
      res.status(404).json({ error: "Job not found" });
    }
  }));

  app.delete("/api/jobs/:id", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    data.jobs = data.jobs.filter((j: any) => j.id !== req.params.id);
    await db.save(data);
    res.json({ success: true });
  }));

  // Events API
  app.get("/api/events", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    res.json(data.events || []);
  }));

  app.get("/api/events/:id", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    const event = (data.events || []).find((e: any) => e.id === req.params.id);
    if (event) res.json(event);
    else res.status(404).json({ error: "Event not found" });
  }));

  app.post("/api/events", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    const newEvent = { ...req.body, id: Date.now().toString(), subevents: [] };
    if (!data.events) data.events = [];
    data.events.push(newEvent);
    await db.save(data);
    res.json(newEvent);
  }));

  app.put("/api/events/:id", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    const index = (data.events || []).findIndex((e: any) => e.id === req.params.id);
    if (index !== -1) {
      data.events[index] = { ...data.events[index], ...req.body };
      await db.save(data);
      res.json(data.events[index]);
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.delete("/api/events/:id", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    data.events = (data.events || []).filter((e: any) => e.id !== req.params.id);
    await db.save(data);
    res.json({ success: true });
  }));

  // SubEvents API
  app.get("/api/events/:eventId/subevents", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    const event = (data.events || []).find((e: any) => e.id === req.params.eventId);
    res.json(event?.subevents || []);
  }));

  app.post("/api/events/:eventId/subevents", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    const eventIndex = (data.events || []).findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const newSubEvent = { ...req.body, id: Date.now().toString(), parties: [] };
      if (!data.events[eventIndex].subevents) data.events[eventIndex].subevents = [];
      data.events[eventIndex].subevents.push(newSubEvent);
      await db.save(data);
      res.json(newSubEvent);
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.put("/api/events/:eventId/subevents/:id", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    const eventIndex = (data.events || []).findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = data.events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.id);
      if (subIndex !== -1) {
        data.events[eventIndex].subevents[subIndex] = { ...data.events[eventIndex].subevents[subIndex], ...req.body };
        await db.save(data);
        res.json(data.events[eventIndex].subevents[subIndex]);
      } else {
        res.status(404).json({ error: "SubEvent not found" });
      }
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.delete("/api/events/:eventId/subevents/:id", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    const eventIndex = (data.events || []).findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      data.events[eventIndex].subevents = data.events[eventIndex].subevents.filter((s: any) => s.id !== req.params.id);
      await db.save(data);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  // Parties API
  app.get("/api/events/:eventId/subevents/:subEventId/parties", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    const event = (data.events || []).find((e: any) => e.id === req.params.eventId);
    const subEvent = event?.subevents?.find((s: any) => s.id === req.params.subEventId);
    res.json(subEvent?.parties || []);
  }));

  app.post("/api/events/:eventId/subevents/:subEventId/parties", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    const eventIndex = (data.events || []).findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = data.events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const newParty = { ...req.body, id: Date.now().toString(), assignments: [] };
        if (!data.events[eventIndex].subevents[subIndex].parties) data.events[eventIndex].subevents[subIndex].parties = [];
        data.events[eventIndex].subevents[subIndex].parties.push(newParty);
        await db.save(data);
        res.json(newParty);
      } else {
        res.status(404).json({ error: "SubEvent not found" });
      }
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  }));

  app.put("/api/events/:eventId/subevents/:subEventId/parties/:id", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    const eventIndex = (data.events || []).findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = data.events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const partyIndex = data.events[eventIndex].subevents[subIndex].parties.findIndex((p: any) => p.id === req.params.id);
        if (partyIndex !== -1) {
          data.events[eventIndex].subevents[subIndex].parties[partyIndex] = { ...data.events[eventIndex].subevents[subIndex].parties[partyIndex], ...req.body };
          await db.save(data);
          res.json(data.events[eventIndex].subevents[subIndex].parties[partyIndex]);
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

  app.delete("/api/events/:eventId/subevents/:subEventId/parties/:id", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    const eventIndex = (data.events || []).findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = data.events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        data.events[eventIndex].subevents[subIndex].parties = data.events[eventIndex].subevents[subIndex].parties.filter((p: any) => p.id !== req.params.id);
        await db.save(data);
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
    const data = ensureDataIntegrity(await db.get());
    const event = (data.events || []).find((e: any) => e.id === req.params.eventId);
    const subEvent = event?.subevents?.find((s: any) => s.id === req.params.subEventId);
    const party = subEvent?.parties?.find((p: any) => p.id === req.params.partyId);
    res.json(party?.assignments || []);
  }));

  app.post("/api/events/:eventId/subevents/:subEventId/parties/:partyId/assignments", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    const eventIndex = (data.events || []).findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = data.events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const partyIndex = data.events[eventIndex].subevents[subIndex].parties.findIndex((p: any) => p.id === req.params.partyId);
        if (partyIndex !== -1) {
          const newAssignment = { ...req.body, id: Date.now().toString() };
          if (!data.events[eventIndex].subevents[subIndex].parties[partyIndex].assignments) data.events[eventIndex].subevents[subIndex].parties[partyIndex].assignments = [];
          data.events[eventIndex].subevents[subIndex].parties[partyIndex].assignments.push(newAssignment);
          await db.save(data);
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

  app.delete("/api/events/:eventId/subevents/:subEventId/parties/:partyId/assignments/:id", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    const eventIndex = (data.events || []).findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = data.events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const partyIndex = data.events[eventIndex].subevents[subIndex].parties.findIndex((p: any) => p.id === req.params.partyId);
        if (partyIndex !== -1) {
          data.events[eventIndex].subevents[subIndex].parties[partyIndex].assignments = data.events[eventIndex].subevents[subIndex].parties[partyIndex].assignments.filter((a: any) => a.id !== req.params.id);
          await db.save(data);
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
    const data = ensureDataIntegrity(await db.get());
    res.json(data.settings.guild_settings);
  }));

  app.get("/api/settings/guild_settings", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    res.json(data.settings.guild_settings);
  }));

  app.post("/api/settings/guild_settings", asyncHandler(async (req: any, res: any) => {
    const data = ensureDataIntegrity(await db.get());
    data.settings.guild_settings = { ...data.settings.guild_settings, ...req.body };
    await db.save(data);
    res.json(data.settings.guild_settings);
  }));

  // Auth API
  app.post("/api/auth/login", asyncHandler(async (req: any, res: any) => {
    const { username, password } = req.body;
    const data = ensureDataIntegrity(await db.get());
    const user = data.users[username.trim()];
    if (user && (user.password === password || !user.password)) {
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, token: "mock-jwt-token" });
    } else {
      res.status(401).json({ error: "Invalid username or password" });
    }
  }));

  app.post("/api/auth/signup", asyncHandler(async (req: any, res: any) => {
    const { username, password } = req.body;
    const data = ensureDataIntegrity(await db.get());
    const userId = username.trim();
    if (data.users[userId]) return res.status(400).json({ error: "User already exists" });
    const newUser = { id: userId, username: userId, displayName: userId, role: userId === 'ReadyHit' ? 'superadmin' : 'member', createdAt: new Date().toISOString(), password };
    data.users[userId] = newUser;
    await db.save(data);
    const { password: _, ...userWithoutPassword } = newUser;
    res.json({ user: userWithoutPassword, token: "mock-jwt-token" });
  }));

  app.post("/api/auth/change-password", asyncHandler(async (req: any, res: any) => {
    const { username, currentPassword, newPassword } = req.body;
    const data = ensureDataIntegrity(await db.get());
    const user = data.users[username];

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.password && user.password !== currentPassword) {
      return res.status(401).json({ error: "Incorrect current password" });
    }

    user.password = newPassword;
    await db.save(data);
    res.json({ success: true });
  }));

  app.get("/api/auth/me", asyncHandler(async (req: any, res: any) => {
    res.json({ user: null });
  }));

  app.put("/api/auth/profile", asyncHandler(async (req: any, res: any) => {
    res.json({ success: true });
  }));

  app.put("/api/auth/password", asyncHandler(async (req: any, res: any) => {
    res.json({ success: true });
  }));

  // Error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Express Error Handler:", err);
    res.status(500).json({ 
      error: err.message || "Internal Server Error",
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
  });

  return app;
}
