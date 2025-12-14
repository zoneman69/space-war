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
  round: 1,
  lastCombatLog: []
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

interface PurchasePayload {
  playerName: string;
  unitType: UnitType;
  count: number;
}

interface MovePayload {
  playerName: string;
  fromSystemId: string;
  toSystemId: string;
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

function handleMove(payload: MovePayload) {
  const { playerName, fromSystemId, toSystemId } = payload;

  const player = gameState.players.find(
    (p) => p.displayName === playerName
  );
  if (!player) {
    console.log("Move failed: player not found", playerName);
    return;
  }

  const fromSystem = gameState.systems.find((s) => s.id === fromSystemId);
  const toSystem = gameState.systems.find((s) => s.id === toSystemId);

  if (!fromSystem || !toSystem) {
    console.log("Move failed: invalid system(s)", fromSystemId, toSystemId);
    return;
  }

  const isNeighbor = fromSystem.connectedSystems.includes(toSystem.id);
  if (!isNeighbor) {
    console.log(
      `Move failed: ${fromSystem.name} is not connected to ${toSystem.name}`
    );
    return;
  }

  const fleet = gameState.fleets.find(
    (f) =>
      f.ownerId === player.id &&
      f.locationSystemId === fromSystem.id &&
      f.units.length > 0
  );

  if (!fleet) {
    console.log(
      `Move failed: no fleet for ${player.displayName} at ${fromSystem.name}`
    );
    return;
  }

  fleet.locationSystemId = toSystem.id;

  console.log(
    `Moved fleet ${fleet.id} of ${player.displayName} from ${fromSystem.name} to ${toSystem.name}`
  );
}


function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function resolveCombatAtSystem(systemId: string) {
  const system = gameState.systems.find((s) => s.id === systemId);
  if (!system) {
    console.log("Combat failed: system not found", systemId);
    return;
  }

  const fleetsHere = gameState.fleets.filter(
    (f) => f.locationSystemId === system.id && f.units.length > 0
  );

  const ownerIds = Array.from(
    new Set(fleetsHere.map((f) => f.ownerId))
  );

  if (ownerIds.length <= 1) {
    console.log("No combat: less than 2 sides in", system.name);
    return;
  }

  console.log("Resolving combat at", system.name);

  const log: string[] = [];
  log.push(`Combat at ${system.name}`);

  // Build sides: playerId -> units
  const sides: {
    playerId: string;
    units: Unit[];
  }[] = ownerIds.map((pid) => ({
    playerId: pid,
    units: fleetsHere
      .filter((f) => f.ownerId === pid)
      .flatMap((f) => f.units)
  }));

  let round = 1;

  const maxRounds = 50;

  while (
    sides.filter((s) => s.units.length > 0).length > 1 &&
    round <= maxRounds
  ) {
    log.push(`Round ${round}`);

    // map from playerId -> hits inflicted
    const hits: Record<string, number> = {};

    // Each side rolls attack dice for each unit
    for (const side of sides) {
      if (side.units.length === 0) continue;

      let sideHits = 0;
      for (const unit of side.units) {
        const def = UNIT_DEFS[unit.type];
        const roll = rollDie();
        if (roll <= def.attack) {
          sideHits++;
        }
      }
      hits[side.playerId] = sideHits;
      const player = gameState.players.find((p) => p.id === side.playerId);
      log.push(
        `  ${player?.displayName ?? side.playerId} scores ${sideHits} hit(s)`
      );
    }

    // Apply hits to opponents
    for (const side of sides) {
      const enemyHits = Object.entries(hits)
        .filter(([pid]) => pid !== side.playerId)
        .reduce((sum, [, h]) => sum + h, 0);

      for (let i = 0; i < enemyHits; i++) {
        if (side.units.length === 0) break;
        side.units.pop(); // remove one unit
      }
    }

    // Remove destroyed sides from log perspective
    const alive = sides
      .filter((s) => s.units.length > 0)
      .map((s) => {
        const player = gameState.players.find((p) => p.id === s.playerId);
        return `${player?.displayName ?? s.playerId} (${s.units.length} units)`;
      });

    log.push(`  Survivors: ${alive.join(", ") || "none"}`);

    round++;
  }

  const survivingSides = sides.filter((s) => s.units.length > 0);

  // Clear fleets at this system, then recreate from remaining units
  gameState.fleets = gameState.fleets.filter(
    (f) => f.locationSystemId !== system.id
  );

  if (survivingSides.length === 0) {
    log.push("Combat result: mutual destruction. No winner.");
    // Keep system owner as-is
  } else if (survivingSides.length === 1) {
    const winnerSide = survivingSides[0];
    const winnerPlayer = gameState.players.find(
      (p) => p.id === winnerSide.playerId
    );
    log.push(
      `Combat result: ${winnerPlayer?.displayName ?? winnerSide.playerId} wins with ${winnerSide.units.length} unit(s).`
    );

    // Create a single fleet for the winner at this system
    const newFleet: Fleet = {
      id: `fleet-${nextFleetNum++}`,
      ownerId: winnerSide.playerId,
      locationSystemId: system.id,
      units: winnerSide.units
    };
    gameState.fleets.push(newFleet);

    // Winner takes control of the system
    system.ownerId = winnerSide.playerId;
  } else {
    log.push("Combat ended with multiple surviving sides (hit cap).");
    // Re-create fleets for each side
    for (const side of survivingSides) {
      const newFleet: Fleet = {
        id: `fleet-${nextFleetNum++}`,
        ownerId: side.playerId,
        locationSystemId: system.id,
        units: side.units
      };
      gameState.fleets.push(newFleet);
    }
  }

  gameState.lastCombatLog = log;
  console.log(log.join("\n"));
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

    socket.on("moveFleet", (payload: MovePayload) => {
    console.log("Received moveFleet:", payload);
    handleMove(payload);
    io.emit("gameState", gameState);
  });

  socket.on("resolveCombat", (systemId: string) => {
    console.log("Received resolveCombat for system", systemId);
    resolveCombatAtSystem(systemId);
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

