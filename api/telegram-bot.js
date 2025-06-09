const fetch = require('node-fetch');
const FormData = require('form-data');
// We will import ffmpeg dynamically to ensure compatibility

module.exports = async (request, response) => {
  if (request.method !== 'POST') {
    return response.status(405).send('Method Not Allowed');
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.error("FATAL: Bot token not configured.");
    return response.status(200).send('OK');
  }

  try {
    const update = request.body;
    if (!update.message || !update.message.text) {
      return response.status(200).send('OK: Not a text message');
    }

    const message = update.message;
    if (message.from && message.from.is_bot) {
      return response.status(200).send('OK: Ignored bot message');
    }

    const text = message.text;
    const chatId = message.chat.id;
    
    const instagramRegex = /https?:\/\/(www\.)?instagram\.com\/[\w\-\.\/]+/;
    const match = text.match(instagramRegex);

    if (!match) {
      return response.status(200).send('OK: No Instagram URL found');
    }

    const instagramUrl = match[0];
    const cleanUrl = instagramUrl.split('?')[0];
    const fixerUrl = cleanUrl.replace('instagram.com', 'ddinstagram.com');

    // --- The Definitive "Download, Fix, Upload" Strategy ---
    const { createFFmpeg, fetchFile } = (await import('@ffmpeg/ffmpeg')).default;
    
    // 1. Your function downloads the video
    const videoResponse = await fetch(fixerUrl);
    if (!videoResponse.ok) throw new Error(`Failed to download from ddinstagram.`);
    const videoBuffer = await videoResponse.buffer();

    // 2. Your function fixes the video metadata using FFmpeg
    const ffmpeg = createFFmpeg({ log: false });
    await ffmpeg.load();
    ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoBuffer));
    await ffmpeg.run('-i', 'input.mp4', '-c', 'copy', '-movflags', 'faststart', 'output.mp4');
    const fixedVideoData = ffmpeg.FS('readFile', 'output.mp4');
    await ffmpeg.exit();
    
    // 3. Your function uploads the fixed video file to Telegram
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('video', fixedVideoData, { filename: 'video.mp4' });
    
    const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
    await fetch(telegramApiUrl, { method: 'POST', body: form });

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