const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!BOT_TOKEN) throw new Error("Telegram Bot Token not found.");

    const update = JSON.parse(event.body);
    if (!update.message || !update.message.text) {
      return { statusCode: 200, body: 'OK: Not a text message' };
    }

    const message = update.message;
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
        replyText = cleanUrl.replace('instagram.com', 'ddinstagram.com');
        break;
      } else if (urlObject.hostname.includes('facebook.com') || urlObject.hostname.includes('fb.watch')) {
        const cleanUrl = url.split('?')[0];
        replyText = cleanUrl.replace(/facebook\.com|fb\.watch/, 'fxtwitter.com'); // fxtwitter also handles facebook
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
          // --- THE ULTIMATE PREVIEW FIX ---
          // This is a more modern and powerful way to control previews
          link_preview_options: {
            is_disabled: false,
            url: replyText, // Explicitly tell Telegram which link to preview
            prefer_large_media: true // Make the video thumbnail big
          }
        }),
      });
    }

    return { statusCode: 200, body: 'OK: Processed' };

  } catch (error) {
    console.error('Error processing update:', error);
    return { statusCode: 200, body: 'OK: Error processing' };
  }
};