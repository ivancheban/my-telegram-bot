const fetch = require('node-fetch');

module.exports = async (request, response) => {
  if (request.method !== 'POST') {
    return response.status(405).send('Method Not Allowed');
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.error("FATAL: Bot token not configured.");
    return response.status(200).send('OK');
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

    // --- STRATEGY: Use the Cobalt API to get a direct, compatible video link ---
    console.log('Step 1: Calling cobalt.tools API for URL:', instagramUrl);
    
    const cobaltResponse = await fetch('https://co.wuk.sh/api/json', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: instagramUrl })
    });

    const cobaltResult = await cobaltResponse.json();
    console.log('Step 2: Cobalt API response:', JSON.stringify(cobaltResult));

    if (cobaltResult.status !== 'stream' || !cobaltResult.url) {
      throw new Error(`Cobalt API failed. Status: ${cobaltResult.status || 'unknown'}. Text: ${cobaltResult.text || 'N/A'}`);
    }

    const directVideoUrl = cobaltResult.url;

    // --- Step 3: Tell Telegram to send the video from Cobalt's direct link ---
    console.log('Step 3: Sending direct video URL to Telegram:', directVideoUrl);
    const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
    const uploadResponse = await fetch(telegramApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            video: directVideoUrl,
            reply_to_message_id: message.message_id
        })
    });
    
    const telegramResult = await uploadResponse.json();
    console.log('Step 4: Telegram upload response:', JSON.stringify(telegramResult));

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