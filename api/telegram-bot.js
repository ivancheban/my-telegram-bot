const fetch = require('node-fetch');
const FormData = require('form-data');

module.exports = async (request, response) => {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) return response.status(500).send('Bot token not configured');

  try {
    const update = request.body;
    if (!update.message || !update.message.text) return response.status(200).send('OK');
    const message = update.message;
    if (message.from && message.from.is_bot) return response.status(200).send('OK');

    const text = message.text;
    const chatId = message.chat.id;
    
    const instagramRegex = /https?:\/\/(www\.)?instagram\.com\/[\w\-\.\/]+/;
    const match = text.match(instagramRegex);
    if (!match) return response.status(200).send('OK');

    const instagramUrl = match[0];
    const cleanUrl = instagramUrl.split('?')[0];
    const fixerUrl = cleanUrl.replace('instagram.com', 'ddinstagram.com');

    // Step 1: Send "Processing..." message
    const processingMessage = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Processing your request...",
        reply_to_message_id: message.message_id
      })
    });

    // Step 2: Download video with improved headers
    let videoResponse = await fetch(fixerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://www.instagram.com/'
      }
    });
    
    // Try alternative URL if first attempt fails
    if (!videoResponse.ok) {
      const alternativeUrl = cleanUrl.replace('instagram.com', 'instagram.cdnist.com');
      videoResponse = await fetch(alternativeUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': '*/*',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Referer': 'https://www.instagram.com/'
        }
      });
    }

    if (!videoResponse.ok) throw new Error(`Download failed: ${videoResponse.status}`);

    // Verify content type
    const contentType = videoResponse.headers.get('content-type');
    if (!contentType || !contentType.includes('video')) {
      throw new Error('Invalid content type received: ' + contentType);
    }

    const videoBuffer = await videoResponse.buffer();

    // Verify buffer size
    if (videoBuffer.length < 10000) {
      throw new Error('Downloaded content is too small to be a valid video');
    }

    // Step 3: Upload video with improved parameters
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('video', videoBuffer, {
      filename: 'instagram_video.mp4',
      contentType: 'video/mp4'
    });
    form.append('reply_to_message_id', message.message_id);
    form.append('supports_streaming', 'true');
    form.append('caption', '✅ Downloaded from Instagram');
    
    const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
    const uploadResponse = await fetch(telegramApiUrl, {
      method: 'POST',
      body: form,
      timeout: 60000 // 60 second timeout
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      throw new Error(`Telegram API error: ${JSON.stringify(errorData)}`);
    }
    
    const telegramResult = await uploadResponse.json();
    console.log('Upload complete. Response:', JSON.stringify(telegramResult));

    // Step 4: Delete the "Processing..." message
    const processingMessageData = await processingMessage.json();
    if (processingMessageData.ok) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: processingMessageData.result.message_id
        })
      });
    }
    
    response.status(200).send('OK: Processed');
  } catch (error) {
    console.error('CRITICAL ERROR:', error);
    const chatId = request.body.message.chat.id;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Sorry, I couldn't process that video. Error: " + error.message,
        reply_to_message_id: request.body.message.message_id
      })
    });
    response.status(200).send('OK: Error Handled');
  }
};