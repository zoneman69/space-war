export type PlayerID = string;
export type SystemID = string;
export type FleetID = string;
export type GameID = string;

export type UnitType =
  | "fighter"
  | "destroyer"
  | "cruiser"
  | "battleship"
  | "carrier"
  | "transport";

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

export type TurnPhase =
  | "income"
  | "purchase"
  | "movement"
  | "combat"
  | "deploy";

export interface GameState {
  id: GameID;
  players: PlayerState[];
  systems: StarSystem[];
  fleets: Fleet[];
  currentPlayerId: PlayerID;
  phase: TurnPhase;
  round: number;
  lastCombatLog?: string[]; // optional text log of last combat
}

// Simple unit definitions with costs + combat stats
export const UNIT_DEFS: Record<
  UnitType,
  { name: string; cost: number; attack: number; defense: number }
> = {
  fighter:    { name: "Fighter",    cost: 6,  attack: 3, defense: 3 },
  destroyer:  { name: "Destroyer",  cost: 8,  attack: 3, defense: 4 },
  cruiser:    { name: "Cruiser",    cost: 12, attack: 4, defense: 4 },
  battleship: { name: "Battleship", cost: 18, attack: 4, defense: 5 },
  carrier:    { name: "Carrier",    cost: 14, attack: 2, defense: 4 },
  transport:  { name: "Transport",  cost: 7,  attack: 1, defense: 1 }
};
