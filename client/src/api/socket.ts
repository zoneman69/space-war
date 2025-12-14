import { io, Socket } from "socket.io-client";
import { GameState, UnitType } from "@space-war/shared";

let socket: Socket;

const host = window.location.hostname;
const devUrl = `http://${host}:4000`;

socket = io(devUrl);

export function initSocket(
  onGameState: (state: GameState) => void
) {
  socket.on("connect", () => {
    console.log("Connected to server:", socket.id);
  });

  socket.on("gameState", (state: GameState) => {
    console.log("Received game state:", state);
    onGameState(state);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
  });
}

export function joinGame(playerName: string) {
  socket.emit("joinGame", playerName);
}

export function startGame() {
  socket.emit("startGame");
}

export function endTurn(playerName: string) {
  console.log("Emitting endTurn with playerName:", playerName);
  socket.emit("endTurn", { playerName });
}

export function purchaseUnits(
  playerName: string,
  unitType: UnitType,
  count: number,
  systemId: string
) {
  socket.emit("purchaseUnits", { playerName, unitType, count, systemId });
}

export function moveFleet(
  playerName: string,
  fromSystemId: string,
  toSystemId: string,
  unitIds: string[]
) {
  socket.emit("moveFleet", { playerName, fromSystemId, toSystemId, unitIds });
}


export function resolveCombat(systemId: string) {
  socket.emit("resolveCombat", systemId);
}

export function buildFactory(playerName: string, systemId: string) {
  socket.emit("buildFactory", { playerName, systemId });
}
