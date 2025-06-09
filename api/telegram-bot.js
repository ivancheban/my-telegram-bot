const fetch = require('node-fetch');

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

    // --- FINAL STRATEGY: Use a public yt-dlp API ---
    console.log('Step 1: Calling yt-dlp API for URL:', instagramUrl);
    
    const dlpResponse = await fetch('https://yt-dlp-api.vercel.app/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: instagramUrl })
    });

    const dlpResult = await dlpResponse.json();
    console.log('Step 2: yt-dlp API response received.');

    // Find the best quality mp4 video URL
    const video = dlpResult.formats.find(f => f.ext === 'mp4' && f.vcodec !== 'none');
    if (!video || !video.url) {
        throw new Error('No suitable video format found by yt-dlp.');
    }
    const directVideoUrl = video.url;
    console.log('Step 3: Got direct video URL:', directVideoUrl);
    
    // Step 4: Send the direct video link to Telegram
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            video: directVideoUrl,
            reply_to_message_id: message.message_id
        })
    });
    
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