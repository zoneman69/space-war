import { io, Socket } from "socket.io-client";
import { GameState } from "@space-war/shared";

let socket: Socket;

// Use whatever host the page was loaded from
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

export function endTurn() {
  socket.emit("endTurn");
}
