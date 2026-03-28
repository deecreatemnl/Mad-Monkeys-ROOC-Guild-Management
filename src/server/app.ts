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
