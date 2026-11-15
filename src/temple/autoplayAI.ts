import type { ExplorerAction } from './explorerModel';
import type { TempleChunk } from './worldGenerator';

export interface AIDecision {
  targetLane: number;
  wantJump: boolean;
  wantSlide: boolean;
  statusLabel: string;
}

/**
 * Deterministic lookahead AI planner:
 * - Looks 0..24m ahead (-Z) across all active chunks.
 * - Detects mandatory chasm gaps and triggers jump right at takeoff window.
 * - Evaluates safety & coin reward across all 3 lanes to dodge obstacles cleanly.
 * - Triggers slide cleanly underneath high barriers when in or choosing a barrier lane.
 */
export function computeAutoplayDecision(params: {
  playerZ: number;
  playerY: number;
  currentLane: number;
  action: ExplorerAction;
  runSpeed: number;
  doubleJumpsLeft?: number;
  chunks: readonly TempleChunk[];
}): AIDecision {
  const { playerZ, playerY, currentLane, action, runSpeed, doubleJumpsLeft = 0, chunks } = params;
  const isGrounded = playerY <= 0.04;

  let wantJump = false;
  let wantSlide = false;
  let statusLabel = 'Sprinting';

  // 1. Check for upcoming chasm gaps (mandatory jump + optional double-jump safety!)
  const takeoffWindow = Math.max(2.3, runSpeed * 0.21);
  for (const chunk of chunks) {
    if (!chunk.gap) continue;
    const distToGap = playerZ - chunk.gap.zStart; // positive while approaching gap
    if (distToGap > -0.2 && distToGap < takeoffWindow) {
      if (isGrounded && action !== 'jump') {
        wantJump = true;
      }
      statusLabel = 'Jumping Chasm';
      let coinLane = currentLane;
      for (const c of chunk.coins) {
        if (!c.collected && c.z <= chunk.gap.zStart + 0.5 && c.z >= chunk.gap.zEnd - 0.5) {
          coinLane = c.lane;
          break;
        }
      }
      return {
        targetLane: coinLane,
        wantJump,
        wantSlide: false,
        statusLabel,
      };
    }
    if (playerZ <= chunk.gap.zStart && playerZ >= chunk.gap.zEnd && playerY < 0.25 && doubleJumpsLeft > 0) {
      return {
        targetLane: currentLane,
        wantJump: true,
        wantSlide: false,
        statusLabel: 'Double Vault',
      };
    }
  }

  // 2. Gather upcoming obstacles in lookahead horizon (0..22m ahead)
  const lookahead = 22;
  const laneScores = [0, 0, 0];

  // Slight preference for staying steady unless dodging or grabbing coins/pads
  laneScores[currentLane] += 0.45;

  let immediateLowThreatInLane = false;
  let immediateHighThreatInLane = false;

  for (const chunk of chunks) {
    // Score reachable coins ahead to attract AI toward golden lines
    for (const coin of chunk.coins) {
      if (coin.collected) continue;
      const dist = playerZ - coin.z;
      if (dist > 0.6 && dist < lookahead) {
        laneScores[coin.lane] += (1 - dist / lookahead) * 2.2;
      }
    }

    // Score Golden Boost Pads
    for (const pad of chunk.boostPads) {
      if (pad.triggered) continue;
      const dist = playerZ - pad.z;
      if (dist > 0.5 && dist < lookahead) {
        laneScores[pad.lane] += (1 - dist / lookahead) * 3.4;
      }
    }

    // Score Speed, Shield, and Magnet power-up relics higher
    for (const pu of chunk.powerUps) {
      if (pu.collected) continue;
      const dist = playerZ - pu.z;
      if (dist > 0.6 && dist < lookahead) {
        laneScores[pu.lane] += (1 - dist / lookahead) * 4.6;
      }
    }

    for (const obs of chunk.obstacles) {
      const dist = playerZ - (obs.z + obs.halfDepth); // distance to front face
      if (dist < -0.7 || dist > lookahead) continue;

      const urgency = 1 - Math.max(0, dist) / lookahead;

      if (obs.kind === 'low_block') {
        for (const l of obs.lanes) {
          laneScores[l] -= 14 * (0.45 + urgency * 1.4);
          if (l === currentLane && dist < 4.2 && dist > -0.25) {
            immediateLowThreatInLane = true;
          }
        }
      } else if (obs.kind === 'high_barrier') {
        const isFullWidth = obs.lanes.length === 3;
        for (const l of obs.lanes) {
          if (!isFullWidth) {
            laneScores[l] -= 3.5 * (0.4 + urgency);
          }
          if (l === currentLane && dist < Math.max(3.6, runSpeed * 0.28) && dist > -0.45) {
            immediateHighThreatInLane = true;
          }
        }
      }
    }
  }

  // Pick highest scoring lane
  let bestLane = currentLane;
  let bestScore = laneScores[currentLane];
  for (let l = 0; l < 3; l++) {
    if (laneScores[l] > bestScore + 0.15) {
      bestScore = laneScores[l];
      bestLane = l;
    }
  }

  // Trigger dodge actions if obstacle is right in front of current lane
  if (immediateHighThreatInLane && action !== 'jump') {
    wantSlide = true;
    statusLabel = 'Sliding Barrier';
  } else if (immediateLowThreatInLane && bestLane === currentLane) {
    if (isGrounded || doubleJumpsLeft > 0) {
      wantJump = true;
      statusLabel = isGrounded ? 'Vaulting Block' : 'Double Vault';
    }
  } else if (bestLane !== currentLane) {
    statusLabel = bestLane < currentLane ? 'Dodging Left' : 'Dodging Right';
  }

  return {
    targetLane: bestLane,
    wantJump,
    wantSlide,
    statusLabel,
  };
}
