export type PlayerID = string;
export type SystemID = string;
export type FleetID = string;
export type GameID = string;

export type UnitType = "fighter" | "destroyer" | "cruiser" | "battleship" | "carrier" | "transport";

export interface Unit {
  id: string;
  type: UnitType;
}

export interface StarSystem {
  id: SystemID;
  name: string;
  ownerId: PlayerID | null;
  resourceValue: number;
  connectedSystems: SystemID[];
  hasShipyard: boolean;
}

export interface Fleet {
  id: FleetID;
  ownerId: PlayerID;
  locationSystemId: SystemID;
  units: Unit[];
}

export interface PlayerState {
  id: PlayerID;
  displayName: string;
  resources: number;
  homeSystems: SystemID[];
}

export type TurnPhase = "income" | "purchase" | "movement" | "combat" | "deploy";

export interface GameState {
  id: GameID;
  players: PlayerState[];
  systems: StarSystem[];
  fleets: Fleet[];
  currentPlayerId: PlayerID;
  phase: TurnPhase;
  round: number;
}
