import React from "react";
import { Fleet, PlayerState, StarSystem } from "@space-war/shared";

interface GalaxyMapProps {
  systems: StarSystem[];
  fleets: Fleet[];
  players: PlayerState[];
  selectedSystemId?: string | null;
  allowedDestSystemIds?: string[];
  onSystemClick?: (systemId: string) => void;
}

const SYSTEM_LAYOUT: Record<string, { x: number; y: number }> = {
  "sys-1": { x: 100, y: 200 }, // Sol
  "sys-2": { x: 200, y: 130 }, // Alpha Centauri
  "sys-3": { x: 200, y: 270 }, // Vega
  "sys-4": { x: 300, y: 80 },  // Sirius
  "sys-5": { x: 300, y: 320 }, // Procyon
  "sys-6": { x: 400, y: 120 }, // Betelgeuse
  "sys-7": { x: 400, y: 280 }, // Deneb
  "sys-8": { x: 500, y: 80 },  // Rigel
  "sys-9": { x: 500, y: 240 }, // Polaris
  "sys-10": { x: 500, y: 330 }, // Altair
  "sys-11": { x: 600, y: 220 }, // Bellatrix
  "sys-12": { x: 600, y: 140 }  // Capella
};

const PLAYER_COLORS = [
  "#ff5555",
  "#55aa55",
  "#5555ff",
  "#ffaa00",
  "#aa55ff"
];

function getPlayerColor(player: PlayerState | undefined, players: PlayerState[]): string {
  if (!player) return "#888888";
  const index = players.findIndex((p) => p.id === player.id);
  if (index === -1) return "#888888";
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

const GalaxyMap: React.FC<GalaxyMapProps> = ({
  systems,
  fleets,
  players,
  selectedSystemId,
  allowedDestSystemIds,
  onSystemClick
}) => {
  if (systems.length === 0) {
    return <p>No systems to display.</p>;
  }

  const systemById: Record<string, StarSystem> = {};
  systems.forEach((s) => {
    systemById[s.id] = s;
  });

  const getCoords = (id: string) => {
    const layout = SYSTEM_LAYOUT[id];
    if (layout) return layout;
    return { x: 400, y: 200 };
  };

  const connections: { fromId: string; toId: string }[] = [];
  systems.forEach((s) => {
    s.connectedSystems.forEach((neighborId) => {
      if (!systemById[neighborId]) return;
      if (s.id < neighborId) {
        connections.push({ fromId: s.id, toId: neighborId });
      }
    });
  });

  const allowedDestSet = new Set(allowedDestSystemIds || []);

  const groupedFleetsBySystem: Record<string, { ownerId: string | null; count: number }[]> = {};
  systems.forEach((s) => {
    const fleetsHere = fleets.filter((f) => f.locationSystemId === s.id);

    const counts: Record<string, number> = {};
    fleetsHere.forEach((f) => {
      const key = f.ownerId || "neutral";
      counts[key] = (counts[key] || 0) + f.units.length;
    });

    groupedFleetsBySystem[s.id] = Object.entries(counts).map(
      ([ownerId, count]) => ({ ownerId: ownerId === "neutral" ? null : ownerId, count })
    );
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

        {systems.map((s) => {
          const { x, y } = getCoords(s.id);
          const owner = players.find((p) => p.id === s.ownerId);
          const color = getPlayerColor(owner, players);
          const isHome = owner?.homeSystems.includes(s.id);
          const isSelected = selectedSystemId === s.id;
          const isAllowedDest = allowedDestSet.has(s.id);

          const handleClick = () => {
            if (onSystemClick) {
              onSystemClick(s.id);
            }
          };

          const strokeColor = isSelected
            ? "#ffff00"
            : isAllowedDest
            ? "#00ffff"
            : "#ffffff";

          const strokeWidth = isSelected || isAllowedDest ? 3 : isHome ? 3 : 1;

          return (
            <g key={s.id} onClick={handleClick} style={{ cursor: "pointer" }}>
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
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
              <text
                x={x + 12}
                y={y + 4}
                fill="#ffffff"
                fontSize="12"
              >
                {s.name}
              </text>

              {/* Fleet markers */}
              <g transform={`translate(${x - 20}, ${y + 16})`}>
                {groupedFleetsBySystem[s.id]?.map((group, idx) => {
                  const fleetOwner = players.find((p) => p.id === group.ownerId);
                  const badgeColor = getPlayerColor(fleetOwner, players);
                  const verticalOffset = idx * 18;
                  return (
                    <g key={`${s.id}-${group.ownerId ?? "none"}`} transform={`translate(0, ${verticalOffset})`}>
                      <rect
                        x={0}
                        y={0}
                        width={34}
                        height={16}
                        rx={4}
                        fill={badgeColor}
                        opacity={0.8}
                        stroke="#0a0a0a"
                      />
                      <text
                        x={17}
                        y={11}
                        fill="#0a0a0a"
                        fontSize="10"
                        textAnchor="middle"
                      >
                        {group.count}
                      </text>
                    </g>
                  );
                })}
              </g>
            </g>
          );
        })}
      </svg>

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
          {players.length === 0 && (
            <li>
              <span style={{ color: "#999" }}>No players yet.</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default GalaxyMap;
