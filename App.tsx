
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Activity, Shield, Hash, ArrowRight, Zap, Info, 
  Settings, X, SlidersHorizontal, Loader2, PlayCircle, StopCircle, 
  Hourglass, Monitor, MapPin, Gauge, Search, LayoutGrid, CheckCircle2, Heart,
  Cloud, Mic, Globe, MicOff, Volume2, ArrowRightCircle, ArrowLeftCircle, Terminal
} from 'lucide-react';
import { SimulationState, Direction, TileState, Sign, PersonalityScore } from './types';
import { 
  TILES_CONFIG, 
  MAX_SHADOW, 
  HESITATION_STRENGTH as DEFAULT_HESITATION, 
  PARK_DURATION as DEFAULT_PARK, 
  FAIL_LIMIT as DEFAULT_FAIL_LIMIT, 
  INITIAL_TTL as DEFAULT_TTL 
} from './services/constants';
import Tile from './components/Tile';
import ChatPanel from './ChatPanel';
import { GeminiLiveSession } from './services/live-session';

const ConfigInput: React.FC<{
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}> = ({ label, description, value, min, max, onChange }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</label>
      <span className="text-xs font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">{value}</span>
    </div>
    <p className="text-[10px] text-gray-500 leading-tight">{description}</p>
    <input 
      type="range" 
      min={min} 
      max={max} 
      value={value} 
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
    />
  </div>
);

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; color?: string }> = ({ icon, label, value, color = 'text-gray-300' }) => (
  <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 backdrop-blur-md flex items-center gap-3 w-36 shadow-xl pointer-events-auto">
    <div className="p-2 bg-gray-800 rounded-lg text-amber-500 shrink-0">
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-[9px] text-gray-500 font-bold uppercase tracking-tight">{label}</div>
      <div className={`text-sm font-mono font-bold truncate ${color}`}>{value}</div>
    </div>
  </div>
);

const DiagnosticItem: React.FC<{ icon: React.ReactNode; label: string; value: string; color?: string }> = ({ icon, label, value, color = 'text-gray-300' }) => (
  <div className="space-y-1">
    <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-bold uppercase">
      {icon}
      <span>{label}</span>
    </div>
    <div className={`text-xs font-medium truncate ${color}`}>
      {value}
    </div>
  </div>
);

