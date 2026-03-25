import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import admin from "firebase-admin";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import fs from "fs";

import { getFirestore } from "firebase-admin/firestore";

dotenv.config();

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

const db = getFirestore(firebaseConfig.firestoreDatabaseId);
const auth = admin.auth();

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  // Admin Management: Pre-authorize Admin/Member
  app.post("/api/admins/create", async (req, res) => {
    const { email, displayName, role, password } = req.body;
    const targetRole = role || "admin";

    console.log(`Attempting to pre-authorize user: ${email} with role: ${targetRole}${password ? ' with password' : ''}`);

    try {
      // Check if user already exists in Firestore by email
      const userRef = db.collection("users").doc(email.toLowerCase());
      const userSnap = await userRef.get();
      
      if (userSnap.exists) {
        return res.status(400).json({ error: "A user with this email is already authorized." });
      }

      // If password provided, create the user in Firebase Auth
      let authUid = null;
      if (password) {
        try {
          const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName,
          });
          authUid = userRecord.uid;
          console.log(`Auth user created for: ${email} with UID: ${authUid}`);
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-exists') {
            // User might exist in Auth but not in our Firestore 'users' collection
            const existingUser = await admin.auth().getUserByEmail(email);
            authUid = existingUser.uid;
          } else {
            throw authError;
          }
        }
      }

      // Create user document in Firestore using email as the ID
      await userRef.set({
        email,
        displayName,
        role: targetRole,
        createdAt: new Date().toISOString(),
        isPreAuthorized: true,
        authUid: authUid // Store UID if we created/found the auth user
      });

      console.log(`User pre-authorized in Firestore with ID: ${email.toLowerCase()}`);

      // Send Email
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: email,
        subject: `Welcome to the Guild Management System - ${targetRole === 'admin' ? 'Admin' : 'Member'} Access`,
        html: `
          <h1>Welcome, ${displayName}!</h1>
          <p>You have been authorized as a ${targetRole === 'admin' ? 'administrator' : 'member'} for the Guild Management System.</p>
          ${password ? `<p>Your account has been created with the following credentials:</p>
          <ul>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Password:</strong> ${password}</li>
          </ul>` : `<p>To access the system, please sign in using your Google account (${email}) at:</p>`}
          <p><a href="${process.env.APP_URL || 'http://localhost:3000'}">${process.env.APP_URL || 'http://localhost:3000'}</a></p>
        `,
      };

      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
          await transporter.sendMail(mailOptions);
          console.log(`Authorization email sent to: ${email}`);
        } catch (emailError) {
          console.error("Failed to send authorization email:", emailError);
        }
      }

      res.json({ success: true, id: email.toLowerCase() });
    } catch (error: any) {
      console.error("Error pre-authorizing user:", error);
      res.status(500).json({ error: error.message });
    }
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
