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
    const text = message.text;
    const chatId = message.chat.id;
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlRegex);

    if (!urls) {
      return { statusCode: 200, body: 'OK: No URLs found' };
    }

    let replyText = '';

    for (const url of urls) {
      // Create a URL object to easily access parts of the URL
      const urlObject = new URL(url);

      if (urlObject.hostname.includes('instagram.com')) {
        // --- IMPROVEMENT #1: Clean the URL ---
        // Get the URL without any tracking parameters (like ?igsh=...)
        const cleanUrl = url.split('?')[0];
        replyText = cleanUrl.replace('instagram.com', 'ddinstagram.com');
        break; 
      } else if (urlObject.hostname.includes('facebook.com') || urlObject.hostname.includes('fb.watch')) {
        const cleanUrl = url.split('?')[0];
        replyText = cleanUrl; // For FB, we just send the cleaned link
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
          // --- IMPROVEMENT #2: Explicitly enable the preview ---
          // This tells Telegram to always try and generate a preview for the link
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