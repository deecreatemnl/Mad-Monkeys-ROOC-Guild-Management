import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

let firebaseConfig: any = {};

if (process.env.NODE_ENV !== "production" && fs.existsSync("./firebase-applet-config.json")) {
  firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
} else {
  firebaseConfig = {
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
    appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
    firestoreDatabaseId: process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || process.env.FIREBASE_FIRESTORE_DATABASE_ID,
  };
}

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const db = getFirestore(firebaseConfig.firestoreDatabaseId);
export const auth = admin.auth();
export { admin };
