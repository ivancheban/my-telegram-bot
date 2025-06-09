const fetch = require('node-fetch');
const FormData = require('form-data'); // <-- We need this again

module.exports = async (request, response) => {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    return response.status(500).send('Bot token not configured');
  }

  try {
    const update = request.body;
    if (!update.message || !update.message.text) {
      return response.status(200).send('OK: Not a text message');
    }
    const message = update.message;
    if (message.from && message.from.is_bot) {
      return response.status(200).send('OK: Ignored bot message');
    }

    const text = message.text;
    const chatId = message.chat.id;
    
    const instagramRegex = /https?:\/\/(www\.)?instagram\.com\/[\w\-\.\/]+/;
    const match = text.match(instagramRegex);
    if (!match) {
      return response.status(200).send('OK: No Instagram URL found');
    }

    const instagramUrl = match[0];
    const cleanUrl = instagramUrl.split('?')[0];
    const fixerUrl = cleanUrl.replace('instagram.com', 'ddinstagram.com');

    // --- The Definitive "Download, then Upload" Strategy ---
    console.log('Step 1: Downloading video from', fixerUrl);
    const videoResponse = await fetch(fixerUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video. Status: ${videoResponse.statusText}`);
    }
    const videoBuffer = await videoResponse.buffer();
    console.log('Step 2: Download complete. Size:', videoBuffer.length, 'bytes');

    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('video', videoBuffer, { filename: 'video.mp4' });
    form.append('reply_to_message_id', message.message_id);

    console.log('Step 3: Uploading video to Telegram...');
    const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
    const uploadResponse = await fetch(telegramApiUrl, { method: 'POST', body: form });
    
    const telegramResult = await uploadResponse.json();
    console.log('Step 4: Upload complete. Telegram Response:', JSON.stringify(telegramResult));
    
    response.status(200).send('OK: Processed');
  } catch (error) {
    console.error('CRITICAL ERROR:', error);
    const chatId = request.body.message.chat.id;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: "Sorry, I couldn't process that video." })
    });
    response.status(200).send('OK: Error Handled');
  }
};