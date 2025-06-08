const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    return { statusCode: 200, body: 'OK' };
  }
  
  try {
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

    let fixerUrl = '';
    
    for (const url of urls) {
      if (url.includes('instagram.com')) {
        const cleanUrl = url.split('?')[0];
        // --- NEW STRATEGY: Use fixupx.com for better transcoding ---
        fixerUrl = cleanUrl.replace('instagram.com', 'fixupx.com');
        break;
      }
    }

    if (fixerUrl) {
      const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
      
      const response = await fetch(telegramApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          video: fixerUrl, // Tell Telegram to download from the new source
          reply_to_message_id: message.message_id
        }),
      });

      const telegramResult = await response.json();
      console.log('Using fixupx.com. Telegram API Response:', JSON.stringify(telegramResult));

      // Fallback if fixupx.com also fails network-wise
      if (!telegramResult.ok) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `(Video might be unplayable) ${fixerUrl}`,
            reply_to_message_id: message.message_id
          })
        });
      }
    }

    return { statusCode: 200, body: 'OK: Processed' };

  } catch (error) {
    console.error('An error occurred:', error);
    return { statusCode: 200, body: 'OK: Error handled' };
  }
};