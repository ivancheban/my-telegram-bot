const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!BOT_TOKEN) {
      throw new Error("Telegram Bot Token not found.");
    }

    const update = JSON.parse(event.body);
    if (!update.message || !update.message.text) {
      return { statusCode: 200, body: 'OK: Not a text message' };
    }

    const message = update.message;

    // --- FIX #1: PREVENT INFINITE LOOPS ---
    // If the message is from any bot, ignore it completely.
    if (message.from && message.from.is_bot) {
      return { statusCode: 200, body: 'OK: Ignored bot message' };
    }

    const text = message.text;
    const chatId = message.chat.id;
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlRegex);

    if (!urls) {
      return { statusCode: 200, body: 'OK: No URLs found' };
    }

    let replyText = '';

    for (const url of urls) {
      const urlObject = new URL(url);

      if (urlObject.hostname.includes('instagram.com')) {
        const cleanUrl = url.split('?')[0];
        const fixedUrl = cleanUrl.replace('instagram.com', 'ddinstagram.com');
        
        // --- FIX #2: FORCE PREVIEW WITH CACHE BUSTER ---
        // Appending a unique timestamp forces Telegram to re-fetch the preview.
        replyText = `${fixedUrl}?v=${Date.now()}`;
        break; 
      } else if (urlObject.hostname.includes('facebook.com') || urlObject.hostname.includes('fb.watch')) {
        const cleanUrl = url.split('?')[0];
        // Bonus: Use a service that also works for Facebook for better results
        const fixedUrl = cleanUrl.replace('facebook.com', 'fixupx.com').replace('fb.watch', 'fixupx.com');
        replyText = fixedUrl;
        break;
      }
    }

    if (replyText) {
      const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      await fetch(telegramApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: replyText,
          disable_web_page_preview: false 
        }),
      });
    }

    return { statusCode: 200, body: 'OK: Processed' };

  } catch (error) {
    console.error('Error processing update:', error);
    return { statusCode: 200, body: 'OK: Error processing' };
  }
};