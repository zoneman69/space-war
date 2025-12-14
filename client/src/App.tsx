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
  resolveCombat
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

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [name, setName] = useState("");

  const [selectedUnitType, setSelectedUnitType] = useState<UnitType>("fighter");
  const [purchaseCount, setPurchaseCount] = useState("1");

  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);

  useEffect(() => {
    initSocket((state) => setGameState(state));
  }, []);

  const handleJoin = () => {
    if (name.trim()) {
      joinGame(name.trim());
    }
  };

  const handleStartGame = () => {
    startGame();
  };

  const handleEndTurn = () => {
    endTurn();
  };

  const players: PlayerState[] = gameState?.players ?? [];
  const systems: StarSystem[] = gameState?.systems ?? [];
  const fleets: Fleet[] = gameState?.fleets ?? [];

  const currentPlayer =
    players.find((p) => p.id === gameState?.currentPlayerId) || null;

  const gameStarted =
    systems.length > 0 && systems.some((s) => s.ownerId !== null);

  const me =
    name.trim().length > 0
      ? players.find((p) => p.displayName === name.trim()) || null
      : null;

  const isMyTurn =
    !!me && currentPlayer && me.id === currentPlayer.id;

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
    myFleetsAtSelected.some((f) => f.units.length > 0)
  ) {
    allowedDestSystemIds = selectedSystem.connectedSystems;
  }

  const hasCombat =
    fleetsAtSelected.length > 0 &&
    new Set(fleetsAtSelected.map((f) => f.ownerId)).size > 1;

  const handlePurchase = () => {
    if (!name.trim()) return;
    const count = parseInt(purchaseCount, 10);
    if (isNaN(count) || count <= 0) return;

    purchaseUnits(name.trim(), selectedUnitType, count);
  };

  const handleResolveCombat = () => {
    if (!selectedSystem) return;
    resolveCombat(selectedSystem.id);
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

    // If no player or no turn logic, just select system
    if (!me || !gameStarted || !isMyTurn) {
      setSelectedSystemId(systemId);
      return;
    }

    // No selection yet -> pick source
    if (!selectedSystemId) {
      setSelectedSystemId(systemId);
      return;
    }

    // Clicking same system toggles selection off
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

    const hasMyFleetHere = fleets.some(
      (f) =>
        f.ownerId === me.id &&
        f.locationSystemId === from.id &&
        f.units.length > 0
    );

    if (!hasMyFleetHere) {
      // No fleet to move from that system, just select the new one
      setSelectedSystemId(systemId);
      return;
    }

    const isNeighbor = from.connectedSystems.includes(to.id);
    if (!isNeighbor) {
      // not a valid move, just change selection
      setSelectedSystemId(systemId);
      return;
    }

    // Valid move: send to server
    moveFleet(name.trim(), from.id, to.id);
    setSelectedSystemId(null);
  };

  const selectedUnitDef = UNIT_DEFS[selectedUnitType];
  const totalCost =
    selectedUnitDef && purchaseCount
      ? selectedUnitDef.cost * (parseInt(purchaseCount, 10) || 0)
      : 0;

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem", maxWidth: "900px" }}>
      <h1>Space War</h1>

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
            disabled={!gameStarted}
          >
            End Turn
          </button>

          {gameState && (
            <span style={{ marginLeft: "1rem", fontWeight: "bold" }}>
              Round: {gameState.round}{" "}
              {currentPlayer && (
                <>
                  | Current: {currentPlayer.displayName}
                  {isMyTurn && " (YOU)"}
                </>
              )}
            </span>
          )}
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
                  {p.id === gameState?.currentPlayerId ? (
                    <span>(current turn)</span>
                  ) : null}
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

      {/* Purchase section */}
      <section
        style={{
          marginBottom: "1rem",
          padding: "0.5rem",
          border: "1px solid #ccc"
        }}
      >
        <h2>Purchase Ships</h2>
        {!me && <p>Join the game with your name above to purchase units.</p>}
        {me && (
          <>
            <p>
              You are <strong>{me.displayName}</strong> with{" "}
              <strong>{me.resources}</strong> resources.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
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

              <button onClick={handlePurchase} disabled={!gameStarted}>
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
              Total cost: {totalCost} | Units spawn at your home system.
            </p>
          </>
        )}
      </section>

      {/* Selected system info */}
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
            <p>Shipyard: {selectedSystem.hasShipyard ? "Yes" : "No"}</p>

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
            {me && isMyTurn && myFleetsAtSelected.length > 0 && (
              <p style={{ fontSize: "0.9em", color: "#0a0" }}>
                Tip: Click a connected system on the map to move one of your
                fleets from here.
              </p>
            )}
            {hasCombat && (
              <div style={{ marginTop: "0.5rem" }}>
                <button onClick={handleResolveCombat} disabled={!gameStarted}>
                  Resolve Combat in this System
                </button>
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
          border: '1px solid #ccc'
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
                  Shipyard
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
