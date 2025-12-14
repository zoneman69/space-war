import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { GameState, PlayerState, StarSystem } from "@space-war/shared";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(cors());
app.use(express.json());

// --- Simple helpers ---

function createDefaultSystems(): StarSystem[] {
  return [
    {
      id: "sys-1",
      name: "Sol",
      ownerId: null,
      resourceValue: 5,
      connectedSystems: ["sys-2", "sys-3"],
      hasShipyard: true
    },
    {
      id: "sys-2",
      name: "Alpha Centauri",
      ownerId: null,
      resourceValue: 3,
      connectedSystems: ["sys-1", "sys-4"],
      hasShipyard: false
    },
    {
      id: "sys-3",
      name: "Vega",
      ownerId: null,
      resourceValue: 2,
      connectedSystems: ["sys-1"],
      hasShipyard: false
    },
    {
      id: "sys-4",
      name: "Sirius",
      ownerId: null,
      resourceValue: 4,
      connectedSystems: ["sys-2"],
      hasShipyard: true
    }
  ];
}

let nextPlayerNum = 1;

// --- In-memory game state ---
let gameState: GameState = {
  id: "game-1",
  players: [],
  systems: createDefaultSystems(),
  fleets: [],
  currentPlayerId: "",
  phase: "income",
  round: 1
};

// --- REST routes ---

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/state", (_req, res) => {
  res.json(gameState);
});

// --- Game logic functions ---

function startGameIfPossible() {
  if (gameState.players.length === 0) {
    console.log("Cannot start game: no players");
    return;
  }

  // If game already started (someone owns a system), don't restart
  const alreadyStarted = gameState.systems.some((s) => s.ownerId !== null);
  if (alreadyStarted) {
    console.log("Game already started, ignoring start request");
    return;
  }

  console.log("Starting game...");

  // For now, assign home systems in order of players to the first N systems
  const systems = gameState.systems;
  const players = gameState.players;

  players.forEach((player, index) => {
    const system = systems[index % systems.length]; // wrap if more players than systems
    system.ownerId = player.id;

    // Add as home system
    player.homeSystems = [system.id];
  });

  // Set the first player as the current player
  gameState.currentPlayerId = players[0].id;
  gameState.phase = "income";
  gameState.round = 1;

  console.log(
    "Game started. Player home systems:",
    players.map((p) => `${p.displayName} -> ${p.homeSystems.join(",")}`)
  );
}

// --- Socket.IO events ---

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // send current state on connect
  socket.emit("gameState", gameState);

  socket.on("joinGame", (playerName: string) => {
    console.log(`Player joined: ${playerName}`);

    // Check if player with same name already exists
    let existing = gameState.players.find((p) => p.displayName === playerName);

    if (!existing) {
      const playerId = `player-${nextPlayerNum++}`;

      const newPlayer: PlayerState = {
        id: playerId,
        displayName: playerName,
        resources: 10, // starting resources
        homeSystems: []
      };

      gameState.players.push(newPlayer);

      // if no current player yet, set this one (will be overwritten on startGame)
      if (!gameState.currentPlayerId) {
        gameState.currentPlayerId = playerId;
      }

      console.log("Current players:", gameState.players.map((p) => p.displayName));
    }

    // Broadcast updated game state to everyone
    io.emit("gameState", gameState);
  });

  socket.on("startGame", () => {
    console.log("Received startGame request from", socket.id);
    startGameIfPossible();
    io.emit("gameState", gameState);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
