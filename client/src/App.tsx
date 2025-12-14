import React, { useEffect, useState } from "react";
import { GameState, PlayerState } from "@space-war/shared";
import { initSocket, joinGame } from "./api/socket";

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

  const players: PlayerState[] = gameState?.players ?? [];

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem" }}>
      <h1>Space War</h1>

      <section style={{ marginBottom: "1rem" }}>
        <h2>Lobby</h2>
        <input
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button onClick={handleJoin} style={{ marginLeft: "0.5rem" }}>
          Join Game
        </button>
      </section>

      <section style={{ marginBottom: "1rem" }}>
        <h2>Players</h2>
        {players.length === 0 ? (
          <p>No players yet. Join the game!</p>
        ) : (
          <ul>
            {players.map((p) => (
              <li key={p.id}>
                {p.displayName} {p.id === gameState?.currentPlayerId ? "(current turn)" : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Game State (debug)</h2>
        <pre style={{ background: "#111", color: "#0f0", padding: "1rem", maxHeight: "300px", overflow: "auto" }}>
          {gameState ? JSON.stringify(gameState, null, 2) : "No game state yet"}
        </pre>
      </section>
    </div>
  );
};

export default App;
