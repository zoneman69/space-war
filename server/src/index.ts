import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url"; // only needed if you switch to ES modules
import { GameState } from "@space-war/shared/types";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(cors());
app.use(express.json());

// --- Simple in-memory game state for now ---
let gameState: GameState | null = null;

// TEMP basic init route
app.post("/api/init", (req, res) => {
  gameState = {
    id: "game-1",
    players: [],
    systems: [],
    fleets: [],
    currentPlayerId: "",
    phase: "income",
    round: 1
  };
  res.json({ ok: true, gameState });
});

// Simple health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// --- Socket.IO events ---
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // send current state on connect
  if (gameState) {
    socket.emit("gameState", gameState);
  }

  socket.on("joinGame", (playerName: string) => {
    console.log(`Player joined: ${playerName}`);
    // TODO: Add player to gameState
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// In production, serve the client build
// Later you’ll run `pnpm --filter client build` and point this at `client/dist`
/*
const clientBuildPath = path.join(__dirname, "..", "..", "client", "dist");
app.use(express.static(clientBuildPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});
*/

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
