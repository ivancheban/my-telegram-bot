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

    // --- FINAL STRATEGY: Use the loader.to API ---
    // This API works in two steps: start a job, then get the result.

    // Step 1: Start the download job on loader.to
    console.log('Step 1: Starting download job on loader.to');
    const startResponse = await fetch(`https://loader.to/api/button/?url=${instagramUrl}&f=mp4`);
    const startResult = await startResponse.json();
    
    if (!startResult.success || !startResult.id) {
        throw new Error(`loader.to failed to start job. Info: ${startResult.info}`);
    }
    const jobId = startResult.id;
    console.log('Step 2: Job started with ID:', jobId);

    // Step 2: Poll for the result until it's ready
    let directVideoUrl = '';
    let attempts = 0;
    while (attempts < 10) { // Try for a maximum of 10 times (20 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        console.log(`Step 3 (Attempt ${attempts + 1}): Checking job status...`);
        const statusResponse = await fetch(`https://loader.to/api/ajax/download/?id=${jobId}`);
        const statusResult = await statusResponse.json();

        if (statusResult.success === 1) { // 1 means success
            directVideoUrl = statusResult.download_url;
            console.log('Step 4: Job complete! Got direct URL:', directVideoUrl);
            break;
        } else if (statusResult.success === 0 && statusResult.text === 'downloading') {
            console.log('Still downloading...');
        } else {
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