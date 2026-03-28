import express from "express";
import cors from "cors";
import { supabase, hashPassword, comparePassword } from "./db";

export const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Check if Supabase is initialized
  app.use((req, res, next) => {
    if (!supabase) {
      if (req.path === '/api/health') return next();
      return res.status(500).json({ 
        error: "Supabase client not initialized. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your environment variables." 
      });
    }
    next();
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      database: 'supabase-relational',
      configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
    });
  });

  // Seed Superadmin
  const seedSuperadmin = async () => {
    if (!supabase) return;
    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', 'readyhit')
        .single();
      
      if (!existing) {
        console.log("Seeding superadmin 'readyhit'...");
        const hashedPassword = await hashPassword('Nihsvxcuhyu47I');
        await supabase.from('profiles').insert([{
          username: 'readyhit',
          display_name: 'Superadmin',
          role: 'superadmin',
          password_hash: hashedPassword
        }]);
        console.log("Superadmin 'readyhit' seeded successfully.");
      }
    } catch (e) {
      console.error("Failed to seed superadmin:", e);
    }
  };
  seedSuperadmin();

  // Admin Management
  app.post("/api/admins/create", asyncHandler(async (req: any, res: any) => {
    const { username, displayName, role, password } = req.body;
    const targetRole = role || "admin";
    const lowerUsername = username.trim().toLowerCase();
    const hashedPassword = await hashPassword(password || "password123");

    const { data, error } = await supabase
      .from('profiles')
      .insert([{
        username: lowerUsername,
        display_name: displayName || username.trim(),
        role: targetRole,
        password_hash: hashedPassword
      }])
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, id: data.id });
  }));

  // Users API
  app.get("/api/users", asyncHandler(async (req: any, res: any) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*');
    if (error) throw error;
    res.json(data.map(u => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      role: u.role,
      createdAt: u.created_at
    })));
  }));

  app.put("/api/users/:id", asyncHandler(async (req: any, res: any) => {
    const { displayName, role } = req.body;
    const { data, error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        role: role
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({
      id: data.id,
      username: data.username,
      displayName: data.display_name,
      role: data.role,
      createdAt: data.created_at
    });
  }));

  app.delete("/api/users/:id", asyncHandler(async (req: any, res: any) => {
    // Check if superadmin
    const { data: user } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.params.id)
      .single();
    
    if (user && user.role === 'superadmin') {
      return res.status(403).json({ error: "Cannot delete superadmin account" });
    }

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  }));

  // Members API
  app.get("/api/members", asyncHandler(async (req: any, res: any) => {
    const { data, error } = await supabase
      .from('members')
      .select('*');
    if (error) throw error;
    res.json(data.map(m => ({
      id: m.id,
      ign: m.name,
      job: m.job_name || m.job_id, // We'll need to join or store job name
      dateJoined: m.created_at
    })));
  }));

  app.post("/api/members", asyncHandler(async (req: any, res: any) => {
    const { ign, job } = req.body;
    const lowerIgn = ign.trim().toLowerCase();
    const { data, error } = await supabase
      .from('members')
      .insert([{
        name: lowerIgn,
        job_name: job, // For simplicity, we'll store job name directly or handle ID mapping
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    if (error) throw error;
    res.json({
      id: data.id,
      ign: data.name,
      job: data.job_name,
      dateJoined: data.created_at
    });
  }));

  app.put("/api/members/:id", asyncHandler(async (req: any, res: any) => {
    const { ign, job } = req.body;
    const lowerIgn = ign.trim().toLowerCase();
    const { data, error } = await supabase
      .from('members')
      .update({
        name: lowerIgn,
        job_name: job
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({
      id: data.id,
      ign: data.name,
      job: data.job_name,
      dateJoined: data.created_at
    });
  }));

  app.delete("/api/members/:id", asyncHandler(async (req: any, res: any) => {
    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  }));

  // Jobs API
  app.get("/api/jobs", asyncHandler(async (req: any, res: any) => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*');
    if (error) throw error;
    res.json(data);
  }));

  app.post("/api/jobs", asyncHandler(async (req: any, res: any) => {
    const { name } = req.body;
    const { data, error } = await supabase
      .from('jobs')
      .insert([{ name }])
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  }));

  app.put("/api/jobs/:id", asyncHandler(async (req: any, res: any) => {
    const { name } = req.body;
    const { data, error } = await supabase
      .from('jobs')
      .update({ name })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  }));

  app.delete("/api/jobs/:id", asyncHandler(async (req: any, res: any) => {
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  }));

  // Events API
  app.get("/api/events", asyncHandler(async (req: any, res: any) => {
    const { data, error } = await supabase
      .from('events')
      .select('*, subevents:sub_events(*, parties:parties(*, assignments:assignments(*)))');
    if (error) throw error;
    res.json(data);
  }));

  app.get("/api/events/:id", asyncHandler(async (req: any, res: any) => {
    const { data, error } = await supabase
      .from('events')
      .select('*, subevents:sub_events(*, parties:parties(*, assignments:assignments(*)))')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json(data);
  }));

  app.post("/api/events", asyncHandler(async (req: any, res: any) => {
    const { name, date, description } = req.body;
    const { data, error } = await supabase
      .from('events')
      .insert([{ name, date: date || new Date().toISOString().split('T')[0], description }])
      .select()
      .single();
    if (error) throw error;
    res.json({ ...data, subevents: [] });
  }));

  app.put("/api/events/:id", asyncHandler(async (req: any, res: any) => {
    const { name, date, description, status } = req.body;
    const { data, error } = await supabase
      .from('events')
      .update({ name, date, description, status })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  }));

  app.delete("/api/events/:id", asyncHandler(async (req: any, res: any) => {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  }));

  // SubEvents API
  app.get("/api/events/:eventId/subevents", asyncHandler(async (req: any, res: any) => {
    const { data, error } = await supabase
      .from('sub_events')
      .select('*')
      .eq('event_id', req.params.eventId);
    if (error) throw error;
    res.json(data);
  }));

  app.post("/api/events/:eventId/subevents", asyncHandler(async (req: any, res: any) => {
    const { name, description } = req.body;
    const { data, error } = await supabase
      .from('sub_events')
      .insert([{ event_id: req.params.eventId, name, description }])
      .select()
      .single();
    if (error) throw error;
    res.json({ ...data, parties: [] });
  }));

  app.put("/api/events/:eventId/subevents/:id", asyncHandler(async (req: any, res: any) => {
    const { name, description } = req.body;
    const { data, error } = await supabase
      .from('sub_events')
      .update({ name, description })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  }));

  app.delete("/api/events/:eventId/subevents/:id", asyncHandler(async (req: any, res: any) => {
    const { error } = await supabase
      .from('sub_events')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  }));

  // Parties API
  app.get("/api/events/:eventId/subevents/:subEventId/parties", asyncHandler(async (req: any, res: any) => {
    const { data, error } = await supabase
      .from('parties')
      .select('*')
      .eq('sub_event_id', req.params.subEventId);
    if (error) throw error;
    res.json(data);
  }));

  app.post("/api/events/:eventId/subevents/:subEventId/parties", asyncHandler(async (req: any, res: any) => {
    const { name } = req.body;
    const { data, error } = await supabase
      .from('parties')
      .insert([{ sub_event_id: req.params.subEventId, name }])
      .select()
      .single();
    if (error) throw error;
    res.json({ ...data, assignments: [] });
  }));

  app.put("/api/events/:eventId/subevents/:subEventId/parties/:id", asyncHandler(async (req: any, res: any) => {
    const { name } = req.body;
    const { data, error } = await supabase
      .from('parties')
      .update({ name })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  }));

  app.delete("/api/events/:eventId/subevents/:subEventId/parties/:id", asyncHandler(async (req: any, res: any) => {
    const { error } = await supabase
      .from('parties')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  }));

  // Assignments API
  app.get("/api/events/:eventId/subevents/:subEventId/parties/:partyId/assignments", asyncHandler(async (req: any, res: any) => {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('party_id', req.params.partyId);
    if (error) throw error;
    res.json(data);
  }));

  app.post("/api/events/:eventId/subevents/:subEventId/parties/:partyId/assignments", asyncHandler(async (req: any, res: any) => {
    const { memberId, role } = req.body;
    const { data, error } = await supabase
      .from('assignments')
      .insert([{ 
        party_id: req.params.partyId, 
        member_id: memberId, 
        role 
      }])
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  }));

  app.delete("/api/events/:eventId/subevents/:subEventId/parties/:partyId/assignments/:id", asyncHandler(async (req: any, res: any) => {
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  }));

  // Settings API
  app.get("/api/settings", asyncHandler(async (req: any, res: any) => {
    const { data, error } = await supabase
      .from('guild_settings')
      .select('*')
      .eq('id', 1)
      .single();
    if (error) throw error;
    res.json(data);
  }));

  app.get("/api/settings/guild_settings", asyncHandler(async (req: any, res: any) => {
    const { data, error } = await supabase
      .from('guild_settings')
      .select('*')
      .eq('id', 1)
      .single();
    if (error) throw error;
    res.json(data);
  }));

  app.post("/api/settings/guild_settings", asyncHandler(async (req: any, res: any) => {
    const { data, error } = await supabase
      .from('guild_settings')
      .update(req.body)
      .eq('id', 1)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  }));

  // Auth API
  app.post("/api/auth/login", asyncHandler(async (req: any, res: any) => {
    const { username, password } = req.body;
    const lowerUsername = username.trim().toLowerCase();
    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', lowerUsername)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const { password_hash: _, ...userWithoutPassword } = user;
    res.json({ 
      user: {
        id: userWithoutPassword.id,
        username: userWithoutPassword.username,
        displayName: userWithoutPassword.display_name,
        role: userWithoutPassword.role,
        createdAt: userWithoutPassword.created_at
      }, 
      token: "mock-jwt-token" 
    });
  }));

  app.post("/api/auth/signup", asyncHandler(async (req: any, res: any) => {
    const { username, password } = req.body;
    const lowerUsername = username.trim().toLowerCase();
    const hashedPassword = await hashPassword(password);
    
    // Check if first user
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const role = count === 0 ? 'superadmin' : 'member';

    const { data: newUser, error } = await supabase
      .from('profiles')
      .insert([{
        username: lowerUsername,
        display_name: username.trim(),
        role: role,
        password_hash: hashedPassword
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: "User already exists" });
      throw error;
    }

    const { password_hash: _, ...userWithoutPassword } = newUser;
    res.json({ 
      user: {
        id: userWithoutPassword.id,
        username: userWithoutPassword.username,
        displayName: userWithoutPassword.display_name,
        role: userWithoutPassword.role,
        createdAt: userWithoutPassword.created_at
      }, 
      token: "mock-jwt-token" 
    });
  }));

  app.post("/api/auth/change-password", asyncHandler(async (req: any, res: any) => {
    const { username, currentPassword, newPassword } = req.body;
    const lowerUsername = username.trim().toLowerCase();
    
    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', lowerUsername)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isPasswordValid = await comparePassword(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Incorrect current password" });
    }

    const newHashedPassword = await hashPassword(newPassword);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ password_hash: newHashedPassword })
      .eq('id', user.id);

    if (updateError) throw updateError;
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
