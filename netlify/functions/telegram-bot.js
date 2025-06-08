const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.error("FATAL: Bot token not configured.");
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
    
    const urlRegex = new RegExp('https?://[^\\s]+', 'g');
    const urls = text.match(urlRegex);

    if (!urls) {
      return { statusCode: 200, body: 'OK: No URLs found' };
    }

    let instagramUrl = '';
    
    for (const url of urls) {
      if (url.includes('instagram.com')) {
        instagramUrl = url;
        break;
      }
    }

    if (instagramUrl) {
      // --- THE NEW STRATEGY: USE COBALT.TOOLS API ---
      console.log('Step 1: Calling cobalt.tools API for URL:', instagramUrl);
      
      const cobaltResponse = await fetch('https://co.wuk.sh/api/json', {
          method: 'POST',
          headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({
              url: instagramUrl,
              vQuality: '720', // Request a 720p version, which is universally compatible
              isNoTTWatermark: true
          })
      });

      const cobaltResult = await cobaltResponse.json();
      console.log('Step 2: Cobalt API response:', JSON.stringify(cobaltResult));

      if (cobaltResult.status !== 'stream') {
        throw new Error(`Cobalt API failed with status: ${cobaltResult.status}. Text: ${cobaltResult.text}`);
      }

      // The direct, compatible video URL
      const directVideoUrl = cobaltResult.url;

      // --- Step 3: Send the compatible video URL to Telegram ---
      console.log('Step 3: Sending direct video URL to Telegram:', directVideoUrl);
      const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
      const uploadResponse = await fetch(telegramApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              chat_id: chatId,
              video: directVideoUrl, // Telegram will download this compatible video
              reply_to_message_id: message.message_id
          })
      });
      
      const telegramResult = await uploadResponse.json();
      console.log('Step 4: Telegram upload response:', JSON.stringify(telegramResult));
    }

    return { statusCode: 200, body: 'OK: Processed' };

  } catch (error) {
    console.error('CRITICAL ERROR in execution:', error);
    const chatId = JSON.parse(event.body).message.chat.id;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: "Sorry, I couldn't process that video." })
    });
    return { statusCode: 200, body: 'OK: Error handled' };
  }
};