import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// Simple JSON Database implementation
const DB_FILE = "./db.json";
const initialDb = {
  users: {
    "Darren": {
      "id": "Darren",
      "username": "Darren",
      "displayName": "Darren",
      "role": "superadmin",
      "createdAt": "2026-03-28T19:51:05Z",
      "password": "password123"
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

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
}

const getDb = () => {
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    return initialDb;
  }
};
const saveDb = (data: any) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Auth Middleware (Mock)
  const authMiddleware = (req: any, res: any, next: any) => {
    // In a real app, we would verify the JWT token here
    next();
  };

  // Admin Management: Pre-authorize Admin/Member
  app.post("/api/admins/create", async (req, res) => {
    const { username, displayName, role, password } = req.body;
    const targetRole = role || "admin";

    try {
      const db = getDb();
      const userId = username.trim();
      
      db.users[userId] = {
        id: userId,
        username: userId,
        displayName: displayName || userId,
        role: targetRole,
        createdAt: new Date().toISOString(),
        isPreAuthorized: true,
        password: password || "password123"
      };

      saveDb(db);
      res.json({ success: true, id: userId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Users API
  app.get("/api/users", (req, res) => {
    const db = getDb();
    res.json(Object.values(db.users));
  });

  app.put("/api/users/:id", (req, res) => {
    const db = getDb();
    const id = req.params.id;
    if (db.users[id]) {
      db.users[id] = { ...db.users[id], ...req.body };
      saveDb(db);
      res.json(db.users[id]);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  app.delete("/api/users/:id", (req, res) => {
    const db = getDb();
    delete db.users[req.params.id];
    saveDb(db);
    res.json({ success: true });
  });

  // Members API
  app.get("/api/members", (req, res) => {
    const db = getDb();
    res.json(db.members);
  });

  app.post("/api/members", (req, res) => {
    const db = getDb();
    const newMember = { ...req.body, id: Date.now().toString() };
    db.members.push(newMember);
    saveDb(db);
    res.json(newMember);
  });

  app.put("/api/members/:id", (req, res) => {
    const db = getDb();
    const index = db.members.findIndex((m: any) => m.id === req.params.id);
    if (index !== -1) {
      db.members[index] = { ...db.members[index], ...req.body };
      saveDb(db);
      res.json(db.members[index]);
    } else {
      res.status(404).json({ error: "Member not found" });
    }
  });

  app.delete("/api/members/:id", (req, res) => {
    const db = getDb();
    db.members = db.members.filter((m: any) => m.id !== req.params.id);
    saveDb(db);
    res.json({ success: true });
  });

  // Jobs API
  app.get("/api/jobs", (req, res) => {
    const db = getDb();
    res.json(db.jobs || []);
  });

  app.post("/api/jobs", (req, res) => {
    const db = getDb();
    const newJob = { ...req.body, id: Date.now().toString() };
    if (!db.jobs) db.jobs = [];
    db.jobs.push(newJob);
    saveDb(db);
    res.json(newJob);
  });

  app.put("/api/jobs/:id", (req, res) => {
    const db = getDb();
    const index = db.jobs.findIndex((j: any) => j.id === req.params.id);
    if (index !== -1) {
      db.jobs[index] = { ...db.jobs[index], ...req.body };
      saveDb(db);
      res.json(db.jobs[index]);
    } else {
      res.status(404).json({ error: "Job not found" });
    }
  });

  app.delete("/api/jobs/:id", (req, res) => {
    const db = getDb();
    db.jobs = db.jobs.filter((j: any) => j.id !== req.params.id);
    saveDb(db);
    res.json({ success: true });
  });

  // Events API
  app.get("/api/events", (req, res) => {
    const db = getDb();
    res.json(db.events || []);
  });

  app.get("/api/events/:id", (req, res) => {
    const db = getDb();
    const event = (db.events || []).find((e: any) => e.id === req.params.id);
    if (event) res.json(event);
    else res.status(404).json({ error: "Event not found" });
  });

  app.post("/api/events", (req, res) => {
    const db = getDb();
    const newEvent = { 
      ...req.body, 
      id: Date.now().toString(),
      subevents: []
    };
    if (!db.events) db.events = [];
    db.events.push(newEvent);
    saveDb(db);
    res.json(newEvent);
  });

  app.put("/api/events/:id", (req, res) => {
    const db = getDb();
    const index = (db.events || []).findIndex((e: any) => e.id === req.params.id);
    if (index !== -1) {
      db.events[index] = { ...db.events[index], ...req.body };
      saveDb(db);
      res.json(db.events[index]);
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  });

  app.delete("/api/events/:id", (req, res) => {
    const db = getDb();
    db.events = (db.events || []).filter((e: any) => e.id !== req.params.id);
    saveDb(db);
    res.json({ success: true });
  });

  // SubEvents API
  app.get("/api/events/:eventId/subevents", (req, res) => {
    const db = getDb();
    const event = (db.events || []).find((e: any) => e.id === req.params.eventId);
    res.json(event?.subevents || []);
  });

  app.post("/api/events/:eventId/subevents", (req, res) => {
    const db = getDb();
    const eventIndex = (db.events || []).findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const newSubEvent = { ...req.body, id: Date.now().toString(), parties: [] };
      if (!db.events[eventIndex].subevents) db.events[eventIndex].subevents = [];
      db.events[eventIndex].subevents.push(newSubEvent);
      saveDb(db);
      res.json(newSubEvent);
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  });

  app.put("/api/events/:eventId/subevents/:id", (req, res) => {
    const db = getDb();
    const eventIndex = (db.events || []).findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = db.events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.id);
      if (subIndex !== -1) {
        db.events[eventIndex].subevents[subIndex] = { ...db.events[eventIndex].subevents[subIndex], ...req.body };
        saveDb(db);
        res.json(db.events[eventIndex].subevents[subIndex]);
      } else {
        res.status(404).json({ error: "SubEvent not found" });
      }
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  });

  app.delete("/api/events/:eventId/subevents/:id", (req, res) => {
    const db = getDb();
    const eventIndex = (db.events || []).findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      db.events[eventIndex].subevents = db.events[eventIndex].subevents.filter((s: any) => s.id !== req.params.id);
      saveDb(db);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  });

  // Parties API
  app.get("/api/events/:eventId/subevents/:subEventId/parties", (req, res) => {
    const db = getDb();
    const event = (db.events || []).find((e: any) => e.id === req.params.eventId);
    const subEvent = event?.subevents?.find((s: any) => s.id === req.params.subEventId);
    res.json(subEvent?.parties || []);
  });

  app.post("/api/events/:eventId/subevents/:subEventId/parties", (req, res) => {
    const db = getDb();
    const eventIndex = (db.events || []).findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = db.events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const newParty = { ...req.body, id: Date.now().toString(), assignments: [] };
        if (!db.events[eventIndex].subevents[subIndex].parties) db.events[eventIndex].subevents[subIndex].parties = [];
        db.events[eventIndex].subevents[subIndex].parties.push(newParty);
        saveDb(db);
        res.json(newParty);
      } else {
        res.status(404).json({ error: "SubEvent not found" });
      }
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  });

  app.put("/api/events/:eventId/subevents/:subEventId/parties/:id", (req, res) => {
    const db = getDb();
    const eventIndex = (db.events || []).findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = db.events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const partyIndex = db.events[eventIndex].subevents[subIndex].parties.findIndex((p: any) => p.id === req.params.id);
        if (partyIndex !== -1) {
          db.events[eventIndex].subevents[subIndex].parties[partyIndex] = { ...db.events[eventIndex].subevents[subIndex].parties[partyIndex], ...req.body };
          saveDb(db);
          res.json(db.events[eventIndex].subevents[subIndex].parties[partyIndex]);
        } else {
          res.status(404).json({ error: "Party not found" });
        }
      } else {
        res.status(404).json({ error: "SubEvent not found" });
      }
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  });

  app.delete("/api/events/:eventId/subevents/:subEventId/parties/:id", (req, res) => {
    const db = getDb();
    const eventIndex = (db.events || []).findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = db.events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        db.events[eventIndex].subevents[subIndex].parties = db.events[eventIndex].subevents[subIndex].parties.filter((p: any) => p.id !== req.params.id);
        saveDb(db);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "SubEvent not found" });
      }
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  });

  // Assignments API
  app.get("/api/events/:eventId/subevents/:subEventId/parties/:partyId/assignments", (req, res) => {
    const db = getDb();
    const event = (db.events || []).find((e: any) => e.id === req.params.eventId);
    const subEvent = event?.subevents?.find((s: any) => s.id === req.params.subEventId);
    const party = subEvent?.parties?.find((p: any) => p.id === req.params.partyId);
    res.json(party?.assignments || []);
  });

  app.post("/api/events/:eventId/subevents/:subEventId/parties/:partyId/assignments", (req, res) => {
    const db = getDb();
    const eventIndex = (db.events || []).findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = db.events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const partyIndex = db.events[eventIndex].subevents[subIndex].parties.findIndex((p: any) => p.id === req.params.partyId);
        if (partyIndex !== -1) {
          const newAssignment = { ...req.body, id: Date.now().toString() };
          if (!db.events[eventIndex].subevents[subIndex].parties[partyIndex].assignments) db.events[eventIndex].subevents[subIndex].parties[partyIndex].assignments = [];
          db.events[eventIndex].subevents[subIndex].parties[partyIndex].assignments.push(newAssignment);
          saveDb(db);
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
  });

  app.delete("/api/events/:eventId/subevents/:subEventId/parties/:partyId/assignments/:id", (req, res) => {
    const db = getDb();
    const eventIndex = (db.events || []).findIndex((e: any) => e.id === req.params.eventId);
    if (eventIndex !== -1) {
      const subIndex = db.events[eventIndex].subevents.findIndex((s: any) => s.id === req.params.subEventId);
      if (subIndex !== -1) {
        const partyIndex = db.events[eventIndex].subevents[subIndex].parties.findIndex((p: any) => p.id === req.params.partyId);
        if (partyIndex !== -1) {
          db.events[eventIndex].subevents[subIndex].parties[partyIndex].assignments = db.events[eventIndex].subevents[subIndex].parties[partyIndex].assignments.filter((a: any) => a.id !== req.params.id);
          saveDb(db);
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
  });

  // Settings API
  app.get("/api/settings", (req, res) => {
    const db = getDb();
    res.json(db.settings.guild_settings);
  });

  app.get("/api/settings/guild_settings", (req, res) => {
    const db = getDb();
    res.json(db.settings.guild_settings);
  });

  app.post("/api/settings/guild_settings", (req, res) => {
    const db = getDb();
    db.settings.guild_settings = { ...db.settings.guild_settings, ...req.body };
    saveDb(db);
    res.json(db.settings.guild_settings);
  });

  // Auth API
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const db = getDb();
    const user = db.users[username.trim()];

    if (user && (user.password === password || !user.password)) {
      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, token: "mock-jwt-token" });
    } else {
      res.status(401).json({ error: "Invalid username or password" });
    }
  });

  app.post("/api/auth/signup", (req, res) => {
    const { username, password } = req.body;
    const db = getDb();
    const userId = username.trim();
    
    if (db.users[userId]) {
      return res.status(400).json({ error: "User already exists" });
    }

    const newUser = {
      id: userId,
      username: userId,
      displayName: userId,
      role: userId === 'Darren' ? 'superadmin' : 'member',
      createdAt: new Date().toISOString(),
      password
    };

    db.users[userId] = newUser;
    saveDb(db);
    
    const { password: _, ...userWithoutPassword } = newUser;
    res.json({ user: userWithoutPassword, token: "mock-jwt-token" });
  });

  app.get("/api/auth/me", (req, res) => {
    // In a real app, we would get the user from the token
    res.json({ user: null });
  });

  app.put("/api/auth/profile", (req, res) => {
    res.json({ success: true });
  });

  app.put("/api/auth/password", (req, res) => {
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
