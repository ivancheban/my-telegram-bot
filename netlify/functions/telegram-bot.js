const fetch = require('node-fetch');
const FormData = require('form-data');

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
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlRegex);

    if (!urls) {
      return { statusCode: 200, body: 'OK: No URLs found' };
    }

    let fixerUrl = '';
    
    for (const url of urls) {
      if (url.includes('instagram.com')) {
        const cleanUrl = url.split('?')[0];
        // Use ddinstagram as our video source
        fixerUrl = cleanUrl.replace('instagram.com', 'ddinstagram.com');
        break;
      }
    }

    if (fixerUrl) {
      // Step 1: Our function downloads the video from the fixer service.
      console.log('Step 1: Downloading video from', fixerUrl);
      const videoResponse = await fetch(fixerUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video. Status: ${videoResponse.statusText}`);
      }
      const videoBuffer = await videoResponse.buffer();
      console.log('Step 2: Download complete. Size:', videoBuffer.length, 'bytes');

      // Step 2: Prepare the file for upload to Telegram.
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('reply_to_message_id', message.message_id);
      form.append('video', videoBuffer, { filename: 'instagram_video.mp4' });

      // Step 3: Upload the downloaded video directly to Telegram.
      console.log('Step 3: Uploading video to Telegram...');
      const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
      const uploadResponse = await fetch(telegramApiUrl, {
        method: 'POST',
        body: form
      });

      const telegramResult = await uploadResponse.json();
      console.log('Step 4: Upload complete. Telegram Response:', JSON.stringify(telegramResult));
    }

    return { statusCode: 200, body: 'OK: Processed' };

  } catch (error) {
    console.error('CRITICAL ERROR in execution:', error);
    // Optionally, notify the user of the failure
    const chatId = JSON.parse(event.body).message.chat.id;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: "Sorry, I couldn't process that video." })
    });
    return { statusCode: 200, body: 'OK: Error handled' };
  }
};