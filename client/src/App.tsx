import React, { useEffect, useState } from "react";
import {
  GameState,
  PlayerState,
  StarSystem,
  UnitType,
  UNIT_DEFS
} from "@space-war/shared";
import {
  initSocket,
  joinGame,
  startGame,
  endTurn,
  purchaseUnits
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

  const handlePurchase = () => {
    if (!name.trim()) return;
    const count = parseInt(purchaseCount, 10);
    if (isNaN(count) || count <= 0) return;

    purchaseUnits(name.trim(), selectedUnitType, count);
  };

  const players: PlayerState[] = gameState?.players ?? [];
  const systems: StarSystem[] = gameState?.systems ?? [];

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
            <p style={{ fontSize: "0.9em", color: "#555", marginTop: "0.25rem" }}>
              Total cost: {totalCost} | Units spawn at your home system.
            </p>
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
        <GalaxyMap systems={systems} players={players} />
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
