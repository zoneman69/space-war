import { io, Socket } from "socket.io-client";
import { GameState } from "@space-war/shared/types";

const socket: Socket = io("http://localhost:4000");

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
