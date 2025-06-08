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
        // You can add a Facebook handler here too if you want
    }

    if (videoUrl) {
      // Use the sendVideo endpoint for maximum reliability
      const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
      
      await fetch(telegramApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          // Tell Telegram to download and send the video from this URL
          video: videoUrl,
          // Optionally, reply to the user who sent the link
          reply_to_message_id: message.message_id
        }),
      });

      // After sending the video, we can optionally delete the original user's message
      // to keep the chat clean. Uncomment the block below to enable this.
      /*
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              chat_id: chatId,
              message_id: message.message_id
          })
      });
      */
    }

    return { statusCode: 200, body: 'OK: Processed' };

  } catch (error) {
    console.error('Error processing update:', error);
    return { statusCode: 200, body: 'OK: Error processing' };
  }
};