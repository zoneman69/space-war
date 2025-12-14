import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import {
  GameState,
  PlayerState,
  StarSystem,
  UnitType,
  Unit,
  Fleet,
  UNIT_DEFS
} from "@space-war/shared";

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
let nextFleetNum = 1;
let nextUnitNum = 1;

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

  const alreadyStarted = gameState.systems.some((s) => s.ownerId !== null);
  if (alreadyStarted) {
    console.log("Game already started, ignoring start request");
    return;
  }

  console.log("Starting game...");

  const systems = gameState.systems;
  const players = gameState.players;

  players.forEach((player, index) => {
    const system = systems[index % systems.length];
    system.ownerId = player.id;
    player.homeSystems = [system.id];
  });

  gameState.currentPlayerId = players[0].id;
  gameState.phase = "purchase";
  gameState.round = 1;

  console.log(
    "Game started. Player home systems:",
    players.map((p) => `${p.displayName} -> ${p.homeSystems.join(",")}`)
  );
}

function distributeIncome() {
  const players = gameState.players;
  const systems = gameState.systems;

  console.log("Distributing income for round", gameState.round);

  players.forEach((player) => {
    const income = systems
      .filter((s) => s.ownerId === player.id)
      .reduce((sum, s) => sum + s.resourceValue, 0);

    player.resources += income;

    console.log(
      `Player ${player.displayName} gains ${income} resources (total: ${player.resources})`
    );
  });

  gameState.phase = "purchase";
}

function getOrCreateHomeFleetForPlayer(player: PlayerState): Fleet | null {
  if (player.homeSystems.length === 0) {
    console.log("Player has no home systems, cannot spawn fleet:", player.displayName);
    return null;
  }

  const homeSystemId = player.homeSystems[0];

  // Try to find an existing fleet at home system
  let fleet = gameState.fleets.find(
    (f) => f.ownerId === player.id && f.locationSystemId === homeSystemId
  );

  if (!fleet) {
    fleet = {
      id: `fleet-${nextFleetNum++}`,
      ownerId: player.id,
      locationSystemId: homeSystemId,
      units: []
    };
    gameState.fleets.push(fleet);
  }

  return fleet;
}

interface PurchasePayload {
  playerName: string;
  unitType: UnitType;
  count: number;
}

function handlePurchase(payload: PurchasePayload) {
  const { playerName, unitType, count } = payload;

  if (count <= 0 || !Number.isInteger(count)) {
    console.log("Invalid purchase count:", count);
    return;
  }

  const player = gameState.players.find(
    (p) => p.displayName === playerName
  );
  if (!player) {
    console.log("Purchase failed: player not found", playerName);
    return;
  }

  const unitDef = UNIT_DEFS[unitType];
  if (!unitDef) {
    console.log("Purchase failed: unknown unit type", unitType);
    return;
  }

  const totalCost = unitDef.cost * count;
  if (player.resources < totalCost) {
    console.log(
      `Purchase failed: ${player.displayName} has ${player.resources}, needs ${totalCost}`
    );
    return;
  }

  const fleet = getOrCreateHomeFleetForPlayer(player);
  if (!fleet) return;

  player.resources -= totalCost;

  for (let i = 0; i < count; i++) {
    const unit: Unit = {
      id: `unit-${nextUnitNum++}`,
      type: unitType
    };
    fleet.units.push(unit);
  }

  console.log(
    `Player ${player.displayName} bought ${count} ${unitDef.name}(s) for ${totalCost}, remaining ${player.resources}`
  );
}

// --- Socket.IO events ---

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.emit("gameState", gameState);

  socket.on("joinGame", (playerName: string) => {
    console.log(`Player joined: ${playerName}`);

    let existing = gameState.players.find(
      (p) => p.displayName === playerName
    );

    if (!existing) {
      const playerId = `player-${nextPlayerNum++}`;

      const newPlayer: PlayerState = {
        id: playerId,
        displayName: playerName,
        resources: 10,
        homeSystems: []
      };

      gameState.players.push(newPlayer);

      if (!gameState.currentPlayerId) {
        gameState.currentPlayerId = playerId;
      }

      console.log(
        "Current players:",
        gameState.players.map((p) => p.displayName)
      );
    }

    io.emit("gameState", gameState);
  });

  socket.on("startGame", () => {
    console.log("Received startGame request from", socket.id);
    startGameIfPossible();
    io.emit("gameState", gameState);
  });

  socket.on("endTurn", () => {
    console.log("Received endTurn request from", socket.id);

    const players = gameState.players;
    if (players.length === 0) return;

    const currentIndex = players.findIndex(
      (p) => p.id === gameState.currentPlayerId
    );

    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + 1) % players.length;

    gameState.currentPlayerId = players[nextIndex].id;

    if (nextIndex === 0) {
      distributeIncome();
      gameState.round += 1;
    }

    console.log(
      `Turn advanced: now ${players[nextIndex].displayName}, round ${gameState.round}`
    );

    io.emit("gameState", gameState);
  });

  socket.on("purchaseUnits", (payload: PurchasePayload) => {
    console.log("Received purchaseUnits:", payload);
    handlePurchase(payload);
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
