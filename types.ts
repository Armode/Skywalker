
export type Direction = 'CW' | 'CCW';
export type Sign = 1 | -1 | 0; // 0 represents the baton

export interface TileState {
  id: string;
  name: string;
  sign: Sign;
  buffer: Sign;
  shadow: number;
}

export interface PersonalityScore {
  optimistic: number;
  protective: number;
  curious: number;
  reflective: number;
  compassionate: number;
  peaceful: number;
}

export interface SimulationState {
  tiles: TileState[];
  batonPos: number;
  direction: Direction;
  ttl: number;
  failCount: number;
  isParked: boolean;
  parkTicks: number;
  isWarmup: boolean;
  history: string[];
  step: number;
  // Scan & Sort states
  isScanning: boolean;
  scanIdx: number;
  isSorting: boolean;
  lastScanReport?: {
    stability: number;
    entropy: number;
    anomalies: string[];
  };
  // Discovery metrics
  personality: PersonalityScore;
  interactionCount: number;
  discoveredTrait?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}
