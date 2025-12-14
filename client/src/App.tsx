import React, { useEffect, useState } from "react";
import { GameState } from "@space-war/shared/types";
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

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem" }}>
      <h1>Space War</h1>

      <section>
        <h2>Lobby</h2>
        <input
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button onClick={handleJoin}>Join Game</button>
      </section>

      <section style={{ marginTop: "1rem" }}>
        <h2>Game State (debug)</h2>
        <pre style={{ background: "#111", color: "#0f0", padding: "1rem" }}>
          {gameState ? JSON.stringify(gameState, null, 2) : "No game state yet"}
        </pre>
      </section>
    </div>
  );
};

export default App;
