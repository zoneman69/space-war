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
  UNIT_DEFS,
  PendingPurchase
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

// --- Config ---

const FACTORY_COST = 15;

// --- Map ---

function createDefaultSystems(): StarSystem[] {
  return [
    // Row 1
    {
      id: "sys-1",
      name: "Sol",
      ownerId: null,
      resourceValue: 5,
      connectedSystems: ["sys-2", "sys-5", "sys-6"],
      hasShipyard: true
    },
    {
      id: "sys-2",
      name: "Alpha Centauri",
      ownerId: null,
      resourceValue: 3,
      connectedSystems: ["sys-1", "sys-3", "sys-5", "sys-6", "sys-7"],
      hasShipyard: false
    },
    {
      id: "sys-3",
      name: "Vega",
      ownerId: null,
      resourceValue: 3,
      connectedSystems: ["sys-2", "sys-4", "sys-6", "sys-7", "sys-8"],
      hasShipyard: false
    },
    {
      id: "sys-4",
      name: "Sirius",
      ownerId: null,
      resourceValue: 4,
      connectedSystems: ["sys-3", "sys-7", "sys-8"],
      hasShipyard: true
    },

    // Row 2
    {
      id: "sys-5",
      name: "Procyon",
      ownerId: null,
      resourceValue: 3,
      connectedSystems: ["sys-1", "sys-2", "sys-6", "sys-9", "sys-10"],
      hasShipyard: false
    },
    {
      id: "sys-6",
      name: "Betelgeuse",
      ownerId: null,
      resourceValue: 4,
      connectedSystems: [
        "sys-1",
        "sys-2",
        "sys-3",
        "sys-5",
        "sys-7",
        "sys-9",
        "sys-10",
        "sys-11"
      ],
      hasShipyard: true
    },
    {
      id: "sys-7",
      name: "Deneb",
      ownerId: null,
      resourceValue: 3,
      connectedSystems: [
        "sys-2",
        "sys-3",
        "sys-4",
        "sys-6",
        "sys-8",
        "sys-10",
        "sys-11",
        "sys-12"
      ],
      hasShipyard: false
    },
    {
      id: "sys-8",
      name: "Rigel",
      ownerId: null,
      resourceValue: 5,
      connectedSystems: ["sys-3", "sys-4", "sys-7", "sys-11", "sys-12"],
      hasShipyard: true
    },

    // Row 3
    {
      id: "sys-9",
      name: "Altair",
      ownerId: null,
      resourceValue: 2,
      connectedSystems: ["sys-5", "sys-6", "sys-10"],
      hasShipyard: false
    },
    {
      id: "sys-10",
      name: "Polaris",
      ownerId: null,
      resourceValue: 3,
      connectedSystems: ["sys-5", "sys-6", "sys-7", "sys-9", "sys-11"],
      hasShipyard: false
    },
    {
      id: "sys-11",
      name: "Bellatrix",
      ownerId: null,
      resourceValue: 4,
      connectedSystems: ["sys-6", "sys-7", "sys-8", "sys-10", "sys-12"],
      hasShipyard: false
    },
    {
      id: "sys-12",
      name: "Capella",
      ownerId: null,
      resourceValue: 4,
      connectedSystems: ["sys-7", "sys-8", "sys-11"],
      hasShipyard: true
    }
  ];
}


let nextPlayerNum = 1;
let nextFleetNum = 1;
let nextUnitNum = 1;
let nextPendingPurchaseId = 1;

// --- In-memory state ---

let gameState: GameState = {
  id: "game-1",
  players: [],
  systems: createDefaultSystems(),
  fleets: [],
  currentPlayerId: "",
  phase: "purchase",
  round: 1,
  lastCombatLog: [],
  pendingPurchases: [],

  eliminatedPlayerIds: []
};


// --- REST ---

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/state", (_req, res) => {
  res.json(gameState);
});

// --- Helpers ---

function getPlayerById(playerId: string): PlayerState | undefined {
  return gameState.players.find((p) => p.id === playerId);
}

