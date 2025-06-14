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
    const proxyServices = [
      {
        url: `https://snapinsta.app/api/download?url=${encodeURIComponent(cleanUrl)}`,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Origin': 'https://snapinsta.app',
          'Referer': 'https://snapinsta.app/'
        },
        type: 'api'
      },
      {
        url: cleanUrl.replace('instagram.com', 'ddinstagram.com'),
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': 'text/html,application/xhtml+xml,video/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Referer': 'https://www.instagram.com/'
        },
        type: 'direct'
      },
      {
        url: `https://sssinstagram.com/api/convert?url=${encodeURIComponent(cleanUrl)}`,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Origin': 'https://sssinstagram.com',
          'Referer': 'https://sssinstagram.com/'
        },
        type: 'api'
      }
    ];

    let videoResponse = null;
    let successfulProxy = '';
    let lastError = '';
    let videoBuffer = null;

    for (const proxy of proxyServices) {
      try {
        console.log(`Trying proxy: ${proxy.url}`);

        if (proxy.type === 'api') {
          const apiResponse = await fetch(proxy.url, {
            headers: proxy.headers,
            timeout: 30000
          });

          if (!apiResponse.ok) {
            lastError = `HTTP ${apiResponse.status} from ${proxy.url}`;
            continue;
          }

          const jsonData = await apiResponse.json();
          const videoUrl = jsonData.url || 
                          (jsonData.links && jsonData.links[0]) || 
                          (jsonData.data && jsonData.data.url);

          if (videoUrl) {
            videoResponse = await fetch(videoUrl, {
              headers: {
                'Accept': 'video/*, application/octet-stream',
                'User-Agent': proxy.headers['User-Agent']
              },
              timeout: 60000
            });
          }
        } else {
          videoResponse = await fetch(proxy.url, {
            headers: proxy.headers,
            timeout: 30000,
            follow: 5
          });
        }

        if (!videoResponse || !videoResponse.ok) {
          lastError = `Failed to fetch video from ${proxy.url}`;
          continue;
        }

        const contentType = videoResponse.headers.get('content-type');
        console.log(`Content-Type from ${proxy.url}:`, contentType);

        if (contentType && (contentType.includes('video') || contentType.includes('octet-stream'))) {
          videoBuffer = await videoResponse.buffer();
          if (videoBuffer.length > 100000) {
            successfulProxy = proxy.url;
            break;
          }
        } else if (proxy.type === 'direct') {
          const responseText = await videoResponse.text();
          const videoMatch = responseText.match(/video_url["':]+([^"']+)/i) ||
                            responseText.match(/href=["']([^"']+\.mp4)/i) ||
                            responseText.match(/source\s+src=["']([^"']+)/i);

          if (videoMatch) {
            const videoUrl = videoMatch[1].replace(/&amp;/g, '&');
            videoResponse = await fetch(videoUrl, {
              headers: {
                'Accept': 'video/*, application/octet-stream',
                'User-Agent': proxy.headers['User-Agent']
              },
              timeout: 60000
            });

            if (videoResponse.ok) {
              videoBuffer = await videoResponse.buffer();
              if (videoBuffer.length > 100000) {
                successfulProxy = proxy.url;
                break;
              }
            }
          }
        }
      } catch (proxyError) {
        console.log(`Proxy ${proxy.url} failed:`, proxyError.message);
        lastError = `${proxy.url}: ${proxyError.message}`;
        continue;
      }
    }

    if (!successfulProxy || !videoBuffer) {
      throw new Error(`Video download failed. Last error: ${lastError}`);
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
    form.append('width', '1280');  // Add default HD resolution
    form.append('height', '720');
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