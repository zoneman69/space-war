import React, { useEffect, useState } from "react";
import {
  GameState,
  PlayerState,
  StarSystem,
  Unit,
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
  const [factoryBuildSystemId, setFactoryBuildSystemId] =
    useState<string | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);

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
    getMyMovableUnits(selectedSystem.id).length > 0
  ) {
    allowedDestSystemIds = selectedSystem.connectedSystems;
  }

  const hasCombat =
    fleetsAtSelected.length > 0 &&
    new Set(fleetsAtSelected.map((f) => f.ownerId)).size > 1;

  const ownedSystems = me
    ? systems.filter((s) => s.ownerId === me.id)
    : [];

  const ownedSystemsWithoutFactory = ownedSystems.filter((s) => !s.hasShipyard);

  const myFactorySystems: StarSystem[] =
    me && systems.length > 0
      ? systems.filter(
          (s) => s.ownerId === me.id && s.hasShipyard
        )
      : [];

  const getMyMovableUnits = (systemId: string): Unit[] => {
    if (!me) return [];
    return fleets
      .filter(
        (f) =>
          f.ownerId === me.id &&
          f.locationSystemId === systemId &&
          f.units.length > 0
      )
      .flatMap((f) => f.units)
      .filter((u) => u.movementRemaining > 0);
  };

  const myMovableUnitsAtSelected = selectedSystem
    ? getMyMovableUnits(selectedSystem.id)
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

  useEffect(() => {
    if (!me || ownedSystemsWithoutFactory.length === 0) {
      setFactoryBuildSystemId(null);
      return;
    }
    if (
      !factoryBuildSystemId ||
      !ownedSystemsWithoutFactory.some((s) => s.id === factoryBuildSystemId)
    ) {
      setFactoryBuildSystemId(ownedSystemsWithoutFactory[0].id);
    }
  }, [
    me,
    ownedSystemsWithoutFactory.map((s) => s.id).join(","),
    factoryBuildSystemId
  ]);

  useEffect(() => {
    if (
      !selectedSystemId ||
      !me ||
      !isMyTurn ||
      phase !== "movement" ||
      !gameStarted
    ) {
      setSelectedUnitIds([]);
      return;
    }
    const movable = getMyMovableUnits(selectedSystemId);
    setSelectedUnitIds(movable.map((u) => u.id));
  }, [
    selectedSystemId,
    me?.id,
    fleets.map((f) => `${f.id}:${f.units.length}`).join(","),
    isMyTurn,
    phase,
    gameStarted
  ]);

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
    const clickedSystem = systems.find((s) => s.id === systemId);
    if (!clickedSystem) {
      setSelectedSystemId(null);
      setSelectedUnitIds([]);
      return;
    }

    const canMove =
      me && gameStarted && isMyTurn && phase === "movement" && !!selectedSystem;

    if (!canMove) {
      setSelectedSystemId(systemId);
      setSelectedUnitIds([]);
      return;
    }

    if (!selectedSystemId) {
      setSelectedSystemId(systemId);
      setSelectedUnitIds(getMyMovableUnits(systemId).map((u) => u.id));
      return;
    }

    if (selectedSystemId === systemId) {
      setSelectedSystemId(null);
      setSelectedUnitIds([]);
      return;
    }

    const from = systems.find((s) => s.id === selectedSystemId);
    const to = clickedSystem;

    if (!from || !to) {
      setSelectedSystemId(systemId);
      setSelectedUnitIds(getMyMovableUnits(systemId).map((u) => u.id));
      return;
    }

    const isNeighbor = from.connectedSystems.includes(to.id);
    if (!isNeighbor) {
      setSelectedSystemId(systemId);
      setSelectedUnitIds(getMyMovableUnits(systemId).map((u) => u.id));
      return;
    }

    const movableUnits = getMyMovableUnits(from.id);
    const unitIdsToMove = movableUnits
      .filter((u) => selectedUnitIds.includes(u.id))
      .map((u) => u.id);

    if (unitIdsToMove.length === 0) {
      setSelectedSystemId(systemId);
      setSelectedUnitIds(getMyMovableUnits(systemId).map((u) => u.id));
      return;
    }

    moveFleet(me.displayName, from.id, to.id, unitIdsToMove);
    setSelectedSystemId(null);
    setSelectedUnitIds([]);
  };


  const handleResolveCombat = () => {
    if (!selectedSystem) return;
    if (phase !== "combat") return;
    resolveCombat(selectedSystem.id);
  };

  const handleBuildFactory = () => {
    if (!me || !factoryBuildSystemId) return;
    if (phase !== "purchase") return;
    buildFactory(me.displayName, factoryBuildSystemId);
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

  const selectedSystemOwner = selectedSystem
    ? players.find((p) => p.id === selectedSystem.ownerId)
    : null;

  const systemUnitsByPlayer: { player: PlayerState | undefined; units: Unit[] }[] =
    selectedSystem
      ? Array.from(
          fleetsAtSelected.reduce((acc, fleet) => {
            const existing = acc.get(fleet.ownerId) || [];
            acc.set(fleet.ownerId, existing.concat(fleet.units));
            return acc;
          }, new Map<string, Unit[]>())
        ).map(([playerId, units]) => ({
          player: players.find((p) => p.id === playerId),
          units
        }))
      : [];

  const selectedUnitsSet = new Set(selectedUnitIds);

  const phaseHighlight = {
    purchase: "#1f7a8c",
    movement: "#8c6df0",
    combat: "#d96c75",
    deploy: "#5aa469"
  }[phase];

  return (
    <div
      style={{
        fontFamily: "Inter, system-ui, sans-serif",
        background: "#05080f",
        color: "#e8ecf0",
        minHeight: "100vh"
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          background: "#0b1220",
          borderBottom: "1px solid #1f2a3d",
          padding: "1rem"
        }}
      >
        {winner && (
          <div
            style={{
              padding: "0.75rem 1rem",
              marginBottom: "0.5rem",
              borderRadius: "8px",
              border: "1px solid #27c24c",
              background: "rgba(39, 194, 76, 0.1)",
              color: "#c9ffd7"
            }}
          >
            <strong>{winner.displayName}</strong> has conquered the galaxy!
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap"
          }}
        >
          <div>
            <h1 style={{ margin: 0, letterSpacing: "0.03em" }}>Space War</h1>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <span>
                Round <strong>{gameState?.round ?? 1}</strong>
              </span>
              <span>
                Phase
                <span
                  style={{
                    marginLeft: "0.35rem",
                    padding: "0.15rem 0.5rem",
                    borderRadius: "999px",
                    background: phaseHighlight
                  }}
                >
                  {phase.toUpperCase()}
                </span>
              </span>
              {currentPlayer && (
                <span>
                  Current: <strong>{currentPlayer.displayName}</strong>
                  {isMyTurn && " (you)"}
                </span>
              )}
              {me && (
                <span>
                  Your credits: <strong>{me.resources}</strong>
                </span>
              )}
            </div>
            <p style={{ margin: "0.3rem 0 0", color: "#9fb3c8", fontSize: "0.95rem" }}>
              Turn sequence: Income → Purchase → Movement → Combat → Deploy
            </p>
            <p style={{ margin: 0, color: "#cdd9ed", fontSize: "0.95rem" }}>
              {phaseInstruction}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                background: "#0f172a",
                border: "1px solid #1f2a3d",
                color: "#e8ecf0",
                padding: "0.4rem 0.6rem",
                borderRadius: "6px"
              }}
            />
            <button onClick={handleJoin} style={{ padding: "0.5rem 0.8rem" }}>
              Join
            </button>
            <button
              onClick={handleStartGame}
              disabled={players.length === 0 || gameStarted}
              style={{ padding: "0.5rem 0.8rem" }}
            >
              Start Game
            </button>
            <button
              onClick={handleEndTurn}
              disabled={!gameStarted || !me || !isMyTurn || !!winner}
              style={{ padding: "0.5rem 0.8rem" }}
            >
              Next Step
            </button>
          </div>
        </div>
      </header>

      <main
        style={{
          padding: "1rem",
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "1rem",
          alignItems: "start"
        }}
      >
        <section
          style={{
            background: "#0b1220",
            border: "1px solid #1f2a3d",
            borderRadius: "10px",
            padding: "1rem",
            boxShadow: "0 8px 16px rgba(0,0,0,0.35)"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h2 style={{ marginTop: 0 }}>Galaxy Map</h2>
            {phase === "movement" && isMyTurn && selectedSystem && (
              <span style={{ color: "#9fb3c8" }}>
                Select units below, then click a connected destination.
              </span>
            )}
          </div>
          <GalaxyMap
            systems={systems}
            fleets={fleets}
            players={players}
            selectedSystemId={selectedSystemId}
            allowedDestSystemIds={allowedDestSystemIds}
            onSystemClick={handleSystemClick}
          />
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <section
            style={{
              background: "#0b1220",
              border: "1px solid #1f2a3d",
              borderRadius: "10px",
              padding: "1rem"
            }}
          >
            <h3 style={{ marginTop: 0 }}>Phase Actions</h3>
            {phase === "purchase" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {!me ? (
                  <p style={{ color: "#9fb3c8" }}>
                    Join the game to begin purchasing units and factories.
                  </p>
                ) : (
                  <>
                    <div style={{ color: "#cdd9ed" }}>
                      You have <strong>{me.resources}</strong> credits.
                    </div>
                    {myFactorySystems.length === 0 ? (
                      <p style={{ color: "#d96c75", margin: 0 }}>
                        You have no factories. Build one to start producing ships.
                      </p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <label>
                          Produce at
                          <select
                            value={selectedFactorySystemId ?? ""}
                            onChange={(e) =>
                              setSelectedFactorySystemId(e.target.value || null)
                            }
                            style={{ marginLeft: "0.35rem" }}
                          >
                            {myFactorySystems.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <label>
                            Unit
                            <select
                              value={selectedUnitType}
                              onChange={(e) => setSelectedUnitType(e.target.value as UnitType)}
                              style={{ marginLeft: "0.35rem" }}
                            >
                              {unitTypeList.map((ut) => (
                                <option key={ut} value={ut}>
                                  {UNIT_DEFS[ut].name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Count
                            <input
                              type="number"
                              min="1"
                              value={purchaseCount}
                              onChange={(e) => setPurchaseCount(e.target.value)}
                              style={{ marginLeft: "0.35rem", width: "80px" }}
                            />
                          </label>
                          <span>Cost: {totalCost}</span>
                          <button onClick={handlePurchase}>Purchase</button>
                        </div>
                        <p style={{ color: "#9fb3c8", margin: 0 }}>
                          New ships deploy automatically during the DEPLOY phase.
                        </p>
                      </div>
                    )}

                    <div style={{ borderTop: "1px solid #1f2a3d", paddingTop: "0.5rem" }}>
                      <h4 style={{ margin: "0 0 0.35rem" }}>Build Factory</h4>
                      {ownedSystemsWithoutFactory.length === 0 ? (
                        <p style={{ margin: 0, color: "#9fb3c8" }}>
                          No eligible systems without a factory.
                        </p>
                      ) : (
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <label>
                            Location
                            <select
                              value={factoryBuildSystemId ?? ""}
                              onChange={(e) => setFactoryBuildSystemId(e.target.value || null)}
                              style={{ marginLeft: "0.35rem" }}
                            >
                              {ownedSystemsWithoutFactory.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <span>Cost: {FACTORY_COST}</span>
                          <button onClick={handleBuildFactory}>Build</button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {phase === "movement" && (
              <div style={{ color: "#cdd9ed" }}>
                Select a system on the map, choose which ships to move, then click a connected destination.
              </div>
            )}

            {phase === "combat" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <p style={{ margin: 0, color: "#cdd9ed" }}>
                  Select a contested system and resolve every battle before proceeding.
                </p>
                <button
                  onClick={handleResolveCombat}
                  disabled={!hasCombat || !isMyTurn}
                >
                  Resolve Combat in Selected System
                </button>
              </div>
            )}

            {phase === "deploy" && (
              <p style={{ margin: 0, color: "#cdd9ed" }}>
                Newly purchased ships will deploy automatically. End the phase to pass the turn.
              </p>
            )}
          </section>

          <section
            style={{
              background: "#0b1220",
              border: "1px solid #1f2a3d",
              borderRadius: "10px",
              padding: "1rem"
            }}
          >
            <h3 style={{ marginTop: 0 }}>Selected System</h3>
            {!selectedSystem ? (
              <p style={{ color: "#9fb3c8" }}>Click a system on the map to inspect it.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div>
                  <strong>{selectedSystem.name}</strong>{" "}
                  <span style={{ color: "#9fb3c8" }}>
                    • Resources {selectedSystem.resourceValue} • Factory {" "}
                    {selectedSystem.hasShipyard ? "Yes" : "No"}
                  </span>
                  <div style={{ color: "#cdd9ed" }}>
                    Owner: {selectedSystemOwner ? selectedSystemOwner.displayName : "Unowned"}
                  </div>
                </div>

                <div>
                  <h4 style={{ margin: "0 0 0.35rem" }}>Fleets here</h4>
                  {systemUnitsByPlayer.length === 0 ? (
                    <p style={{ margin: 0, color: "#9fb3c8" }}>No ships present.</p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: "1rem" }}>
                      {systemUnitsByPlayer.map((entry) => (
                        <li key={entry.player?.id ?? "unknown"}>
                          <strong>{entry.player?.displayName ?? "Unknown"}</strong> — {entry.units.length} units
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {phase === "movement" &&
                  isMyTurn &&
                  me &&
                  myMovableUnitsAtSelected.length > 0 && (
                    <div style={{ borderTop: "1px solid #1f2a3d", paddingTop: "0.5rem" }}>
                      <h4 style={{ margin: "0 0 0.35rem" }}>Select ships to move</h4>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                        <button
                          onClick={() =>
                            setSelectedUnitIds(myMovableUnitsAtSelected.map((u) => u.id))
                          }
                        >
                          Select all
                        </button>
                        <button onClick={() => setSelectedUnitIds([])}>Clear</button>
                        <span style={{ color: "#9fb3c8" }}>
                          Selected: {selectedUnitIds.length}/{myMovableUnitsAtSelected.length}
                        </span>
                      </div>
                      <div
                        style={{
                          maxHeight: "200px",
                          overflow: "auto",
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                          gap: "0.35rem"
                        }}
                      >
                        {myMovableUnitsAtSelected.map((unit) => (
                          <label
                            key={unit.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              padding: "0.4rem 0.5rem",
                              borderRadius: "8px",
                              border: "1px solid #1f2a3d",
                              background: selectedUnitsSet.has(unit.id) ? "#1f2a3d" : "#0f172a"
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedUnitsSet.has(unit.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUnitIds((prev) => Array.from(new Set([...prev, unit.id])));
                                } else {
                                  setSelectedUnitIds((prev) => prev.filter((id) => id !== unit.id));
                                }
                              }}
                            />
                            <span>
                              {UNIT_DEFS[unit.type].name}
                              <span style={{ color: "#9fb3c8" }}>
                                {" "}• Move {unit.movementRemaining}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                      <p style={{ color: "#9fb3c8", marginTop: "0.4rem" }}>
                        After selecting, click a highlighted neighboring system on the map.
                      </p>
                    </div>
                  )}

                {phase === "combat" && hasCombat && (
                  <p style={{ color: "#d96c75", margin: 0 }}>
                    Combat pending in this system.
                  </p>
                )}
              </div>
            )}
          </section>

          <section
            style={{
              background: "#0b1220",
              border: "1px solid #1f2a3d",
              borderRadius: "10px",
              padding: "1rem"
            }}
          >
            <h3 style={{ marginTop: 0 }}>Players</h3>
            {players.length === 0 ? (
              <p style={{ color: "#9fb3c8" }}>No players yet.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "1rem" }}>
                {players.map((p) => (
                  <li key={p.id} style={{ marginBottom: "0.25rem" }}>
                    <strong>{p.displayName}</strong>
                    {p.id === gameState?.currentPlayerId && <span> — taking turn</span>}
                    <span style={{ color: "#9fb3c8" }}> • Credits {p.resources}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>

      <section
        style={{
          margin: "0 1rem 1rem",
          background: "#0b1220",
          border: "1px solid #1f2a3d",
          borderRadius: "10px",
          padding: "1rem"
        }}
      >
        <h3 style={{ marginTop: 0 }}>Systems Overview</h3>
        {systems.length === 0 ? (
          <p style={{ color: "#9fb3c8" }}>No systems defined.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#9fb3c8" }}>
                <th style={{ textAlign: "left", paddingBottom: "0.35rem" }}>Name</th>
                <th style={{ textAlign: "left", paddingBottom: "0.35rem" }}>Owner</th>
                <th style={{ textAlign: "left", paddingBottom: "0.35rem" }}>Resources</th>
                <th style={{ textAlign: "left", paddingBottom: "0.35rem" }}>Factory</th>
              </tr>
            </thead>
            <tbody>
              {systems.map((s) => {
                const owner = players.find((p) => p.id === s.ownerId);
                return (
                  <tr key={s.id} style={{ borderTop: "1px solid #1f2a3d" }}>
                    <td style={{ padding: "0.35rem 0" }}>{s.name}</td>
                    <td style={{ padding: "0.35rem 0", color: "#cdd9ed" }}>
                      {owner ? owner.displayName : "Unowned"}
                    </td>
                    <td style={{ padding: "0.35rem 0" }}>{s.resourceValue}</td>
                    <td style={{ padding: "0.35rem 0" }}>
                      {s.hasShipyard ? "Yes" : "No"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section
        style={{
          margin: "0 1rem 2rem",
          background: "#0b1220",
          border: "1px solid #1f2a3d",
          borderRadius: "10px",
          padding: "1rem"
        }}
      >
        <h3 style={{ marginTop: 0 }}>Game State (debug)</h3>
        {gameState?.lastCombatLog && gameState.lastCombatLog.length > 0 && (
          <div
            style={{
              background: "#111827",
              color: "#e8ecf0",
              padding: "0.5rem",
              marginBottom: "0.5rem",
              fontSize: "0.9em",
              borderRadius: "6px"
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
            background: "#020617",
            color: "#c9d3e6",
            padding: "1rem",
            maxHeight: "300px",
            overflow: "auto",
            borderRadius: "8px",
            border: "1px solid #1f2a3d"
          }}
        >
          {gameState ? JSON.stringify(gameState, null, 2) : "No game state yet"}
        </pre>
      </section>
    </div>
  );

};

export default App;
