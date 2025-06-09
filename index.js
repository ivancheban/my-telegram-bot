// index.js
const express = require('express');
const botHandler = require('./api/telegram-bot.js');

const app = express();
const port = process.env.PORT || 3000;

// Vercel/Render will parse the JSON for us, but this is good practice
app.use(express.json());

// All requests to /api/telegram-bot will be handled by our existing bot logic
app.post('/api/telegram-bot', botHandler);

app.listen(port, () => {
  console.log(`Telegram bot server listening on port ${port}`);
});