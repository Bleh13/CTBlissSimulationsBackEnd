// server/gemini.js
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { supabase } from './firebaseClient.js';

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_KEY,
});

export async function generateGeminiResponse(history, modelId) {
  // Fetch the per-model instruction from Supabase
  const { data: modelData, error } = await supabase
    .from('chat_models')
    .select('instruction')
    .eq('id', modelId)
    .single();

  const instruction = error ? 'You are a helpful assistant.' : modelData.instruction;

  const config = {
    responseMimeType: 'text/plain',
    systemInstruction: [{ text: instruction }],
  };

  const contents = history.map(({ role, text }) => ({
    role,
    parts: [{
      text: text?.trim() ? text : 'Image uploaded by user'
    }],
  }));

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config,
      contents,
    });

    return result.text;
  } catch (e) {
    console.error('Gemini error:', e);
    return 'Error: Gemini API failed.';
  }
}