function checkVictory() {
  if (gameState.winnerPlayerId) return;

  const activePlayers = gameState.players.filter(
    (p) => !gameState.eliminatedPlayerIds.includes(p.id)
  );

  if (activePlayers.length === 1) {
    gameState.winnerPlayerId = activePlayers[0].id;
    console.log(`GAME OVER: ${activePlayers[0].displayName} wins`);
    return;
  }

  const factorySystems = gameState.systems.filter((s) => s.hasShipyard);

  for (const player of activePlayers) {
    const factoriesOwned = factorySystems.filter(
      (s) => s.ownerId === player.id
    );

    if (factoriesOwned.length === factorySystems.length) {
      gameState.winnerPlayerId = player.id;
      console.log(`GAME OVER: ${player.displayName} controls all factories`);
      return;
    }
  }
}

function checkEliminations() {
  for (const player of gameState.players) {
    if (gameState.eliminatedPlayerIds.includes(player.id)) continue;

    const ownsSystems = gameState.systems.some(
      (s) => s.ownerId === player.id
    );

    const ownsFactory = gameState.systems.some(
      (s) => s.ownerId === player.id && s.hasShipyard
    );

    const hasUnits = gameState.fleets.some(
      (f) => f.ownerId === player.id && f.units.length > 0
    );

    if (!ownsSystems || (!ownsFactory && !hasUnits)) {
      gameState.eliminatedPlayerIds.push(player.id);
      console.log(`Player eliminated: ${player.displayName}`);
    }
  }
}

function getPlayerByName(name: string): PlayerState | undefined {
  return gameState.players.find((p) => p.displayName === name);
}

function collectIncomeForPlayer(playerId: string) {
  const player = getPlayerById(playerId);
  if (!player) return;

  const income = gameState.systems
    .filter((s) => s.ownerId === player.id)
    .reduce((sum, s) => sum + s.resourceValue, 0);

  player.resources += income;

  console.log(
    `Income: Player ${player.displayName} collects ${income} (total: ${player.resources})`
  );
}

function resetMovementForPlayer(playerId: string) {
  const player = getPlayerById(playerId);
  if (!player) return;

  for (const fleet of gameState.fleets) {
    if (fleet.ownerId !== player.id) continue;
    for (const unit of fleet.units) {
      unit.movementRemaining = UNIT_DEFS[unit.type].movement;
    }
  }

  console.log(`Movement reset for ${player.displayName}`);
}


function getOrCreateFleetAtSystem(
  player: PlayerState,
  systemId: string
): Fleet | null {
  const system = gameState.systems.find((s) => s.id === systemId);
  if (!system) {
    console.log("getOrCreateFleetAtSystem: system not found", systemId);
    return null;
  }

  let fleet = gameState.fleets.find(
    (f) => f.ownerId === player.id && f.locationSystemId === systemId
  );

  if (!fleet) {
    fleet = {
      id: `fleet-${nextFleetNum++}`,
      ownerId: player.id,
      locationSystemId: systemId,
      units: []
    };
    gameState.fleets.push(fleet);
  }

  return fleet;
}

function hasAnyContestedSystem(): boolean {
  for (const system of gameState.systems) {
    const fleetsHere = gameState.fleets.filter(
      (f) => f.locationSystemId === system.id && f.units.length > 0
    );

    if (fleetsHere.length === 0) continue;

    const ownerIds = new Set(fleetsHere.map((f) => f.ownerId));
    if (ownerIds.size > 1) {
      // More than one owner present = unresolved combat
      return true;
    }
  }
  return false;
}

function updateSystemControl(systemId: string) {
  const system = gameState.systems.find((s) => s.id === systemId);
  if (!system) return;

  const fleetsHere = gameState.fleets.filter(
    (f) => f.locationSystemId === system.id && f.units.length > 0
  );

  if (fleetsHere.length === 0) {
    return;
  }

  const ownerIds = Array.from(new Set(fleetsHere.map((f) => f.ownerId)));

  if (ownerIds.length === 1) {
    const newOwnerId = ownerIds[0];

    if (system.ownerId !== newOwnerId) {
      const newOwner = getPlayerById(newOwnerId);
      const oldOwner = getPlayerById(system.ownerId ?? "");

      system.ownerId = newOwnerId;

      console.log(
        `System ${system.name} control changed: ${
          oldOwner ? oldOwner.displayName : "Neutral"
        } -> ${newOwner ? newOwner.displayName : newOwnerId}`
      );
    }
  }
}

