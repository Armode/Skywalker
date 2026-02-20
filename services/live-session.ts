
import { GoogleGenAI, Modality, LiveServerMessage, Type } from "@google/genai";
import { SYSTEM_PROMPT } from "./constants";
import { createBlob, decode, decodeAudioData } from "./audio-utils";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface LiveSessionCallbacks {
  onStatusChange: (status: 'connecting' | 'active' | 'inactive') => void;
  onTranscript: (text: string, isUser: boolean) => void;
  onToolCall: (name: string) => void;
  onVolume: (level: number) => void;
}

export class GeminiLiveSession {
  private session: any = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private stream: MediaStream | null = null;

  constructor(private callbacks: LiveSessionCallbacks) {}

  async start() {
    this.callbacks.onStatusChange('connecting');

    try {
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const source = this.inputAudioContext!.createMediaStreamSource(this.stream!);

      // Audio Analysis for Visualization
      const analyser = this.inputAudioContext!.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!this.session) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        this.callbacks.onVolume(average / 128); // Normalize 0-2 (approx)
        requestAnimationFrame(updateVolume);
      };
      updateVolume();

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            this.callbacks.onStatusChange('active');
            
            const scriptProcessor = this.inputAudioContext!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              // Send input only after session promise resolves
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(this.inputAudioContext!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle transcriptions
            if (message.serverContent?.outputTranscription) {
              this.callbacks.onTranscript(message.serverContent.outputTranscription.text, false);
            } else if (message.serverContent?.inputTranscription) {
              this.callbacks.onTranscript(message.serverContent.inputTranscription.text, true);
            }

            // Handle audio output using running timestamp to prevent gaps
            const audioBase64 = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioBase64 && this.outputAudioContext) {
              this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
              const buffer = await decodeAudioData(decode(audioBase64), this.outputAudioContext, 24000, 1);
              const source = this.outputAudioContext.createBufferSource();
              source.buffer = buffer;
              source.connect(this.outputAudioContext.destination);
              source.start(this.nextStartTime);
              this.nextStartTime += buffer.duration;
              this.sources.add(source);
              source.onended = () => this.sources.delete(source);
            }

            // Handle interruption by stopping all currently playing sources
            if (message.serverContent?.interrupted) {
              this.sources.forEach(s => {
                try { s.stop(); } catch(e) {}
              });
              this.sources.clear();
              this.nextStartTime = 0;
            }

            // Handle tool calls: must return response to model to update context
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                this.callbacks.onToolCall(fc.name);
                sessionPromise.then(s => s.sendToolResponse({
                  functionResponses: { id: fc.id, name: fc.name, response: { result: "ok" } }
                }));
              }
            }
          },
          onclose: () => this.stop(),
          onerror: (e) => {
            console.error("Live session error:", e);
            this.stop();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: SYSTEM_PROMPT + "\nYou are in a LIVE AUDIO session. Keep responses concise and natural. You can SCAN or SORT the ring.",
          tools: [{
            functionDeclarations: [
              { name: 'runSystemScan', parameters: { type: Type.OBJECT, properties: {} } },
              { name: 'optimizeRingDomains', parameters: { type: Type.OBJECT, properties: {} } }
            ]
          }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        }
      });

      this.session = await sessionPromise;
    } catch (err) {
      console.error("Failed to start live session:", err);
      this.stop();
    }
  }

  stop() {
    this.session?.close?.();
    this.session = null;
    this.stream?.getTracks().forEach(t => t.stop());
    this.inputAudioContext?.close();
    this.outputAudioContext?.close();
    this.callbacks.onStatusChange('inactive');
  }
}
