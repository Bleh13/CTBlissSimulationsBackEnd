// server/index.js (or wherever your API lives)
import express from 'express';
import bodyParser from 'body-parser';
import { generateClaudeResponse } from './claude.js';
import { supabase } from './firebaseClient.js';
import cors from 'cors';  

const app = express();
app.use(bodyParser.json());
app.use(cors())

app.post('/claude', async (req, res) => {
  console.log('[CLAUDE API] Request received:', {
    chatId: req.body.chatId,
    userId: req.body.userId,
    timestamp: new Date().toISOString(),
    historyLength: req.body.history?.length,
    isImageTurn: req.body.isImageTurn
  });

  const { history, modelId, userId, chatId, isImageTurn } = req.body;

  let replyText;
  if (isImageTurn) {
    replyText = 'Okay';
    console.log('[CLAUDE API] Image turn detected, responding with "Okay"');
  } else {
    console.log('[CLAUDE API] Generating Claude response...');
    replyText = await generateClaudeResponse(history, modelId, chatId, userId);
    console.log('[CLAUDE API] Claude response generated, length:', replyText.length);
  }

  // Store in Supabase
  console.log('[CLAUDE API] Storing response in database...');
  const { data, error } = await supabase
    .from('messages')
    .insert([{
      user_id: 'claude',
      chat_id: chatId,
      text: replyText,
      timestamp: new Date().toISOString()
    }]);

  if (error) {
    console.error('[CLAUDE API] Error storing message:', error);
    return res.status(500).json({ error: 'Failed to store message' });
  }

  console.log('[CLAUDE API] Response stored successfully, sending to client');
  res.json({ reply: replyText });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