const App: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'active' | 'inactive'>('inactive');
  const [audioLevel, setAudioLevel] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const liveSessionRef = useRef<GeminiLiveSession | null>(null);

  const [config, setConfig] = useState({
    hesitationStrength: DEFAULT_HESITATION,
    parkDuration: DEFAULT_PARK,
    failLimit: DEFAULT_FAIL_LIMIT,
    initialTtl: DEFAULT_TTL
  });

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
      direction: 'CW',
      ttl: DEFAULT_TTL,
      failCount: 0,
      isParked: false,
      parkTicks: 0,
      isWarmup: true,
      history: ['System Initialized: Baton at A'],
      step: 0,
      isScanning: false,
      scanIdx: -1,
      isSorting: false,
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
    setIsPlaying(false);
    setState(prev => ({
      ...prev,
      isScanning: true,
      scanIdx: 0,
      history: [...prev.history, "Initiating full-ring heuristic scan..."]
    }));
  }, [state.isScanning, state.isSorting]);

  const triggerSort = useCallback(() => {
    if (state.isScanning || state.isSorting) return;
    setIsPlaying(false);
    setState(prev => ({
      ...prev,
      isSorting: true,
      history: [...prev.history, "Initiating domain realignment (Sort operation)..."]
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

  const updatePersonalityFromInteraction = useCallback((aiMood: string) => {
    setState(prev => {
      const nextPersonality = { ...prev.personality };
      if (aiMood === 'joyful' || aiMood === 'inspired') nextPersonality.optimistic += 1;
      else if (aiMood === 'protective') nextPersonality.protective += 1;
      else if (aiMood === 'curious') nextPersonality.curious += 1;
      else if (aiMood === 'thoughtful') nextPersonality.reflective += 1;
      else if (aiMood === 'caring' || aiMood === 'compassionate') nextPersonality.compassionate += 1;
      else if (aiMood === 'peaceful' || aiMood === 'calm') nextPersonality.peaceful += 1;

      const nextInteractionCount = prev.interactionCount + 1;
      let discoveredTrait = prev.discoveredTrait;

      if (nextInteractionCount % 5 === 0) {
        discoveredTrait = Object.entries(nextPersonality).reduce((a: any, b: any) => a[1] > b[1] ? a : b)[0];
      }

      return {
        ...prev,
        personality: nextPersonality,
        interactionCount: nextInteractionCount,
        discoveredTrait
      };
    });
  }, []);

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
            history: [...prev.history, `Scan: Stability @ ${report.stability}%`]
          };
        }
      }

      let newHistory = [...prev.history];
      let newTiles = prev.tiles.map(t => ({ ...t, shadow: Math.max(0, t.shadow - 1) }));
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
            newHistory.push(`Baton at C: ACT FAILED (${newFailCount}/${config.failLimit}). Reversing.`);
            
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

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        nextStep();
      }, speed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, speed, nextStep]);

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
        direction: 'CW',
        ttl: config.initialTtl,
        failCount: 0,
        isParked: false,
        parkTicks: 0,
        isWarmup: true,
        history: ['System Reset Triggered'],
        step: 0,
        isScanning: false,
        isSorting: false
      };
    });
    setIsPlaying(false);
  }, [config.initialTtl]);

  const toggleLive = () => {
    if (liveStatus === 'active') {
      liveSessionRef.current?.stop();
    } else {
      const session = new GeminiLiveSession({
        onStatusChange: setLiveStatus,
        onTranscript: (text, isUser) => {
          if (isUser) setLiveTranscript(text);
        },
        onToolCall: (name) => {
          if (name === 'runSystemScan') triggerScan();
          if (name === 'optimizeRingDomains') triggerSort();
        },
        onVolume: (level) => {
          setAudioLevel(level);
        }
      });
      liveSessionRef.current = session;
      session.start();
    }
  };

  return (
    <div className="flex h-screen bg-black text-white font-sans selection:bg-amber-500/30 overflow-hidden">
      <div className="flex-1 relative flex flex-col">
        <div className="p-6 flex justify-between items-center z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.4)]">
              <Zap className="text-black fill-black" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter uppercase italic">Ana v1</h1>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold">
                <Activity size={10} className="text-green-500" />
                RING POLARITY: {state.isWarmup ? 'WARMUP' : 'ACTIVE'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={toggleLive}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-xs uppercase transition-all ${
                liveStatus === 'active' 
                  ? 'bg-red-500/10 border-red-500/50 text-red-500 animate-pulse' 
                  : 'bg-amber-500/10 border-amber-500/50 text-amber-500'
              }`}
            >
              {liveStatus === 'connecting' ? <Loader2 className="animate-spin" size={14} /> : (liveStatus === 'active' ? <MicOff size={14} /> : <Mic size={14} />)}
              {liveStatus === 'active' ? 'Stop Live' : 'Start Live'}
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white transition-colors"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center relative">
          <div className="absolute w-[400px] h-[400px] border border-gray-800/50 rounded-full" />
          <div className="absolute w-[200px] h-[200px] border border-gray-800/30 rounded-full" />
          
          <div className="relative w-[400px] h-[400px]">
            {state.tiles.map((tile, i) => {
              const angle = (i * 60 - 90) * (Math.PI / 180);
              const radius = 180;
              const x = radius * Math.cos(angle) + 200;
              const y = radius * Math.sin(angle) + 200;
              const isScanned = state.isScanning && state.scanIdx === i;

              return (
                <React.Fragment key={tile.id}>
                  <Tile 
                    tile={tile} 
                    isBaton={state.batonPos === i} 
                    x={x} 
                    y={y} 
                  />
                  {isScanned && (
                    <div 
                      className="absolute w-28 h-28 rounded-2xl border-2 border-cyan-400/50 bg-cyan-400/5 shadow-[0_0_30px_rgba(34,211,238,0.2)] animate-pulse pointer-events-none z-0"
                      style={{ 
                        left: `${x}px`, 
                        top: `${y}px`,
                        transform: 'translate(-50%, -50%)' 
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          
          <div className="absolute text-center z-0 pointer-events-none flex flex-col items-center justify-center transition-all duration-300">
            {state.isScanning ? (
              <>
                <Loader2 className="text-cyan-500 animate-spin mb-3 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]" size={48} />
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-[0.2em] mb-1 animate-pulse">System Scan</div>
                <div className="text-4xl font-black italic tracking-tighter text-cyan-100 drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                  {state.scanIdx >= 0 && state.scanIdx < TILES_CONFIG.length ? `SECTOR ${TILES_CONFIG[state.scanIdx].name}` : 'INIT'}
                </div>
              </>
            ) : state.isSorting ? (
              <>
                <Loader2 className="text-purple-500 animate-spin mb-3 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]" size={48} />
                <div className="text-[10px] text-purple-400 font-bold uppercase tracking-[0.2em] mb-1 animate-pulse">Optimizing</div>
                <div className="text-4xl font-black italic tracking-tighter text-purple-100 drop-shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                  SORTING
                </div>
              </>
            ) : (
              <>
                <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-2">System Phase</div>
                <div className={`text-5xl font-black italic tracking-tighter transition-colors duration-500 ${
                  state.isParked ? 'text-red-900/80' : 
                  state.isWarmup ? 'text-yellow-900/50' : 
                  'text-gray-800'
                }`}>
                  {state.isParked ? 'PARKED' : (state.isWarmup ? 'JUMP' : 'ACT')}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-8 flex justify-center gap-4 z-20">
          <div className="flex bg-gray-900/80 border border-gray-800 rounded-2xl p-1 backdrop-blur-xl shadow-2xl">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs uppercase transition-all ${
                isPlaying ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'
              }`}
            >
              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              {isPlaying ? 'Pause' : 'Play Simulation'}
            </button>
            <button 
              onClick={reset}
              className="p-3 text-gray-400 hover:text-white transition-colors"
            >
              <RotateCcw size={20} />
            </button>
          </div>
        </div>
        
        <div className="absolute bottom-8 left-8 flex flex-col gap-3 z-20">
          <StatCard icon={<Hash size={16} />} label="Step" value={state.step} />
          <StatCard icon={<Hourglass size={16} />} label="TTL" value={state.ttl} color={state.ttl < 2 ? 'text-red-400' : 'text-blue-400'} />
          <StatCard icon={<Shield size={16} />} label="Fails" value={state.failCount} />
        </div>

        <div className="absolute bottom-8 right-8 flex flex-col gap-3 z-20">
           <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 backdrop-blur-xl shadow-2xl w-56 pointer-events-auto">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
                 <div className="flex items-center gap-2">
                    <Monitor size={16} className="text-cyan-500" />
                    <span className="text-xs font-black text-white uppercase tracking-wider">System State</span>
                 </div>
                 <div className={`w-2 h-2 rounded-full ${state.isParked ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <DiagnosticItem 
                    icon={<MapPin size={12} />} 
                    label="Position" 
                    value={`Tile ${state.tiles[state.batonPos].name}`} 
                    color="text-amber-400" 
                 />
                 <DiagnosticItem 
                    icon={<ArrowRightCircle size={12} className={state.direction === 'CCW' ? 'rotate-180' : ''}/>} 
                    label="Direction" 
                    value={state.direction} 
                 />
                 <DiagnosticItem 
                    icon={<Activity size={12} />} 
                    label="Mode" 
                    value={state.isWarmup ? 'WARMUP' : 'ACTIVE'} 
                    color={state.isWarmup ? 'text-yellow-400' : 'text-emerald-400'}
                 />
                 <DiagnosticItem 
                    icon={<Zap size={12} />} 
                    label="Park Status" 
                    value={state.isParked ? `PARKED (${state.parkTicks})` : 'OPERATIONAL'} 
                    color={state.isParked ? 'text-red-400' : 'text-gray-400'}
                 />
                  <DiagnosticItem 
                    icon={<Hourglass size={12} />} 
                    label="TTL" 
                    value={`${state.ttl}`} 
                    color={state.ttl < 2 ? 'text-red-400' : 'text-blue-300'}
                 />
                  <DiagnosticItem 
                    icon={<Shield size={12} />} 
                    label="Fail Count" 
                    value={`${state.failCount} / ${config.failLimit}`} 
                    color={state.failCount > 0 ? 'text-orange-400' : 'text-gray-400'}
                 />
              </div>
           </div>
        </div>
      </div>

      <ChatPanel 
        simState={state} 
        onScan={triggerScan} 
        onSort={triggerSort} 
        onInteraction={updatePersonalityFromInteraction}
        liveStatus={liveStatus}
        audioLevel={audioLevel}
        liveTranscript={liveTranscript}
      />

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-3xl p-8 shadow-2xl relative">
            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-6 right-6 text-gray-500 hover:text-white"
            >
              <X size={24} />
            </button>
            <h2 className="text-2xl font-black italic tracking-tighter uppercase mb-8">Simulation Config</h2>
            <div className="space-y-8">
              <ConfigInput 
                label="Hesitation Strength" 
                description="Intensity of shadows generated on failure."
                min={1} max={6} value={config.hesitationStrength} 
                onChange={(v) => setConfig(prev => ({ ...prev, hesitationStrength: v }))} 
              />
              <ConfigInput 
                label="Park Duration" 
                description="Ticks to wait after critical failure."
                min={2} max={10} value={config.parkDuration} 
                onChange={(v) => setConfig(prev => ({ ...prev, parkDuration: v }))} 
              />
              <ConfigInput 
                label="Fail Limit" 
                description="Failures before escalation/park."
                min={1} max={5} value={config.failLimit} 
                onChange={(v) => setConfig(prev => ({ ...prev, failLimit: v }))} 
              />
              <ConfigInput 
                label="Initial TTL" 
                description="Starting energy (acts) for the baton."
                min={1} max={10} value={config.initialTtl} 
                onChange={(v) => setConfig(prev => ({ ...prev, initialTtl: v }))} 
              />
              <ConfigInput 
                label="Speed (ms)" 
                description="Tick interval duration."
                min={100} max={2000} value={speed} 
                onChange={setSpeed} 
              />
            </div>
            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="w-full mt-10 bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-amber-500 transition-colors"
            >
              Apply Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
