import React, { useEffect, useState } from "react";
import { GameState, PlayerState, StarSystem } from "@space-war/shared";
import { initSocket, joinGame, startGame, endTurn } from "./api/socket";
import GalaxyMap from "./components/GalaxyMap";

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [name, setName] = useState("");

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

  const currentPlayer =
    players.find((p) => p.id === gameState?.currentPlayerId) || null;

  const gameStarted =
    systems.length > 0 && systems.some((s) => s.ownerId !== null);

  // crude “who am I?” based on name
  const me =
    name.trim().length > 0
      ? players.find((p) => p.displayName === name.trim()) || null
      : null;

  const isMyTurn =
    !!me && currentPlayer && me.id === currentPlayer.id;

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem", maxWidth: "900px" }}>
      <h1>Space War</h1>

      {/* Galaxy map */}
      <section style={{ marginBottom: "1rem", padding: "0.5rem", border: "1px solid #ccc" }}>
        <GalaxyMap systems={systems} players={players} />
      </section>

      <section style={{ marginBottom: "1rem", padding: "0.5rem", border: "1px solid #ccc" }}>
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
                  {p.displayName}{" "}
                  {p.id === gameState?.currentPlayerId ? (
                    <strong>(current turn)</strong>
                  ) : null}
                  {p.homeSystems.length > 0 && (
                    <span style={{ marginLeft: "0.5rem", fontSize: "0.9em", color: "#555" }}>
                      Home: {p.homeSystems.join(", ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section style={{ marginBottom: "1rem", padding: "0.5rem", border: "1px solid #ccc" }}>
        <h2>Systems</h2>
        {systems.length === 0 ? (
          <p>No systems defined.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Name</th>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Owner</th>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Resources</th>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Shipyard</th>
              </tr>
            </thead>
            <tbody>
              {systems.map((s) => {
                const owner = players.find((p) => p.id === s.ownerId);
                return (
                  <tr key={s.id}>
                    <td style={{ padding: "0.25rem 0" }}>{s.name}</td>
                    <td style={{ padding: "0.25rem 0" }}>
                      {owner ? owner.displayName : (
                        <span style={{ color: "#999" }}>Unowned</span>
                      )}
                    </td>
                    <td style={{ padding: "0.25rem 0" }}>{s.resourceValue}</td>
                    <td style={{ padding: "0.25rem 0" }}>{s.hasShipyard ? "Yes" : "No"}</td>
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