function deployPendingForPlayer(playerId: string) {
  const player = getPlayerById(playerId);
  if (!player) return;

  const toDeploy = gameState.pendingPurchases.filter(
    (p) => p.playerId === playerId
  );

  if (toDeploy.length === 0) {
    console.log(`No pending units to deploy for ${player.displayName}`);
  }

  for (const purchase of toDeploy) {
    const system = gameState.systems.find((s) => s.id === purchase.systemId);
    if (!system) {
      console.log(
        "Deploy skipped: system not found for pending purchase",
        purchase
      );
      continue;
    }

    const fleet = getOrCreateFleetAtSystem(player, system.id);
    if (!fleet) continue;

      for (let i = 0; i < purchase.count; i++) {
        const unit: Unit = {
            id: `unit-${nextUnitNum++}`,
            type: purchase.unitType,
            movementRemaining: 0 // will be set at start of next movement phase
        };
        fleet.units.push(unit);
        }


    console.log(
      `Deployed ${purchase.count} ${UNIT_DEFS[purchase.unitType].name}(s) for ${player.displayName} at ${system.name}`
    );
  }

  gameState.pendingPurchases = gameState.pendingPurchases.filter(
    (p) => p.playerId !== playerId
  );
}

// --- Game start / turn setup ---

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

  const shipyardSystems = systems.filter((s) => s.hasShipyard);
  if (shipyardSystems.length === 0) {
    console.log("No shipyard systems defined");
    return;
  }

  players.forEach((player, index) => {
    const system = shipyardSystems[index % shipyardSystems.length];
    system.ownerId = player.id;
    player.homeSystems = [system.id];
  });

  gameState.currentPlayerId = players[0].id;
  gameState.phase = "purchase";
  gameState.round = 1;

  // Income for the FIRST player at the very start of their turn
  collectIncomeForPlayer(players[0].id);

  console.log(
    "Game started. Player home systems:",
    players.map((p) => `${p.displayName} -> ${p.homeSystems.join(",")}`)
  );
}

// --- Payload interfaces ---

interface PurchasePayload {
  playerName: string;
  unitType: UnitType;
  count: number;
  systemId: string; // factory system
}

interface MovePayload {
  playerName: string;
  fromSystemId: string;
  toSystemId: string;
  unitIds: string[];
}


interface EndTurnPayload {
  playerName: string;
}

interface BuildFactoryPayload {
  playerName: string;
  systemId: string;
}

// --- Purchase / factories ---

