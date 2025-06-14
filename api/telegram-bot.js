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
    
    // --- THE FINAL STRATEGY: Your bot will get the video link itself ---

    // 1. Construct the URL to your personal InstaFix service
    const yourInstaFixDomain = 'https://my-personal-instafix.onrender.com'; // <-- Your InstaFix URL
    const fixerUrl = instagramUrl.replace('instagram.com', yourInstaFixDomain.replace('https://', ''));

    // 2. Your bot fetches the page from your InstaFix service
    console.log('Fetching from my InstaFix service:', fixerUrl);
    const fixerResponse = await fetch(fixerUrl);
    const html = await fixerResponse.text();

    // 3. Your bot extracts the direct video URL from the response
    const videoUrlMatch = html.match(/property="og:video" content="([^"]+)"/);
    if (!videoUrlMatch || !videoUrlMatch[1]) {
      throw new Error("Could not find a video URL from the InstaFix service.");
    }
    const directVideoUrl = videoUrlMatch[1];
    console.log('Found direct video URL:', directVideoUrl);

    // 4. Your bot sends the DIRECT video link to Telegram
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
    // Notify the user in chat that something went wrong
    const chatId = request.body.message.chat.id;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: "Sorry, I couldn't process that video." })
    });
    response.status(200).send('OK: Error Handled');
  }
};