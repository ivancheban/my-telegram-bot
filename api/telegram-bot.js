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

    // Step 1: Start the download job, acting like a browser
    console.log('Step 1: Starting download job on loader.to');
    const startResponse = await fetch(`https://loader.to/api/button/?url=${instagramUrl}&f=mp4`, {
        // --- THE FIX: ADD A USER-AGENT HEADER ---
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36'
        }
    });
    const startResult = await startResponse.json();
    
    if (!startResult.success || !startResult.id) {
        throw new Error(`loader.to failed to start job. Info: ${startResult.info}`);
    }
    const jobId = startResult.id;
    console.log('Step 2: Job started with ID:', jobId);

    // Step 2: Poll for the result
    let directVideoUrl = '';
    let attempts = 0;
    while (attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log(`Step 3 (Attempt ${attempts + 1}): Checking job status...`);
        const statusResponse = await fetch(`https://loader.to/api/ajax/download/?id=${jobId}`);
        const statusResult = await statusResponse.json();

        if (statusResult.success === 1) {
            directVideoUrl = statusResult.download_url;
            console.log('Step 4: Job complete! Got direct URL:', directVideoUrl);
            break;
        } else if (statusResult.success !== 0 || statusResult.text !== 'downloading') {
            throw new Error(`loader.to job failed with status: ${statusResult.text}`);
        }
        attempts++;
    }

    if (!directVideoUrl) {
        throw new Error('loader.to job timed out.');
    }

    // Step 5: Send the direct video link to Telegram
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