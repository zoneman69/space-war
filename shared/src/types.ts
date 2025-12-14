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
  movementRemaining: number;
}


export interface StarSystem {
  id: SystemID;
  name: string;
  ownerId: PlayerID | null;
  resourceValue: number;
  connectedSystems: SystemID[];
  hasShipyard: boolean; // Factory/shipyard
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
  | "purchase"
  | "movement"
  | "combat"
  | "deploy";

export interface PendingPurchase {
  id: string;
  playerId: PlayerID;
  systemId: SystemID;
  unitType: UnitType;
  count: number;
}

export interface GameState {
  id: GameID;
  players: PlayerState[];
  systems: StarSystem[];
  fleets: Fleet[];
  currentPlayerId: PlayerID;
  phase: TurnPhase;
  round: number;
  lastCombatLog?: string[];
  pendingPurchases: PendingPurchase[];

  // NEW
  winnerPlayerId?: PlayerID;
  eliminatedPlayerIds: PlayerID[];
}


export const UNIT_DEFS: Record<
  UnitType,
  { name: string; cost: number; attack: number; defense: number; movement: number }
> = {
  fighter:    { name: "Fighter",    cost: 6,  attack: 3, defense: 3, movement: 2 },
  destroyer:  { name: "Destroyer",  cost: 8,  attack: 3, defense: 4, movement: 2 },
  cruiser:    { name: "Cruiser",    cost: 12, attack: 4, defense: 4, movement: 2 },
  battleship: { name: "Battleship", cost: 18, attack: 4, defense: 5, movement: 1 },
  carrier:    { name: "Carrier",    cost: 14, attack: 2, defense: 4, movement: 1 },
  transport:  { name: "Transport",  cost: 7,  attack: 1, defense: 1, movement: 2 }
};

