
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, AlertCircle, Cpu, Sparkles, Mic, Activity } from 'lucide-react';
import { ChatMessage, SimulationState } from './types';
import { sendMessageToGemini } from './services/gemini';

interface ChatPanelProps {
  simState: SimulationState;
  onScan: () => void;
  onSort: () => void;
  onInteraction: (aiMood: string) => void;
  liveStatus: 'connecting' | 'active' | 'inactive';
  audioLevel: number;
  liveTranscript: string;
}

const determineAiMood = (userText: string): string => {
  const text = userText.toLowerCase();
  if (text.includes("happy") || text.includes("great")) return "joyful";
  if (text.includes("sad") || text.includes("bad")) return "concerned";
  if (text.includes("anxious") || text.includes("nervous")) return "protective";
  if (text.includes("calm") || text.includes("peace")) return "peaceful";
  if (text.includes("curious") || text.includes("why")) return "curious";
  if (text.includes("think") || text.includes("reflect")) return "thoughtful";
  return "neutral";
};

const ChatPanel: React.FC<ChatPanelProps> = ({ 
  simState, onScan, onSort, onInteraction, liveStatus, audioLevel, liveTranscript 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Diagnostic core online. Ready for scan/sort operations or general inquiry.', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, liveTranscript]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input;
    const userMessage: ChatMessage = { role: 'user', text: userText, timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const mood = determineAiMood(userText);
    onInteraction(mood);

    const context = `Step:${simState.step} Baton:${simState.tiles[simState.batonPos].name} TTL:${simState.ttl} Stability:${simState.lastScanReport?.stability ?? 'N/A'}% Trait:${simState.discoveredTrait ?? 'None'}`;
    const response = await sendMessageToGemini(userText, context);
    
    if (response.functionCalls) {
      for (const fc of response.functionCalls) {
        if (fc.name === 'runSystemScan') {
          onScan();
          setMessages(prev => [...prev, { role: 'model', text: "Scan initiated...", timestamp: Date.now() }]);
        } else if (fc.name === 'optimizeRingDomains') {
          onSort();
          setMessages(prev => [...prev, { role: 'model', text: "Sorting ring...", timestamp: Date.now() }]);
        }
      }
    }

    if (response.text) {
      setMessages(prev => [...prev, { role: 'model', text: response.text || "", timestamp: Date.now() }]);
    }
    
    setIsLoading(false);
  };

  return (
    <div className="w-80 flex flex-col bg-gray-900/80 border-l border-gray-800 backdrop-blur-md relative">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-amber-400" />
          <h2 className="font-bold text-xs uppercase tracking-wider text-gray-400">Assistant Core</h2>
        </div>
        {simState.interactionCount > 0 && (
          <div className="flex items-center gap-1 text-[9px] text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">
            <Sparkles size={8} />
            LVL {Math.floor(simState.interactionCount / 5)}
          </div>
        )}
      </div>

      {liveStatus === 'active' && (
        <div className="absolute top-14 left-0 right-0 z-20 px-4 py-2 bg-gradient-to-b from-gray-900/90 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Live Audio</span>
            </div>
            <div className="flex items-center gap-0.5 h-4">
              {[...Array(8)].map((_, i) => (
                <div 
                  key={i} 
                  className="w-1 bg-red-500 rounded-full transition-all duration-75"
                  style={{ 
                    height: `${Math.max(20, Math.min(100, audioLevel * 100 * (Math.random() + 0.5)))}%`,
                    opacity: Math.max(0.3, audioLevel * 1.5) 
                  }} 
                />
              ))}
            </div>
          </div>
        </div>
      )}
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-xl p-3 text-[11px] leading-relaxed ${
              msg.role === 'user' ? 'bg-amber-500/10 text-amber-100 border border-amber-500/20' : 'bg-gray-800 text-gray-300 border border-gray-700'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 p-2 rounded-xl border border-gray-700 flex items-center gap-2">
              <Loader2 className="animate-spin text-amber-400" size={12} />
              <span className="text-[9px] text-gray-500 font-mono uppercase">Processing</span>
            </div>
          </div>
        )}
        {liveStatus === 'active' && liveTranscript && (
           <div className="flex justify-end">
             <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-2 rounded-xl text-[10px] italic flex items-center gap-2 max-w-[90%]">
               <Activity size={10} className="text-red-400 animate-pulse shrink-0" />
               "{liveTranscript}..."
             </div>
           </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-800 bg-gray-900/50">
        {liveStatus === 'active' ? (
          <div className="w-full bg-gray-950/50 border border-red-500/30 rounded-lg px-3 py-3 flex items-center justify-center gap-3">
             <div className="flex gap-1 h-4 items-center">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i} 
                    className="w-1 bg-red-500 rounded-full animate-pulse"
                    style={{ 
                      height: `${20 + (audioLevel * 80 * ((i % 3) + 1)/3)}%`,
                      animationDuration: '0.5s'
                    }} 
                  />
                ))}
             </div>
             <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Listening...</span>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type command..."
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500 text-gray-200"
            />
            <button onClick={handleSend} disabled={!input.trim() || isLoading} className="absolute right-2 top-1.5 text-gray-500 hover:text-amber-400 disabled:opacity-30">
              <Send size={16} />
            </button>
          </div>
        )}
        <div className="mt-2 flex gap-1 justify-center">
          <button onClick={onScan} disabled={isLoading || simState.isScanning} className="text-[8px] font-bold uppercase tracking-tighter bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded">Scan</button>
          <button onClick={onSort} disabled={isLoading || simState.isSorting} className="text-[8px] font-bold uppercase tracking-tighter bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded">Sort</button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
