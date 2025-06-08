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
            videoUrl = cleanUrl.replace('instagram.com', 'ddinstagram.com');
            break;
        }
    }

    if (videoUrl) {
      console.log('Attempting to send video from URL:', videoUrl); // Log the URL we're trying

      const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
      
      // --- CAPTURE THE RESPONSE FROM TELEGRAM ---
      const response = await fetch(telegramApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          video: videoUrl,
          reply_to_message_id: message.message_id
        }),
      });

      // --- LOG THE RESPONSE BODY ---
      // This is the most important part. We will see what Telegram says.
      const telegramResult = await response.json();
      console.log('Telegram API Response:', JSON.stringify(telegramResult));
    }

    return { statusCode: 200, body: 'OK: Processed' };

  } catch (error) {
    console.error('ERROR in function execution:', error);
    return { statusCode: 200, body: 'OK: Error processing' };
  }
};