const fetch = require('node-fetch');

// The Vercel handler is slightly different: it uses 'request' and 'response'
module.exports = async (request, response) => {
  // We only want to handle POST requests from Telegram
  if (request.method !== 'POST') {
    return response.status(405).send('Method Not Allowed');
  }

  try {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!BOT_TOKEN) {
      throw new Error("Telegram Bot Token not found in environment variables.");
    }

    // The update is in request.body, already parsed by Vercel
    const update = request.body;

    // Make sure it's a message and it has text
    if (!update.message || !update.message.text) {
      return response.status(200).send('OK: Not a text message');
    }

    const message = update.message;
    // Ignore messages from other bots to prevent loops
    if (message.from && message.from.is_bot) {
      return response.status(200).send('OK: Ignored bot message');
    }

    const text = message.text;
    const chatId = message.chat.id;

    // Regex to find an Instagram URL
    const instagramRegex = /https?:\/\/(www\.)?instagram\.com\/[\w\-\.\/]+/;
    const match = text.match(instagramRegex);

    // If no Instagram URL is found, do nothing
    if (!match) {
      return response.status(200).send('OK: No Instagram URL found');
    }

    const instagramUrl = match[0];
    // Clean the URL by removing tracking parameters
    const cleanUrl = instagramUrl.split('?')[0];

    // --- The Simple "Link Replacement" Strategy ---
    const replyText = cleanUrl.replace('instagram.com', 'ddinstagram.com');

    // Send the fixed link back to the chat
    const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
        // Optional: Reply directly to the user's message
        // reply_to_message_id: message.message_id 
      }),
    });

    // Send a 200 OK response back to Vercel/Telegram
    response.status(200).send('OK: Processed');

  } catch (error) {
    console.error('Error processing update:', error);
    // Return 200 even on errors, so Telegram doesn't keep resending the same update
    response.status(200).send('OK: Error processing');
  }
};