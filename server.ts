import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { createApp } from "./src/app.js";
import { exec } from "child_process";
import { promisify } from "util";
import { createServer } from "http";
import { Server } from "socket.io";

const execAsync = promisify(exec);

dotenv.config();

async function startServer() {
  // Run migrations
  if (process.env.DATABASE_URL) {
    try {
      console.log("Running migrations...");
      await execAsync("npm run build:migrations");
      console.log("Migrations completed successfully.");
    } catch (err) {
      console.error("Migration error:", err);
    }
  }

  const expressApp = express();
  const httpServer = createServer(expressApp);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const emitUpdate = (type: string, data?: any) => {
    console.log(`Broadcasting update: ${type}`);
    io.emit('update', { type, data, timestamp: Date.now() });
  };

  const app = createApp(emitUpdate);
  expressApp.use(app);

  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    expressApp.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    expressApp.use(express.static(distPath, {
      maxAge: '1d',
      immutable: true
    }));
    expressApp.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
