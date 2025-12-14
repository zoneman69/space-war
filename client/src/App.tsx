import React, { useEffect, useState } from "react";
import {
  GameState,
  PlayerState,
  StarSystem,
  UnitType,
  UNIT_DEFS,
  Fleet
} from "@space-war/shared";
import {
  initSocket,
  joinGame,
  startGame,
  endTurn,
  purchaseUnits,
  moveFleet,
  resolveCombat,
  buildFactory
} from "./api/socket";
import GalaxyMap from "./components/GalaxyMap";

const unitTypeList: UnitType[] = [
  "fighter",
  "destroyer",
  "cruiser",
  "battleship",
  "carrier",
  "transport"
];

const FACTORY_COST = 15;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [name, setName] = useState("");

  const [selectedUnitType, setSelectedUnitType] = useState<UnitType>("fighter");
  const [purchaseCount, setPurchaseCount] = useState("1");
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [selectedFactorySystemId, setSelectedFactorySystemId] =
    useState<string | null>(null);

  useEffect(() => {
    initSocket((state) => setGameState(state));
  }, []);

  const players: PlayerState[] = gameState?.players ?? [];
  const systems: StarSystem[] = gameState?.systems ?? [];
  const fleets: Fleet[] = gameState?.fleets ?? [];

  const currentPlayer =
    players.find((p) => p.id === gameState?.currentPlayerId) || null;

  const winner =
    gameState?.winnerPlayerId
        ? players.find((p) => p.id === gameState.winnerPlayerId)
        : null;


  const gameStarted =
    systems.length > 0 && systems.some((s) => s.ownerId !== null);

  const me =
    name.trim().length > 0
      ? players.find((p) => p.displayName === name.trim()) || null
      : null;

  const isMyTurn =
    !!me && currentPlayer && me.id === currentPlayer.id;

  const phase = gameState?.phase ?? "purchase";

  const selectedSystem =
    systems.find((s) => s.id === selectedSystemId) || null;

  const fleetsAtSelected = selectedSystem
    ? fleets.filter((f) => f.locationSystemId === selectedSystem.id)
    : [];

  const myFleetsAtSelected =
    me && selectedSystem
      ? fleetsAtSelected.filter((f) => f.ownerId === me.id)
      : [];

  let allowedDestSystemIds: string[] = [];
  if (
    selectedSystem &&
    me &&
    isMyTurn &&
    gameStarted &&
    phase === "movement" &&
    myFleetsAtSelected.some((f) => f.units.length > 0)
  ) {
    allowedDestSystemIds = selectedSystem.connectedSystems;
  }

  const hasCombat =
    fleetsAtSelected.length > 0 &&
    new Set(fleetsAtSelected.map((f) => f.ownerId)).size > 1;

  const myFactorySystems: StarSystem[] =
    me && systems.length > 0
      ? systems.filter(
          (s) => s.ownerId === me.id && s.hasShipyard
        )
      : [];

  useEffect(() => {
    if (!me || myFactorySystems.length === 0) {
      setSelectedFactorySystemId(null);
      return;
    }
    if (
      !selectedFactorySystemId ||
      !myFactorySystems.some((s) => s.id === selectedFactorySystemId)
    ) {
      setSelectedFactorySystemId(myFactorySystems[0].id);
    }
  }, [me, myFactorySystems.map((s) => s.id).join(","), selectedFactorySystemId]);

  const handleJoin = () => {
    if (name.trim()) {
      joinGame(name.trim());
    }
  };

  const handleStartGame = () => {
    startGame();
  };

  const handleEndTurn = () => {
    if (!me) return;
    endTurn(me.displayName);
  };

  const handlePurchase = () => {
    if (!me) return;
    if (!selectedFactorySystemId) return;
    if (phase !== "purchase") return;

    const count = parseInt(purchaseCount, 10);
    if (isNaN(count) || count <= 0) return;

    purchaseUnits(
      me.displayName,
      selectedUnitType,
      count,
      selectedFactorySystemId
    );
  };

    const handleSystemClick = (systemId: string) => {
    if (!gameState) {
      setSelectedSystemId(systemId);
      return;
    }

    const clickedSystem = systems.find((s) => s.id === systemId);
    if (!clickedSystem) {
      setSelectedSystemId(null);
      return;
    }

    // If it's not our movement phase, just select for info
    if (!me || !gameStarted || !isMyTurn || phase !== "movement") {
      setSelectedSystemId(systemId);
      return;
    }

    // No source selected yet -> select as source
    if (!selectedSystemId) {
      setSelectedSystemId(systemId);
      return;
    }

    // Clicking same system again clears selection
    if (selectedSystemId === systemId) {
      setSelectedSystemId(null);
      return;
    }

    const from = systems.find((s) => s.id === selectedSystemId);
    const to = clickedSystem;

    if (!from || !to) {
      setSelectedSystemId(systemId);
      return;
    }

    // All our fleets at the source
    const sourceFleets = fleets.filter(
      (f) =>
        f.ownerId === me.id &&
        f.locationSystemId === from.id &&
        f.units.length > 0
    );

    if (sourceFleets.length === 0) {
      setSelectedSystemId(systemId);
      return;
    }

    const isNeighbor = from.connectedSystems.includes(to.id);
    if (!isNeighbor) {
      setSelectedSystemId(systemId);
      return;
    }

    // Movable units = those with movementRemaining > 0
    const allUnits = sourceFleets.flatMap((f) => f.units);
    const movableUnits = allUnits.filter(
      (u: any) =>
        u.movementRemaining === undefined || u.movementRemaining > 0
    );

    if (movableUnits.length === 0) {
      window.alert("No units here have movement remaining this turn.");
      setSelectedSystemId(null);
      return;
    }

    // Build summary by type
    const countsByType: Record<UnitType, number> = {
      fighter: 0,
      destroyer: 0,
      cruiser: 0,
      battleship: 0,
      carrier: 0,
      transport: 0
    };
    movableUnits.forEach((u) => {
      countsByType[u.type] = (countsByType[u.type] || 0) + 1;
    });

    const summaryLines = unitTypeList
      .filter((t) => countsByType[t] > 0)
      .map((t) => `${UNIT_DEFS[t].name}: ${countsByType[t]}`);

    const promptText =
      `Movable units at ${from.name}:\n` +
      (summaryLines.length > 0 ? summaryLines.join("\n") : "None") +
      `\n\nEnter units to move like "fighter:2,destroyer:1" or "all":`;

    const answer = window.prompt(promptText, "all");
    if (answer === null) {
      // Cancel move
      setSelectedSystemId(null);
      return;
    }

    let unitIdsToMove: string[] = [];
    const trimmed = answer.trim().toLowerCase();

    if (trimmed === "all" || trimmed === "") {
      unitIdsToMove = movableUnits.map((u) => u.id);
    } else {
      const requestedCounts: Partial<Record<UnitType, number>> = {};
      const parts = trimmed.split(",");
      for (const part of parts) {
        const [rawType, rawCount] = part.split(":").map((s) => s.trim());
        if (!rawType || !rawCount) continue;
        const count = parseInt(rawCount, 10);
        if (!Number.isFinite(count) || count <= 0) continue;

        // Allow "fighter" OR "Fighter"
        const matchedType =
          (unitTypeList as UnitType[]).find((t) => t === rawType) ||
          (unitTypeList as UnitType[]).find(
            (t) => UNIT_DEFS[t].name.toLowerCase() === rawType
          );

        if (!matchedType) continue;
        requestedCounts[matchedType] = count;
      }

      // Choose that many unit IDs of each type
      const poolByType: Record<UnitType, string[]> = {
        fighter: [],
        destroyer: [],
        cruiser: [],
        battleship: [],
        carrier: [],
        transport: []
      };
      movableUnits.forEach((u) => {
        poolByType[u.type].push(u.id);
      });

      for (const t of unitTypeList) {
        const want = requestedCounts[t];
        if (!want || want <= 0) continue;
        const pool = poolByType[t];
        const chosen = pool.slice(0, want);
        unitIdsToMove.push(...chosen);
      }
    }

    unitIdsToMove = Array.from(new Set(unitIdsToMove));

    if (unitIdsToMove.length === 0) {
      window.alert("No valid units selected to move.");
      setSelectedSystemId(null);
      return;
    }

    moveFleet(me.displayName, from.id, to.id, unitIdsToMove);
    setSelectedSystemId(null);
  };


  const handleResolveCombat = () => {
    if (!selectedSystem) return;
    if (phase !== "combat") return;
    resolveCombat(selectedSystem.id);
  };

  const handleBuildFactoryHere = () => {
    if (!me || !selectedSystem) return;
    if (phase !== "purchase") return;
    buildFactory(me.displayName, selectedSystem.id);
  };

  const selectedUnitDef = UNIT_DEFS[selectedUnitType];
  const totalCost =
    selectedUnitDef && purchaseCount
      ? selectedUnitDef.cost * (parseInt(purchaseCount, 10) || 0)
      : 0;

  // Phase instructions text
  let phaseInstruction = "";
  if (!isMyTurn) {
    phaseInstruction = "Waiting for other players to take their turn.";
  } else {
    switch (phase) {
      case "purchase":
        phaseInstruction =
          "Purchase units and/or build factories. Units will be placed at the end of your turn.";
        break;
      case "movement":
        phaseInstruction =
          "Move fleets by clicking a system, then a connected destination.";
        break;
      case "combat":
        phaseInstruction =
          "Resolve ALL combats in contested systems. You cannot advance to the next step while any system has ships from multiple players.";
        break;
      case "deploy":
        phaseInstruction =
          "Units purchased earlier will be placed now. Click Next Step to end your turn.";
        break;
    }
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem", maxWidth: "900px" }}>
      {winner && (
        <section
          style={{
            padding: "1rem",
            background: "#222",
            color: "#0f0",
            marginBottom: "1rem",
            border: "2px solid #0f0"
          }}
        >
          <h1>GAME OVER</h1>
          <p>
            <strong>{winner.displayName}</strong> wins the game!
          </p>
        </section>
      )}
      <h1>Space War</h1>

      {/* Turn/phase summary */}
      <section
        style={{
          marginBottom: "1rem",
          padding: "0.5rem",
          border: "1px solid #ccc"
        }}
      >
        <h2>Turn & Phase</h2>
        <p>
          <strong>Round:</strong> {gameState?.round ?? 1}{" "}
          | <strong>Phase:</strong> {phase.toUpperCase()}{" "}
          {currentPlayer && (
            <>
              | <strong>Current Player:</strong> {currentPlayer.displayName}
              {isMyTurn && " (YOU)"}
            </>
          )}
        </p>
        <p style={{ fontSize: "0.9em", color: "#555" }}>
          Turn sequence: 1) Income (automatic at start of your turn),
          2) Purchase, 3) Movement, 4) Combat, 5) Deploy (place new units).
        </p>
        <p style={{ fontSize: "0.9em" }}>{phaseInstruction}</p>
      </section>

      {/* Lobby / control */}
      <section
        style={{
          marginBottom: "1rem",
          padding: "0.5rem",
          border: "1px solid #ccc"
        }}
      >
        <h2>Lobby / Game Controls</h2>
        <div style={{ marginBottom: "0.5rem" }}>
          <input
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button onClick={handleJoin} style={{ marginLeft: "0.5rem" }}>
            Join Game
          </button>
        </div>

        <div style={{ marginBottom: "0.5rem" }}>
          <button
            onClick={handleStartGame}
            disabled={players.length === 0 || gameStarted}
          >
            Start Game
          </button>

          <button
            onClick={handleEndTurn}
            style={{ marginLeft: "0.5rem" }}
            disabled={!gameStarted || !me || !isMyTurn || !!winner}
          >
            Next Step
          </button>
        </div>

        <div>
          <h3>Players</h3>
          {players.length === 0 ? (
            <p>No players yet. Join the game!</p>
          ) : (
            <ul>
              {players.map((p) => (
                <li key={p.id}>
                  <strong>{p.displayName}</strong>{" "}
                  {p.id === gameState?.currentPlayerId && (
                    <span>(current turn)</span>
                  )}
                  <span style={{ marginLeft: "0.5rem" }}>
                    | Resources: {p.resources}
                  </span>
                  {p.homeSystems.length > 0 && (
                    <span
                      style={{
                        marginLeft: "0.5rem",
                        fontSize: "0.9em",
                        color: "#555"
                      }}
                    >
                      Home: {p.homeSystems.join(", ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Purchase ships at factory */}
      <section
        style={{
          marginBottom: "1rem",
          padding: "0.5rem",
          border: "1px solid #ccc"
        }}
      >
        <h2>Purchase Ships (Purchase Phase)</h2>
        {!me && <p>Join the game with your name above to purchase units.</p>}
        {me && (
          <>
            <p>
              You are <strong>{me.displayName}</strong> with{" "}
              <strong>{me.resources}</strong> resources.
            </p>

            {phase !== "purchase" && (
              <p style={{ fontSize: "0.9em", color: "#555" }}>
                You can only purchase during the PURCHASE phase.
              </p>
            )}

            {myFactorySystems.length === 0 ? (
              <p style={{ color: "#c00" }}>
                You have no factories. Build one in a system you own (see
                Selected System panel) before you can produce units.
              </p>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                    flexWrap: "wrap"
                  }}
                >
                  <label>
                    Factory:
                    <select
                      value={selectedFactorySystemId ?? ""}
                      onChange={(e) =>
                        setSelectedFactorySystemId(e.target.value || null)
                      }
                      style={{ marginLeft: "0.5rem" }}
                    >
                      {myFactorySystems.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Unit:
                    <select
                      value={selectedUnitType}
                      onChange={(e) =>
                        setSelectedUnitType(e.target.value as UnitType)
                      }
                      style={{ marginLeft: "0.5rem" }}
                    >
                      {unitTypeList.map((t) => (
                        <option key={t} value={t}>
                          {UNIT_DEFS[t].name} (cost {UNIT_DEFS[t].cost})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Qty:
                    <input
                      type="number"
                      min="1"
                      value={purchaseCount}
                      onChange={(e) => setPurchaseCount(e.target.value)}
                      style={{ width: "60px", marginLeft: "0.5rem" }}
                    />
                  </label>

                  <button
                    onClick={handlePurchase}
                    disabled={
                      !gameStarted ||
                      !selectedFactorySystemId ||
                      !isMyTurn ||
                      phase !== "purchase"
                    }
                  >
                    Purchase
                  </button>
                </div>
                <p
                  style={{
                    fontSize: "0.9em",
                    color: "#555",
                    marginTop: "0.25rem"
                  }}
                >
                  Total cost: {totalCost} | Units will be placed during the
                  DEPLOY phase at this factory.
                </p>
              </>
            )}
          </>
        )}
      </section>

      {/* Selected system info + build factory */}
      <section
        style={{
          marginBottom: "1rem",
          padding: "0.5rem",
          border: "1px solid #ccc"
        }}
      >
        <h2>Selected System</h2>
        {!selectedSystem ? (
          <p>Click a system on the map to inspect it.</p>
        ) : (
          <>
            <p>
              <strong>{selectedSystem.name}</strong>
            </p>
            <p>
              Owner:{" "}
              {(() => {
                const owner = players.find(
                  (p) => p.id === selectedSystem.ownerId
                );
                return owner ? (
                  owner.displayName
                ) : (
                  <span style={{ color: "#999" }}>Unowned</span>
                );
              })()}
            </p>
            <p>Resources: {selectedSystem.resourceValue}</p>
            <p>Factory: {selectedSystem.hasShipyard ? "Yes" : "No"}</p>

            {me &&
              selectedSystem.ownerId === me.id &&
              !selectedSystem.hasShipyard && (
                <div style={{ marginTop: "0.5rem" }}>
                  <button
                    onClick={handleBuildFactoryHere}
                    disabled={
                      me.resources < FACTORY_COST ||
                      !isMyTurn ||
                      phase !== "purchase"
                    }
                  >
                    Build Factory Here (cost {FACTORY_COST})
                  </button>
                  {me.resources < FACTORY_COST && (
                    <span style={{ marginLeft: "0.5rem", color: "#c00" }}>
                      Not enough resources
                    </span>
                  )}
                  {phase !== "purchase" && (
                    <span style={{ marginLeft: "0.5rem", color: "#555" }}>
                      (Only in PURCHASE phase)
                    </span>
                  )}
                </div>
              )}

            <h3>Fleets here</h3>
            {fleetsAtSelected.length === 0 ? (
              <p>No fleets in this system.</p>
            ) : (
              <ul>
                {fleetsAtSelected.map((f) => {
                  const owner = players.find((p) => p.id === f.ownerId);
                  const counts: Record<UnitType, number> = {
                    fighter: 0,
                    destroyer: 0,
                    cruiser: 0,
                    battleship: 0,
                    carrier: 0,
                    transport: 0
                  };
                  f.units.forEach((u) => {
                    counts[u.type] = (counts[u.type] || 0) + 1;
                  });

                  return (
                    <li key={f.id}>
                      <strong>{owner?.displayName || "Unknown"}</strong> fleet{" "}
                      ({f.id}):{" "}
                      {unitTypeList
                        .filter((t) => counts[t] > 0)
                        .map((t) => `${counts[t]} ${UNIT_DEFS[t].name}`)
                        .join(", ") || "no ships"}
                    </li>
                  );
                })}
              </ul>
            )}
            {me &&
              isMyTurn &&
              phase === "movement" &&
              myFleetsAtSelected.length > 0 && (
                <p style={{ fontSize: "0.9em", color: "#0a0" }}>
                  Movement phase: Click a connected system on the map to move
                  one of your fleets from here.
                </p>
              )}

            {hasCombat && (
              <div style={{ marginTop: "0.5rem" }}>
                <button
                  onClick={handleResolveCombat}
                  disabled={!gameStarted || !isMyTurn || phase !== "combat"}
                >
                  Resolve Combat in this System
                </button>
                {phase !== "combat" && (
                  <span style={{ marginLeft: "0.5rem", color: "#555" }}>
                    (Only in COMBAT phase)
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* Galaxy map */}
      <section
        style={{
          marginBottom: "1rem",
          padding: "0.5rem",
          border: "1px solid #ccc"
        }}
      >
        <GalaxyMap
          systems={systems}
          players={players}
          selectedSystemId={selectedSystemId}
          allowedDestSystemIds={allowedDestSystemIds}
          onSystemClick={handleSystemClick}
        />
      </section>

      {/* Systems table */}
      <section
        style={{
          marginBottom: "1rem",
          padding: "0.5rem",
          border: "1px solid #ccc"
        }}
      >
        <h2>Systems</h2>
        {systems.length === 0 ? (
          <p>No systems defined.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th
                  style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}
                >
                  Name
                </th>
                <th
                  style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}
                >
                  Owner
                </th>
                <th
                  style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}
                >
                  Resources
                </th>
                <th
                  style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}
                >
                  Factory
                </th>
              </tr>
            </thead>
            <tbody>
              {systems.map((s) => {
                const owner = players.find((p) => p.id === s.ownerId);
                return (
                  <tr key={s.id}>
                    <td style={{ padding: "0.25rem 0" }}>{s.name}</td>
                    <td style={{ padding: "0.25rem 0" }}>
                      {owner ? (
                        owner.displayName
                      ) : (
                        <span style={{ color: "#999" }}>Unowned</span>
                      )}
                    </td>
                    <td style={{ padding: "0.25rem 0" }}>{s.resourceValue}</td>
                    <td style={{ padding: "0.25rem 0" }}>
                      {s.hasShipyard ? "Yes" : "No"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Debug */}
      <section>
        <h2>Game State (debug)</h2>

        {gameState?.lastCombatLog && gameState.lastCombatLog.length > 0 && (
          <div
            style={{
              background: "#222",
              color: "#fff",
              padding: "0.5rem",
              marginBottom: "0.5rem",
              fontSize: "0.9em"
            }}
          >
            <strong>Last Combat Log:</strong>
            <pre style={{ margin: 0 }}>
              {gameState.lastCombatLog.join("\n")}
            </pre>
          </div>
        )}

        <pre
          style={{
            background: "#111",
            color: "#0f0",
            padding: "1rem",
            maxHeight: "300px",
            overflow: "auto"
          }}
        >
          {gameState ? JSON.stringify(gameState, null, 2) : "No game state yet"}
        </pre>
      </section>
    </div>
  );
};

export default App;
