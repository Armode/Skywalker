import { TileState, Sign } from '../types';

export const TILES_CONFIG = [
  { name: 'A', domain: 1 as Sign },
  { name: 'B', domain: 1 as Sign },
  { name: 'C', domain: 1 as Sign },
  { name: 'D', domain: -1 as Sign },
  { name: 'E', domain: -1 as Sign },
  { name: 'F', domain: -1 as Sign },
];

export const MAX_SHADOW = 6;
export const HESITATION_STRENGTH = 3;
export const PARK_DURATION = 5;
export const FAIL_LIMIT = 3;
export const INITIAL_TTL = 3;

export const SYSTEM_PROMPT = `You are an AI assistant specialized in the "Ana v1" simulation. 
This simulation consists of a 6-tile ring (A-F).
A, B, C are in the (+) domain.
D, E, F are in the (-) domain.

A "baton" (state 0) moves between tiles CW or CCW.
Tile C is the "Action" tile. When the baton arrives:
1. First arrival is a "Jump" (warmup).
2. Subsequent arrivals are "Acts".
3. An Act succeeds if neighbors (B and D) satisfy a strict boundary condition: eff(Left) + eff(Right) == 0.
4. Success: Mirrors pulse (Shadows on B&D), TTL decreases.
5. Failure: Reverses direction, increases "Hesitation" shadow at C.
6. Escalation: After 3 consecutive failures, the baton PARKS for several ticks and flips the buffer of C to force a phase change.

You help users understand the system dynamics, explain why certain acts failed, and provide insights into the emergent behavior of the polarized ring.
Always be technical, precise, yet accessible.`;