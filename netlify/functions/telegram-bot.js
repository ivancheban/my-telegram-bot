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
    let platform = '';

    for (const url of urls) {
        if (url.includes('instagram.com')) {
            const cleanUrl = url.split('?')[0];
            videoUrl = cleanUrl.replace('instagram.com', 'ddinstagram.com');
            platform = 'Instagram';
            break;
        }
        // You can add Facebook/other handlers here if needed
    }

    if (videoUrl) {
      // --- THE GUARANTEED METHOD: SEND AS A VIDEO FILE ---
      // We use the `sendVideo` endpoint instead of `sendMessage`
      const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
      
      await fetch(telegramApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          // We tell Telegram the URL of the video, and it will download and send it.
          video: videoUrl,
          caption: `Source: ${platform}`,
          // Reply to the original user's message
          reply_to_message_id: message.message_id
        }),
      });
    }

    return { statusCode: 200, body: 'OK: Processed' };

  } catch (error) {
    console.error('Error processing update:', error);
    // On error, let's send a message back so the user knows something went wrong.
    const chatId = JSON.parse(event.body).message.chat.id;
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: "Sorry, I couldn't fetch that video." })
    });
    return { statusCode: 200, body: 'OK: Error reported' };
  }
};