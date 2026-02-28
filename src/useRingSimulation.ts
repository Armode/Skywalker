import { useState, useCallback } from 'react';
import { SimulationState, TileState, Sign } from './types';
import { TILES_CONFIG, MAX_SHADOW, HESITATION_STRENGTH as DEFAULT_HESITATION, PARK_DURATION as DEFAULT_PARK, FAIL_LIMIT as DEFAULT_FAIL_LIMIT, INITIAL_TTL as DEFAULT_TTL } from './constants';

export function useRingSimulation(initialDirection: 'CW' | 'CCW', config: any) {
  const [state, setState] = useState<SimulationState>(() => {
    const tiles: TileState[] = TILES_CONFIG.map((conf, i) => ({
      id: `tile-${i}`,
      name: conf.name,
      sign: i === 0 ? 0 : conf.domain,
      buffer: conf.domain,
      shadow: 0
    }));
    return {
      tiles,
      batonPos: 0,
      direction: initialDirection,
      ttl: config.initialTtl,
      failCount: 0,
      isParked: false,
      parkTicks: 0,
      isWarmup: true,
      history: ['System Initialized: Baton at A'],
      step: 0,
      isScanning: false,
      scanIdx: -1,
      isSorting: false,
      gravityAnchor: config.gravityAnchor,
      isTraversalLatchActive: false,
      bLoopActive: false,
      angularVelocity: 0,
      interactionCount: 0,
      personality: {
        optimistic: 0,
        protective: 0,
        curious: 0,
        reflective: 0,
        compassionate: 0,
        peaceful: 0
      }
    } as SimulationState;
  });

  const triggerScan = useCallback(() => {
    if (state.isScanning || state.isSorting) return;
    setState(prev => ({
      ...prev,
      isScanning: true,
      scanIdx: 0,
      history: [...prev.history, "Initiating Logic-Shear scan..."]
    }));
  }, [state.isScanning, state.isSorting]);

  const triggerSort = useCallback(() => {
    if (state.isScanning || state.isSorting) return;
    setState(prev => ({
      ...prev,
      isSorting: true,
      history: [...prev.history, "Initiating Phase Inversion (TRV_LCH)..."]
    }));

    setTimeout(() => {
      setState(prev => {
        const sortedTiles = [...prev.tiles].map(t => ({
          ...t,
          shadow: 0
        }));
        return {
          ...prev,
          tiles: sortedTiles,
          isSorting: false,
          history: [...prev.history, "Optimization Complete: Shadows cleared."]
        };
      });
    }, 1500);
  }, [state.isScanning, state.isSorting]);

  const triggerBLoop = useCallback(() => {
    if (config.gravityAnchor === 1.0) {
      setState(prev => ({
        ...prev,
        bLoopActive: true,
        isTraversalLatchActive: true,
        history: [...prev.history, "B-Loop Triggered: TRV_LCH Engaged. Spacetime Superfluidity Reached."]
      }));
    } else {
      setState(prev => ({
        ...prev,
        history: [...prev.history, "B-Loop Failed: Gravity Anchor must be exactly 1.0G to prevent Logic-Shatter."]
      }));
    }
  }, [config.gravityAnchor]);

  const nextStep = useCallback(() => {
    setState(prev => {
      if (prev.ttl <= 0 || prev.isSorting) return prev;

      if (prev.isScanning) {
        if (prev.scanIdx < 5) {
          return { ...prev, scanIdx: prev.scanIdx + 1 };
        } else {
          const shadowSum = prev.tiles.reduce((acc, t) => acc + t.shadow, 0);
          const domainMismatches = prev.tiles.filter(t => t.sign !== 0 && t.sign !== t.buffer).length;
          const report = {
            stability: Math.max(0, 100 - (shadowSum * 10) - (domainMismatches * 20)),
            entropy: shadowSum / 10,
            anomalies: domainMismatches > 0 ? [`${domainMismatches} domain inversions.`] : ["Clean structural check."]
          };
          return {
            ...prev,
            isScanning: false,
            scanIdx: -1,
            lastScanReport: report,
            history: [...prev.history, `Scan: Spacetime Stability @ ${report.stability}% | E%^F @ ${report.entropy}`]
          };
        }
      }

      let newHistory = [...prev.history];
      let newTiles = prev.tiles.map(t => ({ ...t, shadow: prev.isTraversalLatchActive ? 0 : Math.max(0, t.shadow - 1) }));
      let newBatonPos = prev.batonPos;
      let newDirection = prev.direction;
      let newIsWarmup = prev.isWarmup;
      let newTtl = prev.ttl;
      let newFailCount = prev.failCount;
      let newIsParked = prev.isParked;
      let newParkTicks = prev.parkTicks;

      if (newIsParked) {
        if (newParkTicks > 1) {
          return { ...prev, tiles: newTiles, parkTicks: newParkTicks - 1, step: prev.step + 1 };
        } else {
          newIsParked = false;
          newParkTicks = 0;
          newHistory.push("Resuming from park.");
        }
      }

      // Clear current sign from old position
      const oldTileIdx = newBatonPos;
      newTiles[oldTileIdx] = { ...newTiles[oldTileIdx], sign: TILES_CONFIG[oldTileIdx].domain };

      // Move baton
      if (newDirection === 'CW') {
        newBatonPos = (newBatonPos + 1) % 6;
      } else {
        newBatonPos = (newBatonPos + 5) % 6;
      }

      const currentTile = newTiles[newBatonPos];
      
      // Action Tile Logic
      if (currentTile.name === 'C') {
        if (newIsWarmup) {
          newIsWarmup = false;
          newHistory.push("Baton at C: Warmup Jump completed.");
        } else {
          const b = newTiles[1];
          const d = newTiles[3];
          if (b.sign + d.sign === 0) {
            newTtl -= 1;
            newFailCount = 0;
            newTiles[1] = { ...newTiles[1], shadow: Math.min(MAX_SHADOW, newTiles[1].shadow + 2) };
            newTiles[3] = { ...newTiles[3], shadow: Math.min(MAX_SHADOW, newTiles[3].shadow + 2) };
            newHistory.push("Baton at C: ACT SUCCESS. Neighbors aligned.");
          } else {
            newFailCount += 1;
            newDirection = newDirection === 'CW' ? 'CCW' : 'CW';
            newTiles[2] = { ...newTiles[2], shadow: Math.min(MAX_SHADOW, newTiles[2].shadow + config.hesitationStrength) };
            newHistory.push(`Baton at C: ACT FAILED (${newFailCount}/${config.failLimit}). Reversing. H-Factor increased.`);
            
            if (newFailCount >= config.failLimit) {
              newIsParked = true;
              newParkTicks = config.parkDuration;
              newTiles[2] = { ...newTiles[2], buffer: (newTiles[2].buffer === 1 ? -1 : 1) as Sign };
              newFailCount = 0;
              newHistory.push("Escalation: CRITICAL FAILURE. Parking and Phase Flipping C.");
            }
          }
        }
      }

      // Mark new baton position
      newTiles[newBatonPos] = { ...newTiles[newBatonPos], sign: 0 };

      return {
        ...prev,
        tiles: newTiles,
        batonPos: newBatonPos,
        direction: newDirection,
        ttl: newTtl,
        failCount: newFailCount,
        isParked: newIsParked,
        parkTicks: newParkTicks,
        isWarmup: newIsWarmup,
        history: newHistory.slice(-50),
        step: prev.step + 1
      };
    });
  }, [config]);

  const reset = useCallback(() => {
    setState(prev => {
      const tiles: TileState[] = TILES_CONFIG.map((conf, i) => ({
        id: `tile-${i}`,
        name: conf.name,
        sign: i === 0 ? 0 : conf.domain,
        buffer: conf.domain,
        shadow: 0
      }));
      return {
        ...prev,
        tiles,
        batonPos: 0,
        direction: initialDirection,
        ttl: config.initialTtl,
        failCount: 0,
        isParked: false,
        parkTicks: 0,
        isWarmup: true,
        history: ['System Reset Triggered'],
        step: 0,
        isScanning: false,
        isSorting: false,
        isTraversalLatchActive: false,
        bLoopActive: false
      };
    });
  }, [config.initialTtl, initialDirection]);

  return { state, setState, triggerScan, triggerSort, triggerBLoop, nextStep, reset };
}
