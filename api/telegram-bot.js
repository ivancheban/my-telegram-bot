const fetch = require('node-fetch');
const FormData = require('form-data');
const { createFFmpeg, fetchFile } = require('@ffmpeg/ffmpeg');

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

    // Step 1: Download video
    const videoResponse = await fetch(fixerUrl);
    if (!videoResponse.ok) throw new Error(`Download from ddinstagram failed`);
    const videoBuffer = await videoResponse.buffer();

    // Step 2: Fix video metadata with FFmpeg
    const ffmpeg = createFFmpeg({ log: false });
    await ffmpeg.load();
    ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoBuffer));
    await ffmpeg.run('-i', 'input.mp4', '-c', 'copy', '-movflags', 'faststart', 'output.mp4');
    const fixedVideoData = ffmpeg.FS('readFile', 'output.mp4');
    await ffmpeg.exit();
    
    // Step 3: Upload the fixed video file to Telegram
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('video', fixedVideoData, { filename: 'video.mp4' });
    form.append('reply_to_message_id', message.message_id);
    
    const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
    await fetch(telegramApiUrl, { method: 'POST', body: form });
    
    response.status(200).send('OK: Processed');
  } catch (error) {
    console.error('CRITICAL ERROR:', error);
    const chatId = request.body.message.chat.id;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: "Sorry, a video processing error occurred." })
    });
    response.status(200).send('OK: Error Handled');
  }
};