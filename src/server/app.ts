import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { db, admin } from "./firebase";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Email Transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: process.env.EMAIL_PORT === "465",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Auth Middleware
const authenticate = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Admin Middleware
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const userRef = db.collection("users").doc(req.user.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data();
    if (!userData || (userData.role !== 'admin' && userData.role !== 'superadmin')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Settings
app.get("/api/settings", async (req, res) => {
  try {
    const settingsSnap = await db.collection("settings").doc("guild_settings").get();
    res.json(settingsSnap.exists ? settingsSnap.data() : { name: 'Mad Monkeys', subtitle: 'Guild Management System' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/settings", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.collection("settings").doc("guild_settings").set(req.body, { merge: true });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Members
app.get("/api/members", async (req, res) => {
  try {
    const membersSnap = await db.collection("members").orderBy("ign").get();
    const members = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(members);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/members", authenticate, requireAdmin, async (req, res) => {
  try {
    const docRef = await db.collection("members").add({
      ...req.body,
      createdAt: new Date().toISOString()
    });
    res.json({ id: docRef.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/members/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.collection("members").doc(req.params.id).update(req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/members/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.collection("members").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Events
app.get("/api/events", async (req, res) => {
  try {
    const eventsSnap = await db.collection("events").orderBy("date", "desc").get();
    const events = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(events);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/events/:id", async (req, res) => {
  try {
    const eventSnap = await db.collection("events").doc(req.params.id).get();
    if (!eventSnap.exists) return res.status(404).json({ error: "Event not found" });
    res.json({ id: eventSnap.id, ...eventSnap.data() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/events", authenticate, requireAdmin, async (req, res) => {
  try {
    const docRef = await db.collection("events").add({
      ...req.body,
      createdAt: new Date().toISOString()
    });
    res.json({ id: docRef.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/events/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.collection("events").doc(req.params.id).update(req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/events/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.collection("events").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Auth / Profile
app.get("/api/auth/me", authenticate, async (req, res) => {
  try {
    const userRef = db.collection("users").doc(req.user.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      // Create profile if it doesn't exist
      const profile = {
        id: req.user.uid,
        email: req.user.email,
        displayName: req.user.name || req.user.email.split('@')[0],
        role: req.user.email === 'darren@createmnl.com' ? 'superadmin' : 'user',
        createdAt: new Date().toISOString()
      };
      await userRef.set(profile);
      return res.json(profile);
    }
    res.json({ id: userSnap.id, ...userSnap.data() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Jobs
app.get("/api/jobs", async (req, res) => {
  try {
    const jobsSnap = await db.collection("jobs").orderBy("name").get();
    const jobs = jobsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(jobs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/jobs", authenticate, requireAdmin, async (req, res) => {
  try {
    const docRef = await db.collection("jobs").add(req.body);
    res.json({ id: docRef.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/jobs/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const jobRef = db.collection("jobs").doc(req.params.id);
    const jobSnap = await jobRef.get();
    const oldName = jobSnap.data()?.name;
    const newName = req.body.name;

    await jobRef.update(req.body);

    // If name changed, update all members with this job
    if (oldName && newName && oldName !== newName) {
      const membersSnap = await db.collection("members").where("job", "==", oldName).get();
      const batch = db.batch();
      membersSnap.docs.forEach(doc => {
        batch.update(doc.ref, { job: newName });
      });
      await batch.commit();
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/jobs/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.collection("jobs").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Users
app.get("/api/users", authenticate, requireAdmin, async (req, res) => {
  try {
    const usersSnap = await db.collection("users").orderBy("email").get();
    const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/users/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    // Only superadmin can change roles
    if (req.body.role && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: "Only superadmin can change roles" });
    }
    await db.collection("users").doc(req.params.id).update(req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/users/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const userRef = db.collection("users").doc(req.params.id);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    // Only superadmin can delete admins
    if (userData?.role === 'admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: "Only superadmin can delete admins" });
    }
    // Cannot delete superadmin
    if (userData?.role === 'superadmin') {
      return res.status(403).json({ error: "Cannot delete superadmin" });
    }

    await userRef.delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Events
app.get("/api/events", async (req, res) => {
  try {
    const eventsSnap = await db.collection("events").orderBy("date", "desc").get();
    const events = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(events);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/events/:id", async (req, res) => {
  try {
    const eventSnap = await db.collection("events").doc(req.params.id).get();
    if (!eventSnap.exists) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json({ id: eventSnap.id, ...eventSnap.data() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/events", authenticate, requireAdmin, async (req, res) => {
  try {
    const docRef = await db.collection("events").add(req.body);
    res.json({ id: docRef.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/events/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.collection("events").doc(req.params.id).update(req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/events/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.collection("events").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// SubEvents
app.get("/api/events/:id/subevents", async (req, res) => {
  try {
    const subEventsSnap = await db.collection("events").doc(req.params.id).collection("subevents").orderBy("order").get();
    const subEvents = subEventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(subEvents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/events/:id/subevents", authenticate, requireAdmin, async (req, res) => {
  try {
    const docRef = await db.collection("events").doc(req.params.id).collection("subevents").add(req.body);
    res.json({ id: docRef.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/events/:id/subevents/:subEventId", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.collection("events").doc(req.params.id).collection("subevents").doc(req.params.subEventId).update(req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/events/:id/subevents/:subEventId", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.collection("events").doc(req.params.id).collection("subevents").doc(req.params.subEventId).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Parties
app.get("/api/events/:id/subevents/:subEventId/parties", async (req, res) => {
  try {
    const partiesSnap = await db.collection("events").doc(req.params.id).collection("subevents").doc(req.params.subEventId).collection("parties").orderBy("order").get();
    const parties = partiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(parties);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/events/:id/subevents/:subEventId/parties", authenticate, requireAdmin, async (req, res) => {
  try {
    const docRef = await db.collection("events").doc(req.params.id).collection("subevents").doc(req.params.subEventId).collection("parties").add(req.body);
    res.json({ id: docRef.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/events/:id/subevents/:subEventId/parties/:partyId", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.collection("events").doc(req.params.id).collection("subevents").doc(req.params.subEventId).collection("parties").doc(req.params.partyId).update(req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/events/:id/subevents/:subEventId/parties/:partyId", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.collection("events").doc(req.params.id).collection("subevents").doc(req.params.subEventId).collection("parties").doc(req.params.partyId).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Assignments
app.get("/api/events/:id/subevents/:subEventId/parties/:partyId/assignments", async (req, res) => {
  try {
    const assignmentsSnap = await db.collection("events").doc(req.params.id).collection("subevents").doc(req.params.subEventId).collection("parties").doc(req.params.partyId).collection("assignments").orderBy("order").get();
    const assignments = assignmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/events/:id/subevents/:subEventId/parties/:partyId/assignments", authenticate, requireAdmin, async (req, res) => {
  try {
    const docRef = await db.collection("events").doc(req.params.id).collection("subevents").doc(req.params.subEventId).collection("parties").doc(req.params.partyId).collection("assignments").add(req.body);
    res.json({ id: docRef.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/events/:id/subevents/:subEventId/parties/:partyId/assignments/:assignmentId", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.collection("events").doc(req.params.id).collection("subevents").doc(req.params.subEventId).collection("parties").doc(req.params.partyId).collection("assignments").doc(req.params.assignmentId).update(req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/events/:id/subevents/:subEventId/parties/:partyId/assignments/:assignmentId", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.collection("events").doc(req.params.id).collection("subevents").doc(req.params.subEventId).collection("parties").doc(req.params.partyId).collection("assignments").doc(req.params.assignmentId).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Management: Pre-authorize Admin/Member
app.post("/api/admins/create", async (req, res) => {
  const { email, displayName, role, password } = req.body;
  const targetRole = role || "admin";

  console.log(`Attempting to pre-authorize user: ${email} with role: ${targetRole}`);

  try {
    // Check if user already exists in Firestore by email
    const emailId = email.toLowerCase().trim();
    const userRef = db.collection("users").doc(emailId);
    const userSnap = await userRef.get();
    
    if (userSnap.exists) {
      return res.status(400).json({ error: "A user with this email is already authorized." });
    }

    // If password provided, create the user in Firebase Auth
    let authUid = null;
    if (password && password.trim().length >= 6) {
      try {
        const userRecord = await admin.auth().createUser({
          email: emailId,
          password: password,
          displayName,
        });
        authUid = userRecord.uid;
        console.log(`Auth user created for: ${emailId} with UID: ${authUid}`);
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-exists') {
          const existingUser = await admin.auth().getUserByEmail(emailId);
          authUid = existingUser.uid;
        } else {
          throw authError;
        }
      }
    }

    // Create user document in Firestore using email as the ID
    await userRef.set({
      email: emailId,
      displayName,
      role: targetRole,
      createdAt: new Date().toISOString(),
      isPreAuthorized: true,
      authUid: authUid
    });

    console.log(`User pre-authorized in Firestore with ID: ${emailId}`);

    // Send Email
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: emailId,
        subject: `Welcome to the Mad Monkeys Guild Manager - ${targetRole === 'admin' ? 'Admin' : 'Member'} Access`,
        html: `
          <h1>Welcome, ${displayName}!</h1>
          <p>You have been authorized as a ${targetRole === 'admin' ? 'administrator' : 'member'} for the Mad Monkeys Guild Manager.</p>
          ${password ? `<p>Your account has been created with the following credentials:</p>
          <ul>
            <li><strong>Email:</strong> ${emailId}</li>
            <li><strong>Password:</strong> ${password}</li>
          </ul>` : `<p>To access the system, please sign in using your Google account (${emailId}) at:</p>`}
          <p><a href="${process.env.APP_URL || 'http://localhost:3000'}">${process.env.APP_URL || 'http://localhost:3000'}</a></p>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`Authorization email sent to: ${emailId}`);
      } catch (emailError) {
        console.error("Failed to send authorization email:", emailError);
      }
    }

    res.json({ success: true, id: emailId });
  } catch (error: any) {
    console.error("Error pre-authorizing user:", error);
    res.status(500).json({ error: error.message });
  }
});

// User Management: Delete User Account and Data
app.delete("/api/users/:uid", async (req, res) => {
  const { uid } = req.params;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    // Verify the token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Ensure the user is deleting their own account or is an admin
    if (decodedToken.uid !== uid) {
      // Check if the requester is an admin
      const requesterRef = db.collection("users").doc(decodedToken.uid);
      const requesterSnap = await requesterRef.get();
      const requesterData = requesterSnap.data();
      
      if (!requesterData || (requesterData.role !== 'admin' && requesterData.role !== 'superadmin')) {
        return res.status(403).json({ error: 'Forbidden: You can only delete your own account' });
      }
    }

    console.log(`Deleting user data and account for UID: ${uid}`);

    // 1. Delete user document from Firestore
    // We need to check both the UID-based doc and the email-based doc (if it was a pending one)
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    
    if (userSnap.exists) {
      await userRef.delete();
    }

    // 2. Delete from Firebase Auth
    try {
      await admin.auth().deleteUser(uid);
    } catch (authErr: any) {
      // If user already deleted from Auth, ignore
      if (authErr.code !== 'auth/user-not-found') {
        throw authErr;
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: error.message });
  }
});

export default app;
