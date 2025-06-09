const fetch = require('node-fetch');

module.exports = async (request, response) => {
  if (request.method !== 'POST') {
    return response.status(405).send('Method Not Allowed');
  }

  try {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!BOT_TOKEN) {
      throw new Error("Telegram Bot Token not found in environment variables.");
    }

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
    const cleanUrl = instagramUrl.split('?')[0];

    // --- THE FIX: ADD A CACHE-BUSTING PARAMETER ---
    // The `?v=${Date.now()}` makes the URL unique every time, forcing a new preview.
    const replyText = `${cleanUrl.replace('instagram.com', 'ddinstagram.com')}?v=${Date.now()}`;

    const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText
      }),
    });

    response.status(200).send('OK: Processed');

  } catch (error) {
    console.error('Error processing update:', error);
    response.status(200).send('OK: Error processing');
  }
};