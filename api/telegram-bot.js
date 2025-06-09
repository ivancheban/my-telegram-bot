// api/telegram-bot.js
const fetch = require('node-fetch');

// Change the export to be a function that Express can call
module.exports = async (request, response) => {
  // The rest of the cobalt.tools code is IDENTICAL
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    return response.status(500).send('Bot token not configured');
  }

  try {
    const update = request.body;
    if (!update.message || !update.message.text) {
      return response.status(200).send('OK: Not a text message');
    }
    const message = update.message;
    if (message.from && message.from.is_bot) {
      return response.status(200).send('OK: Ignored bot message');
    }

    const text = message.text;
    const chatId = message.chat.id;
    
    const instagramRegex = /https?:\/\/(www\.)?instagram\.com\/[\w\-\.\/]+/;
    const match = text.match(instagramRegex);
    if (!match) {
      return response.status(200).send('OK: No Instagram URL found');
    }

    const instagramUrl = match[0];
    
    const cobaltResponse = await fetch('https://co.wuk.sh/api/json', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: instagramUrl })
    });
    const cobaltResult = await cobaltResponse.json();
    if (cobaltResult.status !== 'stream' || !cobaltResult.url) {
      throw new Error(`Cobalt API failed: ${cobaltResult.text}`);
    }

    const directVideoUrl = cobaltResult.url;
    
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            video: directVideoUrl,
            reply_to_message_id: message.message_id
        })
    });
    
    response.status(200).send('OK: Processed');
  } catch (error) {
    console.error('CRITICAL ERROR:', error);
    const chatId = request.body.message.chat.id;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: "Sorry, I couldn't process that video." })
    });
    response.status(200).send('OK: Error Handled');
  }
};