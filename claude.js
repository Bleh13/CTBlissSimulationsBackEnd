// server/claude.js
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './firebaseClient.js';
import crypto from 'crypto';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Helper function to hash user ID for Claude metadata
function hashUserId(userId) {
  return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);
}

export async function generateClaudeResponse(history, modelId, chatId, userId) {
  console.log('[CLAUDE] Starting response generation - modelId:', modelId, 'historyLength:', history?.length, 'chatId:', chatId, 'userId:', userId);
  
  // Fetch the per-model instruction from Supabase
  const { data: modelData, error } = await supabase
    .from('chat_models')
    .select('instruction')
    .eq('id', modelId)
    .single();

  const systemInstruction = error ? 'You are a helpful assistant.' : modelData.instruction;
  console.log('[CLAUDE] System instruction loaded:', systemInstruction.substring(0, 50) + '...');

  // For multi-user safety, we'll be more conservative with caching
  // Only cache the system instruction (which is model-specific, not user-specific)
  // and avoid caching user conversation history to prevent cross-user contamination
  
  const messages = history.map(({ role, text }) => ({
    role: role === 'model' ? 'assistant' : role, // Convert 'model' to 'assistant' for Claude
    content: text?.trim() ? text : 'Image uploaded by user'
  }));

  console.log('[CLAUDE] Converted', messages.length, 'messages for Claude API with safe multi-user caching');

  try {
    console.log('[CLAUDE] Making API call to Claude with multi-user safe prompt caching...');
    const result = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929', // Using your correct Claude model
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: systemInstruction,
          // Only cache system instruction since it's model-specific, not user-specific
          // This provides cost savings while maintaining user isolation
          cache_control: { type: "ephemeral" }
        }
      ],
      messages: messages,
      // Remove metadata entirely to avoid validation errors
      // Claude API is strict about metadata fields
      // metadata: {
      //   user_id: hashUserId(userId),
      //   chat_id: chatId,
      //   model_id: modelId
      // }
    });

  console.log('[CLAUDE] API call successful - response length:', result.content[0].text.length);
  // Log full usage object for visibility
  console.log('[CLAUDE] Usage object:', result.usage || {});
  console.log('[CLAUDE] Cache creation input tokens:', result.usage?.cache_creation_input_tokens || 0);
  console.log('[CLAUDE] Cache read input tokens:', result.usage?.cache_read_input_tokens || 0);
  console.log('[CLAUDE] Total input tokens:', result.usage?.input_tokens || 0);
  // Output tokens (may be present as output_tokens)
  const outputTokens = result.usage?.output_tokens ?? 0;
  console.log('[CLAUDE] Output tokens:', outputTokens);
  // Total tokens (input + output) if both available
  const totalTokens = (result.usage?.input_tokens ?? 0) + outputTokens;
  console.log('[CLAUDE] Total tokens (input + output):', totalTokens);
  console.log('[CLAUDE] User:', userId, 'Chat:', chatId);
  return result.content[0].text;
  } catch (e) {
    console.error('[CLAUDE] API Error:', e);
    return 'Error: Claude API failed.';
  }
}