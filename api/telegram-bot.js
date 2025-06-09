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
      `https://saveinsta.app/api/ajaxSearch?q=${encodeURIComponent(cleanUrl)}`,
      cleanUrl.replace('instagram.com', 'ddinstagram.com'),
      cleanUrl.replace('instagram.com', 'instavideosave.net'),
      cleanUrl.replace('www.', ''),
      cleanUrl.replace('instagram.com', 'ddinstagram.com').replace('reel', 'reels')
    ];

    let videoResponse = null;
    let successfulProxy = '';
    let lastError = '';
    let videoBuffer = null;

    for (const proxyUrl of proxyUrls) {
      try {
        console.log(`Trying proxy: ${proxyUrl}`);

        if (proxyUrl.includes('saveinsta.app')) {
          // Handle API-based proxy
          const apiResponse = await fetch(proxyUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
              'Origin': 'https://saveinsta.app',
              'Referer': 'https://saveinsta.app/'
            }
          });

          if (apiResponse.ok) {
            const jsonData = await apiResponse.json();
            if (jsonData.url || (jsonData.links && jsonData.links.length > 0)) {
              const videoUrl = jsonData.url || jsonData.links[0];
              videoResponse = await fetch(videoUrl, {
                headers: {
                  'Accept': 'video/*, application/octet-stream'
                },
                timeout: 60000
              });
              videoBuffer = await videoResponse.buffer();
              if (videoBuffer.length > 100000) {
                successfulProxy = proxyUrl;
                break;
              }
            }
          }
        } else {
          // Handle direct proxy services
          videoResponse = await fetch(proxyUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,video/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'Connection': 'keep-alive',
              'Referer': 'https://www.instagram.com/',
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

          const responseText = await videoResponse.text();
          const videoMatch = responseText.match(/video_url["':]+([^"']+)/i) ||
                            responseText.match(/href=["']([^"']+\.mp4)/i);

          if (videoMatch) {
            const videoUrl = videoMatch[1];
            videoResponse = await fetch(videoUrl, {
              headers: {
                'Accept': 'video/*, application/octet-stream'
              },
              timeout: 60000
            });
            videoBuffer = await videoResponse.buffer();
            if (videoBuffer.length > 100000) {
              successfulProxy = proxyUrl;
              break;
            }
          }
        }
      } catch (proxyError) {
        console.log(`Proxy ${proxyUrl} failed:`, proxyError.message);
        lastError = `${proxyUrl}: ${proxyError.message}`;
        continue;
      }
    }

    if (!successfulProxy || !videoBuffer) {
      throw new Error(`All proxies failed. Last error: ${lastError}`);
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