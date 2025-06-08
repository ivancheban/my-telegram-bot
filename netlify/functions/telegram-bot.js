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

    let videoUrl = '';
    
    for (const url of urls) {
        if (url.includes('instagram.com')) {
            const cleanUrl = url.split('?')[0];
            // --- THE FINAL CHANGE: USE A MORE RELIABLE SERVICE ---
            videoUrl = cleanUrl.replace('instagram.com', 'vxtwitter.com');
            break;
        }
    }

    if (videoUrl) {
      const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
      
      const response = await fetch(telegramApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          video: videoUrl,
          reply_to_message_id: message.message_id
        }),
      });

      // We can keep this logging to see if it works
      const telegramResult = await response.json();
      console.log(`Using vxtwitter.com. Telegram API Response:`, JSON.stringify(telegramResult));
    }

    return { statusCode: 200, body: 'OK: Processed' };

  } catch (error) {
    console.error('ERROR in function execution:', error);
    return { statusCode: 200, body: 'OK: Error processing' };
  }
};