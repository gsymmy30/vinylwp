
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from "../types";

const GEMINI_API_KEY = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeAudioVibe = async (file: File): Promise<AIAnalysisResult> => {
  try {
    const blobSlice = file.slice(0, 2 * 1024 * 1024); 
    const slicedFile = new File([blobSlice], file.name, { type: file.type });
    const audioBase64 = await fileToGenerativePart(slicedFile);

    const prompt = `
      Analyze this audio for a ultra-luxury music player UI.
      
      1. 'mood': 1 word. E.g. "Ethereal", "Gritty", "Velvet".
      2. 'genre': Precise sub-genre.
      3. 'meaning': MAX 1 SENTENCE. Abstract, poetic analogy only. NO literal descriptions. 
         - Good: "Like sipping a double espresso in a thunderstorm."
         - Good: "A slow dance in an empty ballroom."
         - Bad: "This song is about a breakup."
      4. 'colors': 
         - 'bg_gradient': IGNORE (Used for fallback).
         - 'vinyl_gradient': Array of 3 hex codes for the vinyl record wax. RICH, DEEP, OPAQUE colors.
         - 'accent': A refined accent color.
         - 'text': MUST BE DARK (#1c1917 or similar) for high contrast on white background.
         - 'label_text': Contrast color for the record label.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: file.type || 'audio/mp3', data: audioBase64 } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mood: { type: Type.STRING },
            genre: { type: Type.STRING },
            description: { type: Type.STRING },
            meaning: { type: Type.STRING },
            colors: {
              type: Type.OBJECT,
              properties: {
                bg_gradient: { type: Type.ARRAY, items: { type: Type.STRING } },
                vinyl_gradient: { type: Type.ARRAY, items: { type: Type.STRING } },
                accent: { type: Type.STRING },
                text: { type: Type.STRING },
                label_text: { type: Type.STRING },
              },
              required: ["bg_gradient", "vinyl_gradient", "accent", "text", "label_text"]
            }
          },
          required: ["mood", "genre", "description", "meaning", "colors"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    return JSON.parse(text) as AIAnalysisResult;

  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return {
      mood: "Silence",
      genre: "Unknown",
      description: "Waiting for sound.",
      meaning: "The needle waits for the groove.",
      colors: {
        bg_gradient: ["#FAF9F6", "#FAF9F6"],
        vinyl_gradient: ["#111111", "#1a1a1a", "#111111"], 
        accent: "#78716c", 
        text: "#1c1917",
        label_text: "#e7e5e4"
      }
    };
  }
};
