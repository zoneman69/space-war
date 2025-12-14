import React from "react";
import { StarSystem, PlayerState } from "@space-war/shared";

interface GalaxyMapProps {
  systems: StarSystem[];
  players: PlayerState[];
}

const SYSTEM_LAYOUT: Record<string, { x: number; y: number }> = {
  "sys-1": { x: 100, y: 200 }, // Sol
  "sys-2": { x: 300, y: 150 }, // Alpha Centauri
  "sys-3": { x: 250, y: 300 }, // Vega
  "sys-4": { x: 500, y: 220 }  // Sirius
};

// Simple color palette for players
const PLAYER_COLORS = [
  "#ff5555", // red
  "#55aa55", // green
  "#5555ff", // blue
  "#ffaa00", // orange
  "#aa55ff"  // purple
];

function getPlayerColor(player: PlayerState | undefined, players: PlayerState[]): string {
  if (!player) return "#888888"; // neutral
  const index = players.findIndex((p) => p.id === player.id);
  if (index === -1) return "#888888";
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

const GalaxyMap: React.FC<GalaxyMapProps> = ({ systems, players }) => {
  if (systems.length === 0) {
    return <p>No systems to display.</p>;
  }

  // Build quick lookup by id
  const systemById: Record<string, StarSystem> = {};
  systems.forEach((s) => {
    systemById[s.id] = s;
  });

  // Helper to get coords, fallback to some default if not defined
  const getCoords = (id: string) => {
    const layout = SYSTEM_LAYOUT[id];
    if (layout) return layout;
    // fallback to center-ish
    return { x: 400, y: 200 };
  };

  // Build connection lines (avoid duplicates by only drawing when from.id < to.id)
  const connections: { fromId: string; toId: string }[] = [];
  systems.forEach((s) => {
    s.connectedSystems.forEach((neighborId) => {
      if (!systemById[neighborId]) return;
      if (s.id < neighborId) {
        connections.push({ fromId: s.id, toId: neighborId });
      }
    });
  });

  return (
    <div style={{ marginBottom: "1rem" }}>
      <h2>Galaxy Map</h2>
      <svg
        viewBox="0 0 600 400"
        style={{
          width: "100%",
          maxWidth: "600px",
          border: "1px solid #444",
          background: "#02030a"
        }}
      >
        {/* Draw connections first */}
        {connections.map((c, idx) => {
          const from = getCoords(c.fromId);
          const to = getCoords(c.toId);
          return (
            <line
              key={idx}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#444"
              strokeWidth={2}
            />
          );
        })}

        {/* Draw systems */}
        {systems.map((s) => {
          const { x, y } = getCoords(s.id);
          const owner = players.find((p) => p.id === s.ownerId);
          const color = getPlayerColor(owner, players);
          const isHome = owner?.homeSystems.includes(s.id);

          return (
            <g key={s.id}>
              {/* glow-ish effect if home system */}
              {isHome && (
                <circle
                  cx={x}
                  cy={y}
                  r={18}
                  fill={color}
                  opacity={0.2}
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={10}
                fill={color}
                stroke="#ffffff"
                strokeWidth={isHome ? 3 : 1}
              />
              <text
                x={x + 12}
                y={y + 4}
                fill="#ffffff"
                fontSize="12"
              >
                {s.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Simple legend */}
      <div style={{ marginTop: "0.5rem", fontSize: "0.9em" }}>
        <strong>Legend:</strong>
        <ul style={{ listStyle: "none", paddingLeft: 0 }}>
          {players.map((p, i) => (
            <li key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: PLAYER_COLORS[i % PLAYER_COLORS.length]
                }}
              />
              <span>{p.displayName}</span>
            </li>
          ))}
          {players.length === 0 && <li><span style={{ color: "#999" }}>No players yet.</span></li>}
        </ul>
      </div>
    </div>
  );
};

export default GalaxyMap;
