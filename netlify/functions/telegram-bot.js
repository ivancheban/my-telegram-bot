const fetch = require('node-fetch');
const FormData = require('form-data');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.error("FATAL: Bot token not configured.");
    return { statusCode: 200, body: 'OK' }; // Exit silently
  }

  let update;
  try {
    update = JSON.parse(event.body);
  } catch (e) {
    console.error("Failed to parse event body:", e);
    return { statusCode: 200, body: 'OK' };
  }

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

  let fixerUrl = '';
  
  for (const url of urls) {
    if (url.includes('instagram.com')) {
      const cleanUrl = url.split('?')[0];
      // --- Going back to ddinstagram.com, it's the most reliable source ---
      fixerUrl = cleanUrl.replace('instagram.com', 'ddinstagram.com');
      break;
    }
  }

  if (fixerUrl) {
    try {
      // --- Let's try the direct upload method one last time ---
      console.log('Attempting to upload video from URL:', fixerUrl);

      const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
      
      const response = await fetch(telegramApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          video: fixerUrl, // Tell Telegram to download from here
          reply_to_message_id: message.message_id
        }),
      });

      const telegramResult = await response.json();
      console.log('Telegram API Response:', JSON.stringify(telegramResult));

      // --- GRACEFUL FALLBACK ---
      // If Telegram failed to get the video, we send the link instead.
      if (!telegramResult.ok) {
        console.log('sendVideo failed, falling back to sendMessage.');
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: fixerUrl,
            reply_to_message_id: message.message_id
          })
        });
      }
    } catch (error) {
      console.error('An error occurred in the primary logic:', error);
    }
  }

  return { statusCode: 200, body: 'OK: Processed' };
};