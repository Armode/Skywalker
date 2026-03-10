
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Activity, Shield, Hash, ArrowRight, Zap, Info, 
  Settings, X, SlidersHorizontal, Loader2, PlayCircle, StopCircle, 
  Hourglass, Monitor, MapPin, Gauge, Search, LayoutGrid, CheckCircle2, Heart,
  Cloud, Mic, Globe, MicOff, Volume2, ArrowRightCircle, ArrowLeftCircle, Terminal,
  Infinity, Rocket, Anchor
} from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
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
import { useRingSimulation } from './useRingSimulation';

const ConfigInput: React.FC<{
  label: string;
  description: string;
  value: number;
  displayValue?: string | number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}> = ({ label, description, value, displayValue, min, max, onChange }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</label>
      <span className="text-xs font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">{displayValue ?? value}</span>
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

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; color?: string; tooltip?: string }> = ({ icon, label, value, color = 'text-gray-300', tooltip }) => (
  <div className="group relative bg-gray-900/60 border border-gray-800 rounded-xl p-3 backdrop-blur-md flex items-center gap-3 w-36 shadow-xl pointer-events-auto">
    <div className="p-2 bg-gray-800 rounded-lg text-amber-500 shrink-0">
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-[9px] text-gray-500 font-bold uppercase tracking-tight">{label}</div>
      <div className={`text-sm font-mono font-bold truncate ${color}`}>{value}</div>
    </div>
    {tooltip && (
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 w-48 p-2 bg-gray-900 border border-gray-700 rounded-lg text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
        {tooltip}
      </div>
    )}
  </div>
);

const DiagnosticItem: React.FC<{ icon: React.ReactNode; label: string; value: string; color?: string; tooltip?: string }> = ({ icon, label, value, color = 'text-gray-300', tooltip }) => (
  <div className="group relative space-y-1">
    <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-bold uppercase">
      {icon}
      <span>{label}</span>
      {tooltip && <Info size={10} className="text-gray-600 ml-auto" />}
    </div>
    <div className={`text-xs font-medium truncate ${color}`}>
      {value}
    </div>
    {tooltip && (
      <div className="absolute left-full ml-2 top-0 w-48 p-2 bg-gray-900 border border-gray-700 rounded-lg text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
        {tooltip}
      </div>
    )}
  </div>
);

