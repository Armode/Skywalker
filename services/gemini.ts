import { GoogleGenAI, GenerateContentResponse, FunctionDeclaration, Type } from "@google/genai";
import { SYSTEM_PROMPT } from "./constants";

// Use process.env.API_KEY directly as required by guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const scanFunction: FunctionDeclaration = {
  name: 'runSystemScan',
  parameters: {
    type: Type.OBJECT,
    description: 'Triggers a full-ring heuristic scan to analyze stability, shadows, and domain alignment.',
    properties: {},
  },
};

const sortFunction: FunctionDeclaration = {
  name: 'optimizeRingDomains',
  parameters: {
    type: Type.OBJECT,
    description: 'Initiates a sorting operation to realign tiles into their optimal polarized domains and clear all hesitation shadows.',
    properties: {},
  },
};

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface GeminiResponse {
  text?: string;
  functionCalls?: any[];
}

/**
 * Sends a message to Gemini with tool support and retry logic.
 */
export async function sendMessageToGemini(message: string, context: string): Promise<GeminiResponse> {
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Current System Context: ${context}\n\nUser Question: ${message}`,
        config: {
          systemInstruction: SYSTEM_PROMPT + "\n\nYou have the capacity to SCAN and SORT the ring. If the user asks for analysis, run a scan. If they ask to fix, optimize, or realign, run a sort.",
          temperature: 0.7,
          topP: 0.95,
          tools: [{ functionDeclarations: [scanFunction, sortFunction] }],
        },
      });

      if (!response) {
        throw new Error("No response from model.");
      }

      return {
        text: response.text,
        functionCalls: response.functionCalls,
      };

    } catch (error: any) {
      attempt++;
      
      const errorStr = JSON.stringify(error);
      const isRateLimit = errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED");
      const isServerSide = errorStr.includes("500") || errorStr.includes("503");

      if (attempt <= MAX_RETRIES && (isRateLimit || isServerSide)) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        await sleep(backoff);
        continue;
      }

      console.error("Gemini API Error:", error);
      return { text: "I'm having trouble connecting to my neural core right now." };
    }
  }
  
  return { text: "Maximum retry attempts reached." };
}
