const fetch = require('node-fetch');
const FormData = require('form-data'); // The new helper library

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

    let fixerUrl = '';
    
    for (const url of urls) {
        if (url.includes('instagram.com')) {
            const cleanUrl = url.split('?')[0];
            // We'll stick with vxtwitter as our source
            fixerUrl = cleanUrl.replace('instagram.com', 'vxtwitter.com');
            break;
        }
    }

    if (fixerUrl) {
      // --- THE ULTIMATE FIX: DOWNLOAD-THEN-UPLOAD ---

      // 1. Our function downloads the video from the fixer service.
      console.log('Step 1: Downloading video from', fixerUrl);
      const videoResponse = await fetch(fixerUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video from fixer. Status: ${videoResponse.statusText}`);
      }
      const videoBuffer = await videoResponse.buffer();
      console.log('Step 2: Download complete. Video size:', videoBuffer.length, 'bytes');

      // 2. We prepare the video file to be uploaded to Telegram.
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('reply_to_message_id', message.message_id);
      form.append('video', videoBuffer, { filename: 'video.mp4' }); // Attach the downloaded data as a file

      // 3. We upload the file directly to Telegram.
      const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
      console.log('Step 3: Uploading video to Telegram...');
      const uploadResponse = await fetch(telegramApiUrl, {
        method: 'POST',
        body: form // Let node-fetch handle the 'multipart/form-data' headers
      });

      const telegramResult = await uploadResponse.json();
      console.log('Step 4: Upload complete. Telegram API Response:', JSON.stringify(telegramResult));
    }

    return { statusCode: 200, body: 'OK: Processed' };

  } catch (error) {
    console.error('CRITICAL ERROR:', error);
    return { statusCode: 200, body: 'OK: Error processing' };
  }
};