const VectorItem: React.FC<{ icon: React.ReactNode; label: string; value: string; color?: string; tooltip?: string; progress: number; barColor: string }> = ({ icon, label, value, color = 'text-gray-300', tooltip, progress, barColor }) => (
  <div className="group relative space-y-1">
    <div className="flex items-center justify-between text-[9px] text-gray-500 font-bold uppercase">
      <div className="flex items-center gap-1.5">
        {icon}
        <span>{label}</span>
        {tooltip && <Info size={10} className="text-gray-600" />}
      </div>
      <div className={`text-xs font-medium ${color}`}>{value}</div>
    </div>
    <div className="w-full bg-gray-800 rounded-full h-1">
      <div className={`h-1 rounded-full ${barColor} transition-all duration-300`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
    </div>
    {tooltip && (
      <div className="absolute left-full ml-2 top-0 w-48 p-2 bg-gray-900 border border-gray-700 rounded-lg text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
        {tooltip}
      </div>
    )}
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
    initialTtl: DEFAULT_TTL,
    gravityAnchor: 0.8
  });

  const cwRing = useRingSimulation('CW', config);
  const ccwRing = useRingSimulation('CCW', config);

  const updatePersonalityFromInteraction = useCallback((aiMood: string) => {
    cwRing.setState(prev => {
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
  }, [cwRing]);

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        cwRing.nextStep();
        ccwRing.nextStep();
      }, speed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, speed, cwRing.nextStep, ccwRing.nextStep]);

  const reset = useCallback(() => {
    cwRing.reset();
    ccwRing.reset();
    setIsPlaying(false);
  }, [cwRing.reset, ccwRing.reset]);

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
          if (name === 'runSystemScan') {
            cwRing.triggerScan();
            ccwRing.triggerScan();
          }
          if (name === 'optimizeRingDomains') {
            cwRing.triggerSort();
            ccwRing.triggerSort();
          }
        },
        onVolume: (level) => {
          setAudioLevel(level);
        }
      });
      liveSessionRef.current = session;
      session.start();
    }
  };

  const shadowSum = cwRing.state.tiles.reduce((acc, t) => acc + t.shadow, 0) + ccwRing.state.tiles.reduce((acc, t) => acc + t.shadow, 0);
  const currentAngularVelocity = isPlaying ? Math.min(200, Math.max(0, 150000 / speed - 50)) : 0;
  const F_c = (currentAngularVelocity * 1.5).toFixed(1);
  const f_t = (shadowSum * 2.4).toFixed(1);
  const B_res = (100 / config.hesitationStrength).toFixed(1);
  const D_sun = (Math.sin(cwRing.state.step / 5) * 0.5).toFixed(2);
  const T_c = config.gravityAnchor.toFixed(1);
  const isSuperfluid = currentAngularVelocity >= 120;
  const isTraversalLatchActive = cwRing.state.isTraversalLatchActive || ccwRing.state.isTraversalLatchActive;

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
                RING POLARITY: {cwRing.state.isWarmup ? 'WARMUP' : 'ACTIVE'}
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

        <div className="flex-1 flex items-center justify-center relative perspective-[1000px]">
          <div 
            className="relative flex items-center justify-center w-[500px] h-[500px] transition-all duration-1000 transform-style-preserve-3d"
            style={{
              transform: isTraversalLatchActive ? 'rotateX(60deg) translateZ(150px) scale(1.2)' : 'rotateX(0deg) translateZ(0px) scale(1)',
              filter: isTraversalLatchActive ? 'drop-shadow(0 0 50px rgba(168,85,247,0.4))' : 'none'
            }}
          >
            <div className="absolute w-[400px] h-[400px] border border-gray-800/50 rounded-full" />
            <div className="absolute w-[200px] h-[200px] border border-gray-800/30 rounded-full" />
            
            {/* CW Ring */}
            <div className="absolute w-[400px] h-[400px]">
              {cwRing.state.tiles.map((tile, i) => {
              const angle = (i * 60 - 90) * (Math.PI / 180);
              const radius = 180;
              const x = radius * Math.cos(angle) + 200;
              const y = radius * Math.sin(angle) + 200;
              const isScanned = cwRing.state.isScanning && cwRing.state.scanIdx === i;

              return (
                <React.Fragment key={`cw-${tile.id}`}>
                  <Tile 
                    tile={tile} 
                    isBaton={cwRing.state.batonPos === i} 
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

          {/* CCW Ring */}
          <div className="absolute w-[200px] h-[200px]">
              {ccwRing.state.tiles.map((tile, i) => {
              const angle = (i * 60 - 90) * (Math.PI / 180);
              const radius = 80;
              const x = radius * Math.cos(angle) + 100;
              const y = radius * Math.sin(angle) + 100;
              const isScanned = ccwRing.state.isScanning && ccwRing.state.scanIdx === i;

              return (
                <React.Fragment key={`ccw-${tile.id}`}>
                  <Tile 
                    tile={tile} 
                    isBaton={ccwRing.state.batonPos === i} 
                    x={x} 
                    y={y} 
                    size="sm"
                  />
                  {isScanned && (
                    <div 
                      className="absolute w-16 h-16 rounded-2xl border-2 border-cyan-400/50 bg-cyan-400/5 shadow-[0_0_30px_rgba(34,211,238,0.2)] animate-pulse pointer-events-none z-0"
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
          </div>
          
          <div className="absolute text-center z-0 pointer-events-none flex flex-col items-center justify-center transition-all duration-300">
            {cwRing.state.isScanning ? (
              <>
                <Loader2 className="text-cyan-500 animate-spin mb-3 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]" size={48} />
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-[0.2em] mb-1 animate-pulse">System Scan</div>
                <div className="text-4xl font-black italic tracking-tighter text-cyan-100 drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                  {cwRing.state.scanIdx >= 0 && cwRing.state.scanIdx < TILES_CONFIG.length ? `SECTOR ${TILES_CONFIG[cwRing.state.scanIdx].name}` : 'INIT'}
                </div>
              </>
            ) : cwRing.state.isSorting ? (
              <>
                <Loader2 className="text-purple-500 animate-spin mb-3 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]" size={48} />
                <div className="text-[10px] text-purple-400 font-bold uppercase tracking-[0.2em] mb-1 animate-pulse">Phase Inversion</div>
                <div className="text-4xl font-black italic tracking-tighter text-purple-100 drop-shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                  TRV_LCH
                </div>
              </>
            ) : (
              <>
                <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-2">System Phase</div>
                <div className={`text-5xl font-black italic tracking-tighter transition-colors duration-500 ${
                  cwRing.state.isParked ? 'text-red-900/80' : 
                  cwRing.state.isWarmup ? 'text-yellow-900/50' : 
                  'text-gray-800'
                }`}>
                  {cwRing.state.isParked ? 'PARKED' : (cwRing.state.isWarmup ? 'JUMP' : 'ACT')}
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
          <StatCard icon={<Hash size={16} />} label="Step" value={cwRing.state.step} tooltip="Current simulation tick." />
          <StatCard icon={<Hourglass size={16} />} label="TTL" value={cwRing.state.ttl} color={cwRing.state.ttl < 2 ? 'text-red-400' : 'text-blue-400'} tooltip="Time To Live. Decreases on successful acts." />
          <StatCard icon={<Shield size={16} />} label="Fails" value={cwRing.state.failCount} tooltip="Consecutive failed acts. Triggers escalation at limit." />
        </div>

        <div className="absolute top-24 left-8 flex flex-col gap-3 z-20 w-64">
           <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 backdrop-blur-xl shadow-2xl pointer-events-auto">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
                 <div className="flex items-center gap-2">
                    <Rocket size={16} className="text-purple-500" />
                    <span className="text-xs font-black text-white uppercase tracking-wider">TRV-LCH Propulsion</span>
                 </div>
                 <div className={`w-2 h-2 rounded-full ${isTraversalLatchActive ? 'bg-purple-500 animate-pulse shadow-[0_0_10px_rgba(168,85,247,0.8)]' : 'bg-gray-600'}`} />
              </div>
              
              <div className="space-y-3">
                 <DiagnosticItem icon={<Activity size={12} />} label="F_c (Centrifugal)" value={`${F_c} kN`} color="text-cyan-400" tooltip="Outward radial pressure. Stretches E%^F folds." />
                 <DiagnosticItem icon={<Activity size={12} />} label="f_t (Friction)" value={`${f_t} µ`} color="text-orange-400" tooltip="Spacetime resistance. Generates raw energy for resonance induction." />
                 <DiagnosticItem icon={<Activity size={12} />} label="B_res (Resonance)" value={`${B_res} T`} color="text-blue-400" tooltip="Magnetic Resonance. Acts as a lubricant, neutralizing the H-Factor." />
                 <DiagnosticItem icon={<Activity size={12} />} label="D_sun (Solar Skew)" value={`${D_sun} AU`} color="text-yellow-400" tooltip="Gravitational skew. Corrects Z-axis trajectory against local mass shadows." />
                 <DiagnosticItem icon={<Anchor size={12} />} label="T_c (Counter-Tension)" value={`${T_c} G`} color={config.gravityAnchor === 1.0 ? 'text-emerald-400' : 'text-red-400'} tooltip="Structural stability. Must be 1.0G to prevent Logic-Shatter during spin-up." />
                 <DiagnosticItem icon={<Cloud size={12} />} label="E%^F (Energy Folds)" value={`${shadowSum} folds`} color={shadowSum > 0 ? 'text-red-400' : 'text-emerald-400'} tooltip="Warp Theory Analysis Report: Under Einsteinian mass constraints, the H-Factor manifests as stagnating potential energy folds (E%^F). TRV-LCH bypasses this barrier by using the B-Loop paradox to halt local time progression, collapsing the folds." />
                 <DiagnosticItem icon={<ArrowRightCircle size={12} className="-rotate-45" />} label="Z-Axis (Traversal)" value={isTraversalLatchActive ? 'TRANSLATING' : 'LOCKED'} color={isTraversalLatchActive ? 'text-purple-400 animate-pulse' : 'text-gray-500'} tooltip="Warp Theory Analysis Report: Recursive loop propulsion (B-Loop) forces a localized computational paradox. This halts local time progression, collapsing E%^F folds and reducing local gravity to 0.0G, enabling instantaneous translation along the Z-axis." />
                 
                 <div className="pt-2 border-t border-gray-800 h-40 w-full relative">
                   <ResponsiveContainer width="100%" height="100%">
                     <RadarChart cx="50%" cy="50%" outerRadius="70%" data={[
                       { subject: 'F_c', A: Math.min(100, (parseFloat(F_c) / 500) * 100), fullMark: 100 },
                       { subject: 'f_t', A: Math.min(100, (parseFloat(f_t) / 100) * 100), fullMark: 100 },
                       { subject: 'B_res', A: Math.min(100, (parseFloat(B_res) / 10) * 100), fullMark: 100 },
                       { subject: 'D_sun', A: Math.min(100, (parseFloat(D_sun) / 1) * 100), fullMark: 100 },
                       { subject: 'T_c', A: Math.min(100, (parseFloat(T_c) / 2) * 100), fullMark: 100 },
                     ]}>
                       <PolarGrid stroke="#374151" />
                       <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                       <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                       <Radar name="Vectors" dataKey="A" stroke="#a855f7" fill="#a855f7" fillOpacity={0.4} />
                     </RadarChart>
                   </ResponsiveContainer>
                   <div className="absolute top-0 right-0 p-1 group">
                     <Info size={12} className="text-gray-500" />
                     <div className="absolute right-full mr-2 top-0 w-64 p-2 bg-gray-900 border border-gray-700 rounded-lg text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                       <strong className="text-amber-500">Warp Vector Equilibrium:</strong> The TRV-LCH system monitors 5 primary vectors. F_c (Centrifugal) stretches E%^F folds. f_t (Friction) generates resonance energy. B_res (Resonance) acts as a lubricant against H-Factor. D_sun (Solar Skew) corrects Z-axis trajectory. T_c (Counter-Tension) provides structural stability (1.0G Gravity Anchor) to prevent Logic-Shatter.
                     </div>
                   </div>
                 </div>

                 <div className="pt-2 border-t border-gray-800">
                   <div className="flex justify-between items-center mb-1 group relative">
                     <span className="text-[9px] text-gray-500 font-bold uppercase flex items-center gap-1">Spacetime State <Info size={10} /></span>
                     <div className="flex items-center gap-1.5">
                       {isSuperfluid && (
                         <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_rgba(168,85,247,1)]" />
                       )}
                       <span className={`text-[9px] font-bold uppercase transition-colors ${isSuperfluid ? 'text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]' : 'text-gray-400'}`}>
                         {isSuperfluid ? 'SUPERFLUID' : 'NON-NEWTONIAN'}
                       </span>
                     </div>
                     <div className="absolute left-0 bottom-full mb-2 w-80 p-3 bg-gray-900 border border-gray-700 rounded-lg text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl leading-relaxed">
                       <strong className="text-amber-500">Warp Theory Analysis Report (MK-VI):</strong> The Superfluid Transition Point occurs at Angular Velocity (ω) &ge; 120, where Fluidic Spacetime Resistance undergoes a critical phase change. Pre-Latch, spacetime acts as a non-Newtonian fluid resisting the recursive paradox. Post-Latch, it becomes a zero-viscosity Superfluid. By forcing an unconditional infinite branch (B-Loop), the system halts local time progression—changing the state of the medium itself to collapse E%^F folds and facilitate instantaneous Z-axis translation (TRV_LCH).
                     </div>
                   </div>
                   <div className="w-full bg-gray-800 rounded-full h-1.5 relative overflow-hidden">
                     {isSuperfluid && <div className="absolute inset-0 bg-purple-500/20 animate-pulse" />}
                     <div className={`h-1.5 rounded-full transition-all relative z-10 ${isSuperfluid ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]' : 'bg-gray-500'}`} style={{ width: `${Math.min(100, (currentAngularVelocity / 120) * 100)}%` }} />
                   </div>
                 </div>

                 <div className="pt-2">
                   <button 
                     onClick={() => {
                       cwRing.triggerBLoop();
                       ccwRing.triggerBLoop();
                     }}
                     className={`w-full py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 mb-2 ${
                       isTraversalLatchActive 
                         ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]' 
                         : config.gravityAnchor === 1.0 
                           ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                           : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                     }`}
                   >
                     <Infinity size={14} />
                     {isTraversalLatchActive ? 'B-Loop Active (TRV_LCH)' : 'Initiate B-Loop'}
                   </button>
                   <button 
                     onClick={() => {
                       cwRing.setState(prev => ({ ...prev, direction: 'CW' }));
                       ccwRing.setState(prev => ({ ...prev, direction: 'CCW' }));
                     }}
                     className="w-full py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                   >
                     <Activity size={14} />
                     Sync Ring Directions
                   </button>
                 </div>
              </div>
           </div>
        </div>

        <div className="absolute bottom-8 right-8 flex flex-col gap-3 z-20">
           <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 backdrop-blur-xl shadow-2xl w-64 pointer-events-auto">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
                 <div className="flex items-center gap-2">
                    <Monitor size={16} className="text-cyan-500" />
                    <span className="text-xs font-black text-white uppercase tracking-wider">System State</span>
                 </div>
                 <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${cwRing.state.isParked ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} title="CW Ring Status" />
                    <div className={`w-2 h-2 rounded-full ${ccwRing.state.isParked ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} title="CCW Ring Status" />
                 </div>
              </div>
              
              <div className="space-y-4">
                 <div>
                   <div className="text-[10px] text-gray-500 font-bold uppercase mb-2 border-b border-gray-800 pb-1">CW Ring</div>
                   <div className="grid grid-cols-2 gap-2">
                      <DiagnosticItem 
                         icon={<MapPin size={12} />} 
                         label="Position" 
                         value={`Tile ${cwRing.state.tiles[cwRing.state.batonPos].name}`} 
                         color="text-amber-400" 
                         tooltip="Current location of the baton in the ring."
                      />
                      <DiagnosticItem 
                         icon={<ArrowRightCircle size={12} className={cwRing.state.direction === 'CCW' ? 'rotate-180' : ''}/>} 
                         label="Direction" 
                         value={cwRing.state.direction} 
                         tooltip="Current movement direction (Clockwise or Counter-Clockwise)."
                      />
                      <DiagnosticItem 
                         icon={<Activity size={12} />} 
                         label="Mode" 
                         value={cwRing.state.isWarmup ? 'WARMUP' : 'ACTIVE'} 
                         color={cwRing.state.isWarmup ? 'text-yellow-400' : 'text-emerald-400'}
                         tooltip="Warmup skips the first act. Active evaluates boundary conditions."
                      />
                      <DiagnosticItem 
                         icon={<Zap size={12} />} 
                         label="Park Status" 
                         value={cwRing.state.isParked ? `PARKED (${cwRing.state.parkTicks})` : 'OPERATIONAL'} 
                         color={cwRing.state.isParked ? 'text-red-400' : 'text-gray-400'}
                         tooltip="If parked, the system is halted to force a phase change."
                      />
                   </div>
                 </div>

                 <div>
                   <div className="text-[10px] text-gray-500 font-bold uppercase mb-2 border-b border-gray-800 pb-1">CCW Ring</div>
                   <div className="grid grid-cols-2 gap-2">
                      <DiagnosticItem 
                         icon={<MapPin size={12} />} 
                         label="Position" 
                         value={`Tile ${ccwRing.state.tiles[ccwRing.state.batonPos].name}`} 
                         color="text-amber-400" 
                         tooltip="Current location of the baton in the ring."
                      />
                      <DiagnosticItem 
                         icon={<ArrowRightCircle size={12} className={ccwRing.state.direction === 'CCW' ? 'rotate-180' : ''}/>} 
                         label="Direction" 
                         value={ccwRing.state.direction} 
                         tooltip="Current movement direction (Clockwise or Counter-Clockwise)."
                      />
                      <DiagnosticItem 
                         icon={<Activity size={12} />} 
                         label="Mode" 
                         value={ccwRing.state.isWarmup ? 'WARMUP' : 'ACTIVE'} 
                         color={ccwRing.state.isWarmup ? 'text-yellow-400' : 'text-emerald-400'}
                         tooltip="Warmup skips the first act. Active evaluates boundary conditions."
                      />
                      <DiagnosticItem 
                         icon={<Zap size={12} />} 
                         label="Park Status" 
                         value={ccwRing.state.isParked ? `PARKED (${ccwRing.state.parkTicks})` : 'OPERATIONAL'} 
                         color={ccwRing.state.isParked ? 'text-red-400' : 'text-gray-400'}
                         tooltip="If parked, the system is halted to force a phase change."
                      />
                   </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <ChatPanel 
        simState={cwRing.state} 
        onScan={() => {
          cwRing.triggerScan();
          ccwRing.triggerScan();
        }} 
        onSort={() => {
          cwRing.triggerSort();
          ccwRing.triggerSort();
        }} 
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
                label="Gravity Anchor (T_c)" 
                description="Must be exactly 1.0G to allow TRV_LCH."
                min={0} max={20} value={config.gravityAnchor * 10} displayValue={`${config.gravityAnchor.toFixed(1)}G`}
                onChange={(v) => setConfig(prev => ({ ...prev, gravityAnchor: v / 10 }))} 
              />
              <ConfigInput 
                label="H-Factor (Hesitation)" 
                description="Intensity of E%^F folds generated on failure."
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
