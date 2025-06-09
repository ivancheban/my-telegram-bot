const fetch = require('node-fetch');
const FormData = require('form-data');

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

    // --- The "Naked" Import to find the function wherever it is ---
    const ffmpegModule = await import('@ffmpeg/ffmpeg');
    const createFFmpeg = ffmpegModule.createFFmpeg || ffmpegModule.default.createFFmpeg;
    const fetchFile = ffmpegModule.fetchFile || ffmpegModule.default.fetchFile;

    if (typeof createFFmpeg !== 'function') {
      throw new Error("Could not locate createFFmpeg function in the imported module.");
    }

    // 1. Download the video
    const videoResponse = await fetch(fixerUrl);
    if (!videoResponse.ok) throw new Error(`Failed to download from ddinstagram.`);
    const videoBuffer = await videoResponse.buffer();

    // 2. Fix the video metadata
    const ffmpeg = createFFmpeg({ log: false });
    await ffmpeg.load();
    ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoBuffer));
    await ffmpeg.run('-i', 'input.mp4', '-c', 'copy', '-movflags', 'faststart', 'output.mp4');
    const fixedVideoData = ffmpeg.FS('readFile', 'output.mp4');
    await ffmpeg.exit();
    
    // 3. Upload the fixed video
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('video', fixedVideoData, { filename: 'video.mp4' });
    
    const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
    await fetch(telegramApiUrl, { method: 'POST', body: form });

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