const fetch = require('node-fetch');
const FormData = require('form-data');
const config = require('../config');

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

    let videoResponse = null;
    let successfulProxy = '';
    let lastError = '';
    let videoBuffer = null;
    let retryCount = 0;

    while (!videoBuffer && retryCount < config.proxy.maxRetries) {
      for (const service of config.proxy.services) {
        try {
          console.log(`Trying proxy: ${service.name}`);

          const proxyUrl = typeof service.url === 'function' ? 
                          service.url(cleanUrl) : 
                          `${service.url}?url=${encodeURIComponent(cleanUrl)}`;

          const response = await fetch(proxyUrl, {
            method: service.method,
            headers: service.headers,
            timeout: config.proxy.timeout,
            body: service.method === 'POST' ? JSON.stringify({ url: cleanUrl }) : undefined
          });

          if (!response.ok) {
            lastError = `HTTP ${response.status} from ${service.name}`;
            continue;
          }

          const contentType = response.headers.get('content-type');
          console.log(`Content-Type from ${service.name}:`, contentType);

          if (contentType?.includes('json')) {
            const jsonData = await response.json();
            const videoUrl = jsonData.url || 
                            (jsonData.links && jsonData.links[0]) || 
                            (jsonData.data && jsonData.data.url);

            if (videoUrl) {
              videoResponse = await fetch(videoUrl, {
                headers: {
                  'Accept': 'video/*, application/octet-stream',
                  'User-Agent': service.headers['User-Agent']
                },
                timeout: config.proxy.timeout
              });
            }
          } else {
            const responseText = await response.text();
            const videoMatch = responseText.match(/video_url["':]+([^"']+)/i) ||
                              responseText.match(/href=["']([^"']+\.mp4)/i) ||
                              responseText.match(/source\s+src=["']([^"']+)/i);

            if (videoMatch) {
              const videoUrl = videoMatch[1].replace(/&amp;/g, '&');
              videoResponse = await fetch(videoUrl, {
                headers: {
                  'Accept': 'video/*, application/octet-stream',
                  'User-Agent': service.headers['User-Agent']
                },
                timeout: config.proxy.timeout
              });
            }
          }

          if (videoResponse?.ok) {
            videoBuffer = await videoResponse.buffer();
            if (videoBuffer.length > 100000) {
              successfulProxy = service.name;
              break;
            }
          }
        } catch (error) {
          console.log(`Proxy ${service.name} failed:`, error.message);
          lastError = `${service.name}: ${error.message}`;
          continue;
        }
      }
      retryCount++;
      if (!videoBuffer && retryCount < config.proxy.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
      }
    }

    if (!successfulProxy || !videoBuffer) {
      throw new Error(`Video download failed after ${retryCount} attempts. Last error: ${lastError}`);
    }

    console.log(`Successfully found video using proxy: ${successfulProxy}`);

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