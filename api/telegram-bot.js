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

    // Step 2: Try multiple proxy services with improved options
    const proxyUrls = [
      cleanUrl.replace('instagram.com', 'ddinstagram.com'),
      cleanUrl.replace('instagram.com', 'imginn.org'),
      cleanUrl.replace('instagram.com', 'instasupersave.com'),
      cleanUrl.replace('www.', ''),
      cleanUrl.replace('instagram.com', 'ddinstagram.com').replace('reel', 'reels'),
      cleanUrl.replace('instagram.com', 'dumpor.com')
    ];

    let videoResponse = null;
    let successfulProxy = '';
    let lastError = '';

    for (const proxyUrl of proxyUrls) {
      try {
        console.log(`Trying proxy: ${proxyUrl}`);
        videoResponse = await fetch(proxyUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Referer': 'https://www.instagram.com/',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'sec-fetch-dest': 'video',
            'sec-fetch-mode': 'no-cors',
            'sec-fetch-site': 'cross-site'
          },
          timeout: 30000,
          follow: 5
        });

        const contentType = videoResponse.headers.get('content-type');
        console.log(`Content-Type from ${proxyUrl}:`, contentType);

        if (!videoResponse.ok) {
          lastError = `HTTP ${videoResponse.status} from ${proxyUrl}`;
          continue;
        }

        // Accept various valid content types
        if (contentType && (
          contentType.includes('video') || 
          contentType.includes('octet-stream') || 
          contentType.includes('application/binary')
        )) {
          successfulProxy = proxyUrl;
          break;
        } else {
          lastError = `Invalid content type from ${proxyUrl}: ${contentType}`;
        }

        // Try to read a small portion of the response to verify it's actually video data
        const testBuffer = await videoResponse.buffer();
        if (testBuffer.length > 50000) {
          successfulProxy = proxyUrl;
          videoResponse = await fetch(proxyUrl, { // Fetch again for full content
            headers: { ...videoResponse.headers },
            timeout: 60000,
            follow: 5
          });
          break;
        } else {
          lastError = `Response too small from ${proxyUrl}: ${testBuffer.length} bytes`;
        }

      } catch (proxyError) {
        console.log(`Proxy ${proxyUrl} failed:`, proxyError.message);
        lastError = `${proxyUrl}: ${proxyError.message}`;
        continue;
      }
    }

    if (!successfulProxy) {
      throw new Error(`All proxies failed. Last error: ${lastError}`);
    }

    console.log(`Successfully found video using proxy: ${successfulProxy}`);
    const videoBuffer = await videoResponse.buffer();

    if (videoBuffer.length < 50000) {
      throw new Error(`Downloaded content too small: ${videoBuffer.length} bytes`);
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
      timeout: 60000
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