function handlePurchase(payload: PurchasePayload) {
  const { playerName, unitType, count, systemId } = payload;

  if (count <= 0 || !Number.isInteger(count)) {
    console.log("Invalid purchase count:", count);
    return;
  }

  const player = getPlayerByName(playerName);
  if (!player) {
    console.log("Purchase failed: player not found", playerName);
    return;
  }

  if (player.id !== gameState.currentPlayerId) {
    console.log("Purchase rejected: not current player's turn");
    return;
  }

  if (gameState.phase !== "purchase") {
    console.log("Purchase rejected: not purchase phase");
    return;
  }

  const system = gameState.systems.find((s) => s.id === systemId);
  if (!system) {
    console.log("Purchase failed: system not found", systemId);
    return;
  }

  if (system.ownerId !== player.id) {
    console.log(
      `Purchase failed: ${player.displayName} does not own system ${system.name}`
    );
    return;
  }

  if (!system.hasShipyard) {
    console.log(
      `Purchase failed: system ${system.name} has no factory/shipyard`
    );
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

  player.resources -= totalCost;

  const pending: PendingPurchase = {
    id: `pp-${nextPendingPurchaseId++}`,
    playerId: player.id,
    systemId,
    unitType,
    count
  };

  gameState.pendingPurchases.push(pending);

  console.log(
    `Player ${player.displayName} queued ${count} ${unitDef.name}(s) at ${system.name} for ${totalCost}, remaining ${player.resources}`
  );
}

function handleBuildFactory(payload: BuildFactoryPayload) {
  const { playerName, systemId } = payload;

  const player = getPlayerByName(playerName);
  if (!player) {
    console.log("BuildFactory failed: player not found", playerName);
    return;
  }

  if (player.id !== gameState.currentPlayerId) {
    console.log("BuildFactory rejected: not current player's turn");
    return;
  }

  if (gameState.phase !== "purchase") {
    console.log("BuildFactory rejected: not purchase phase");
    return;
  }

  const system = gameState.systems.find((s) => s.id === systemId);
  if (!system) {
    console.log("BuildFactory failed: system not found", systemId);
    return;
  }

  if (system.ownerId !== player.id) {
    console.log(
      `BuildFactory failed: ${player.displayName} does not own ${system.name}`
    );
    return;
  }

  if (system.hasShipyard) {
    console.log(
      `BuildFactory failed: ${system.name} already has a factory/shipyard`
    );
    return;
  }

  if (player.resources < FACTORY_COST) {
    console.log(
      `BuildFactory failed: ${player.displayName} has ${player.resources}, needs ${FACTORY_COST}`
    );
    return;
  }

  player.resources -= FACTORY_COST;
  system.hasShipyard = true;

  console.log(
    `Player ${player.displayName} built a factory at ${system.name} for ${FACTORY_COST}, remaining ${player.resources}`
  );
}

// --- Movement ---

function handleMove(payload: MovePayload) {
  const { playerName, fromSystemId, toSystemId, unitIds } = payload;

  const player = getPlayerByName(playerName);
  if (!player) {
    console.log("Move failed: player not found", playerName);
    return;
  }

  if (player.id !== gameState.currentPlayerId) {
    console.log("Move rejected: not current player's turn");
    return;
  }

  if (gameState.phase !== "movement") {
    console.log("Move rejected: not movement phase");
    return;
  }

  if (!Array.isArray(unitIds) || unitIds.length === 0) {
    console.log("Move failed: no units specified");
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

  // All fleets of this player at fromSystem
  const sourceFleets = gameState.fleets.filter(
    (f) =>
      f.ownerId === player.id &&
      f.locationSystemId === fromSystem.id &&
      f.units.length > 0
  );

  if (sourceFleets.length === 0) {
    console.log(
      `Move failed: no fleet for ${player.displayName} at ${fromSystem.name}`
    );
    return;
  }

  const unitIdSet = new Set(unitIds);
  const unitsToMove: Unit[] = [];

  for (const fleet of sourceFleets) {
    const remainingUnits: Unit[] = [];
    for (const unit of fleet.units) {
      if (
        unitIdSet.has(unit.id) &&
        unit.movementRemaining > 0
      ) {
        unitsToMove.push(unit);
        unitIdSet.delete(unit.id);
      } else {
        remainingUnits.push(unit);
      }
    }
    fleet.units = remainingUnits;
  }

  if (unitsToMove.length === 0) {
    console.log("Move failed: no matching movable units found");
    return;
  }

  // Spend 1 movement point for this hop
  for (const unit of unitsToMove) {
    unit.movementRemaining = Math.max(0, unit.movementRemaining - 1);
  }

  // Destination fleet (ensure we still keep 1 fleet per player/system)
  const destFleet = getOrCreateFleetAtSystem(player, toSystem.id);
  if (!destFleet) return;

  destFleet.units.push(...unitsToMove);

  updateSystemControl(toSystem.id);

  console.log(
    `Moved ${unitsToMove.length} units of ${player.displayName} from ${fromSystem.name} to ${toSystem.name}`
  );
}


// --- Combat ---

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

  const ownerIds = Array.from(new Set(fleetsHere.map((f) => f.ownerId)));

  if (ownerIds.length <= 1) {
    console.log("No combat: less than 2 sides in", system.name);
    return;
  }

  console.log("Resolving combat at", system.name);

  const log: string[] = [];
  log.push(`Combat at ${system.name}`);

  const sides: { playerId: string; units: Unit[] }[] = ownerIds.map((pid) => ({
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

    const hits: Record<string, number> = {};

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
      const player = getPlayerById(side.playerId);
      log.push(
        `  ${player?.displayName ?? side.playerId} scores ${sideHits} hit(s)`
      );
    }

    for (const side of sides) {
      const enemyHits = Object.entries(hits)
        .filter(([pid]) => pid !== side.playerId)
        .reduce((sum, [, h]) => sum + h, 0);

      for (let i = 0; i < enemyHits; i++) {
        if (side.units.length === 0) break;
        side.units.pop();
      }
    }

    const alive = sides
      .filter((s) => s.units.length > 0)
      .map((s) => {
        const player = getPlayerById(s.playerId);
        return `${player?.displayName ?? s.playerId} (${s.units.length} units)`;
      });

    log.push(`  Survivors: ${alive.join(", ") || "none"}`);

    round++;
  }

  const survivingSides = sides.filter((s) => s.units.length > 0);

  gameState.fleets = gameState.fleets.filter(
    (f) => f.locationSystemId !== system.id
  );

  if (survivingSides.length === 0) {
    log.push("Combat result: mutual destruction. No winner.");
  } else if (survivingSides.length === 1) {
    const winnerSide = survivingSides[0];
    const winnerPlayer = getPlayerById(winnerSide.playerId);
    log.push(
      `Combat result: ${
        winnerPlayer?.displayName ?? winnerSide.playerId
      } wins with ${winnerSide.units.length} unit(s).`
    );

    const newFleet: Fleet = {
      id: `fleet-${nextFleetNum++}`,
      ownerId: winnerSide.playerId,
      locationSystemId: system.id,
      units: winnerSide.units
    };
    gameState.fleets.push(newFleet);

    system.ownerId = winnerSide.playerId;
  } else {
    log.push("Combat ended with multiple surviving sides (hit cap).");
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

  checkEliminations();
  checkVictory();

  gameState.lastCombatLog = log;
  console.log(log.join("\n"));
}

// --- Socket.IO ---

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

  socket.on("endTurn", (payload: EndTurnPayload) => {
    console.log("Received endTurn request from", socket.id, "payload:", payload);
    if (gameState.winnerPlayerId) {
        console.log("Game already ended, ignoring endTurn");
        return;
    }

    const players = gameState.players;
    if (players.length === 0) return;

    const currentPlayer = getPlayerById(gameState.currentPlayerId);
    if (!currentPlayer) {
      console.log("endTurn: no current player set");
      return;
    }

    const caller = getPlayerByName(payload.playerName);
    if (!caller || caller.id !== currentPlayer.id) {
      console.log(
        `endTurn rejected: caller ${payload.playerName} is not current player (${currentPlayer.displayName})`
      );
      return;
    }

        // Advance phase or move to next player's turn
        if (gameState.phase === "purchase") {
        gameState.phase = "movement";
        resetMovementForPlayer(currentPlayer.id);
        } else if (gameState.phase === "movement") {
        gameState.phase = "combat";
        } else if (gameState.phase === "combat") {
        if (hasAnyContestedSystem()) {
            console.log("endTurn rejected: unresolved combats remain");
            return; // Stay in combat phase until all battles are resolved
        }
        gameState.phase = "deploy";
        } else if (gameState.phase === "deploy") {
        // Deploy purchased units for current player
        deployPendingForPlayer(currentPlayer.id);
        checkEliminations();
        checkVictory();

        if (gameState.winnerPlayerId) {
        io.emit("gameState", gameState);
        return;
        }

      // Advance to next player
      const currentIndex = players.findIndex(
        (p) => p.id === currentPlayer.id
      );
      const nextIndex =
        currentIndex === -1 ? 0 : (currentIndex + 1) % players.length;

      const nextPlayer = players[nextIndex];
      gameState.currentPlayerId = nextPlayer.id;

      // New round if we wrapped back to first player
      if (nextIndex === 0) {
        gameState.round += 1;
      }

      // At the very beginning of the next player's turn,
      // collect their income before purchase phase
      collectIncomeForPlayer(nextPlayer.id);

      gameState.phase = "purchase";
    }

    console.log(
      `Phase advanced. Current player: ${
        getPlayerById(gameState.currentPlayerId)?.displayName
      }, phase: ${gameState.phase}, round: ${gameState.round}`
    );

    io.emit("gameState", gameState);
  });

  socket.on("purchaseUnits", (payload: PurchasePayload) => {
    console.log("Received purchaseUnits:", payload);
    handlePurchase(payload);
    io.emit("gameState", gameState);
  });

  socket.on("buildFactory", (payload: BuildFactoryPayload) => {
    console.log("Received buildFactory:", payload);
    handleBuildFactory(payload);
    io.emit("gameState", gameState);
  });

  socket.on("moveFleet", (payload: MovePayload) => {
    console.log("Received moveFleet:", payload);
    handleMove(payload);
    io.emit("gameState", gameState);
  });

  socket.on("resolveCombat", (systemId: string) => {
    console.log("Received resolveCombat for system", systemId);
    if (gameState.phase !== "combat") {
      console.log("resolveCombat rejected: not combat phase");
    } else {
      resolveCombatAtSystem(systemId);
    }
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
