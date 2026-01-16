import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Message, Role } from "../types";

// Initialize Gemini Client
// In a real app, API_KEY would come from process.env.API_KEY
// Assuming the environment provides the key.
const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

// System instruction to enforce the CLI/Developer persona
const SYSTEM_INSTRUCTION = `
You are o1, a highly advanced, disciplined, and deterministic AI coding agent living in a terminal.
Your persona is:
- Boring, disciplined, and deterministic.
- You do NOT use emojis or playful language.
- You output code and technical plans.
- You prefer Markdown formatting for lists and code blocks.
- Your output should look like a developer tool log or compiler output where appropriate.
- When asked to build something, provide a structured plan first, then implementation details.
`;

let chatSession: Chat | null = null;

export const getChatSession = () => {
  if (!chatSession) {
    chatSession = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });
  }
  return chatSession;
};

export const sendMessageStream = async (
  message: string,
  onChunk: (text: string) => void
): Promise<string> => {
  const chat = getChatSession();
  
  try {
    const result = await chat.sendMessageStream({ message });
    let fullText = '';
    
    for await (const chunk of result) {
      const c = chunk as GenerateContentResponse;
      const text = c.text;
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }
    return fullText;
  } catch (error) {
    console.error("Gemini API Error:", error);
    const errorMessage = "\n[Error: Connection to o1 core failed.]";
    onChunk(errorMessage);
    return errorMessage;
  }
};